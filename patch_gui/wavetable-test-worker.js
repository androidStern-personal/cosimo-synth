class mt {
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
function ht(t, e) {
  return new mt(t, e);
}
async function pt(t, e) {
  const n = ht(t, e);
  return await n.start(), n;
}
const Be = 8, le = 5, $e = 8, gt = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Ke = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
});
function Ve(t) {
  return Ke[t];
}
function It(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= le)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * $e + gt[t];
}
function bt(t, e) {
  const n = new Array(Be).fill(0);
  return Ke[t].forEach((i, r) => {
    const a = e[i];
    if (typeof a != "number" || !Number.isFinite(a))
      throw new Error(`Missing lane parameter value: ${t}.${i}`);
    n[r] = a;
  }), n;
}
const b = (t, e) => ({ label: t, value: e });
function E(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const A = Object.freeze({
  filter: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), c = (t, e, n, i, r, a, l, d = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: l,
  step: d.step ?? (a - r) / 1e3,
  scale: d.scale ?? "linear",
  unit: d.unit ?? "",
  choices: d.choices,
  quick: d.quick ?? !1,
  modulationTargetIndex: d.modulationTargetIndex ?? null,
  modulationApplication: d.modulationApplication ?? (d.modulationTargetIndex === void 0 || d.modulationTargetIndex === null ? null : "linear"),
  modulationDragStyle: d.modulationDragStyle
}), vt = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], St = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], yt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: A.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      c("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(b), quick: !0 }),
      c("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      c("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      c("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
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
      c("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Classic", 0), b("Harmonics", 1)] }),
      c("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      c("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      c("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      c("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      c("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      c("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [b("Symmetric", 0), b("Asymmetric", 1), b("Wavefold", 2)] })
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
      c("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
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
    iconUrl: A.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      c("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(b) }),
      c("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(b) }),
      c("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      c("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      c("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      c("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      c("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(b) }),
      c("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
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
      c("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      c("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      c("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      c("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 })
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
      c("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      c("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      c("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: vt.map(b) }),
      c("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      c("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      c("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      c("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      c("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
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
      c("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      c("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      c("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: St.map(b) }),
      c("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      c("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      c("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
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
      c("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      c("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      c("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      c("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], G = yt, ze = Object.freeze(
  G.flatMap((t) => t.parameters)
);
new Map(
  ze.map((t) => [t.endpointID, t])
);
function We(t) {
  const e = G.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function He() {
  return ze;
}
const I = "lane.v1", Tt = "laneTopology", ge = "laneSlotParams", te = 16, xt = 8, Ge = 4, Rt = 3, je = le * $e, qe = 4, Et = 4, At = je, wt = je + qe, Dt = 0, Mt = 1;
function Lt(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Ge)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << xt;
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
]), z = Object.freeze({
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
  Object.entries(z).map(([t, e]) => [e, t])
);
const _t = Object.freeze({
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
  y.map((t) => [_t[t], t])
);
function Je() {
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
function kt(t) {
  return Object.fromEntries(
    We(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Ct() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...y],
    enabled: Je(),
    params: Object.fromEntries(
      y.map((t) => [t, kt(t)])
    )
  };
}
function Ft(t) {
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
function U(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Nt(t) {
  return typeof t != "string" ? null : y.find((e) => e === t) ?? null;
}
function Ot(t) {
  const e = Ft(t);
  if (e._tag === "err")
    return e;
  if (!U(e.value))
    return { _tag: "err", message: `${I} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const d of Reflect.ownKeys(e.value))
    if (typeof d != "string" || !n.has(d))
      return { _tag: "err", message: `${I} has unexpected field ${String(d)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${I} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== y.length)
    return { _tag: "err", message: `${I}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const d of e.value.order) {
    const o = Nt(d);
    if (o === null || r.has(o))
      return { _tag: "err", message: `${I}.order is not a complete permutation` };
    r.add(o), i.push(o);
  }
  if (!U(e.value.enabled))
    return { _tag: "err", message: `${I}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== y.length)
    return { _tag: "err", message: `${I}.enabled must contain every effect once` };
  const a = Je();
  for (const d of y) {
    const o = e.value.enabled[d];
    if (typeof o != "boolean")
      return { _tag: "err", message: `${I}.enabled.${d} must be boolean` };
    a[d] = o;
  }
  if (!U(e.value.params))
    return { _tag: "err", message: `${I}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== y.length)
    return { _tag: "err", message: `${I}.params must contain every effect once` };
  const l = {};
  for (const d of y) {
    const o = e.value.params[d];
    if (!U(o))
      return { _tag: "err", message: `${I}.params.${d} must be an object` };
    const s = We(d).parameters;
    if (Reflect.ownKeys(o).length !== s.length)
      return { _tag: "err", message: `${I}.params.${d} must contain every parameter once` };
    const u = {};
    for (const f of s) {
      const m = o[f.endpointID];
      if (typeof m != "number" || !Number.isFinite(m))
        return { _tag: "err", message: `${I}.params.${d}.${f.endpointID} must be a finite number` };
      u[f.endpointID] = m;
    }
    l[d] = u;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: a, params: l }
  };
}
const Qe = 40, Xe = 18e3, ne = y.map((t) => z[t]), Pt = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ut = /^(parallel|split)#([1-9][0-9]*)$/;
function de(t) {
  if (typeof t != "string")
    return null;
  const e = Pt.exec(t);
  if (e === null)
    return null;
  const n = ne.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > le ? null : { deviceType: n, instanceNumber: i };
}
function Ye(t) {
  if (typeof t != "string")
    return null;
  const e = Ut.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? qe : Et) ? null : { groupKind: n, unitNumber: i };
}
function k(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function W(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function h(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Bt(t, e) {
  const n = de(t);
  if (n === null)
    return { failure: h(`device id ${t} is not a pool instance`) };
  if (!k(e) || !W(e, ["params"]) || !k(e.params))
    return { failure: h(`device ${t} must be { params }`) };
  const i = Ve(n.deviceType);
  if (Reflect.ownKeys(e.params).length !== i.length)
    return { failure: h(`device ${t} must carry every parameter once`) };
  const r = {};
  for (const a of i) {
    const l = e.params[a];
    if (typeof l != "number" || !Number.isFinite(l))
      return { failure: h(`device ${t}.${a} must be a finite number`) };
    r[a] = l;
  }
  return { record: { params: r } };
}
function $t(t, e) {
  return !k(t) || t.kind !== "device" ? { failure: h("branches may hold device placements only") } : W(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: h(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: h(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: h("a device placement is { kind, deviceId, enabled }") };
}
function Ie(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Qe && t <= Xe;
}
function Kt(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (s) {
      const u = s instanceof Error ? s.message : String(s);
      return h(`is not valid JSON: ${u}`);
    }
  if (!k(e) || !W(e, ["format", "version", "devices", "chain"]))
    return h("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return h("must be cosimo.lane version 2");
  if (!k(e.devices))
    return h("devices must be an object");
  if (!Array.isArray(e.chain))
    return h("chain must be an array");
  const n = {};
  for (const s of Reflect.ownKeys(e.devices)) {
    if (typeof s != "string")
      return h("device ids must be strings");
    const u = Bt(s, e.devices[s]);
    if ("failure" in u)
      return u.failure;
    n[s] = u.record;
  }
  const i = new Set(Object.keys(n)), r = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), l = [];
  let d = 0;
  const o = (s) => {
    const u = $t(s, i);
    return "placement" in u && (r.set(
      u.placement.deviceId,
      (r.get(u.placement.deviceId) ?? 0) + 1
    ), d += 1), u;
  };
  for (const s of e.chain) {
    if (!k(s))
      return h("chain nodes must be objects");
    if (s.kind === "device") {
      const v = o(s);
      if ("failure" in v)
        return v.failure;
      l.push(v.placement);
      continue;
    }
    if (s.kind !== "parallel" && s.kind !== "split")
      return h(`unknown chain node kind ${String(s.kind)}`);
    const u = s.kind === "split", f = u ? ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"] : ["kind", "groupId", "enabled", "branches"];
    if (!W(s, f))
      return h(`a ${s.kind} group is { ${f.join(", ")} }`);
    const m = Ye(s.groupId);
    if (m === null || m.groupKind !== s.kind)
      return h(`group id ${String(s.groupId)} does not name a ${s.kind} unit`);
    if (a.has(String(s.groupId)))
      return h(`group ${String(s.groupId)} is used twice`);
    if (a.add(String(s.groupId)), typeof s.enabled != "boolean")
      return h(`group ${String(s.groupId)} needs a boolean enable`);
    const p = u ? Rt : Ge;
    if (!Array.isArray(s.branches) || s.branches.length < 2 || s.branches.length > p)
      return h(`group ${String(s.groupId)} needs 2..${p} branches`);
    if (u && (!Ie(s.xoverLowHz) || !Ie(s.xoverHighHz)))
      return h(`group ${String(s.groupId)} crossovers must sit in ${Qe}..${Xe} Hz`);
    d += 1;
    const S = [];
    for (const v of s.branches) {
      if (!Array.isArray(v))
        return h(`group ${String(s.groupId)} branches must be arrays`);
      const C = [];
      for (const P of v) {
        const _ = o(P);
        if ("failure" in _)
          return _.failure;
        C.push(_.placement);
      }
      S.push(C);
    }
    l.push(u ? {
      kind: "split",
      groupId: String(s.groupId),
      enabled: s.enabled,
      xoverLowHz: s.xoverLowHz,
      xoverHighHz: s.xoverHighHz,
      branches: S
    } : {
      kind: "parallel",
      groupId: String(s.groupId),
      enabled: s.enabled,
      branches: S
    });
  }
  for (const s of i)
    if ((r.get(s) ?? 0) !== 1)
      return h(`device ${s} must be placed exactly once`);
  return d > te ? h(`flattens to ${d} wire entries; the topology upload holds ${te}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: l } };
}
function Ze(t) {
  const e = {};
  for (const n of y) {
    const i = z[n];
    e[`${i}#1`] = {
      params: Object.fromEntries(Ve(i).map((r) => [
        r,
        t.params[n][r] ?? 0
      ]))
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${z[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const be = ["distortion#1", "delay#1", "reverb#1"];
function ve() {
  const t = Ze(Ct()), e = {};
  for (const n of be) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && be.includes(n.deviceId))
  };
}
function Vt(t) {
  if (t === void 0)
    return ve();
  const e = Kt(t);
  if (e._tag === "ok")
    return e.value;
  const n = Ot(t);
  return n._tag === "ok" ? Ze(n.value) : ve();
}
function zt(t) {
  return Object.keys(t.devices).map((e) => {
    const n = de(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => ne.indexOf(e.parsed.deviceType) - ne.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function ie(t) {
  const e = de(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return It(e.deviceType, e.instanceNumber - 1);
}
function et(t) {
  const e = Ye(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? At : wt) + (e.unitNumber - 1);
}
function Wt(t) {
  const e = new Array(te).fill(0);
  let n = 0, i = 0;
  const r = (a, l, d) => {
    e[i] = Lt(a, l), d && (n |= 1 << i), i += 1;
  };
  for (const a of t.chain) {
    if (a.kind === "device") {
      r(ie(a.deviceId), 0, a.enabled);
      continue;
    }
    r(et(a), a.branches.length, a.enabled), a.branches.forEach((l, d) => {
      for (const o of l)
        r(ie(o.deviceId), d + 1, o.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function Ht(t) {
  const e = new Array(Be).fill(0);
  return e[Dt] = t.xoverLowHz, e[Mt] = t.xoverHighHz, e;
}
function Gt(t) {
  const e = [];
  let n = 0;
  for (const i of zt(t))
    n += 1, e.push({
      endpointID: ge,
      value: {
        slotId: ie(i.instanceId),
        deliverySerial: n,
        values: bt(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: ge,
      value: {
        slotId: et(i),
        deliverySerial: n,
        values: Ht(i)
      }
    }));
  return e.push({
    endpointID: Tt,
    value: Wt(t)
  }), e;
}
const jt = "runtimeState";
function qt(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Jt = {
  endpointID: jt,
  required: !0,
  mapValue: qt
}, Qt = 2e3;
function Se(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Xt(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Se(i, e) ? {
    found: !0,
    value: i[e]
  } : Se(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function ye(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Yt {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Zt(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Xt(e, this.options.stateKey);
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
    }, r = ye(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, l = this.options.buildRuntimeEvents(i, a), d = ye({
      runtimeEndpoints: n,
      events: l
    });
    if (d === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (l.length === 0) {
      this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(l, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(l);
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
        this.options.sendTimeoutMilliseconds ?? Qt
      );
    this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Zt(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function en(t, e) {
  return new Yt(t, e);
}
function tn(t) {
  return en(t, {
    stateKey: I,
    runtimeEndpointDependencies: [Jt],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Vt,
    buildRuntimeEvents: ({ state: e }) => [...Gt(e)]
  });
}
function T(t, e) {
  if (!t)
    throw new Error(e);
}
function q(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function nn(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function ae(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function tt(t) {
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
function an() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function J(t, e) {
  const n = an();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (nn(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Te(t) {
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
  throw new Error(`Unsupported text resource payload (${tt(t)})`);
}
function rn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return ae(t);
  throw new Error(`Unsupported binary resource payload (${tt(t)})`);
}
function on(t) {
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
      const l = a;
      T(l.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(l[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function nt(t) {
  const e = new DataView(t);
  T(q(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), T(q(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, l = null, d = null, o = null, s = 12;
  for (; s + 8 <= e.byteLength; ) {
    const f = q(e, s, 4), m = e.getUint32(s + 4, !0), p = s + 8;
    f === "fmt " ? (n = e.getUint16(p, !0), i = e.getUint16(p + 2, !0), r = e.getUint32(p + 4, !0), l = e.getUint16(p + 12, !0), a = e.getUint16(p + 14, !0)) : f === "data" && (d = p, o = m), s = p + m + m % 2;
  }
  T(n !== null, "Wave file is missing a fmt chunk"), T(d !== null && o !== null, "Wave file is missing a data chunk"), T(i === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && a === 32)
    u = new Float32Array(t.slice(d, d + o));
  else if (n === 1 && a === 16) {
    const f = o / 2, m = new Int16Array(t.slice(d, d + o));
    u = new Float32Array(f);
    for (let p = 0; p < f; p += 1)
      u[p] = m[p] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: l ?? 0,
    samples: u
  };
}
async function xe(t) {
  T(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return T(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function re(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function it(t) {
  const e = new Uint8Array(t).buffer, n = nt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function sn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (T(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), r = async (o) => {
    T(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const s = await t.readResourceAsAudioData(o);
    return on(s);
  }, a = (o) => {
    const s = t.getResourceAddress?.(o);
    return s ?? null;
  }, l = async (o, s = t.getResourceAddress?.(o)) => {
    const u = J(o, s), f = await xe(u), m = nt(f);
    return {
      sampleRate: m.sampleRate,
      samples: m.samples
    };
  }, d = async (o, s = t.getResourceAddress?.(o)) => {
    const u = J(o, s);
    return new Uint8Array(await xe(u));
  };
  return {
    async readText(o) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Te(await i(o));
      const s = a(o);
      return e === "url" && s !== null ? re(await d(o, s)) : typeof t.readResource == "function" ? Te(await i(o)) : re(await d(o, s));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? rn(await i(o)) : d(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(o);
      const s = a(o);
      return n === "url" && s !== null ? l(o, s) : typeof t.readResourceAsAudioData == "function" ? r(o) : it(await this.readBytes(o));
    },
    getURL(o) {
      return J(o, t.getResourceAddress?.(o));
    }
  };
}
function ln(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return sn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function dn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(l) {
      if (e)
        return e(l);
      if (n)
        return JSON.stringify(await n(l));
      if (i)
        return re(await i(l));
      throw new Error(`Resource client cannot read text ${l}`);
    },
    async readJSON(l) {
      return n ? n(l) : JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      if (i)
        return i(l);
      if (e)
        return ae(await e(l));
      if (n)
        return ae(JSON.stringify(await n(l)));
      throw new Error(`Resource client cannot read bytes ${l}`);
    },
    async readAudio(l) {
      return r ? r(l) : it(await this.readBytes(l));
    },
    getURL(l) {
      return a ? a(l) : null;
    }
  };
}
function cn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function un(t) {
  return cn(t) ? dn(t) : ln(t);
}
const K = 2048;
function F(t, e) {
  if (!t)
    throw new Error(e);
}
function fn(t) {
  F(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    F(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), F(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), F(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), F(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const mn = 2048, at = 11, hn = 256;
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function pn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Re = /* @__PURE__ */ new Map();
function gn(t) {
  const e = Re.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, l = r;
    for (let d = 0; d < n; d += 1)
      a = a << 1 | l & 1, l >>= 1;
    i[r] = a;
  }
  return Re.set(t, i), i;
}
function rt(t, e, n = !1) {
  const i = t.length;
  x(i === e.length, "FFT real and imaginary buffers must have the same length"), x(pn(i), "FFT input length must be a power of two");
  const r = gn(i);
  for (let a = 0; a < i; a += 1) {
    const l = r[a];
    if (l <= a)
      continue;
    const d = t[a];
    t[a] = t[l], t[l] = d;
    const o = e[a];
    e[a] = e[l], e[l] = o;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const l = a >> 1, d = (n ? 2 : -2) * Math.PI / a, o = Math.cos(d), s = Math.sin(d);
    for (let u = 0; u < i; u += a) {
      let f = 1, m = 0;
      for (let p = 0; p < l; p += 1) {
        const S = u + p, v = S + l, C = t[v], P = e[v], _ = f * C - m * P, me = f * P + m * C, he = t[S], pe = e[S];
        t[S] = he + _, e[S] = pe + me, t[v] = he - _, e[v] = pe - me;
        const ft = f * o - m * s;
        m = f * s + m * o, f = ft;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function ot(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function In(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = mn,
  maxFramesPerTable: i = hn
} = {}) {
  const r = Float32Array.from(t);
  x(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  x(a > 0, "Source wavetable files must contain at least one frame"), x(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && x(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const l = [];
  for (let d = 0; d < a; d += 1) {
    const o = d * n, s = o + n;
    l.push(ot(r.slice(o, s)));
  }
  return {
    frameCount: a,
    frames: l
  };
}
function Ee(t) {
  const e = ot(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return rt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function bn(t, e, {
  mipLevelCount: n = at
} = {}) {
  const i = t?.real?.length ?? 0;
  x(i > 0, "Spectrum must contain real samples"), x(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), x(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), l = new Float64Array(i);
  for (let d = 1; d <= r; d += 1) {
    a[d] = t.real[d], l[d] = t.imaginary[d];
    const o = (i - d) % i;
    o !== d && (a[o] = t.real[o], l[o] = t.imaginary[o]);
  }
  return rt(a, l, !0), Float32Array.from(a);
}
const ce = ["A", "B", "C"], st = [
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
], vn = [
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
], L = Object.freeze([
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
]), Sn = Object.freeze([
  ...ce.flatMap((t) => st.map(
    (e) => `osc${t}.${e}`
  )),
  ...vn
]);
new Set(
  ce.flatMap((t) => st.map(
    (e) => `osc${t}.${e}`
  ))
);
const lt = Object.freeze(
  Sn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), yn = He().filter((t) => t.modulationTargetIndex !== null), Tn = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ue(t) {
  const e = xn(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function xn(t) {
  const e = Tn.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const dt = Object.freeze(
  yn.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: ue(t.endpointID),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), D = Object.freeze([
  ...lt,
  ...dt
]), V = L.length, Rn = lt.length, En = dt.length, An = V * D.length, wn = new Map(L.map((t) => [t.id, t])), Dn = new Map(L.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Mn = new Map(D.map((t) => [t.kind, t]));
function Ln() {
  if (V !== 14 || Rn !== 56 || En !== 36 || An !== 1288)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = L.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 36]]) {
    const n = D.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (wn.size !== V || Dn.size !== V || Mn.size !== D.length)
    throw new Error("Modulation identities must be unique");
}
Ln();
const _n = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]]
]), kn = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Cn(t) {
  if (typeof t != "string")
    return null;
  const e = kn.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = _n.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function Fn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Nn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
L.filter((t) => t.group === "voice").length;
L.filter((t) => t.group === "macro").length;
function On(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Pn(t) {
  throw new Error(t ?? "Invariant violated");
}
const Un = "globalTune", Bn = "globalTuneSemitones", w = -24, N = 24, Ae = 0, $n = -48, Kn = 48, we = -48, Vn = 6, zn = 0, De = (zn - we) / (Vn - we);
function B(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const Wn = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      B("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      B("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      B("mix", "Mix", 100, 100),
      B("drive", "Drive", 15, 0)
    ]
  }
], Me = 1e-6;
function R(t, e) {
  if (!Number.isFinite(t) || t < -Me || t > 1 + Me)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function H(t, e) {
  return R(t / 100, `${e} catalog percentage`);
}
function j(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Hn(t) {
  return 20 * 1e3 ** t;
}
function Gn(t) {
  return R(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function jn(t) {
  return 0.1 * 200 ** t;
}
function qn(t) {
  return R(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Jn(t) {
  return t;
}
function Qn(t) {
  return R(t, "filterMix endpoint conversion");
}
function O(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Xn(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: O("filterCutoff", Hn, Gn),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: O("filterQ", jn, qn),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: O("filterMix", Jn, Qn),
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
function ct(t) {
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
      return On(t);
  }
}
function Yn(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Zn(t, e) {
  const n = j(t.moduleId, e.id), i = ct(e.format), r = Xn(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: H(e.defaultPercent, n),
    initialValue: H(e.initialPercent, n),
    format: i,
    modAmount: Yn(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const ei = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: De * 100, defaultPercent: De * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function ti(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ni(t, e) {
  const n = `osc${t}`, i = j(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: H(e.defaultPercent, i),
    initialValue: H(e.initialPercent, i),
    format: ct(e.format),
    modAmount: ti(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const ii = Object.freeze(
  ce.flatMap((t) => ei.map((e) => ni(t, e)))
), ai = Object.freeze({
  targetId: j("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: R(
    (Ae - w) / (N - w),
    "Global Tune default"
  ),
  initialValue: R(
    (Ae - w) / (N - w),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: N },
  modAmount: {
    min: $n,
    max: Kn,
    unit: "st",
    digits: 2
  },
  binding: O(
    Un,
    (t) => w + (N - w) * t,
    (t) => R(
      (t - w) / (N - w),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Bn
}), ri = Object.freeze([
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
function oi(t) {
  const e = j(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (a) => t.min + n * a, r = (a) => R(
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
    binding: O(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const si = Object.freeze(
  ri.map(oi)
);
function li(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Q(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return R(n, `${t.endpointID} endpoint conversion`);
}
function di(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function ci(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function ui(t) {
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
function fi(t) {
  const e = li(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Q(t, t.initial),
    initialValue: Q(t, t.initial),
    format: ci(t),
    modAmount: ui(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => di(t, n),
      fromEngine: (n) => Q(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ue(t.endpointID)
  });
}
const fe = Object.freeze(
  [
    ...G.flatMap((t) => t.parameters.map(fi)),
    ai,
    ...ii,
    ...si,
    ...Wn.flatMap(
      (t) => t.parameters.map(
        (e) => Zn(t, e)
      )
    )
  ]
), mi = new Map(
  fe.map((t) => [t.targetId, t])
), ut = fe.filter(
  (t) => t.modulationTargetKind !== null
), oe = new Map(
  ut.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (mi.size !== fe.length)
  throw new Error("Target descriptor IDs must be unique");
if (ut.length !== D.length || oe.size !== D.length || D.some((t) => oe.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function X(t) {
  const e = oe.get(t);
  return e === void 0 ? Pn(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  G.map((t) => [t.id, t.label])
);
function hi(t) {
  const e = Nn(t);
  return e === 1 ? "" : ` ${e}`;
}
function pi(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = X(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Cn(t);
  if (n !== null) {
    const i = X(Fn(n));
    return `${i.moduleId.toUpperCase()}${hi(n)} ${i.label.toUpperCase()}`;
  }
  return X(t).label.toUpperCase();
}
const gi = He().filter((t) => t.modulationTargetIndex !== null), Ii = new Map(
  gi.map((t) => [ue(t.endpointID), t])
), bi = {
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
L.map((t) => ({
  value: t.id,
  label: bi[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const vi = D.map((t) => ({
  value: t.kind,
  label: pi(t.kind)
}));
vi.filter((t) => !Si(t.value));
function Si(t) {
  return Ii.has(t);
}
const yi = [
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
], Ti = [
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
  yi.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  Ti.map((t, e) => [t, 2 ** e])
);
const xi = "runtimeSyncRequest", Ri = 2147483647, Ei = "runtimeState", Ai = "retryDesiredTableRequest", wi = "workerLoadFailure", Di = "serviceLoadAbort", Mi = "wavetableLoadBegin", Li = "wavetableMipFrame", _i = "wavetableUploadAck", ki = "wavetableMipRequest", Ci = "wavetablePrewarmRequest", Fi = "wavetablePrewarmNotification", Ni = "assets/factory-bank-catalog.json", se = 3, Oi = 1, Pi = se * K, Ui = 1, Bi = 2, $i = 3, Ki = 1, Vi = 2, zi = 2e4, $ = Ui, Wi = Bi, Le = $i, M = Ki, _e = Vi, Hi = 48 * 1024 * 1024, Y = 3;
function ke(t, e) {
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
function Ce(t) {
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
function Fe(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Ne(t, e) {
  if (!t)
    throw new Error(e);
}
function Gi(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function ji(t, e) {
  return fn(await t.readJSON(e));
}
function qi(t) {
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
function Ji(t, e) {
  const n = Math.round(Number(t) || 0);
  return Gi(n, 0, Math.max(0, e - 1));
}
function Z(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Qi(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Oe(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Pe(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Ue() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Xi(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Yi {
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
    this.connection = e, this.resourceClient = un(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ni, this.maxBatchesInFlight = ke(
      n.maxFramesInFlight,
      Oi
    ), this.mipLevelCount = n.mipLevelCount ?? at, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Hi) || 0)), this.serviceLoadTimeoutMs = ke(n.serviceLoadTimeoutMs, zi), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, g("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Ei, this.handleRuntimeState), this.connection.addEndpointListener?.(_i, this.handleUploadAck), this.connection.addEndpointListener?.(ki, this.handleMipRequest), this.connection.addEndpointListener?.(Ci, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Fi, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      xi,
      Ri
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await ji(this.resourceClient, this.catalogPath), g("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Y; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Oe(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Oe(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Z(
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
          ...Pe(this.serviceTable.frameCount),
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
          failurePhase: Le,
          failureReasonCode: _e
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Le || e.failureReasonCode !== _e ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: l = $,
    failureReasonCode: d = M
  }) {
    this.connection.sendEventOrValue?.(wi, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: a,
      failurePhase: l,
      failureReasonCode: d
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: a = M
  }) {
    this.connection.sendEventOrValue?.(Di, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest(e) {
    g("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ce(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Ai, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Ji(e, i.tables.length), a = i.tables[r];
    Ne(a, `Could not resolve table ${r}`);
    const l = Qi(a, K, this.mipLevelCount), d = this.tableCache.get(l);
    if (d)
      return d.lastUsedSerial = this.cacheUseSerial++, g("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: d.frameCount,
        cacheBytes: this.tableCacheBytes
      }), d;
    const o = Ue();
    g("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const s = await this.resourceClient.readAudio(a.sourceWav), u = In(s.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: K
    });
    return g("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(Ue() - o)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: r,
      tableMeta: a,
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Mi, {
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
      failurePhase: $,
      failureReasonCode: M
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: $,
      failureReasonCode: M
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = $,
    failureReasonCode: i = M
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
        detail: ee(a)
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
      this.isCurrentRuntimeState(e) && (g("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: ee(l)
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
    for (let e = 0; e < Y; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Xi(() => {
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
          failureReasonCode: M
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
    const n = qi(e ?? {});
    if (g("info", "Received runtime state", Ce(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Y)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, a = this.latestRuntimeStates[r], l = a ? this.getDesiredRetryKey(a) : null, d = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || l !== d) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let l = 0; l < r.frameCount; l += 1)
          r.spectra[l] || (r.spectra[l] = Ee(r.frames[l]));
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
          detail: ee(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), a = Math.trunc(Number(e?.tableIndex)), l = Math.trunc(Number(e?.mipIndex)), d = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || l < 0 || l >= this.mipLevelCount)
      return null;
    const o = Z(
      n,
      i,
      r,
      a,
      l
    );
    let s = this.mipJobs.get(o);
    return s ? (!s.completed && d > s.urgencyLevel && (s.urgencyLevel = d), s) : (s = {
      key: o,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: a,
      mipIndex: l,
      urgencyLevel: d,
      ...Pe(this.serviceTable.frameCount),
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), a = Math.trunc(Number(n.generation)), l = Math.trunc(Number(n.tableIndex)), d = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndexBase)), s = Math.trunc(Number(n.frameCount)), u = Z(
      i,
      r,
      a,
      l,
      d
    ), f = this.mipJobs.get(u), m = this.serviceTable?.frameCount ?? 0, p = Math.min(
      se,
      m - o
    );
    if (!(!f || f.completed || !f.inFlightBatchBases.has(o) || s <= 0 || s !== p)) {
      f.inFlightBatchBases.delete(o);
      for (let S = 0; S < s; S += 1) {
        const v = o + S;
        f.ackedFrames[v] || (f.ackedFrames[v] = 1, f.ackedFrameCount += 1);
      }
      f.ackedFrameCount === m && f.nextFrameIndex >= m && f.inFlightBatchBases.size === 0 && (f.completed = !0, this.activeUploadKey === f.key && (this.activeUploadKey = null)), Fe(o, s, m) && g("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: a,
        tableIndex: f.tableIndex,
        mipIndex: d,
        frameIndexBase: o,
        batchFrameCount: s,
        ackedFrameCount: f.ackedFrameCount,
        frameCount: m,
        inFlightBatches: f.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Ne(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Ee(this.serviceTable.frames[e]);
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
        se,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(Pi);
      try {
        for (let a = 0; a < i; a += 1) {
          const l = n + a, d = this.getSpectrumForFrame(l), o = bn(d, e.mipIndex);
          r.set(o, a * K);
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
            failurePhase: Wi,
            failureReasonCode: M
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Li, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), Fe(n, i, this.serviceTable.frameCount) && g("info", "Sent wavetable mip batch", {
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
function ee(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Zi(t, e = {}) {
  return new Yi(t, e);
}
async function ea(t, e = {}) {
  return pt(t, [
    tn,
    () => Zi(t, e)
  ]);
}
export {
  ea as default
};
