function me(e, t) {
  if (!e)
    throw new Error(t);
}
function Xt(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function Yi(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function bn(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function go(e) {
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
function Ji() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function Zt(e, t) {
  const n = Ji();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (Yi(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function lr(e) {
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
  throw new Error(`Unsupported text resource payload (${go(e)})`);
}
function Qi(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return bn(e);
  throw new Error(`Unsupported binary resource payload (${go(e)})`);
}
function Xi(e) {
  const t = e?.frames;
  me(
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
      me(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function vo(e) {
  const t = new DataView(e);
  me(Xt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), me(Xt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, c = null, l = null, p = 12;
  for (; p + 8 <= t.byteLength; ) {
    const h = Xt(t, p, 4), m = t.getUint32(p + 4, !0), g = p + 8;
    h === "fmt " ? (n = t.getUint16(g, !0), r = t.getUint16(g + 2, !0), i = t.getUint32(g + 4, !0), a = t.getUint16(g + 12, !0), o = t.getUint16(g + 14, !0)) : h === "data" && (c = g, l = m), p = g + m + m % 2;
  }
  me(n !== null, "Wave file is missing a fmt chunk"), me(c !== null && l !== null, "Wave file is missing a data chunk"), me(r === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && o === 32)
    u = new Float32Array(e.slice(c, c + l));
  else if (n === 1 && o === 16) {
    const h = l / 2, m = new Int16Array(e.slice(c, c + l));
    u = new Float32Array(h);
    for (let g = 0; g < h; g += 1)
      u[g] = m[g] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: u
  };
}
async function dr(e) {
  me(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return me(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function In(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function yo(e) {
  const t = new Uint8Array(e).buffer, n = vo(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Zi(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (l) => (me(typeof e.readResource == "function", `Resource bridge cannot read ${l}`), e.readResource(l)), i = async (l) => {
    me(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const p = await e.readResourceAsAudioData(l);
    return Xi(p);
  }, o = (l) => {
    const p = e.getResourceAddress?.(l);
    return p ?? null;
  }, a = async (l, p = e.getResourceAddress?.(l)) => {
    const u = Zt(l, p), h = await dr(u), m = vo(h);
    return {
      sampleRate: m.sampleRate,
      samples: m.samples
    };
  }, c = async (l, p = e.getResourceAddress?.(l)) => {
    const u = Zt(l, p);
    return new Uint8Array(await dr(u));
  };
  return {
    async readText(l) {
      if (t === "bridge" && typeof e.readResource == "function")
        return lr(await r(l));
      const p = o(l);
      return t === "url" && p !== null ? In(await c(l, p)) : typeof e.readResource == "function" ? lr(await r(l)) : In(await c(l, p));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof e.readResource == "function" ? Qi(await r(l)) : c(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(l);
      const p = o(l);
      return n === "url" && p !== null ? a(l, p) : typeof e.readResourceAsAudioData == "function" ? i(l) : yo(await this.readBytes(l));
    },
    getURL(l) {
      return Zt(l, e.getResourceAddress?.(l));
    }
  };
}
function bo(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return Zi(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function ea(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return In(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return bn(await t(a));
      if (n)
        return bn(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : yo(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function ta(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function na(e) {
  return ta(e) ? ea(e) : bo(e);
}
function at(...e) {
  let t = !1;
  const n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = {
    get aborted() {
      return t;
    },
    onAbort(a) {
      return t ? a() : n.add(a), () => {
        n.delete(a);
      };
    }
  };
  function o() {
    if (t) return;
    t = !0;
    for (const c of r) c();
    r.clear();
    const a = [...n];
    n.clear();
    for (const c of a) c();
  }
  for (const a of e) {
    const c = a.onAbort(o);
    t ? c() : r.add(c);
  }
  return { signal: i, cancel: o };
}
function ur(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function en(e) {
  let t = !1, n;
  const r = () => n ??= Promise.resolve(e.transport.stop());
  let i, o;
  const a = /* @__PURE__ */ new Set();
  async function c(p, u, h) {
    const { signal: m } = h;
    if (e.onStatus(u, { kind: "preparing" }), m.aborted) return;
    const g = await ur(e.prepare(p, m), m);
    if (g.kind === "cancelled" || m.aborted) return;
    const I = g.value;
    if (I.kind === "error") {
      e.onStatus(u, { kind: "failed", error: I.error });
      return;
    }
    let S = !0;
    h.applying = !0;
    let v;
    try {
      v = await ur(e.transport.apply(I.value, {
        signal: m,
        send: (A) => m.aborted || !S ? { kind: "cancelled" } : A()
      }), m);
    } catch (A) {
      m.aborted || (t = !0, i?.cancel(), r(), e.onDefect(A), e.onStatus(u, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      S = !1, h.applying = !1;
    }
    v.kind === "value" && !m.aborted && v.value.kind !== "cancelled" && e.onStatus(u, v.value);
  }
  function l(p, u) {
    o = void 0;
    const h = i, m = { ...at(), applying: !1, target: u };
    if (i = m, h?.cancel(), t || m.signal.aborted) return;
    const g = c(p, u, m).catch((I) => {
      m.signal.aborted || (m.cancel(), e.onDefect(I), e.onStatus(u, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    a.add(g), g.then(() => {
      if (a.delete(g), i !== m) return;
      i = void 0;
      const I = o;
      o = void 0, !t && I && l(I.input, I.target);
    });
  }
  return {
    /** Apply the declared replacement policy; ignored after stop or a transport defect. */
    replace(p, u) {
      if (!t) {
        if (e.replacement === "finish" && i?.applying && !i.signal.aborted && i.target.scope.owner === u.scope.owner && i.target.scope.document === u.scope.document) {
          o = { input: p, target: u }, e.onStatus(u, { kind: "preparing" });
          return;
        }
        l(p, u);
      }
    },
    /** Revoke the current request, retaining the transport for a later replacement. */
    cancel() {
      o = void 0, i?.cancel();
    },
    /** Close permanently and settle owned work without waiting for uncooperative external promises. */
    async stop() {
      t || (t = !0, o = void 0, i?.cancel(), r()), await Promise.all([...a, n]);
    }
  };
}
let ra = 0;
function fr(e, t) {
  const n = `atom${++ra}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = oa, r.write = ia), r;
}
function oa(e) {
  return e(this);
}
function ia(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Io = "a", Me = "m", $t = "i", je = "c", Ln = "q", Cn = "Q", we = "h", So = "R", ko = "W", To = "I", Ao = "M", Ie = "e", Xe = "f", Ue = "C", Ze = "r", Nn = "d", Bt = "w", Ht = "D", qt = "t", Wt = "T", Pn = "v", mr = "g", pr = "s", hr = "b", aa = "B", Fn = "p", Eo = "H", xo = "A", Kn = "E";
function Ro(e) {
  return "init" in e;
}
function sa(e) {
  return typeof e.write == "function";
}
function ca(e) {
  return !!e.onMount;
}
function gr(e) {
  return "v" in e || "e" in e;
}
function wt(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function Dt(e) {
  return typeof e?.then == "function";
}
function la(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function Oo(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function Mo(e, t, n) {
  const i = n.get(e)?.t, o = t.p;
  if (!i?.size)
    return o;
  if (!o.size)
    return i;
  const a = new Set(i);
  for (const c of o)
    a.add(c);
  return a;
}
function da(e) {
  return !!e.INTERNAL_onInit;
}
const ua = (e, t, n, ...r) => n.read(...r), fa = (e, t, n, ...r) => n.write(...r), ma = (e, t, n) => n.INTERNAL_onInit(t), pa = (e, t, n, r) => n.onMount?.(r), ha = (e, t, n) => {
  const r = e[Io];
  let i = r.get(n);
  if (!i) {
    const o = e[we], a = e[To];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), da(n) && a(e, t, n);
  }
  return i;
}, ga = (e, t) => {
  const n = e[Me], r = e[je], i = e[Ln], o = e[Cn], a = e[we], c = e[Ue];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const l = [], p = (u) => {
    try {
      u();
    } catch (h) {
      l.push(h);
    }
  };
  do {
    a.f && p(a.f);
    const u = /* @__PURE__ */ new Set();
    for (const h of r) {
      const m = n.get(h)?.l;
      if (m)
        for (const g of m)
          u.add(g);
    }
    r.clear();
    for (const h of o)
      u.add(h);
    o.clear();
    for (const h of i)
      u.add(h);
    i.clear();
    for (const h of u)
      p(h);
    r.size && c(e, t);
  } while (r.size || o.size || i.size);
  if (l.length)
    throw typeof AggregateError == "function" ? new AggregateError(l) : Object.assign(new Error(), { errors: l });
}, va = (e, t) => {
  const n = e[Me], r = e[$t], i = e[je], o = e[Ie], a = e[Ze], c = e[Ht];
  if (!i.size)
    return;
  const l = [], p = [], u = /* @__PURE__ */ new WeakSet(), h = /* @__PURE__ */ new WeakSet(), m = [], g = [];
  for (const I of i)
    m.push(I), g.push(o(e, t, I));
  for (; m.length; ) {
    const I = m.length - 1, S = m[I], v = g[I];
    if (h.has(S)) {
      m.pop(), g.pop();
      continue;
    }
    if (u.has(S)) {
      r.get(S) === v.n && (l.push(S), p.push(v)), h.add(S), m.pop(), g.pop();
      continue;
    }
    u.add(S);
    for (const A of Mo(S, v, n))
      u.has(A) || (m.push(A), g.push(o(e, t, A)));
  }
  for (let I = l.length - 1; I >= 0; --I) {
    const S = l[I], v = p[I];
    let A = !1;
    for (const _ of v.d.keys())
      if (_ !== S && i.has(_)) {
        A = !0;
        break;
      }
    A && (r.set(S, v.n), a(e, t, S), c(e, t, S)), r.delete(S);
  }
};
const ya = (e, t, n) => {
  const r = e[Me], i = e[$t], o = e[je], a = e[we], c = e[So], l = e[Ie], p = e[Xe], u = e[Ue], h = e[Ze], m = e[Ht], g = e[Pn], I = e[Eo], S = e[Kn], v = l(e, t, n), A = S[0];
  if (gr(v)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== v.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      v.m === A
    )
      return v.m = A, v;
    let s = !1;
    for (const [f, k] of v.d)
      if (h(e, t, f).n !== k) {
        s = !0;
        break;
      }
    if (!s)
      return v.m = A, v;
  }
  let _ = !0;
  const O = new Set(v.d.keys()), E = () => {
    for (const s of O)
      v.d.delete(s);
  }, j = () => {
    if (r.has(n)) {
      const s = !o.size;
      m(e, t, n), s && (u(e, t), p(e, t));
    }
  }, q = (s) => {
    if (s === n) {
      const k = l(e, t, s);
      if (!gr(k))
        if (Ro(s))
          g(e, t, s, s.init);
        else
          throw new Error("no atom init");
      return wt(k);
    }
    const f = h(e, t, s);
    try {
      return wt(f);
    } finally {
      O.delete(s), v.d.set(s, f.n), Dt(v.v) && Oo(n, v.v, f), r.has(n) && r.get(s)?.t.add(n), _ || j();
    }
  };
  let $;
  const te = {
    get signal() {
      return $ || ($ = new AbortController()), $.signal;
    }
  }, se = v.n, d = i.get(n) === se;
  try {
    const s = c(e, t, n, q, te);
    if (g(e, t, n, s), Dt(s)) {
      I(e, t, s, () => $?.abort());
      const f = () => {
        E(), j();
      };
      s.then(f, f);
    } else
      E();
    return a.r?.(n), v.m = A, v;
  } catch (s) {
    if (la(s))
      throw s;
    return delete v.v, v.e = s, ++v.n, v.m = A, v;
  } finally {
    _ = !1, v.n !== se && d && (i.set(n, v.n), o.add(n), a.c?.(n));
  }
}, ba = (e, t, n) => {
  const r = e[Me], i = e[$t], o = e[Ie], a = [n];
  for (; a.length; ) {
    const c = a.pop(), l = o(e, t, c);
    for (const p of Mo(c, l, r)) {
      const u = o(e, t, p);
      i.get(p) !== u.n && (i.set(p, u.n), a.push(p));
    }
  }
}, Ia = (e, t, n, r) => {
  const i = e[je], o = e[we], a = e[ko], c = e[Ie], l = e[Xe], p = e[Ue], u = e[Ze], h = e[Nn], m = e[Bt], g = e[Ht], I = e[Pn], S = e[Kn];
  let v = !0;
  const A = (O) => wt(u(e, t, O)), _ = (O, ...E) => {
    const j = c(e, t, O);
    try {
      if (O === n) {
        if (!Ro(O))
          throw new Error("atom not writable");
        const q = j.n, $ = E[0];
        I(e, t, O, $), g(e, t, O), q !== j.n && (++S[0], i.add(O), h(e, t, O), o.c?.(O));
        return;
      } else
        return m(e, t, O, E);
    } finally {
      v || (p(e, t), l(e, t));
    }
  };
  try {
    return a(e, t, n, A, _, ...r);
  } finally {
    v = !1;
  }
}, Sa = (e, t, n) => {
  const r = e[Me], i = e[je], o = e[we], a = e[Ie], c = e[Nn], l = e[qt], p = e[Wt], u = a(e, t, n), h = r.get(n);
  if (h && u.d.size > 0) {
    for (const [m, g] of u.d)
      if (!h.d.has(m)) {
        const I = a(e, t, m);
        l(e, t, m).t.add(n), h.d.add(m), g !== I.n && (i.add(m), c(e, t, m), o.c?.(m));
      }
    for (const m of h.d)
      u.d.has(m) || (h.d.delete(m), p(e, t, m)?.t.delete(n));
  }
}, ka = (e, t, n) => {
  const r = e[Me], i = e[Ln], o = e[we], a = e[Ao], c = e[Ie], l = e[Xe], p = e[Ue], u = e[Ze], h = e[Bt], m = e[qt], g = c(e, t, n);
  let I = r.get(n);
  if (!I) {
    u(e, t, n);
    for (const S of g.d.keys())
      m(e, t, S).t.add(n);
    if (I = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(g.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, I), sa(n) && ca(n)) {
      const S = () => {
        let v = !0;
        const A = (..._) => {
          try {
            return h(e, t, n, _);
          } finally {
            v || (p(e, t), l(e, t));
          }
        };
        try {
          const _ = a(e, t, n, A);
          _ && (I.u = () => {
            v = !0;
            try {
              _();
            } finally {
              v = !1;
            }
          });
        } finally {
          v = !1;
        }
      };
      i.add(S);
    }
    o.m?.(n);
  }
  return I;
}, Ta = (e, t, n) => {
  const r = e[Me], i = e[Cn], o = e[we], a = e[Ie], c = e[Wt], l = a(e, t, n);
  let p = r.get(n);
  if (!p || p.l.size)
    return p;
  let u = !1;
  for (const h of p.t)
    if (r.get(h)?.d.has(n)) {
      u = !0;
      break;
    }
  if (!u) {
    p.u && i.add(p.u), p = void 0, r.delete(n);
    for (const h of l.d.keys())
      c(e, t, h)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return p;
}, Aa = (e, t, n, r) => {
  const i = e[Ie], o = e[xo], a = i(e, t, n), c = "v" in a, l = a.v;
  if (Dt(r))
    for (const p of a.d.keys())
      Oo(n, r, i(e, t, p));
  a.v = r, delete a.e, (!c || !Object.is(l, a.v)) && (++a.n, Dt(l) && o(e, t, l));
}, Ea = (e, t, n) => {
  const r = e[Ze];
  return wt(r(e, t, n));
}, xa = (e, t, n, ...r) => {
  const i = e[je], o = e[Xe], a = e[Ue], c = e[Bt], l = i.size;
  try {
    return c(e, t, n, r);
  } finally {
    i.size !== l && (a(e, t), o(e, t));
  }
}, Ra = (e, t, n, r) => {
  const i = e[Xe], o = e[Ue], a = e[qt], c = e[Wt], p = a(e, t, n).l;
  return p.add(r), o(e, t), i(e, t), () => {
    p.delete(r), c(e, t, n), o(e, t), i(e, t);
  };
}, Oa = (e, t, n, r) => {
  const i = e[Fn];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, Ma = (e, t, n) => {
  e[Fn].get(n)?.forEach((o) => o());
}, wa = /* @__PURE__ */ new WeakMap();
function Da(e) {
  const t = {
    get(c) {
      return i(r, t, c);
    },
    set(c, ...l) {
      return o(r, t, c, ...l);
    },
    sub(c, l) {
      return a(r, t, c, l);
    }
  }, n = {
    // store state
    [Io]: /* @__PURE__ */ new WeakMap(),
    [Me]: /* @__PURE__ */ new WeakMap(),
    [$t]: /* @__PURE__ */ new WeakMap(),
    [je]: /* @__PURE__ */ new Set(),
    [Ln]: /* @__PURE__ */ new Set(),
    [Cn]: /* @__PURE__ */ new Set(),
    [we]: {},
    // atom interceptors
    [So]: ua,
    [ko]: fa,
    [To]: ma,
    [Ao]: pa,
    // building-block functions
    [Ie]: ha,
    [Xe]: ga,
    [Ue]: va,
    [Ze]: ya,
    [Nn]: ba,
    [Bt]: Ia,
    [Ht]: Sa,
    [qt]: ka,
    [Wt]: Ta,
    [Pn]: Aa,
    // store api
    [mr]: Ea,
    [pr]: xa,
    [hr]: Ra,
    [aa]: void 0,
    // abortable promise support
    [Fn]: /* @__PURE__ */ new WeakMap(),
    [Eo]: Oa,
    [xo]: Ma,
    // store epoch
    [Kn]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  wa.set(t, r);
  const i = r[mr], o = r[pr], a = r[hr];
  return t;
}
function _a() {
  return Da();
}
function Z(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function wo(e, t = 1 / 0) {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    const i = e.charCodeAt(r);
    if (i < 128) n++;
    else if (i < 2048) n += 2;
    else if (i >= 55296 && i <= 56319) {
      const o = e.charCodeAt(++r);
      if (!(o >= 56320 && o <= 57343)) return 1 / 0;
      n += 4;
    } else {
      if (i >= 56320 && i <= 57343) return 1 / 0;
      n += 3;
    }
    if (n > t) return 1 / 0;
  }
  return n;
}
function Do() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= wo(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Sn(e) {
  const t = Do(), n = (r, i) => {
    if (!t.node(i)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const o of r) if (!n(o, i + 1)) return !1;
      return !0;
    }
    if (!Z(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function X(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function ge(e) {
  return typeof e == "string" && e.length > 0 && wo(e) <= 256;
}
function jn(e) {
  return Z(e) && ge(e.owner) && X(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function La(e) {
  if (!Z(e) || !X(e.id)) return;
  const t = jn(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function Ca(e) {
  const t = jn(e);
  return t && Z(e) && X(e.client) && X(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function vr(e) {
  if (!Z(e) || !Array.isArray(e.parameters) || !Z(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!Z(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: c, defaultValue: l } = n;
    if (!ge(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof l != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: c, defaultValue: l }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function Na(e) {
  if (Z(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = La(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (e.kind === "edit-many") {
      if (!Array.isArray(e.edits) || e.edits.length === 0) return;
      const t = [], n = /* @__PURE__ */ new Set();
      for (const r of e.edits) {
        if (!Z(r) || !ge(r.key) || n.has(r.key) || !Object.hasOwn(r, "value") || Object.hasOwn(r, "gesture") || r.expectedVersion !== void 0 && !X(r.expectedVersion, !1)) return;
        n.add(r.key), t.push({ key: r.key, value: r.value, ...r.expectedVersion !== void 0 ? { expectedVersion: r.expectedVersion } : {} });
      }
      return { kind: "edit-many", edits: t };
    }
    if (ge(e.key)) {
      if (e.kind === "retry")
        return X(e.expectedVersion, !1) && (e.expectedGeneration === null || X(e.expectedGeneration, !1)) && (e.expectedPersistenceRequest === null || X(e.expectedPersistenceRequest)) ? {
          kind: "retry",
          key: e.key,
          expectedVersion: e.expectedVersion,
          expectedGeneration: e.expectedGeneration,
          expectedPersistenceRequest: e.expectedPersistenceRequest
        } : void 0;
      if (e.kind === "recover")
        return Object.hasOwn(e, "value") && e.expectedVersion === 0 && !Object.hasOwn(e, "gesture") ? { kind: "recover", key: e.key, value: e.value, expectedVersion: 0 } : void 0;
      if (e.kind === "begin" || e.kind === "end")
        return !X(e.gesture) || e.label !== void 0 && typeof e.label != "string" ? void 0 : e.kind === "end" ? { kind: "end", key: e.key, gesture: e.gesture } : { kind: "begin", key: e.key, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
      if (!(e.kind !== "edit" || !Object.hasOwn(e, "value")) && !(e.expectedVersion !== void 0 && !X(e.expectedVersion, !1)) && !(e.gesture !== void 0 && !X(e.gesture)))
        return {
          kind: "edit",
          key: e.key,
          value: e.value,
          ...e.expectedVersion !== void 0 ? { expectedVersion: e.expectedVersion } : {},
          ...e.gesture !== void 0 ? { gesture: e.gesture } : {}
        };
    }
  }
}
function Pa(e) {
  if (!Sn(e) || !Z(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && X(e.request) && ge(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && ge(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = jn(e.scope);
  if (e.kind === "opened" && t && X(e.request)) {
    const n = vr(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = vr(e.native);
    if (n && (e.changedStoredKey === void 0 || ge(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && ge(e.endpoint) && typeof e.value == "number" && X(e.intent, !1) && X(e.observation, !1) && (e.origin === "owner" || e.origin === "external"))
    return { kind: "ok", value: {
      kind: "parameter",
      scope: t,
      endpoint: e.endpoint,
      value: e.value,
      intent: e.intent,
      origin: e.origin,
      observation: e.observation
    } };
  if (e.kind === "detach" && t && X(e.client) && X(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && X(e.request) && X(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = Ca(e.address);
    if (n) {
      const r = Na(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && X(e.request) && Z(e.result)) {
    const n = [];
    if (e.observations !== void 0) {
      if (!Array.isArray(e.observations)) return { kind: "invalid", message: "Invalid publication observation barrier." };
      const r = /* @__PURE__ */ new Set();
      for (const i of e.observations) {
        if (!Z(i) || !ge(i.endpoint) || !X(i.observation, !1) || r.has(i.endpoint))
          return { kind: "invalid", message: "Invalid publication observation barrier." };
        r.add(i.endpoint), n.push({ endpoint: i.endpoint, observation: i.observation });
      }
    }
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && ge(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason },
      ...e.observations === void 0 ? {} : { observations: n }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function yr(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, i]) => {
    const o = t.fields[r];
    return !o || !("value" in o) ? [r, o] : [r, { ...o, value: i.kind === "stored" ? i.codec.encode(o.value) : o.value }];
  }));
  return { ...t, fields: n };
}
function br(e) {
  const t = Do(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
    if (t.node(a)) {
      if (o === null || typeof o == "boolean") return o;
      if (typeof o == "number") return Number.isFinite(o) ? o : void 0;
      if (typeof o == "string") return t.text(o) ? o : void 0;
      if (!(typeof o != "object" || n.has(o))) {
        n.add(o);
        try {
          if (Array.isArray(o) || o instanceof Float32Array || o instanceof Float64Array || o instanceof Int8Array || o instanceof Int16Array || o instanceof Int32Array || o instanceof Uint8Array || o instanceof Uint8ClampedArray || o instanceof Uint16Array || o instanceof Uint32Array) {
            if (!t.elements(o.length)) return;
            const l = [];
            for (const p of o) {
              const u = r(p, a + 1);
              if (u === void 0) return;
              l.push(u);
            }
            return l;
          }
          if (!Z(o)) return;
          const c = /* @__PURE__ */ Object.create(null);
          for (const l in o) {
            if (!Object.hasOwn(o, l)) continue;
            if (!t.text(l)) return;
            const p = r(o[l], a + 1);
            if (p === void 0) return;
            c[l] = p;
          }
          return c;
        } finally {
          n.delete(o);
        }
      }
    }
  }, i = r(e, 0);
  return i !== void 0 ? { kind: "ok", value: i } : { kind: "invalid", message: "Prepared event payload does not satisfy the native JSON contract." };
}
const Fa = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Ka(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !Fa.has(e);
}
function Et(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function w(e, t = {}) {
  return Object.freeze({ kind: "parameter", endpoint: e, ...t });
}
function _o(e) {
  const t = Object.freeze({ ...e.codec });
  return Object.freeze({
    kind: "stored",
    initial: t.parse(e.initial),
    codec: t,
    ...e.lifetime ? { lifetime: e.lifetime } : {},
    ...e.history !== void 0 ? { history: e.history } : {},
    ...e.engine ? { engine: e.engine } : {}
  });
}
function Ir(e) {
  const t = _o({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const o = e.engine, a = e.prepare, c = e.prepare, l = o.length;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: l ?? null }),
      prepare: l === void 0 ? c : (p, u) => ({
        length: l,
        write: (h) => a(p, h, u)
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
const Lo = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function ja(e) {
  return e[Lo] ?? {};
}
function Co(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function Ua(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Co(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: r }) => !Ka(r) || r === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  return Object.freeze(Object.defineProperty({ ...e }, Lo, { value: Object.freeze({ ...t }) }));
}
const ye = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function Sr(e, t = {}) {
  const n = /* @__PURE__ */ new Map();
  let r = !1;
  function i(o) {
    if (!Z(o) || typeof o.id != "number" || !Z(o.scope)) return;
    const a = n.get(o.id);
    if (!(!a || o.input !== a.input || o.scope.owner !== a.target.scope.owner || o.scope.document !== a.target.scope.document))
      if (o.kind === "applied") {
        if (o.generation !== o.id || typeof o.serial != "number" || !Number.isSafeInteger(o.serial) || o.serial <= 0) return;
        if (!a.submitted) {
          a.early = o;
          return;
        }
        if (o.serial !== a.submitted.serial || o.generation !== a.submitted.generation) return;
        a.finish({ kind: "acknowledged", engineSession: `${a.target.scope.owner}:${a.target.scope.document}`, operation: String(o.id) });
      } else o.kind === "failed" && a.finish(o.reason === "cancelled" || o.reason === "superseded" || o.reason === "stale-scope" ? { kind: "cancelled" } : ye("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", i), {
    async prepare(o, a, c, l) {
      if (r || c.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(o.byteLength) || o.byteLength <= 0 || o.byteLength % 4 !== 0 || o.byteLength > 2147483647)
        return ye("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const p = e.sharedData;
      if (!p) return ye("This host does not support shared-data preparation.");
      let u;
      try {
        u = p.reserve(o.input, o.byteLength);
      } catch {
        return ye("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let h = !1;
      try {
        if (u.byteLength !== o.byteLength) return ye("The host supplied a differently sized shared allocation.");
        const m = l(u);
        if (m?.kind === "failed") return m;
        if (Et(m)) return { kind: "failed", error: m.error };
        if (c.aborted || r) return { kind: "cancelled" };
        const g = new Promise((I) => {
          let S = () => {
          }, v;
          const A = (_) => {
            if (n.delete(u.id)) {
              if (clearTimeout(v), S(), _.kind !== "acknowledged")
                try {
                  p.cancel(u.id);
                } catch {
                  _ = ye("Cancellation of the shared resource could not be confirmed.");
                }
              I(_);
            }
          };
          n.set(u.id, { input: o.input, target: a, submitted: null, early: null, finish: A }), S = c.onAbort(() => A({ kind: "cancelled" })), n.has(u.id) && (v = setTimeout(() => A(ye("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(u.id)) return g;
        try {
          const I = await Promise.race([
            Promise.resolve(p.commit(u.id)).then((A) => ({ kind: "submitted", receipt: A })),
            g.then((A) => ({ kind: "finished", outcome: A }))
          ]);
          if (I.kind === "finished") return I.outcome;
          const S = I.receipt;
          h = !0;
          const v = n.get(u.id);
          v && (!Z(S) || S.kind !== "submitted" || S.id !== u.id || S.input !== o.input || S.generation !== u.id || typeof S.serial != "number" || !Number.isSafeInteger(S.serial) || S.serial <= 0 ? v.finish(ye("The host returned an invalid shared-resource submission receipt.")) : (v.submitted = { generation: S.generation, serial: S.serial }, v.early && i(v.early)));
        } catch {
          n.get(u.id)?.finish(c.aborted ? { kind: "cancelled" } : ye("The shared resource could not be submitted."));
        }
        return g;
      } finally {
        if (!h)
          try {
            p.cancel(u.id);
          } catch {
          }
      }
    },
    stop() {
      if (!r) {
        r = !0;
        for (const o of [...n.values()]) o.finish({ kind: "cancelled" });
        e.removeEventListener("kit_data", i);
      }
    }
  };
}
class Un {
  #t = Object.freeze([]);
  #e = Object.freeze([]);
  #o;
  #d;
  constructor(t = {}) {
    const n = t.limit ?? 100;
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("History limit must be a non-negative integer.");
    this.#o = n, this.#d = t.compare;
  }
  get undoEntry() {
    return this.#t[this.#t.length - 1];
  }
  get redoEntry() {
    return this.#e[this.#e.length - 1];
  }
  #a(t, n) {
    const r = new Un({ limit: this.#o, compare: this.#d });
    return r.#t = Object.freeze(this.#o === 0 ? [] : t.slice(-this.#o)), r.#e = Object.freeze(this.#o === 0 ? [] : n.slice(-this.#o)), r;
  }
  /** Recording an accepted change invalidates Redo; optional ordering supports interleaved gestures. */
  record(t) {
    const n = [...this.#t, t];
    return this.#d && n.sort(this.#d), this.#a(n, []);
  }
  /** Invalidate Redo at the first accepted edit in an unfinished group. */
  clearRedo() {
    return this.#e.length ? this.#a(this.#t, []) : this;
  }
  undo() {
    return this.#t.length === 0 ? this : this.#a(this.#t.slice(0, -1), [...this.#e, ...this.#t.slice(-1)]);
  }
  redo() {
    return this.#e.length === 0 ? this : this.#a([...this.#t, ...this.#e.slice(-1)], this.#e.slice(0, -1));
  }
  clear() {
    return this.#a([], []);
  }
}
function De(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function yt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function kr(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function ke(e, t, n = 0, r, i, o, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
function za(e, t) {
  const n = _a(), r = {};
  for (const d of Object.keys(e)) r[d] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = fr({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new Un({ limit: t.historyLimit, compare: (d, s) => d.order - s.order }),
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map(),
    parameterIntents: /* @__PURE__ */ new Map(),
    parameterAppliedIntents: /* @__PURE__ */ new Map(),
    parameterObservations: /* @__PURE__ */ new Map()
  }), o = fr((d) => d(i).snapshot);
  let a = !1, c, l = 0, p = !1, u, h = [];
  const m = [], g = () => n.get(o), I = (d) => e[d]?.history !== !1, S = (d) => [...d.gestures.keys()].some(I), v = (d, s, f = d.history) => {
    const k = f.undoEntry, b = f.redoEntry;
    return {
      ...d,
      history: f,
      snapshot: Object.freeze({
        ...d.snapshot,
        revision: d.snapshot.revision + 1,
        fields: Object.freeze(s),
        history: Object.freeze({
          canUndo: !a && !S(d) && k !== void 0 && k.changes.every((y) => s[y.key]?.readiness.kind === "ready"),
          canRedo: !a && !S(d) && b !== void 0 && b.changes.every((y) => s[y.key]?.readiness.kind === "ready"),
          ...d.snapshot.scope && k ? { undoEntry: yt(d.snapshot.scope, k) } : {},
          ...d.snapshot.scope && b ? { redoEntry: yt(d.snapshot.scope, b) } : {}
        })
      })
    };
  }, A = (d, s) => {
    const f = n.get(i);
    if (d.snapshot === f.snapshot) {
      n.set(i, d);
      return;
    }
    const k = d.snapshot.scope;
    if (!k || !t.bindings?.length) {
      n.set(i, d);
      return;
    }
    const b = { ...d.snapshot.fields };
    for (const y of t.bindings) {
      const T = b[y.key];
      if (!T) continue;
      const R = f.snapshot.fields[y.key], x = !f.snapshot.scope || !De(k, f.snapshot.scope);
      if (!(x || y.key === s || !R || R.readiness.kind !== T.readiness.kind || "value" in T && (!("value" in R) || !Object.is(T.value, R.value)) || y.dependencies.some((K) => {
        const N = f.snapshot.fields[K], B = b[K];
        return N !== B && (!N || !B || !("value" in N) || !("value" in B) || !Object.is(N.value, B.value));
      }))) {
        const K = T.application ?? R?.application, N = R?.target ?? T.target;
        b[y.key] = T.application === K && T.target === N ? T : Object.freeze({ ...T, ...K ? { application: K } : {}, ...N ? { target: N } : {} });
        continue;
      }
      const C = Object.freeze({ scope: k, key: y.key, generation: x ? 0 : (R?.target?.generation ?? -1) + 1 }), U = {};
      let P = "value" in T && T.readiness.kind === "ready";
      for (const K of y.dependencies) {
        const N = b[K];
        e[K]?.kind !== "parameter" || !N || !("value" in N) || N.readiness.kind !== "ready" || typeof N.value != "number" ? P = !1 : U[K] = N.value;
      }
      if (b[y.key] = Object.freeze({ ...T, target: C, application: Object.freeze({ kind: P ? "pending" : "waiting-for-inputs" }) }), P && "value" in T) {
        const K = Object.freeze({ value: T.value, parameters: Object.freeze(U) });
        h.push(() => y.replace(K, C));
      } else h.push(() => y.cancel());
    }
    n.set(i, { ...d, snapshot: Object.freeze({ ...d.snapshot, fields: Object.freeze(b) }) });
  }, _ = (d, s, f) => {
    if (!I(s)) return d;
    const k = e[s];
    return (k?.kind === "stored" ? k.codec.equals(f.before, f.after) : Object.is(f.before, f.after)) ? d : d.record({ changes: [{ key: s, before: f.before, after: f.after }], order: f.order });
  }, O = (d, s, f, k) => {
    if (!d.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
    const b = { ...d.snapshot.fields }, y = new Map(d.publications), T = new Map(d.parameterIntents), R = [];
    for (const { key: P, value: K } of s) {
      const N = e[P], B = b[P];
      if (!N || !B) return { kind: "rejected", reason: "not-ready" };
      const W = "value" in B ? B : void 0;
      if (!W && k !== "recover") return { kind: "rejected", reason: "not-ready" };
      if (k === "history" && B.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      let ne;
      if (N.kind === "parameter") {
        if (typeof K != "number") return { kind: "rejected", reason: "invalid-value" };
        ne = d.gestures.has(P) ? [{ kind: "parameter", endpoint: N.endpoint, value: K }] : [
          { kind: "gesture-start", endpoint: N.endpoint },
          { kind: "parameter", endpoint: N.endpoint, value: K },
          { kind: "gesture-end", endpoint: N.endpoint }
        ];
      } else ne = N.lifetime === "instance" ? [] : [{ kind: "stored", key: P, value: N.codec.encode(K) }];
      const ce = (W?.version ?? 0) + 1;
      if (ne.length) {
        const M = ++l;
        y.set(M, { key: P, version: ce }), N.kind === "parameter" && T.set(P, M), R.push({ request: M, scope: d.snapshot.scope, operations: ne });
      }
      b[P] = ke(K, { kind: N.kind === "parameter" ? "host-managed" : N.lifetime === "instance" ? "not-written" : "pending" }, ce, W?.metadata, W?.gesture, N.kind === "parameter" ? { kind: "pending" } : void 0);
    }
    const x = v(d, b, f), D = s[0], C = s.length === 1 && D ? b[D.key] : void 0, U = {
      kind: "accepted",
      revision: x.snapshot.revision,
      ...C && "version" in C ? { version: C.version } : {},
      ...k !== "history" ? { changed: !0 } : {},
      ...k === "edit" && s.some(({ key: P }) => I(P) && !d.gestures.has(P)) && f.undoEntry ? { historyEntry: yt(d.snapshot.scope, f.undoEntry) } : {}
    };
    u = U, A({ ...x, publications: y, parameterIntents: T });
    for (const P of R)
      a || t.native.publish(P);
    return U;
  }, E = (d, s, f, k, b) => O(d, [{ key: s, value: f }], k, b), j = (d, s, f) => {
    const k = e[s];
    if (!k) return { kind: "error" };
    if (k.kind === "stored") return k.codec.parse(f);
    const b = d.parameters.get(s);
    if (!b || typeof f != "number" || !Number.isFinite(f)) return { kind: "error" };
    const y = Math.min(b.max, Math.max(b.min, f));
    return { kind: "ok", value: b.step > 0 ? Math.min(b.max, Math.max(b.min, b.min + Math.round((y - b.min) / b.step) * b.step)) : y };
  }, q = (d, s, f) => {
    const k = e[d];
    return k?.kind === "stored" ? k.codec.equals(s, f) : Object.is(s, f);
  }, $ = (d) => {
    const s = n.get(i);
    if (d.kind === "opened" || d.kind === "replaced") {
      if (s.snapshot.scope && (d.kind === "opened" || d.scope.owner !== s.snapshot.scope.owner || d.scope.document <= s.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const f = {}, k = /* @__PURE__ */ new Map();
      for (const [y, T] of Object.entries(e))
        if (T.kind === "parameter") {
          const R = d.native.parameters.find((x) => x.endpoint === T.endpoint);
          if (R && kr(R)) {
            k.set(y, Object.freeze({ ...R }));
            const { min: x, max: D, step: C, defaultValue: U } = R;
            f[y] = ke(R.value, { kind: "host-managed" }, 0, Object.freeze({ min: x, max: D, step: C, defaultValue: U }), void 0, { kind: "unconfirmed" });
          } else f[y] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: R ? "invalid-state" : "missing-parameter" }) });
        } else {
          const R = s.snapshot.fields[y];
          if (T.lifetime === "instance" && d.kind === "replaced" && R && "value" in R) {
            f[y] = ke(R.value, { kind: "not-written" }, R.version);
            continue;
          }
          const x = T.lifetime !== "instance" && Object.hasOwn(d.native.values, y), D = x ? T.codec.parse(d.native.values[y]) : T.initial;
          if (D.kind === "ok") f[y] = ke(D.value, { kind: x ? "observed-in-native-state" : "not-written" });
          else {
            const C = s.snapshot.fields[y], U = d.kind === "replaced" && d.changedStoredKey !== void 0 && C && "value" in C;
            f[y] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...U ? { value: C.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const b = v(s, f, s.history.clear());
      A({ ...b, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), parameterIntents: /* @__PURE__ */ new Map(), parameterAppliedIntents: /* @__PURE__ */ new Map(), parameterObservations: /* @__PURE__ */ new Map(), editOrder: 0, parameters: k, snapshot: Object.freeze({ ...b.snapshot, scope: Object.freeze({ ...d.scope }) }) });
    } else if (d.kind === "command") {
      if (!s.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!De(d.address, s.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (s.detached.has(d.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (d.command.kind === "undo" || d.command.kind === "redo") {
        if (S(s)) return { kind: "rejected", reason: "busy" };
        const P = d.command.kind === "undo", K = P ? s.history.undoEntry : s.history.redoEntry, N = d.command.expectedEntry;
        return N && (!K || !De(N.scope, s.snapshot.scope) || N.id !== K.order) ? { kind: "rejected", reason: "stale-history" } : K ? O(
          s,
          K.changes.map((B) => ({ key: B.key, value: P ? B.before : B.after })),
          P ? s.history.undo() : s.history.redo(),
          "history"
        ) : { kind: "accepted", revision: s.snapshot.revision };
      }
      if (d.command.kind === "edit-many") {
        const P = [], K = /* @__PURE__ */ new Set();
        if (!Array.isArray(d.command.edits) || d.command.edits.length === 0) return { kind: "rejected", reason: "invalid-command" };
        for (const { key: W, value: ne, expectedVersion: ce } of d.command.edits) {
          if (!Object.hasOwn(e, W) || K.has(W)) return { kind: "rejected", reason: "invalid-command" };
          K.add(W);
          const M = s.snapshot.fields[W];
          if (!M || !("value" in M) || M.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          if (s.gestures.has(W)) return { kind: "rejected", reason: "busy" };
          if (ce !== void 0 && ce !== M.version) return { kind: "rejected", reason: "stale-version" };
          const F = j(s, W, ne);
          if (F.kind === "error") return { kind: "rejected", reason: "invalid-value" };
          q(W, M.value, F.value) || P.push({ key: W, before: M.value, after: F.value });
        }
        if (!P.length) return { kind: "accepted", revision: s.snapshot.revision, changed: !1 };
        const N = s.editOrder + 1, B = P.filter(({ key: W }) => I(W));
        return O({ ...s, editOrder: N }, P.map(({ key: W, after: ne }) => ({ key: W, value: ne })), B.length ? s.history.record({ changes: B, order: N }) : s.history, "edit");
      }
      const { key: f } = d.command;
      if (!Object.hasOwn(e, f)) return { kind: "rejected", reason: "invalid-command" };
      const k = e[f], b = s.snapshot.fields[f];
      if (!k || !b) return { kind: "rejected", reason: "invalid-command" };
      if (d.command.kind === "retry") {
        if (!("value" in b) || b.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (d.command.expectedVersion !== b.version || d.command.expectedGeneration !== (b.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const P = b.persistence.kind === "failed" && b.persistenceRequest !== void 0;
        if (d.command.expectedPersistenceRequest !== (P ? b.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (P) {
          const B = k.kind === "parameter" ? [{ kind: "parameter", endpoint: k.endpoint, value: Number(b.value) }] : [{ kind: "stored", key: f, value: k.codec.encode(b.value) }], W = ++l, ne = new Map(s.publications).set(W, { key: f, version: b.version }), ce = v(s, { ...s.snapshot.fields, [f]: Object.freeze({
            ...b,
            persistence: Object.freeze({ kind: "pending" }),
            ...k.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), M = { kind: "accepted", revision: ce.snapshot.revision, version: b.version, changed: !1 };
          return u = M, A({ ...ce, publications: ne, parameterIntents: k.kind === "parameter" ? new Map(s.parameterIntents).set(f, W) : s.parameterIntents }), a || t.native.publish({ request: W, scope: s.snapshot.scope, operations: B }), M;
        }
        if (b.application?.kind !== "failed" || b.application.error.kind === "defect" || !t.bindings?.some((B) => B.key === f))
          return { kind: "rejected", reason: "not-ready" };
        const K = v(s, s.snapshot.fields), N = { kind: "accepted", revision: K.snapshot.revision, version: b.version, changed: !1 };
        return u = N, A(K, f), N;
      }
      if (d.command.kind === "recover") {
        if (d.command.expectedVersion !== 0 || Object.hasOwn(d.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (k.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in b && b.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (b.readiness.kind !== "failed" || b.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const P = k.codec.parse(d.command.value);
        return P.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : E(s, f, P.value, s.history, "recover");
      }
      if (!("value" in b) || b.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const y = b, T = s.gestures.get(f);
      if (T && T.client !== d.address.client) return { kind: "rejected", reason: "busy" };
      if (d.command.kind === "begin" || d.command.kind === "end") {
        const { gesture: P } = d.command;
        if (!Number.isSafeInteger(P) || P <= 0) return { kind: "rejected", reason: "invalid-command" };
        if (T && T.gesture !== P) return { kind: "rejected", reason: "invalid-command" };
        const K = d.command.kind === "begin";
        if (K === !!T) return { kind: "accepted", revision: s.snapshot.revision, version: y.version };
        const N = new Map(s.gestures);
        let B = s.history, W, ne;
        if (K) {
          W = Object.freeze({ client: d.address.client, gesture: P });
          const F = y.value;
          N.set(f, { ...W, before: F, after: F, order: 0, guardFloorVersion: y.version });
        } else T && (N.delete(f), B = _(B, f, T), B !== s.history && B.undoEntry && (ne = yt(s.snapshot.scope, T)));
        const ce = v({ ...s, gestures: N }, {
          ...s.snapshot.fields,
          [f]: ke(y.value, y.persistence, y.version, y.metadata, W, y.application, y.persistenceRequest)
        }, B), M = {
          kind: "accepted",
          revision: ce.snapshot.revision,
          version: y.version,
          ...ne ? { historyEntry: ne } : {}
        };
        return u = M, A({ ...ce, gestures: N }), a || k.kind === "parameter" && t.native.publish({
          request: ++l,
          scope: s.snapshot.scope,
          operations: [{ kind: K ? "gesture-start" : "gesture-end", endpoint: k.endpoint }]
        }), M;
      }
      const { value: R, expectedVersion: x } = d.command;
      if (d.command.gesture !== void 0 && (!T || T.gesture !== d.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (T && d.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (x !== void 0 && x !== y.version && !(T && x >= T.guardFloorVersion && x <= y.version))
        return { kind: "rejected", reason: "stale-version" };
      const D = j(s, f, R);
      if (D.kind === "error") return { kind: "rejected", reason: "invalid-value" };
      const C = D.value;
      if (q(f, y.value, C)) return { kind: "accepted", revision: s.snapshot.revision, version: y.version, changed: !1 };
      const U = s.editOrder + 1;
      if (T) {
        const P = new Map(s.gestures).set(f, { ...T, after: C, order: U });
        return E({ ...s, gestures: P, editOrder: U }, f, C, I(f) ? s.history.clearRedo() : s.history, "edit");
      }
      return E({ ...s, editOrder: U }, f, C, I(f) ? s.history.record({ changes: [{ key: f, before: y.value, after: C }], order: U }) : s.history, "edit");
    } else if (d.kind === "engine") {
      const f = s.snapshot.fields[d.target.key];
      if (!f?.target || !De(f.target.scope, d.target.scope) || f.target.generation !== d.target.generation) return { kind: "accepted", revision: s.snapshot.revision };
      A(v(s, {
        ...s.snapshot.fields,
        [d.target.key]: Object.freeze({ ...f, application: Object.freeze({ ...d.status }) })
      }));
    } else if (d.kind === "detached") {
      if (!s.snapshot.scope || !De(d.scope, s.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (s.detached.has(d.client)) return { kind: "accepted", revision: s.snapshot.revision };
      const f = new Map(s.gestures), k = { ...s.snapshot.fields }, b = [];
      let y = s.history;
      for (const [R, x] of s.gestures) {
        if (x.client !== d.client) continue;
        f.delete(R), y = _(y, R, x);
        const D = k[R];
        D && "value" in D && (k[R] = ke(D.value, D.persistence, D.version, D.metadata, void 0, D.application, D.persistenceRequest));
        const C = e[R];
        C?.kind === "parameter" && b.push({ kind: "gesture-end", endpoint: C.endpoint });
      }
      const T = f.size === s.gestures.size ? s : v({ ...s, gestures: f }, k, y);
      return u = { kind: "accepted", revision: T.snapshot.revision }, A({ ...T, gestures: f, detached: new Set(s.detached).add(d.client) }), !a && b.length > 0 && t.native.publish({ request: ++l, scope: s.snapshot.scope, operations: b }), u;
    } else if (d.kind === "parameter") {
      if (!s.snapshot.scope || !De(d.scope, s.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [f, k] of s.parameters) {
        if (k.endpoint !== d.endpoint) continue;
        if (!kr({ ...k, value: d.value })) return { kind: "rejected", reason: "invalid-value" };
        if (!Number.isSafeInteger(d.intent) || d.intent < 0 || !Number.isSafeInteger(d.observation) || d.observation < 0 || d.origin !== "owner" && d.origin !== "external") return { kind: "rejected", reason: "invalid-command" };
        if (d.observation <= (s.parameterObservations.get(f) ?? -1)) continue;
        const b = new Map(s.parameterObservations).set(f, d.observation);
        if (d.origin === "owner" || d.intent < (s.parameterIntents.get(f) ?? 0)) {
          A({ ...s, parameterObservations: b });
          continue;
        }
        const y = s.snapshot.fields[f];
        if (!y || !("value" in y)) continue;
        const T = Object.is(y.value, d.value) ? s : v(s, {
          ...s.snapshot.fields,
          [f]: ke(d.value, { kind: "host-managed" }, y.version + 1, y.metadata, y.gesture, { kind: "unconfirmed" })
        }), R = s.gestures.get(f), x = R && T !== s ? new Map(s.gestures).set(f, { ...R, guardFloorVersion: y.version + 1 }) : s.gestures;
        A({ ...T, gestures: x, parameterObservations: b });
      }
    } else {
      if (!s.snapshot.scope || !De(d.scope, s.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const f = s.publications.get(d.request);
      if (f) {
        const k = new Map(s.publications);
        k.delete(d.request);
        const b = new Map(s.parameterAppliedIntents), y = new Map(s.parameterIntents), T = new Map(s.parameterObservations), R = e[f.key];
        if (R?.kind === "parameter") {
          d.result.kind === "observed" && b.set(
            f.key,
            Math.max(d.request, b.get(f.key) ?? 0)
          );
          const D = d.observations?.find((U) => U.endpoint === R.endpoint);
          D && T.set(
            f.key,
            Math.max(T.get(f.key) ?? -1, D.observation)
          );
          let C = b.get(f.key) ?? 0;
          for (const [U, P] of k) P.key === f.key && (C = Math.max(C, U));
          (d.result.kind === "observed" || D) && y.set(f.key, C);
        }
        const x = s.snapshot.fields[f.key];
        if (x && "value" in x && x.version === f.version) {
          const D = d.result.kind === "observed" ? { kind: e[f.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: d.result.reason }, C = e[f.key]?.kind === "parameter" ? d.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: d.result.reason }) } : x.application, U = v(s, { ...s.snapshot.fields, [f.key]: Object.freeze({
            ...ke(x.value, D, x.version, x.metadata, x.gesture, C),
            ...d.result.kind === "failed" ? { persistenceRequest: d.request } : {}
          }) });
          A({ ...U, publications: k, parameterIntents: y, parameterAppliedIntents: b, parameterObservations: T });
        } else A({ ...s, publications: k, parameterIntents: y, parameterAppliedIntents: b, parameterObservations: T });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, te = (d) => {
    if (a) return;
    a = !0;
    let s = () => {
    };
    c = new Promise((y) => {
      s = y;
    });
    const f = [];
    for (const y of t.bindings ?? [])
      try {
        f.push(y.stop());
      } catch (T) {
        f.push(Promise.reject(T));
      }
    Promise.allSettled(f).then((y) => {
      for (const T of y) T.status === "rejected" && t.onDefect(T.reason);
      s();
    });
    const k = n.get(i), b = {};
    for (const [y, T] of Object.entries(k.snapshot.fields)) {
      const { gesture: R, ...x } = "value" in T ? T : { ...T, gesture: void 0 };
      b[y] = Object.freeze({ ...x, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...v(k, b), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
    } catch (y) {
      t.onDefect(y);
    }
    if (d)
      try {
        t.native.update(g(), d);
      } catch (y) {
        t.onDefect(y);
      }
    t.native.close({ reason: "service-closed" });
  }, se = () => {
    if (!p) {
      p = !0;
      try {
        for (let d = m.shift(); d; d = m.shift()) {
          u = void 0, h = [];
          let s, f = !1;
          try {
            const k = n.get(i).snapshot;
            s = a ? { kind: "rejected", reason: "service-closed" } : $(d.event), u = s;
            for (const b of h)
              a || b();
            !a && (n.get(i).snapshot !== k || d.event.kind === "command") && (f = !0, t.native.update(g(), d.event.kind === "command" ? { address: d.event.address, result: s } : void 0));
          } catch (k) {
            s = u ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(k), te(!f && d.event.kind === "command" ? { address: d.event.address, result: s } : void 0);
          }
          d.finish(s);
        }
      } finally {
        p = !1;
      }
    }
  };
  return {
    getSnapshot: g,
    subscribe: (d) => n.sub(o, () => d(g())),
    dispatch: (d) => new Promise((s) => {
      m.push({ event: d, finish: s }), se();
    }),
    stop: () => (te(), c ?? Promise.resolve())
  };
}
const Va = 5e3;
function de(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function $a(e) {
  const t = (n) => Array.isArray(n) && n.every((r) => {
    if (typeof r != "string" || r.length === 0) return !1;
    try {
      return encodeURIComponent(r).replace(/%[0-9A-F]{2}/g, "x").length <= 256;
    } catch {
      return !1;
    }
  });
  return Object.entries(e).flatMap(([n, r]) => {
    if (r.kind !== "stored" || r.engine?.kind !== "prepared") return [];
    const i = r.engine, o = i.delivery;
    if (!t([n]) || !o || typeof o.create != "function" || o.replacement !== void 0 && o.replacement !== "supersede" && o.replacement !== "finish" || !t(i.dependencies) || i.dependencies.some((a) => e[a]?.kind !== "parameter") || !t(o.eventEndpoints) || !t(o.hostEffects ?? []) || !t(o.outputEndpoints ?? []) || !t(o.storedKeys ?? []) || !Array.isArray(o.dataInputs ?? []) || o.dataInputs?.some((a) => !Number.isSafeInteger(a) || a < 0 || a > 2147483647))
      throw new Error("Invalid prepared delivery declaration.");
    return [{ key: n, declaration: { ...i, delivery: Object.freeze({
      ...o,
      create: o.create.bind(o),
      eventEndpoints: Object.freeze([...o.eventEndpoints]),
      outputEndpoints: Object.freeze([...o.outputEndpoints ?? []]),
      storedKeys: Object.freeze([...o.storedKeys ?? []]),
      hostEffects: Object.freeze([...o.hostEffects ?? []]),
      dataInputs: Object.freeze([...o.dataInputs ?? []])
    }) } }];
  });
}
function Ba(e, t, n) {
  let r = !1, i = !1, o, a = 0, c = 0, l, p, u, h = () => {
  }, m = () => {
  };
  const g = /* @__PURE__ */ new Map(), I = (d) => {
    if (!Sn(d)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: d });
  }, S = /* @__PURE__ */ new Map(), v = [], A = bo(t);
  function _(d) {
    try {
      return d();
    } catch (s) {
      return n.onDefect(s), { kind: "failed", error: { kind: "defect", message: "Data preparation failed unexpectedly." } };
    }
  }
  async function O(d) {
    try {
      return { kind: "ok", value: await d() };
    } catch (s) {
      return n.onDefect(s), { kind: "error", error: { kind: "defect", message: "Preparation failed unexpectedly." } };
    }
  }
  for (const { key: d, input: s } of Co(e)) {
    const f = e[d];
    if (f?.kind !== "stored" || f.engine?.kind !== "shared-prepared") continue;
    const k = f.engine, b = en({
      async prepare(y, T) {
        const R = await O(() => k.prepare(y.value, { resources: A, parameters: y.parameters, signal: T }));
        if (R.kind === "error") return R;
        const x = R.value;
        return Et(x) ? { kind: "error", error: x.error } : !x || !Number.isSafeInteger(x.length) || x.length <= 0 || typeof x.write != "function" ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size or writer." } } : { kind: "ok", value: { plan: x, target: y.target } };
      },
      transport: {
        apply(y, T) {
          if (T.signal.aborted || !de(E.getSnapshot().scope, y.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          o ??= Sr(t);
          const R = k.storage.type === "float32" ? y.plan.length * 4 : y.plan.length;
          return o.prepare({ input: s, byteLength: R }, y.target, T.signal, (x) => {
            const D = k.storage.type === "float32" ? new Float32Array(x.buffer, x.byteOffset, y.plan.length) : new Uint8Array(x.buffer, x.byteOffset, y.plan.length), C = _(() => y.plan.write(D));
            if (C) return C;
            if (D instanceof Float32Array && !D.every(Number.isFinite))
              return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
          });
        },
        stop() {
        }
      },
      onStatus(y, T) {
        E.dispatch({ kind: "engine", target: y, status: T });
      },
      onDefect(y) {
        n.onDefect(y), $();
      }
    });
    v.push({
      key: d,
      dependencies: k.dependencies,
      replace(y, T) {
        b.replace({ ...y, target: T }, T);
      },
      cancel: b.cancel,
      stop: b.stop
    });
  }
  for (const [d, s] of Object.entries(e)) {
    if (s.kind !== "stored" || s.engine?.kind !== "event-value") continue;
    const f = s.engine, k = en({
      async prepare(b, y) {
        const T = await O(() => f.prepare(b.value, { resources: A, parameters: b.parameters, signal: y }));
        if (T.kind === "error") return T;
        const R = T.value;
        if (Et(R)) return { kind: "error", error: R.error };
        const x = br(R);
        return x.kind === "ok" ? { kind: "ok", value: { target: b.target, value: x.value } } : { kind: "error", error: { kind: "engine-rejected", message: x.message } };
      },
      transport: {
        apply(b, y) {
          return new Promise((T) => {
            let R = 0, x = () => {
            };
            const D = (C) => {
              x(), S.delete(R), T(C);
            };
            x = y.signal.onAbort(() => D({ kind: "cancelled" }));
            try {
              const C = y.send(() => de(E.getSnapshot().scope, b.target.scope) ? (R = ++a, S.set(R, { kind: "event-value", key: d, scope: b.target.scope, finish: D }), I({
                kind: "publish",
                request: R,
                scope: b.target.scope,
                operations: [{ kind: "event", endpoint: f.endpoint, value: b.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              C.kind !== "sent" && D(C);
            } catch (C) {
              x(), S.delete(R), n.onDefect(C), $(), T({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const b of S.values()) b.key === d && b.finish({ kind: "cancelled" });
        }
      },
      onStatus(b, y) {
        E.dispatch({ kind: "engine", target: b, status: y });
      },
      onDefect: n.onDefect
    });
    v.push({
      key: d,
      dependencies: f.dependencies,
      replace(b, y) {
        k.replace({ ...b, target: y }, y);
      },
      cancel: k.cancel,
      stop: k.stop
    });
  }
  const E = za(e, {
    historyLimit: ja(e).historyLimit,
    bindings: v,
    onDefect: n.onDefect,
    native: {
      publish(d) {
        const s = ++a;
        g.set(s, { request: d.request, scope: d.scope }), I({ kind: "publish", ...d, request: s, operations: d.operations.map((f) => f.kind === "parameter" ? { ...f, intent: d.request } : f) });
      },
      update(d, s) {
        d.scope && I({
          kind: "update",
          scope: d.scope,
          revision: d.revision,
          state: yr(e, d),
          ...s ? { receipt: s } : {}
        });
      },
      close(d) {
        i = !0, o?.stop();
        for (const s of S.values()) s.finish({ kind: "cancelled" });
        m(new Error("State service closed before native initialization completed."));
        try {
          r && E.getSnapshot().scope && I({ kind: "close", ...d });
        } catch (s) {
          n.onDefect(s);
        }
        r && t.removeEventListener("kit_state", q), r = !1, g.clear();
      }
    }
  }), j = (d) => {
    if (i) return;
    const s = Pa(d);
    if (s.kind === "invalid") {
      const k = new Error(s.message);
      n.onDefect(k), m(k), $();
      return;
    }
    const f = s.value;
    if (f.kind === "closed")
      m(new Error(`Native state service closed: ${f.reason}`)), $();
    else if (f.kind === "open-failed") {
      if (f.request !== c || E.getSnapshot().scope) return;
      m(new Error(`Native state open failed: ${f.reason}`)), $();
    } else if (f.kind === "opened") {
      if (f.request !== c || E.getSnapshot().scope) return;
      E.dispatch(f).then((k) => {
        k.kind === "accepted" ? h() : m(new Error("Native state could not initialize the service."));
      });
    } else if (f.kind === "attached-client") {
      const k = E.getSnapshot();
      de(k.scope, f.scope) && I({
        kind: "snapshot",
        scope: f.scope,
        to: f.client,
        attachRequest: f.request,
        revision: k.revision,
        state: yr(e, k)
      });
    } else if (f.kind === "detach")
      E.dispatch({ kind: "detached", scope: f.scope, client: f.client });
    else if (f.kind === "parameter")
      de(E.getSnapshot().scope, f.scope) && E.dispatch(f);
    else if (f.kind === "replaced")
      E.dispatch(f).then((k) => {
        if (k.kind !== "accepted") return;
        const b = E.getSnapshot().scope;
        for (const y of S.values())
          de(b, y.scope) || y.finish({ kind: "cancelled" });
        for (const [y, T] of g)
          de(b, T.scope) || g.delete(y);
      });
    else if (f.kind === "command")
      E.dispatch(f);
    else if (f.kind === "invalid-command")
      de(E.getSnapshot().scope, f.address) && I({
        kind: "receipt",
        address: f.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const k = S.get(f.request);
      if (k) {
        if (!de(k.scope, f.scope) || !de(E.getSnapshot().scope, f.scope)) return;
        if (k.kind === "custom" && f.result.kind === "failed" && (f.result.reason === "stale-scope" || f.result.reason === "closed")) {
          k.finish({ kind: "cancelled" });
          return;
        }
        k.finish(f.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: f.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: f.result.reason } });
        return;
      }
      const b = g.get(f.request);
      if (!b || !de(b.scope, f.scope) || !de(E.getSnapshot().scope, f.scope)) return;
      g.delete(f.request), E.dispatch({ ...f, request: b.request });
    }
  }, q = (d) => {
    if (!i)
      try {
        j(d);
      } catch (s) {
        n.onDefect(s), m(s), $();
      }
  }, $ = () => u || (i = !0, m(new Error("State service stopped before native initialization completed.")), u = E.stop(), u);
  function te(d) {
    n.onDefect(d), $();
  }
  function se({ key: d, declaration: s }) {
    const f = s.delivery;
    let k, b = !1;
    const y = /* @__PURE__ */ new Set();
    function T() {
      const x = k;
      if (k = void 0, !x) return;
      const D = x.close();
      y.add(D), D.then(() => y.delete(D), (C) => {
        y.delete(D), te(C);
      });
    }
    function R(x) {
      const D = Object.freeze({ ...x.scope }), C = at(), U = C.signal;
      let P = x;
      function K(M, F) {
        if (M.signal.aborted || i || !de(E.getSnapshot().scope, D)) return { kind: "cancelled" };
        if (!F || typeof F != "object" || F.kind !== "event" && F.kind !== "host-effect")
          return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
        if (!(F.kind === "event" ? f.eventEndpoints.includes(F.endpoint) : f.hostEffects?.includes(F.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
        const G = br(F.value);
        if (G.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: G.message } };
        const ae = F.kind === "event" ? { kind: "event", endpoint: F.endpoint, value: G.value } : { kind: "host-effect", name: F.name, value: G.value }, he = { kind: "publish", request: a + 1, scope: D, operations: [ae] };
        if (!Sn(he)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
        const ve = ++a;
        let Se = (vt) => {
        };
        const Qt = new Promise((vt) => {
          let nt = () => {
          };
          Se = (Gi) => {
            S.delete(ve) && (nt(), vt(Gi));
          }, S.set(ve, { kind: "custom", key: d, scope: D, finish: Se }), nt = M.signal.onAbort(() => Se({ kind: "cancelled" }));
        });
        try {
          t.sendMessageToServer({ type: "kit_state", message: he });
        } catch (vt) {
          const nt = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
          return Se(nt), n.onDefect(vt), nt;
        }
        return { kind: "submitted", completion: Qt };
      }
      function N(M, F, ee) {
        if (!f.outputEndpoints?.includes(F)) throw new Error("Undeclared engine output endpoint.");
        if (M.signal.aborted) return () => {
        };
        let G = !0, ae = () => {
        };
        const he = (Se) => {
          if (!(!G || M.signal.aborted))
            try {
              ee(Se);
            } catch (Qt) {
              te(Qt);
            }
        }, ve = () => {
          G && (G = !1, ae(), t.removeEndpointListener?.(F, he));
        };
        return ae = M.signal.onAbort(ve), t.addEndpointListener?.(F, he), ve;
      }
      const B = A, W = {
        signal: U,
        send: (M) => K(C, M),
        listen: (M, F) => N(C, M, F),
        readStored(M) {
          if (!f.storedKeys?.includes(M)) throw new Error("Undeclared stored-state input.");
          return U.aborted ? Promise.resolve(void 0) : new Promise((F) => {
            const ee = U.onAbort(() => F(void 0));
            t.requestFullStoredState?.((G) => {
              ee();
              const ae = Z(G) && Z(G.values) ? G.values : G;
              F(!U.aborted && Z(ae) ? ae[M] : void 0);
            });
          });
        },
        subscribeStored(M, F) {
          if (!f.storedKeys?.includes(M)) throw new Error("Undeclared stored-state input.");
          if (U.aborted) return () => {
          };
          let ee = !0, G = () => {
          };
          const ae = (ve) => {
            if (!(!ee || U.aborted || !Z(ve) || ve.key !== M))
              try {
                F(ve.value);
              } catch (Se) {
                te(Se);
              }
          }, he = () => {
            ee && (ee = !1, G(), t.removeStoredStateValueListener?.(ae));
          };
          return G = U.onAbort(he), t.addStoredStateValueListener?.(ae), he;
        },
        async prepareData(M, F, ee, G) {
          if (!f.dataInputs?.includes(M)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
          const ae = G ? at(U, G) : at(U);
          try {
            return o ??= Sr(t), await o.prepare({ input: M, byteLength: F }, { ...P, scope: D }, ae.signal, (he) => _(() => ee(he)));
          } finally {
            ae.cancel();
          }
        },
        report(M) {
          U.aborted || E.dispatch({ kind: "engine", target: P, status: M });
        },
        fail(M) {
          U.aborted || te(M);
        }
      };
      let ne;
      try {
        ne = f.create(W);
      } catch (M) {
        throw C.cancel(), M;
      }
      const ce = en({
        replacement: f.replacement,
        async prepare(M, F) {
          const ee = await O(() => s.prepare(M.value, { resources: B, parameters: M.parameters, signal: F }));
          if (ee.kind === "error") return ee;
          const G = ee.value;
          return Et(G) ? { kind: "error", error: G.error } : { kind: "ok", value: { value: G, target: M.target } };
        },
        transport: {
          async apply(M, F) {
            P = M.target;
            const ee = at(U, F.signal);
            try {
              return await ne.apply(M.value, {
                signal: ee.signal,
                send: (G) => K(ee, G),
                listen: (G, ae) => N(ee, G, ae)
              });
            } finally {
              ee.cancel();
            }
          },
          stop() {
            return ne.stop();
          }
        },
        onStatus(M, F) {
          E.dispatch({ kind: "engine", target: M, status: F });
        },
        onDefect: te
      });
      return { scope: D, binding: ce, close() {
        return C.cancel(), ce.stop();
      } };
    }
    return {
      key: d,
      dependencies: s.dependencies,
      replace(x, D) {
        if (!b) {
          if ((!k || !de(k.scope, D.scope)) && (T(), k = R(D)), b) {
            T();
            return;
          }
          k.binding.replace({ ...x, target: D }, D);
        }
      },
      cancel: T,
      async stop() {
        b = !0, T(), await Promise.all(y);
      }
    };
  }
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (l) return l;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return $(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      l = new Promise((d, s) => {
        h = () => {
          clearTimeout(p), d();
        }, m = (f) => {
          clearTimeout(p), s(f);
        };
      });
      try {
        if ("bindings" in n) throw new Error("Declare engine delivery with preparedState instead of service bindings.");
        const d = $a(e);
        if (d.some(({ declaration: s }) => s.delivery.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (d.some(({ declaration: s }) => s.delivery.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const s of d) v.push(se(s));
        r = !0, t.addEventListener("kit_state", q), c = ++a, p = setTimeout(() => {
          m(new Error("Cmajor state-channel is unavailable: native open timed out.")), $();
        }, Va), I({
          kind: "open",
          request: c,
          parameters: Object.values(e).filter((s) => s.kind === "parameter").map((s) => s.endpoint),
          storedKeys: Object.keys(e).filter((s) => e[s]?.kind === "stored" && e[s].lifetime !== "instance"),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((s) => s.kind === "stored" && s.engine?.kind === "event-value" ? [s.engine.endpoint] : []),
            ...d.flatMap((s) => s.declaration.delivery.eventEndpoints)
          ])],
          ...d.some((s) => s.declaration.delivery.hostEffects?.length) ? {
            hostEffects: [...new Set(d.flatMap((s) => s.declaration.delivery.hostEffects ?? []))]
          } : {}
        });
      } catch (d) {
        n.onDefect(d), m(d), $();
      }
      return l;
    },
    /** Release this owner and its channel resources. */
    stop: $
  };
}
const No = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), kn = Reflect.get(globalThis, No), Tr = kn instanceof WeakMap ? kn : /* @__PURE__ */ new WeakMap();
kn !== Tr && Object.defineProperty(globalThis, No, { value: Tr });
class Ha {
  connection;
  serviceFactories;
  services = [];
  started = !1;
  constructor(t, n) {
    this.connection = t, this.serviceFactories = n;
  }
  async start() {
    if (!this.started) {
      this.started = !0;
      try {
        for (const t of this.serviceFactories) {
          const n = typeof t == "function" ? await t(this.connection) : t;
          this.services.push(n), await n.start();
        }
      } catch (t) {
        const n = [];
        for (const r of [...this.services].reverse())
          try {
            await r.stop?.();
          } catch (i) {
            n.push(i);
          }
        throw this.services.length = 0, this.started = !1, n.length > 0 ? new AggregateError(
          [t, ...n],
          "Patch worker service startup failed and cleanup also failed"
        ) : t;
      }
    }
  }
  async stop() {
    if (!this.started)
      return;
    this.started = !1;
    const t = [];
    for (const n of [...this.services].reverse())
      try {
        await n.stop?.();
      } catch (r) {
        t.push(r);
      }
    if (this.services.length = 0, t.length > 0)
      throw new AggregateError(t, "Patch worker service cleanup failed");
  }
  getServices() {
    return [...this.services];
  }
}
function qa(e, t) {
  return new Ha(e, t);
}
async function Wa(e, t) {
  const n = qa(e, t);
  return await n.start(), n;
}
const Le = 2048, lt = Le + 3, Ar = 20, Po = "MSEG 1", Ga = 0, Ce = 2;
function dt(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function zn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Qe(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Ya(e) {
  return zn(Number.isFinite(e) ? e : 0, -Ar, Ar);
}
function Ke(e) {
  return zn(Number.isFinite(e) ? e : 0, 0, 1);
}
function Fo(e = Po) {
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
function Ko() {
  return {
    format: "mseg.playback",
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
function Ja(e) {
  const t = Number(e);
  return zn(
    Number.isFinite(t) ? t : 1,
    Ga,
    Ce
  );
}
function Qa(e) {
  if (!e || typeof e != "object")
    return null;
  const t = dt(e), n = Ke(Number(t.startX)), r = Ke(Number(t.endX));
  return Qe(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Xa(e = Ko()) {
  const t = dt(e), n = dt(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Ja(Number.isFinite(r) ? r : 1)
    },
    loop: Qa(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function Za(e, t, n) {
  const r = dt(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Ke(i)), {
    x: i,
    y: Ke(Number(r.y)),
    curvePower: Ya(Number(r.curvePower))
  };
}
function Gt(e = Fo()) {
  const t = dt(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Za(i, o, n.length));
  if (!Qe(r[0].x, 0) || !Qe(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : Po,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Er(e) {
  return JSON.stringify(Gt(e));
}
function es(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function ts(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Qe(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && Qe(e[o + 1].x, t); )
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
function ns(e, t) {
  const n = Ke(Number(t)), r = ts(e, n);
  if (r.laterPointWins || Qe(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Ke(es(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function rs(e, t) {
  return ns(Gt(e).points, t);
}
function os(e) {
  const t = new Float32Array(lt);
  return jo(e, t), t;
}
function jo(e, t) {
  if (t.length !== lt) throw new Error("Invalid MSEG destination length.");
  const n = Gt(e);
  for (let r = 0; r < Le; r += 1) {
    const i = r / (Le - 1);
    t[r + 1] = rs(n, i);
  }
  t[0] = t[1], t[Le + 1] = t[Le], t[Le + 2] = t[Le];
}
function xr(e, t) {
  return Er(e) === Er(t);
}
const Pe = -100, ut = 35, Vn = 5, $n = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Uo(e) {
  const t = $n.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function fe(e) {
  return Uo(e).laneEndpointID;
}
function Bn(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > Vn)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${Uo(e).hostStem}${t}OutputTrimDb`;
}
function zo() {
  return $n.flatMap((e) => Array.from(
    { length: Vn },
    (t, n) => Bn(e.deviceType, n + 1)
  ));
}
function is(e) {
  if (typeof e != "string")
    return null;
  for (const t of $n)
    for (let n = 1; n <= Vn; n += 1)
      if (e === Bn(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function Vo(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function as(e) {
  const t = (Vo(e, Pe, ut) - Pe) / (ut - Pe);
  return t * t;
}
function ss(e) {
  const t = Math.sqrt(Vo(e, 0, 1));
  return Pe + t * (ut - Pe);
}
const le = (e, t) => ({ label: e, value: t });
function Te(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const Ae = Object.freeze({
  filter: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: Te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), L = (e, t, n, r, i, o, a, c = {}) => ({
  id: `${e}.${t}`,
  effectId: e,
  endpointID: t,
  label: n,
  shortLabel: r,
  min: i,
  max: o,
  initial: a,
  step: c.step ?? (o - i) / 1e3,
  scale: c.scale ?? "linear",
  unit: c.unit ?? "",
  choices: c.choices,
  quick: c.quick ?? !1,
  modulationTargetIndex: c.modulationTargetIndex ?? null,
  modulationApplication: c.modulationApplication ?? (c.modulationTargetIndex === void 0 || c.modulationTargetIndex === null ? null : "linear"),
  valueKind: c.valueKind,
  modulationIdentityEndpointID: c.modulationIdentityEndpointID,
  modulationDragStyle: c.modulationDragStyle
});
function Ee(e, t, n) {
  return L(
    e,
    t,
    "Output Trim",
    "Trim",
    Pe,
    ut,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const cs = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ls = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], ds = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: Ae.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      L("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(le), quick: !0 }),
      L("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      L("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      L("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      Ee("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: Ae.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      L("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [le("Classic", 0), le("Harmonics", 1)] }),
      L("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      L("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      L("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      L("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      L("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      L("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [le("Symmetric", 0), le("Asymmetric", 1), le("Wavefold", 2)] }),
      Ee("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: Ae.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      L("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      L("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      L("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      L("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      L("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      Ee("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: Ae.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      L("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(le) }),
      L("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(le) }),
      L("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      L("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      L("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      L("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      L("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      Ee("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: Ae.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      L("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      L("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      L("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      L("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      L("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      Ee("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: Ae.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      L("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [le("Free", 0), le("Sync", 1)] }),
      L("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      L("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: cs.map(le) }),
      L("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      L("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      L("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      L("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      L("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      Ee("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: Ae.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      L("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [le("Free", 0), le("Sync", 1)] }),
      L("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      L("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ls.map(le) }),
      L("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      L("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      L("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      Ee("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: Ae.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      L("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      L("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      L("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      L("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      Ee("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Yt = ds, $o = Object.freeze(
  Yt.flatMap((e) => e.parameters)
);
new Map(
  $o.map((e) => [e.endpointID, e])
);
function Bo(e) {
  const t = Yt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Ho() {
  return $o;
}
function Hn(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const V = ["A", "B", "C"], qn = [
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
], us = [
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
], ze = Object.freeze([
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
]), fs = Object.freeze([
  ...V.flatMap((e) => qn.map(
    (t) => `osc${e}.${t}`
  )),
  ...us
]);
new Set(
  V.flatMap((e) => qn.map(
    (t) => `osc${e}.${t}`
  ))
);
const qo = Object.freeze(
  fs.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), ms = Ho().filter(
  (e) => e.modulationTargetIndex !== null
), ps = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Wn(e) {
  const t = hs(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function hs(e) {
  const t = ps.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const gs = [
  ...ms.map((e) => ({
    kind: Wn(Hn(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Wo = Object.freeze(
  gs.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), Oe = Object.freeze([
  ...qo,
  ...Wo
]), xt = ze.length, Go = qo.length, Jt = Wo.length, vs = xt * Oe.length, ys = new Map(ze.map((e) => [e.id, e])), Yo = new Map(ze.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), et = new Map(Oe.map((e) => [e.kind, e]));
function bs() {
  if (xt !== 14 || Go !== 59 || Jt !== 47 || vs !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = ze.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = Oe.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (ys.size !== xt || Yo.size !== xt || et.size !== Oe.length)
    throw new Error("Modulation identities must be unique");
}
bs();
function Jo(e, t) {
  const n = Yo.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function Gn(e) {
  return typeof e != "string" ? null : et.has(e) ? e : null;
}
function Is(e) {
  const t = Gn(e);
  return t !== null && et.get(t)?.group === "voice" ? t : null;
}
function Yn(e) {
  const t = Gn(e);
  return t !== null && et.get(t)?.group === "rack" ? t : null;
}
function Qo(e) {
  const t = et.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function Xo(e) {
  const t = et.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Ss(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Zo = 4, ks = Zo * Jt, Ts = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), As = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Ve(e) {
  if (typeof e != "string")
    return null;
  const t = As.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Ts.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function Jn(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function ei(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function ti(e) {
  if (e === null)
    return null;
  const t = ei(e) - 1;
  return t > Zo ? null : t * Jt + Xo(Jn(e));
}
function Es(...e) {
  return { ...Fo(...e), format: "cosimo.mseg.shape" };
}
function Rr(...e) {
  return { ...Gt(...e), format: "cosimo.mseg.shape" };
}
function Or(...e) {
  return { ...Ko(...e), format: "cosimo.mseg.playback" };
}
function xs(...e) {
  return { ...Xa(...e), format: "cosimo.mseg.playback" };
}
const tn = "modulationProgram", Rs = "modulationAmount", ni = ze.filter((e) => e.group === "voice").length, ri = ze.filter((e) => e.group === "macro").length, _t = Go, Os = Jt, Lt = Os + ks, Ne = ni * _t, Be = ri * _t, Ms = ni * Lt, ws = ri * Lt, _e = 512, $e = 256, oi = Ne + Be;
function Ds(e) {
  const t = Jo(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function _s(e) {
  const t = Is(e);
  return t === null ? null : Qo(t);
}
function ii(e) {
  const t = _s(e.targetKind), n = Yn(e.targetKind);
  let r = n === null ? void 0 : Xo(n);
  if (r === void 0) {
    const a = ti(
      Ve(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Jo(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const c = a.runtimeIndex;
    if (t !== null) {
      const p = c * _t + t;
      return {
        path: "macroVoice",
        cellIndex: p,
        sourceIndex: c,
        targetIndex: t,
        articulationCellIndex: Ne + p
      };
    }
    const l = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: c * Lt + l,
      sourceIndex: c,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const i = Ds(e);
  if (t !== null) {
    const a = i * _t + t;
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
    cellIndex: i * Lt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function ai(e) {
  return Ve(e.targetKind) !== null ? null : ii(e).articulationCellIndex;
}
function Ls(e) {
  if (Yn(e.targetKind) !== null)
    return !1;
  const t = Ve(e.targetKind);
  return t !== null && ti(t) === null;
}
function Cs(e) {
  return {
    ...ii(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function si(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Ls(n))
      continue;
    const r = Cs(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Ns(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function He(e) {
  return [...e.values()].filter(Ns).sort((t, n) => t.cellIndex - n.cellIndex);
}
function bt(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function nn(e) {
  const t = si(e), n = He(t.voice), r = He(t.macroVoice), i = He(t.voiceRack), o = He(t.macroRack), a = Array.from({ length: Ne }, () => 0), c = Array.from({ length: Ne }, () => 0), l = Array.from({ length: Ne }, () => 0), p = Array.from({ length: Ne }, () => 0), u = Array.from({ length: Ne }, () => 0);
  bt(n, a, c, l, p);
  const h = Array.from({ length: Be }, () => 0), m = Array.from({ length: Be }, () => 0), g = Array.from({ length: Be }, () => 0), I = Array.from({ length: Be }, () => 0), S = Array.from({ length: Be }, () => 0);
  if (bt(
    r,
    h,
    m,
    g,
    I
  ), i.length > _e || o.length > $e)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${_e}), ${o.length} macro-rack (max ${$e})`
    );
  const v = Array.from({ length: _e }, () => 0), A = Array.from({ length: _e }, () => 0), _ = Array.from({ length: _e }, () => 0), O = Array.from({ length: _e }, () => 0), E = Array.from({ length: _e }, () => 0), j = Array.from({ length: Ms }, () => 0);
  bt(
    i,
    v,
    A,
    _,
    O
  );
  const q = Array.from({ length: $e }, () => 0), $ = Array.from({ length: $e }, () => 0), te = Array.from({ length: $e }, () => 0), se = Array.from({ length: $e }, () => 0), d = Array.from({ length: ws }, () => 0);
  bt(
    o,
    q,
    $,
    te,
    se
  );
  for (const s of t.voice.values()) u[s.cellIndex] = s.amount;
  for (const s of t.macroVoice.values()) S[s.cellIndex] = s.amount;
  for (const s of t.voiceRack.values()) j[s.cellIndex] = s.amount;
  for (const s of t.macroRack.values()) d[s.cellIndex] = s.amount;
  for (let s = 0; s < i.length; s += 1) {
    const f = i[s];
    if (f === void 0) throw new Error(`Missing compiled voice-rack route at index ${s}`);
    E[s] = f.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: c,
    voiceRouteTargets: l,
    voiceRoutePolarities: p,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: h,
    macroVoiceRouteSources: m,
    macroVoiceRouteTargets: g,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: S,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: v,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: _,
    voiceRackRoutePolarities: O,
    voiceRackRouteReducers: E,
    voiceRackRouteAmounts: j,
    macroRackRouteCount: o.length,
    macroRackRouteCells: q,
    macroRackRouteSources: $,
    macroRackRouteTargets: te,
    macroRackRoutePolarities: se,
    macroRackRouteAmounts: d
  };
}
const Ps = ["voice", "macroVoice", "voiceRack", "macroRack"], Fs = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Mr(e) {
  return si(e);
}
function Ks(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function js(e, t) {
  if (e === null)
    return [{ endpointID: tn, value: nn(t) }];
  const n = Mr(e), r = Mr(t), i = [];
  for (const o of Ps) {
    const a = He(n[o]), c = He(r[o]);
    if (a.length !== c.length)
      return [{ endpointID: tn, value: nn(t) }];
    for (let l = 0; l < c.length; l += 1) {
      const p = a[l], u = c[l];
      if (p === void 0 || u === void 0 || !Ks(p, u))
        return [{ endpointID: tn, value: nn(t) }];
      p.amount !== u.amount && i.push({
        endpointID: Rs,
        value: {
          pathKind: Fs[o],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return i;
}
function tt(e) {
  return { _tag: "ok", value: e };
}
function ct(e) {
  return { _tag: "err", error: e };
}
function Us(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function zs(e) {
  throw new Error(e ?? "Invariant violated");
}
const Vs = "globalTune", $s = "globalTuneSemitones", xe = -24, rt = 24, wr = 0, ci = -48, li = 48, Tn = -48, di = 6, Qn = 0, Dr = (Qn - Tn) / (di - Tn), Bs = "voiceEnhancerFrequency", Hs = "voiceEnhancerQ", qs = "voiceEnhancerAmount", Ws = "voiceEnhancerFrequencyOctaves", Gs = "voiceEnhancerQ", Ys = "voiceEnhancerAmount", ui = "voice.enhancerFrequency", Js = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Bs,
    targetKind: Ws,
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
    endpointID: Hs,
    targetKind: Gs,
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
    endpointID: qs,
    targetKind: Ys,
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
function _r(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Qs(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function It(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Xs = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      It("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      It("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      It("mix", "Mix", 100, 100),
      It("drive", "Drive", 15, 0)
    ]
  }
], Lr = 1e-6;
function pe(e, t) {
  if (!Number.isFinite(e) || e < -Lr || e > 1 + Lr)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function Ct(e, t) {
  return pe(e / 100, `${t} catalog percentage`);
}
function mt(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function Zs(e) {
  return 20 * 1e3 ** e;
}
function ec(e) {
  return pe(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function tc(e) {
  return 0.1 * 200 ** e;
}
function nc(e) {
  return pe(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function rc(e) {
  return e;
}
function oc(e) {
  return pe(e, "filterMix endpoint conversion");
}
function Ye(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function ic(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Ye("filterCutoff", Zs, ec),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ye("filterQ", tc, nc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ye("filterMix", rc, oc),
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
function fi(e) {
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
      return Us(e);
  }
}
function ac(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function sc(e, t) {
  const n = mt(e.moduleId, t.id), r = fi(t.format), i = ic(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: Ct(t.defaultPercent, n),
    initialValue: Ct(t.initialPercent, n),
    format: r,
    modAmount: ac(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const cc = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Dr * 100, defaultPercent: Dr * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function lc(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function dc(e, t) {
  const n = `osc${e}`, r = mt(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: Ct(t.defaultPercent, r),
    initialValue: Ct(t.initialPercent, r),
    format: fi(t.format),
    modAmount: lc(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const uc = Object.freeze(
  V.flatMap((e) => cc.map((t) => dc(e, t)))
), fc = Object.freeze({
  targetId: mt("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: pe(
    (wr - xe) / (rt - xe),
    "Global Tune default"
  ),
  initialValue: pe(
    (wr - xe) / (rt - xe),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: rt },
  modAmount: {
    min: ci,
    max: li,
    unit: "st",
    digits: 2
  },
  binding: Ye(
    Vs,
    (e) => xe + (rt - xe) * e,
    (e) => pe(
      (e - xe) / (rt - xe),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: $s
});
function mc(e) {
  const t = mt("voice-enhancer", e.key), n = pe(
    _r(e, e.initial),
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
    binding: Ye(
      e.endpointID,
      (r) => Qs(e, r),
      (r) => pe(
        _r(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const pc = Object.freeze(
  Object.values(Js).map(mc)
), hc = Object.freeze([
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
function gc(e) {
  const t = mt(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => pe(
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
    binding: Ye(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const vc = Object.freeze(
  hc.map(gc)
), yc = Object.freeze([
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
function bc(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function rn(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? as(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return pe(n, `${e.endpointID} endpoint conversion`);
}
function Ic(e, t) {
  return e.valueKind === "effect-output-trim-db" ? ss(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function Sc(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function kc(e) {
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
function Tc(e) {
  const t = bc(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: rn(e, e.initial),
    initialValue: rn(e, e.initial),
    format: Sc(e),
    modAmount: kc(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => Ic(e, n),
      fromEngine: (n) => rn(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : Wn(Hn(e))
  });
}
const Xn = Object.freeze(
  [
    ...Yt.flatMap((e) => e.parameters.map(Tc)),
    ...yc,
    fc,
    ...pc,
    ...uc,
    ...vc,
    ...Xs.flatMap(
      (e) => e.parameters.map(
        (t) => sc(e, t)
      )
    )
  ]
), Ac = new Map(
  Xn.map((e) => [e.targetId, e])
), mi = Xn.filter(
  (e) => e.modulationTargetKind !== null
), An = new Map(
  mi.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Ac.size !== Xn.length)
  throw new Error("Target descriptor IDs must be unique");
if (mi.length !== Oe.length || An.size !== Oe.length || Oe.some((e) => An.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function on(e) {
  const t = An.get(e);
  return t === void 0 ? zs(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  Yt.map((e) => [e.id, e.label])
);
function Ec(e) {
  const t = ei(e);
  return t === 1 ? "" : ` ${t}`;
}
function xc(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = on(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = Ve(e);
  if (n !== null) {
    const r = on(Jn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Ec(n)} ${r.label.toUpperCase()}`;
  }
  return on(e).label.toUpperCase();
}
const qe = "modulation.v6", pi = 6, pt = 3, We = 3, Rc = 4, Cr = "modulationMsegBuffer", Oc = "modulationMsegPlayback", hi = 4, Mc = ["MSEG 1", "MSEG 2", "MSEG 3"], gi = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], wc = ["Env 1", "Env 2", "Env 3"], Dc = 1e-3, Y = 10, _c = 0.1, Lc = 20, Nr = 10 - 0.1, Cc = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Lc - _c },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: ci,
    max: li
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
  mseg1Rate: { min: -Ce, max: Ce },
  mseg2Rate: { min: -Ce, max: Ce },
  mseg3Rate: { min: -Ce, max: Ce },
  env1Attack: { min: -Y, max: Y },
  env1Decay: { min: -Y, max: Y },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -Y, max: Y },
  env2Attack: { min: -Y, max: Y },
  env2Decay: { min: -Y, max: Y },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -Y, max: Y },
  env3Attack: { min: -Y, max: Y },
  env3Decay: { min: -Y, max: Y },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -Y, max: Y },
  ampAttack: { min: -Y, max: Y },
  ampDecay: { min: -Y, max: Y },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -Y, max: Y },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -Nr, max: Nr },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Nc = Ho().filter((e) => e.modulationTargetIndex !== null), Pc = new Map(
  Nc.map((e) => [
    Wn(Hn(e)),
    e
  ])
);
class an extends Error {
  name = "ModulationStateParseError";
}
const Fc = {
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
ze.map((e) => ({
  value: e.id,
  label: Fc[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Kc = Oe.map((e) => ({
  value: e.kind,
  label: xc(e.kind)
}));
Kc.filter((e) => !Uc(e.value));
function jc(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Zn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function sn(e, t) {
  const n = Number(e);
  return Zn(Number.isFinite(n) ? n : t, Dc, Y);
}
function Uc(e) {
  return Yn(e) !== null;
}
function zc(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function Vc(e) {
  const t = Ve(e);
  return t !== null ? Jn(t) : e;
}
function $c(e) {
  const t = Vc(e);
  if (Ve(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Pc.get(t);
  return n !== void 0 ? zc(n) : Cc[Ss(t)];
}
function Bc(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Hc(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function qc(e, t) {
  const n = $c(e), r = Number(t);
  return Zn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Wc(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Gc(e) {
  return Wc(e) ?? "mseg";
}
function Yc(e) {
  const t = Gn(e);
  return t !== null ? t : Ve(e) !== null ? e : null;
}
function Jc(e) {
  return Yc(e) ?? "oscA.wavetablePosition";
}
function Qc(e, t) {
  const n = gi[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Xc(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? pt : e === "macro" ? hi : Rc;
  return Zn(Number.isFinite(n) ? n : 1, 1, r);
}
function Ge(e) {
  return {
    name: wc[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function vi(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = Ge(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: sn(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: sn(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Ke(n.sustain ?? r.sustain),
    releaseSeconds: sn(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Zc(e, t = 0) {
  return { name: vi(e, t).name };
}
function el(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: Bc(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Xc(n, e.sourceSlot),
    polarity: Hc(e.polarity),
    targetKind: r,
    amount: qc(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function tl(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Gc(r.sourceKind), o = Jc(r.targetKind);
  return el(r, t, i, o);
}
function nl(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function rl(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => tl(n, r));
}
function ol(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = nl(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function En(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, c) => En(a, t[c]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => jc(r, a) && En(n[a], r[a]));
}
function yi(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = Es(Mc[t] ?? `MSEG ${t + 1}`), i = Rr(n.shapeA ?? r), o = xs({
    ...Or(),
    ...n.playback ?? {},
    rate: Or().rate
  }), { rate: a, ...c } = o;
  return {
    shapeA: i,
    shapeB: Rr(n.shapeB ?? i),
    playback: c
  };
}
function Nt() {
  return {
    format: "cosimo.modulation",
    version: pi,
    msegSlots: Array.from({ length: pt }, (e, t) => yi({}, t)),
    envelopeSlots: Array.from({ length: We }, (e, t) => ({
      name: Ge(t).name
    })),
    routes: [],
    macroNames: gi.slice()
  };
}
function il(e = Nt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: pi,
    msegSlots: Array.from({ length: pt }, (o, a) => yi(n[a], a)),
    envelopeSlots: Array.from({ length: We }, (o, a) => Zc(r[a], a)),
    routes: rl(t.routes),
    macroNames: Array.from(
      { length: hi },
      (o, a) => Qc(i[a], a)
    )
  };
}
function cn(e) {
  const t = Pt(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function Pt(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return ct(new an("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return ct(new an("Expected valid modulation JSON"));
    }
  }
  const n = il(t);
  return !En(t, n) || !ol(n.routes) ? ct(new an("Expected the current modulation schema")) : tt(n);
}
function al(e, t) {
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
function Pr(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(os(n))
  };
}
function sl(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function Fr(e, t = null, n) {
  const r = [];
  for (let i = 0; i < pt; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !xr(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: Cr,
      value: Pr(i, 0, o.shapeA)
    }), (a === void 0 || !xr(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: Cr,
      value: Pr(i, 1, o.shapeB)
    }), (a === void 0 || !sl(a.playback, o.playback)) && r.push({
      endpointID: Oc,
      value: al(i, o.playback)
    });
  }
  return r.push(...js(t?.routes ?? null, e.routes)), r;
}
function bi(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) bi(t);
    Object.freeze(e);
  }
}
const cl = {
  parse(e) {
    const t = Pt(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (bi(t.value), { kind: "ok", value: t.value });
  },
  encode: cn,
  equals: (e, t) => cn(e) === cn(t)
}, ll = [
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
], dl = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function ul(e) {
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
function fl(e, t, n) {
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
function ml(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${ul(n)}`,
    runtimeTargetIndex: Qo(r),
    oscillatorIndex: t
  });
}
function pl(e, t) {
  const n = Object.freeze(ll.map(
    (o) => fl(e, t, o)
  )), r = Object.freeze(qn.map(
    (o) => ml(e, t, o)
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
const Rt = Object.freeze(
  dl.map(({ id: e, oscillatorIndex: t }) => pl(e, t))
);
function hl() {
  if (Rt.length !== V.length || Rt.some((t, n) => t.id !== V[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = Rt.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
hl();
const ln = "articulationSnapshot", J = 128, Kr = 48, gl = 1e6, oe = -1, dn = [
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
function er(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function un(e) {
  return er(Number.isFinite(e) ? e : 0, 0, 1);
}
function ie(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return er(Number.isFinite(i) ? i : t, n, r);
}
function re(e, t, n, r) {
  return er(Math.round(ie(e, t)), n, r);
}
function Ii(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function fn() {
  return Array.from({ length: J }, () => oe);
}
function vl(e) {
  const t = re(e, 0, 0, J - 1), n = dn[t % dn.length], r = Math.floor(t / dn.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function yl() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Qn,
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
function bl(e) {
  const t = yl(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: ie(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: ie(n.pan, t.pan, -1, 1),
    octave: re(n.octave, t.octave, -4, 4),
    semitone: re(n.semitone, t.semitone, -12, 12),
    fineCents: ie(n.fineCents, t.fineCents, -100, 100),
    volumeDb: ie(
      n.volumeDb,
      t.volumeDb,
      Tn,
      di
    ),
    mute: re(n.mute, t.mute, 0, 1),
    solo: re(n.solo, t.solo, 0, 1),
    warpMode: re(n.warpMode, t.warpMode, 0, 4),
    warpAmount: ie(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: re(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: ie(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: ie(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: ie(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: re(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: ie(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: ie(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: ie(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: ie(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: ie(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: re(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: re(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: re(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: ie(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: ie(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      un(Number(r[0])),
      un(Number(r[1])),
      un(Number(r[2]))
    ]
  };
}
function Il(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: ie(t.amount, 0, -48, 48)
  } : null;
}
function Sl(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(Il).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: bl(t.parameters),
    envelopes: [0, 1, 2].map((i) => vi(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function kl(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = re(n.runtimeSlot, t, 0, J - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : vl(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Sl(n.snapshot)
  };
}
function Tl(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: re(n.note, 0, 0, J - 1),
    articulationId: r
  } : null;
}
function Al(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let c = re(o.min, i, i, J - 1), l = re(o.max, c, i, J - 1);
  return l < c && ([c, l] = [l, c]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: c,
    max: l
  };
}
function jr(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < i.length; c += 1) {
    const l = Al(
      i[c],
      t,
      c,
      n,
      r
    );
    !l || o.has(l.id) || (o.add(l.id), a.push(l));
  }
  return a;
}
function El(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Tl(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function xl(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < J; l += 1) {
    const p = kl(n[l], l);
    !p || r.has(p.runtimeSlot) || i.has(p.id) || (r.add(p.runtimeSlot), i.add(p.id), o.push(p));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((l) => l.id === t.selectedSlotId) ? t.selectedSlotId : null, c = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ii(t.activeTriggerMode),
    slots: o,
    chainAssignments: jr(t.chainAssignments, c, "chain", 0),
    keyAssignments: El(t.keyAssignments, c),
    velocityAssignments: jr(t.velocityAssignments, c, "velocity", 1)
  };
}
function Ur(e) {
  const t = (n) => V.map(() => n);
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
    volumeDbs: t(Qn),
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
    msegMorphs: Array.from({ length: pt }, () => 0),
    routeAmounts: Array.from({ length: oi }, () => 0),
    envelopeAttackSeconds: Array.from({ length: We }, (n, r) => Ge(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: We }, (n, r) => Ge(r).decaySeconds),
    envelopeSustain: Array.from({ length: We }, (n, r) => Ge(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: We }, (n, r) => Ge(r).releaseSeconds)
  };
}
function zr(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === oe && (e[o] = i);
  }
}
function Rl(e) {
  const t = xl(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = fn(), i = fn(), o = fn();
  zr(r, t.chainAssignments, n), zr(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const c = n.get(a.articulationId);
    c === void 0 || i[a.note] !== oe || (i[a.note] = c);
  }
  return o[0] = oe, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Si(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : Rl(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ii(t.activeMode),
    chain: Array.from({ length: J }, (n, r) => re(t.chain?.[r], oe, oe, J - 1)),
    key: Array.from({ length: J }, (n, r) => re(t.key?.[r], oe, oe, J - 1)),
    velocity: Array.from({ length: J }, (n, r) => r === 0 ? oe : re(t.velocity?.[r], oe, oe, J - 1))
  });
}
function Ol(e, t) {
  const n = Si(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const ue = "articulations.v4", tr = [
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
], nr = [
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
], ki = [
  ...V.flatMap((e) => tr.map(
    (t) => `osc${e}.${t}`
  )),
  ...nr
];
class Ti extends Error {
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
function z(e) {
  return ct(new Ti("malformed", e));
}
function ht(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function rr(e, t, n) {
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
function Ft(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < J;
}
function Ml(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function wl(e) {
  return ki.some((t) => t === e);
}
function Vr(e, t) {
  if (!ht(e))
    return z(`${t} must be an object`);
  const n = rr(e, ["min", "max"], t);
  return n !== null ? z(n) : Ft(e.min) ? Ft(e.max) ? e.min > e.max ? z(`${t}.min must be less than or equal to ${t}.max`) : tt({ min: e.min, max: e.max }) : z(`${t}.max must be an integer in 0..127`) : z(`${t}.min must be an integer in 0..127`);
}
function Dl(e, t) {
  if (!ht(e))
    return z(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return z(`${t} has a non-string parameter id`);
    if (!wl(r))
      return z(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return z(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return tt(n);
}
function Ai(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Ei() {
  return {};
}
function _l(e, t, n) {
  if (!ht(e))
    return z(`${t} must be an object`);
  const r = Ei();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return z(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Kr)
      return z(
        `${t}.${i} must be a finite route amount within ±${Kr}`
      );
    if (!n.has(i))
      return z(`${t}.${i} does not name a current articulable mapping`);
    Ai(r, i, o);
  }
  return tt(r);
}
function Ll(e, t, n) {
  const r = `slots[${t}]`;
  if (!ht(e))
    return z(`${r} must be an object`);
  const i = rr(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return z(i);
  if (typeof e.id != "string")
    return z(`${r}.id must be a string`);
  if (!Ft(e.runtimeSlot))
    return z(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return z(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return z(`${r}.color must be a string`);
  if (!Ft(e.key))
    return z(`${r}.key must be an integer in 0..127`);
  const o = Vr(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Vr(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const c = Dl(e.overrides, `${r}.overrides`);
  if (c._tag === "err")
    return c;
  const l = _l(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : tt({
    id: e.id,
    runtimeSlot: e.runtimeSlot,
    name: e.name,
    color: e.color,
    key: e.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: c.value,
    routeAmounts: l.value
  });
}
function Cl(e) {
  const t = {};
  for (const n of ki) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function Nl(e) {
  const t = Ei();
  for (const [n, r] of Object.entries(e))
    Ai(t, n, r);
  return t;
}
const Pl = Object.fromEntries(
  tr.map((e, t) => [e, 2 ** t])
), Fl = Object.fromEntries(
  nr.map((e, t) => [e, 2 ** t])
);
function $r(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Kl(e, t) {
  return tr.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | Pl[r] : n, 0);
}
function jl(e) {
  return nr.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | Fl[n] : t, 0);
}
function Ul(e, t) {
  const n = (o, a) => $r(e, `osc${o}.${a}`), r = (o) => $r(e, o), i = Array.from(
    { length: oi },
    () => gl
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const c = t[o];
    c !== void 0 && (i[c] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: V.map((o) => Kl(e, o)),
    sharedOverrideMask: jl(e),
    framePositions: V.map((o) => n(o, "framePosition")),
    pans: V.map((o) => n(o, "pan")),
    octaves: V.map((o) => n(o, "octave")),
    semitones: V.map((o) => n(o, "semitone")),
    fineCents: V.map((o) => n(o, "fineCents")),
    phases: V.map((o) => n(o, "phase")),
    phaseRandoms: V.map((o) => n(o, "phaseRandom")),
    retriggers: V.map((o) => n(o, "retrigger")),
    volumeDbs: V.map((o) => n(o, "volumeDb")),
    mutes: V.map((o) => n(o, "mute")),
    solos: V.map((o) => n(o, "solo")),
    warpModes: V.map((o) => n(o, "warpMode")),
    warpAmounts: V.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: V.map((o) => n(o, "unisonVoices")),
    unisonDetunes: V.map((o) => n(o, "unisonDetune")),
    unisonBlends: V.map((o) => n(o, "unisonBlend")),
    unisonWidths: V.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: V.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: V.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: V.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: V.map((o) => n(o, "unisonWarpSpread")),
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
function zl(e, t) {
  return e.slots.map((n) => Ul(n, t));
}
function xi(e, t) {
  if (!ht(e))
    return z("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return z('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return ct(new Ti(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = rr(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return z(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return z("selectedSlotId must be null or a string");
  if (!Ml(e.activeTriggerMode))
    return z('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return z("slots must be an array");
  if (e.slots.length > J)
    return z(`slots must contain at most ${J} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const c = Ll(e.slots[a], a, t);
    if (c._tag === "err")
      return c;
    const l = c.value;
    if (i.has(l.id))
      return z(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return z(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    i.add(l.id), o.add(l.runtimeSlot), r.push(l);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? z(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : tt({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function mn(e) {
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
      overrides: Cl(t.overrides),
      routeAmounts: Nl(t.routeAmounts)
    }))
  };
}
function or() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Vl(e) {
  const t = Array.from({ length: J }, () => oe), n = Array.from({ length: J }, () => oe), r = Array.from({ length: J }, () => oe);
  for (const i of e.slots) {
    n[i.key] === oe && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === oe && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === oe && (r[o] = i.runtimeSlot);
  }
  return r[0] = oe, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
async function $l(e, t, n, r = {}) {
  const i = e.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const o = i.reserve(t.input, t.byteLength), a = r.signal?.onAbort(() => i.cancel(o.id));
  try {
    if (n(o), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await i.commit(o.id), { cancel: () => i.cancel(o.id) };
  } catch (c) {
    throw i.cancel(o.id), c;
  } finally {
    a?.();
  }
}
const Bl = 3, Hl = (4 + lt) * 4, Br = "runtimeState";
function ql(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Hr = "runtimeInstallAck", Ri = "runtimeSyncRequest", xn = 0, Wl = 8e3, Kt = /* @__PURE__ */ new WeakMap(), Oi = 1e9;
let St = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Oi;
function Gl(e) {
  return St = St % Oi + 1, e === "modulation" ? -1e9 - St : 1e9 + St;
}
function Yl(e, t) {
  const n = e, r = Kt.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), Kt.set(n, r);
}
function qr(e, t) {
  const n = e, r = Kt.get(n);
  r?.delete(t), r?.size === 0 && Kt.delete(n);
}
const Jl = [100, 250, 500, 1e3], kt = { _tag: "accepted" }, Ql = { _tag: "superseded" }, Xl = { _tag: "stopped" }, Wr = { _tag: "transport-timeout" };
function Zl(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, c = r.rejectedSerial, l = r.rejectionReason, p = r.syncSerial;
  return ![
    i,
    o,
    a,
    c,
    l,
    p
  ].every((h) => typeof h == "number" && Number.isSafeInteger(h) && h >= -2147483648 && h <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof l != "number" || typeof p != "number" || i < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: c,
    rejectionReason: l,
    syncSerial: p
  };
}
function ed(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Gr {
  #t;
  #e;
  #o;
  #d;
  #a = !1;
  #m = /* @__PURE__ */ new Set();
  #r = null;
  #c = null;
  #u = /* @__PURE__ */ new Set();
  #n = null;
  #p = 0;
  #s = /* @__PURE__ */ new Map();
  #h = 0;
  #i = !1;
  #l = 0;
  #g = /* @__PURE__ */ new Set();
  #k = this.#M.bind(this);
  constructor(t, n) {
    this.#t = t, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#o = r && r.length > 0 ? r : [...Jl], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Wl)
    );
  }
  start() {
    if (!this.#i) {
      Yl(this.#t, this.#e);
      try {
        this.#h += 1, this.#i = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(Hr, this.#k);
      } catch (t) {
        throw this.#i = !1, qr(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(Hr, this.#k), qr(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#S();
    }
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    if (n !== this.#r) {
      for (const r of this.#m) r();
      this.#r = n, this.#c = null, this.#u.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#s.clear(), this.#l += 1, this.#S();
    }
  }
  getAcceptedFrontier() {
    return this.#n?.dspSessionId !== this.#r ? 0 : this.#e === "modulation" ? this.#n.acceptedModulationSerial : this.#n.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#n ? { ...this.#n } : null;
  }
  hasSessionBaseline() {
    return this.#r !== null && this.#c === this.#r;
  }
  async waitForSessionBaseline() {
    const t = this.#r, n = this.#h;
    return this.#i ? t === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(t, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(t) {
    if (!this.#i)
      return {
        _tag: "unavailable",
        reason: "not-started"
      };
    if (this.#a)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#r === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#a = !0;
    const n = this.#r, r = this.#h;
    try {
      const i = await this.#T(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of t) {
        const c = await this.#R(
          a,
          n,
          r
        );
        if (c._tag === "rejected" && this.#e === "articulation") {
          o ??= c;
          continue;
        }
        if (c._tag !== "accepted")
          return c;
      }
      return o ?? kt;
    } finally {
      this.#a = !1;
    }
  }
  #A(t) {
    return this.#e === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #E(t, n) {
    const r = this.#A(t);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const t = this.getAcceptedFrontier();
    return this.#e === "modulation" ? t + 1 : t - 1;
  }
  async #T(t, n) {
    if (this.#c === t)
      return kt;
    const r = Gl(this.#e);
    this.#u.add(r);
    const i = Date.now() + this.#d;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#f(t, n);
        if (a)
          return a;
        if (this.#c === t)
          return kt;
        const c = i - Date.now();
        if (c <= 0)
          return Wr;
        const l = this.#l;
        this.#b(r), await this.#I(
          l,
          Math.min(this.#y(o), c)
        ), o += 1;
      }
    } finally {
      this.#u.delete(r);
    }
  }
  async #R(t, n, r) {
    const i = this.#x(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const c = () => {
      a = !0;
      for (const u of o) u();
      o.clear();
    }, l = {
      get aborted() {
        return a;
      },
      onAbort(u) {
        return a ? u() : o.add(u), () => {
          o.delete(u);
        };
      }
    };
    this.#m.add(c);
    const p = async () => {
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: l }) : this.#O(t.endpointID, ed(t.value, n, i)));
    };
    try {
      let u = 0, h = 0, m = this.#p;
      for (await p(); ; ) {
        const g = this.#f(n, r);
        if (g)
          return g;
        const I = this.#v(n, i, m);
        if (I !== null)
          return I;
        const S = this.#l;
        await this.#I(
          S,
          this.#y(u)
        );
        const v = this.#v(
          n,
          i,
          m
        );
        if (v !== null)
          return v;
        let A = this.#l;
        for (this.#b(i); ; ) {
          const _ = this.#f(n, r);
          if (_)
            return _;
          const O = await this.#I(
            A,
            this.#y(u)
          ), E = this.#v(
            n,
            i,
            m
          );
          if (E !== null)
            return E;
          if (O && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
            if (h >= 1)
              return Wr;
            m = this.#p, await p(), h += 1, u += 1;
            break;
          }
          if (O) {
            A = this.#l;
            continue;
          }
          O || (u += 1, A = this.#l, this.#b(i));
        }
      }
    } catch (u) {
      const h = this.#f(n, r);
      if (h) return h;
      throw u;
    } finally {
      c(), this.#m.delete(c);
    }
  }
  #v(t, n, r) {
    const i = this.#n;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#s.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#s.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#E(i, n) ? (this.#s.delete(n), kt) : null;
  }
  #f(t, n) {
    return !this.#i || this.#h !== n ? Xl : this.#r !== t ? Ql : null;
  }
  #y(t) {
    return this.#o[Math.min(
      t,
      this.#o.length - 1
    )];
  }
  #O(t, n) {
    try {
      this.#t.sendEventOrValue?.(
        t,
        n,
        void 0,
        xn
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#i)
      try {
        this.#t.sendEventOrValue?.(
          Ri,
          t,
          void 0,
          xn
        );
      } catch {
      }
  }
  #M(t) {
    const n = Zl(t);
    if (!n || this.#r !== null && n.dspSessionId !== this.#r || this.#c === n.dspSessionId && this.#n?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#n.acceptedModulationSerial || n.acceptedArticulationSerial > this.#n.acceptedArticulationSerial))
      return;
    if (this.#u.has(n.syncSerial) && (this.#c = n.dspSessionId), this.#n = n, this.#p += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#s.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#p
      }); this.#s.size > 16; ) {
        const i = this.#s.keys().next().value;
        if (i === void 0) break;
        this.#s.delete(i);
      }
    this.#l += 1, this.#S();
  }
  #I(t, n) {
    return !this.#i || this.#l !== t ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#g.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#g.add(o);
    });
  }
  #S() {
    for (const t of [...this.#g])
      t.finish(!0);
  }
}
const td = 1e3, nd = [qe, ue];
function Yr(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function pn(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (Yr(r, t)) return r[t];
  if (Yr(n, t)) return n[t];
}
function hn(e, t) {
  if (e === void 0) return or();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = xi(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Jr(e) {
  return new Set(e.routes.flatMap((t) => ai(t) === null ? [] : [t.id]));
}
function Qr(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Xr(e, t) {
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
class rd {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Gr(t, { laneKind: "modulation" }), this.articulationLane = new Gr(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Nt();
  articulationBank = or();
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
    { length: J },
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
    return this.frameworkInput ? [ue] : nd;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Br, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Br, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = pn(t, qe), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Nt() } : Pt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${qe} is invalid; boot state was not installed.`);
      const a = pn(t, ue), c = hn(a, /* @__PURE__ */ new Set());
      c !== null && (this.articulationBank = c, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = pn(t, ue), o = hn(
      i,
      Jr(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${ue} is invalid; boot state was not installed.`);
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
    if (t === qe) {
      const i = Pt(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${qe}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = hn(n, Jr(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ue}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = ql(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Ri, 0, void 0, xn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, c = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, l = this.frameworkInput?.curveCommand ? Fr(r, c, this.frameworkInput.curveCommand) : Fr(r, c), p = await this.modulationLane.sendBatch(l);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", p, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const v = Xr("modulation", p);
      v && o?.(v), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const u = this.buildUploadsBySelector(r, i), h = Array.from({ length: J }, (v, A) => {
      const _ = u.get(A);
      return _ ? Qr(_) : null;
    }), m = this.lastAppliedArticulationGeneration !== n, g = m && this.articulationLane.getAcceptedFrontier() !== 0, I = [];
    for (let v = 0; v < J; v += 1) {
      const A = u.get(v), _ = h[v] !== this.lastAppliedArticulationTokens[v];
      g ? I.push({
        endpointID: ln,
        value: A ?? Ur(v)
      }) : m ? A && I.push({ endpointID: ln, value: A }) : _ && I.push({
        endpointID: ln,
        value: A ?? Ur(v)
      });
    }
    const S = await this.articulationLane.sendBatch(I);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", S, h)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = h;
        const v = Vl(i);
        if (this.frameworkInput) {
          const A = await this.frameworkInput.publishTriggerConfig(v);
          if (!this.started || t !== this.lifecycleEpoch) return;
          A.kind !== "cancelled" && o?.(A);
        } else
          Ol(v, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const A of I) this.lastAppliedArticulationTokens[A.value.selectorA] = void 0;
        const v = Xr("articulation", S);
        v && o?.(v);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = ai(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      zl(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = Qr(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, td));
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
const od = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [ue],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = Zr(e);
    return {
      apply(n, r) {
        return t.closed && (t = Zr(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function Zr(e) {
  let t = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function c(m) {
    const g = r;
    r = void 0, g ? g(m) : m.kind !== "cancelled" && e.report(m);
  }
  function l() {
    t || (t = !0, h.stop(), c({ kind: "cancelled" }), i.clear());
  }
  function p(m) {
    if (m.kind !== "submitted") {
      m.kind === "failed" && m.error.kind !== "transport" && (c(m), l());
      return;
    }
    i.add(m.completion), m.completion.then((g) => {
      i.delete(m.completion), !(t || g.kind === "sent") && (c(g), l());
    }, (g) => {
      t || (l(), e.fail(g));
    });
  }
  const u = {
    addEndpointListener(m, g) {
      const I = o.get(m) ?? /* @__PURE__ */ new Map();
      I.set(g, e.listen(m, g)), o.set(m, I);
    },
    removeEndpointListener(m, g) {
      o.get(m)?.get(g)?.(), o.get(m)?.delete(g);
    },
    addStoredStateValueListener(m) {
      a.set(m, e.subscribeStored(
        ue,
        (g) => m({ key: ue, value: g })
      ));
    },
    removeStoredStateValueListener(m) {
      a.get(m)?.(), a.delete(m);
    },
    requestFullStoredState(m) {
      e.readStored(ue).then((g) => {
        t || m({ values: { [ue]: g } });
      }, (g) => e.fail(g));
    },
    sendEventOrValue(m, g) {
      t || p(e.send({ kind: "event", endpoint: m, value: g }));
    }
  }, h = new rd(u, {
    onDefect(m) {
      l(), e.fail(m);
    },
    curveCommand: (m, g, I) => ({
      async submit({ dspSessionId: S, deliverySerial: v, signal: A }) {
        const _ = await e.prepareData(
          Bl + m * 2 + g,
          Hl,
          (O) => {
            new Int32Array(O.buffer, O.byteOffset, 4).set([1297302855, S, v, lt]), jo(I, new Float32Array(O.buffer, O.byteOffset + 16, lt));
          },
          A
        );
        _.kind === "failed" && (c(_), l());
      }
    }),
    async publishTriggerConfig(m) {
      const I = (await Promise.all(i)).find((v) => v.kind !== "sent");
      if (I) return I.kind === "failed" ? I : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const S = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Si(m) });
      return S.kind === "submitted" ? S.completion : S;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(m, g) {
      if (t || g.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const I = ++n;
      return new Promise((S) => {
        const v = g.signal.onAbort(() => {
          c({ kind: "cancelled" }), l();
        });
        r = (A) => {
          v(), S(A);
        }, h.replaceModulation(m, (A) => {
          I === n && A.kind !== "preparing" && c(A);
        }), h.start();
      });
    },
    stop: l
  };
}
const Mi = 13, ir = 5, wi = 8, id = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), ar = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    fe("globalFilter")
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
    fe("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    fe("ott")
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
    fe("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    fe("flanger")
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
    fe("phaser")
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
    fe("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    fe("reverb")
  ]
}), Di = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), ad = Object.freeze([
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
]), sd = Object.freeze({
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
function cd(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function _i(e, t) {
  const n = {};
  for (const c of ar[e]) {
    const l = t[c];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[c] = l;
      continue;
    }
    const p = sd[c];
    if (p === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${c}`);
    n[c] = p;
  }
  const i = [
    ...Di.chorus,
    fe("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((c) => i.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = cd(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function sr(e) {
  return ar[e];
}
function ld(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= ir)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * wi + id[e];
}
function dd(e, t) {
  const n = new Array(Mi).fill(0), r = _i(e, t);
  return ar[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const ud = "lane.v1", jt = "laneTopology", ft = "laneSlotParams", Rn = "laneSlotParamValue", Li = "laneOutputControl", On = 16, fd = 8, Ci = 4, md = 3, Ni = ir * wi, Pi = 4, pd = 4, hd = Ni, gd = Ni + Pi, vd = 0, yd = 1, bd = 2, Id = 3, Sd = 4, kd = 5;
function Td(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > Ci)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << fd;
}
const Ut = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), zt = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Fi = new Map(
  Object.entries(zt).map(([e, t]) => [t, e])
), Ad = Object.freeze({
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
  Ut.map((e) => [Ad[e], e])
);
const Ed = Object.freeze([
  "voice.filterCutoff",
  ui,
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
]), xd = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ui]: "enhancer-frequency",
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
  Ed.map((e) => [e, Object.freeze({
    id: e,
    family: xd[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ki = 40, ji = 18e3, Mn = Ut.map((e) => zt[e]), Rd = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Od = /^(parallel|split)#([1-9][0-9]*)$/;
function gt(e) {
  if (typeof e != "string")
    return null;
  const t = Rd.exec(e);
  if (t === null)
    return null;
  const n = Mn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > ir ? null : { deviceType: n, instanceNumber: r };
}
function Ui(e) {
  if (typeof e != "string")
    return null;
  const t = Od.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? Pi : pd) ? null : { groupKind: n, unitNumber: r };
}
function Fe(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Je(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function H(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function Md(e, t) {
  const n = gt(e);
  if (n === null)
    return { failure: H(`device id ${e} is not a pool instance`) };
  if (!Fe(t) || !Je(t, ["params"]) || !Fe(t.params))
    return { failure: H(`device ${e} must be { params }`) };
  const r = sr(n.deviceType), i = Fi.get(n.deviceType);
  if (i === void 0)
    return { failure: H(`device ${e} has no effect descriptor`) };
  const o = Bo(i).parameters.map((g) => g.endpointID), a = t.params, c = Object.keys(a), l = (g) => c.length === g.length && c.every((I) => g.includes(I)), p = fe(n.deviceType), u = [
    ...Di[n.deviceType],
    p
  ], h = [
    ...ad,
    p
  ];
  if (!(c.includes(p) && (l(r) || l(o) || l(u) || n.deviceType === "chorus" && l(h))))
    return { failure: H(`device ${e} must carry every parameter once`) };
  for (const g of c) {
    const I = a[g];
    if (typeof I != "number" || !Number.isFinite(I))
      return { failure: H(`device ${e}.${g} must be a finite number`) };
  }
  return { record: { params: _i(n.deviceType, a) } };
}
function wd(e, t) {
  return !Fe(e) || e.kind !== "device" ? { failure: H("branches may hold device placements only") } : Je(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: H(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: H(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: H("a device placement is { kind, deviceId, enabled }") };
}
function eo(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= Ki && e <= ji;
}
function zi() {
  return { mix: 1, bypassed: !1 };
}
function Dd(e) {
  return !Fe(e) || !Je(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function _d(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (u) {
      const h = u instanceof Error ? u.message : String(u);
      return H(`is not valid JSON: ${h}`);
    }
  if (!Fe(t) || !Je(t, ["format", "version", "output", "devices", "chain"]))
    return H("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return H("must be cosimo.lane version 2");
  if (!Fe(t.devices))
    return H("devices must be an object");
  if (!Array.isArray(t.chain))
    return H("chain must be an array");
  const n = Dd(t.output);
  if (n === null)
    return H("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const u of Reflect.ownKeys(t.devices)) {
    if (typeof u != "string")
      return H("device ids must be strings");
    const h = Md(u, t.devices[u]);
    if ("failure" in h)
      return h.failure;
    r[u] = h.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), c = [];
  let l = 0;
  const p = (u) => {
    const h = wd(u, i);
    return "placement" in h && (o.set(
      h.placement.deviceId,
      (o.get(h.placement.deviceId) ?? 0) + 1
    ), l += 1), h;
  };
  for (const u of t.chain) {
    if (!Fe(u))
      return H("chain nodes must be objects");
    if (u.kind === "device") {
      const O = p(u);
      if ("failure" in O)
        return O.failure;
      c.push(O.placement);
      continue;
    }
    if (u.kind !== "parallel" && u.kind !== "split")
      return H(`unknown chain node kind ${String(u.kind)}`);
    const h = u.kind === "split", m = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], I = h ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], S = h && Je(u, m);
    if (!Je(u, I) && !S)
      return H(`a ${u.kind} group is { ${I.join(", ")} }`);
    const v = Ui(u.groupId);
    if (v === null || v.groupKind !== u.kind)
      return H(`group id ${String(u.groupId)} does not name a ${u.kind} unit`);
    if (a.has(String(u.groupId)))
      return H(`group ${String(u.groupId)} is used twice`);
    if (a.add(String(u.groupId)), typeof u.enabled != "boolean")
      return H(`group ${String(u.groupId)} needs a boolean enable`);
    const A = h ? md : Ci;
    if (!Array.isArray(u.branches) || u.branches.length < 2 || u.branches.length > A)
      return H(`group ${String(u.groupId)} needs 2..${A} branches`);
    if (h && (!eo(u.xoverLowHz) || !eo(u.xoverHighHz)))
      return H(`group ${String(u.groupId)} crossovers must sit in ${Ki}..${ji} Hz`);
    if (h && !S && (typeof u.xoverLowKeyTrackEnabled != "boolean" || typeof u.xoverHighKeyTrackEnabled != "boolean" || typeof u.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(u.xoverLowKeyTrackOffsetSemitones) || typeof u.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(u.xoverHighKeyTrackOffsetSemitones)))
      return H(`group ${String(u.groupId)} Key Track state must be finite`);
    l += 1;
    const _ = [];
    for (const O of u.branches) {
      if (!Array.isArray(O))
        return H(`group ${String(u.groupId)} branches must be arrays`);
      const E = [];
      for (const j of O) {
        const q = p(j);
        if ("failure" in q)
          return q.failure;
        E.push(q.placement);
      }
      _.push(E);
    }
    c.push(h ? {
      kind: "split",
      groupId: String(u.groupId),
      enabled: u.enabled,
      xoverLowHz: u.xoverLowHz,
      xoverHighHz: u.xoverHighHz,
      xoverLowKeyTrackEnabled: S ? !1 : u.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: S ? 0 : u.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: S ? !1 : u.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: S ? 0 : u.xoverHighKeyTrackOffsetSemitones,
      branches: _
    } : {
      kind: "parallel",
      groupId: String(u.groupId),
      enabled: u.enabled,
      branches: _
    });
  }
  for (const u of i)
    if ((o.get(u) ?? 0) !== 1)
      return H(`device ${u} must be placed exactly once`);
  return l > On ? H(`flattens to ${l} wire entries; the topology upload holds ${On}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: c } };
}
function Ld() {
  const e = {};
  for (const t of Ut) {
    const n = zt[t];
    e[`${n}#1`] = {
      params: zd(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: zi(),
    devices: e,
    chain: Ut.map((t) => ({
      kind: "device",
      deviceId: `${zt[t]}#1`,
      enabled: !1
    }))
  };
}
const to = ["distortion#1", "delay#1", "reverb#1"];
function Vi() {
  const e = Ld(), t = {};
  for (const n of to) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: zi(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && to.includes(n.deviceId))
  };
}
function Cd(e) {
  if (e === void 0)
    return Vi();
  const t = _d(e);
  return t._tag === "ok" ? t.value : null;
}
function gn(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function Nd(e) {
  return Object.keys(e.devices).map((t) => {
    const n = gt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Mn.indexOf(t.parsed.deviceType) - Mn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function wn(e) {
  const t = gt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return ld(t.deviceType, t.instanceNumber - 1);
}
function $i(e) {
  const t = Ui(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? hd : gd) + (t.unitNumber - 1);
}
function Pd(e) {
  const t = new Array(On).fill(0);
  let n = 0, r = 0;
  const i = (o, a, c) => {
    t[r] = Td(o, a), c && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(wn(o.deviceId), 0, o.enabled);
      continue;
    }
    i($i(o), o.branches.length, o.enabled), o.branches.forEach((a, c) => {
      for (const l of a)
        i(wn(l.deviceId), c + 1, l.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function Fd(e) {
  const t = new Array(Mi).fill(0);
  return t[vd] = e.xoverLowHz, t[yd] = e.xoverHighHz, t[bd] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Id] = e.xoverLowKeyTrackOffsetSemitones, t[Sd] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[kd] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function Kd(e) {
  const t = [{
    endpointID: Li,
    value: e.output
  }];
  let n = 0;
  for (const r of Nd(e)) {
    const i = gt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: Bn(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[fe(i.deviceType)]
    }), n += 1, t.push({
      endpointID: ft,
      value: {
        slotId: wn(r.instanceId),
        deliverySerial: n,
        values: dd(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: ft,
      value: {
        slotId: $i(r),
        deliverySerial: n,
        values: Fd(r)
      }
    }));
  return t.push({
    endpointID: jt,
    value: Pd(e)
  }), t;
}
function jd(e, t, n, r) {
  const i = e.devices[t], o = gt(t);
  if (i === void 0 || o === null || !sr(o.deviceType).includes(n) || !Number.isFinite(r))
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
function Ud(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = is(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const c = Math.min(
      ut,
      Math.max(Pe, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], c) || (n = jd(
      n,
      a,
      o.laneEndpointID,
      c
    ) ?? n);
  }
  return n;
}
function zd(e) {
  const t = Fi.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Bo(t).parameters;
  return Object.fromEntries(sr(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function cr(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) cr(t);
    Object.freeze(e);
  }
}
const Vd = {
  parse(e) {
    const t = Cd(e);
    return t ? (cr(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: gn,
  equals: (e, t) => gn(e) === gn(t)
}, $d = {
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
    const r = xi(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (cr(r.value), { kind: "ok", value: r.value });
  },
  encode: (e) => JSON.stringify(mn(e)),
  equals: (e, t) => JSON.stringify(mn(e)) === JSON.stringify(mn(t))
}, no = [Li, ft, Rn, jt], Bd = { kind: "sent", proof: "native-publication-processed" };
const Hd = {
  eventEndpoints: no,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, c = Promise.resolve();
    const l = (m) => Kd(m).filter((g) => no.includes(g.endpointID));
    async function p(m, g, I = !1) {
      if (a || g.aborted) return { kind: "cancelled" };
      const S = l(m), v = t && !I ? l(t) : [], A = (E) => E.find((j) => j.endpointID === jt)?.value, _ = v.length > 0 && JSON.stringify(A(v)) === JSON.stringify(A(S)), O = [];
      for (const E of S) {
        if (!_) {
          O.push(E);
          continue;
        }
        if (E.endpointID !== jt)
          if (E.endpointID === ft) {
            const j = E.value, q = v.find((se) => se.endpointID === E.endpointID && se.value.slotId === j.slotId), $ = q ? q.value.values : [], te = j.values.flatMap((se, d) => Object.is(se, $[d]) ? [] : [d]);
            te.length === 1 ? O.push({
              endpointID: Rn,
              value: { slotId: j.slotId, paramIndex: te[0], value: j.values[te[0]] }
            }) : te.length > 1 && O.push(E);
          } else JSON.stringify(E.value) !== JSON.stringify(v.find((j) => j.endpointID === E.endpointID)?.value) && O.push(E);
      }
      t = void 0;
      for (const E of O) {
        if (a || g.aborted) return { kind: "cancelled" };
        const j = E.endpointID === ft || E.endpointID === Rn ? { ...Object(E.value), deliverySerial: ++r } : E.value, q = e.send({ kind: "event", endpoint: E.endpointID, value: j }), $ = q.kind === "submitted" ? await q.completion : q;
        if ($.kind !== "sent") return $;
      }
      return a || g.aborted ? { kind: "cancelled" } : (t = m, Bd);
    }
    function u(m, g, I = !1) {
      const S = c.then(() => p(m, g, I));
      return c = S.catch(() => {
      }), S;
    }
    const h = e.listen("runtimeState", (m) => {
      const g = m !== null && typeof m == "object" ? Reflect.get(m, "dspSessionId") : void 0;
      if (typeof g != "number" || g === o) return;
      const I = o !== void 0;
      o = g;
      const S = i;
      I && n && u(n, e.signal, !0).then((v) => {
        v.kind === "failed" && S === i && e.report(v);
      }, e.fail);
    });
    return {
      apply(m, g) {
        return i += 1, n = m, u(m, g.signal);
      },
      stop() {
        a = !0, h();
      }
    };
  }
}, qd = Object.freeze({
  ...Object.fromEntries(Rt.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, w(t)]))),
  ...Object.fromEntries(zo().map((e) => [e, w(e)])),
  playMode: w("playMode"),
  glideTime: w("glideTime"),
  macro1: w("macro1"),
  macro2: w("macro2"),
  macro3: w("macro3"),
  macro4: w("macro4"),
  filterMode: w("filterMode"),
  filterCutoff: w("filterCutoff"),
  filterQ: w("filterQ"),
  mseg1Morph: w("mseg1Morph"),
  mseg2Morph: w("mseg2Morph"),
  mseg3Morph: w("mseg3Morph"),
  mseg1Rate: w("mseg1Rate"),
  mseg2Rate: w("mseg2Rate"),
  mseg3Rate: w("mseg3Rate"),
  env1Attack: w("env1Attack"),
  env1Decay: w("env1Decay"),
  env1Sustain: w("env1Sustain"),
  env1Release: w("env1Release"),
  env2Attack: w("env2Attack"),
  env2Decay: w("env2Decay"),
  env2Sustain: w("env2Sustain"),
  env2Release: w("env2Release"),
  env3Attack: w("env3Attack"),
  env3Decay: w("env3Decay"),
  env3Sustain: w("env3Sustain"),
  env3Release: w("env3Release"),
  filterMix: w("filterMix"),
  ampRelease: w("ampRelease"),
  sourceMode: w("sourceMode"),
  globalTune: w("globalTune"),
  ampAttack: w("ampAttack"),
  ampDecay: w("ampDecay"),
  ampSustain: w("ampSustain"),
  filterCutoffKeyTrackEnabled: w("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: w("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: w("voiceEnhancerFrequency"),
  voiceEnhancerQ: w("voiceEnhancerQ"),
  voiceEnhancerAmount: w("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: w("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: w("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: w("polishEnhancerAmount"),
  polishCompressionClipAmount: w("polishCompressionClipAmount"),
  polishOutputTrimDb: w("polishOutputTrimDb"),
  polishSafeBassAmount: w("polishSafeBassAmount"),
  polishSafeBassBypass: w("polishSafeBassBypass"),
  polishEnhancerBypass: w("polishEnhancerBypass"),
  polishCompressionClipBypass: w("polishCompressionClipBypass"),
  polishOutputTrimBypass: w("polishOutputTrimBypass")
}), Wd = Ua({
  ...qd,
  [qe]: Ir({ initial: Nt(), codec: cl, prepare: (e) => e, engine: od }),
  [ud]: Ir({
    initial: Vi(),
    codec: Vd,
    dependencies: zo(),
    prepare: (e, { parameters: t }) => Ud(e, t),
    engine: Hd
  }),
  [ue]: _o({ initial: or(), codec: $d })
}), Ot = 2048;
function ot(e, t) {
  if (!e)
    throw new Error(t);
}
function Gd(e) {
  ot(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    ot(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), ot(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), ot(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), ot(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const Yd = 2048, Vt = 11, Jd = 256;
function be(e, t) {
  if (!e)
    throw new Error(t);
}
function Qd(e) {
  return e > 0 && (e & e - 1) === 0;
}
const ro = /* @__PURE__ */ new Map();
function Xd(e) {
  const t = ro.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let c = 0; c < n; c += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return ro.set(e, r), r;
}
function Bi(e, t, n = !1) {
  const r = e.length;
  be(r === t.length, "FFT real and imaginary buffers must have the same length"), be(Qd(r), "FFT input length must be a power of two");
  const i = Xd(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const c = e[o];
    e[o] = e[a], e[a] = c;
    const l = t[o];
    t[o] = t[a], t[a] = l;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, c = (n ? 2 : -2) * Math.PI / o, l = Math.cos(c), p = Math.sin(c);
    for (let u = 0; u < r; u += o) {
      let h = 1, m = 0;
      for (let g = 0; g < a; g += 1) {
        const I = u + g, S = I + a, v = e[S], A = t[S], _ = h * v - m * A, O = h * A + m * v, E = e[I], j = t[I];
        e[I] = E + _, t[I] = j + O, e[S] = E - _, t[S] = j - O;
        const q = h * l - m * p;
        m = h * p + m * l, h = q;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Hi(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function Zd(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Yd,
  maxFramesPerTable: r = Jd
} = {}) {
  const i = Float32Array.from(e);
  be(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  be(o > 0, "Source wavetable files must contain at least one frame"), be(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && be(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let c = 0; c < o; c += 1) {
    const l = c * n, p = l + n;
    a.push(Hi(i.slice(l, p)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function oo(e) {
  const t = Hi(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Bi(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function qi(e, t, {
  mipLevelCount: n = Vt
} = {}) {
  const r = e?.real?.length ?? 0;
  be(r > 0, "Spectrum must contain real samples"), be(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), be(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let c = 1; c <= i; c += 1) {
    o[c] = e.real[c], a[c] = e.imaginary[c];
    const l = (r - c) % r;
    l !== c && (o[l] = e.real[l], a[l] = e.imaginary[l]);
  }
  return Bi(o, a, !0), Float32Array.from(o);
}
const Mt = 256, it = 2048, Wi = 8, eu = 12811, Dn = (Wi + Mt * eu) * 4;
function io(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function tu(e, t, n) {
  if (e.byteLength !== Dn || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Mt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    Vt,
    Mt
  ]);
  let i = Wi;
  const o = 131071, a = 8191, c = Math.fround(o / 1.5), l = Math.fround(a / 0.5);
  for (let p = 0; p < Vt; ++p) {
    const u = Math.min(it, Math.max(256, (1 << p) * 32)), h = it / u;
    for (let m = 0; m < t.frameCount; ++m) {
      const g = qi(n(m), p), I = i + m * (u + 1);
      for (let S = 0; S <= u; ++S) {
        const v = (S === u ? 0 : S) * h, A = (v + it - h) % it, _ = (v + h) % it, O = g[v], E = g[A], j = g[_];
        if (O === void 0 || E === void 0 || j === void 0 || !Number.isFinite(O) || !Number.isFinite(E) || !Number.isFinite(j))
          throw new Error("Wavetable preparation produced invalid samples.");
        const q = Math.fround(0.5 * Math.fround(j - E));
        r[I + S] = io(O, c, o) & 262143 | io(q, l, a) << 18;
      }
    }
    i += (u + 1) * Mt;
  }
}
const nu = "runtimeSyncRequest", ru = 2147483647, ou = "runtimeState", iu = "retryDesiredTableRequest", au = "workerLoadFailure", su = "serviceLoadAbort", cu = "wavetableLoadBegin", lu = "wavetableMipFrame", du = "wavetableUploadAck", uu = "wavetableMipRequest", fu = "wavetablePrewarmRequest", mu = "wavetablePrewarmNotification", pu = "assets/factory-bank-catalog.json", _n = 3, hu = 1, gu = _n * Ot, vu = 1, yu = 2, bu = 3, Iu = 1, Su = 2, ku = 2e4, Tt = vu, ao = yu, so = bu, Re = Iu, co = Su, Tu = 48 * 1024 * 1024, vn = 3;
function lo(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function Q(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function uo(e) {
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
function fo(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function mo(e, t) {
  if (!e)
    throw new Error(t);
}
function Au(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function Eu(e, t) {
  return Gd(await e.readJSON(t));
}
function xu(e) {
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
function Ru(e, t) {
  const n = Math.round(Number(e) || 0);
  return Au(n, 0, Math.max(0, t - 1));
}
function yn(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Ou(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function po(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function ho(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function At() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Mu(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class wu {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = na(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? pu, this.maxBatchesInFlight = lo(
      n.maxFramesInFlight,
      hu
    ), this.mipLevelCount = n.mipLevelCount ?? Vt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Tu) || 0)), this.serviceLoadTimeoutMs = lo(n.serviceLoadTimeoutMs, ku), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, Q("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ou, this.handleRuntimeState), this.connection.addEndpointListener?.(du, this.handleUploadAck), this.connection.addEndpointListener?.(uu, this.handleMipRequest), this.connection.addEndpointListener?.(fu, this.handlePrewarmRequest), this.connection.addEndpointListener?.(mu, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      nu,
      ru
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Eu(this.resourceClient, this.catalogPath), Q("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < vn; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = po(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: po(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = yn(
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
          ...ho(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (Q("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: so,
          failureReasonCode: co
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== so || t.failureReasonCode !== co ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Tt,
    failureReasonCode: c = Re
  }) {
    this.connection.sendEventOrValue?.(au, {
      dspSessionId: t,
      oscillatorIndex: n,
      tableIndex: r,
      generation: i,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: c
    });
  }
  emitServiceLoadAbort({
    dspSessionId: t,
    oscillatorIndex: n,
    generation: r,
    tableIndex: i,
    failureReasonCode: o = Re
  }) {
    this.connection.sendEventOrValue?.(su, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    Q("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? uo(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(iu, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = Ru(t, r.tables.length), o = r.tables[i];
    mo(o, `Could not resolve table ${i}`);
    const a = Ou(o, Ot, this.mipLevelCount), c = this.tableCache.get(a);
    if (c)
      return c.lastUsedSerial = this.cacheUseSerial++, Q("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: c.frameCount,
        cacheBytes: this.tableCacheBytes
      }), c;
    const l = At();
    Q("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const p = await this.resourceClient.readAudio(o.sourceWav), u = Zd(p.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Ot
    });
    return Q("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(At() - l)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, r) {
    if (Q("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(cu, {
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
    const n = At();
    try {
      if (await $l(this.connection, {
        input: t.oscillatorIndex,
        byteLength: Dn
      }, (r) => {
        tu(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      Q("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: Dn,
        preparationMs: At() - n,
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
        failurePhase: ao,
        failureReasonCode: Re
      }), this.serviceTable = null, this.clearMipTransferState(), Q("error", "Shared wavetable preparation failed", { detail: st(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    Q("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: Tt,
      failureReasonCode: Re
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: Tt,
      failureReasonCode: Re
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = Tt,
    failureReasonCode: r = Re
  } = {}) {
    Q("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (Q("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: st(o)
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
      this.isCurrentRuntimeState(t) && (Q("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: st(a)
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
    for (let t = 0; t < vn; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Mu(() => {
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
        Q("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: Re
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
    const n = xu(t ?? {});
    if (Q("info", "Received runtime state", uo(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= vn)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const i = n.oscillatorIndex, o = this.latestRuntimeStates[i], a = o ? this.getDesiredRetryKey(o) : null, c = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[i] = Math.max(
      this.nextLoadGenerations[i] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== c) && (this.autoRetryConsumedKeys[i] = null), this.latestRuntimeStates[i] = n, this.pendingRuntimeStateOscillators.add(i), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(t) {
    const n = t !== null && typeof t == "object" && !Array.isArray(t) ? t : null, r = Math.trunc(Number(n?.tableIndex ?? t));
    if (Number.isFinite(r))
      try {
        const i = await this.loadTableSource(r);
        for (let a = 0; a < i.frameCount; a += 1)
          i.spectra[a] || (i.spectra[a] = oo(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), Q("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        Q("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: st(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), c = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = yn(
      n,
      r,
      i,
      o,
      a
    );
    let p = this.mipJobs.get(l);
    return p ? (!p.completed && c > p.urgencyLevel && (p.urgencyLevel = c), p) : (p = {
      key: l,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: c,
      ...ho(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, p), p);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (Q("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), c = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), p = Math.trunc(Number(n.frameCount)), u = yn(
      r,
      i,
      o,
      a,
      c
    ), h = this.mipJobs.get(u), m = this.serviceTable?.frameCount ?? 0, g = Math.min(
      _n,
      m - l
    );
    if (!(!h || h.completed || !h.inFlightBatchBases.has(l) || p <= 0 || p !== g)) {
      h.inFlightBatchBases.delete(l);
      for (let I = 0; I < p; I += 1) {
        const S = l + I;
        h.ackedFrames[S] || (h.ackedFrames[S] = 1, h.ackedFrameCount += 1);
      }
      h.ackedFrameCount === m && h.nextFrameIndex >= m && h.inFlightBatchBases.size === 0 && (h.completed = !0, this.activeUploadKey === h.key && (this.activeUploadKey = null)), fo(l, p, m) && Q("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: h.tableIndex,
        mipIndex: c,
        frameIndexBase: l,
        batchFrameCount: p,
        ackedFrameCount: h.ackedFrameCount,
        frameCount: m,
        inFlightBatches: h.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (mo(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = oo(this.serviceTable.frames[t]);
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
        _n,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(gu);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, c = this.getSpectrumForFrame(a), l = qi(c, t.mipIndex);
          i.set(l, o * Ot);
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
            failurePhase: ao,
            failureReasonCode: Re
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(lu, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), fo(n, r, this.serviceTable.frameCount) && Q("info", "Sent wavetable mip batch", {
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
function st(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Du(e, t = {}) {
  return new wu(e, t);
}
async function _u(e, t = {}) {
  return Wa(e, [
    () => Du(e, { ...t, delivery: "shared" }),
    () => Ba(Wd, e, {
      onDefect: (n) => console.error("Cosimo state failed", st(n))
    })
  ]);
}
export {
  hu as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  yu as FAILURE_PHASE_BUILD_MIP,
  vu as FAILURE_PHASE_LOAD_SOURCE,
  bu as FAILURE_PHASE_TRANSFER_MIP,
  Iu as FAILURE_REASON_GENERIC,
  Su as FAILURE_REASON_TIMEOUT,
  _n as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  ru as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  wu as WavetableWorkerController,
  Du as createWavetableWorkerController,
  _u as default
};
