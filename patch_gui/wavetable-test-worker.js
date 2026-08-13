class Oe {
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
function Pe(t, e) {
  return new Oe(t, e);
}
async function Ue(t, e) {
  const n = Pe(t, e);
  return await n.start(), n;
}
const b = "rack.v1", _e = "rackOrder", Ne = "rackEnable", R = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), ge = Object.freeze({
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
  R.map((t) => [ge[t], t])
);
function be() {
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
function G() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...R],
    enabled: be()
  };
}
function Be(t) {
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
function Q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ke(t) {
  return typeof t != "string" ? null : R.find((e) => e === t) ?? null;
}
function Ve(t) {
  const e = Be(t);
  if (e._tag === "err")
    return e;
  if (!Q(e.value))
    return { _tag: "err", message: `${b} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const o of Reflect.ownKeys(e.value))
    if (typeof o != "string" || !n.has(o))
      return { _tag: "err", message: `${b} has unexpected field ${String(o)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${b} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== R.length)
    return { _tag: "err", message: `${b}.order must contain every effect once` };
  const i = [], a = /* @__PURE__ */ new Set();
  for (const o of e.value.order) {
    const l = Ke(o);
    if (l === null || a.has(l))
      return { _tag: "err", message: `${b}.order is not a complete permutation` };
    a.add(l), i.push(l);
  }
  if (!Q(e.value.enabled))
    return { _tag: "err", message: `${b}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== R.length)
    return { _tag: "err", message: `${b}.enabled must contain every effect once` };
  const r = be();
  for (const o of R) {
    const l = e.value.enabled[o];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${b}.enabled.${o} must be boolean` };
    r[o] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: r }
  };
}
function $e(t) {
  if (t === void 0)
    return G();
  const e = Ve(t);
  return e._tag === "ok" ? e.value : G();
}
function ze(t) {
  return [
    {
      endpointID: _e,
      value: { moduleIds: t.order.map((e) => ge[e]) }
    },
    {
      endpointID: Ne,
      value: { enabledFlags: R.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const We = "runtimeState";
function qe(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const He = {
  endpointID: We,
  required: !0,
  mapValue: qe
}, Je = 2e3;
function Y(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function je(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Y(i, e) ? {
    found: !0,
    value: i[e]
  } : Y(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Z(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Ge {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Qe(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = je(e, this.options.stateKey);
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
    }, a = Z(n), r = !this.forceFullReplay && a === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, o = this.options.buildRuntimeEvents(i, r), l = Z({
      runtimeEndpoints: n,
      events: o
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
      return;
    }
    if (o.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(o, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(o);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
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
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
  }
}
function Qe(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Ye(t, e) {
  return new Ge(t, e);
}
function Ze(t) {
  return Ye(t, {
    stateKey: b,
    runtimeEndpointDependencies: [He],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: $e,
    buildRuntimeEvents: ({ state: e }) => [...ze(e)]
  });
}
function I(t, e) {
  if (!t)
    throw new Error(e);
}
function O(t, e, n) {
  let i = "";
  for (let a = 0; a < n; a += 1)
    i += String.fromCharCode(t.getUint8(e + a));
  return i;
}
function Xe(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function K(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ie(t) {
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
function et() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function P(t, e) {
  const n = et();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Xe(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function X(t) {
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
  throw new Error(`Unsupported text resource payload (${Ie(t)})`);
}
function tt(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return K(t);
  throw new Error(`Unsupported binary resource payload (${Ie(t)})`);
}
function nt(t) {
  const e = t?.frames;
  I(
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
      const o = r;
      I(o.length === 1, "Only mono wavetable source files are supported"), i[a] = Number(o[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function ve(t) {
  const e = new DataView(t);
  I(O(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), I(O(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, a = null, r = null, o = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = O(e, c, 4), p = e.getUint32(c + 4, !0), f = c + 8;
    u === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), a = e.getUint32(f + 4, !0), o = e.getUint16(f + 12, !0), r = e.getUint16(f + 14, !0)) : u === "data" && (l = f, s = p), c = f + p + p % 2;
  }
  I(n !== null, "Wave file is missing a fmt chunk"), I(l !== null && s !== null, "Wave file is missing a data chunk"), I(i === 1, "Only mono wavetable bank files are supported");
  let m;
  if (n === 3 && r === 32)
    m = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const u = s / 2, p = new Int16Array(t.slice(l, l + s));
    m = new Float32Array(u);
    for (let f = 0; f < u; f += 1)
      m[f] = p[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: a ?? 0,
    bitsPerSample: r,
    blockAlign: o ?? 0,
    samples: m
  };
}
async function ee(t) {
  I(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return I(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function V(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ye(t) {
  const e = new Uint8Array(t).buffer, n = ve(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function it(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (I(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), a = async (s) => {
    I(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return nt(c);
  }, r = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, o = async (s, c = t.getResourceAddress?.(s)) => {
    const m = P(s, c), u = await ee(m), p = ve(u);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const m = P(s, c);
    return new Uint8Array(await ee(m));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return X(await i(s));
      const c = r(s);
      return e === "url" && c !== null ? V(await l(s, c)) : typeof t.readResource == "function" ? X(await i(s)) : V(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? tt(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return a(s);
      const c = r(s);
      return n === "url" && c !== null ? o(s, c) : typeof t.readResourceAsAudioData == "function" ? a(s) : ye(await this.readBytes(s));
    },
    getURL(s) {
      return P(s, t.getResourceAddress?.(s));
    }
  };
}
function rt(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return it(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function at(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, a = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(o) {
      if (e)
        return e(o);
      if (n)
        return JSON.stringify(await n(o));
      if (i)
        return V(await i(o));
      throw new Error(`Resource client cannot read text ${o}`);
    },
    async readJSON(o) {
      return n ? n(o) : JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      if (i)
        return i(o);
      if (e)
        return K(await e(o));
      if (n)
        return K(JSON.stringify(await n(o)));
      throw new Error(`Resource client cannot read bytes ${o}`);
    },
    async readAudio(o) {
      return a ? a(o) : ye(await this.readBytes(o));
    },
    getURL(o) {
      return r ? r(o) : null;
    }
  };
}
function ot(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function st(t) {
  return ot(t) ? at(t) : rt(t);
}
const te = 2048;
function A(t, e) {
  if (!t)
    throw new Error(e);
}
function lt(t) {
  A(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    A(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), A(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), A(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), A(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const dt = 2048, Se = 11, ct = 256;
function v(t, e) {
  if (!t)
    throw new Error(e);
}
function ut(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ne = /* @__PURE__ */ new Map();
function ht(t) {
  const e = ne.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let a = 0; a < t; a += 1) {
    let r = 0, o = a;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | o & 1, o >>= 1;
    i[a] = r;
  }
  return ne.set(t, i), i;
}
function Te(t, e, n = !1) {
  const i = t.length;
  v(i === e.length, "FFT real and imaginary buffers must have the same length"), v(ut(i), "FFT input length must be a power of two");
  const a = ht(i);
  for (let r = 0; r < i; r += 1) {
    const o = a[r];
    if (o <= r)
      continue;
    const l = t[r];
    t[r] = t[o], t[o] = l;
    const s = e[r];
    e[r] = e[o], e[o] = s;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const o = r >> 1, l = (n ? 2 : -2) * Math.PI / r, s = Math.cos(l), c = Math.sin(l);
    for (let m = 0; m < i; m += r) {
      let u = 1, p = 0;
      for (let f = 0; f < o; f += 1) {
        const E = m + f, M = E + o, z = t[M], W = e[M], q = u * z - p * W, H = u * W + p * z, J = t[E], j = e[E];
        t[E] = J + q, e[E] = j + H, t[M] = J - q, e[M] = j - H;
        const Le = u * s - p * c;
        p = u * c + p * s, u = Le;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function xe(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), a = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    a[r] = (Number(e[r]) || 0) - i;
  return a;
}
function ft(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = dt,
  maxFramesPerTable: i = ct
} = {}) {
  const a = Float32Array.from(t);
  v(a.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = a.length / n;
  v(r > 0, "Source wavetable files must contain at least one frame"), v(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && v(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const o = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, c = s + n;
    o.push(xe(a.slice(s, c)));
  }
  return {
    frameCount: r,
    frames: o
  };
}
function ie(t) {
  const e = xe(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Te(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function mt(t, e, {
  mipLevelCount: n = Se
} = {}) {
  const i = t?.real?.length ?? 0;
  v(i > 0, "Spectrum must contain real samples"), v(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), v(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const a = Math.min(1 << e, i >> 1), r = new Float64Array(i), o = new Float64Array(i);
  for (let l = 1; l <= a; l += 1) {
    r[l] = t.real[l], o[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], o[s] = t.imaginary[s]);
  }
  return Te(r, o, !0), Float32Array.from(r);
}
const g = (t, e) => ({ label: t, value: e });
function y(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const S = Object.freeze({
  filter: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: y(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), d = (t, e, n, i, a, r, o, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: a,
  max: r,
  initial: o,
  step: l.step ?? (r - a) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), pt = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], gt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], bt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: S.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(g), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: S.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [g("Classic", 0), g("Harmonics", 1)] }),
      d("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      d("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      d("drive", "distortionWet", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 5 }),
      d("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      d("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: S.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      d("ott", "ottMix", "Mix", "Mix", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
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
    iconUrl: S.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(g) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(g) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(g) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: S.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      d("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      d("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      d("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      d("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: S.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [g("Free", 0), g("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: pt.map(g) }),
      d("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      d("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      d("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      d("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      d("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: S.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [g("Free", 0), g("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: gt.map(g) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: S.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      d("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      d("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      d("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      d("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], Re = bt, we = Object.freeze(
  Re.flatMap((t) => t.parameters)
);
new Map(
  we.map((t) => [t.endpointID, t])
);
function Ee() {
  return we;
}
const Ae = ["A", "B", "C"], It = [
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
], vt = [
  "filterCutoffOctaves",
  "filterQ"
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
  ...Ae.flatMap((t) => It.map(
    (e) => `osc${t}.${e}`
  )),
  ...vt
]), Me = Object.freeze(
  yt.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), St = Ee().filter((t) => t.modulationTargetIndex !== null), Fe = Object.freeze(
  St.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), T = Object.freeze([
  ...Me,
  ...Fe
]), D = w.length, Tt = Me.length, xt = Fe.length, Rt = D * T.length, wt = new Map(w.map((t) => [t.id, t])), Et = new Map(w.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), At = new Map(T.map((t) => [t.kind, t]));
function Mt() {
  if (D !== 13 || Tt !== 32 || xt !== 36 || Rt !== 884)
    throw new Error("Modulation identity catalog has an unexpected domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = w.filter((a) => a.group === t), i = n.map((a) => a.runtimeIndex).sort((a, r) => a - r);
    if (n.length !== e || i.some((a, r) => a !== r))
      throw new Error(`Modulation ${t} source indexes must be unique and contiguous`);
  }
  for (const [t, e] of [["voice", 32], ["rack", 36]]) {
    const n = T.filter((a) => a.group === t), i = n.map((a) => a.runtimeIndex).sort((a, r) => a - r);
    if (n.length !== e || i.some((a, r) => a !== r))
      throw new Error(`Modulation ${t} target indexes must be unique and contiguous`);
  }
  if (wt.size !== D || Et.size !== D || At.size !== T.length)
    throw new Error("Modulation identities must be unique");
}
Mt();
w.filter((t) => t.group === "voice").length;
w.filter((t) => t.group === "macro").length;
function Ft(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function re(t) {
  throw new Error(t ?? "Invariant violated");
}
function U(t, e, n, i, a = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: a, compound: r };
}
const Dt = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      U("cutoff", "Cutoff", 67, 70, "frequency"),
      U("resonance", "Resonance", 25, 0),
      U("drive", "Drive", 15, 0)
    ]
  }
], ae = 1e-6;
function L(t, e) {
  if (!Number.isFinite(t) || t < -ae || t > 1 + ae)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function C(t, e) {
  return L(t / 100, `${e} catalog percentage`);
}
function De(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Ct(t) {
  return 20 * 1e3 ** t;
}
function kt(t) {
  return L(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Lt(t) {
  return 0.1 * 200 ** t;
}
function Ot(t) {
  return L(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function oe(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Pt(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: oe("filterCutoff", Ct, kt),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: oe("filterQ", Lt, Ot),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
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
function Ce(t) {
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
      return Ft(t);
  }
}
function Ut(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function _t(t, e) {
  const n = De(t.moduleId, e.id), i = Ce(e.format), a = Pt(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: C(e.defaultPercent, n),
    initialValue: C(e.initialPercent, n),
    format: i,
    modAmount: Ut(i),
    binding: a.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: a.articulationParameterId,
    modulationTargetKind: a.modulationTargetKind
  });
}
const Nt = [
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
function Bt(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Kt(t, e) {
  const n = `osc${t}`, i = De(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: C(e.defaultPercent, i),
    initialValue: C(e.initialPercent, i),
    format: Ce(e.format),
    modAmount: Bt(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Vt = Object.freeze(
  Ae.flatMap((t) => Nt.map((e) => Kt(t, e)))
);
function $t(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function _(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return L(n, `${t.endpointID} endpoint conversion`);
}
function zt(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Wt(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function qt(t) {
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
function Ht(t) {
  const e = $t(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: _(t, t.initial),
    initialValue: _(t, t.initial),
    format: Wt(t),
    modAmount: qt(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => zt(t, n),
      fromEngine: (n) => _(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const $ = Object.freeze(
  [
    ...Re.flatMap((t) => t.parameters.map(Ht)),
    ...Vt,
    ...Dt.flatMap(
      (t) => t.parameters.map(
        (e) => _t(t, e)
      )
    )
  ]
), Jt = new Map(
  $.map((t) => [t.targetId, t])
), ke = $.filter(
  (t) => t.modulationTargetKind !== null
), k = new Map(
  ke.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Jt.size !== $.length)
  throw new Error("Target descriptor IDs must be unique");
if (ke.length !== T.length || k.size !== T.length || T.some((t) => k.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function jt(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = k.get(t);
    return i === void 0 ? re(`Modulation target "${t}" has no display descriptor`) : `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = k.get(t);
  return n === void 0 ? re(`Modulation target "${t}" has no display descriptor`) : n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const Gt = Ee().filter((t) => t.modulationTargetIndex !== null);
new Map(
  Gt.map((t) => [`rack.${t.endpointID}`, t])
);
const Qt = {
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
  label: Qt[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
T.map((t) => ({
  value: t.kind,
  label: jt(t.kind)
}));
const Yt = "runtimeSyncRequest", Zt = 2147483647, Xt = "runtimeState", en = "retryDesiredTableRequest", tn = "workerLoadFailure", nn = "serviceLoadAbort", rn = "wavetableLoadBegin", an = "wavetableMipFrame", on = "wavetableUploadAck", sn = "wavetableMipRequest", ln = "wavetablePrewarmRequest", dn = "wavetablePrewarmNotification", cn = "assets/factory-bank-catalog.json", un = 1, hn = 2, fn = 3, mn = 1, pn = 2, gn = 2e4, F = un, bn = hn, se = fn, x = mn, le = pn, In = 48 * 1024 * 1024;
function de(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function h(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function ce(t) {
  return {
    dspSessionId: t.dspSessionId,
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
function ue(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function he(t, e) {
  if (!t)
    throw new Error(e);
}
function vn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function yn(t, e) {
  return lt(await t.readJSON(e));
}
function Sn(t) {
  return {
    dspSessionId: Math.trunc(Number(t?.dspSessionId) || 0),
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
function Tn(t, e) {
  const n = Math.round(Number(t) || 0);
  return vn(n, 0, Math.max(0, e - 1));
}
function N(t, e, n) {
  return `${t}:${e}:${n}`;
}
function xn(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function fe(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function me(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function pe() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class Rn {
  connection;
  resourceClient;
  catalogPath;
  maxFramesInFlight;
  mipLevelCount;
  cacheBudgetBytes;
  serviceLoadTimeoutMs;
  setTimeoutFn;
  clearTimeoutFn;
  catalog = null;
  started = !1;
  knownSessionId = 0;
  nextLoadGeneration = 1;
  latestRuntimeState = null;
  asyncStateToken = 0;
  serviceTable = null;
  candidateValidation = null;
  mipJobs = /* @__PURE__ */ new Map();
  activeUploadKey = null;
  serviceLoadWatchdogHandle = null;
  autoRetryConsumedKey = null;
  tableCache = /* @__PURE__ */ new Map();
  tableCacheBytes = 0;
  cacheUseSerial = 1;
  constructor(e, n = {}) {
    this.connection = e, this.resourceClient = st(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? cn, this.maxFramesInFlight = de(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? Se, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? In) || 0)), this.serviceLoadTimeoutMs = de(n.serviceLoadTimeoutMs, gn), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, h("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Xt, this.handleRuntimeState), this.connection.addEndpointListener?.(on, this.handleUploadAck), this.connection.addEndpointListener?.(sn, this.handleMipRequest), this.connection.addEndpointListener?.(ln, this.handlePrewarmRequest), this.connection.addEndpointListener?.(dn, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Yt,
      Zt
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await yn(this.resourceClient, this.catalogPath), h("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.nextLoadGeneration = Math.max(1, e.generationFrontier + 1), this.serviceTable = null, this.candidateValidation = null, this.mipJobs.clear(), this.activeUploadKey = null, this.autoRetryConsumedKey = null;
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog(), this.mipJobs.clear(), this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(e) {
    this.tableCacheBytes -= e.byteCount, e.byteCount = fe(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: fe(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = N(
          this.serviceTable.dspSessionId,
          this.serviceTable.generation,
          n
        );
        this.mipJobs.has(i) || this.mipJobs.set(i, {
          key: i,
          dspSessionId: this.serviceTable.dspSessionId,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...me(this.serviceTable.frameCount),
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
      if (e.dspSessionId === this.serviceTable.dspSessionId && e.generation === this.serviceTable.generation && e.tableIndex === this.serviceTable.tableIndex && !e.completed && (e.inFlightFrames.size > 0 || e.nextFrameIndex > 0))
        return !0;
    return !1;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId: e, generation: n, tableIndex: i } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.generation !== n || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (h("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        generation: n,
        tableIndex: i,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          generation: n,
          tableIndex: i
        },
        {
          failurePhase: se,
          failureReasonCode: le
        }
      ), this.serviceTable = null, this.clearMipTransferState());
    }, this.serviceLoadTimeoutMs), this.serviceLoadWatchdogHandle?.unref?.();
  }
  resolveServiceTarget(e) {
    return e.hasLoading ? {
      kind: "loading",
      dspSessionId: e.dspSessionId,
      generation: e.loadingGeneration,
      tableIndex: e.loadingTableIndex
    } : e.hasActive ? {
      kind: "active",
      dspSessionId: e.dspSessionId,
      generation: e.activeGeneration,
      tableIndex: e.activeTableIndex
    } : null;
  }
  shouldStayIdleOnFailure(e) {
    return e.hasFailure && e.failedTableIndex === e.desiredTableIndex && e.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(e) {
    return `${e.dspSessionId}:${e.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(e) {
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== se || e.failureReasonCode !== le ? !1 : this.autoRetryConsumedKey !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    tableIndex: n,
    generation: i = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: r = F,
    failureReasonCode: o = x
  }) {
    this.connection.sendEventOrValue?.(tn, {
      dspSessionId: e,
      tableIndex: n,
      generation: i,
      candidateAttemptSerial: a,
      failurePhase: r,
      failureReasonCode: o
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    generation: n,
    tableIndex: i,
    failureReasonCode: a = x
  }) {
    this.connection.sendEventOrValue?.(nn, {
      dspSessionId: e,
      generation: n,
      tableIndex: i,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest() {
    h("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? ce(this.latestRuntimeState) : null
    }), this.connection.sendEventOrValue?.(en, 1);
  }
  async loadTableSource(e, n, i) {
    const a = await this.ensureCatalogLoaded();
    if (i !== this.asyncStateToken)
      return null;
    const r = Tn(e, a.tables.length), o = a.tables[r];
    he(o, `Could not resolve table ${r}`);
    const l = xn(o, te, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, h("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = pe();
    h("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const m = await this.resourceClient.readAudio(o.sourceWav), u = ft(m.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: te
    });
    return !u || i !== this.asyncStateToken ? null : (h("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(pe() - c)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: r,
      tableMeta: o,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    }));
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    h("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: i.tableMeta?.name ?? null,
      frameCount: i.frameCount
    }), this.serviceTable = {
      ...i,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidation = {
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGeneration = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(rn, {
      dspSessionId: e.dspSessionId,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    h("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: F,
      failureReasonCode: x
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: F,
      failureReasonCode: x
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = F,
    failureReasonCode: i = x
  } = {}) {
    h("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: i
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: i
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: i
    });
  }
  async prepareServiceTarget(e, n, i) {
    if (this.isMatchingServiceTable(e))
      return this.serviceTable && (this.serviceTable.mode = e.kind), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0;
    let a = null;
    try {
      a = await this.loadTableSource(e.tableIndex, void 0, i);
    } catch (r) {
      return i === this.asyncStateToken && (h("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: B(r)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    return !a || i !== this.asyncStateToken ? !1 : (this.serviceTable = {
      ...a,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads()), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0);
  }
  async prepareDesiredLoad(e, n) {
    const i = e.desiredTableIndex;
    if (this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.tableIndex === i && this.candidateValidation.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const a = Math.max(
      this.nextLoadGeneration,
      e.generationFrontier + 1
    );
    let r = null;
    try {
      r = await this.loadTableSource(i, void 0, n);
    } catch (o) {
      n === this.asyncStateToken && (h("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: i,
        detail: B(o)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !r || n !== this.asyncStateToken || this.markCommittedDesiredLoad(e, a, r);
  }
  async prepareDesiredCandidate(e, n) {
    await this.prepareDesiredLoad(e, n);
  }
  async handleRuntimeState(e) {
    try {
      const n = Sn(e ?? {});
      if (h("info", "Received runtime state", ce(n)), n.dspSessionId <= 0)
        return;
      const i = n.dspSessionId !== this.knownSessionId, a = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null, r = this.getDesiredRetryKey(n);
      i ? this.resetSessionState(n) : this.nextLoadGeneration = Math.max(
        this.nextLoadGeneration,
        n.generationFrontier + 1
      ), (i || a !== r) && (this.autoRetryConsumedKey = null), this.latestRuntimeState = n;
      const o = this.asyncStateToken + 1;
      if (this.asyncStateToken = o, this.candidateValidation && this.candidateValidation.dspSessionId === n.dspSessionId && this.candidateValidation.generation > n.generationFrontier)
        return;
      const l = this.resolveServiceTarget(n), s = i && l?.kind === "active";
      if (l) {
        if (!await this.prepareServiceTarget(l, n, o))
          return;
        if (l.kind === "loading" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n)) {
          h("warn", "Aborting obsolete wavetable load because the desired table changed", {
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            staleTableIndex: l.tableIndex,
            desiredTableIndex: n.desiredTableIndex,
            desiredIntentSerial: n.desiredIntentSerial
          }), this.emitServiceLoadAbort({
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            tableIndex: l.tableIndex,
            failureReasonCode: x
          }), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        l.kind === "active" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n) && !s && await this.prepareDesiredCandidate(n, o);
        return;
      }
      if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(n)) {
        this.autoRetryConsumedKey = r, this.emitRetryDesiredTableRequest();
        return;
      }
      if (n.serviceState !== 0 || this.shouldStayIdleOnFailure(n))
        return;
      await this.prepareDesiredLoad(n, o);
    } catch (n) {
      console.error(n);
    }
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (!Number.isFinite(i))
      return;
    const a = this.asyncStateToken;
    try {
      const r = await this.loadTableSource(i, void 0, a);
      if (!r || a !== this.asyncStateToken)
        return;
      for (let l = 0; l < r.frameCount; l += 1)
        r.spectra[l] || (r.spectra[l] = ie(r.frames[l]));
      const o = this.tableCache.get(r.cacheKey);
      o && this.refreshCacheEntryByteCount(o), h("info", "Prewarmed wavetable source table", {
        tableIndex: r.tableIndex,
        tableId: r.tableMeta.tableId,
        tableName: r.tableMeta.name,
        reason: typeof n?.reason == "string" ? n.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (r) {
      h("warn", "Ignoring wavetable prewarm failure", {
        tableIndex: i,
        reason: typeof n?.reason == "string" ? n.reason : null,
        detail: B(r)
      });
    }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.generation)), a = Math.trunc(Number(e?.tableIndex)), r = Math.trunc(Number(e?.mipIndex)), o = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || r < 0 || r >= this.mipLevelCount)
      return null;
    const l = N(n, i, r);
    let s = this.mipJobs.get(l);
    return s ? (!s.completed && o > s.urgencyLevel && (s.urgencyLevel = o), s) : (s = {
      key: l,
      dspSessionId: n,
      generation: i,
      tableIndex: a,
      mipIndex: r,
      urgencyLevel: o,
      ...me(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, s), s);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (h("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), a = Math.trunc(Number(n.generation)), r = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndex)), l = N(i, a, r), s = this.mipJobs.get(l);
    !s || s.completed || !s.inFlightFrames.has(o) || (s.inFlightFrames.delete(o), s.ackedFrames[o] || (s.ackedFrames[o] = 1, s.ackedFrameCount += 1), s.ackedFrameCount === this.serviceTable?.frameCount && s.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && s.inFlightFrames.size === 0 && (s.completed = !0, this.activeUploadKey === s.key && (this.activeUploadKey = null)), ue(o, this.serviceTable?.frameCount ?? 0) && h("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      generation: a,
      tableIndex: s.tableIndex,
      mipIndex: r,
      frameIndex: o,
      ackedFrameCount: s.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (he(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = ie(this.serviceTable.frames[e]);
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
  pumpUploads() {
    if (!this.serviceTable)
      return;
    let e = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!e || e.completed) && (e = this.selectNextMipJob(), this.activeUploadKey = e?.key ?? null), !!e) {
      for (; e.inFlightFrames.size < this.maxFramesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
        const n = e.nextFrameIndex;
        let i;
        try {
          const a = this.getSpectrumForFrame(n);
          i = mt(a, e.mipIndex);
        } catch {
          this.handleServiceTargetFailure(
            {
              kind: this.serviceTable.mode ?? "loading",
              dspSessionId: e.dspSessionId,
              generation: e.generation,
              tableIndex: e.tableIndex
            },
            {
              failurePhase: bn,
              failureReasonCode: x
            }
          ), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        this.connection.sendEventOrValue?.(an, {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          samples: Array.from(i)
        }), ue(n, this.serviceTable.frameCount) && h("info", "Sent wavetable mip frame", {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          frameCount: this.serviceTable.frameCount,
          inFlightFrames: e.inFlightFrames.size + 1
        }), e.inFlightFrames.add(n), e.nextFrameIndex += 1, this.armServiceLoadWatchdog();
      }
      e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightFrames.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
    }
  }
}
function B(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function wn(t, e = {}) {
  return new Rn(t, e);
}
async function En(t, e = {}) {
  return Ue(t, [
    Ze,
    () => wn(t, e)
  ]);
}
export {
  En as default
};
