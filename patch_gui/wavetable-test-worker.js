class Ne {
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
function _e(t, e) {
  return new Ne(t, e);
}
async function Ue(t, e) {
  const n = _e(t, e);
  return await n.start(), n;
}
const I = "rack.v1", Be = "laneTopology", Ke = 16, A = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), ve = Object.freeze({
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
  A.map((t) => [ve[t], t])
);
function Se() {
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
function ee() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...A],
    enabled: Se()
  };
}
function Ve(t) {
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
function te(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function $e(t) {
  return typeof t != "string" ? null : A.find((e) => e === t) ?? null;
}
function ze(t) {
  const e = Ve(t);
  if (e._tag === "err")
    return e;
  if (!te(e.value))
    return { _tag: "err", message: `${I} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const o of Reflect.ownKeys(e.value))
    if (typeof o != "string" || !n.has(o))
      return { _tag: "err", message: `${I} has unexpected field ${String(o)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${I} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== A.length)
    return { _tag: "err", message: `${I}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const o of e.value.order) {
    const l = $e(o);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${I}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!te(e.value.enabled))
    return { _tag: "err", message: `${I}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== A.length)
    return { _tag: "err", message: `${I}.enabled must contain every effect once` };
  const a = Se();
  for (const o of A) {
    const l = e.value.enabled[o];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${I}.enabled.${o} must be boolean` };
    a[o] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: a }
  };
}
function We(t) {
  if (t === void 0)
    return ee();
  const e = ze(t);
  return e._tag === "ok" ? e.value : ee();
}
function qe(t) {
  const e = new Array(Ke).fill(0);
  let n = 0;
  return t.order.forEach((i, r) => {
    e[r] = ve[i], t.enabled[i] && (n |= 1 << r);
  }), [
    {
      endpointID: Be,
      value: { chainLength: t.order.length, slotIds: e, enabledMask: n }
    }
  ];
}
const He = "runtimeState";
function Ge(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const je = {
  endpointID: He,
  required: !0,
  mapValue: Ge
}, Je = 2e3;
function ne(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Qe(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return ne(i, e) ? {
    found: !0,
    value: i[e]
  } : ne(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function ie(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Ye {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Ze(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Qe(e, this.options.stateKey);
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
    }, r = ie(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, o = this.options.buildRuntimeEvents(i, a), l = ie({
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
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(o, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(o);
        const d = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, d && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(o);
        const s = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, s && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of o)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Je
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Ze(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Xe(t, e) {
  return new Ye(t, e);
}
function et(t) {
  return Xe(t, {
    stateKey: I,
    runtimeEndpointDependencies: [je],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: We,
    buildRuntimeEvents: ({ state: e }) => [...qe(e)]
  });
}
function b(t, e) {
  if (!t)
    throw new Error(e);
}
function N(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function tt(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function $(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function xe(t) {
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
function nt() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function _(t, e) {
  const n = nt();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (tt(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function ae(t) {
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
  throw new Error(`Unsupported text resource payload (${xe(t)})`);
}
function it(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return $(t);
  throw new Error(`Unsupported binary resource payload (${xe(t)})`);
}
function at(t) {
  const e = t?.frames;
  b(
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
      const o = a;
      b(o.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(o[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function ye(t) {
  const e = new DataView(t);
  b(N(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), b(N(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, o = null, l = null, s = null, d = 12;
  for (; d + 8 <= e.byteLength; ) {
    const u = N(e, d, 4), h = e.getUint32(d + 4, !0), p = d + 8;
    u === "fmt " ? (n = e.getUint16(p, !0), i = e.getUint16(p + 2, !0), r = e.getUint32(p + 4, !0), o = e.getUint16(p + 12, !0), a = e.getUint16(p + 14, !0)) : u === "data" && (l = p, s = h), d = p + h + h % 2;
  }
  b(n !== null, "Wave file is missing a fmt chunk"), b(l !== null && s !== null, "Wave file is missing a data chunk"), b(i === 1, "Only mono wavetable bank files are supported");
  let f;
  if (n === 3 && a === 32)
    f = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && a === 16) {
    const u = s / 2, h = new Int16Array(t.slice(l, l + s));
    f = new Float32Array(u);
    for (let p = 0; p < u; p += 1)
      f[p] = h[p] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: o ?? 0,
    samples: f
  };
}
async function re(t) {
  b(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return b(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function z(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Te(t) {
  const e = new Uint8Array(t).buffer, n = ye(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function rt(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (b(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), r = async (s) => {
    b(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const d = await t.readResourceAsAudioData(s);
    return at(d);
  }, a = (s) => {
    const d = t.getResourceAddress?.(s);
    return d ?? null;
  }, o = async (s, d = t.getResourceAddress?.(s)) => {
    const f = _(s, d), u = await re(f), h = ye(u);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, l = async (s, d = t.getResourceAddress?.(s)) => {
    const f = _(s, d);
    return new Uint8Array(await re(f));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return ae(await i(s));
      const d = a(s);
      return e === "url" && d !== null ? z(await l(s, d)) : typeof t.readResource == "function" ? ae(await i(s)) : z(await l(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? it(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(s);
      const d = a(s);
      return n === "url" && d !== null ? o(s, d) : typeof t.readResourceAsAudioData == "function" ? r(s) : Te(await this.readBytes(s));
    },
    getURL(s) {
      return _(s, t.getResourceAddress?.(s));
    }
  };
}
function ot(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return rt(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function st(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(o) {
      if (e)
        return e(o);
      if (n)
        return JSON.stringify(await n(o));
      if (i)
        return z(await i(o));
      throw new Error(`Resource client cannot read text ${o}`);
    },
    async readJSON(o) {
      return n ? n(o) : JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      if (i)
        return i(o);
      if (e)
        return $(await e(o));
      if (n)
        return $(JSON.stringify(await n(o)));
      throw new Error(`Resource client cannot read bytes ${o}`);
    },
    async readAudio(o) {
      return r ? r(o) : Te(await this.readBytes(o));
    },
    getURL(o) {
      return a ? a(o) : null;
    }
  };
}
function lt(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function dt(t) {
  return lt(t) ? st(t) : ot(t);
}
const F = 2048;
function D(t, e) {
  if (!t)
    throw new Error(e);
}
function ct(t) {
  D(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    D(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), D(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), D(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), D(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const ut = 2048, Re = 11, ht = 256;
function S(t, e) {
  if (!t)
    throw new Error(e);
}
function ft(t) {
  return t > 0 && (t & t - 1) === 0;
}
const oe = /* @__PURE__ */ new Map();
function mt(t) {
  const e = oe.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, o = r;
    for (let l = 0; l < n; l += 1)
      a = a << 1 | o & 1, o >>= 1;
    i[r] = a;
  }
  return oe.set(t, i), i;
}
function Ee(t, e, n = !1) {
  const i = t.length;
  S(i === e.length, "FFT real and imaginary buffers must have the same length"), S(ft(i), "FFT input length must be a power of two");
  const r = mt(i);
  for (let a = 0; a < i; a += 1) {
    const o = r[a];
    if (o <= a)
      continue;
    const l = t[a];
    t[a] = t[o], t[o] = l;
    const s = e[a];
    e[a] = e[o], e[o] = s;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const o = a >> 1, l = (n ? 2 : -2) * Math.PI / a, s = Math.cos(l), d = Math.sin(l);
    for (let f = 0; f < i; f += a) {
      let u = 1, h = 0;
      for (let p = 0; p < o; p += 1) {
        const v = f + p, R = v + o, j = t[R], J = e[R], Q = u * j - h * J, Y = u * J + h * j, Z = t[v], X = e[v];
        t[v] = Z + Q, e[v] = X + Y, t[R] = Z - Q, e[R] = X - Y;
        const Oe = u * s - h * d;
        h = u * d + h * s, u = Oe;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function we(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function pt(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = ut,
  maxFramesPerTable: i = ht
} = {}) {
  const r = Float32Array.from(t);
  S(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  S(a > 0, "Source wavetable files must contain at least one frame"), S(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && S(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const o = [];
  for (let l = 0; l < a; l += 1) {
    const s = l * n, d = s + n;
    o.push(we(r.slice(s, d)));
  }
  return {
    frameCount: a,
    frames: o
  };
}
function se(t) {
  const e = we(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Ee(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function gt(t, e, {
  mipLevelCount: n = Re
} = {}) {
  const i = t?.real?.length ?? 0;
  S(i > 0, "Spectrum must contain real samples"), S(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), S(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), o = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    a[l] = t.real[l], o[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (a[s] = t.real[s], o[s] = t.imaginary[s]);
  }
  return Ee(a, o, !0), Float32Array.from(a);
}
const g = (t, e) => ({ label: t, value: e });
function x(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const y = Object.freeze({
  filter: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), c = (t, e, n, i, r, a, o, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
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
  modulationDragStyle: l.modulationDragStyle
}), It = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], bt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], vt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: y.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      c("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(g), quick: !0 }),
      c("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      c("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      c("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: y.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      c("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [g("Classic", 0), g("Harmonics", 1)] }),
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
    iconUrl: y.ott,
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
    iconUrl: y.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      c("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(g) }),
      c("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(g) }),
      c("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      c("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      c("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      c("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      c("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(g) }),
      c("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: y.flanger,
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
    iconUrl: y.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      c("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [g("Free", 0), g("Sync", 1)] }),
      c("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      c("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: It.map(g) }),
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
    iconUrl: y.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      c("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [g("Free", 0), g("Sync", 1)] }),
      c("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      c("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: bt.map(g) }),
      c("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      c("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      c("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: y.reverb,
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
], Ae = vt, Me = Object.freeze(
  Ae.flatMap((t) => t.parameters)
);
new Map(
  Me.map((t) => [t.endpointID, t])
);
function De() {
  return Me;
}
const Ce = ["A", "B", "C"], St = [
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
], xt = [
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
], w = Object.freeze([
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
]), yt = Object.freeze([
  ...Ce.flatMap((t) => St.map(
    (e) => `osc${t}.${e}`
  )),
  ...xt
]), ke = Object.freeze(
  yt.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Tt = De().filter((t) => t.modulationTargetIndex !== null), Fe = Object.freeze(
  Tt.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), T = Object.freeze([
  ...ke,
  ...Fe
]), L = w.length, Rt = ke.length, Et = Fe.length, wt = L * T.length, At = new Map(w.map((t) => [t.id, t])), Mt = new Map(w.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Dt = new Map(T.map((t) => [t.kind, t]));
function Ct() {
  if (L !== 13 || Rt !== 51 || Et !== 36 || wt !== 1131)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = w.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 51], ["rack", 36]]) {
    const n = T.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (At.size !== L || Mt.size !== L || Dt.size !== T.length)
    throw new Error("Modulation identities must be unique");
}
Ct();
w.filter((t) => t.group === "voice").length;
w.filter((t) => t.group === "macro").length;
function kt(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Ft(t) {
  throw new Error(t ?? "Invariant violated");
}
function C(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const Lt = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      C("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      C("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      C("mix", "Mix", 100, 100),
      C("drive", "Drive", 15, 0)
    ]
  }
], le = 1e-6;
function M(t, e) {
  if (!Number.isFinite(t) || t < -le || t > 1 + le)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function O(t, e) {
  return M(t / 100, `${e} catalog percentage`);
}
function H(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Pt(t) {
  return 20 * 1e3 ** t;
}
function Ot(t) {
  return M(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Nt(t) {
  return 0.1 * 200 ** t;
}
function _t(t) {
  return M(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ut(t) {
  return t;
}
function Bt(t) {
  return M(t, "filterMix endpoint conversion");
}
function P(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Kt(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: P("filterCutoff", Pt, Ot),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: P("filterQ", Nt, _t),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: P("filterMix", Ut, Bt),
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
function Le(t) {
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
      return kt(t);
  }
}
function Vt(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function $t(t, e) {
  const n = H(t.moduleId, e.id), i = Le(e.format), r = Kt(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: O(e.defaultPercent, n),
    initialValue: O(e.initialPercent, n),
    format: i,
    modAmount: Vt(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const zt = [
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
function Wt(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function qt(t, e) {
  const n = `osc${t}`, i = H(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: O(e.defaultPercent, i),
    initialValue: O(e.initialPercent, i),
    format: Le(e.format),
    modAmount: Wt(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Ht = Object.freeze(
  Ce.flatMap((t) => zt.map((e) => qt(t, e)))
), Gt = Object.freeze([
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
function jt(t) {
  const e = H(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (a) => t.min + n * a, r = (a) => M(
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
const Jt = Object.freeze(
  Gt.map(jt)
);
function Qt(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function U(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return M(n, `${t.endpointID} endpoint conversion`);
}
function Yt(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Zt(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Xt(t) {
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
function en(t) {
  const e = Qt(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: U(t, t.initial),
    initialValue: U(t, t.initial),
    format: Zt(t),
    modAmount: Xt(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Yt(t, n),
      fromEngine: (n) => U(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const G = Object.freeze(
  [
    ...Ae.flatMap((t) => t.parameters.map(en)),
    ...Ht,
    ...Jt,
    ...Lt.flatMap(
      (t) => t.parameters.map(
        (e) => $t(t, e)
      )
    )
  ]
), tn = new Map(
  G.map((t) => [t.targetId, t])
), Pe = G.filter(
  (t) => t.modulationTargetKind !== null
), W = new Map(
  Pe.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (tn.size !== G.length)
  throw new Error("Target descriptor IDs must be unique");
if (Pe.length !== T.length || W.size !== T.length || T.some((t) => W.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function de(t) {
  const e = W.get(t);
  return e === void 0 ? Ft(`Modulation target "${t}" has no display descriptor`) : e;
}
function nn(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = de(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = de(t);
  return n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const an = De().filter((t) => t.modulationTargetIndex !== null);
new Map(
  an.map((t) => [`rack.${t.endpointID}`, t])
);
const rn = {
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
w.map((t) => ({
  value: t.id,
  label: rn[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
T.map((t) => ({
  value: t.kind,
  label: nn(t.kind)
}));
const on = [
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
], sn = [
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
  on.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  sn.map((t, e) => [t, 2 ** e])
);
const ln = "runtimeSyncRequest", dn = 2147483647, cn = "runtimeState", un = "retryDesiredTableRequest", hn = "workerLoadFailure", fn = "serviceLoadAbort", mn = "wavetableLoadBegin", pn = "wavetableMipFrame", gn = "wavetableUploadAck", In = "wavetableMipRequest", bn = "wavetablePrewarmRequest", vn = "wavetablePrewarmNotification", Sn = "assets/factory-bank-catalog.json", q = 3, xn = 1, yn = q * F, Tn = 1, Rn = 2, En = 3, wn = 1, An = 2, Mn = 2e4, k = Tn, Dn = Rn, ce = En, E = wn, ue = An, Cn = 48 * 1024 * 1024, B = 3;
function he(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function m(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function fe(t) {
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
function me(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function pe(t, e) {
  if (!t)
    throw new Error(e);
}
function kn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Fn(t, e) {
  return ct(await t.readJSON(e));
}
function Ln(t) {
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
function Pn(t, e) {
  const n = Math.round(Number(t) || 0);
  return kn(n, 0, Math.max(0, e - 1));
}
function K(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function On(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function ge(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Ie(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function be() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Nn(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class _n {
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
    this.connection = e, this.resourceClient = dt(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Sn, this.maxBatchesInFlight = he(
      n.maxFramesInFlight,
      xn
    ), this.mipLevelCount = n.mipLevelCount ?? Re, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Cn) || 0)), this.serviceLoadTimeoutMs = he(n.serviceLoadTimeoutMs, Mn), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, m("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(cn, this.handleRuntimeState), this.connection.addEndpointListener?.(gn, this.handleUploadAck), this.connection.addEndpointListener?.(In, this.handleMipRequest), this.connection.addEndpointListener?.(bn, this.handlePrewarmRequest), this.connection.addEndpointListener?.(vn, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ln,
      dn
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Fn(this.resourceClient, this.catalogPath), m("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < B; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = ge(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: ge(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = K(
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
          ...Ie(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (m("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: ce,
          failureReasonCode: ue
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== ce || e.failureReasonCode !== ue ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: o = k,
    failureReasonCode: l = E
  }) {
    this.connection.sendEventOrValue?.(hn, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: a,
      failurePhase: o,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: a = E
  }) {
    this.connection.sendEventOrValue?.(fn, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest(e) {
    m("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? fe(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(un, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Pn(e, i.tables.length), a = i.tables[r];
    pe(a, `Could not resolve table ${r}`);
    const o = On(a, F, this.mipLevelCount), l = this.tableCache.get(o);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, m("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = be();
    m("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(a.sourceWav), f = pt(d.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: F
    });
    return m("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: f.frameCount,
      loadDurationMs: Math.round(be() - s)
    }), this.rememberLoadedTable({
      cacheKey: o,
      tableIndex: r,
      tableMeta: a,
      frameCount: f.frameCount,
      frames: f.frames,
      spectra: new Array(f.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    m("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(mn, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    m("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: k,
      failureReasonCode: E
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: k,
      failureReasonCode: E
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = k,
    failureReasonCode: i = E
  } = {}) {
    m("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (m("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: V(a)
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
    } catch (o) {
      this.isCurrentRuntimeState(e) && (m("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: V(o)
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
    for (let e = 0; e < B; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Nn(() => {
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
        m("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: E
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
    const n = Ln(e ?? {});
    if (m("info", "Received runtime state", fe(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= B)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, a = this.latestRuntimeStates[r], o = a ? this.getDesiredRetryKey(a) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || o !== l) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let o = 0; o < r.frameCount; o += 1)
          r.spectra[o] || (r.spectra[o] = se(r.frames[o]));
        const a = this.tableCache.get(r.cacheKey);
        a && this.refreshCacheEntryByteCount(a), m("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        m("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: V(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), a = Math.trunc(Number(e?.tableIndex)), o = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || o < 0 || o >= this.mipLevelCount)
      return null;
    const s = K(
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
      ...Ie(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, d), d);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (m("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), a = Math.trunc(Number(n.generation)), o = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), f = K(
      i,
      r,
      a,
      o,
      l
    ), u = this.mipJobs.get(f), h = this.serviceTable?.frameCount ?? 0, p = Math.min(
      q,
      h - s
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(s) || d <= 0 || d !== p)) {
      u.inFlightBatchBases.delete(s);
      for (let v = 0; v < d; v += 1) {
        const R = s + v;
        u.ackedFrames[R] || (u.ackedFrames[R] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === h && u.nextFrameIndex >= h && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), me(s, d, h) && m("info", "Acknowledged wavetable mip batch", {
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
  getSpectrumForFrame(e) {
    if (pe(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = se(this.serviceTable.frames[e]);
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
        q,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(yn);
      try {
        for (let a = 0; a < i; a += 1) {
          const o = n + a, l = this.getSpectrumForFrame(o), s = gt(l, e.mipIndex);
          r.set(s, a * F);
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
            failurePhase: Dn,
            failureReasonCode: E
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(pn, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), me(n, i, this.serviceTable.frameCount) && m("info", "Sent wavetable mip batch", {
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
function V(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Un(t, e = {}) {
  return new _n(t, e);
}
async function Bn(t, e = {}) {
  return Ue(t, [
    et,
    () => Un(t, e)
  ]);
}
export {
  Bn as default
};
