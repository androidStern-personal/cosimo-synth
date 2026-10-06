async function Tn(e) {
  const t = [];
  for (const n of [...e].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      t.push(r);
    }
  return t;
}
async function Qo(e, t) {
  const n = [];
  try {
    for (const i of t) {
      const o = await i(e);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await Tn(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await Tn(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const Xo = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Yo(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !Xo.has(e);
}
function Zo(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
const Er = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), Rr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function y(e, t = {}) {
  return Object.freeze({ kind: "parameter", endpoint: e, ...t });
}
function ae(e) {
  if (e.lifetime === "user" && e.history === !0)
    throw new Error("A user-lifetime value is shared across projects and cannot take part in Undo. Remove history: true.");
  const t = Object.freeze({ ...e.codec }), n = e.lifetime === "user" ? !1 : e.history;
  return Object.freeze({
    kind: "stored",
    initial: t.parse(e.initial),
    codec: t,
    ...e.lifetime ? { lifetime: e.lifetime } : {},
    ...n !== void 0 ? { history: n } : {},
    ...e.preset === !1 ? { preset: !1 } : {},
    ...e.engine ? { engine: e.engine } : {}
  });
}
function An(e) {
  const t = ae({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history, preset: e.preset }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const o = e.engine, a = e.prepare, s = e.prepare, c = o.length;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (u, l) => ({
        length: c,
        write: (m) => a(u, m, l)
      })
    }) });
  }
  const r = e.prepare, i = e.engine;
  return Object.freeze({ ...t, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: r,
    delivery: i
  }) });
}
const ei = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function ti(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function ni(e) {
  return Object.keys(e).filter((t) => e[t]?.preset !== !1);
}
function ri(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = ti(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !Yo(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(e)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(e)) o.kind === "stored" && o[Er]?.(e);
  const i = { ...e };
  for (const [o, a] of Object.entries(e)) {
    const s = a.kind === "stored" ? a[Rr] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(e) }));
  }
  return Object.freeze(Object.defineProperty(i, ei, { value: Object.freeze({ ...t }) }));
}
function K(e) {
  throw new Error(e);
}
function ft(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function En(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function oi(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Rn(e, t) {
  return typeof t == "string" ? oi(t) : t instanceof ArrayBuffer ? new Uint8Array(t.slice(0)) : ArrayBuffer.isView(t) ? new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength)) : Array.isArray(t) ? Uint8Array.from(t) : K(`The host returned ${e} in a form this kit cannot read.`);
}
function xn(e, t) {
  const n = new DataView(t);
  (n.byteLength < 12 || ft(n, 0, 4) !== "RIFF" || ft(n, 8, 4) !== "WAVE") && K(`${e} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, c = 0;
  for (let l = 12; l + 8 <= n.byteLength; ) {
    const m = ft(n, l, 4), d = n.getUint32(l + 4, !0), f = l + 8;
    m === "fmt " ? (r = n.getUint16(f, !0), i = n.getUint16(f + 2, !0), o = n.getUint32(f + 4, !0), a = n.getUint16(f + 14, !0)) : m === "data" && (s = f, c = Math.min(d, n.byteLength - f)), l = f + d + d % 2;
  }
  (s < 0 || r === 0) && K(`${e} is missing its WAV format or data chunk.`), i !== 1 && K(`${e} has ${i} channels; readAudio reads mono WAV files only.`);
  const u = t.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(u, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const l = new Int16Array(u, 0, Math.floor(c / 2));
    return { sampleRate: o, samples: Float32Array.from(l, (m) => m / 32768) };
  }
  return K(`${e} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function ii(e, t) {
  const n = t ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && K(`The host decoded ${e} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : K(`${e} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function On() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0) return new URL("/", e);
  const t = new URL(import.meta.url);
  return t.pathname = t.pathname.replace(/\/[^/]*$/, "/"), t;
}
function Mn(e, t) {
  return t instanceof URL ? t : typeof t == "string" && t.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t) ? new URL(t) : new URL(t.replace(/^\//, ""), On()) : new URL(e, On());
}
function ai(e) {
  const t = e ?? {}, n = async (i) => {
    typeof fetch != "function" && K(`Cannot read ${i}: this host has neither a resource bridge nor fetch.`);
    const o = Mn(i, t.getResourceAddress?.(i)), a = await fetch(o.toString());
    return a.ok || K(`Could not read ${i} from ${o} (HTTP ${a.status}).`), a.arrayBuffer();
  }, r = async (i) => t.readResource ? Rn(i, await t.readResource(i)) : new Uint8Array(await n(i));
  return {
    async readText(i) {
      if (!t.readResource) return En(new Uint8Array(await n(i)));
      const o = await t.readResource(i);
      return typeof o == "string" ? o : typeof o == "object" && o !== null && "text" in o && typeof o.text == "function" ? String(await o.text()) : En(Rn(i, o));
    },
    async readJSON(i) {
      return JSON.parse(await this.readText(i));
    },
    readBytes: r,
    async readAudio(i) {
      const o = t.getResourceAddress?.(i);
      return o != null && typeof fetch == "function" ? xn(i, await n(i)) : t.readResourceAsAudioData ? ii(i, await t.readResourceAsAudioData(i)) : xn(i, new Uint8Array(await r(i)).buffer);
    },
    getURL(i) {
      return Mn(i, t.getResourceAddress?.(i));
    }
  };
}
const oe = -100, ke = 35, Xt = 5, Yt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function xr(e) {
  const t = Yt.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function U(e) {
  return xr(e).laneEndpointID;
}
function Zt(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > Xt)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${xr(e).hostStem}${t}OutputTrimDb`;
}
function en() {
  return Yt.flatMap((e) => Array.from(
    { length: Xt },
    (t, n) => Zt(e.deviceType, n + 1)
  ));
}
function si(e) {
  if (typeof e != "string")
    return null;
  for (const t of Yt)
    for (let n = 1; n <= Xt; n += 1)
      if (e === Zt(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function Or(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function ci(e) {
  const t = (Or(e, oe, ke) - oe) / (ke - oe);
  return t * t;
}
function li(e) {
  const t = Math.sqrt(Or(e, 0, 1));
  return oe + t * (ke - oe);
}
const Mr = 13, tn = 5, kr = 8, ui = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), nn = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    U("globalFilter")
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
    U("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    U("ott")
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
    U("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    U("flanger")
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
    U("phaser")
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
    U("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    U("reverb")
  ]
}), wr = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), di = Object.freeze([
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
]), fi = Object.freeze({
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
function mi(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function Dr(e, t) {
  const n = {};
  for (const s of nn[e]) {
    const c = t[s];
    if (typeof c == "number" && Number.isFinite(c)) {
      n[s] = c;
      continue;
    }
    const u = fi[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${s}`);
    n[s] = u;
  }
  const i = [
    ...wr.chorus,
    U("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((s) => i.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = mi(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function rn(e) {
  return nn[e];
}
function hi(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= tn)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * kr + ui[e];
}
function pi(e, t) {
  const n = new Array(Mr).fill(0), r = Dr(e, t);
  return nn[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const P = (e, t) => ({ label: e, value: t });
function j(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const V = Object.freeze({
  filter: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), b = (e, t, n, r, i, o, a, s = {}) => ({
  id: `${e}.${t}`,
  effectId: e,
  endpointID: t,
  label: n,
  shortLabel: r,
  min: i,
  max: o,
  initial: a,
  step: s.step ?? (o - i) / 1e3,
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
function H(e, t, n) {
  return b(
    e,
    t,
    "Output Trim",
    "Trim",
    oe,
    ke,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const gi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], yi = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], bi = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: V.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      b("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(P), quick: !0 }),
      b("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      b("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      b("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      H("filter", "globalFilterOutputTrimDb", 39)
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
      b("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [P("Classic", 0), P("Harmonics", 1)] }),
      b("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      b("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      b("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      b("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      b("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      b("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [P("Symmetric", 0), P("Asymmetric", 1), P("Wavefold", 2)] }),
      H("drive", "distortionOutputTrimDb", 40)
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
      b("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      b("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      b("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      b("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      b("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      H("ott", "ottOutputTrimDb", 41)
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
      b("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(P) }),
      b("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(P) }),
      b("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      b("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      b("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      b("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      b("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      H("chorus", "chorusOutputTrimDb", 42)
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
      b("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      b("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      b("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      b("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      b("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      H("flanger", "flangerOutputTrimDb", 43)
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
      b("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [P("Free", 0), P("Sync", 1)] }),
      b("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      b("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: gi.map(P) }),
      b("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      b("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      b("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      b("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      b("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      H("phaser", "phaserOutputTrimDb", 44)
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
      b("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [P("Free", 0), P("Sync", 1)] }),
      b("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      b("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: yi.map(P) }),
      b("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      b("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      b("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      H("delay", "delayOutputTrimDb", 45)
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
      b("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      b("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      b("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      b("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      H("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], lt = bi, _r = Object.freeze(
  lt.flatMap((e) => e.parameters)
);
new Map(
  _r.map((e) => [e.endpointID, e])
);
function Cr(e) {
  const t = lt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Nr() {
  return _r;
}
function on(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const we = "lane.v1", Ye = "laneTopology", De = "laneSlotParams", Lt = "laneSlotParamValue", Lr = "laneOutputControl", Pt = 16, vi = 8, Pr = 4, Ii = 3, Fr = tn * kr, Ur = 4, Si = 4, Ti = Fr, Ai = Fr + Ur, Ei = 0, Ri = 1, xi = 2, Oi = 3, Mi = 4, ki = 5;
function wi(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > Pr)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << vi;
}
const Ze = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), et = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Br = new Map(
  Object.entries(et).map(([e, t]) => [t, e])
), Di = Object.freeze({
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
  Ze.map((e) => [Di[e], e])
);
const Ft = "runtimeState";
function $r(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Ie = (e) => ({ kind: "ok", value: e }), _e = (e) => ({ kind: "error", message: e }), se = (e) => typeof e == "object" && e !== null && !Array.isArray(e);
function tt(e) {
  if (e === null || typeof e == "boolean" || typeof e == "string") return e;
  if (typeof e == "number") return Number.isFinite(e) ? e : void 0;
  if (Array.isArray(e)) {
    const r = [];
    for (const i of e) {
      const o = tt(i);
      if (o === void 0) return;
      r.push(o);
    }
    return Object.freeze(r);
  }
  if (!se(e)) return;
  const t = Object.getPrototypeOf(e);
  if (t !== Object.prototype && t !== null) return;
  const n = {};
  for (const [r, i] of Object.entries(e)) {
    const o = tt(i);
    if (o === void 0) return;
    n[r] = o;
  }
  return Object.freeze(n);
}
function Ce(e, t) {
  if (Object.is(e, t)) return !0;
  if (Array.isArray(e) || Array.isArray(t))
    return Array.isArray(e) && Array.isArray(t) && e.length === t.length && e.every((o, a) => Ce(o, t[a]));
  if (!se(e) || !se(t)) return !1;
  const n = e, r = t, i = Object.keys(n);
  return i.length === Object.keys(r).length && i.every((o) => Object.hasOwn(r, o) && Ce(n[o], r[o]));
}
function _i(e) {
  const t = se(e) ? tt(e) : void 0;
  return t !== void 0 && se(t) ? Ie(t) : _e("Preset values must be an object of JSON values.");
}
function Kr(e) {
  if (!se(e) || typeof e.id != "string" || e.id.length === 0 || typeof e.name != "string" || e.name.trim().length === 0)
    return _e("A preset needs a non-empty id and name.");
  const t = _i(e.values);
  return t.kind === "ok" ? Ie(Object.freeze({ id: e.id, name: e.name, values: t.value })) : t;
}
const Ci = {
  parse(e) {
    if (!se(e) || e.version !== 1 || !Array.isArray(e.presets)) return _e("Expected a version 1 preset library.");
    const t = [];
    for (const n of e.presets) {
      const r = Kr(n);
      if (r.kind === "error") return r;
      if (t.some((i) => i.id === r.value.id)) return _e(`Preset id "${r.value.id}" appears twice.`);
      t.push(r.value);
    }
    return Ie(Object.freeze({ version: 1, presets: Object.freeze(t) }));
  },
  encode: (e) => e,
  equals: (e, t) => Ce(e, t)
}, kn = {
  parse: (e) => e === null ? Ie(null) : Kr(e),
  encode: (e) => e,
  equals: (e, t) => Ce(e, t)
};
function zr(e, t) {
  if (e.kind === "parameter")
    return typeof t == "number" && Number.isFinite(t) ? Ie(t) : _e("Expected a finite number.");
  const n = e.codec.parse(t);
  return n.kind === "ok" ? Ie(e.codec.encode(n.value)) : n;
}
function Ni(e, t, n) {
  if (t !== void 0 && !e.some((o) => o.id === t))
    throw new Error(`The initial preset "${t}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = ni(n), i = /* @__PURE__ */ new Set();
  for (const o of e) {
    if (typeof o.id != "string" || o.id.length === 0 || typeof o.name != "string" || o.name.trim().length === 0)
      throw new Error("Every factory preset needs a non-empty id and name.");
    if (i.has(o.id)) throw new Error(`Factory preset id "${o.id}" is used twice. Give each factory preset its own id.`);
    i.add(o.id);
    for (const a of Object.keys(o.values))
      if (!r.includes(a))
        throw new Error(`Factory preset "${o.name}" sets "${a}", which is not a sound field. Remove it or correct the field name.`);
    for (const a of r) {
      const s = n[a];
      if (!s) continue;
      if (!Object.hasOwn(o.values, a))
        throw new Error(`Factory preset "${o.name}" is missing "${a}". Give it a value, or declare the field with preset: false.`);
      const c = zr(s, o.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function Li(e = {}) {
  const t = Object.freeze((e.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = e, r = Object.freeze({
    ...ae({ codec: Ci, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: t,
    [Er]: (a) => Ni(t, n, a)
  }), i = ae({ codec: kn, initial: null, preset: !1 }), o = t.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [Rr]: (a) => kn.parse({ id: o.id, name: o.name, values: Pi(a, o) })
    })
  };
}
const wn = /* @__PURE__ */ new WeakMap();
function Pi(e, t) {
  let n = wn.get(t);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(t.values)) {
      const a = e[i], s = a && zr(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), wn.set(t, n);
  }
  return n;
}
const Fi = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function Ui(e) {
  return {
    // Slots a plugin update removed are dropped and new slots start empty, so older projects still load.
    parse(t) {
      if (typeof t != "object" || t === null || Array.isArray(t)) return { kind: "error", message: "Expected snapshot slots." };
      const n = {};
      for (const r of e) {
        const i = Object.hasOwn(t, r) ? Reflect.get(t, r) : void 0;
        if (i == null) {
          n[r] = null;
          continue;
        }
        const o = typeof i == "object" ? tt(Reflect.get(i, "values")) : void 0;
        if (typeof o != "object" || o === null || Array.isArray(o)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: o });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (t) => t,
    equals: (t, n) => Ce(t, n)
  };
}
function Bi(e) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (t) => t === null || typeof t == "string" ? { kind: "ok", value: typeof t == "string" && e.includes(t) ? t : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (t) => t,
    equals: Object.is
  };
}
function $i(e = {}) {
  const t = Object.freeze([...e.slots ?? Fi]);
  if (t.length === 0 || t.some((r) => typeof r != "string" || r.length === 0) || new Set(t).size !== t.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(t.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...ae({ codec: Ui(t), initial: n, history: !1, preset: !1 }), slots: t }),
    activeSnapshot: ae({ codec: Bi(t), initial: null, preset: !1 })
  };
}
const ee = 2048, Ne = ee + 3, Dn = 20, jr = "MSEG 1";
function Vr(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function Hr(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Le(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Ki(e) {
  return Hr(Number.isFinite(e) ? e : 0, -Dn, Dn);
}
function ce(e) {
  return Hr(Number.isFinite(e) ? e : 0, 0, 1);
}
function Wr(e = jr) {
  return {
    format: "mseg.shape",
    version: 1,
    name: e,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function zi(e, t, n) {
  const r = Vr(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = ce(i)), {
    x: i,
    y: ce(Number(r.y)),
    curvePower: Ki(Number(r.curvePower))
  };
}
function an(e = Wr()) {
  const t = Vr(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => zi(i, o, n.length));
  if (!Le(r[0].x, 0) || !Le(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : jr,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function ji(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function Vi(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Le(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && Le(e[o + 1].x, t); )
        o += 1;
      return {
        from: e[o],
        to: e[o],
        laterPointWins: !0
      };
    }
  }
  return {
    from: e[e.length - 1],
    to: e[e.length - 1],
    laterPointWins: !1
  };
}
function Hi(e, t) {
  const n = ce(Number(t)), r = Vi(e, n);
  if (r.laterPointWins || Le(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = ce(ji(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Wi(e, t) {
  return Hi(an(e).points, t);
}
function qi(e) {
  const t = new Float32Array(Ne);
  return qr(e, t), t;
}
function qr(e, t) {
  if (t.length !== Ne) throw new Error("Invalid MSEG destination length.");
  const n = an(e);
  for (let r = 0; r < ee; r += 1) {
    const i = r / (ee - 1);
    t[r + 1] = Wi(n, i);
  }
  t[0] = t[1], t[ee + 1] = t[ee], t[ee + 2] = t[ee];
}
const A = ["A", "B", "C"], sn = [
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
], Gi = [
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
], ue = Object.freeze([
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
]), Ji = Object.freeze([
  ...A.flatMap((e) => sn.map(
    (t) => `osc${e}.${t}`
  )),
  ...Gi
]);
new Set(
  A.flatMap((e) => sn.map(
    (t) => `osc${e}.${t}`
  ))
);
const Gr = Object.freeze(
  Ji.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), Qi = Nr().filter(
  (e) => e.modulationTargetIndex !== null
), Xi = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function cn(e) {
  const t = Yi(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function Yi(e) {
  const t = Xi.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const Zi = [
  ...Qi.map((e) => ({
    kind: cn(on(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Jr = Object.freeze(
  Zi.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), J = Object.freeze([
  ...Gr,
  ...Jr
]), Ge = ue.length, Qr = Gr.length, ut = Jr.length, ea = Ge * J.length, ta = new Map(ue.map((e) => [e.id, e])), Xr = new Map(ue.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), Se = new Map(J.map((e) => [e.kind, e]));
function na() {
  if (Ge !== 14 || Qr !== 59 || ut !== 47 || ea !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = ue.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = J.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (ta.size !== Ge || Xr.size !== Ge || Se.size !== J.length)
    throw new Error("Modulation identities must be unique");
}
na();
function Yr(e, t) {
  const n = Xr.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function ln(e) {
  return typeof e != "string" ? null : Se.has(e) ? e : null;
}
function ra(e) {
  const t = ln(e);
  return t !== null && Se.get(t)?.group === "voice" ? t : null;
}
function un(e) {
  const t = ln(e);
  return t !== null && Se.get(t)?.group === "rack" ? t : null;
}
function Zr(e) {
  const t = Se.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function eo(e) {
  const t = Se.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function oa(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const to = 4, ia = to * ut, aa = /* @__PURE__ */ new Map([
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
function de(e) {
  if (typeof e != "string")
    return null;
  const t = sa.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = aa.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function dn(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function no(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function ro(e) {
  if (e === null)
    return null;
  const t = no(e) - 1;
  return t > to ? null : t * ut + eo(dn(e));
}
const ca = 0, te = 2;
function Ut(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function la(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function ua(...e) {
  return { ...Wr(...e), format: "cosimo.mseg.shape" };
}
function Bt(...e) {
  return { ...an(...e), format: "cosimo.mseg.shape" };
}
function _n(e) {
  return JSON.stringify(Bt(e));
}
function Cn(e, t) {
  return _n(e) === _n(t);
}
function da(e) {
  const t = Number(e);
  return la(
    Number.isFinite(t) ? t : 1,
    ca,
    te
  );
}
function $t() {
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
function fa(e) {
  if (!e || typeof e != "object")
    return null;
  const t = Ut(e), n = ce(Number(t.startX)), r = ce(Number(t.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function ma(e = $t()) {
  const t = Ut(e), n = Ut(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: da(Number.isFinite(r) ? r : 1)
    },
    loop: fa(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
const mt = "modulationProgram", ha = "modulationAmount", oo = ue.filter((e) => e.group === "voice").length, io = ue.filter((e) => e.group === "macro").length, nt = Qr, pa = ut, rt = pa + ia, ne = oo * nt, he = io * nt, ga = oo * rt, ya = io * rt, Z = 512, fe = 256, ao = ne + he;
function ba(e) {
  const t = Yr(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function va(e) {
  const t = ra(e);
  return t === null ? null : Zr(t);
}
function so(e) {
  const t = va(e.targetKind), n = un(e.targetKind);
  let r = n === null ? void 0 : eo(n);
  if (r === void 0) {
    const a = ro(
      de(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Yr(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (t !== null) {
      const u = s * nt + t;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: s,
        targetIndex: t,
        articulationCellIndex: ne + u
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * rt + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const i = ba(e);
  if (t !== null) {
    const a = i * nt + t;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: i,
      targetIndex: t,
      articulationCellIndex: a
    };
  }
  const o = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: i * rt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function co(e) {
  return de(e.targetKind) !== null ? null : so(e).articulationCellIndex;
}
function Ia(e) {
  if (un(e.targetKind) !== null)
    return !1;
  const t = de(e.targetKind);
  return t !== null && ro(t) === null;
}
function Sa(e) {
  return {
    ...so(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function lo(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Ia(n))
      continue;
    const r = Sa(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Ta(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function pe(e) {
  return [...e.values()].filter(Ta).sort((t, n) => t.cellIndex - n.cellIndex);
}
function Ke(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function ht(e) {
  const t = lo(e), n = pe(t.voice), r = pe(t.macroVoice), i = pe(t.voiceRack), o = pe(t.macroRack), a = Array.from({ length: ne }, () => 0), s = Array.from({ length: ne }, () => 0), c = Array.from({ length: ne }, () => 0), u = Array.from({ length: ne }, () => 0), l = Array.from({ length: ne }, () => 0);
  Ke(n, a, s, c, u);
  const m = Array.from({ length: he }, () => 0), d = Array.from({ length: he }, () => 0), f = Array.from({ length: he }, () => 0), p = Array.from({ length: he }, () => 0), v = Array.from({ length: he }, () => 0);
  if (Ke(
    r,
    m,
    d,
    f,
    p
  ), i.length > Z || o.length > fe)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${Z}), ${o.length} macro-rack (max ${fe})`
    );
  const g = Array.from({ length: Z }, () => 0), S = Array.from({ length: Z }, () => 0), x = Array.from({ length: Z }, () => 0), h = Array.from({ length: Z }, () => 0), I = Array.from({ length: Z }, () => 0), E = Array.from({ length: ga }, () => 0);
  Ke(
    i,
    g,
    S,
    x,
    h
  );
  const C = Array.from({ length: fe }, () => 0), Q = Array.from({ length: fe }, () => 0), X = Array.from({ length: fe }, () => 0), Y = Array.from({ length: fe }, () => 0), Ae = Array.from({ length: ya }, () => 0);
  Ke(
    o,
    C,
    Q,
    X,
    Y
  );
  for (const N of t.voice.values()) l[N.cellIndex] = N.amount;
  for (const N of t.macroVoice.values()) v[N.cellIndex] = N.amount;
  for (const N of t.voiceRack.values()) E[N.cellIndex] = N.amount;
  for (const N of t.macroRack.values()) Ae[N.cellIndex] = N.amount;
  for (let N = 0; N < i.length; N += 1) {
    const Sn = i[N];
    if (Sn === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    I[N] = Sn.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: u,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: d,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: v,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: g,
    voiceRackRouteSources: S,
    voiceRackRouteTargets: x,
    voiceRackRoutePolarities: h,
    voiceRackRouteReducers: I,
    voiceRackRouteAmounts: E,
    macroRackRouteCount: o.length,
    macroRackRouteCells: C,
    macroRackRouteSources: Q,
    macroRackRouteTargets: X,
    macroRackRoutePolarities: Y,
    macroRackRouteAmounts: Ae
  };
}
const Aa = ["voice", "macroVoice", "voiceRack", "macroRack"], Ea = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Nn(e) {
  return lo(e);
}
function Ra(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function xa(e, t) {
  if (e === null)
    return [{ endpointID: mt, value: ht(t) }];
  const n = Nn(e), r = Nn(t), i = [];
  for (const o of Aa) {
    const a = pe(n[o]), s = pe(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: mt, value: ht(t) }];
    for (let c = 0; c < s.length; c += 1) {
      const u = a[c], l = s[c];
      if (u === void 0 || l === void 0 || !Ra(u, l))
        return [{ endpointID: mt, value: ht(t) }];
      u.amount !== l.amount && i.push({
        endpointID: ha,
        value: {
          pathKind: Ea[o],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return i;
}
function Te(e) {
  return { _tag: "ok", value: e };
}
function Oe(e) {
  return { _tag: "err", error: e };
}
function Oa(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Ma(e) {
  throw new Error(e ?? "Invariant violated");
}
const ka = "globalTune", wa = "globalTuneSemitones", W = -24, Ee = 24, Ln = 0, uo = -48, fo = 48, Kt = -48, mo = 6, fn = 0, Pn = (fn - Kt) / (mo - Kt), Me = Object.freeze({
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
}), me = 241;
function Da(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function pt(e) {
  return Me.minimumHz * Math.pow(
    Me.maximumHz / Me.minimumHz,
    Da(e, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: me }, (e, t) => {
    const n = t / (me - 1), r = pt(n), i = pt(
      Math.max(0, t - 0.5) / (me - 1)
    ), o = pt(
      Math.min(me - 1, t + 0.5) / (me - 1)
    );
    return {
      centerHz: r,
      lowHz: t === 0 ? Me.minimumHz : i,
      highHz: t === me - 1 ? Me.maximumHz : o
    };
  })
);
const _a = "voiceEnhancerFrequency", Ca = "voiceEnhancerQ", Na = "voiceEnhancerAmount", La = "voiceEnhancerFrequencyOctaves", Pa = "voiceEnhancerQ", Fa = "voiceEnhancerAmount", ho = "voice.enhancerFrequency", Ua = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: _a,
    targetKind: La,
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
    endpointID: Ca,
    targetKind: Pa,
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
    endpointID: Na,
    targetKind: Fa,
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
function Fn(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Ba(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function ze(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const $a = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      ze("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      ze("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      ze("mix", "Mix", 100, 100),
      ze("drive", "Drive", 15, 0)
    ]
  }
], Un = 1e-6;
function $(e, t) {
  if (!Number.isFinite(e) || e < -Un || e > 1 + Un)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function ot(e, t) {
  return $(e / 100, `${t} catalog percentage`);
}
function Fe(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function Ka(e) {
  return 20 * 1e3 ** e;
}
function za(e) {
  return $(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ja(e) {
  return 0.1 * 200 ** e;
}
function Va(e) {
  return $(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ha(e) {
  return e;
}
function Wa(e) {
  return $(e, "filterMix endpoint conversion");
}
function be(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function qa(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: be("filterCutoff", Ka, za),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: be("filterQ", ja, Va),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: be("filterMix", Ha, Wa),
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
function po(e) {
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
      return Oa(e);
  }
}
function Ga(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ja(e, t) {
  const n = Fe(e.moduleId, t.id), r = po(t.format), i = qa(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: ot(t.defaultPercent, n),
    initialValue: ot(t.initialPercent, n),
    format: r,
    modAmount: Ga(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Qa = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Pn * 100, defaultPercent: Pn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Xa(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ya(e, t) {
  const n = `osc${e}`, r = Fe(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: ot(t.defaultPercent, r),
    initialValue: ot(t.initialPercent, r),
    format: po(t.format),
    modAmount: Xa(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const Za = Object.freeze(
  A.flatMap((e) => Qa.map((t) => Ya(e, t)))
), es = Object.freeze({
  targetId: Fe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: $(
    (Ln - W) / (Ee - W),
    "Global Tune default"
  ),
  initialValue: $(
    (Ln - W) / (Ee - W),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Ee },
  modAmount: {
    min: uo,
    max: fo,
    unit: "st",
    digits: 2
  },
  binding: be(
    ka,
    (e) => W + (Ee - W) * e,
    (e) => $(
      (e - W) / (Ee - W),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: wa
});
function ts(e) {
  const t = Fe("voice-enhancer", e.key), n = $(
    Fn(e, e.initial),
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
    binding: be(
      e.endpointID,
      (r) => Ba(e, r),
      (r) => $(
        Fn(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const ns = Object.freeze(
  Object.values(Ua).map(ts)
), rs = Object.freeze([
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
function os(e) {
  const t = Fe(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => $(
    (o - e.min) / n,
    `${e.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: t,
    moduleId: e.moduleId,
    workspace: "voice",
    label: e.label,
    defaultValue: i(e.initial),
    initialValue: i(e.initial),
    format: e.format === "time" ? { kind: "time", minSeconds: e.min, maxSeconds: e.max } : { kind: "percent" },
    modAmount: e.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: be(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const is = Object.freeze(
  rs.map(os)
), as = Object.freeze([
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
function ss(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function gt(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? ci(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return $(n, `${e.endpointID} endpoint conversion`);
}
function cs(e, t) {
  return e.valueKind === "effect-output-trim-db" ? li(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function ls(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function us(e) {
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
function ds(e) {
  const t = ss(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: gt(e, e.initial),
    initialValue: gt(e, e.initial),
    format: ls(e),
    modAmount: us(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => cs(e, n),
      fromEngine: (n) => gt(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : cn(on(e))
  });
}
const mn = Object.freeze(
  [
    ...lt.flatMap((e) => e.parameters.map(ds)),
    ...as,
    es,
    ...ns,
    ...Za,
    ...is,
    ...$a.flatMap(
      (e) => e.parameters.map(
        (t) => Ja(e, t)
      )
    )
  ]
), fs = new Map(
  mn.map((e) => [e.targetId, e])
), go = mn.filter(
  (e) => e.modulationTargetKind !== null
), zt = new Map(
  go.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (fs.size !== mn.length)
  throw new Error("Target descriptor IDs must be unique");
if (go.length !== J.length || zt.size !== J.length || J.some((e) => zt.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function yt(e) {
  const t = zt.get(e);
  return t === void 0 ? Ma(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  lt.map((e) => [e.id, e.label])
);
function ms(e) {
  const t = no(e);
  return t === 1 ? "" : ` ${t}`;
}
function hs(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = yt(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = de(e);
  if (n !== null) {
    const r = yt(dn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${ms(n)} ${r.label.toUpperCase()}`;
  }
  return yt(e).label.toUpperCase();
}
const re = "modulation.v6", yo = 6, Ue = 3, ge = 3, ps = 4, Bn = "modulationMsegBuffer", gs = "modulationMsegPlayback", bo = 4, ys = ["MSEG 1", "MSEG 2", "MSEG 3"], vo = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], bs = ["Env 1", "Env 2", "Env 3"], vs = 1e-3, O = 10, Is = 0.1, Ss = 20, $n = 10 - 0.1, Ts = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Ss - Is },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: uo,
    max: fo
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
  mseg1Rate: { min: -te, max: te },
  mseg2Rate: { min: -te, max: te },
  mseg3Rate: { min: -te, max: te },
  env1Attack: { min: -O, max: O },
  env1Decay: { min: -O, max: O },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -O, max: O },
  env2Attack: { min: -O, max: O },
  env2Decay: { min: -O, max: O },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -O, max: O },
  env3Attack: { min: -O, max: O },
  env3Decay: { min: -O, max: O },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -O, max: O },
  ampAttack: { min: -O, max: O },
  ampDecay: { min: -O, max: O },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -O, max: O },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -$n, max: $n },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, As = Nr().filter((e) => e.modulationTargetIndex !== null), Es = new Map(
  As.map((e) => [
    cn(on(e)),
    e
  ])
);
class bt extends Error {
  name = "ModulationStateParseError";
}
const Rs = {
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
ue.map((e) => ({
  value: e.id,
  label: Rs[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const xs = J.map((e) => ({
  value: e.kind,
  label: hs(e.kind)
}));
xs.filter((e) => !Ms(e.value));
function Os(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function hn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function vt(e, t) {
  const n = Number(e);
  return hn(Number.isFinite(n) ? n : t, vs, O);
}
function Ms(e) {
  return un(e) !== null;
}
function ks(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function ws(e) {
  const t = de(e);
  return t !== null ? dn(t) : e;
}
function Ds(e) {
  const t = ws(e);
  if (de(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Es.get(t);
  return n !== void 0 ? ks(n) : Ts[oa(t)];
}
function _s(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Cs(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function Ns(e, t) {
  const n = Ds(e), r = Number(t);
  return hn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Ls(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Ps(e) {
  return Ls(e) ?? "mseg";
}
function Fs(e) {
  const t = ln(e);
  return t !== null ? t : de(e) !== null ? e : null;
}
function Us(e) {
  return Fs(e) ?? "oscA.wavetablePosition";
}
function Bs(e, t) {
  const n = vo[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function $s(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Ue : e === "macro" ? bo : ps;
  return hn(Number.isFinite(n) ? n : 1, 1, r);
}
function ye(e) {
  return {
    name: bs[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Io(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = ye(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: vt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: vt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: ce(n.sustain ?? r.sustain),
    releaseSeconds: vt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Ks(e, t = 0) {
  return { name: Io(e, t).name };
}
function zs(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: _s(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: $s(n, e.sourceSlot),
    polarity: Cs(e.polarity),
    targetKind: r,
    amount: Ns(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function js(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Ps(r.sourceKind), o = Us(r.targetKind);
  return zs(r, t, i, o);
}
function Vs(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function Hs(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => js(n, r));
}
function Ws(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = Vs(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function jt(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, s) => jt(a, t[s]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Os(r, a) && jt(n[a], r[a]));
}
function So(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = ua(ys[t] ?? `MSEG ${t + 1}`), i = Bt(n.shapeA ?? r), o = ma({
    ...$t(),
    ...n.playback ?? {},
    rate: $t().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: Bt(n.shapeB ?? i),
    playback: s
  };
}
function Pe() {
  return {
    format: "cosimo.modulation",
    version: yo,
    msegSlots: Array.from({ length: Ue }, (e, t) => So({}, t)),
    envelopeSlots: Array.from({ length: ge }, (e, t) => ({
      name: ye(t).name
    })),
    routes: [],
    macroNames: vo.slice()
  };
}
function qs(e = Pe()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: yo,
    msegSlots: Array.from({ length: Ue }, (o, a) => So(n[a], a)),
    envelopeSlots: Array.from({ length: ge }, (o, a) => Ks(r[a], a)),
    routes: Hs(t.routes),
    macroNames: Array.from(
      { length: bo },
      (o, a) => Bs(i[a], a)
    )
  };
}
function It(e) {
  const t = it(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function it(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Oe(new bt("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Oe(new bt("Expected valid modulation JSON"));
    }
  }
  const n = qs(t);
  return !jt(t, n) || !Ws(n.routes) ? Oe(new bt("Expected the current modulation schema")) : Te(n);
}
function Gs(e, t) {
  return {
    slot: e + 1,
    holdFinalValue: t.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!t.loop,
    loopStart: t.loop?.startX ?? 0,
    loopEnd: t.loop?.endX ?? 1,
    noteOffPolicy: t.noteOffPolicy === "immediate" ? 1 : t.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!t.legatoRestarts
  };
}
function Kn(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(qi(n))
  };
}
function Js(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function zn(e, t = null, n) {
  const r = [];
  for (let i = 0; i < Ue; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !Cn(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: Bn,
      value: Kn(i, 0, o.shapeA)
    }), (a === void 0 || !Cn(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: Bn,
      value: Kn(i, 1, o.shapeB)
    }), (a === void 0 || !Js(a.playback, o.playback)) && r.push({
      endpointID: gs,
      value: Gs(i, o.playback)
    });
  }
  return r.push(...xa(t?.routes ?? null, e.routes)), r;
}
function To(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) To(t);
    Object.freeze(e);
  }
}
const Qs = {
  parse(e) {
    const t = it(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (To(t.value), { kind: "ok", value: t.value });
  },
  encode: It,
  equals: (e, t) => It(e) === It(t)
}, Xs = [
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
], Ys = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function Zs(e) {
  switch (e) {
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
      return e;
  }
}
function ec(e, t, n) {
  const r = n.articulationParameterID === null ? null : `osc${e}.${n.articulationParameterID}`;
  return Object.freeze({
    controlID: n.controlID,
    // SAFETY: both interpolated pieces come from closed unions above, so
    // their concatenation is exactly one OscillatorControlEndpointID.
    endpointID: `osc${e}${n.endpointSuffix}`,
    oscillatorIndex: t,
    articulationParameterID: r
  });
}
function tc(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${Zs(n)}`,
    runtimeTargetIndex: Zr(r),
    oscillatorIndex: t
  });
}
function nc(e, t) {
  const n = Object.freeze(Xs.map(
    (o) => ec(e, t, o)
  )), r = Object.freeze(sn.map(
    (o) => tc(e, t, o)
  )), i = Object.freeze(n.flatMap(
    (o) => o.articulationParameterID === null ? [] : [o.articulationParameterID]
  ));
  return Object.freeze({
    id: e,
    oscillatorIndex: t,
    tableStatus: Object.freeze({ endpointID: "runtimeState", oscillatorIndex: t }),
    controls: n,
    modulationTargets: r,
    articulationParameterIDs: i
  });
}
const Je = Object.freeze(
  Ys.map(({ id: e, oscillatorIndex: t }) => nc(e, t))
);
function rc() {
  if (Je.length !== A.length || Je.some((t, n) => t.id !== A[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = Je.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
rc();
const St = "articulationSnapshot", M = 128, jn = 48, oc = 1e6, _ = -1, Tt = [
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
function pn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function At(e) {
  return pn(Number.isFinite(e) ? e : 0, 0, 1);
}
function L(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return pn(Number.isFinite(i) ? i : t, n, r);
}
function D(e, t, n, r) {
  return pn(Math.round(L(e, t)), n, r);
}
function Ao(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function Et() {
  return Array.from({ length: M }, () => _);
}
function ic(e) {
  const t = D(e, 0, 0, M - 1), n = Tt[t % Tt.length], r = Math.floor(t / Tt.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function ac() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: fn,
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
function sc(e) {
  const t = ac(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: L(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: L(n.pan, t.pan, -1, 1),
    octave: D(n.octave, t.octave, -4, 4),
    semitone: D(n.semitone, t.semitone, -12, 12),
    fineCents: L(n.fineCents, t.fineCents, -100, 100),
    volumeDb: L(
      n.volumeDb,
      t.volumeDb,
      Kt,
      mo
    ),
    mute: D(n.mute, t.mute, 0, 1),
    solo: D(n.solo, t.solo, 0, 1),
    warpMode: D(n.warpMode, t.warpMode, 0, 4),
    warpAmount: L(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: D(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: L(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: L(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: L(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: D(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: L(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: L(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: L(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: L(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: L(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: D(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: D(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: D(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: L(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: L(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      At(Number(r[0])),
      At(Number(r[1])),
      At(Number(r[2]))
    ]
  };
}
function cc(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: L(t.amount, 0, -48, 48)
  } : null;
}
function lc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(cc).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: sc(t.parameters),
    envelopes: [0, 1, 2].map((i) => Io(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function uc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = D(n.runtimeSlot, t, 0, M - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : ic(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: lc(n.snapshot)
  };
}
function dc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: D(n.note, 0, 0, M - 1),
    articulationId: r
  } : null;
}
function fc(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let s = D(o.min, i, i, M - 1), c = D(o.max, s, i, M - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function Vn(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = fc(
      i[s],
      t,
      s,
      n,
      r
    );
    !c || o.has(c.id) || (o.add(c.id), a.push(c));
  }
  return a;
}
function mc(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = dc(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function hc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < M; c += 1) {
    const u = uc(n[c], c);
    !u || r.has(u.runtimeSlot) || i.has(u.id) || (r.add(u.runtimeSlot), i.add(u.id), o.push(u));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((c) => c.id === t.selectedSlotId) ? t.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ao(t.activeTriggerMode),
    slots: o,
    chainAssignments: Vn(t.chainAssignments, s, "chain", 0),
    keyAssignments: mc(t.keyAssignments, s),
    velocityAssignments: Vn(t.velocityAssignments, s, "velocity", 1)
  };
}
function Hn(e) {
  const t = (n) => A.map(() => n);
  return {
    selectorA: e,
    enabled: !1,
    oscillatorOverrideMasks: t(0),
    sharedOverrideMask: 0,
    framePositions: t(0),
    pans: t(0),
    octaves: t(0),
    semitones: t(0),
    fineCents: t(0),
    phases: t(0),
    phaseRandoms: t(0),
    retriggers: t(1),
    volumeDbs: t(fn),
    mutes: t(0),
    solos: t(0),
    warpModes: t(0),
    warpAmounts: t(0),
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterKeyTrackOffsetSemitones: 0,
    filterQ: 0.707107,
    unisonVoices: t(1),
    unisonDetunes: t(0.1),
    unisonBlends: t(0.75),
    unisonWidths: t(1),
    unisonDetuneModes: t(0),
    unisonStackModes: t(0),
    unisonWavetablePositionSpreads: t(0),
    unisonWarpSpreads: t(0),
    msegMorphs: Array.from({ length: Ue }, () => 0),
    routeAmounts: Array.from({ length: ao }, () => 0),
    envelopeAttackSeconds: Array.from({ length: ge }, (n, r) => ye(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: ge }, (n, r) => ye(r).decaySeconds),
    envelopeSustain: Array.from({ length: ge }, (n, r) => ye(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: ge }, (n, r) => ye(r).releaseSeconds)
  };
}
function Wn(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === _ && (e[o] = i);
  }
}
function pc(e) {
  const t = hc(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = Et(), i = Et(), o = Et();
  Wn(r, t.chainAssignments, n), Wn(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== _ || (i[a.note] = s);
  }
  return o[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Eo(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : pc(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ao(t.activeMode),
    chain: Array.from({ length: M }, (n, r) => D(t.chain?.[r], _, _, M - 1)),
    key: Array.from({ length: M }, (n, r) => D(t.key?.[r], _, _, M - 1)),
    velocity: Array.from({ length: M }, (n, r) => r === 0 ? _ : D(t.velocity?.[r], _, _, M - 1))
  });
}
function gc(e, t) {
  const n = Eo(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const F = "articulations.v4", gn = [
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
], yn = [
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
], Ro = [
  ...A.flatMap((e) => gn.map(
    (t) => `osc${e}.${t}`
  )),
  ...yn
];
class xo extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(t, n) {
    super(`articulations.v4 parse failed (${t}): ${n}`), this.reason = t, this.detail = n;
  }
  reason;
  detail;
  _tag = "ArticulationsParseError";
}
function T(e) {
  return Oe(new xo("malformed", e));
}
function Be(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function bn(e, t, n) {
  const r = new Set(t);
  for (const i of t)
    if (!Object.hasOwn(e, i))
      return `${n} is missing field "${i}"`;
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return `${n} has a non-string field key`;
    if (!r.has(i))
      return `${n} has unexpected field "${i}"`;
  }
  return null;
}
function at(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < M;
}
function yc(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function bc(e) {
  return Ro.some((t) => t === e);
}
function qn(e, t) {
  if (!Be(e))
    return T(`${t} must be an object`);
  const n = bn(e, ["min", "max"], t);
  return n !== null ? T(n) : at(e.min) ? at(e.max) ? e.min > e.max ? T(`${t}.min must be less than or equal to ${t}.max`) : Te({ min: e.min, max: e.max }) : T(`${t}.max must be an integer in 0..127`) : T(`${t}.min must be an integer in 0..127`);
}
function vc(e, t) {
  if (!Be(e))
    return T(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return T(`${t} has a non-string parameter id`);
    if (!bc(r))
      return T(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return T(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return Te(n);
}
function Oo(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Mo() {
  return {};
}
function Ic(e, t, n) {
  if (!Be(e))
    return T(`${t} must be an object`);
  const r = Mo();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return T(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > jn)
      return T(
        `${t}.${i} must be a finite route amount within ±${jn}`
      );
    if (!n.has(i))
      return T(`${t}.${i} does not name a current articulable mapping`);
    Oo(r, i, o);
  }
  return Te(r);
}
function Sc(e, t, n) {
  const r = `slots[${t}]`;
  if (!Be(e))
    return T(`${r} must be an object`);
  const i = bn(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return T(i);
  if (typeof e.id != "string")
    return T(`${r}.id must be a string`);
  if (!at(e.runtimeSlot))
    return T(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return T(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return T(`${r}.color must be a string`);
  if (!at(e.key))
    return T(`${r}.key must be an integer in 0..127`);
  const o = qn(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = qn(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = vc(e.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = Ic(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : Te({
    id: e.id,
    runtimeSlot: e.runtimeSlot,
    name: e.name,
    color: e.color,
    key: e.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: c.value
  });
}
function Tc(e) {
  const t = {};
  for (const n of Ro) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function Ac(e) {
  const t = Mo();
  for (const [n, r] of Object.entries(e))
    Oo(t, n, r);
  return t;
}
const Ec = Object.fromEntries(
  gn.map((e, t) => [e, 2 ** t])
), Rc = Object.fromEntries(
  yn.map((e, t) => [e, 2 ** t])
);
function Gn(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function xc(e, t) {
  return gn.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | Ec[r] : n, 0);
}
function Oc(e) {
  return yn.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | Rc[n] : t, 0);
}
function Mc(e, t) {
  const n = (o, a) => Gn(e, `osc${o}.${a}`), r = (o) => Gn(e, o), i = Array.from(
    { length: ao },
    () => oc
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const s = t[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: A.map((o) => xc(e, o)),
    sharedOverrideMask: Oc(e),
    framePositions: A.map((o) => n(o, "framePosition")),
    pans: A.map((o) => n(o, "pan")),
    octaves: A.map((o) => n(o, "octave")),
    semitones: A.map((o) => n(o, "semitone")),
    fineCents: A.map((o) => n(o, "fineCents")),
    phases: A.map((o) => n(o, "phase")),
    phaseRandoms: A.map((o) => n(o, "phaseRandom")),
    retriggers: A.map((o) => n(o, "retrigger")),
    volumeDbs: A.map((o) => n(o, "volumeDb")),
    mutes: A.map((o) => n(o, "mute")),
    solos: A.map((o) => n(o, "solo")),
    warpModes: A.map((o) => n(o, "warpMode")),
    warpAmounts: A.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: A.map((o) => n(o, "unisonVoices")),
    unisonDetunes: A.map((o) => n(o, "unisonDetune")),
    unisonBlends: A.map((o) => n(o, "unisonBlend")),
    unisonWidths: A.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: A.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: A.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: A.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: A.map((o) => n(o, "unisonWarpSpread")),
    msegMorphs: [
      r("msegMorph1"),
      r("msegMorph2"),
      r("msegMorph3")
    ],
    routeAmounts: i,
    envelopeAttackSeconds: [
      r("env1.attackSeconds"),
      r("env2.attackSeconds"),
      r("env3.attackSeconds")
    ],
    envelopeDecaySeconds: [
      r("env1.decaySeconds"),
      r("env2.decaySeconds"),
      r("env3.decaySeconds")
    ],
    envelopeSustain: [
      r("env1.sustain"),
      r("env2.sustain"),
      r("env3.sustain")
    ],
    envelopeReleaseSeconds: [
      r("env1.releaseSeconds"),
      r("env2.releaseSeconds"),
      r("env3.releaseSeconds")
    ]
  };
}
function kc(e, t) {
  return e.slots.map((n) => Mc(n, t));
}
function ko(e, t) {
  if (!Be(e))
    return T("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return T('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Oe(new xo(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = bn(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return T(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return T("selectedSlotId must be null or a string");
  if (!yc(e.activeTriggerMode))
    return T('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return T("slots must be an array");
  if (e.slots.length > M)
    return T(`slots must contain at most ${M} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const s = Sc(e.slots[a], a, t);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (i.has(c.id))
      return T(`slots[${a}].id duplicates "${c.id}"`);
    if (o.has(c.runtimeSlot))
      return T(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    i.add(c.id), o.add(c.runtimeSlot), r.push(c);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? T(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : Te({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function Jn(e) {
  return {
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: e.slots.map((t) => ({
      id: t.id,
      runtimeSlot: t.runtimeSlot,
      name: t.name,
      color: t.color,
      key: t.key,
      velRange: { min: t.velRange.min, max: t.velRange.max },
      chainRange: { min: t.chainRange.min, max: t.chainRange.max },
      overrides: Tc(t.overrides),
      routeAmounts: Ac(t.routeAmounts)
    }))
  };
}
function dt() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function wc(e) {
  const t = Array.from({ length: M }, () => _), n = Array.from({ length: M }, () => _), r = Array.from({ length: M }, () => _);
  for (const i of e.slots) {
    n[i.key] === _ && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === _ && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === _ && (r[o] = i.runtimeSlot);
  }
  return r[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
async function Dc(e, t, n, r = {}) {
  const i = e.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const o = i.reserve(t.input, t.byteLength), a = r.signal?.onAbort(() => i.cancel(o.id));
  try {
    if (n(o), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await i.commit(o.id), { cancel: () => i.cancel(o.id) };
  } catch (s) {
    throw i.cancel(o.id), s;
  } finally {
    a?.();
  }
}
const _c = 3, Cc = (4 + Ne) * 4, Qn = "runtimeInstallAck", wo = "runtimeSyncRequest", Vt = 0, Nc = 8e3, st = /* @__PURE__ */ new WeakMap(), Do = 1e9;
let je = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Do;
function Lc(e) {
  return je = je % Do + 1, e === "modulation" ? -1e9 - je : 1e9 + je;
}
function Pc(e, t) {
  const n = e, r = st.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), st.set(n, r);
}
function Xn(e, t) {
  const n = e, r = st.get(n);
  r?.delete(t), r?.size === 0 && st.delete(n);
}
const Fc = [100, 250, 500, 1e3], Ve = { _tag: "accepted" }, Uc = { _tag: "superseded" }, Bc = { _tag: "stopped" }, Yn = { _tag: "transport-timeout" };
function $c(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, u = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    c,
    u
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof u != "number" || i < 0 || o < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: u
  };
}
function Kc(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Zn {
  #i;
  #t;
  #m;
  #S;
  #h = !1;
  #u = /* @__PURE__ */ new Set();
  #n = null;
  #a = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #d = 0;
  #o = /* @__PURE__ */ new Map();
  #f = 0;
  #r = !1;
  #s = 0;
  #p = /* @__PURE__ */ new Set();
  #T = this.#k.bind(this);
  constructor(t, n) {
    this.#i = t, this.#t = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#m = r && r.length > 0 ? r : [...Fc], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Nc)
    );
  }
  start() {
    if (!this.#r) {
      Pc(this.#i, this.#t);
      try {
        this.#f += 1, this.#r = !0, this.#a = null, this.#c.clear(), this.#i.addEndpointListener?.(Qn, this.#T);
      } catch (t) {
        throw this.#r = !1, Xn(this.#i, this.#t), t;
      }
    }
  }
  stop() {
    if (this.#r) {
      this.#r = !1;
      for (const t of this.#u) t();
      this.#i.removeEndpointListener?.(Qn, this.#T), Xn(this.#i, this.#t), this.#o.clear(), this.#a = null, this.#c.clear(), this.#I();
    }
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    if (n !== this.#n) {
      for (const r of this.#u) r();
      this.#n = n, this.#a = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#o.clear(), this.#s += 1, this.#I();
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
    const t = this.#n, n = this.#f;
    return this.#r ? t === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#A(t, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(t) {
    if (!this.#r)
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
    const n = this.#n, r = this.#f;
    try {
      const i = await this.#A(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of t) {
        const s = await this.#O(
          a,
          n,
          r
        );
        if (s._tag === "rejected" && this.#t === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? Ve;
    } finally {
      this.#h = !1;
    }
  }
  #E(t) {
    return this.#t === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #R(t, n) {
    const r = this.#E(t);
    return this.#t === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const t = this.getAcceptedFrontier();
    return this.#t === "modulation" ? t + 1 : t - 1;
  }
  async #A(t, n) {
    if (this.#a === t)
      return Ve;
    const r = Lc(this.#t);
    this.#c.add(r);
    const i = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#l(t, n);
        if (a)
          return a;
        if (this.#a === t)
          return Ve;
        const s = i - Date.now();
        if (s <= 0)
          return Yn;
        const c = this.#s;
        this.#b(r), await this.#v(
          c,
          Math.min(this.#y(o), s)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #O(t, n, r) {
    const i = this.#x(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const s = () => {
      a = !0;
      for (const l of o) l();
      o.clear();
    }, c = {
      get aborted() {
        return a;
      },
      onAbort(l) {
        return a ? l() : o.add(l), () => {
          o.delete(l);
        };
      }
    };
    this.#u.add(s);
    const u = async () => {
      this.#l(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#M(t.endpointID, Kc(t.value, n, i)));
    };
    try {
      let l = 0, m = 0, d = this.#d;
      for (await u(); ; ) {
        const f = this.#l(n, r);
        if (f)
          return f;
        const p = this.#g(n, i, d);
        if (p !== null)
          return p;
        const v = this.#s;
        await this.#v(
          v,
          this.#y(l)
        );
        const g = this.#g(
          n,
          i,
          d
        );
        if (g !== null)
          return g;
        let S = this.#s;
        for (this.#b(i); ; ) {
          const x = this.#l(n, r);
          if (x)
            return x;
          const h = await this.#v(
            S,
            this.#y(l)
          ), I = this.#g(
            n,
            i,
            d
          );
          if (I !== null)
            return I;
          if (h && this.#e?.dspSessionId === n && this.#e.syncSerial === i) {
            if (m >= 1)
              return Yn;
            d = this.#d, await u(), m += 1, l += 1;
            break;
          }
          if (h) {
            S = this.#s;
            continue;
          }
          h || (l += 1, S = this.#s, this.#b(i));
        }
      }
    } catch (l) {
      const m = this.#l(n, r);
      if (m) return m;
      throw l;
    } finally {
      s(), this.#u.delete(s);
    }
  }
  #g(t, n, r) {
    const i = this.#e;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(i, n) ? (this.#o.delete(n), Ve) : null;
  }
  #l(t, n) {
    return !this.#r || this.#f !== n ? Bc : this.#n !== t ? Uc : null;
  }
  #y(t) {
    return this.#m[Math.min(
      t,
      this.#m.length - 1
    )];
  }
  #M(t, n) {
    try {
      this.#i.sendEventOrValue?.(
        t,
        n,
        void 0,
        Vt
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          wo,
          t,
          void 0,
          Vt
        );
      } catch {
      }
  }
  #k(t) {
    const n = $c(t);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#a === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#e = n, this.#d += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#d
      }); this.#o.size > 16; ) {
        const i = this.#o.keys().next().value;
        if (i === void 0) break;
        this.#o.delete(i);
      }
    this.#s += 1, this.#I();
  }
  #v(t, n) {
    return !this.#r || this.#s !== t ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#p.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#p.add(o);
    });
  }
  #I() {
    for (const t of [...this.#p])
      t.finish(!0);
  }
}
const zc = 1e3, jc = [re, F];
function er(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Rt(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (er(r, t)) return r[t];
  if (er(n, t)) return n[t];
}
function xt(e, t) {
  if (e === void 0) return dt();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = ko(n, t);
  return r._tag === "ok" ? r.value : null;
}
function tr(e) {
  return new Set(e.routes.flatMap((t) => co(t) === null ? [] : [t.id]));
}
function nr(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function rr(e, t) {
  switch (t._tag) {
    case "accepted":
    case "superseded":
    case "stopped":
      return;
    case "rejected":
      return { kind: "failed", error: { kind: "engine-rejected", message: `The ${e} runtime rejected the update (reason ${t.acknowledgement.rejectionReason}).` } };
    case "transport-timeout":
      return { kind: "failed", error: { kind: "transport", message: `The ${e} runtime did not acknowledge the update.` } };
    case "unavailable":
      return { kind: "failed", error: { kind: "resource", message: `The ${e} runtime is unavailable (${t.reason}).` } };
  }
}
class Vc {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Zn(t, { laneKind: "modulation" }), this.articulationLane = new Zn(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Pe();
  articulationBank = dt();
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
    { length: M },
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
  replaceModulation(t, n) {
    if (!this.frameworkInput) throw new Error("Stored modulation input cannot accept framework replacements.");
    this.modulationState = t, this.hasModulationState = !0, this.deliveryObserver = n, this.applyRuntimeStateIfReady();
  }
  get bootKeys() {
    return this.frameworkInput ? [F] : jc;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Ft, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Ft, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(t) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || t !== this.lifecycleEpoch || (this.applyBootState(n), this.finishBoot());
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
    const t = this.bootEvents.splice(0);
    this.bootPending = !1, this.pendingBootKeys = null;
    for (const n of t) this.applyLiveStoredState(n.key, n.value);
    this.applyRuntimeStateIfReady();
  }
  applyBootState(t) {
    const n = Rt(t, re), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Pe() } : it(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${re} is invalid; boot state was not installed.`);
      const a = Rt(t, F), s = xt(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = Rt(t, F), o = xt(
      i,
      tr(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${F} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(t) {
    if (!this.started || !t || typeof t != "object") return;
    const n = t;
    if (!(typeof n.key != "string" || !this.bootKeys.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === this.bootKeys.length) {
            const r = Object.fromEntries(this.pendingBootKeys);
            this.applyBootState(r), this.finishBoot();
          }
          return;
        }
        this.bootEvents.push({ key: n.key, value: n.value });
        return;
      }
      this.applyLiveStoredState(n.key, n.value);
    }
  }
  applyLiveStoredState(t, n) {
    if (t === re) {
      const i = it(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${re}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = xt(n, tr(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${F}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = $r(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(wo, 0, void 0, Vt), this.hasRuntimeState || this.scheduleRecovery());
      return;
    }
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    this.deliveryInProgress = !0, this.deliveryRefreshPending = !1;
    const t = this.lifecycleEpoch;
    this.deliverRuntimeState().catch((n) => {
      if (!(!this.started || t !== this.lifecycleEpoch)) {
        if (this.frameworkInput) {
          this.stop(), this.frameworkInput.onDefect(n);
          return;
        }
        console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", n), this.scheduleRecovery(), this.finishDelivery();
      }
    });
  }
  async deliverRuntimeState() {
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? zn(r, s, this.frameworkInput.curveCommand) : zn(r, s), u = await this.modulationLane.sendBatch(c);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", u, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const g = rr("modulation", u);
      g && o?.(g), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, i), m = Array.from({ length: M }, (g, S) => {
      const x = l.get(S);
      return x ? nr(x) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, f = d && this.articulationLane.getAcceptedFrontier() !== 0, p = [];
    for (let g = 0; g < M; g += 1) {
      const S = l.get(g), x = m[g] !== this.lastAppliedArticulationTokens[g];
      f ? p.push({
        endpointID: St,
        value: S ?? Hn(g)
      }) : d ? S && p.push({ endpointID: St, value: S }) : x && p.push({
        endpointID: St,
        value: S ?? Hn(g)
      });
    }
    const v = await this.articulationLane.sendBatch(p);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", v, m)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = m;
        const g = wc(i);
        if (this.frameworkInput) {
          const S = await this.frameworkInput.publishTriggerConfig(g);
          if (!this.started || t !== this.lifecycleEpoch) return;
          S.kind !== "cancelled" && o?.(S);
        } else
          gc(g, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const S of p) this.lastAppliedArticulationTokens[S.value.selectorA] = void 0;
        const g = rr("articulation", v);
        g && o?.(g);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = co(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      kc(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = nr(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, zc));
  }
  clearRecoveryTimer() {
    this.recoveryTimer !== null && (clearTimeout(this.recoveryTimer), this.recoveryTimer = null);
  }
  finishDelivery() {
    if (this.deliveryInProgress = !1, !this.started) return;
    const t = this.deliveryRefreshPending;
    this.deliveryRefreshPending = !1, t && this.applyRuntimeStateIfReady();
  }
}
const Hc = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [F],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = or(e);
    return {
      apply(n, r) {
        return t.closed && (t = or(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function or(e) {
  let t = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(d) {
    const f = r;
    r = void 0, f ? f(d) : d.kind !== "cancelled" && e.report(d);
  }
  function c() {
    t || (t = !0, m.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function u(d) {
    if (d.kind !== "submitted") {
      d.kind === "failed" && d.error.kind !== "transport" && (s(d), c());
      return;
    }
    i.add(d.completion), d.completion.then((f) => {
      i.delete(d.completion), !(t || f.kind === "sent") && (s(f), c());
    }, (f) => {
      t || (c(), e.fail(f));
    });
  }
  const l = {
    addEndpointListener(d, f) {
      const p = o.get(d) ?? /* @__PURE__ */ new Map();
      p.set(f, e.listen(d, f)), o.set(d, p);
    },
    removeEndpointListener(d, f) {
      o.get(d)?.get(f)?.(), o.get(d)?.delete(f);
    },
    addStoredStateValueListener(d) {
      a.set(d, e.subscribeStored(
        F,
        (f) => d({ key: F, value: f })
      ));
    },
    removeStoredStateValueListener(d) {
      a.get(d)?.(), a.delete(d);
    },
    requestFullStoredState(d) {
      e.readStored(F).then((f) => {
        t || d({ values: { [F]: f } });
      }, (f) => e.fail(f));
    },
    sendEventOrValue(d, f) {
      t || u(e.send({ kind: "event", endpoint: d, value: f }));
    }
  }, m = new Vc(l, {
    onDefect(d) {
      c(), e.fail(d);
    },
    curveCommand: (d, f, p) => ({
      async submit({ dspSessionId: v, deliverySerial: g, signal: S }) {
        const x = await e.prepareData(
          _c + d * 2 + f,
          Cc,
          (h) => {
            new Int32Array(h.buffer, h.byteOffset, 4).set([1297302855, v, g, Ne]), qr(p, new Float32Array(h.buffer, h.byteOffset + 16, Ne));
          },
          S
        );
        x.kind === "failed" && (s(x), c());
      }
    }),
    async publishTriggerConfig(d) {
      const p = (await Promise.all(i)).find((g) => g.kind !== "sent");
      if (p) return p.kind === "failed" ? p : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const v = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Eo(d) });
      return v.kind === "submitted" ? v.completion : v;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(d, f) {
      if (t || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const p = ++n;
      return new Promise((v) => {
        const g = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (S) => {
          g(), v(S);
        }, m.replaceModulation(d, (S) => {
          p === n && S.kind !== "preparing" && s(S);
        }), m.start();
      });
    },
    stop: c
  };
}
const Wc = Object.freeze([
  "voice.filterCutoff",
  ho,
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
]), qc = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ho]: "enhancer-frequency",
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
  Wc.map((e) => [e, Object.freeze({
    id: e,
    family: qc[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const _o = 40, Co = 18e3, Ht = Ze.map((e) => et[e]), Gc = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Jc = /^(parallel|split)#([1-9][0-9]*)$/;
function $e(e) {
  if (typeof e != "string")
    return null;
  const t = Gc.exec(e);
  if (t === null)
    return null;
  const n = Ht.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > tn ? null : { deviceType: n, instanceNumber: r };
}
function No(e) {
  if (typeof e != "string")
    return null;
  const t = Jc.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? Ur : Si) ? null : { groupKind: n, unitNumber: r };
}
function ie(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function ve(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function R(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function Qc(e, t) {
  const n = $e(e);
  if (n === null)
    return { failure: R(`device id ${e} is not a pool instance`) };
  if (!ie(t) || !ve(t, ["params"]) || !ie(t.params))
    return { failure: R(`device ${e} must be { params }`) };
  const r = rn(n.deviceType), i = Br.get(n.deviceType);
  if (i === void 0)
    return { failure: R(`device ${e} has no effect descriptor`) };
  const o = Cr(i).parameters.map((f) => f.endpointID), a = t.params, s = Object.keys(a), c = (f) => s.length === f.length && s.every((p) => f.includes(p)), u = U(n.deviceType), l = [
    ...wr[n.deviceType],
    u
  ], m = [
    ...di,
    u
  ];
  if (!(s.includes(u) && (c(r) || c(o) || c(l) || n.deviceType === "chorus" && c(m))))
    return { failure: R(`device ${e} must carry every parameter once`) };
  for (const f of s) {
    const p = a[f];
    if (typeof p != "number" || !Number.isFinite(p))
      return { failure: R(`device ${e}.${f} must be a finite number`) };
  }
  return { record: { params: Dr(n.deviceType, a) } };
}
function Xc(e, t) {
  return !ie(e) || e.kind !== "device" ? { failure: R("branches may hold device placements only") } : ve(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: R(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: R(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: R("a device placement is { kind, deviceId, enabled }") };
}
function ir(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= _o && e <= Co;
}
function Lo() {
  return { mix: 1, bypassed: !1 };
}
function Yc(e) {
  return !ie(e) || !ve(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function Zc(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (l) {
      const m = l instanceof Error ? l.message : String(l);
      return R(`is not valid JSON: ${m}`);
    }
  if (!ie(t) || !ve(t, ["format", "version", "output", "devices", "chain"]))
    return R("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return R("must be cosimo.lane version 2");
  if (!ie(t.devices))
    return R("devices must be an object");
  if (!Array.isArray(t.chain))
    return R("chain must be an array");
  const n = Yc(t.output);
  if (n === null)
    return R("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(t.devices)) {
    if (typeof l != "string")
      return R("device ids must be strings");
    const m = Qc(l, t.devices[l]);
    if ("failure" in m)
      return m.failure;
    r[l] = m.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const u = (l) => {
    const m = Xc(l, i);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), c += 1), m;
  };
  for (const l of t.chain) {
    if (!ie(l))
      return R("chain nodes must be objects");
    if (l.kind === "device") {
      const h = u(l);
      if ("failure" in h)
        return h.failure;
      s.push(h.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return R(`unknown chain node kind ${String(l.kind)}`);
    const m = l.kind === "split", d = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], v = m && ve(l, d);
    if (!ve(l, p) && !v)
      return R(`a ${l.kind} group is { ${p.join(", ")} }`);
    const g = No(l.groupId);
    if (g === null || g.groupKind !== l.kind)
      return R(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return R(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return R(`group ${String(l.groupId)} needs a boolean enable`);
    const S = m ? Ii : Pr;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > S)
      return R(`group ${String(l.groupId)} needs 2..${S} branches`);
    if (m && (!ir(l.xoverLowHz) || !ir(l.xoverHighHz)))
      return R(`group ${String(l.groupId)} crossovers must sit in ${_o}..${Co} Hz`);
    if (m && !v && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return R(`group ${String(l.groupId)} Key Track state must be finite`);
    c += 1;
    const x = [];
    for (const h of l.branches) {
      if (!Array.isArray(h))
        return R(`group ${String(l.groupId)} branches must be arrays`);
      const I = [];
      for (const E of h) {
        const C = u(E);
        if ("failure" in C)
          return C.failure;
        I.push(C.placement);
      }
      x.push(I);
    }
    s.push(m ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: v ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: v ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: v ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: v ? 0 : l.xoverHighKeyTrackOffsetSemitones,
      branches: x
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: x
    });
  }
  for (const l of i)
    if ((o.get(l) ?? 0) !== 1)
      return R(`device ${l} must be placed exactly once`);
  return c > Pt ? R(`flattens to ${c} wire entries; the topology upload holds ${Pt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function el() {
  const e = {};
  for (const t of Ze) {
    const n = et[t];
    e[`${n}#1`] = {
      params: cl(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Lo(),
    devices: e,
    chain: Ze.map((t) => ({
      kind: "device",
      deviceId: `${et[t]}#1`,
      enabled: !1
    }))
  };
}
const ar = ["distortion#1", "delay#1", "reverb#1"];
function vn() {
  const e = el(), t = {};
  for (const n of ar) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Lo(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && ar.includes(n.deviceId))
  };
}
function tl(e) {
  if (e === void 0)
    return vn();
  const t = Zc(e);
  return t._tag === "ok" ? t.value : null;
}
function Ot(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function nl(e) {
  return Object.keys(e.devices).map((t) => {
    const n = $e(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Ht.indexOf(t.parsed.deviceType) - Ht.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Wt(e) {
  const t = $e(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return hi(t.deviceType, t.instanceNumber - 1);
}
function Po(e) {
  const t = No(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Ti : Ai) + (t.unitNumber - 1);
}
function rl(e) {
  const t = new Array(Pt).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    t[r] = wi(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Wt(o.deviceId), 0, o.enabled);
      continue;
    }
    i(Po(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(Wt(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function ol(e) {
  const t = new Array(Mr).fill(0);
  return t[Ei] = e.xoverLowHz, t[Ri] = e.xoverHighHz, t[xi] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Oi] = e.xoverLowKeyTrackOffsetSemitones, t[Mi] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[ki] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function il(e) {
  const t = [{
    endpointID: Lr,
    value: e.output
  }];
  let n = 0;
  for (const r of nl(e)) {
    const i = $e(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: Zt(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[U(i.deviceType)]
    }), n += 1, t.push({
      endpointID: De,
      value: {
        slotId: Wt(r.instanceId),
        deliverySerial: n,
        values: pi(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: De,
      value: {
        slotId: Po(r),
        deliverySerial: n,
        values: ol(r)
      }
    }));
  return t.push({
    endpointID: Ye,
    value: rl(e)
  }), t;
}
function al(e, t, n, r) {
  const i = e.devices[t], o = $e(t);
  if (i === void 0 || o === null || !rn(o.deviceType).includes(n) || !Number.isFinite(r))
    return null;
  const a = { ...i.params, [n]: r };
  return o.deviceType === "delay" && n === "delayTimeMode" && r >= 0.5 && (a.delayTimeKeyTrackEnabled = 0), {
    ...e,
    devices: {
      ...e.devices,
      [t]: { params: a }
    }
  };
}
function sl(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = si(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      ke,
      Math.max(oe, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = al(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function cl(e) {
  const t = Br.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Cr(t).parameters;
  return Object.fromEntries(rn(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function In(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) In(t);
    Object.freeze(e);
  }
}
const ll = {
  parse(e) {
    const t = tl(e);
    return t ? (In(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Ot,
  equals: (e, t) => Ot(e) === Ot(t)
}, sr = /* @__PURE__ */ new WeakMap();
function Mt(e) {
  if (!Object.isFrozen(e)) return JSON.stringify(Jn(e));
  let t = sr.get(e);
  return t === void 0 && sr.set(e, t = JSON.stringify(Jn(e))), t;
}
const ul = {
  parse(e) {
    let t = e;
    if (typeof t == "string")
      try {
        t = JSON.parse(t);
      } catch {
        return { kind: "error", message: "Invalid articulation JSON." };
      }
    const n = /* @__PURE__ */ new Set();
    if (t !== null && typeof t == "object" && Array.isArray(Reflect.get(t, "slots")))
      for (const i of Reflect.get(t, "slots")) {
        if (i === null || typeof i != "object") continue;
        const o = Reflect.get(i, "routeAmounts");
        if (o !== null && typeof o == "object")
          for (const a of Object.keys(o)) n.add(a);
      }
    const r = ko(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (In(r.value), { kind: "ok", value: r.value });
  },
  encode: Mt,
  equals: (e, t) => e === t || Mt(e) === Mt(t)
}, cr = [Lr, De, Lt, Ye], dl = { kind: "sent", proof: "native-publication-processed" };
const fl = {
  eventEndpoints: cr,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (d) => il(d).filter((f) => cr.includes(f.endpointID));
    async function u(d, f, p = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const v = c(d), g = t && !p ? c(t) : [], S = (I) => I.find((E) => E.endpointID === Ye)?.value, x = g.length > 0 && JSON.stringify(S(g)) === JSON.stringify(S(v)), h = [];
      for (const I of v) {
        if (!x) {
          h.push(I);
          continue;
        }
        if (I.endpointID !== Ye)
          if (I.endpointID === De) {
            const E = I.value, C = g.find((Y) => Y.endpointID === I.endpointID && Y.value.slotId === E.slotId), Q = C ? C.value.values : [], X = E.values.flatMap((Y, Ae) => Object.is(Y, Q[Ae]) ? [] : [Ae]);
            X.length === 1 ? h.push({
              endpointID: Lt,
              value: { slotId: E.slotId, paramIndex: X[0], value: E.values[X[0]] }
            }) : X.length > 1 && h.push(I);
          } else JSON.stringify(I.value) !== JSON.stringify(g.find((E) => E.endpointID === I.endpointID)?.value) && h.push(I);
      }
      t = void 0;
      for (const I of h) {
        if (a || f.aborted) return { kind: "cancelled" };
        const E = I.endpointID === De || I.endpointID === Lt ? { ...Object(I.value), deliverySerial: ++r } : I.value, C = e.send({ kind: "event", endpoint: I.endpointID, value: E }), Q = C.kind === "submitted" ? await C.completion : C;
        if (Q.kind !== "sent") return Q;
      }
      return a || f.aborted ? { kind: "cancelled" } : (t = d, dl);
    }
    function l(d, f, p = !1) {
      const v = s.then(() => u(d, f, p));
      return s = v.catch(() => {
      }), v;
    }
    const m = e.listen("runtimeState", (d) => {
      const f = d !== null && typeof d == "object" ? Reflect.get(d, "dspSessionId") : void 0;
      if (typeof f != "number" || f === o) return;
      const p = o !== void 0;
      o = f;
      const v = i;
      p && n && l(n, e.signal, !0).then((g) => {
        g.kind === "failed" && v === i && e.report(g);
      }, e.fail);
    });
    return {
      apply(d, f) {
        return i += 1, n = d, l(d, f.signal);
      },
      stop() {
        a = !0, m();
      }
    };
  }
};
function kt(e, t) {
  return {
    [`osc${e}WavetableSelect`]: 35,
    [`osc${e}WavetablePosition`]: 0,
    [`osc${e}Pan`]: 0,
    [`osc${e}Octave`]: 0,
    [`osc${e}Semitone`]: 0,
    [`osc${e}FineCents`]: 0,
    [`osc${e}Phase`]: 0,
    [`osc${e}PhaseRandom`]: 0,
    [`osc${e}Retrigger`]: 1,
    [`osc${e}VolumeDb`]: 0,
    [`osc${e}Mute`]: t,
    [`osc${e}Solo`]: 0,
    [`osc${e}WarpMode`]: 0,
    [`osc${e}WarpAmount`]: 0,
    [`osc${e}UnisonVoices`]: 1,
    [`osc${e}UnisonDetune`]: 0.1,
    [`osc${e}UnisonBlend`]: 0.75,
    [`osc${e}UnisonWidth`]: 1,
    [`osc${e}UnisonDetuneMode`]: 0,
    [`osc${e}UnisonStackMode`]: 0,
    [`osc${e}UnisonPositionSpread`]: 0,
    [`osc${e}UnisonWarpSpread`]: 0
  };
}
const ml = {
  ...kt("A", 0),
  ...kt("B", 1),
  ...kt("C", 1),
  ...Object.fromEntries(en().map((e) => [e, 0])),
  playMode: 0,
  glideTime: 0,
  globalTune: 0,
  macro1: 0,
  macro2: 0,
  macro3: 0,
  macro4: 0,
  filterMode: 1,
  filterCutoff: 1e3,
  filterQ: 0.707107,
  filterMix: 1,
  filterCutoffKeyTrackEnabled: 0,
  filterCutoffKeyTrackOffsetSemitones: 0,
  mseg1Morph: 0,
  mseg2Morph: 0,
  mseg3Morph: 0,
  mseg1Rate: 1,
  mseg2Rate: 1,
  mseg3Rate: 1,
  env1Attack: 0.01,
  env1Decay: 0.25,
  env1Sustain: 0.5,
  env1Release: 0.2,
  env2Attack: 0.01,
  env2Decay: 0.25,
  env2Sustain: 0.5,
  env2Release: 0.2,
  env3Attack: 0.01,
  env3Decay: 0.25,
  env3Sustain: 0.5,
  env3Release: 0.2,
  ampAttack: 0.01,
  ampDecay: 1e-3,
  ampSustain: 1,
  ampRelease: 0.2,
  voiceEnhancerFrequency: 130,
  voiceEnhancerQ: 0.71,
  voiceEnhancerAmount: 0,
  voiceEnhancerKeyTrackEnabled: 0,
  voiceEnhancerKeyTrackOffsetSemitones: 0,
  polishEnhancerAmount: 0,
  polishCompressionClipAmount: 0,
  polishOutputTrimDb: 0,
  polishSafeBassAmount: 0,
  polishSafeBassBypass: 0,
  polishEnhancerBypass: 0,
  polishCompressionClipBypass: 0,
  polishOutputTrimBypass: 0,
  [re]: Pe(),
  [we]: vn(),
  [F]: dt()
}, hl = [
  { id: "init", name: "Init", values: ml }
], Fo = "bounce.v1", pl = "cosimo.bounce", gl = 1, Uo = "cosimo.patch-document", Bo = 1;
function w(e, t) {
  if (!e) throw new Error(t);
}
function G(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function le(e, t = "value") {
  return e === null || typeof e == "boolean" || typeof e == "string" ? e : typeof e == "number" ? (w(Number.isFinite(e), `${t} must be finite JSON data`), e) : Array.isArray(e) ? e.map((n, r) => le(n, `${t}[${r}]`)) : (w(G(e), `${t} must be JSON-compatible`), Object.fromEntries(
    Object.keys(e).sort().map((n) => [n, le(e[n], `${t}.${n}`)])
  ));
}
function $o(e, t) {
  if (typeof e != "string") return le(e, t);
  try {
    return le(JSON.parse(e), t);
  } catch (n) {
    throw new Error(`${t} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function yl(e) {
  return JSON.stringify(le(e));
}
function bl({ parameters: e, storedState: t } = {}) {
  w(G(e), "Bounce patch parameters must be an object"), w(G(t), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(e).sort()) {
    const i = e[r];
    w(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), w(
      typeof i == "number" && Number.isFinite(i),
      `Bounce parameter ${r} must be finite`
    ), n[r] = i;
  }
  return Object.freeze({
    format: Uo,
    version: Bo,
    parameters: Object.freeze(n),
    storedState: Object.freeze(le(t, "storedState"))
  });
}
function vl(e) {
  const t = $o(e, "Bounce patch document");
  return w(
    G(t) && t.format === Uo && t.version === Bo,
    "Unsupported Bounce patch document"
  ), w(
    Object.keys(t).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), bl(t);
}
function Ko(e) {
  const t = $o(e, Fo);
  w(
    G(t) && t.format === pl && t.version === gl,
    "Unsupported bounce.v1 document"
  );
  const n = [
    "bankByteLength",
    "capture",
    "digest",
    "format",
    "generation",
    "revertRef",
    "roots",
    "segments",
    "version"
  ];
  w(
    Object.keys(t).sort().join(",") === n.sort().join(","),
    "bounce.v1 has unexpected fields"
  ), w(
    typeof t.digest == "string" && /^[0-9a-f]{64}$/.test(t.digest),
    "bounce.v1 digest must be lowercase SHA-256"
  ), w(
    Number.isInteger(t.generation) && t.generation > 0,
    "bounce.v1 generation must be positive"
  ), w(
    Number.isInteger(t.bankByteLength) && t.bankByteLength > 0,
    "bounce.v1 bankByteLength must be positive"
  ), w(
    Array.isArray(t.roots) && t.roots.length > 0 && t.roots.every((a) => Number.isInteger(a) && a >= 0 && a <= 127),
    "bounce.v1 roots are invalid"
  ), w(
    Array.isArray(t.segments) && t.segments.length === t.roots.length,
    "bounce.v1 segments must match roots"
  );
  let r = 0;
  t.segments.forEach((a, s) => {
    w(
      G(a) && a.rootNote === t.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), w(
    G(t.capture) && Number.isInteger(t.capture.sampleRate) && t.capture.sampleRate > 0 && typeof t.capture.tempoBpm == "number" && t.capture.tempoBpm > 0 && t.capture.velocity === 100 && Number.isInteger(t.capture.holdFrames) && t.capture.holdFrames > 0 && Number.isInteger(t.capture.tailCapFrames) && t.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), w(G(t.revertRef), "bounce.v1 revertRef is invalid");
  const i = t.revertRef.bankDigest;
  w(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = vl(t.revertRef.patchDocument);
  return Object.freeze({
    ...le(t),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function Il(e) {
  return yl(Ko(e));
}
const Sl = y("sourceMode", { preset: !1 });
function zo(e) {
  if (e !== null && typeof e == "object") {
    for (const t of Object.values(e)) zo(t);
    Object.freeze(e);
  }
  return e;
}
const lr = /* @__PURE__ */ new WeakMap();
function wt(e) {
  let t = lr.get(e);
  return t === void 0 && lr.set(e, t = Il(e)), t;
}
const Tl = {
  parse(e) {
    if (e === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: zo(Ko(e)) };
    } catch (t) {
      return { kind: "error", message: t instanceof Error ? t.message : String(t) };
    }
  },
  encode: (e) => e === null ? null : wt(e),
  equals: (e, t) => e === t || e !== null && t !== null && wt(e) === wt(t)
}, Al = ae({ initial: null, codec: Tl, preset: !1 }), El = Object.freeze({
  ...Object.fromEntries(Je.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, y(t)]))),
  ...Object.fromEntries(en().map((e) => [e, y(e)])),
  playMode: y("playMode"),
  glideTime: y("glideTime"),
  macro1: y("macro1"),
  macro2: y("macro2"),
  macro3: y("macro3"),
  macro4: y("macro4"),
  filterMode: y("filterMode"),
  filterCutoff: y("filterCutoff"),
  filterQ: y("filterQ"),
  mseg1Morph: y("mseg1Morph"),
  mseg2Morph: y("mseg2Morph"),
  mseg3Morph: y("mseg3Morph"),
  mseg1Rate: y("mseg1Rate"),
  mseg2Rate: y("mseg2Rate"),
  mseg3Rate: y("mseg3Rate"),
  env1Attack: y("env1Attack"),
  env1Decay: y("env1Decay"),
  env1Sustain: y("env1Sustain"),
  env1Release: y("env1Release"),
  env2Attack: y("env2Attack"),
  env2Decay: y("env2Decay"),
  env2Sustain: y("env2Sustain"),
  env2Release: y("env2Release"),
  env3Attack: y("env3Attack"),
  env3Decay: y("env3Decay"),
  env3Sustain: y("env3Sustain"),
  env3Release: y("env3Release"),
  filterMix: y("filterMix"),
  ampRelease: y("ampRelease"),
  sourceMode: Sl,
  globalTune: y("globalTune"),
  ampAttack: y("ampAttack"),
  ampDecay: y("ampDecay"),
  ampSustain: y("ampSustain"),
  filterCutoffKeyTrackEnabled: y("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: y("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: y("voiceEnhancerFrequency"),
  voiceEnhancerQ: y("voiceEnhancerQ"),
  voiceEnhancerAmount: y("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: y("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: y("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: y("polishEnhancerAmount"),
  polishCompressionClipAmount: y("polishCompressionClipAmount"),
  polishOutputTrimDb: y("polishOutputTrimDb"),
  polishSafeBassAmount: y("polishSafeBassAmount"),
  polishSafeBassBypass: y("polishSafeBassBypass"),
  polishEnhancerBypass: y("polishEnhancerBypass"),
  polishCompressionClipBypass: y("polishCompressionClipBypass"),
  polishOutputTrimBypass: y("polishOutputTrimBypass")
}), Rl = ri({
  ...El,
  [re]: An({ initial: Pe(), codec: Qs, prepare: (e) => e, engine: Hc }),
  [we]: An({
    initial: vn(),
    codec: ll,
    dependencies: en(),
    prepare: (e, { parameters: t }) => sl(e, t),
    engine: fl
  }),
  [F]: ae({ initial: dt(), codec: ul }),
  [Fo]: Al,
  ...Li({ factory: hl, initial: "init" }),
  ...$i()
}), xl = { kind: "sent", proof: "native-publication-processed" };
function Ol(e) {
  if (typeof e != "object" || e === null) return;
  const t = Reflect.get(e, "values");
  return typeof t == "object" && t !== null ? Reflect.get(t, we) : void 0;
}
function Ml(e, t) {
  const n = Rl[we];
  if (n.engine?.kind !== "prepared") throw new Error("The synth's rack field must declare its own delivery.");
  const { prepare: r, delivery: i } = n.engine;
  let o = !1;
  const a = /* @__PURE__ */ new Set(), s = {
    get aborted() {
      return o;
    },
    onAbort(h) {
      return a.add(h), () => a.delete(h);
    }
  }, c = ai(e), u = [];
  function l(h, I) {
    e.addEndpointListener?.(h, I);
    const E = () => e.removeEndpointListener?.(h, I);
    return u.push(E), E;
  }
  const m = {
    signal: s,
    send(h) {
      if (o) return { kind: "cancelled" };
      if (h.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${h.kind}.`);
      return e.sendEventOrValue?.(h.endpoint, h.value), { kind: "submitted", completion: Promise.resolve(xl) };
    },
    listen: l,
    readStored: () => Promise.reject(new Error("The rack delivery declares no stored reads.")),
    subscribeStored: () => {
      throw new Error("The rack delivery declares no stored reads.");
    },
    prepareData: () => Promise.reject(new Error("The rack delivery declares no shared data.")),
    report(h) {
      h.kind === "failed" && t.onDefect(new Error(`The rack was not applied: ${h.error.message}`));
    },
    fail: t.onDefect
  }, d = i.create(m);
  let f, p = !1;
  async function v() {
    const h = f === void 0 ? n.initial : n.codec.parse(f);
    if (h.kind === "error") {
      t.onDefect(new Error(`The saved rack could not be read: ${h.message}`));
      return;
    }
    const I = await r(h.value, { resources: c, parameters: {}, reason: "load", signal: s });
    if (o) return;
    if (Zo(I)) {
      t.onDefect(new Error(`The saved rack could not be prepared: ${I.error.message}`));
      return;
    }
    const E = await d.apply(I, { signal: s, send: m.send, listen: l });
    E.kind === "failed" && t.onDefect(new Error(`The rack was not applied: ${E.error.message}`));
  }
  const g = () => {
    !o && p && v().catch(t.onDefect);
  }, S = (h) => {
    p || $r(h) === 0 || (p = !0, g());
  }, x = (h) => {
    typeof h != "object" || h === null || Reflect.get(h, "key") !== we || (f = Reflect.get(h, "value"), g());
  };
  return {
    start() {
      l(Ft, S), e.addStoredStateValueListener?.(x), e.requestFullStoredState?.((h) => {
        f = Ol(h), g();
      });
    },
    stop() {
      if (!o) {
        o = !0;
        for (const h of a) h();
        a.clear(), e.removeStoredStateValueListener?.(x);
        for (const h of u.splice(0)) h();
        return d.stop();
      }
    }
  };
}
function B(e, t) {
  if (!e)
    throw new Error(t);
}
function Dt(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function kl(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function qt(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function jo(e) {
  if (e === null)
    return "null";
  if (e === void 0)
    return "undefined";
  const t = typeof e, n = e?.constructor?.name;
  if (t !== "object")
    return n ? `${t}:${n}` : t;
  const r = Object.keys(e).slice(0, 6), i = r.length > 0 ? ` keys=${r.join(",")}` : "";
  return n ? `${t}:${n}${i}` : `${t}${i}`;
}
function wl() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function _t(e, t) {
  const n = wl();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (kl(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function ur(e) {
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
  throw new Error(`Unsupported text resource payload (${jo(e)})`);
}
function Dl(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return qt(e);
  throw new Error(`Unsupported binary resource payload (${jo(e)})`);
}
function _l(e) {
  const t = e?.frames;
  B(
    Array.isArray(t) || ArrayBuffer.isView(t),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(t), r = new Float32Array(n.length);
  for (let i = 0; i < n.length; i += 1) {
    const o = n[i];
    if (typeof o == "number") {
      r[i] = o;
      continue;
    }
    if (ArrayBuffer.isView(o) || Array.isArray(o)) {
      const a = o;
      B(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function Vo(e) {
  const t = new DataView(e);
  B(Dt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), B(Dt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, c = null, u = 12;
  for (; u + 8 <= t.byteLength; ) {
    const m = Dt(t, u, 4), d = t.getUint32(u + 4, !0), f = u + 8;
    m === "fmt " ? (n = t.getUint16(f, !0), r = t.getUint16(f + 2, !0), i = t.getUint32(f + 4, !0), a = t.getUint16(f + 12, !0), o = t.getUint16(f + 14, !0)) : m === "data" && (s = f, c = d), u = f + d + d % 2;
  }
  B(n !== null, "Wave file is missing a fmt chunk"), B(s !== null && c !== null, "Wave file is missing a data chunk"), B(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && o === 32)
    l = new Float32Array(e.slice(s, s + c));
  else if (n === 1 && o === 16) {
    const m = c / 2, d = new Int16Array(e.slice(s, s + c));
    l = new Float32Array(m);
    for (let f = 0; f < m; f += 1)
      l[f] = d[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: l
  };
}
async function dr(e) {
  B(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return B(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function Gt(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Ho(e) {
  const t = new Uint8Array(e).buffer, n = Vo(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Cl(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => (B(typeof e.readResource == "function", `Resource bridge cannot read ${c}`), e.readResource(c)), i = async (c) => {
    B(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const u = await e.readResourceAsAudioData(c);
    return _l(u);
  }, o = (c) => {
    const u = e.getResourceAddress?.(c);
    return u ?? null;
  }, a = async (c, u = e.getResourceAddress?.(c)) => {
    const l = _t(c, u), m = await dr(l), d = Vo(m);
    return {
      sampleRate: d.sampleRate,
      samples: d.samples
    };
  }, s = async (c, u = e.getResourceAddress?.(c)) => {
    const l = _t(c, u);
    return new Uint8Array(await dr(l));
  };
  return {
    async readText(c) {
      if (t === "bridge" && typeof e.readResource == "function")
        return ur(await r(c));
      const u = o(c);
      return t === "url" && u !== null ? Gt(await s(c, u)) : typeof e.readResource == "function" ? ur(await r(c)) : Gt(await s(c, u));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof e.readResource == "function" ? Dl(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(c);
      const u = o(c);
      return n === "url" && u !== null ? a(c, u) : typeof e.readResourceAsAudioData == "function" ? i(c) : Ho(await this.readBytes(c));
    },
    getURL(c) {
      return _t(c, e.getResourceAddress?.(c));
    }
  };
}
function Nl(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return Cl(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Ll(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Gt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return qt(await t(a));
      if (n)
        return qt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Ho(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Pl(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function Fl(e) {
  return Pl(e) ? Ll(e) : Nl(e);
}
const Qe = 2048;
function Re(e, t) {
  if (!e)
    throw new Error(t);
}
function Ul(e) {
  Re(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    Re(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), Re(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), Re(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), Re(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const Bl = 2048, ct = 11, $l = 256;
function z(e, t) {
  if (!e)
    throw new Error(t);
}
function Kl(e) {
  return e > 0 && (e & e - 1) === 0;
}
const fr = /* @__PURE__ */ new Map();
function zl(e) {
  const t = fr.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return fr.set(e, r), r;
}
function Wo(e, t, n = !1) {
  const r = e.length;
  z(r === t.length, "FFT real and imaginary buffers must have the same length"), z(Kl(r), "FFT input length must be a power of two");
  const i = zl(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const s = e[o];
    e[o] = e[a], e[a] = s;
    const c = t[o];
    t[o] = t[a], t[a] = c;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, c = Math.cos(s), u = Math.sin(s);
    for (let l = 0; l < r; l += o) {
      let m = 1, d = 0;
      for (let f = 0; f < a; f += 1) {
        const p = l + f, v = p + a, g = e[v], S = t[v], x = m * g - d * S, h = m * S + d * g, I = e[p], E = t[p];
        e[p] = I + x, t[p] = E + h, e[v] = I - x, t[v] = E - h;
        const C = m * c - d * u;
        d = m * u + d * c, m = C;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function qo(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function jl(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Bl,
  maxFramesPerTable: r = $l
} = {}) {
  const i = Float32Array.from(e);
  z(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  z(o > 0, "Source wavetable files must contain at least one frame"), z(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && z(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, u = c + n;
    a.push(qo(i.slice(c, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function mr(e) {
  const t = qo(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Wo(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Go(e, t, {
  mipLevelCount: n = ct
} = {}) {
  const r = e?.real?.length ?? 0;
  z(r > 0, "Spectrum must contain real samples"), z(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), z(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = e.real[s], a[s] = e.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = e.real[c], a[c] = e.imaginary[c]);
  }
  return Wo(o, a, !0), Float32Array.from(o);
}
const Xe = 256, xe = 2048, Jo = 8, Vl = 12811, Jt = (Jo + Xe * Vl) * 4;
function hr(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Hl(e, t, n) {
  if (e.byteLength !== Jt || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Xe)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    ct,
    Xe
  ]);
  let i = Jo;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let u = 0; u < ct; ++u) {
    const l = Math.min(xe, Math.max(256, (1 << u) * 32)), m = xe / l;
    for (let d = 0; d < t.frameCount; ++d) {
      const f = Go(n(d), u), p = i + d * (l + 1);
      for (let v = 0; v <= l; ++v) {
        const g = (v === l ? 0 : v) * m, S = (g + xe - m) % xe, x = (g + m) % xe, h = f[g], I = f[S], E = f[x];
        if (h === void 0 || I === void 0 || E === void 0 || !Number.isFinite(h) || !Number.isFinite(I) || !Number.isFinite(E))
          throw new Error("Wavetable preparation produced invalid samples.");
        const C = Math.fround(0.5 * Math.fround(E - I));
        r[p + v] = hr(h, s, o) & 262143 | hr(C, c, a) << 18;
      }
    }
    i += (l + 1) * Xe;
  }
}
const Wl = "runtimeSyncRequest", ql = 2147483647, Gl = "runtimeState", Jl = "retryDesiredTableRequest", Ql = "workerLoadFailure", Xl = "serviceLoadAbort", Yl = "wavetableLoadBegin", Zl = "wavetableMipFrame", eu = "wavetableUploadAck", tu = "wavetableMipRequest", nu = "wavetablePrewarmRequest", ru = "wavetablePrewarmNotification", ou = "assets/factory-bank-catalog.json", Qt = 3, iu = 1, au = Qt * Qe, su = 1, cu = 2, lu = 3, uu = 1, du = 2, fu = 2e4, He = su, pr = cu, gr = lu, q = uu, yr = du, mu = 48 * 1024 * 1024, Ct = 3;
function br(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function k(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function vr(e) {
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
function Ir(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function Sr(e, t) {
  if (!e)
    throw new Error(t);
}
function hu(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function pu(e, t) {
  return Ul(await e.readJSON(t));
}
function gu(e) {
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
function yu(e, t) {
  const n = Math.round(Number(e) || 0);
  return hu(n, 0, Math.max(0, t - 1));
}
function Nt(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function bu(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Tr(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function Ar(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function We() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function vu(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class Iu {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = Fl(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? ou, this.maxBatchesInFlight = br(
      n.maxFramesInFlight,
      iu
    ), this.mipLevelCount = n.mipLevelCount ?? ct, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? mu) || 0)), this.serviceLoadTimeoutMs = br(n.serviceLoadTimeoutMs, fu), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, k("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Gl, this.handleRuntimeState), this.connection.addEndpointListener?.(eu, this.handleUploadAck), this.connection.addEndpointListener?.(tu, this.handleMipRequest), this.connection.addEndpointListener?.(nu, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ru, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Wl,
      ql
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await pu(this.resourceClient, this.catalogPath), k("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Ct; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Tr(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      let n = null, r = null;
      for (const [i, o] of this.tableCache)
        t.has(i) || (!r || o.lastUsedSerial < r.lastUsedSerial) && (n = i, r = o);
      if (!n || !r)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= r.byteCount;
    }
  }
  rememberLoadedTable(t) {
    const n = this.tableCache.get(t.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const r = {
      ...t,
      byteCount: Tr(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Nt(
          this.serviceTable.dspSessionId,
          this.serviceTable.oscillatorIndex,
          this.serviceTable.generation,
          this.serviceTable.tableIndex,
          n
        );
        this.mipJobs.has(r) || this.mipJobs.set(r, {
          key: r,
          dspSessionId: this.serviceTable.dspSessionId,
          oscillatorIndex: this.serviceTable.oscillatorIndex,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: t,
          ...Ar(this.serviceTable.frameCount),
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
    const { dspSessionId: t, oscillatorIndex: n, generation: r, tableIndex: i } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (k("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: t,
        oscillatorIndex: n,
        generation: r,
        tableIndex: i,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: t,
          oscillatorIndex: n,
          generation: r,
          tableIndex: i
        },
        {
          failurePhase: gr,
          failureReasonCode: yr
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== gr || t.failureReasonCode !== yr ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = He,
    failureReasonCode: s = q
  }) {
    this.connection.sendEventOrValue?.(Ql, {
      dspSessionId: t,
      oscillatorIndex: n,
      tableIndex: r,
      generation: i,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: t,
    oscillatorIndex: n,
    generation: r,
    tableIndex: i,
    failureReasonCode: o = q
  }) {
    this.connection.sendEventOrValue?.(Xl, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    k("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? vr(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(Jl, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = yu(t, r.tables.length), o = r.tables[i];
    Sr(o, `Could not resolve table ${i}`);
    const a = bu(o, Qe, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, k("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = We();
    k("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), l = jl(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Qe
    });
    return k("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(We() - c)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: l.frameCount,
      frames: l.frames,
      spectra: new Array(l.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, r) {
    if (k("info", "Committing desired wavetable load", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      generation: n,
      tableIndex: t.desiredTableIndex,
      tableName: r.tableMeta?.name ?? null,
      frameCount: r.frameCount
    }), this.serviceTable = {
      ...r,
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
    this.connection.sendEventOrValue?.(Yl, {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: n,
      tableIndex: t.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  async prepareSharedTable() {
    const t = this.serviceTable;
    if (!t) return;
    const n = We();
    try {
      if (await Dc(this.connection, {
        input: t.oscillatorIndex,
        byteLength: Jt
      }, (r) => {
        Hl(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      k("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: Jt,
        preparationMs: We() - n,
        sampleUploadBytes: 0
      });
    } catch (r) {
      if (this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      const i = this.candidateValidations[t.oscillatorIndex];
      i?.dspSessionId === t.dspSessionId && i.generation === t.generation && i.desiredIntentSerial === t.desiredIntentSerial && (this.candidateValidations[t.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: 0,
        tableIndex: t.tableIndex,
        candidateAttemptSerial: t.desiredIntentSerial,
        failurePhase: pr,
        failureReasonCode: q
      }), this.serviceTable = null, this.clearMipTransferState(), k("error", "Shared wavetable preparation failed", { detail: qe(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    k("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: He,
      failureReasonCode: q
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: He,
      failureReasonCode: q
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = He,
    failureReasonCode: r = q
  } = {}) {
    k("error", "Service wavetable load failed", {
      kind: t.kind,
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      tableIndex: t.tableIndex,
      failurePhase: n,
      failureReasonCode: r
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.tableIndex,
      generation: t.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: r
    }), t.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      tableIndex: t.tableIndex,
      failureReasonCode: r
    });
  }
  async prepareServiceTarget(t, n) {
    if (this.isMatchingServiceTable(t)) {
      this.serviceTable && (this.serviceTable.mode = t.kind);
      const o = this.candidateValidations[t.oscillatorIndex];
      return o && o.dspSessionId === t.dspSessionId && o.generation === t.generation && o.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(t.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (k("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: qe(o)
      }), this.handleServiceTargetFailure(t)), !1;
    }
    if (!r || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...r,
      mode: t.kind,
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), t.kind === "loading" && (this.delivery === "shared" ? await this.prepareSharedTable() : (this.createFullMipJobsForServiceTable(2), this.pumpUploads()));
    const i = this.candidateValidations[t.oscillatorIndex];
    return i && i.dspSessionId === t.dspSessionId && i.generation === t.generation && i.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(t) {
    const n = t.desiredTableIndex, r = this.candidateValidations[t.oscillatorIndex];
    if (r && r.dspSessionId === t.dspSessionId && r.tableIndex === n && r.desiredIntentSerial === t.desiredIntentSerial)
      return;
    const i = Math.max(
      this.nextLoadGenerations[t.oscillatorIndex] ?? 1,
      t.generationFrontier + 1
    );
    let o = null;
    try {
      o = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(t) && (k("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: qe(a)
      }), this.handleCandidateLoadFailure(t));
      return;
    }
    !o || !this.isCurrentRuntimeState(t) || this.markCommittedDesiredLoad(t, i, o);
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
    for (let t = 0; t < Ct; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, vu(() => {
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
    const n = t.oscillatorIndex, r = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const i = this.candidateValidations[n];
    if (i && i.dspSessionId === t.dspSessionId && i.generation > t.generationFrontier)
      return;
    const o = this.resolveServiceTarget(t);
    if (o) {
      if (!await this.prepareServiceTarget(o, t) || !this.isCurrentRuntimeState(t))
        return;
      if (o.kind === "loading" && t.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(t)) {
        k("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          staleTableIndex: o.tableIndex,
          desiredTableIndex: t.desiredTableIndex,
          desiredIntentSerial: t.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          tableIndex: o.tableIndex,
          failureReasonCode: q
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      o.kind === "active" && t.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(t) && !r && await this.prepareDesiredCandidate(t);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(t)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(t), this.emitRetryDesiredTableRequest(n);
      return;
    }
    t.serviceState !== 0 || this.shouldStayIdleOnFailure(t) || await this.prepareDesiredLoad(t);
  }
  handleRuntimeState(t) {
    const n = gu(t ?? {});
    if (k("info", "Received runtime state", vr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Ct)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const i = n.oscillatorIndex, o = this.latestRuntimeStates[i], a = o ? this.getDesiredRetryKey(o) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[i] = Math.max(
      this.nextLoadGenerations[i] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== s) && (this.autoRetryConsumedKeys[i] = null), this.latestRuntimeStates[i] = n, this.pendingRuntimeStateOscillators.add(i), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(t) {
    const n = t !== null && typeof t == "object" && !Array.isArray(t) ? t : null, r = Math.trunc(Number(n?.tableIndex ?? t));
    if (Number.isFinite(r))
      try {
        const i = await this.loadTableSource(r);
        for (let a = 0; a < i.frameCount; a += 1)
          i.spectra[a] || (i.spectra[a] = mr(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), k("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        k("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: qe(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), s = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = Nt(
      n,
      r,
      i,
      o,
      a
    );
    let u = this.mipJobs.get(c);
    return u ? (!u.completed && s > u.urgencyLevel && (u.urgencyLevel = s), u) : (u = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...Ar(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, u), u);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (k("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), l = Nt(
      r,
      i,
      o,
      a,
      s
    ), m = this.mipJobs.get(l), d = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Qt,
      d - c
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(c) || u <= 0 || u !== f)) {
      m.inFlightBatchBases.delete(c);
      for (let p = 0; p < u; p += 1) {
        const v = c + p;
        m.ackedFrames[v] || (m.ackedFrames[v] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === d && m.nextFrameIndex >= d && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Ir(c, u, d) && k("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: u,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: d,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (Sr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = mr(this.serviceTable.frames[t]);
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
      const n = t.nextFrameIndex, r = Math.min(
        Qt,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(au);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Go(s, t.mipIndex);
          i.set(c, o * Qe);
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
            failurePhase: pr,
            failureReasonCode: q
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Zl, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Ir(n, r, this.serviceTable.frameCount) && k("info", "Sent wavetable mip batch", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        batchFrameCount: r,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: t.inFlightBatchBases.size + 1
      }), t.inFlightBatchBases.add(n), t.nextFrameIndex += r, this.armServiceLoadWatchdog();
    }
    t.ackedFrameCount === this.serviceTable.frameCount && t.nextFrameIndex >= this.serviceTable.frameCount && t.inFlightBatchBases.size === 0 && (t.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function qe(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Su(e, t = {}) {
  return new Iu(e, t);
}
async function Tu(e, t = {}) {
  return Qo(e, [
    () => Ml(e, {
      onDefect: (n) => console.error("Cosimo rack restore failed", n)
    }),
    () => Su(e, t)
  ]);
}
export {
  Tu as default
};
