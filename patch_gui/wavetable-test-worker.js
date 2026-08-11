class Re {
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
function Fe(t, e) {
  return new Re(t, e);
}
async function Ee(t, e) {
  const n = Fe(t, e);
  return await n.start(), n;
}
const I = "rack.v1", ke = "rackOrder", Ae = "rackEnable", E = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), he = Object.freeze({
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
  E.map((t) => [he[t], t])
);
function fe() {
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
function H() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...E],
    enabled: fe()
  };
}
function Me(t) {
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
function J(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ce(t) {
  return typeof t != "string" ? null : E.find((e) => e === t) ?? null;
}
function De(t) {
  const e = Me(t);
  if (e._tag === "err")
    return e;
  if (!J(e.value))
    return { _tag: "err", message: `${I} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${I} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${I} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== E.length)
    return { _tag: "err", message: `${I}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const l = Ce(s);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${I}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!J(e.value.enabled))
    return { _tag: "err", message: `${I}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== E.length)
    return { _tag: "err", message: `${I}.enabled must contain every effect once` };
  const a = fe();
  for (const s of E) {
    const l = e.value.enabled[s];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${I}.enabled.${s} must be boolean` };
    a[s] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: a }
  };
}
function Le(t) {
  if (t === void 0)
    return H();
  const e = De(t);
  return e._tag === "ok" ? e.value : H();
}
function Pe(t) {
  return [
    {
      endpointID: ke,
      value: { moduleIds: t.order.map((e) => he[e]) }
    },
    {
      endpointID: Ae,
      value: { enabledFlags: E.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const Ue = "runtimeState";
function Ne(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const _e = {
  endpointID: Ue,
  required: !0,
  mapValue: Ne
}, Oe = 2e3;
function j(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Be(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return j(i, e) ? {
    found: !0,
    value: i[e]
  } : j(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function G(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class We {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Ve(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Be(e, this.options.stateKey);
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
    }, r = G(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, s = this.options.buildRuntimeEvents(i, a), l = G({
      runtimeEndpoints: n,
      events: s
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (s.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(s, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(s);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(s);
        const o = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, o && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const o of s)
      this.connection.sendEventOrValue?.(
        o.endpointID,
        o.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Oe
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Ve(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function $e(t, e) {
  return new We(t, e);
}
function ze(t) {
  return $e(t, {
    stateKey: I,
    runtimeEndpointDependencies: [_e],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Le,
    buildRuntimeEvents: ({ state: e }) => [...Pe(e)]
  });
}
function v(t, e) {
  if (!t)
    throw new Error(e);
}
function L(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Ke(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function O(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function me(t) {
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
function qe() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function P(t, e) {
  const n = qe();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Ke(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Q(t) {
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
  throw new Error(`Unsupported text resource payload (${me(t)})`);
}
function He(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return O(t);
  throw new Error(`Unsupported binary resource payload (${me(t)})`);
}
function Je(t) {
  const e = t?.frames;
  v(
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
      const s = a;
      v(s.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(s[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function pe(t) {
  const e = new DataView(t);
  v(L(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), v(L(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, s = null, l = null, o = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = L(e, c, 4), g = e.getUint32(c + 4, !0), f = c + 8;
    u === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), r = e.getUint32(f + 4, !0), s = e.getUint16(f + 12, !0), a = e.getUint16(f + 14, !0)) : u === "data" && (l = f, o = g), c = f + g + g % 2;
  }
  v(n !== null, "Wave file is missing a fmt chunk"), v(l !== null && o !== null, "Wave file is missing a data chunk"), v(i === 1, "Only mono wavetable bank files are supported");
  let p;
  if (n === 3 && a === 32)
    p = new Float32Array(t.slice(l, l + o));
  else if (n === 1 && a === 16) {
    const u = o / 2, g = new Int16Array(t.slice(l, l + o));
    p = new Float32Array(u);
    for (let f = 0; f < u; f += 1)
      p[f] = g[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: s ?? 0,
    samples: p
  };
}
async function Y(t) {
  v(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return v(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function B(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ge(t) {
  const e = new Uint8Array(t).buffer, n = pe(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function je(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (v(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), r = async (o) => {
    v(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const c = await t.readResourceAsAudioData(o);
    return Je(c);
  }, a = (o) => {
    const c = t.getResourceAddress?.(o);
    return c ?? null;
  }, s = async (o, c = t.getResourceAddress?.(o)) => {
    const p = P(o, c), u = await Y(p), g = pe(u);
    return {
      sampleRate: g.sampleRate,
      samples: g.samples
    };
  }, l = async (o, c = t.getResourceAddress?.(o)) => {
    const p = P(o, c);
    return new Uint8Array(await Y(p));
  };
  return {
    async readText(o) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Q(await i(o));
      const c = a(o);
      return e === "url" && c !== null ? B(await l(o, c)) : typeof t.readResource == "function" ? Q(await i(o)) : B(await l(o, c));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? He(await i(o)) : l(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(o);
      const c = a(o);
      return n === "url" && c !== null ? s(o, c) : typeof t.readResourceAsAudioData == "function" ? r(o) : ge(await this.readBytes(o));
    },
    getURL(o) {
      return P(o, t.getResourceAddress?.(o));
    }
  };
}
function Ge(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return je(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Qe(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(s) {
      if (e)
        return e(s);
      if (n)
        return JSON.stringify(await n(s));
      if (i)
        return B(await i(s));
      throw new Error(`Resource client cannot read text ${s}`);
    },
    async readJSON(s) {
      return n ? n(s) : JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      if (i)
        return i(s);
      if (e)
        return O(await e(s));
      if (n)
        return O(JSON.stringify(await n(s)));
      throw new Error(`Resource client cannot read bytes ${s}`);
    },
    async readAudio(s) {
      return r ? r(s) : ge(await this.readBytes(s));
    },
    getURL(s) {
      return a ? a(s) : null;
    }
  };
}
function Ye(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Ze(t) {
  return Ye(t) ? Qe(t) : Ge(t);
}
const Z = 2048;
function M(t, e) {
  if (!t)
    throw new Error(e);
}
function Xe(t) {
  M(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    M(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), M(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), M(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), M(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const et = 2048, be = 11, tt = 256;
function S(t, e) {
  if (!t)
    throw new Error(e);
}
function nt(t) {
  return t > 0 && (t & t - 1) === 0;
}
const X = /* @__PURE__ */ new Map();
function it(t) {
  const e = X.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, s = r;
    for (let l = 0; l < n; l += 1)
      a = a << 1 | s & 1, s >>= 1;
    i[r] = a;
  }
  return X.set(t, i), i;
}
function Ie(t, e, n = !1) {
  const i = t.length;
  S(i === e.length, "FFT real and imaginary buffers must have the same length"), S(nt(i), "FFT input length must be a power of two");
  const r = it(i);
  for (let a = 0; a < i; a += 1) {
    const s = r[a];
    if (s <= a)
      continue;
    const l = t[a];
    t[a] = t[s], t[s] = l;
    const o = e[a];
    e[a] = e[s], e[s] = o;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const s = a >> 1, l = (n ? 2 : -2) * Math.PI / a, o = Math.cos(l), c = Math.sin(l);
    for (let p = 0; p < i; p += a) {
      let u = 1, g = 0;
      for (let f = 0; f < s; f += 1) {
        const A = p + f, C = A + s, W = t[C], V = e[C], $ = u * W - g * V, z = u * V + g * W, K = t[A], q = e[A];
        t[A] = K + $, e[A] = q + z, t[C] = K - $, e[C] = q - z;
        const we = u * o - g * c;
        g = u * c + g * o, u = we;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function ve(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function at(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = et,
  maxFramesPerTable: i = tt
} = {}) {
  const r = Float32Array.from(t);
  S(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  S(a > 0, "Source wavetable files must contain at least one frame"), S(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && S(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const s = [];
  for (let l = 0; l < a; l += 1) {
    const o = l * n, c = o + n;
    s.push(ve(r.slice(o, c)));
  }
  return {
    frameCount: a,
    frames: s
  };
}
function ee(t) {
  const e = ve(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Ie(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function rt(t, e, {
  mipLevelCount: n = be
} = {}) {
  const i = t?.real?.length ?? 0;
  S(i > 0, "Spectrum must contain real samples"), S(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), S(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), s = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    a[l] = t.real[l], s[l] = t.imaginary[l];
    const o = (i - l) % i;
    o !== l && (a[o] = t.real[o], s[o] = t.imaginary[o]);
  }
  return Ie(a, s, !0), Float32Array.from(a);
}
const b = (t, e) => ({ label: t, value: e });
function T(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const x = Object.freeze({
  filter: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), d = (t, e, n, i, r, a, s, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: s,
  step: l.step ?? (a - r) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), st = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ot = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], lt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: x.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(b), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: x.drive,
    initialQuickEndpointID: "distortionDriveDb",
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Classic", 0), b("Harmonics", 1)] }),
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
    iconUrl: x.ott,
    initialQuickEndpointID: "ottAmount",
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
    iconUrl: x.chorus,
    initialQuickEndpointID: "chorusMix",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(b) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(b) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(b) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: x.flanger,
    initialQuickEndpointID: "flangerRate",
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
    iconUrl: x.phaser,
    initialQuickEndpointID: "phaserRate",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: st.map(b) }),
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
    iconUrl: x.delay,
    initialQuickEndpointID: "delayTime",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ot.map(b) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: x.reverb,
    initialQuickEndpointID: "reverbSize",
    parameters: [
      d("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      d("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      d("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      d("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], ye = lt, Se = Object.freeze(
  ye.flatMap((t) => t.parameters)
);
new Map(
  Se.map((t) => [t.endpointID, t])
);
function Te() {
  return Se;
}
const dt = 36;
function ct(t) {
  const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = i.modulationTargetIndex;
    if (r === null)
      continue;
    if (!Number.isInteger(r) || r < 0 || r >= dt)
      throw new Error(
        `Invalid rack modulation target index ${String(r)} for ${i.endpointID}`
      );
    const a = n.get(r);
    if (a !== void 0)
      throw new Error(
        `Duplicate rack modulation target index ${r}: ${a} and ${i.endpointID}`
      );
    n.set(r, i.endpointID), e.set(`rack.${i.endpointID}`, r);
  }
  return e;
}
ct(Te());
function ut(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
const xe = Te().filter((t) => t.modulationTargetIndex !== null);
new Map(
  xe.map((t) => [`rack.${t.endpointID}`, t])
);
[
  ...xe.map((t) => ({
    value: `rack.${t.endpointID}`,
    label: `${t.effectId.toUpperCase()} ${t.shortLabel.toUpperCase()}`
  }))
];
function m(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const ht = [
  {
    moduleId: "wavetable",
    workspace: "voice",
    quickParameterId: "index",
    parameters: [
      m("index", "Index", 44, 0),
      m("warp", "Warp", 58, 50),
      m("unison", "Unison", 35, 0),
      m("unison-blend", "Uni Blend", 75, 75),
      m("unison-width", "Uni Width", 100, 100),
      m("unison-wt-spread", "Uni WT Spread", 0, 0),
      m("unison-warp-spread", "Uni Warp Spread", 0, 0),
      m("tune", "Tune", 50, 50, "semitone")
    ]
  },
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      m("cutoff", "Cutoff", 67, 70, "frequency"),
      m("resonance", "Resonance", 25, 0),
      m("drive", "Drive", 15, 0)
    ]
  },
  {
    moduleId: "amp-pan",
    workspace: "voice",
    quickParameterId: "level",
    parameters: [
      m("level", "Level", 80, 80),
      m("pan", "Pan", 50, 50, "signed"),
      m("attack", "Attack", 10, 0),
      m("release", "Release", 35, 25)
    ]
  }
], te = 1e-6;
function k(t, e) {
  if (!Number.isFinite(t) || t < -te || t > 1 + te)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function ne(t, e) {
  return k(t / 100, `${e} catalog percentage`);
}
function ft(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function w(t) {
  return t;
}
function R(t) {
  return k(t, "identity endpoint conversion");
}
function mt(t) {
  return 20 * 1e3 ** t;
}
function pt(t) {
  return k(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function gt(t) {
  return 0.1 * 200 ** t;
}
function bt(t) {
  return k(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function It(t) {
  return t * 2 - 1;
}
function vt(t) {
  return k((t + 1) / 2, "pan endpoint conversion");
}
function y(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function yt(t, e) {
  switch (t) {
    case "wavetable.index":
      return {
        binding: y("wavetablePosition", w, R),
        articulationParameterId: "framePosition",
        modulationTargetKind: "wavetablePosition"
      };
    case "wavetable.warp":
      return {
        binding: y("warpAmount", w, R),
        articulationParameterId: "warpAmount",
        modulationTargetKind: "warpAmount"
      };
    case "wavetable.unison":
      return {
        binding: y("unisonDetune", w, R),
        articulationParameterId: "unisonDetune",
        modulationTargetKind: "unisonDetune"
      };
    case "wavetable.unison-blend":
      return {
        binding: y("unisonBlend", w, R),
        articulationParameterId: "unisonBlend",
        modulationTargetKind: "unisonBlend"
      };
    case "wavetable.unison-width":
      return {
        binding: y("unisonWidth", w, R),
        articulationParameterId: "unisonWidth",
        modulationTargetKind: "unisonWidth"
      };
    case "wavetable.unison-wt-spread":
      return {
        binding: y("unisonWavetablePositionSpread", w, R),
        articulationParameterId: "unisonWavetablePositionSpread",
        modulationTargetKind: "unisonWavetablePositionSpread"
      };
    case "wavetable.unison-warp-spread":
      return {
        binding: y("unisonWarpSpread", w, R),
        articulationParameterId: "unisonWarpSpread",
        modulationTargetKind: "unisonWarpSpread"
      };
    case "voice-filter.cutoff":
      return {
        binding: y("filterCutoff", mt, pt),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: y("filterQ", gt, bt),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "amp-pan.pan":
      return {
        binding: y("pan", It, vt),
        articulationParameterId: "pan",
        modulationTargetKind: "pan"
      };
    case "wavetable.tune":
      return {
        binding: { _tag: "unbacked", reason: "no-endpoint" },
        articulationParameterId: null,
        modulationTargetKind: "pitchSemitones"
      };
    case "amp-pan.level":
      return {
        binding: { _tag: "unbacked", reason: "no-endpoint" },
        articulationParameterId: null,
        modulationTargetKind: "ampGainDb"
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
function St(t) {
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
      return ut(t);
  }
}
function Tt(t, e) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "amp-pan.level" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "amp-pan.pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function xt(t, e) {
  const n = ft(t.moduleId, e.id), i = St(e.format), r = yt(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: ne(e.defaultPercent, n),
    initialValue: ne(e.initialPercent, n),
    format: i,
    modAmount: Tt(i, n),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
function wt(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function U(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return k(n, `${t.endpointID} endpoint conversion`);
}
function Rt(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ft(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Et(t) {
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
function kt(t) {
  const e = wt(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: U(t, t.initial),
    initialValue: U(t, t.initial),
    format: Ft(t),
    modAmount: Et(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Rt(t, n),
      fromEngine: (n) => U(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const At = Object.freeze(
  [
    ...ye.flatMap((t) => t.parameters.map(kt)),
    ...ht.flatMap(
      (t) => t.parameters.map(
        (e) => xt(t, e)
      )
    )
  ]
);
new Map(
  At.map((t) => [t.targetId, t])
);
const Mt = "runtimeSyncRequest", Ct = 2147483647, Dt = "runtimeState", Lt = "retryDesiredTableRequest", Pt = "workerLoadFailure", Ut = "serviceLoadAbort", Nt = "wavetableLoadBegin", _t = "wavetableMipFrame", Ot = "wavetableUploadAck", Bt = "wavetableMipRequest", Wt = "wavetablePrewarmRequest", Vt = "wavetablePrewarmNotification", $t = "assets/factory-bank-catalog.json", zt = 1, Kt = 2, qt = 3, Ht = 1, Jt = 2, jt = 2e4, D = zt, Gt = Kt, ie = qt, F = Ht, ae = Jt, Qt = 48 * 1024 * 1024;
function re(t, e) {
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
function se(t) {
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
function oe(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function le(t, e) {
  if (!t)
    throw new Error(e);
}
function Yt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Zt(t, e) {
  return Xe(await t.readJSON(e));
}
function Xt(t) {
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
function en(t, e) {
  const n = Math.round(Number(t) || 0);
  return Yt(n, 0, Math.max(0, e - 1));
}
function N(t, e, n) {
  return `${t}:${e}:${n}`;
}
function tn(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function de(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function ce(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function ue() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class nn {
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
    this.connection = e, this.resourceClient = Ze(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? $t, this.maxFramesInFlight = re(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? be, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Qt) || 0)), this.serviceLoadTimeoutMs = re(n.serviceLoadTimeoutMs, jt), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, h("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Dt, this.handleRuntimeState), this.connection.addEndpointListener?.(Ot, this.handleUploadAck), this.connection.addEndpointListener?.(Bt, this.handleMipRequest), this.connection.addEndpointListener?.(Wt, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Vt, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Mt,
      Ct
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Zt(this.resourceClient, this.catalogPath), h("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = de(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: de(e),
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
          ...ce(this.serviceTable.frameCount),
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
          failurePhase: ie,
          failureReasonCode: ae
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== ie || e.failureReasonCode !== ae ? !1 : this.autoRetryConsumedKey !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    tableIndex: n,
    generation: i = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = D,
    failureReasonCode: s = F
  }) {
    this.connection.sendEventOrValue?.(Pt, {
      dspSessionId: e,
      tableIndex: n,
      generation: i,
      candidateAttemptSerial: r,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    generation: n,
    tableIndex: i,
    failureReasonCode: r = F
  }) {
    this.connection.sendEventOrValue?.(Ut, {
      dspSessionId: e,
      generation: n,
      tableIndex: i,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest() {
    h("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? se(this.latestRuntimeState) : null
    }), this.connection.sendEventOrValue?.(Lt, 1);
  }
  async loadTableSource(e, n, i) {
    const r = await this.ensureCatalogLoaded();
    if (i !== this.asyncStateToken)
      return null;
    const a = en(e, r.tables.length), s = r.tables[a];
    le(s, `Could not resolve table ${a}`);
    const l = tn(s, Z, this.mipLevelCount), o = this.tableCache.get(l);
    if (o)
      return o.lastUsedSerial = this.cacheUseSerial++, h("info", "Using cached wavetable source table", {
        tableIndex: a,
        tableId: s.tableId,
        tableName: s.name,
        sourceWav: s.sourceWav,
        frameCount: o.frameCount,
        cacheBytes: this.tableCacheBytes
      }), o;
    const c = ue();
    h("info", "Reading wavetable source", {
      tableIndex: a,
      tableId: s.tableId,
      tableName: s.name,
      sourceWav: s.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(s.frameCount) : n
    });
    const p = await this.resourceClient.readAudio(s.sourceWav), u = at(p.samples, {
      expectedFrameCount: n === void 0 ? Number(s.frameCount) : n,
      samplesPerFrame: Z
    });
    return !u || i !== this.asyncStateToken ? null : (h("info", "Prepared wavetable source table", {
      tableIndex: a,
      tableId: s.tableId,
      tableName: s.name,
      sourceWav: s.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(ue() - c)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: a,
      tableMeta: s,
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
    }, this.nextLoadGeneration = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Nt, {
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
      failurePhase: D,
      failureReasonCode: F
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: D,
      failureReasonCode: F
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = D,
    failureReasonCode: i = F
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
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex, void 0, i);
    } catch (a) {
      return i === this.asyncStateToken && (h("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: _(a)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    return !r || i !== this.asyncStateToken ? !1 : (this.serviceTable = {
      ...r,
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
    const r = Math.max(
      this.nextLoadGeneration,
      e.generationFrontier + 1
    );
    let a = null;
    try {
      a = await this.loadTableSource(i, void 0, n);
    } catch (s) {
      n === this.asyncStateToken && (h("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: i,
        detail: _(s)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !a || n !== this.asyncStateToken || this.markCommittedDesiredLoad(e, r, a);
  }
  async prepareDesiredCandidate(e, n) {
    await this.prepareDesiredLoad(e, n);
  }
  async handleRuntimeState(e) {
    try {
      const n = Xt(e ?? {});
      if (h("info", "Received runtime state", se(n)), n.dspSessionId <= 0)
        return;
      const i = n.dspSessionId !== this.knownSessionId, r = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null, a = this.getDesiredRetryKey(n);
      i ? this.resetSessionState(n) : this.nextLoadGeneration = Math.max(
        this.nextLoadGeneration,
        n.generationFrontier + 1
      ), (i || r !== a) && (this.autoRetryConsumedKey = null), this.latestRuntimeState = n;
      const s = this.asyncStateToken + 1;
      if (this.asyncStateToken = s, this.candidateValidation && this.candidateValidation.dspSessionId === n.dspSessionId && this.candidateValidation.generation > n.generationFrontier)
        return;
      const l = this.resolveServiceTarget(n), o = i && l?.kind === "active";
      if (l) {
        if (!await this.prepareServiceTarget(l, n, s))
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
            failureReasonCode: F
          }), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        l.kind === "active" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n) && !o && await this.prepareDesiredCandidate(n, s);
        return;
      }
      if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(n)) {
        this.autoRetryConsumedKey = a, this.emitRetryDesiredTableRequest();
        return;
      }
      if (n.serviceState !== 0 || this.shouldStayIdleOnFailure(n))
        return;
      await this.prepareDesiredLoad(n, s);
    } catch (n) {
      console.error(n);
    }
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (!Number.isFinite(i))
      return;
    const r = this.asyncStateToken;
    try {
      const a = await this.loadTableSource(i, void 0, r);
      if (!a || r !== this.asyncStateToken)
        return;
      for (let l = 0; l < a.frameCount; l += 1)
        a.spectra[l] || (a.spectra[l] = ee(a.frames[l]));
      const s = this.tableCache.get(a.cacheKey);
      s && this.refreshCacheEntryByteCount(s), h("info", "Prewarmed wavetable source table", {
        tableIndex: a.tableIndex,
        tableId: a.tableMeta.tableId,
        tableName: a.tableMeta.name,
        reason: typeof n?.reason == "string" ? n.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (a) {
      h("warn", "Ignoring wavetable prewarm failure", {
        tableIndex: i,
        reason: typeof n?.reason == "string" ? n.reason : null,
        detail: _(a)
      });
    }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = N(n, i, a);
    let o = this.mipJobs.get(l);
    return o ? (!o.completed && s > o.urgencyLevel && (o.urgencyLevel = s), o) : (o = {
      key: l,
      dspSessionId: n,
      generation: i,
      tableIndex: r,
      mipIndex: a,
      urgencyLevel: s,
      ...ce(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, o), o);
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndex)), l = N(i, r, a), o = this.mipJobs.get(l);
    !o || o.completed || !o.inFlightFrames.has(s) || (o.inFlightFrames.delete(s), o.ackedFrames[s] || (o.ackedFrames[s] = 1, o.ackedFrameCount += 1), o.ackedFrameCount === this.serviceTable?.frameCount && o.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && o.inFlightFrames.size === 0 && (o.completed = !0, this.activeUploadKey === o.key && (this.activeUploadKey = null)), oe(s, this.serviceTable?.frameCount ?? 0) && h("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      generation: r,
      tableIndex: o.tableIndex,
      mipIndex: a,
      frameIndex: s,
      ackedFrameCount: o.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (le(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = ee(this.serviceTable.frames[e]);
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
          const r = this.getSpectrumForFrame(n);
          i = rt(r, e.mipIndex);
        } catch {
          this.handleServiceTargetFailure(
            {
              kind: this.serviceTable.mode ?? "loading",
              dspSessionId: e.dspSessionId,
              generation: e.generation,
              tableIndex: e.tableIndex
            },
            {
              failurePhase: Gt,
              failureReasonCode: F
            }
          ), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        this.connection.sendEventOrValue?.(_t, {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          samples: Array.from(i)
        }), oe(n, this.serviceTable.frameCount) && h("info", "Sent wavetable mip frame", {
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
function _(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function an(t, e = {}) {
  return new nn(t, e);
}
async function rn(t, e = {}) {
  return Ee(t, [
    ze,
    () => an(t, e)
  ]);
}
export {
  rn as default
};
