async function pn(t) {
  const e = [];
  for (const n of [...t].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      e.push(r);
    }
  return e;
}
async function Po(t, e) {
  const n = [];
  try {
    for (const i of e) {
      const o = await i(t);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await pn(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await pn(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const Fo = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Uo(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !Fo.has(t);
}
function Bo(t) {
  return typeof t == "object" && t !== null && "kind" in t && t.kind === "preparation-error" && "error" in t && typeof t.error == "object" && t.error !== null && "kind" in t.error && t.error.kind === "resource" && "message" in t.error && typeof t.error.message == "string";
}
const mr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), hr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function g(t, e = {}) {
  return Object.freeze({ kind: "parameter", endpoint: t, ...e });
}
function ie(t) {
  if (t.lifetime === "user" && t.history === !0)
    throw new Error("A user-lifetime value is shared across projects and cannot take part in Undo. Remove history: true.");
  const e = Object.freeze({ ...t.codec }), n = t.lifetime === "user" ? !1 : t.history;
  return Object.freeze({
    kind: "stored",
    initial: e.parse(t.initial),
    codec: e,
    ...t.lifetime ? { lifetime: t.lifetime } : {},
    ...n !== void 0 ? { history: n } : {},
    ...t.preset === !1 ? { preset: !1 } : {},
    ...t.engine ? { engine: t.engine } : {}
  });
}
function gn(t) {
  const e = ie({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history, preset: t.preset }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const o = t.engine, a = t.prepare, s = t.prepare, c = o.length;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (m, l) => ({
        length: c,
        write: (d) => a(m, d, l)
      })
    }) });
  }
  const r = t.prepare, i = t.engine;
  return Object.freeze({ ...e, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: r,
    delivery: i
  }) });
}
const $o = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Ko(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function zo(t) {
  return Object.keys(t).filter((e) => t[e]?.preset !== !1);
}
function jo(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Ko(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !Uo(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(t)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(t)) o.kind === "stored" && o[mr]?.(t);
  const i = { ...t };
  for (const [o, a] of Object.entries(t)) {
    const s = a.kind === "stored" ? a[hr] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(t) }));
  }
  return Object.freeze(Object.defineProperty(i, $o, { value: Object.freeze({ ...e }) }));
}
function $(t) {
  throw new Error(t);
}
function ut(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function bn(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Vo(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function vn(t, e) {
  return typeof e == "string" ? Vo(e) : e instanceof ArrayBuffer ? new Uint8Array(e.slice(0)) : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)) : Array.isArray(e) ? Uint8Array.from(e) : $(`The host returned ${t} in a form this kit cannot read.`);
}
function In(t, e) {
  const n = new DataView(e);
  (n.byteLength < 12 || ut(n, 0, 4) !== "RIFF" || ut(n, 8, 4) !== "WAVE") && $(`${t} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, c = 0;
  for (let l = 12; l + 8 <= n.byteLength; ) {
    const d = ut(n, l, 4), u = n.getUint32(l + 4, !0), f = l + 8;
    d === "fmt " ? (r = n.getUint16(f, !0), i = n.getUint16(f + 2, !0), o = n.getUint32(f + 4, !0), a = n.getUint16(f + 14, !0)) : d === "data" && (s = f, c = Math.min(u, n.byteLength - f)), l = f + u + u % 2;
  }
  (s < 0 || r === 0) && $(`${t} is missing its WAV format or data chunk.`), i !== 1 && $(`${t} has ${i} channels; readAudio reads mono WAV files only.`);
  const m = e.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(m, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const l = new Int16Array(m, 0, Math.floor(c / 2));
    return { sampleRate: o, samples: Float32Array.from(l, (d) => d / 32768) };
  }
  return $(`${t} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function Ho(t, e) {
  const n = e ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && $(`The host decoded ${t} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : $(`${t} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function Wo() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/\/[^/]*$/, "/"), e;
}
function yn(t, e, n) {
  return e instanceof URL ? e : typeof e == "string" && e.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e) ? new URL(e) : new URL(e.replace(/^\//, ""), n) : new URL(t, n);
}
function pr(t, e = {}) {
  const n = t ?? {}, r = e.patchRoot ?? Wo(), i = async (a, s = n.getResourceAddress?.(a)) => {
    typeof fetch != "function" && $(`Cannot read ${a}: this host has neither a resource bridge nor fetch.`);
    const c = yn(a, s, r), m = await fetch(c.toString());
    return m.ok || $(`Could not read ${a} from ${c} (HTTP ${m.status}).`), m.arrayBuffer();
  }, o = async (a) => n.readResource ? vn(a, await n.readResource(a)) : new Uint8Array(await i(a));
  return {
    async readText(a) {
      if (!n.readResource) return bn(new Uint8Array(await i(a)));
      const s = await n.readResource(a);
      return typeof s == "string" ? s : typeof s == "object" && s !== null && "text" in s && typeof s.text == "function" ? String(await s.text()) : bn(vn(a, s));
    },
    async readJSON(a) {
      return JSON.parse(await this.readText(a));
    },
    readBytes: o,
    async readAudio(a) {
      const s = n.getResourceAddress?.(a);
      return s != null && typeof fetch == "function" ? In(a, await i(a, s)) : n.readResourceAsAudioData ? Ho(a, await n.readResourceAsAudioData(a)) : In(a, new Uint8Array(await o(a)).buffer);
    },
    getURL(a) {
      return yn(a, n.getResourceAddress?.(a), r);
    }
  };
}
function gr() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/[^/]*\/[^/]*$/, ""), e;
}
function br(t) {
  if (typeof t != "object" || t === null) return {};
  const e = Reflect.get(t, "values");
  return typeof e == "object" && e !== null && !Array.isArray(e) ? e : {};
}
const re = -100, Me = 35, Ht = 5, Wt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function vr(t) {
  const e = Wt.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function B(t) {
  return vr(t).laneEndpointID;
}
function qt(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > Ht)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${vr(t).hostStem}${e}OutputTrimDb`;
}
function Gt() {
  return Wt.flatMap((t) => Array.from(
    { length: Ht },
    (e, n) => qt(t.deviceType, n + 1)
  ));
}
function qo(t) {
  if (typeof t != "string")
    return null;
  for (const e of Wt)
    for (let n = 1; n <= Ht; n += 1)
      if (t === qt(e.deviceType, n))
        return {
          deviceType: e.deviceType,
          instanceNumber: n,
          laneEndpointID: e.laneEndpointID
        };
  return null;
}
function Ir(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Go(t) {
  const e = (Ir(t, re, Me) - re) / (Me - re);
  return e * e;
}
function Jo(t) {
  const e = Math.sqrt(Ir(t, 0, 1));
  return re + e * (Me - re);
}
const yr = 12, Jt = 5, Sr = 8, Qo = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Tr = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    B("globalFilter")
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
    B("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    B("ott")
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
    B("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    B("flanger")
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
    B("phaser")
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
    B("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    B("reverb")
  ]
});
function Qt(t) {
  return Tr[t];
}
function Xo(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Jt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Sr + Qo[t];
}
function Yo(t, e) {
  const n = new Array(yr).fill(0);
  return Tr[t].forEach((r, i) => {
    const o = e[r];
    if (typeof o != "number" || !Number.isFinite(o))
      throw new Error(`Missing lane parameter value: ${t}.${r}`);
    n[i] = o;
  }), n;
}
const xe = "lane.v1", Xe = "laneTopology", ke = "laneSlotParams", Dt = "laneSlotParamValue", Ar = "laneOutputControl", wt = 16, Zo = 8, Er = 4, ei = 3, xr = Jt * Sr, Rr = 4, ti = 4, ni = xr, ri = xr + Rr, oi = 0, ii = 1, ai = 2, si = 3, ci = 4, li = 5;
function ui(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Er)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Zo;
}
const _t = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Ye = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), di = new Map(
  Object.entries(Ye).map(([t, e]) => [e, t])
), Nt = "runtimeState";
function Or(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const ve = (t) => ({ kind: "ok", value: t }), De = (t) => ({ kind: "error", message: t }), ae = (t) => typeof t == "object" && t !== null && !Array.isArray(t);
function Ze(t) {
  if (t === null || typeof t == "boolean" || typeof t == "string") return t;
  if (typeof t == "number") return Number.isFinite(t) ? t : void 0;
  if (Array.isArray(t)) {
    const r = [];
    for (const i of t) {
      const o = Ze(i);
      if (o === void 0) return;
      r.push(o);
    }
    return Object.freeze(r);
  }
  if (!ae(t)) return;
  const e = Object.getPrototypeOf(t);
  if (e !== Object.prototype && e !== null) return;
  const n = {};
  for (const [r, i] of Object.entries(t)) {
    const o = Ze(i);
    if (o === void 0) return;
    n[r] = o;
  }
  return Object.freeze(n);
}
function we(t, e) {
  if (Object.is(t, e)) return !0;
  if (Array.isArray(t) || Array.isArray(e))
    return Array.isArray(t) && Array.isArray(e) && t.length === e.length && t.every((o, a) => we(o, e[a]));
  if (!ae(t) || !ae(e)) return !1;
  const n = t, r = e, i = Object.keys(n);
  return i.length === Object.keys(r).length && i.every((o) => Object.hasOwn(r, o) && we(n[o], r[o]));
}
function fi(t) {
  const e = ae(t) ? Ze(t) : void 0;
  return e !== void 0 && ae(e) ? ve(e) : De("Preset values must be an object of JSON values.");
}
function Mr(t) {
  if (!ae(t) || typeof t.id != "string" || t.id.length === 0 || typeof t.name != "string" || t.name.trim().length === 0)
    return De("A preset needs a non-empty id and name.");
  const e = fi(t.values);
  return e.kind === "ok" ? ve(Object.freeze({ id: t.id, name: t.name, values: e.value })) : e;
}
const mi = {
  parse(t) {
    if (!ae(t) || t.version !== 1 || !Array.isArray(t.presets)) return De("Expected a version 1 preset library.");
    const e = [];
    for (const n of t.presets) {
      const r = Mr(n);
      if (r.kind === "error") return r;
      if (e.some((i) => i.id === r.value.id)) return De(`Preset id "${r.value.id}" appears twice.`);
      e.push(r.value);
    }
    return ve(Object.freeze({ version: 1, presets: Object.freeze(e) }));
  },
  encode: (t) => t,
  equals: (t, e) => we(t, e)
}, Sn = {
  parse: (t) => t === null ? ve(null) : Mr(t),
  encode: (t) => t,
  equals: (t, e) => we(t, e)
};
function kr(t, e) {
  if (t.kind === "parameter")
    return typeof e == "number" && Number.isFinite(e) ? ve(e) : De("Expected a finite number.");
  const n = t.codec.parse(e);
  return n.kind === "ok" ? ve(t.codec.encode(n.value)) : n;
}
function hi(t, e, n) {
  if (e !== void 0 && !t.some((o) => o.id === e))
    throw new Error(`The initial preset "${e}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = zo(n), i = /* @__PURE__ */ new Set();
  for (const o of t) {
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
      const c = kr(s, o.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function pi(t = {}) {
  const e = Object.freeze((t.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = t, r = Object.freeze({
    ...ie({ codec: mi, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: e,
    [mr]: (a) => hi(e, n, a)
  }), i = ie({ codec: Sn, initial: null, preset: !1 }), o = e.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [hr]: (a) => Sn.parse({ id: o.id, name: o.name, values: gi(a, o) })
    })
  };
}
const Tn = /* @__PURE__ */ new WeakMap();
function gi(t, e) {
  let n = Tn.get(e);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(e.values)) {
      const a = t[i], s = a && kr(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), Tn.set(e, n);
  }
  return n;
}
const bi = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function vi(t) {
  return {
    // Slots a plugin update removed are dropped and new slots start empty, so older projects still load.
    parse(e) {
      if (typeof e != "object" || e === null || Array.isArray(e)) return { kind: "error", message: "Expected snapshot slots." };
      const n = {};
      for (const r of t) {
        const i = Object.hasOwn(e, r) ? Reflect.get(e, r) : void 0;
        if (i == null) {
          n[r] = null;
          continue;
        }
        const o = typeof i == "object" ? Ze(Reflect.get(i, "values")) : void 0;
        if (typeof o != "object" || o === null || Array.isArray(o)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: o });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (e) => e,
    equals: (e, n) => we(e, n)
  };
}
function Ii(t) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (e) => e === null || typeof e == "string" ? { kind: "ok", value: typeof e == "string" && t.includes(e) ? e : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (e) => e,
    equals: Object.is
  };
}
function yi(t = {}) {
  const e = Object.freeze([...t.slots ?? bi]);
  if (e.length === 0 || e.some((r) => typeof r != "string" || r.length === 0) || new Set(e).size !== e.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(e.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...ie({ codec: vi(e), initial: n, history: !1, preset: !1 }), slots: e }),
    activeSnapshot: ie({ codec: Ii(e), initial: null, preset: !1 })
  };
}
const Z = 2048, _e = Z + 3, An = 20, Dr = "MSEG 1";
function wr(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function _r(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ne(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Si(t) {
  return _r(Number.isFinite(t) ? t : 0, -An, An);
}
function se(t) {
  return _r(Number.isFinite(t) ? t : 0, 0, 1);
}
function Nr(t = Dr) {
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
function Ti(t, e, n) {
  const r = wr(t);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = se(i)), {
    x: i,
    y: se(Number(r.y)),
    curvePower: Si(Number(r.curvePower))
  };
}
function Xt(t = Nr()) {
  const e = wr(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Ti(i, o, n.length));
  if (!Ne(r[0].x, 0) || !Ne(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Dr,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Ai(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function Ei(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Ne(e, i.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && Ne(t[o + 1].x, e); )
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
function xi(t, e) {
  const n = se(Number(e)), r = Ei(t, n);
  if (r.laterPointWins || Ne(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = se(Ai(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Ri(t, e) {
  return xi(Xt(t).points, e);
}
function Oi(t) {
  const e = new Float32Array(_e);
  return Cr(t, e), e;
}
function Cr(t, e) {
  if (e.length !== _e) throw new Error("Invalid MSEG destination length.");
  const n = Xt(t);
  for (let r = 0; r < Z; r += 1) {
    const i = r / (Z - 1);
    e[r + 1] = Ri(n, i);
  }
  e[0] = e[1], e[Z + 1] = e[Z], e[Z + 2] = e[Z];
}
const L = (t, e) => ({ label: t, value: e });
function z(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const j = Object.freeze({
  filter: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: z(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), v = (t, e, n, r, i, o, a, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
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
function V(t, e, n) {
  return v(
    t,
    e,
    "Output Trim",
    "Trim",
    re,
    Me,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const Mi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ki = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Di = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: j.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      v("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(L), quick: !0 }),
      v("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      v("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      v("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      V("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: j.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      v("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Classic", 0), L("Harmonics", 1)] }),
      v("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      v("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      v("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      v("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      v("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      v("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [L("Symmetric", 0), L("Asymmetric", 1), L("Wavefold", 2)] }),
      V("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: j.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      v("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      v("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      v("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      v("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      v("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      V("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: j.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      v("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(L) }),
      v("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(L) }),
      v("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      v("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      v("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      v("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      v("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      V("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: j.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      v("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      v("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      v("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      v("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      v("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      V("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: j.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      v("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      v("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      v("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Mi.map(L) }),
      v("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      v("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      v("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      v("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      v("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      V("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: j.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      v("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      v("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      v("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ki.map(L) }),
      v("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      v("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      v("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      V("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: j.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      v("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      v("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      v("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      v("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      V("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], st = Di, Lr = Object.freeze(
  st.flatMap((t) => t.parameters)
);
new Map(
  Lr.map((t) => [t.endpointID, t])
);
function wi(t) {
  const e = st.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Pr() {
  return Lr;
}
function Yt(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const A = ["A", "B", "C"], Zt = [
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
], _i = [
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
], le = Object.freeze([
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
  ...A.flatMap((t) => Zt.map(
    (e) => `osc${t}.${e}`
  )),
  ..._i
]);
new Set(
  A.flatMap((t) => Zt.map(
    (e) => `osc${t}.${e}`
  ))
);
const Fr = Object.freeze(
  Ni.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Ci = Pr().filter(
  (t) => t.modulationTargetIndex !== null
), Li = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function en(t) {
  const e = Pi(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Pi(t) {
  const e = Li.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Fi = [
  ...Ci.map((t) => ({
    kind: en(Yt(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Ur = Object.freeze(
  Fi.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), G = Object.freeze([
  ...Fr,
  ...Ur
]), qe = le.length, Br = Fr.length, ct = Ur.length, Ui = qe * G.length, Bi = new Map(le.map((t) => [t.id, t])), $r = new Map(le.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Ie = new Map(G.map((t) => [t.kind, t]));
function $i() {
  if (qe !== 14 || Br !== 59 || ct !== 47 || Ui !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = le.filter((r) => r.group === t).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = G.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Bi.size !== qe || $r.size !== qe || Ie.size !== G.length)
    throw new Error("Modulation identities must be unique");
}
$i();
function Kr(t, e) {
  const n = $r.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function tn(t) {
  return typeof t != "string" ? null : Ie.has(t) ? t : null;
}
function Ki(t) {
  const e = tn(t);
  return e !== null && Ie.get(e)?.group === "voice" ? e : null;
}
function nn(t) {
  const e = tn(t);
  return e !== null && Ie.get(e)?.group === "rack" ? e : null;
}
function zr(t) {
  const e = Ie.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function jr(t) {
  const e = Ie.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function zi(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Vr = 4, ji = Vr * ct, Vi = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Hi = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ue(t) {
  if (typeof t != "string")
    return null;
  const e = Hi.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Vi.get(n);
  if (r === void 0)
    return null;
  const i = e[3];
  return r.includes(i) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function rn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Hr(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Wr(t) {
  if (t === null)
    return null;
  const e = Hr(t) - 1;
  return e > Vr ? null : e * ct + jr(rn(t));
}
const Wi = 0, ee = 2;
function Ct(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function qi(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Gi(...t) {
  return { ...Nr(...t), format: "cosimo.mseg.shape" };
}
function Lt(...t) {
  return { ...Xt(...t), format: "cosimo.mseg.shape" };
}
function En(t) {
  return JSON.stringify(Lt(t));
}
function xn(t, e) {
  return En(t) === En(e);
}
function Ji(t) {
  const e = Number(t);
  return qi(
    Number.isFinite(e) ? e : 1,
    Wi,
    ee
  );
}
function Pt() {
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
function Qi(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Ct(t), n = se(Number(e.startX)), r = se(Number(e.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function Xi(t = Pt()) {
  const e = Ct(t), n = Ct(e.rate), r = Number(n.seconds), i = e.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Ji(Number.isFinite(r) ? r : 1)
    },
    loop: Qi(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
const dt = "modulationProgram", Yi = "modulationAmount", qr = le.filter((t) => t.group === "voice").length, Gr = le.filter((t) => t.group === "macro").length, et = Br, Zi = ct, tt = Zi + ji, te = qr * et, me = Gr * et, ea = qr * tt, ta = Gr * tt, Y = 512, de = 256, Jr = te + me;
function na(t) {
  const e = Kr(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function ra(t) {
  const e = Ki(t);
  return e === null ? null : zr(e);
}
function Qr(t) {
  const e = ra(t.targetKind), n = nn(t.targetKind);
  let r = n === null ? void 0 : jr(n);
  if (r === void 0) {
    const a = Wr(
      ue(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Kr(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const m = s * et + e;
      return {
        path: "macroVoice",
        cellIndex: m,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: te + m
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * tt + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const i = na(t);
  if (e !== null) {
    const a = i * et + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: i,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const o = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: i * tt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Xr(t) {
  return ue(t.targetKind) !== null ? null : Qr(t).articulationCellIndex;
}
function oa(t) {
  if (nn(t.targetKind) !== null)
    return !1;
  const e = ue(t.targetKind);
  return e !== null && Wr(e) === null;
}
function ia(t) {
  return {
    ...Qr(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Yr(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (oa(n))
      continue;
    const r = ia(n), i = e[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return e;
}
function aa(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function he(t) {
  return [...t.values()].filter(aa).sort((e, n) => e.cellIndex - n.cellIndex);
}
function $e(t, e, n, r, i) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function ft(t) {
  const e = Yr(t), n = he(e.voice), r = he(e.macroVoice), i = he(e.voiceRack), o = he(e.macroRack), a = Array.from({ length: te }, () => 0), s = Array.from({ length: te }, () => 0), c = Array.from({ length: te }, () => 0), m = Array.from({ length: te }, () => 0), l = Array.from({ length: te }, () => 0);
  $e(n, a, s, c, m);
  const d = Array.from({ length: me }, () => 0), u = Array.from({ length: me }, () => 0), f = Array.from({ length: me }, () => 0), b = Array.from({ length: me }, () => 0), I = Array.from({ length: me }, () => 0);
  if ($e(
    r,
    d,
    u,
    f,
    b
  ), i.length > Y || o.length > de)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${Y}), ${o.length} macro-rack (max ${de})`
    );
  const p = Array.from({ length: Y }, () => 0), y = Array.from({ length: Y }, () => 0), R = Array.from({ length: Y }, () => 0), h = Array.from({ length: Y }, () => 0), S = Array.from({ length: Y }, () => 0), x = Array.from({ length: ea }, () => 0);
  $e(
    i,
    p,
    y,
    R,
    h
  );
  const P = Array.from({ length: de }, () => 0), J = Array.from({ length: de }, () => 0), Q = Array.from({ length: de }, () => 0), X = Array.from({ length: de }, () => 0), Se = Array.from({ length: ta }, () => 0);
  $e(
    o,
    P,
    J,
    Q,
    X
  );
  for (const N of e.voice.values()) l[N.cellIndex] = N.amount;
  for (const N of e.macroVoice.values()) I[N.cellIndex] = N.amount;
  for (const N of e.voiceRack.values()) x[N.cellIndex] = N.amount;
  for (const N of e.macroRack.values()) Se[N.cellIndex] = N.amount;
  for (let N = 0; N < i.length; N += 1) {
    const hn = i[N];
    if (hn === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    S[N] = hn.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: m,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: u,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: b,
    macroVoiceRouteAmounts: I,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: p,
    voiceRackRouteSources: y,
    voiceRackRouteTargets: R,
    voiceRackRoutePolarities: h,
    voiceRackRouteReducers: S,
    voiceRackRouteAmounts: x,
    macroRackRouteCount: o.length,
    macroRackRouteCells: P,
    macroRackRouteSources: J,
    macroRackRouteTargets: Q,
    macroRackRoutePolarities: X,
    macroRackRouteAmounts: Se
  };
}
const sa = ["voice", "macroVoice", "voiceRack", "macroRack"], ca = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Rn(t) {
  return Yr(t);
}
function la(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function ua(t, e) {
  if (t === null)
    return [{ endpointID: dt, value: ft(e) }];
  const n = Rn(t), r = Rn(e), i = [];
  for (const o of sa) {
    const a = he(n[o]), s = he(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: dt, value: ft(e) }];
    for (let c = 0; c < s.length; c += 1) {
      const m = a[c], l = s[c];
      if (m === void 0 || l === void 0 || !la(m, l))
        return [{ endpointID: dt, value: ft(e) }];
      m.amount !== l.amount && i.push({
        endpointID: Yi,
        value: {
          pathKind: ca[o],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return i;
}
function ye(t) {
  return { _tag: "ok", value: t };
}
function Re(t) {
  return { _tag: "err", error: t };
}
function da(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function fa(t) {
  throw new Error(t ?? "Invariant violated");
}
const ma = "globalTune", ha = "globalTuneSemitones", H = -24, Te = 24, On = 0, Zr = -48, eo = 48, Ft = -48, to = 6, on = 0, Mn = (on - Ft) / (to - Ft), Oe = Object.freeze({
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
}), fe = 241;
function pa(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function mt(t) {
  return Oe.minimumHz * Math.pow(
    Oe.maximumHz / Oe.minimumHz,
    pa(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: fe }, (t, e) => {
    const n = e / (fe - 1), r = mt(n), i = mt(
      Math.max(0, e - 0.5) / (fe - 1)
    ), o = mt(
      Math.min(fe - 1, e + 0.5) / (fe - 1)
    );
    return {
      centerHz: r,
      lowHz: e === 0 ? Oe.minimumHz : i,
      highHz: e === fe - 1 ? Oe.maximumHz : o
    };
  })
);
const ga = "voiceEnhancerFrequency", ba = "voiceEnhancerQ", va = "voiceEnhancerAmount", Ia = "voiceEnhancerFrequencyOctaves", ya = "voiceEnhancerQ", Sa = "voiceEnhancerAmount", no = "voice.enhancerFrequency", Ta = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: ga,
    targetKind: Ia,
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
    endpointID: ba,
    targetKind: ya,
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
    endpointID: va,
    targetKind: Sa,
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
function kn(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function Aa(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Ke(t, e, n, r, i = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Ea = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults,
      // 1000 Hz and Q 0.707107, so an instance sounds the same whether or
      // not its editor is open.
      Ke("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ke("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's filterMix default 1.0.
      Ke("mix", "Mix", 100, 100),
      Ke("drive", "Drive", 15, 0)
    ]
  }
], Dn = 1e-6;
function U(t, e) {
  if (!Number.isFinite(t) || t < -Dn || t > 1 + Dn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function nt(t, e) {
  return U(t / 100, `${e} catalog percentage`);
}
function Pe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function xa(t) {
  return 20 * 1e3 ** t;
}
function Ra(t) {
  return U(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Oa(t) {
  return 0.1 * 200 ** t;
}
function Ma(t) {
  return U(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ka(t) {
  return t;
}
function Da(t) {
  return U(t, "filterMix endpoint conversion");
}
function be(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function wa(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: be("filterCutoff", xa, Ra),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: be("filterQ", Oa, Ma),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: be("filterMix", ka, Da),
        // Articulations do not own Mix: capturing it would extend
        // the persisted articulation schema.
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
function ro(t) {
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
      return da(t);
  }
}
function _a(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Na(t, e) {
  const n = Pe(t.moduleId, e.id), r = ro(e.format), i = wa(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: nt(e.defaultPercent, n),
    initialValue: nt(e.initialPercent, n),
    format: r,
    modAmount: _a(r),
    binding: i.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Ca = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Mn * 100, defaultPercent: Mn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function La(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Pa(t, e) {
  const n = `osc${t}`, r = Pe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: nt(e.defaultPercent, r),
    initialValue: nt(e.initialPercent, r),
    format: ro(e.format),
    modAmount: La(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Fa = Object.freeze(
  A.flatMap((t) => Ca.map((e) => Pa(t, e)))
), Ua = Object.freeze({
  targetId: Pe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: U(
    (On - H) / (Te - H),
    "Global Tune default"
  ),
  initialValue: U(
    (On - H) / (Te - H),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Te },
  modAmount: {
    min: Zr,
    max: eo,
    unit: "st",
    digits: 2
  },
  binding: be(
    ma,
    (t) => H + (Te - H) * t,
    (t) => U(
      (t - H) / (Te - H),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: ha
});
function Ba(t) {
  const e = Pe("voice-enhancer", t.key), n = U(
    kn(t, t.initial),
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
    binding: be(
      t.endpointID,
      (r) => Aa(t, r),
      (r) => U(
        kn(t, r),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const $a = Object.freeze(
  Object.values(Ta).map(Ba)
), Ka = Object.freeze([
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
function za(t) {
  const e = Pe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, r = (o) => t.min + n * o, i = (o) => U(
    (o - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: i(t.initial),
    initialValue: i(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: be(t.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const ja = Object.freeze(
  Ka.map(za)
), Va = Object.freeze([
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
function Ha(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function ht(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? Go(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return U(n, `${t.endpointID} endpoint conversion`);
}
function Wa(t, e) {
  return t.valueKind === "effect-output-trim-db" ? Jo(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function qa(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Ga(t) {
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
function Ja(t) {
  const e = Ha(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: ht(t, t.initial),
    initialValue: ht(t, t.initial),
    format: qa(t),
    modAmount: Ga(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Wa(t, n),
      fromEngine: (n) => ht(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : en(Yt(t))
  });
}
const an = Object.freeze(
  [
    ...st.flatMap((t) => t.parameters.map(Ja)),
    ...Va,
    Ua,
    ...$a,
    ...Fa,
    ...ja,
    ...Ea.flatMap(
      (t) => t.parameters.map(
        (e) => Na(t, e)
      )
    )
  ]
), Qa = new Map(
  an.map((t) => [t.targetId, t])
), oo = an.filter(
  (t) => t.modulationTargetKind !== null
), Ut = new Map(
  oo.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Qa.size !== an.length)
  throw new Error("Target descriptor IDs must be unique");
if (oo.length !== G.length || Ut.size !== G.length || G.some((t) => Ut.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function pt(t) {
  const e = Ut.get(t);
  return e === void 0 ? fa(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  st.map((t) => [t.id, t.label])
);
function Xa(t) {
  const e = Hr(t);
  return e === 1 ? "" : ` ${e}`;
}
function Ya(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = pt(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = ue(t);
  if (n !== null) {
    const r = pt(rn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Xa(n)} ${r.label.toUpperCase()}`;
  }
  return pt(t).label.toUpperCase();
}
const ne = "modulation.v6", io = 6, Fe = 3, pe = 3, Za = 4, wn = "modulationMsegBuffer", es = "modulationMsegPlayback", ao = 4, ts = ["MSEG 1", "MSEG 2", "MSEG 3"], so = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], ns = ["Env 1", "Env 2", "Env 3"], rs = 1e-3, O = 10, os = 0.1, is = 20, _n = 10 - 0.1, as = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: is - os },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Zr,
    max: eo
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
  mseg1Rate: { min: -ee, max: ee },
  mseg2Rate: { min: -ee, max: ee },
  mseg3Rate: { min: -ee, max: ee },
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
  voiceEnhancerQ: { min: -_n, max: _n },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, ss = Pr().filter((t) => t.modulationTargetIndex !== null), cs = new Map(
  ss.map((t) => [
    en(Yt(t)),
    t
  ])
);
class gt extends Error {
  name = "ModulationStateParseError";
}
const ls = {
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
le.map((t) => ({
  value: t.id,
  label: ls[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const us = G.map((t) => ({
  value: t.kind,
  label: Ya(t.kind)
}));
us.filter((t) => !fs(t.value));
function ds(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function sn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function bt(t, e) {
  const n = Number(t);
  return sn(Number.isFinite(n) ? n : e, rs, O);
}
function fs(t) {
  return nn(t) !== null;
}
function ms(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function hs(t) {
  const e = ue(t);
  return e !== null ? rn(e) : t;
}
function ps(t) {
  const e = hs(t);
  if (ue(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = cs.get(e);
  return n !== void 0 ? ms(n) : as[zi(e)];
}
function gs(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function bs(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function vs(t, e) {
  const n = ps(t), r = Number(e);
  return sn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Is(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function ys(t) {
  return Is(t) ?? "mseg";
}
function Ss(t) {
  const e = tn(t);
  return e !== null ? e : ue(t) !== null ? t : null;
}
function Ts(t) {
  return Ss(t) ?? "oscA.wavetablePosition";
}
function As(t, e) {
  const n = so[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Es(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? Fe : t === "macro" ? ao : Za;
  return sn(Number.isFinite(n) ? n : 1, 1, r);
}
function ge(t) {
  return {
    name: ns[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function co(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = ge(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: bt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: bt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: se(n.sustain ?? r.sustain),
    releaseSeconds: bt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function xs(t, e = 0) {
  return { name: co(t, e).name };
}
function Rs(t, e, n, r) {
  const i = Number(t.amount);
  return {
    id: gs(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Es(n, t.sourceSlot),
    polarity: bs(t.polarity),
    targetKind: r,
    amount: vs(r, i),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Os(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, i = ys(r.sourceKind), o = Ts(r.targetKind);
  return Rs(r, e, i, o);
}
function Ms(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function ks(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => Os(n, r));
}
function Ds(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const i = Ms(r);
    if (e.has(r.id) || n.has(i))
      return !1;
    e.add(r.id), n.add(i);
  }
  return !0;
}
function Bt(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => Bt(a, e[s]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => ds(r, a) && Bt(n[a], r[a]));
}
function lo(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = Gi(ts[e] ?? `MSEG ${e + 1}`), i = Lt(n.shapeA ?? r), o = Xi({
    ...Pt(),
    ...n.playback ?? {},
    rate: Pt().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: Lt(n.shapeB ?? i),
    playback: s
  };
}
function Ce() {
  return {
    format: "cosimo.modulation",
    version: io,
    msegSlots: Array.from({ length: Fe }, (t, e) => lo({}, e)),
    envelopeSlots: Array.from({ length: pe }, (t, e) => ({
      name: ge(e).name
    })),
    routes: [],
    macroNames: so.slice()
  };
}
function ws(t = Ce()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: io,
    msegSlots: Array.from({ length: Fe }, (o, a) => lo(n[a], a)),
    envelopeSlots: Array.from({ length: pe }, (o, a) => xs(r[a], a)),
    routes: ks(e.routes),
    macroNames: Array.from(
      { length: ao },
      (o, a) => As(i[a], a)
    )
  };
}
function vt(t) {
  const e = rt(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function rt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return Re(new gt("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return Re(new gt("Expected valid modulation JSON"));
    }
  }
  const n = ws(e);
  return !Bt(e, n) || !Ds(n.routes) ? Re(new gt("Expected the current modulation schema")) : ye(n);
}
function _s(t, e) {
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
function Nn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Oi(n))
  };
}
function Ns(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Cn(t, e = null, n) {
  const r = [];
  for (let i = 0; i < Fe; i += 1) {
    const o = t.msegSlots[i], a = e?.msegSlots[i];
    (a === void 0 || !xn(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: wn,
      value: Nn(i, 0, o.shapeA)
    }), (a === void 0 || !xn(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: wn,
      value: Nn(i, 1, o.shapeB)
    }), (a === void 0 || !Ns(a.playback, o.playback)) && r.push({
      endpointID: es,
      value: _s(i, o.playback)
    });
  }
  return r.push(...ua(e?.routes ?? null, t.routes)), r;
}
function uo(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) uo(e);
    Object.freeze(t);
  }
}
const Cs = {
  parse(t) {
    const e = rt(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (uo(e.value), { kind: "ok", value: e.value });
  },
  encode: vt,
  equals: (t, e) => vt(t) === vt(e)
}, Ls = [
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
], Ps = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function Fs(t) {
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
function Us(t, e, n) {
  const r = n.articulationParameterID === null ? null : `osc${t}.${n.articulationParameterID}`;
  return Object.freeze({
    controlID: n.controlID,
    // SAFETY: both interpolated pieces come from closed unions above, so
    // their concatenation is exactly one OscillatorControlEndpointID.
    endpointID: `osc${t}${n.endpointSuffix}`,
    oscillatorIndex: e,
    articulationParameterID: r
  });
}
function Bs(t, e, n) {
  const r = `osc${t}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${t}.${Fs(n)}`,
    runtimeTargetIndex: zr(r),
    oscillatorIndex: e
  });
}
function $s(t, e) {
  const n = Object.freeze(Ls.map(
    (o) => Us(t, e, o)
  )), r = Object.freeze(Zt.map(
    (o) => Bs(t, e, o)
  )), i = Object.freeze(n.flatMap(
    (o) => o.articulationParameterID === null ? [] : [o.articulationParameterID]
  ));
  return Object.freeze({
    id: t,
    oscillatorIndex: e,
    tableStatus: Object.freeze({ endpointID: "runtimeState", oscillatorIndex: e }),
    controls: n,
    modulationTargets: r,
    articulationParameterIDs: i
  });
}
const Ge = Object.freeze(
  Ps.map(({ id: t, oscillatorIndex: e }) => $s(t, e))
);
function Ks() {
  if (Ge.length !== A.length || Ge.some((e, n) => e.id !== A[n] || e.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const t = Ge.flatMap(
    (e) => e.controls.map((n) => n.endpointID)
  );
  if (new Set(t).size !== t.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
Ks();
const It = "articulationSnapshot", M = 128, Ln = 48, zs = 1e6, _ = -1, yt = [
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
function cn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function St(t) {
  return cn(Number.isFinite(t) ? t : 0, 0, 1);
}
function C(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(t);
  return cn(Number.isFinite(i) ? i : e, n, r);
}
function w(t, e, n, r) {
  return cn(Math.round(C(t, e)), n, r);
}
function fo(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Tt() {
  return Array.from({ length: M }, () => _);
}
function js(t) {
  const e = w(t, 0, 0, M - 1), n = yt[e % yt.length], r = Math.floor(e / yt.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function Vs() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: on,
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
function Hs(t) {
  const e = Vs(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: C(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: C(n.pan, e.pan, -1, 1),
    octave: w(n.octave, e.octave, -4, 4),
    semitone: w(n.semitone, e.semitone, -12, 12),
    fineCents: C(n.fineCents, e.fineCents, -100, 100),
    volumeDb: C(
      n.volumeDb,
      e.volumeDb,
      Ft,
      to
    ),
    mute: w(n.mute, e.mute, 0, 1),
    solo: w(n.solo, e.solo, 0, 1),
    warpMode: w(n.warpMode, e.warpMode, 0, 4),
    warpAmount: C(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: w(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: C(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: C(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: C(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: w(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: C(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: C(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: C(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: C(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: C(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: w(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: w(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: w(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: C(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: C(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      St(Number(r[0])),
      St(Number(r[1])),
      St(Number(r[2]))
    ]
  };
}
function Ws(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: C(e.amount, 0, -48, 48)
  } : null;
}
function qs(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Ws).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Hs(e.parameters),
    envelopes: [0, 1, 2].map((i) => co(
      Array.isArray(e.envelopes) ? e.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Gs(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = w(n.runtimeSlot, e, 0, M - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : js(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: qs(n.snapshot)
  };
}
function Js(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: w(n.note, 0, 0, M - 1),
    articulationId: r
  } : null;
}
function Qs(t, e, n, r, i) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = w(o.min, i, i, M - 1), c = w(o.max, s, i, M - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function Pn(t, e, n, r) {
  const i = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = Qs(
      i[s],
      e,
      s,
      n,
      r
    );
    !c || o.has(c.id) || (o.add(c.id), a.push(c));
  }
  return a;
}
function Xs(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Js(o, e);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function Ys(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < M; c += 1) {
    const m = Gs(n[c], c);
    !m || r.has(m.runtimeSlot) || i.has(m.id) || (r.add(m.runtimeSlot), i.add(m.id), o.push(m));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((c) => c.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: fo(e.activeTriggerMode),
    slots: o,
    chainAssignments: Pn(e.chainAssignments, s, "chain", 0),
    keyAssignments: Xs(e.keyAssignments, s),
    velocityAssignments: Pn(e.velocityAssignments, s, "velocity", 1)
  };
}
function Fn(t) {
  const e = (n) => A.map(() => n);
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
    volumeDbs: e(on),
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
    msegMorphs: Array.from({ length: Fe }, () => 0),
    routeAmounts: Array.from({ length: Jr }, () => 0),
    envelopeAttackSeconds: Array.from({ length: pe }, (n, r) => ge(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: pe }, (n, r) => ge(r).decaySeconds),
    envelopeSustain: Array.from({ length: pe }, (n, r) => ge(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: pe }, (n, r) => ge(r).releaseSeconds)
  };
}
function Un(t, e, n) {
  for (const r of e) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        t[o] === _ && (t[o] = i);
  }
}
function Zs(t) {
  const e = Ys(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = Tt(), i = Tt(), o = Tt();
  Un(r, e.chainAssignments, n), Un(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== _ || (i[a.note] = s);
  }
  return o[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function mo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Zs(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: fo(e.activeMode),
    chain: Array.from({ length: M }, (n, r) => w(e.chain?.[r], _, _, M - 1)),
    key: Array.from({ length: M }, (n, r) => w(e.key?.[r], _, _, M - 1)),
    velocity: Array.from({ length: M }, (n, r) => r === 0 ? _ : w(e.velocity?.[r], _, _, M - 1))
  });
}
function ec(t, e) {
  const n = mo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const F = "articulations.v4", ln = [
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
], un = [
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
], ho = [
  ...A.flatMap((t) => ln.map(
    (e) => `osc${t}.${e}`
  )),
  ...un
];
class po extends Error {
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
  return Re(new po("malformed", t));
}
function Ue(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function dn(t, e, n) {
  const r = new Set(e);
  for (const i of e)
    if (!Object.hasOwn(t, i))
      return `${n} is missing field "${i}"`;
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return `${n} has a non-string field key`;
    if (!r.has(i))
      return `${n} has unexpected field "${i}"`;
  }
  return null;
}
function ot(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < M;
}
function tc(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function nc(t) {
  return ho.some((e) => e === t);
}
function Bn(t, e) {
  if (!Ue(t))
    return T(`${e} must be an object`);
  const n = dn(t, ["min", "max"], e);
  return n !== null ? T(n) : ot(t.min) ? ot(t.max) ? t.min > t.max ? T(`${e}.min must be less than or equal to ${e}.max`) : ye({ min: t.min, max: t.max }) : T(`${e}.max must be an integer in 0..127`) : T(`${e}.min must be an integer in 0..127`);
}
function rc(t, e) {
  if (!Ue(t))
    return T(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return T(`${e} has a non-string parameter id`);
    if (!nc(r))
      return T(`${e} has unknown parameter id "${r}"`);
    const i = t[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return T(`${e}.${r} must be a finite number`);
    n[r] = i;
  }
  return ye(n);
}
function go(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function bo() {
  return {};
}
function oc(t, e, n) {
  if (!Ue(t))
    return T(`${e} must be an object`);
  const r = bo();
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return T(`${e} has a non-string route id`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Ln)
      return T(
        `${e}.${i} must be a finite route amount within ±${Ln}`
      );
    if (!n.has(i))
      return T(`${e}.${i} does not name a current articulable mapping`);
    go(r, i, o);
  }
  return ye(r);
}
function ic(t, e, n) {
  const r = `slots[${e}]`;
  if (!Ue(t))
    return T(`${r} must be an object`);
  const i = dn(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return T(i);
  if (typeof t.id != "string")
    return T(`${r}.id must be a string`);
  if (!ot(t.runtimeSlot))
    return T(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return T(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return T(`${r}.color must be a string`);
  if (!ot(t.key))
    return T(`${r}.key must be an integer in 0..127`);
  const o = Bn(t.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Bn(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = rc(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = oc(
    t.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : ye({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: c.value
  });
}
function ac(t) {
  const e = {};
  for (const n of ho) {
    if (!Object.hasOwn(t, n))
      continue;
    const r = t[n];
    r !== void 0 && (e[n] = r);
  }
  return e;
}
function sc(t) {
  const e = bo();
  for (const [n, r] of Object.entries(t))
    go(e, n, r);
  return e;
}
const cc = Object.fromEntries(
  ln.map((t, e) => [t, 2 ** e])
), lc = Object.fromEntries(
  un.map((t, e) => [t, 2 ** e])
);
function $n(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function uc(t, e) {
  return ln.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | cc[r] : n, 0);
}
function dc(t) {
  return un.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | lc[n] : e, 0);
}
function fc(t, e) {
  const n = (o, a) => $n(t, `osc${o}.${a}`), r = (o) => $n(t, o), i = Array.from(
    { length: Jr },
    () => zs
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: A.map((o) => uc(t, o)),
    sharedOverrideMask: dc(t),
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
function mc(t, e) {
  return t.slots.map((n) => fc(n, e));
}
function vo(t, e) {
  if (!Ue(t))
    return T("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return T('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return Re(new po(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = dn(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return T(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return T("selectedSlotId must be null or a string");
  if (!tc(t.activeTriggerMode))
    return T('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return T("slots must be an array");
  if (t.slots.length > M)
    return T(`slots must contain at most ${M} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = ic(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (i.has(c.id))
      return T(`slots[${a}].id duplicates "${c.id}"`);
    if (o.has(c.runtimeSlot))
      return T(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    i.add(c.id), o.add(c.runtimeSlot), r.push(c);
  }
  return t.selectedSlotId !== null && !i.has(t.selectedSlotId) ? T(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : ye({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function Kn(t) {
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
      overrides: ac(e.overrides),
      routeAmounts: sc(e.routeAmounts)
    }))
  };
}
function lt() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function hc(t) {
  const e = Array.from({ length: M }, () => _), n = Array.from({ length: M }, () => _), r = Array.from({ length: M }, () => _);
  for (const i of t.slots) {
    n[i.key] === _ && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      e[o] === _ && (e[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === _ && (r[o] = i.runtimeSlot);
  }
  return r[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: r
  };
}
async function pc(t, e, n, r = {}) {
  const i = t.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const o = i.reserve(e.input, e.byteLength), a = r.signal?.onAbort(() => i.cancel(o.id));
  try {
    if (n(o), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await i.commit(o.id), { cancel: () => i.cancel(o.id) };
  } catch (s) {
    throw i.cancel(o.id), s;
  } finally {
    a?.();
  }
}
const gc = 3, bc = (4 + _e) * 4, zn = "runtimeInstallAck", Io = "runtimeSyncRequest", $t = 0, vc = 8e3, it = /* @__PURE__ */ new WeakMap(), yo = 1e9;
let ze = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % yo;
function Ic(t) {
  return ze = ze % yo + 1, t === "modulation" ? -1e9 - ze : 1e9 + ze;
}
function yc(t, e) {
  const n = t, r = it.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), it.set(n, r);
}
function jn(t, e) {
  const n = t, r = it.get(n);
  r?.delete(e), r?.size === 0 && it.delete(n);
}
const Sc = [100, 250, 500, 1e3], je = { _tag: "accepted" }, Tc = { _tag: "superseded" }, Ac = { _tag: "stopped" }, Vn = { _tag: "transport-timeout" };
function Ec(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, m = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    c,
    m
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof m != "number" || i < 0 || o < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: m
  };
}
function xc(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Hn {
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
  constructor(e, n) {
    this.#i = e, this.#t = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#m = r && r.length > 0 ? r : [...Sc], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? vc)
    );
  }
  start() {
    if (!this.#r) {
      yc(this.#i, this.#t);
      try {
        this.#f += 1, this.#r = !0, this.#a = null, this.#c.clear(), this.#i.addEndpointListener?.(zn, this.#T);
      } catch (e) {
        throw this.#r = !1, jn(this.#i, this.#t), e;
      }
    }
  }
  stop() {
    if (this.#r) {
      this.#r = !1;
      for (const e of this.#u) e();
      this.#i.removeEndpointListener?.(zn, this.#T), jn(this.#i, this.#t), this.#o.clear(), this.#a = null, this.#c.clear(), this.#y();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#n) {
      for (const r of this.#u) r();
      this.#n = n, this.#a = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#o.clear(), this.#s += 1, this.#y();
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
    return this.#r ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#A(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
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
      for (const a of e) {
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
      return o ?? je;
    } finally {
      this.#h = !1;
    }
  }
  #E(e) {
    return this.#t === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #x(e, n) {
    const r = this.#E(e);
    return this.#t === "modulation" ? r >= n : r <= n;
  }
  #R() {
    const e = this.getAcceptedFrontier();
    return this.#t === "modulation" ? e + 1 : e - 1;
  }
  async #A(e, n) {
    if (this.#a === e)
      return je;
    const r = Ic(this.#t);
    this.#c.add(r);
    const i = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#l(e, n);
        if (a)
          return a;
        if (this.#a === e)
          return je;
        const s = i - Date.now();
        if (s <= 0)
          return Vn;
        const c = this.#s;
        this.#v(r), await this.#I(
          c,
          Math.min(this.#b(o), s)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #O(e, n, r) {
    const i = this.#R(), o = /* @__PURE__ */ new Set();
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
    const m = async () => {
      this.#l(n, r) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#M(e.endpointID, xc(e.value, n, i)));
    };
    try {
      let l = 0, d = 0, u = this.#d;
      for (await m(); ; ) {
        const f = this.#l(n, r);
        if (f)
          return f;
        const b = this.#g(n, i, u);
        if (b !== null)
          return b;
        const I = this.#s;
        await this.#I(
          I,
          this.#b(l)
        );
        const p = this.#g(
          n,
          i,
          u
        );
        if (p !== null)
          return p;
        let y = this.#s;
        for (this.#v(i); ; ) {
          const R = this.#l(n, r);
          if (R)
            return R;
          const h = await this.#I(
            y,
            this.#b(l)
          ), S = this.#g(
            n,
            i,
            u
          );
          if (S !== null)
            return S;
          if (h && this.#e?.dspSessionId === n && this.#e.syncSerial === i) {
            if (d >= 1)
              return Vn;
            u = this.#d, await m(), d += 1, l += 1;
            break;
          }
          if (h) {
            y = this.#s;
            continue;
          }
          h || (l += 1, y = this.#s, this.#v(i));
        }
      }
    } catch (l) {
      const d = this.#l(n, r);
      if (d) return d;
      throw l;
    } finally {
      s(), this.#u.delete(s);
    }
  }
  #g(e, n, r) {
    const i = this.#e;
    if (!i || i.dspSessionId !== e)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === e ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#x(i, n) ? (this.#o.delete(n), je) : null;
  }
  #l(e, n) {
    return !this.#r || this.#f !== n ? Ac : this.#n !== e ? Tc : null;
  }
  #b(e) {
    return this.#m[Math.min(
      e,
      this.#m.length - 1
    )];
  }
  #M(e, n) {
    try {
      this.#i.sendEventOrValue?.(
        e,
        n,
        void 0,
        $t
      );
    } catch {
    }
  }
  #v(e) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          Io,
          e,
          void 0,
          $t
        );
      } catch {
      }
  }
  #k(e) {
    const n = Ec(e);
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
    this.#s += 1, this.#y();
  }
  #I(e, n) {
    return !this.#r || this.#s !== e ? Promise.resolve(!0) : new Promise((r) => {
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
  #y() {
    for (const e of [...this.#p])
      e.finish(!0);
  }
}
const Rc = 1e3, Oc = [ne, F];
function At(t, e) {
  if (t === void 0) return lt();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = vo(n, e);
  return r._tag === "ok" ? r.value : null;
}
function Wn(t) {
  return new Set(t.routes.flatMap((e) => Xr(e) === null ? [] : [e.id]));
}
function qn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function Gn(t, e) {
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
class Mc {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Hn(e, { laneKind: "modulation" }), this.articulationLane = new Hn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Ce();
  articulationBank = lt();
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
  replaceModulation(e, n) {
    if (!this.frameworkInput) throw new Error("Stored modulation input cannot accept framework replacements.");
    this.modulationState = e, this.hasModulationState = !0, this.deliveryObserver = n, this.applyRuntimeStateIfReady();
  }
  get bootKeys() {
    return this.frameworkInput ? [F] : Oc;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Nt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Nt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(e) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || e !== this.lifecycleEpoch || (this.applyBootState(br(n)), this.finishBoot());
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
    const n = e[ne], r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Ce() } : rt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${ne} is invalid; boot state was not installed.`);
      const a = e[F], s = At(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = e[F], o = At(
      i,
      Wn(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${F} is invalid; boot state was not installed.`);
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
  applyLiveStoredState(e, n) {
    if (e === ne) {
      const i = rt(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ne}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = At(n, Wn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${F}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Or(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Io, 0, void 0, $t), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? Cn(r, s, this.frameworkInput.curveCommand) : Cn(r, s), m = await this.modulationLane.sendBatch(c);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", m, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const p = Gn("modulation", m);
      p && o?.(p), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, i), d = Array.from({ length: M }, (p, y) => {
      const R = l.get(y);
      return R ? qn(R) : null;
    }), u = this.lastAppliedArticulationGeneration !== n, f = u && this.articulationLane.getAcceptedFrontier() !== 0, b = [];
    for (let p = 0; p < M; p += 1) {
      const y = l.get(p), R = d[p] !== this.lastAppliedArticulationTokens[p];
      f ? b.push({
        endpointID: It,
        value: y ?? Fn(p)
      }) : u ? y && b.push({ endpointID: It, value: y }) : R && b.push({
        endpointID: It,
        value: y ?? Fn(p)
      });
    }
    const I = await this.articulationLane.sendBatch(b);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", I, d)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = d;
        const p = hc(i);
        if (this.frameworkInput) {
          const y = await this.frameworkInput.publishTriggerConfig(p);
          if (!this.started || e !== this.lifecycleEpoch) return;
          y.kind !== "cancelled" && o?.(y);
        } else
          ec(p, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const y of b) this.lastAppliedArticulationTokens[y.value.selectorA] = void 0;
        const p = Gn("articulation", I);
        p && o?.(p);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((i) => {
      const o = Xr(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      mc(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = qn(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, i), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Rc));
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
const kc = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [F],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = Jn(t);
    return {
      apply(n, r) {
        return e.closed && (e = Jn(t)), e.apply(n, r);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function Jn(t) {
  let e = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(u) {
    const f = r;
    r = void 0, f ? f(u) : u.kind !== "cancelled" && t.report(u);
  }
  function c() {
    e || (e = !0, d.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function m(u) {
    if (u.kind !== "submitted") {
      u.kind === "failed" && u.error.kind !== "transport" && (s(u), c());
      return;
    }
    i.add(u.completion), u.completion.then((f) => {
      i.delete(u.completion), !(e || f.kind === "sent") && (s(f), c());
    }, (f) => {
      e || (c(), t.fail(f));
    });
  }
  const l = {
    addEndpointListener(u, f) {
      const b = o.get(u) ?? /* @__PURE__ */ new Map();
      b.set(f, t.listen(u, f)), o.set(u, b);
    },
    removeEndpointListener(u, f) {
      o.get(u)?.get(f)?.(), o.get(u)?.delete(f);
    },
    addStoredStateValueListener(u) {
      a.set(u, t.subscribeStored(
        F,
        (f) => u({ key: F, value: f })
      ));
    },
    removeStoredStateValueListener(u) {
      a.get(u)?.(), a.delete(u);
    },
    requestFullStoredState(u) {
      t.readStored(F).then((f) => {
        e || u({ values: { [F]: f } });
      }, (f) => t.fail(f));
    },
    sendEventOrValue(u, f) {
      e || m(t.send({ kind: "event", endpoint: u, value: f }));
    }
  }, d = new Mc(l, {
    onDefect(u) {
      c(), t.fail(u);
    },
    curveCommand: (u, f, b) => ({
      async submit({ dspSessionId: I, deliverySerial: p, signal: y }) {
        const R = await t.prepareData(
          gc + u * 2 + f,
          bc,
          (h) => {
            new Int32Array(h.buffer, h.byteOffset, 4).set([1297302855, I, p, _e]), Cr(b, new Float32Array(h.buffer, h.byteOffset + 16, _e));
          },
          y
        );
        R.kind === "failed" && (s(R), c());
      }
    }),
    async publishTriggerConfig(u) {
      const b = (await Promise.all(i)).find((p) => p.kind !== "sent");
      if (b) return b.kind === "failed" ? b : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const I = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: mo(u) });
      return I.kind === "submitted" ? I.completion : I;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(u, f) {
      if (e || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const b = ++n;
      return new Promise((I) => {
        const p = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (y) => {
          p(), I(y);
        }, d.replaceModulation(u, (y) => {
          b === n && y.kind !== "preparing" && s(y);
        }), d.start();
      });
    },
    stop: c
  };
}
const Dc = Object.freeze([
  "voice.filterCutoff",
  no,
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
]), wc = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [no]: "enhancer-frequency",
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
  Dc.map((t) => [t, Object.freeze({
    id: t,
    family: wc[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const So = 40, To = 18e3, Kt = _t.map((t) => Ye[t]), _c = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Nc = /^(parallel|split)#([1-9][0-9]*)$/;
function Be(t) {
  if (typeof t != "string")
    return null;
  const e = _c.exec(t);
  if (e === null)
    return null;
  const n = Kt.find((i) => i === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > Jt ? null : { deviceType: n, instanceNumber: r };
}
function Ao(t) {
  if (typeof t != "string")
    return null;
  const e = Nc.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? Rr : ti) ? null : { groupKind: n, unitNumber: r };
}
function oe(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Le(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function E(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Cc(t, e) {
  const n = Be(t);
  if (n === null)
    return { failure: E(`device id ${t} is not a pool instance`) };
  if (!oe(e) || !Le(e, ["params"]) || !oe(e.params))
    return { failure: E(`device ${t} must be { params }`) };
  const r = Qt(n.deviceType), i = e.params;
  if (Object.keys(i).length !== r.length || !r.every((s) => Object.hasOwn(i, s)))
    return { failure: E(`device ${t} must carry every parameter once`) };
  const a = {};
  for (const s of r) {
    const c = i[s];
    if (typeof c != "number" || !Number.isFinite(c))
      return { failure: E(`device ${t}.${s} must be a finite number`) };
    a[s] = c;
  }
  return { record: { params: a } };
}
function Lc(t, e) {
  return !oe(t) || t.kind !== "device" ? { failure: E("branches may hold device placements only") } : Le(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: E(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: E(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: E("a device placement is { kind, deviceId, enabled }") };
}
function Qn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= So && t <= To;
}
function Eo() {
  return { mix: 1, bypassed: !1 };
}
function Pc(t) {
  return !oe(t) || !Le(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function Fc(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (l) {
      const d = l instanceof Error ? l.message : String(l);
      return E(`is not valid JSON: ${d}`);
    }
  if (!oe(e) || !Le(e, ["format", "version", "output", "devices", "chain"]))
    return E("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return E("must be cosimo.lane version 2");
  if (!oe(e.devices))
    return E("devices must be an object");
  if (!Array.isArray(e.chain))
    return E("chain must be an array");
  const n = Pc(e.output);
  if (n === null)
    return E("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(e.devices)) {
    if (typeof l != "string")
      return E("device ids must be strings");
    const d = Cc(l, e.devices[l]);
    if ("failure" in d)
      return d.failure;
    r[l] = d.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const m = (l) => {
    const d = Lc(l, i);
    return "placement" in d && (o.set(
      d.placement.deviceId,
      (o.get(d.placement.deviceId) ?? 0) + 1
    ), c += 1), d;
  };
  for (const l of e.chain) {
    if (!oe(l))
      return E("chain nodes must be objects");
    if (l.kind === "device") {
      const p = m(l);
      if ("failure" in p)
        return p.failure;
      s.push(p.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return E(`unknown chain node kind ${String(l.kind)}`);
    const d = l.kind === "split", u = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"];
    if (!Le(l, u))
      return E(`a ${l.kind} group is { ${u.join(", ")} }`);
    const f = Ao(l.groupId);
    if (f === null || f.groupKind !== l.kind)
      return E(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return E(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return E(`group ${String(l.groupId)} needs a boolean enable`);
    const b = d ? ei : Er;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > b)
      return E(`group ${String(l.groupId)} needs 2..${b} branches`);
    if (d && (!Qn(l.xoverLowHz) || !Qn(l.xoverHighHz)))
      return E(`group ${String(l.groupId)} crossovers must sit in ${So}..${To} Hz`);
    if (d && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return E(`group ${String(l.groupId)} Key Track state must be finite`);
    c += 1;
    const I = [];
    for (const p of l.branches) {
      if (!Array.isArray(p))
        return E(`group ${String(l.groupId)} branches must be arrays`);
      const y = [];
      for (const R of p) {
        const h = m(R);
        if ("failure" in h)
          return h.failure;
        y.push(h.placement);
      }
      I.push(y);
    }
    s.push(d ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: l.xoverHighKeyTrackOffsetSemitones,
      branches: I
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: I
    });
  }
  for (const l of i)
    if ((o.get(l) ?? 0) !== 1)
      return E(`device ${l} must be placed exactly once`);
  return c > wt ? E(`flattens to ${c} wire entries; the topology upload holds ${wt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function Uc() {
  const t = {};
  for (const e of _t) {
    const n = Ye[e];
    t[`${n}#1`] = {
      params: Wc(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Eo(),
    devices: t,
    chain: _t.map((e) => ({
      kind: "device",
      deviceId: `${Ye[e]}#1`,
      enabled: !1
    }))
  };
}
const Xn = ["distortion#1", "delay#1", "reverb#1"];
function fn() {
  const t = Uc(), e = {};
  for (const n of Xn) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Eo(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Xn.includes(n.deviceId))
  };
}
function Bc(t) {
  if (t === void 0)
    return fn();
  const e = Fc(t);
  return e._tag === "ok" ? e.value : null;
}
function Et(t) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: t.output,
    devices: t.devices,
    chain: t.chain
  });
}
function $c(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Be(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => Kt.indexOf(e.parsed.deviceType) - Kt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function zt(t) {
  const e = Be(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Xo(e.deviceType, e.instanceNumber - 1);
}
function xo(t) {
  const e = Ao(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? ni : ri) + (e.unitNumber - 1);
}
function Kc(t) {
  const e = new Array(wt).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    e[r] = ui(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      i(zt(o.deviceId), 0, o.enabled);
      continue;
    }
    i(xo(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(zt(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function zc(t) {
  const e = new Array(yr).fill(0);
  return e[oi] = t.xoverLowHz, e[ii] = t.xoverHighHz, e[ai] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[si] = t.xoverLowKeyTrackOffsetSemitones, e[ci] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[li] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function jc(t) {
  const e = [{
    endpointID: Ar,
    value: t.output
  }];
  let n = 0;
  for (const r of $c(t)) {
    const i = Be(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    e.push({
      endpointID: qt(
        i.deviceType,
        i.instanceNumber
      ),
      value: t.devices[r.instanceId].params[B(i.deviceType)]
    }), n += 1, e.push({
      endpointID: ke,
      value: {
        slotId: zt(r.instanceId),
        deliverySerial: n,
        values: Yo(
          r.deviceType,
          t.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of t.chain)
    r.kind === "split" && (n += 1, e.push({
      endpointID: ke,
      value: {
        slotId: xo(r),
        deliverySerial: n,
        values: zc(r)
      }
    }));
  return e.push({
    endpointID: Xe,
    value: Kc(t)
  }), e;
}
function Vc(t, e, n, r) {
  const i = t.devices[e], o = Be(e);
  if (i === void 0 || o === null || !Qt(o.deviceType).includes(n) || !Number.isFinite(r))
    return null;
  const a = { ...i.params, [n]: r };
  return o.deviceType === "delay" && n === "delayTimeMode" && r >= 0.5 && (a.delayTimeKeyTrackEnabled = 0), {
    ...t,
    devices: {
      ...t.devices,
      [e]: { params: a }
    }
  };
}
function Hc(t, e) {
  let n = t;
  for (const [r, i] of Object.entries(e)) {
    const o = qo(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      Me,
      Math.max(re, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = Vc(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function Wc(t) {
  const e = di.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = wi(e).parameters;
  return Object.fromEntries(Qt(t).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function mn(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) mn(e);
    Object.freeze(t);
  }
}
const qc = {
  parse(t) {
    const e = Bc(t);
    return e ? (mn(e), { kind: "ok", value: e }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Et,
  equals: (t, e) => Et(t) === Et(e)
}, Yn = /* @__PURE__ */ new WeakMap();
function xt(t) {
  if (!Object.isFrozen(t)) return JSON.stringify(Kn(t));
  let e = Yn.get(t);
  return e === void 0 && Yn.set(t, e = JSON.stringify(Kn(t))), e;
}
const Gc = {
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
      for (const i of Reflect.get(e, "slots")) {
        if (i === null || typeof i != "object") continue;
        const o = Reflect.get(i, "routeAmounts");
        if (o !== null && typeof o == "object")
          for (const a of Object.keys(o)) n.add(a);
      }
    const r = vo(e, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (mn(r.value), { kind: "ok", value: r.value });
  },
  encode: xt,
  equals: (t, e) => t === e || xt(t) === xt(e)
}, Zn = [Ar, ke, Dt, Xe], Jc = { kind: "sent", proof: "native-publication-processed" };
const Qc = {
  eventEndpoints: Zn,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(t) {
    let e, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (u) => jc(u).filter((f) => Zn.includes(f.endpointID));
    async function m(u, f, b = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const I = c(u), p = e && !b ? c(e) : [], y = (S) => S.find((x) => x.endpointID === Xe)?.value, R = p.length > 0 && JSON.stringify(y(p)) === JSON.stringify(y(I)), h = [];
      for (const S of I) {
        if (!R) {
          h.push(S);
          continue;
        }
        if (S.endpointID !== Xe)
          if (S.endpointID === ke) {
            const x = S.value, P = p.find((X) => X.endpointID === S.endpointID && X.value.slotId === x.slotId), J = P ? P.value.values : [], Q = x.values.flatMap((X, Se) => Object.is(X, J[Se]) ? [] : [Se]);
            Q.length === 1 ? h.push({
              endpointID: Dt,
              value: { slotId: x.slotId, paramIndex: Q[0], value: x.values[Q[0]] }
            }) : Q.length > 1 && h.push(S);
          } else JSON.stringify(S.value) !== JSON.stringify(p.find((x) => x.endpointID === S.endpointID)?.value) && h.push(S);
      }
      e = void 0;
      for (const S of h) {
        if (a || f.aborted) return { kind: "cancelled" };
        const x = S.endpointID === ke || S.endpointID === Dt ? { ...Object(S.value), deliverySerial: ++r } : S.value, P = t.send({ kind: "event", endpoint: S.endpointID, value: x }), J = P.kind === "submitted" ? await P.completion : P;
        if (J.kind !== "sent") return J;
      }
      return a || f.aborted ? { kind: "cancelled" } : (e = u, Jc);
    }
    function l(u, f, b = !1) {
      const I = s.then(() => m(u, f, b));
      return s = I.catch(() => {
      }), I;
    }
    const d = t.listen("runtimeState", (u) => {
      const f = u !== null && typeof u == "object" ? Reflect.get(u, "dspSessionId") : void 0;
      if (typeof f != "number" || f === o) return;
      const b = o !== void 0;
      o = f;
      const I = i;
      b && n && l(n, t.signal, !0).then((p) => {
        p.kind === "failed" && I === i && t.report(p);
      }, t.fail);
    });
    return {
      apply(u, f) {
        return i += 1, n = u, l(u, f.signal);
      },
      stop() {
        a = !0, d();
      }
    };
  }
};
function Rt(t, e) {
  return {
    [`osc${t}WavetableSelect`]: 35,
    [`osc${t}WavetablePosition`]: 0,
    [`osc${t}Pan`]: 0,
    [`osc${t}Octave`]: 0,
    [`osc${t}Semitone`]: 0,
    [`osc${t}FineCents`]: 0,
    [`osc${t}Phase`]: 0,
    [`osc${t}PhaseRandom`]: 0,
    [`osc${t}Retrigger`]: 1,
    [`osc${t}VolumeDb`]: 0,
    [`osc${t}Mute`]: e,
    [`osc${t}Solo`]: 0,
    [`osc${t}WarpMode`]: 0,
    [`osc${t}WarpAmount`]: 0,
    [`osc${t}UnisonVoices`]: 1,
    [`osc${t}UnisonDetune`]: 0.1,
    [`osc${t}UnisonBlend`]: 0.75,
    [`osc${t}UnisonWidth`]: 1,
    [`osc${t}UnisonDetuneMode`]: 0,
    [`osc${t}UnisonStackMode`]: 0,
    [`osc${t}UnisonPositionSpread`]: 0,
    [`osc${t}UnisonWarpSpread`]: 0
  };
}
const Xc = {
  ...Rt("A", 0),
  ...Rt("B", 1),
  ...Rt("C", 1),
  ...Object.fromEntries(Gt().map((t) => [t, 0])),
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
  [ne]: Ce(),
  [xe]: fn(),
  [F]: lt()
}, Yc = [
  { id: "init", name: "Init", values: Xc }
], Ro = "bounce.v1", Zc = "cosimo.bounce", el = 1, Oo = "cosimo.patch-document", Mo = 1;
function D(t, e) {
  if (!t) throw new Error(e);
}
function q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function ce(t, e = "value") {
  return t === null || typeof t == "boolean" || typeof t == "string" ? t : typeof t == "number" ? (D(Number.isFinite(t), `${e} must be finite JSON data`), t) : Array.isArray(t) ? t.map((n, r) => ce(n, `${e}[${r}]`)) : (D(q(t), `${e} must be JSON-compatible`), Object.fromEntries(
    Object.keys(t).sort().map((n) => [n, ce(t[n], `${e}.${n}`)])
  ));
}
function ko(t, e) {
  if (typeof t != "string") return ce(t, e);
  try {
    return ce(JSON.parse(t), e);
  } catch (n) {
    throw new Error(`${e} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function tl(t) {
  return JSON.stringify(ce(t));
}
function nl({ parameters: t, storedState: e } = {}) {
  D(q(t), "Bounce patch parameters must be an object"), D(q(e), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(t).sort()) {
    const i = t[r];
    D(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), D(
      typeof i == "number" && Number.isFinite(i),
      `Bounce parameter ${r} must be finite`
    ), n[r] = i;
  }
  return Object.freeze({
    format: Oo,
    version: Mo,
    parameters: Object.freeze(n),
    storedState: Object.freeze(ce(e, "storedState"))
  });
}
function rl(t) {
  const e = ko(t, "Bounce patch document");
  return D(
    q(e) && e.format === Oo && e.version === Mo,
    "Unsupported Bounce patch document"
  ), D(
    Object.keys(e).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), nl(e);
}
function Do(t) {
  const e = ko(t, Ro);
  D(
    q(e) && e.format === Zc && e.version === el,
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
  D(
    Object.keys(e).sort().join(",") === n.sort().join(","),
    "bounce.v1 has unexpected fields"
  ), D(
    typeof e.digest == "string" && /^[0-9a-f]{64}$/.test(e.digest),
    "bounce.v1 digest must be lowercase SHA-256"
  ), D(
    Number.isInteger(e.generation) && e.generation > 0,
    "bounce.v1 generation must be positive"
  ), D(
    Number.isInteger(e.bankByteLength) && e.bankByteLength > 0,
    "bounce.v1 bankByteLength must be positive"
  ), D(
    Array.isArray(e.roots) && e.roots.length > 0 && e.roots.every((a) => Number.isInteger(a) && a >= 0 && a <= 127),
    "bounce.v1 roots are invalid"
  ), D(
    Array.isArray(e.segments) && e.segments.length === e.roots.length,
    "bounce.v1 segments must match roots"
  );
  let r = 0;
  e.segments.forEach((a, s) => {
    D(
      q(a) && a.rootNote === e.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), D(
    q(e.capture) && Number.isInteger(e.capture.sampleRate) && e.capture.sampleRate > 0 && typeof e.capture.tempoBpm == "number" && e.capture.tempoBpm > 0 && e.capture.velocity === 100 && Number.isInteger(e.capture.holdFrames) && e.capture.holdFrames > 0 && Number.isInteger(e.capture.tailCapFrames) && e.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), D(q(e.revertRef), "bounce.v1 revertRef is invalid");
  const i = e.revertRef.bankDigest;
  D(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = rl(e.revertRef.patchDocument);
  return Object.freeze({
    ...ce(e),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function ol(t) {
  return tl(Do(t));
}
const il = g("sourceMode", { preset: !1 });
function wo(t) {
  if (t !== null && typeof t == "object") {
    for (const e of Object.values(t)) wo(e);
    Object.freeze(t);
  }
  return t;
}
const er = /* @__PURE__ */ new WeakMap();
function Ot(t) {
  let e = er.get(t);
  return e === void 0 && er.set(t, e = ol(t)), e;
}
const al = {
  parse(t) {
    if (t === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: wo(Do(t)) };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  },
  encode: (t) => t === null ? null : Ot(t),
  equals: (t, e) => t === e || t !== null && e !== null && Ot(t) === Ot(e)
}, sl = ie({ initial: null, codec: al, preset: !1 }), cl = Object.freeze({
  ...Object.fromEntries(Ge.flatMap(({ controls: t }) => t.map(({ endpointID: e }) => [e, g(e)]))),
  ...Object.fromEntries(Gt().map((t) => [t, g(t)])),
  playMode: g("playMode"),
  glideTime: g("glideTime"),
  macro1: g("macro1"),
  macro2: g("macro2"),
  macro3: g("macro3"),
  macro4: g("macro4"),
  filterMode: g("filterMode"),
  filterCutoff: g("filterCutoff"),
  filterQ: g("filterQ"),
  mseg1Morph: g("mseg1Morph"),
  mseg2Morph: g("mseg2Morph"),
  mseg3Morph: g("mseg3Morph"),
  mseg1Rate: g("mseg1Rate"),
  mseg2Rate: g("mseg2Rate"),
  mseg3Rate: g("mseg3Rate"),
  env1Attack: g("env1Attack"),
  env1Decay: g("env1Decay"),
  env1Sustain: g("env1Sustain"),
  env1Release: g("env1Release"),
  env2Attack: g("env2Attack"),
  env2Decay: g("env2Decay"),
  env2Sustain: g("env2Sustain"),
  env2Release: g("env2Release"),
  env3Attack: g("env3Attack"),
  env3Decay: g("env3Decay"),
  env3Sustain: g("env3Sustain"),
  env3Release: g("env3Release"),
  filterMix: g("filterMix"),
  ampRelease: g("ampRelease"),
  sourceMode: il,
  globalTune: g("globalTune"),
  ampAttack: g("ampAttack"),
  ampDecay: g("ampDecay"),
  ampSustain: g("ampSustain"),
  filterCutoffKeyTrackEnabled: g("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: g("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: g("voiceEnhancerFrequency"),
  voiceEnhancerQ: g("voiceEnhancerQ"),
  voiceEnhancerAmount: g("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: g("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: g("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: g("polishEnhancerAmount"),
  polishCompressionClipAmount: g("polishCompressionClipAmount"),
  polishOutputTrimDb: g("polishOutputTrimDb"),
  polishSafeBassAmount: g("polishSafeBassAmount"),
  polishSafeBassBypass: g("polishSafeBassBypass"),
  polishEnhancerBypass: g("polishEnhancerBypass"),
  polishCompressionClipBypass: g("polishCompressionClipBypass"),
  polishOutputTrimBypass: g("polishOutputTrimBypass")
}), ll = jo({
  ...cl,
  [ne]: gn({ initial: Ce(), codec: Cs, prepare: (t) => t, engine: kc }),
  [xe]: gn({
    initial: fn(),
    codec: qc,
    dependencies: Gt(),
    prepare: (t, { parameters: e }) => Hc(t, e),
    engine: Qc
  }),
  [F]: ie({ initial: lt(), codec: Gc }),
  [Ro]: sl,
  ...pi({ factory: Yc, initial: "init" }),
  ...yi()
}), ul = { kind: "sent", proof: "native-publication-processed" };
function dl(t, e) {
  const n = ll[xe];
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
  }, c = pr(t, { patchRoot: gr() }), m = [];
  function l(h, S) {
    t.addEndpointListener?.(h, S);
    const x = () => t.removeEndpointListener?.(h, S);
    return m.push(x), x;
  }
  const d = {
    signal: s,
    send(h) {
      if (o) return { kind: "cancelled" };
      if (h.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${h.kind}.`);
      return t.sendEventOrValue?.(h.endpoint, h.value), { kind: "submitted", completion: Promise.resolve(ul) };
    },
    listen: l,
    readStored: () => Promise.reject(new Error("The rack delivery declares no stored reads.")),
    subscribeStored: () => {
      throw new Error("The rack delivery declares no stored reads.");
    },
    prepareData: () => Promise.reject(new Error("The rack delivery declares no shared data.")),
    report(h) {
      h.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${h.error.message}`));
    },
    fail: e.onDefect
  }, u = i.create(d);
  let f, b = !1;
  async function I() {
    const h = f === void 0 ? n.initial : n.codec.parse(f);
    if (h.kind === "error") {
      e.onDefect(new Error(`The saved rack could not be read: ${h.message}`));
      return;
    }
    const S = await r(h.value, { resources: c, parameters: {}, reason: "load", signal: s });
    if (o) return;
    if (Bo(S)) {
      e.onDefect(new Error(`The saved rack could not be prepared: ${S.error.message}`));
      return;
    }
    const x = await u.apply(S, { signal: s, send: d.send, listen: l });
    x.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${x.error.message}`));
  }
  const p = () => {
    !o && b && I().catch(e.onDefect);
  }, y = (h) => {
    b || Or(h) === 0 || (b = !0, p());
  }, R = (h) => {
    typeof h != "object" || h === null || Reflect.get(h, "key") !== xe || (f = Reflect.get(h, "value"), p());
  };
  return {
    start() {
      l(Nt, y), t.addStoredStateValueListener?.(R), t.requestFullStoredState?.((h) => {
        f = br(h)[xe], p();
      });
    },
    stop() {
      if (!o) {
        o = !0;
        for (const h of a) h();
        a.clear(), t.removeStoredStateValueListener?.(R);
        for (const h of m.splice(0)) h();
        return u.stop();
      }
    }
  };
}
const Je = 2048;
function Ae(t, e) {
  if (!t)
    throw new Error(e);
}
function fl(t) {
  Ae(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    Ae(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), Ae(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), Ae(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), Ae(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const ml = 2048, at = 11, hl = 256;
function K(t, e) {
  if (!t)
    throw new Error(e);
}
function pl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const tr = /* @__PURE__ */ new Map();
function gl(t) {
  const e = tr.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return tr.set(t, r), r;
}
function _o(t, e, n = !1) {
  const r = t.length;
  K(r === e.length, "FFT real and imaginary buffers must have the same length"), K(pl(r), "FFT input length must be a power of two");
  const i = gl(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const s = t[o];
    t[o] = t[a], t[a] = s;
    const c = e[o];
    e[o] = e[a], e[a] = c;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, c = Math.cos(s), m = Math.sin(s);
    for (let l = 0; l < r; l += o) {
      let d = 1, u = 0;
      for (let f = 0; f < a; f += 1) {
        const b = l + f, I = b + a, p = t[I], y = e[I], R = d * p - u * y, h = d * y + u * p, S = t[b], x = e[b];
        t[b] = S + R, e[b] = x + h, t[I] = S - R, e[I] = x - h;
        const P = d * c - u * m;
        u = d * m + u * c, d = P;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      t[o] /= r, e[o] /= r;
}
function No(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const r = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    i[o] = (Number(e[o]) || 0) - r;
  return i;
}
function bl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = ml,
  maxFramesPerTable: r = hl
} = {}) {
  const i = Float32Array.from(t);
  K(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  K(o > 0, "Source wavetable files must contain at least one frame"), K(o <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && K(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, m = c + n;
    a.push(No(i.slice(c, m)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function nr(t) {
  const e = No(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return _o(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Co(t, e, {
  mipLevelCount: n = at
} = {}) {
  const r = t?.real?.length ?? 0;
  K(r > 0, "Spectrum must contain real samples"), K(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), K(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = t.real[c], a[c] = t.imaginary[c]);
  }
  return _o(o, a, !0), Float32Array.from(o);
}
const Qe = 256, Ee = 2048, Lo = 8, vl = 12811, jt = (Lo + Qe * vl) * 4;
function rr(t, e, n) {
  const r = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Il(t, e, n) {
  if (t.byteLength !== jt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Qe)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  r.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    at,
    Qe
  ]);
  let i = Lo;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let m = 0; m < at; ++m) {
    const l = Math.min(Ee, Math.max(256, (1 << m) * 32)), d = Ee / l;
    for (let u = 0; u < e.frameCount; ++u) {
      const f = Co(n(u), m), b = i + u * (l + 1);
      for (let I = 0; I <= l; ++I) {
        const p = (I === l ? 0 : I) * d, y = (p + Ee - d) % Ee, R = (p + d) % Ee, h = f[p], S = f[y], x = f[R];
        if (h === void 0 || S === void 0 || x === void 0 || !Number.isFinite(h) || !Number.isFinite(S) || !Number.isFinite(x))
          throw new Error("Wavetable preparation produced invalid samples.");
        const P = Math.fround(0.5 * Math.fround(x - S));
        r[b + I] = rr(h, s, o) & 262143 | rr(P, c, a) << 18;
      }
    }
    i += (l + 1) * Qe;
  }
}
const yl = "runtimeSyncRequest", Sl = 2147483647, Tl = "runtimeState", Al = "retryDesiredTableRequest", El = "workerLoadFailure", xl = "serviceLoadAbort", Rl = "wavetableLoadBegin", Ol = "wavetableMipFrame", Ml = "wavetableUploadAck", kl = "wavetableMipRequest", Dl = "wavetablePrewarmRequest", wl = "wavetablePrewarmNotification", _l = "assets/factory-bank-catalog.json", Vt = 3, Nl = 1, Cl = Vt * Je, Ll = 1, Pl = 2, Fl = 3, Ul = 1, Bl = 2, $l = 2e4, Ve = Ll, or = Pl, ir = Fl, W = Ul, ar = Bl, Kl = 48 * 1024 * 1024, Mt = 3;
function sr(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function k(t, e, n = null) {
  const r = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${e}`, n);
      return;
    }
    r(`[wavetable-worker] ${e}`);
  }
}
function cr(t) {
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
function lr(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function ur(t, e) {
  if (!t)
    throw new Error(e);
}
function zl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function jl(t, e) {
  return fl(await t.readJSON(e));
}
function Vl(t) {
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
function Hl(t, e) {
  const n = Math.round(Number(t) || 0);
  return zl(n, 0, Math.max(0, e - 1));
}
function kt(t, e, n, r, i) {
  return `${t}:${e}:${n}:${r}:${i}`;
}
function Wl(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function dr(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function fr(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function He() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function ql(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Gl {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = n.resourceClient ?? pr(e, { patchRoot: gr() }), this.catalogPath = n.catalogPath ?? _l, this.maxBatchesInFlight = sr(
      n.maxFramesInFlight,
      Nl
    ), this.mipLevelCount = n.mipLevelCount ?? at, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Kl) || 0)), this.serviceLoadTimeoutMs = sr(n.serviceLoadTimeoutMs, $l), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(Tl, this.handleRuntimeState), this.connection.addEndpointListener?.(Ml, this.handleUploadAck), this.connection.addEndpointListener?.(kl, this.handleMipRequest), this.connection.addEndpointListener?.(Dl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(wl, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      yl,
      Sl
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await jl(this.resourceClient, this.catalogPath), k("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Mt; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = dr(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      let n = null, r = null;
      for (const [i, o] of this.tableCache)
        e.has(i) || (!r || o.lastUsedSerial < r.lastUsedSerial) && (n = i, r = o);
      if (!n || !r)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= r.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const r = {
      ...e,
      byteCount: dr(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = kt(
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
          urgencyLevel: e,
          ...fr(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: r, tableIndex: i } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (k("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: r,
        tableIndex: i,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: r,
          tableIndex: i
        },
        {
          failurePhase: ir,
          failureReasonCode: ar
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== ir || e.failureReasonCode !== ar ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Ve,
    failureReasonCode: s = W
  }) {
    this.connection.sendEventOrValue?.(El, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: r,
      generation: i,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: r,
    tableIndex: i,
    failureReasonCode: o = W
  }) {
    this.connection.sendEventOrValue?.(xl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    k("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? cr(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Al, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), i = Hl(e, r.tables.length), o = r.tables[i];
    ur(o, `Could not resolve table ${i}`);
    const a = Wl(o, Je, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, k("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = He();
    k("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const m = await this.resourceClient.readAudio(o.sourceWav), l = bl(m.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Je
    });
    return k("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(He() - c)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: l.frameCount,
      frames: l.frames,
      spectra: new Array(l.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, r) {
    if (k("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: r.tableMeta?.name ?? null,
      frameCount: r.frameCount
    }), this.serviceTable = {
      ...r,
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
    this.connection.sendEventOrValue?.(Rl, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  async prepareSharedTable() {
    const e = this.serviceTable;
    if (!e) return;
    const n = He();
    try {
      if (await pc(this.connection, {
        input: e.oscillatorIndex,
        byteLength: jt
      }, (r) => {
        Il(r, e, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      k("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: jt,
        preparationMs: He() - n,
        sampleUploadBytes: 0
      });
    } catch (r) {
      if (this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      const i = this.candidateValidations[e.oscillatorIndex];
      i?.dspSessionId === e.dspSessionId && i.generation === e.generation && i.desiredIntentSerial === e.desiredIntentSerial && (this.candidateValidations[e.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: 0,
        tableIndex: e.tableIndex,
        candidateAttemptSerial: e.desiredIntentSerial,
        failurePhase: or,
        failureReasonCode: W
      }), this.serviceTable = null, this.clearMipTransferState(), k("error", "Shared wavetable preparation failed", { detail: We(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    k("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Ve,
      failureReasonCode: W
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Ve,
      failureReasonCode: W
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Ve,
    failureReasonCode: r = W
  } = {}) {
    k("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: r
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: r
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: r
    });
  }
  async prepareServiceTarget(e, n) {
    if (this.isMatchingServiceTable(e)) {
      this.serviceTable && (this.serviceTable.mode = e.kind);
      const o = this.candidateValidations[e.oscillatorIndex];
      return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (k("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: We(o)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    if (!r || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...r,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.delivery === "shared" ? await this.prepareSharedTable() : (this.createFullMipJobsForServiceTable(2), this.pumpUploads()));
    const i = this.candidateValidations[e.oscillatorIndex];
    return i && i.dspSessionId === e.dspSessionId && i.generation === e.generation && i.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, r = this.candidateValidations[e.oscillatorIndex];
    if (r && r.dspSessionId === e.dspSessionId && r.tableIndex === n && r.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const i = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let o = null;
    try {
      o = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(e) && (k("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: We(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !o || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, i, o);
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
    for (let e = 0; e < Mt; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, ql(() => {
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
    const n = e.oscillatorIndex, r = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const i = this.candidateValidations[n];
    if (i && i.dspSessionId === e.dspSessionId && i.generation > e.generationFrontier)
      return;
    const o = this.resolveServiceTarget(e);
    if (o) {
      if (!await this.prepareServiceTarget(o, e) || !this.isCurrentRuntimeState(e))
        return;
      if (o.kind === "loading" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        k("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: W
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      o.kind === "active" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e) && !r && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Vl(e ?? {});
    if (k("info", "Received runtime state", cr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Mt)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const i = n.oscillatorIndex, o = this.latestRuntimeStates[i], a = o ? this.getDesiredRetryKey(o) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[i] = Math.max(
      this.nextLoadGenerations[i] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== s) && (this.autoRetryConsumedKeys[i] = null), this.latestRuntimeStates[i] = n, this.pendingRuntimeStateOscillators.add(i), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, r = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(r))
      try {
        const i = await this.loadTableSource(r);
        for (let a = 0; a < i.frameCount; a += 1)
          i.spectra[a] || (i.spectra[a] = nr(i.frames[a]));
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
          detail: We(i)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.oscillatorIndex)), i = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = kt(
      n,
      r,
      i,
      o,
      a
    );
    let m = this.mipJobs.get(c);
    return m ? (!m.completed && s > m.urgencyLevel && (m.urgencyLevel = s), m) : (m = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...fr(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, m), m);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
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
  handleUploadAck(e) {
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), m = Math.trunc(Number(n.frameCount)), l = kt(
      r,
      i,
      o,
      a,
      s
    ), d = this.mipJobs.get(l), u = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Vt,
      u - c
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(c) || m <= 0 || m !== f)) {
      d.inFlightBatchBases.delete(c);
      for (let b = 0; b < m; b += 1) {
        const I = c + b;
        d.ackedFrames[I] || (d.ackedFrames[I] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === u && d.nextFrameIndex >= u && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), lr(c, m, u) && k("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: d.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: m,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: u,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (ur(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = nr(this.serviceTable.frames[e]);
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
      const n = e.nextFrameIndex, r = Math.min(
        Vt,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Cl);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Co(s, e.mipIndex);
          i.set(c, o * Je);
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
            failurePhase: or,
            failureReasonCode: W
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
        frameCount: r,
        samples: Array.from(i)
      }), lr(n, r, this.serviceTable.frameCount) && k("info", "Sent wavetable mip batch", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        batchFrameCount: r,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: e.inFlightBatchBases.size + 1
      }), e.inFlightBatchBases.add(n), e.nextFrameIndex += r, this.armServiceLoadWatchdog();
    }
    e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightBatchBases.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function We(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Jl(t, e = {}) {
  return new Gl(t, e);
}
async function Ql(t, e = {}) {
  return Po(t, [
    () => dl(t, {
      onDefect: (n) => console.error("Cosimo rack restore failed", n)
    }),
    () => Jl(t, e)
  ]);
}
export {
  Ql as default
};
