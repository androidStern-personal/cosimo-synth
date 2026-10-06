function Re(e) {
  throw new Error(e);
}
function yn(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function Pr(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function za(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Fr(e, t) {
  return typeof t == "string" ? za(t) : t instanceof ArrayBuffer ? new Uint8Array(t.slice(0)) : ArrayBuffer.isView(t) ? new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength)) : Array.isArray(t) ? Uint8Array.from(t) : Re(`The host returned ${e} in a form this kit cannot read.`);
}
function jr(e, t) {
  const n = new DataView(t);
  (n.byteLength < 12 || yn(n, 0, 4) !== "RIFF" || yn(n, 8, 4) !== "WAVE") && Re(`${e} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, c = 0;
  for (let d = 12; d + 8 <= n.byteLength; ) {
    const h = yn(n, d, 4), f = n.getUint32(d + 4, !0), g = d + 8;
    h === "fmt " ? (r = n.getUint16(g, !0), i = n.getUint16(g + 2, !0), o = n.getUint32(g + 4, !0), a = n.getUint16(g + 14, !0)) : h === "data" && (s = g, c = Math.min(f, n.byteLength - g)), d = g + f + f % 2;
  }
  (s < 0 || r === 0) && Re(`${e} is missing its WAV format or data chunk.`), i !== 1 && Re(`${e} has ${i} channels; readAudio reads mono WAV files only.`);
  const m = t.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(m, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const d = new Int16Array(m, 0, Math.floor(c / 2));
    return { sampleRate: o, samples: Float32Array.from(d, (h) => h / 32768) };
  }
  return Re(`${e} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function Ua(e, t) {
  const n = t ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && Re(`The host decoded ${e} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : Re(`${e} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function zr() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0) return new URL("/", e);
  const t = new URL(import.meta.url);
  return t.pathname = t.pathname.replace(/\/[^/]*$/, "/"), t;
}
function Ur(e, t) {
  return t instanceof URL ? t : typeof t == "string" && t.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t) ? new URL(t) : new URL(t.replace(/^\//, ""), zr()) : new URL(e, zr());
}
function Ka(e) {
  const t = e ?? {}, n = async (i) => {
    typeof fetch != "function" && Re(`Cannot read ${i}: this host has neither a resource bridge nor fetch.`);
    const o = Ur(i, t.getResourceAddress?.(i)), a = await fetch(o.toString());
    return a.ok || Re(`Could not read ${i} from ${o} (HTTP ${a.status}).`), a.arrayBuffer();
  }, r = async (i) => t.readResource ? Fr(i, await t.readResource(i)) : new Uint8Array(await n(i));
  return {
    async readText(i) {
      if (!t.readResource) return Pr(new Uint8Array(await n(i)));
      const o = await t.readResource(i);
      return typeof o == "string" ? o : typeof o == "object" && o !== null && "text" in o && typeof o.text == "function" ? String(await o.text()) : Pr(Fr(i, o));
    },
    async readJSON(i) {
      return JSON.parse(await this.readText(i));
    },
    readBytes: r,
    async readAudio(i) {
      const o = t.getResourceAddress?.(i);
      return o != null && typeof fetch == "function" ? jr(i, await n(i)) : t.readResourceAsAudioData ? Ua(i, await t.readResourceAsAudioData(i)) : jr(i, new Uint8Array(await r(i)).buffer);
    },
    getURL(i) {
      return Ur(i, t.getResourceAddress?.(i));
    }
  };
}
function St(...e) {
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
    for (const s of r) s();
    r.clear();
    const a = [...n];
    n.clear();
    for (const s of a) s();
  }
  for (const a of e) {
    const s = a.onAbort(o);
    t ? s() : r.add(s);
  }
  return { signal: i, cancel: o };
}
function Kr(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function vn(e) {
  let t = !1, n;
  const r = () => n ??= Promise.resolve(e.transport.stop());
  let i, o;
  const a = /* @__PURE__ */ new Set();
  async function s(m, d, h) {
    const { signal: f } = h;
    if (e.onStatus(d, { kind: "preparing" }), f.aborted) return;
    const g = await Kr(e.prepare(m, f), f);
    if (g.kind === "cancelled" || f.aborted) return;
    const b = g.value;
    if (b.kind === "error") {
      e.onStatus(d, { kind: "failed", error: b.error });
      return;
    }
    let I = !0;
    h.applying = !0;
    let y;
    try {
      y = await Kr(e.transport.apply(b.value, {
        signal: f,
        send: (A) => f.aborted || !I ? { kind: "cancelled" } : A()
      }), f);
    } catch (A) {
      f.aborted || (t = !0, i?.cancel(), r(), e.onDefect(A), e.onStatus(d, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      I = !1, h.applying = !1;
    }
    y.kind === "value" && !f.aborted && y.value.kind !== "cancelled" && e.onStatus(d, y.value);
  }
  function c(m, d) {
    o = void 0;
    const h = i, f = { ...St(), applying: !1, target: d };
    if (i = f, h?.cancel(), t || f.signal.aborted) return;
    const g = s(m, d, f).catch((b) => {
      f.signal.aborted || (f.cancel(), e.onDefect(b), e.onStatus(d, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    a.add(g), g.then(() => {
      if (a.delete(g), i !== f) return;
      i = void 0;
      const b = o;
      o = void 0, !t && b && c(b.input, b.target);
    });
  }
  return {
    /** Apply the declared replacement policy; ignored after stop or a transport defect. */
    replace(m, d) {
      if (!t) {
        if (e.replacement === "finish" && i?.applying && !i.signal.aborted && i.target.scope.owner === d.scope.owner && i.target.scope.document === d.scope.document) {
          o = { input: m, target: d }, e.onStatus(d, { kind: "preparing" });
          return;
        }
        c(m, d);
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
let $a = 0;
function $r(e, t) {
  const n = `atom${++$a}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = Va, r.write = Ba), r;
}
function Va(e) {
  return e(this);
}
function Ba(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Xo = "a", ze = "m", ln = "i", Ze = "c", or = "q", ir = "Q", Ue = "h", Zo = "R", ei = "W", ti = "I", ni = "M", Me = "e", ft = "f", et = "C", mt = "r", ar = "d", dn = "w", un = "D", fn = "t", mn = "T", sr = "v", Vr = "g", Br = "s", Hr = "b", Ha = "B", cr = "p", ri = "H", oi = "A", lr = "E";
function ii(e) {
  return "init" in e;
}
function qa(e) {
  return typeof e.write == "function";
}
function Wa(e) {
  return !!e.onMount;
}
function qr(e) {
  return "v" in e || "e" in e;
}
function Jt(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function Yt(e) {
  return typeof e?.then == "function";
}
function Ga(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function ai(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function si(e, t, n) {
  const i = n.get(e)?.t, o = t.p;
  if (!i?.size)
    return o;
  if (!o.size)
    return i;
  const a = new Set(i);
  for (const s of o)
    a.add(s);
  return a;
}
function Ja(e) {
  return !!e.INTERNAL_onInit;
}
const Ya = (e, t, n, ...r) => n.read(...r), Qa = (e, t, n, ...r) => n.write(...r), Xa = (e, t, n) => n.INTERNAL_onInit(t), Za = (e, t, n, r) => n.onMount?.(r), es = (e, t, n) => {
  const r = e[Xo];
  let i = r.get(n);
  if (!i) {
    const o = e[Ue], a = e[ti];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), Ja(n) && a(e, t, n);
  }
  return i;
}, ts = (e, t) => {
  const n = e[ze], r = e[Ze], i = e[or], o = e[ir], a = e[Ue], s = e[et];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const c = [], m = (d) => {
    try {
      d();
    } catch (h) {
      c.push(h);
    }
  };
  do {
    a.f && m(a.f);
    const d = /* @__PURE__ */ new Set();
    for (const h of r) {
      const f = n.get(h)?.l;
      if (f)
        for (const g of f)
          d.add(g);
    }
    r.clear();
    for (const h of o)
      d.add(h);
    o.clear();
    for (const h of i)
      d.add(h);
    i.clear();
    for (const h of d)
      m(h);
    r.size && s(e, t);
  } while (r.size || o.size || i.size);
  if (c.length)
    throw typeof AggregateError == "function" ? new AggregateError(c) : Object.assign(new Error(), { errors: c });
}, ns = (e, t) => {
  const n = e[ze], r = e[ln], i = e[Ze], o = e[Me], a = e[mt], s = e[un];
  if (!i.size)
    return;
  const c = [], m = [], d = /* @__PURE__ */ new WeakSet(), h = /* @__PURE__ */ new WeakSet(), f = [], g = [];
  for (const b of i)
    f.push(b), g.push(o(e, t, b));
  for (; f.length; ) {
    const b = f.length - 1, I = f[b], y = g[b];
    if (h.has(I)) {
      f.pop(), g.pop();
      continue;
    }
    if (d.has(I)) {
      r.get(I) === y.n && (c.push(I), m.push(y)), h.add(I), f.pop(), g.pop();
      continue;
    }
    d.add(I);
    for (const A of si(I, y, n))
      d.has(A) || (f.push(A), g.push(o(e, t, A)));
  }
  for (let b = c.length - 1; b >= 0; --b) {
    const I = c[b], y = m[b];
    let A = !1;
    for (const F of y.d.keys())
      if (F !== I && i.has(F)) {
        A = !0;
        break;
      }
    A && (r.set(I, y.n), a(e, t, I), s(e, t, I)), r.delete(I);
  }
};
const rs = (e, t, n) => {
  const r = e[ze], i = e[ln], o = e[Ze], a = e[Ue], s = e[Zo], c = e[Me], m = e[ft], d = e[et], h = e[mt], f = e[un], g = e[sr], b = e[ri], I = e[lr], y = c(e, t, n), A = I[0];
  if (qr(y)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== y.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      y.m === A
    )
      return y.m = A, y;
    let N = !1;
    for (const [R, E] of y.d)
      if (h(e, t, R).n !== E) {
        N = !0;
        break;
      }
    if (!N)
      return y.m = A, y;
  }
  let F = !0;
  const _ = new Set(y.d.keys()), M = () => {
    for (const N of _)
      y.d.delete(N);
  }, D = () => {
    if (r.has(n)) {
      const N = !o.size;
      f(e, t, n), N && (d(e, t), m(e, t));
    }
  }, ee = (N) => {
    if (N === n) {
      const E = c(e, t, N);
      if (!qr(E))
        if (ii(N))
          g(e, t, N, N.init);
        else
          throw new Error("no atom init");
      return Jt(E);
    }
    const R = h(e, t, N);
    try {
      return Jt(R);
    } finally {
      _.delete(N), y.d.set(N, R.n), Yt(y.v) && ai(n, y.v, R), r.has(n) && r.get(N)?.t.add(n), F || D();
    }
  };
  let Y;
  const pe = {
    get signal() {
      return Y || (Y = new AbortController()), Y.signal;
    }
  }, te = y.n, ge = i.get(n) === te;
  try {
    const N = s(e, t, n, ee, pe);
    if (g(e, t, n, N), Yt(N)) {
      b(e, t, N, () => Y?.abort());
      const R = () => {
        M(), D();
      };
      N.then(R, R);
    } else
      M();
    return a.r?.(n), y.m = A, y;
  } catch (N) {
    if (Ga(N))
      throw N;
    return delete y.v, y.e = N, ++y.n, y.m = A, y;
  } finally {
    F = !1, y.n !== te && ge && (i.set(n, y.n), o.add(n), a.c?.(n));
  }
}, os = (e, t, n) => {
  const r = e[ze], i = e[ln], o = e[Me], a = [n];
  for (; a.length; ) {
    const s = a.pop(), c = o(e, t, s);
    for (const m of si(s, c, r)) {
      const d = o(e, t, m);
      i.get(m) !== d.n && (i.set(m, d.n), a.push(m));
    }
  }
}, is = (e, t, n, r) => {
  const i = e[Ze], o = e[Ue], a = e[ei], s = e[Me], c = e[ft], m = e[et], d = e[mt], h = e[ar], f = e[dn], g = e[un], b = e[sr], I = e[lr];
  let y = !0;
  const A = (_) => Jt(d(e, t, _)), F = (_, ...M) => {
    const D = s(e, t, _);
    try {
      if (_ === n) {
        if (!ii(_))
          throw new Error("atom not writable");
        const ee = D.n, Y = M[0];
        b(e, t, _, Y), g(e, t, _), ee !== D.n && (++I[0], i.add(_), h(e, t, _), o.c?.(_));
        return;
      } else
        return f(e, t, _, M);
    } finally {
      y || (m(e, t), c(e, t));
    }
  };
  try {
    return a(e, t, n, A, F, ...r);
  } finally {
    y = !1;
  }
}, as = (e, t, n) => {
  const r = e[ze], i = e[Ze], o = e[Ue], a = e[Me], s = e[ar], c = e[fn], m = e[mn], d = a(e, t, n), h = r.get(n);
  if (h && d.d.size > 0) {
    for (const [f, g] of d.d)
      if (!h.d.has(f)) {
        const b = a(e, t, f);
        c(e, t, f).t.add(n), h.d.add(f), g !== b.n && (i.add(f), s(e, t, f), o.c?.(f));
      }
    for (const f of h.d)
      d.d.has(f) || (h.d.delete(f), m(e, t, f)?.t.delete(n));
  }
}, ss = (e, t, n) => {
  const r = e[ze], i = e[or], o = e[Ue], a = e[ni], s = e[Me], c = e[ft], m = e[et], d = e[mt], h = e[dn], f = e[fn], g = s(e, t, n);
  let b = r.get(n);
  if (!b) {
    d(e, t, n);
    for (const I of g.d.keys())
      f(e, t, I).t.add(n);
    if (b = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(g.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, b), qa(n) && Wa(n)) {
      const I = () => {
        let y = !0;
        const A = (...F) => {
          try {
            return h(e, t, n, F);
          } finally {
            y || (m(e, t), c(e, t));
          }
        };
        try {
          const F = a(e, t, n, A);
          F && (b.u = () => {
            y = !0;
            try {
              F();
            } finally {
              y = !1;
            }
          });
        } finally {
          y = !1;
        }
      };
      i.add(I);
    }
    o.m?.(n);
  }
  return b;
}, cs = (e, t, n) => {
  const r = e[ze], i = e[ir], o = e[Ue], a = e[Me], s = e[mn], c = a(e, t, n);
  let m = r.get(n);
  if (!m || m.l.size)
    return m;
  let d = !1;
  for (const h of m.t)
    if (r.get(h)?.d.has(n)) {
      d = !0;
      break;
    }
  if (!d) {
    m.u && i.add(m.u), m = void 0, r.delete(n);
    for (const h of c.d.keys())
      s(e, t, h)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return m;
}, ls = (e, t, n, r) => {
  const i = e[Me], o = e[oi], a = i(e, t, n), s = "v" in a, c = a.v;
  if (Yt(r))
    for (const m of a.d.keys())
      ai(n, r, i(e, t, m));
  a.v = r, delete a.e, (!s || !Object.is(c, a.v)) && (++a.n, Yt(c) && o(e, t, c));
}, ds = (e, t, n) => {
  const r = e[mt];
  return Jt(r(e, t, n));
}, us = (e, t, n, ...r) => {
  const i = e[Ze], o = e[ft], a = e[et], s = e[dn], c = i.size;
  try {
    return s(e, t, n, r);
  } finally {
    i.size !== c && (a(e, t), o(e, t));
  }
}, fs = (e, t, n, r) => {
  const i = e[ft], o = e[et], a = e[fn], s = e[mn], m = a(e, t, n).l;
  return m.add(r), o(e, t), i(e, t), () => {
    m.delete(r), s(e, t, n), o(e, t), i(e, t);
  };
}, ms = (e, t, n, r) => {
  const i = e[cr];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, ps = (e, t, n) => {
  e[cr].get(n)?.forEach((o) => o());
}, hs = /* @__PURE__ */ new WeakMap();
function gs(e) {
  const t = {
    get(s) {
      return i(r, t, s);
    },
    set(s, ...c) {
      return o(r, t, s, ...c);
    },
    sub(s, c) {
      return a(r, t, s, c);
    }
  }, n = {
    // store state
    [Xo]: /* @__PURE__ */ new WeakMap(),
    [ze]: /* @__PURE__ */ new WeakMap(),
    [ln]: /* @__PURE__ */ new WeakMap(),
    [Ze]: /* @__PURE__ */ new Set(),
    [or]: /* @__PURE__ */ new Set(),
    [ir]: /* @__PURE__ */ new Set(),
    [Ue]: {},
    // atom interceptors
    [Zo]: Ya,
    [ei]: Qa,
    [ti]: Xa,
    [ni]: Za,
    // building-block functions
    [Me]: es,
    [ft]: ts,
    [et]: ns,
    [mt]: rs,
    [ar]: os,
    [dn]: is,
    [un]: as,
    [fn]: ss,
    [mn]: cs,
    [sr]: ls,
    // store api
    [Vr]: ds,
    [Br]: us,
    [Hr]: fs,
    [Ha]: void 0,
    // abortable promise support
    [cr]: /* @__PURE__ */ new WeakMap(),
    [ri]: ms,
    [oi]: ps,
    // store epoch
    [lr]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  hs.set(t, r);
  const i = r[Vr], o = r[Br], a = r[Hr];
  return t;
}
function ys() {
  return gs();
}
const vs = /* @__PURE__ */ new Set(["closed", "open-failed", "opened", "replaced", "parameter", "attached-client", "detach", "command", "published"]);
function ce(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function ci(e, t = 1 / 0) {
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
function li() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= ci(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Kn(e) {
  const t = li(), n = (r, i) => {
    if (!t.node(i)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const o of r) if (!n(o, i + 1)) return !1;
      return !0;
    }
    if (!ce(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function oe(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function Te(e) {
  return typeof e == "string" && e.length > 0 && ci(e) <= 256;
}
function dr(e) {
  return ce(e) && Te(e.owner) && oe(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function bs(e) {
  if (!ce(e) || !oe(e.id)) return;
  const t = dr(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function Is(e) {
  const t = dr(e);
  return t && ce(e) && oe(e.client) && oe(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function Wr(e) {
  if (!ce(e) || !Array.isArray(e.parameters) || !ce(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!ce(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c } = n;
    if (!Te(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function Ss(e) {
  if (ce(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = bs(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (e.kind === "edit-many") {
      if (!Array.isArray(e.edits) || e.edits.length === 0 || e.history !== void 0 && e.history !== !1 || e.recall !== void 0 && e.recall !== !0 || e.gesture !== void 0 && (!oe(e.gesture) || e.history === !1 || e.recall === !0)) return;
      const t = [], n = /* @__PURE__ */ new Set();
      for (const r of e.edits) {
        if (!ce(r) || !Te(r.key) || n.has(r.key) || !Object.hasOwn(r, "value") || Object.hasOwn(r, "gesture") || r.expectedVersion !== void 0 && !oe(r.expectedVersion, !1)) return;
        n.add(r.key), t.push({ key: r.key, value: r.value, ...r.expectedVersion !== void 0 ? { expectedVersion: r.expectedVersion } : {} });
      }
      return {
        kind: "edit-many",
        edits: t,
        ...e.history === !1 ? { history: !1 } : {},
        ...e.recall === !0 ? { recall: !0 } : {},
        ...e.gesture !== void 0 ? { gesture: e.gesture } : {}
      };
    }
    if (e.kind === "begin" || e.kind === "end") {
      if (!oe(e.gesture) || e.label !== void 0 && typeof e.label != "string" || !Array.isArray(e.keys) || e.keys.length === 0 || !e.keys.every(Te) || new Set(e.keys).size !== e.keys.length) return;
      const t = Object.freeze([...e.keys]);
      return e.kind === "end" ? { kind: "end", keys: t, gesture: e.gesture } : { kind: "begin", keys: t, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
    }
    if (Te(e.key)) {
      if (e.kind === "retry")
        return oe(e.expectedVersion, !1) && (e.expectedGeneration === null || oe(e.expectedGeneration, !1)) && (e.expectedPersistenceRequest === null || oe(e.expectedPersistenceRequest)) ? {
          kind: "retry",
          key: e.key,
          expectedVersion: e.expectedVersion,
          expectedGeneration: e.expectedGeneration,
          expectedPersistenceRequest: e.expectedPersistenceRequest
        } : void 0;
      if (e.kind === "recover")
        return Object.hasOwn(e, "value") && e.expectedVersion === 0 && !Object.hasOwn(e, "gesture") ? { kind: "recover", key: e.key, value: e.value, expectedVersion: 0 } : void 0;
      if (!(e.kind !== "edit" || !Object.hasOwn(e, "value")) && !(e.expectedVersion !== void 0 && !oe(e.expectedVersion, !1)) && !(e.gesture !== void 0 && !oe(e.gesture)))
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
function ks(e) {
  if (!Kn(e) || !ce(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (typeof e.kind == "string" && !vs.has(e.kind)) return { kind: "unknown", messageKind: e.kind };
  if (e.kind === "open-failed" && oe(e.request) && Te(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && Te(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = dr(e.scope);
  if (e.kind === "opened" && t && oe(e.request)) {
    const n = Wr(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = Wr(e.native);
    if (n && (e.changedStoredKey === void 0 || Te(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && Te(e.endpoint) && typeof e.value == "number" && oe(e.intent, !1) && oe(e.observation, !1) && (e.origin === "owner" || e.origin === "external"))
    return { kind: "ok", value: {
      kind: "parameter",
      scope: t,
      endpoint: e.endpoint,
      value: e.value,
      intent: e.intent,
      origin: e.origin,
      observation: e.observation
    } };
  if (e.kind === "detach" && t && oe(e.client) && oe(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && oe(e.request) && oe(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = Is(e.address);
    if (n) {
      const r = Ss(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && oe(e.request) && ce(e.result)) {
    const n = [];
    if (e.observations !== void 0) {
      if (!Array.isArray(e.observations)) return { kind: "invalid", message: "Invalid publication observation barrier." };
      const r = /* @__PURE__ */ new Set();
      for (const i of e.observations) {
        if (!ce(i) || !Te(i.endpoint) || !oe(i.observation, !1) || r.has(i.endpoint))
          return { kind: "invalid", message: "Invalid publication observation barrier." };
        r.add(i.endpoint), n.push({ endpoint: i.endpoint, observation: i.observation });
      }
    }
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && Te(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason },
      ...e.observations === void 0 ? {} : { observations: n }
    } };
  }
  return { kind: "invalid", message: `Malformed "${String(e.kind)}" state-channel message.` };
}
function Gr(e, t, n) {
  const r = n?.scope && t.scope && n.scope.owner === t.scope.owner && n.scope.document === t.scope.document, i = Object.fromEntries(Object.entries(e).map(([o, a]) => {
    const s = t.fields[o];
    if (!s || !("value" in s)) return [o, s];
    const c = r ? n.fields[o] : void 0;
    if (c && "value" in c && c.version === s.version && Object.is(c.value, s.value)) {
      const { value: m, ...d } = s;
      return [o, { ...d, valueUnchanged: !0 }];
    }
    return [o, { ...s, value: a.kind === "stored" ? a.codec.encode(s.value) : s.value }];
  }));
  return { ...t, fields: i };
}
function Jr(e) {
  const t = li(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
    if (t.node(a)) {
      if (o === null || typeof o == "boolean") return o;
      if (typeof o == "number") return Number.isFinite(o) ? o : void 0;
      if (typeof o == "string") return t.text(o) ? o : void 0;
      if (!(typeof o != "object" || n.has(o))) {
        n.add(o);
        try {
          if (Array.isArray(o) || o instanceof Float32Array || o instanceof Float64Array || o instanceof Int8Array || o instanceof Int16Array || o instanceof Int32Array || o instanceof Uint8Array || o instanceof Uint8ClampedArray || o instanceof Uint16Array || o instanceof Uint32Array) {
            if (!t.elements(o.length)) return;
            const c = [];
            for (const m of o) {
              const d = r(m, a + 1);
              if (d === void 0) return;
              c.push(d);
            }
            return c;
          }
          if (!ce(o)) return;
          const s = /* @__PURE__ */ Object.create(null);
          for (const c in o) {
            if (!Object.hasOwn(o, c)) continue;
            if (!t.text(c)) return;
            const m = r(o[c], a + 1);
            if (m === void 0) return;
            s[c] = m;
          }
          return s;
        } finally {
          n.delete(o);
        }
      }
    }
  }, i = r(e, 0);
  return i !== void 0 ? { kind: "ok", value: i } : { kind: "invalid", message: "Prepared event payload does not satisfy the native JSON contract." };
}
const As = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Ts(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !As.has(e);
}
function Bt(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function Es(e) {
  return `The codec for "${e}" threw instead of returning { kind: "error" }; the edit was rejected.`;
}
const di = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), ui = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function L(e, t = {}) {
  return Object.freeze({ kind: "parameter", endpoint: e, ...t });
}
function Je(e) {
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
function Yr(e) {
  const t = Je({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history, preset: e.preset }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const o = e.engine, a = e.prepare, s = e.prepare, c = o.length;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (m, d) => ({
        length: c,
        write: (h) => a(m, h, d)
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
const fi = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Os(e) {
  return e[fi] ?? {};
}
function mi(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function kt(e) {
  return e.kind === "stored" && (e.lifetime ?? "project") === "project";
}
function xs(e) {
  return Object.keys(e).filter((t) => e[t]?.preset !== !1);
}
function Rs(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = mi(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !Ts(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(e)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(e)) o.kind === "stored" && o[di]?.(e);
  const i = { ...e };
  for (const [o, a] of Object.entries(e)) {
    const s = a.kind === "stored" ? a[ui] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(e) }));
  }
  return Object.freeze(Object.defineProperty(i, fi, { value: Object.freeze({ ...t }) }));
}
const xe = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function Qr(e, t = {}) {
  const n = /* @__PURE__ */ new Map();
  let r = !1;
  function i(o) {
    if (!ce(o) || typeof o.id != "number" || !ce(o.scope)) return;
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
      } else o.kind === "failed" && a.finish(o.reason === "cancelled" || o.reason === "superseded" || o.reason === "stale-scope" ? { kind: "cancelled" } : xe("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", i), {
    async prepare(o, a, s, c) {
      if (r || s.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(o.byteLength) || o.byteLength <= 0 || o.byteLength % 4 !== 0 || o.byteLength > 2147483647)
        return xe("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const m = e.sharedData;
      if (!m) return xe("This host does not support shared-data preparation.");
      let d;
      try {
        d = m.reserve(o.input, o.byteLength);
      } catch {
        return xe("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let h = !1;
      try {
        if (d.byteLength !== o.byteLength) return xe("The host supplied a differently sized shared allocation.");
        const f = c(d);
        if (f?.kind === "failed") return f;
        if (Bt(f)) return { kind: "failed", error: f.error };
        if (s.aborted || r) return { kind: "cancelled" };
        const g = new Promise((b) => {
          let I = () => {
          }, y;
          const A = (F) => {
            if (n.delete(d.id)) {
              if (clearTimeout(y), I(), F.kind !== "acknowledged")
                try {
                  m.cancel(d.id);
                } catch {
                  F = xe("Cancellation of the shared resource could not be confirmed.");
                }
              b(F);
            }
          };
          n.set(d.id, { input: o.input, target: a, submitted: null, early: null, finish: A }), I = s.onAbort(() => A({ kind: "cancelled" })), n.has(d.id) && (y = setTimeout(() => A(xe("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(d.id)) return g;
        try {
          const b = await Promise.race([
            Promise.resolve(m.commit(d.id)).then((A) => ({ kind: "submitted", receipt: A })),
            g.then((A) => ({ kind: "finished", outcome: A }))
          ]);
          if (b.kind === "finished") return b.outcome;
          const I = b.receipt;
          h = !0;
          const y = n.get(d.id);
          y && (!ce(I) || I.kind !== "submitted" || I.id !== d.id || I.input !== o.input || I.generation !== d.id || typeof I.serial != "number" || !Number.isSafeInteger(I.serial) || I.serial <= 0 ? y.finish(xe("The host returned an invalid shared-resource submission receipt.")) : (y.submitted = { generation: I.generation, serial: I.serial }, y.early && i(y.early)));
        } catch {
          n.get(d.id)?.finish(s.aborted ? { kind: "cancelled" } : xe("The shared resource could not be submitted."));
        }
        return g;
      } finally {
        if (!h)
          try {
            m.cancel(d.id);
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
class ur {
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
    const r = new ur({ limit: this.#o, compare: this.#d });
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
function Ke(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function Ft(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function Xr(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function De(e, t, n = 0, r, i, o, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
class pi extends Error {
  constructor(t, n) {
    super(Es(t), { cause: n });
  }
}
function yt(e, t) {
  try {
    return t();
  } catch (n) {
    throw new pi(e, n);
  }
}
function ws(e, t) {
  const n = ys(), r = {};
  for (const u of Object.keys(e)) r[u] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = $r({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new ur({ limit: t.historyLimit, compare: (u, l) => u.order - l.order }),
    gestures: [],
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map(),
    parameterIntents: /* @__PURE__ */ new Map(),
    parameterAppliedIntents: /* @__PURE__ */ new Map(),
    parameterObservations: /* @__PURE__ */ new Map()
  }), o = $r((u) => u(i).snapshot);
  let a = !1, s, c = 0, m = !1, d, h = [];
  const f = [], g = () => n.get(o), b = (u) => e[u]?.history !== !1, I = (u) => u.gestures.some((l) => l.keys.some(b)), y = (u, l) => u.gestures.find((p) => p.keys.includes(l)), A = (u, l, p) => p ? u.gestures.map((S) => S === l ? p : S) : u.gestures.filter((S) => S !== l), F = (u, l) => {
    const p = l.keys.filter(b).flatMap((S) => {
      const v = l.before.get(S), k = l.after.get(S);
      return N(S, v, k) ? [] : [{ key: S, before: v, after: k }];
    });
    return p.length ? u.record({ changes: p, order: l.order }) : u;
  }, _ = (u, l, p, S) => p === void 0 || p === S || u !== void 0 && p >= (u.guardFloorVersions.get(l) ?? S) && p <= S, M = (u, l, p = u.history) => {
    const S = p.undoEntry, v = p.redoEntry;
    return {
      ...u,
      history: p,
      snapshot: Object.freeze({
        ...u.snapshot,
        revision: u.snapshot.revision + 1,
        fields: Object.freeze(l),
        history: Object.freeze({
          canUndo: !a && !I(u) && S !== void 0 && S.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          canRedo: !a && !I(u) && v !== void 0 && v.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          ...u.snapshot.scope && S ? { undoEntry: Ft(u.snapshot.scope, S) } : {},
          ...u.snapshot.scope && v ? { redoEntry: Ft(u.snapshot.scope, v) } : {}
        })
      })
    };
  }, D = (u, l, p) => {
    if (l === p) return !1;
    const S = l && "value" in l ? l : void 0, v = p && "value" in p ? p : void 0;
    return S && v ? !Object.is(S.value, v.value) && !N(u, S.value, v.value) : S !== v;
  }, ee = /* @__PURE__ */ new Map(), Y = (u, l, p = "edit") => {
    const S = n.get(i);
    if (u.snapshot === S.snapshot) {
      n.set(i, u);
      return;
    }
    const v = u.snapshot.scope, k = v !== null && (!S.snapshot.scope || !Ke(v, S.snapshot.scope)), w = Object.keys(e).filter((j) => D(j, S.snapshot.fields[j], u.snapshot.fields[j])), z = w.length ? Object.freeze({ reason: k ? "load" : p, keys: Object.freeze(w), revision: u.snapshot.revision }) : u.snapshot.lastChange, V = { ...u.snapshot.fields };
    if (v) for (const j of t.bindings ?? []) {
      const $ = V[j.key];
      if (!$) continue;
      const Z = S.snapshot.fields[j.key];
      if (!(k || j.key === l || !Z || Z.readiness.kind !== $.readiness.kind || "value" in $ && (!("value" in Z) || !Object.is($.value, Z.value)) || j.dependencies.some((T) => {
        const C = S.snapshot.fields[T], K = V[T];
        return C !== K && (!C || !K || !("value" in C) || !("value" in K) || !Object.is(C.value, K.value));
      }))) {
        const T = $.application ?? Z?.application, C = Z?.target ?? $.target;
        V[j.key] = $.application === T && $.target === C ? $ : Object.freeze({ ...$, ...T ? { application: T } : {}, ...C ? { target: C } : {} });
        continue;
      }
      const q = Object.freeze({ scope: v, key: j.key, generation: k ? 0 : (Z?.target?.generation ?? -1) + 1 }), W = {};
      let x = "value" in $ && $.readiness.kind === "ready";
      for (const T of j.dependencies) {
        const C = V[T];
        e[T]?.kind !== "parameter" || !C || !("value" in C) || C.readiness.kind !== "ready" || typeof C.value != "number" ? x = !1 : W[T] = C.value;
      }
      if (V[j.key] = Object.freeze({ ...$, target: q, application: Object.freeze({ kind: x ? "pending" : "waiting-for-inputs" }) }), x && "value" in $) {
        const T = k ? "load" : j.key === l ? ee.get(j.key) ?? "edit" : p;
        ee.set(j.key, T);
        const C = Object.freeze({ value: $.value, parameters: Object.freeze(W), reason: T });
        h.push(() => j.replace(C, q));
      } else h.push(() => j.cancel());
    }
    n.set(i, { ...u, snapshot: Object.freeze({ ...u.snapshot, fields: Object.freeze(V), ...z ? { lastChange: z } : {} }) });
  }, pe = (u, l, p, S) => {
    if (!u.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
    const v = { ...u.snapshot.fields }, k = new Map(u.publications), w = new Map(u.parameterIntents), z = [];
    for (const { key: P, value: q } of l) {
      const W = e[P], x = v[P];
      if (!W || !x) return { kind: "rejected", reason: "not-ready" };
      const T = "value" in x ? x : void 0;
      if (!T && S !== "recover") return { kind: "rejected", reason: "not-ready" };
      if (S === "history" && x.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      let C;
      if (W.kind === "parameter") {
        if (typeof q != "number") return { kind: "rejected", reason: "invalid-value" };
        C = y(u, P) ? [{ kind: "parameter", endpoint: W.endpoint, value: q }] : [
          { kind: "gesture-start", endpoint: W.endpoint },
          { kind: "parameter", endpoint: W.endpoint, value: q },
          { kind: "gesture-end", endpoint: W.endpoint }
        ];
      } else C = kt(W) ? [{ kind: "stored", key: P, value: yt(P, () => W.codec.encode(q)) }] : [];
      const K = (T?.version ?? 0) + 1;
      if (C.length) {
        const Q = ++c;
        k.set(Q, { key: P, version: K }), W.kind === "parameter" && w.set(P, Q), z.push({ request: Q, scope: u.snapshot.scope, operations: C });
      }
      v[P] = De(q, { kind: W.kind === "parameter" ? "host-managed" : kt(W) ? "pending" : "not-written" }, K, T?.metadata, T?.gesture, W.kind === "parameter" ? { kind: "pending" } : void 0);
    }
    const V = M(u, v, p), j = l[0], $ = l.length === 1 && j ? v[j.key] : void 0, Z = {
      kind: "accepted",
      revision: V.snapshot.revision,
      ...$ && "version" in $ ? { version: $.version } : {},
      ...S !== "history" ? { changed: !0 } : {},
      ...(S === "edit" || S === "recall") && p.undoEntry && p.undoEntry !== u.history.undoEntry ? { historyEntry: Ft(u.snapshot.scope, p.undoEntry) } : {}
    };
    d = Z, Y({ ...V, publications: k, parameterIntents: w }, void 0, S === "recover" ? "edit" : S);
    for (const P of z)
      a || t.native.publish(P);
    return Z;
  }, te = (u, l, p, S, v) => pe(u, [{ key: l, value: p }], S, v), ge = (u, l, p) => {
    const S = e[l];
    if (!S) return { kind: "error" };
    if (S.kind === "stored") return yt(l, () => S.codec.parse(p));
    const v = u.parameters.get(l);
    if (!v || typeof p != "number" || !Number.isFinite(p)) return { kind: "error" };
    const k = Math.min(v.max, Math.max(v.min, p));
    return { kind: "ok", value: v.step > 0 ? Math.min(v.max, Math.max(v.min, v.min + Math.round((k - v.min) / v.step) * v.step)) : k };
  };
  function N(u, l, p) {
    const S = e[u];
    return S?.kind === "stored" ? yt(u, () => S.codec.equals(l, p)) : Object.is(l, p);
  }
  const R = (u) => {
    const l = n.get(i);
    if (u.kind === "opened" || u.kind === "replaced") {
      if (l.snapshot.scope && (u.kind === "opened" || u.scope.owner !== l.snapshot.scope.owner || u.scope.document <= l.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const p = {}, S = /* @__PURE__ */ new Map();
      for (const [k, w] of Object.entries(e))
        if (w.kind === "parameter") {
          const z = u.native.parameters.find((V) => V.endpoint === w.endpoint);
          if (z && Xr(z)) {
            S.set(k, Object.freeze({ ...z }));
            const { min: V, max: j, step: $, defaultValue: Z } = z;
            p[k] = De(z.value, { kind: "host-managed" }, 0, Object.freeze({ min: V, max: j, step: $, defaultValue: Z }), void 0, { kind: "unconfirmed" });
          } else p[k] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: z ? "invalid-state" : "missing-parameter" }) });
        } else {
          const z = l.snapshot.fields[k];
          if (!kt(w) && u.kind === "replaced" && z && "value" in z) {
            p[k] = De(z.value, { kind: "not-written" }, z.version);
            continue;
          }
          const V = kt(w) && Object.hasOwn(u.native.values, k), j = V ? w.codec.parse(u.native.values[k]) : w.initial;
          if (j.kind === "ok") p[k] = De(j.value, { kind: V ? "observed-in-native-state" : "not-written" });
          else {
            const $ = l.snapshot.fields[k], Z = u.kind === "replaced" && u.changedStoredKey !== void 0 && $ && "value" in $;
            p[k] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...Z ? { value: $.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const v = M(l, p, l.history.clear());
      Y({ ...v, gestures: [], detached: /* @__PURE__ */ new Set(), publications: /* @__PURE__ */ new Map(), parameterIntents: /* @__PURE__ */ new Map(), parameterAppliedIntents: /* @__PURE__ */ new Map(), parameterObservations: /* @__PURE__ */ new Map(), editOrder: 0, parameters: S, snapshot: Object.freeze({ ...v.snapshot, scope: Object.freeze({ ...u.scope }) }) });
    } else if (u.kind === "command") {
      if (!l.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!Ke(u.address, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(u.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (u.command.kind === "undo" || u.command.kind === "redo") {
        if (I(l)) return { kind: "rejected", reason: "busy" };
        const P = u.command.kind === "undo", q = P ? l.history.undoEntry : l.history.redoEntry, W = u.command.expectedEntry;
        return W && (!q || !Ke(W.scope, l.snapshot.scope) || W.id !== q.order) ? { kind: "rejected", reason: "stale-history" } : q ? pe(
          l,
          q.changes.map((x) => ({ key: x.key, value: P ? x.before : x.after })),
          P ? l.history.undo() : l.history.redo(),
          "history"
        ) : { kind: "accepted", revision: l.snapshot.revision };
      }
      if (u.command.kind === "edit-many") {
        const P = [], q = /* @__PURE__ */ new Set(), { client: W } = u.address, x = u.command.gesture;
        if (!Array.isArray(u.command.edits) || u.command.edits.length === 0 || x !== void 0 && (u.command.history === !1 || u.command.recall)) return { kind: "rejected", reason: "invalid-command" };
        const T = x === void 0 ? void 0 : l.gestures.find((B) => B.client === W && B.gesture === x);
        if (x !== void 0 && !T) return { kind: "rejected", reason: "invalid-command" };
        for (const { key: B, value: ae, expectedVersion: de } of u.command.edits) {
          if (!Object.hasOwn(e, B) || q.has(B)) return { kind: "rejected", reason: "invalid-command" };
          q.add(B);
          const ye = l.snapshot.fields[B];
          if (!ye || !("value" in ye) || ye.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          const be = y(l, B);
          if (be && be !== T) return { kind: "rejected", reason: be.client === W ? "invalid-command" : "busy" };
          if (T && !be) return { kind: "rejected", reason: "invalid-command" };
          if (!_(be, B, de, ye.version)) return { kind: "rejected", reason: "stale-version" };
          const ke = ge(l, B, ae);
          if (ke.kind === "error") return { kind: "rejected", reason: "invalid-value" };
          N(B, ye.value, ke.value) || P.push({ key: B, before: ye.value, after: ke.value });
        }
        if (!P.length) return { kind: "accepted", revision: l.snapshot.revision, changed: !1 };
        const C = l.editOrder + 1, K = P.map(({ key: B, after: ae }) => ({ key: B, value: ae }));
        if (T) {
          const B = new Map(T.after);
          for (const { key: de, value: ye } of K) B.set(de, ye);
          const ae = A(l, T, { ...T, after: B, order: C });
          return pe(
            { ...l, gestures: ae, editOrder: C },
            K,
            P.some(({ key: de }) => b(de)) ? l.history.clearRedo() : l.history,
            "edit"
          );
        }
        const Q = u.command.history === !1 ? [] : P.filter(({ key: B }) => b(B));
        return pe({ ...l, editOrder: C }, K, Q.length ? l.history.record({ changes: Q, order: C }) : l.history, u.command.recall ? "recall" : "edit");
      }
      if (u.command.kind === "begin" || u.command.kind === "end") {
        const { keys: P, gesture: q } = u.command, { client: W } = u.address;
        if (!Array.isArray(P) || P.length === 0 || new Set(P).size !== P.length || !P.every((ue) => Object.hasOwn(e, ue))) return { kind: "rejected", reason: "invalid-command" };
        if (!Number.isSafeInteger(q) || q <= 0) return { kind: "rejected", reason: "invalid-command" };
        const x = {};
        for (const ue of P) {
          const ne = l.snapshot.fields[ue];
          if (!ne || !("value" in ne) || ne.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          x[ue] = ne;
        }
        for (const ue of P) {
          const ne = y(l, ue);
          if (ne && ne.client !== W) return { kind: "rejected", reason: "busy" };
          if (ne && ne.gesture !== q) return { kind: "rejected", reason: "invalid-command" };
        }
        const T = l.gestures.find((ue) => ue.client === W && ue.gesture === q);
        if (T && (T.keys.length !== P.length || !P.every((ue) => T.keys.includes(ue))))
          return { kind: "rejected", reason: "invalid-command" };
        const C = u.command.kind === "begin", K = P.length === 1 && P[0] !== void 0 ? x[P[0]] : void 0, Q = K ? { version: K.version } : {};
        if (C === !!T) return { kind: "accepted", revision: l.snapshot.revision, ...Q };
        let B, ae = l.history, de, ye;
        if (T)
          B = A(l, T), ae = F(ae, T), ae !== l.history && ae.undoEntry && (de = Ft(l.snapshot.scope, T));
        else {
          ye = Object.freeze({ client: W, gesture: q });
          const ue = new Map(P.map((ne) => [ne, x[ne]?.value]));
          B = [...l.gestures, {
            ...ye,
            keys: Object.freeze([...P]),
            before: ue,
            after: ue,
            guardFloorVersions: new Map(P.map((ne) => [ne, x[ne]?.version ?? 0])),
            order: 0
          }];
        }
        const be = { ...l.snapshot.fields };
        for (const [ue, ne] of Object.entries(x))
          be[ue] = De(ne.value, ne.persistence, ne.version, ne.metadata, ye, ne.application, ne.persistenceRequest);
        const ke = M({ ...l, gestures: B }, be, ae), gt = {
          kind: "accepted",
          revision: ke.snapshot.revision,
          ...Q,
          ...de ? { historyEntry: de } : {}
        };
        if (d = gt, Y({ ...ke, gestures: B }), a) return gt;
        const Nr = P.flatMap((ue) => {
          const ne = e[ue];
          return ne?.kind === "parameter" ? [{ kind: C ? "gesture-start" : "gesture-end", endpoint: ne.endpoint }] : [];
        });
        return Nr.length && t.native.publish({ request: ++c, scope: l.snapshot.scope, operations: Nr }), gt;
      }
      const { key: p } = u.command;
      if (!Object.hasOwn(e, p)) return { kind: "rejected", reason: "invalid-command" };
      const S = e[p], v = l.snapshot.fields[p];
      if (!S || !v) return { kind: "rejected", reason: "invalid-command" };
      if (u.command.kind === "retry") {
        if (!("value" in v) || v.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (u.command.expectedVersion !== v.version || u.command.expectedGeneration !== (v.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const P = v.persistence.kind === "failed" && v.persistenceRequest !== void 0;
        if (u.command.expectedPersistenceRequest !== (P ? v.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (P) {
          const x = S.kind === "parameter" ? [{ kind: "parameter", endpoint: S.endpoint, value: Number(v.value) }] : [{ kind: "stored", key: p, value: yt(p, () => S.codec.encode(v.value)) }], T = ++c, C = new Map(l.publications).set(T, { key: p, version: v.version }), K = M(l, { ...l.snapshot.fields, [p]: Object.freeze({
            ...v,
            persistence: Object.freeze({ kind: "pending" }),
            ...S.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), Q = { kind: "accepted", revision: K.snapshot.revision, version: v.version, changed: !1 };
          return d = Q, Y({ ...K, publications: C, parameterIntents: S.kind === "parameter" ? new Map(l.parameterIntents).set(p, T) : l.parameterIntents }), a || t.native.publish({ request: T, scope: l.snapshot.scope, operations: x }), Q;
        }
        if (v.application?.kind !== "failed" || v.application.error.kind === "defect" || !t.bindings?.some((x) => x.key === p))
          return { kind: "rejected", reason: "not-ready" };
        const q = M(l, l.snapshot.fields), W = { kind: "accepted", revision: q.snapshot.revision, version: v.version, changed: !1 };
        return d = W, Y(q, p), W;
      }
      if (u.command.kind === "recover") {
        if (u.command.expectedVersion !== 0 || Object.hasOwn(u.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (S.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in v && v.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (v.readiness.kind !== "failed" || v.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const { value: P } = u.command, q = yt(p, () => S.codec.parse(P));
        return q.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : te(l, p, q.value, l.history, "recover");
      }
      if (!("value" in v) || v.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const k = v, w = y(l, p);
      if (w && w.client !== u.address.client) return { kind: "rejected", reason: "busy" };
      const { value: z, expectedVersion: V } = u.command;
      if (u.command.gesture !== void 0 && (!w || w.gesture !== u.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (w && u.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (!_(w, p, V, k.version)) return { kind: "rejected", reason: "stale-version" };
      const j = ge(l, p, z);
      if (j.kind === "error") return { kind: "rejected", reason: "invalid-value" };
      const $ = j.value;
      if (N(p, k.value, $)) return { kind: "accepted", revision: l.snapshot.revision, version: k.version, changed: !1 };
      const Z = l.editOrder + 1;
      if (w) {
        const P = A(l, w, { ...w, after: new Map(w.after).set(p, $), order: Z });
        return te({ ...l, gestures: P, editOrder: Z }, p, $, b(p) ? l.history.clearRedo() : l.history, "edit");
      }
      return te({ ...l, editOrder: Z }, p, $, b(p) ? l.history.record({ changes: [{ key: p, before: k.value, after: $ }], order: Z }) : l.history, "edit");
    } else if (u.kind === "engine") {
      const p = l.snapshot.fields[u.target.key];
      if (!p?.target || !Ke(p.target.scope, u.target.scope) || p.target.generation !== u.target.generation) return { kind: "accepted", revision: l.snapshot.revision };
      Y(M(l, {
        ...l.snapshot.fields,
        [u.target.key]: Object.freeze({ ...p, application: Object.freeze({ ...u.status }) })
      }));
    } else if (u.kind === "detached") {
      if (!l.snapshot.scope || !Ke(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(u.client)) return { kind: "accepted", revision: l.snapshot.revision };
      const p = l.gestures.filter((z) => z.client !== u.client), S = { ...l.snapshot.fields }, v = [];
      let k = l.history;
      for (const z of l.gestures)
        if (z.client === u.client) {
          k = F(k, z);
          for (const V of z.keys) {
            const j = S[V];
            j && "value" in j && (S[V] = De(j.value, j.persistence, j.version, j.metadata, void 0, j.application, j.persistenceRequest));
            const $ = e[V];
            $?.kind === "parameter" && v.push({ kind: "gesture-end", endpoint: $.endpoint });
          }
        }
      const w = p.length === l.gestures.length ? l : M({ ...l, gestures: p }, S, k);
      return d = { kind: "accepted", revision: w.snapshot.revision }, Y({ ...w, gestures: p, detached: new Set(l.detached).add(u.client) }), !a && v.length > 0 && t.native.publish({ request: ++c, scope: l.snapshot.scope, operations: v }), d;
    } else if (u.kind === "parameter") {
      if (!l.snapshot.scope || !Ke(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const [p, S] = [...l.parameters].find(([, j]) => j.endpoint === u.endpoint) ?? [];
      if (p === void 0 || S === void 0) return { kind: "accepted", revision: l.snapshot.revision };
      if (!Xr({ ...S, value: u.value })) return { kind: "rejected", reason: "invalid-value" };
      if (!Number.isSafeInteger(u.intent) || u.intent < 0 || !Number.isSafeInteger(u.observation) || u.observation < 0 || u.origin !== "owner" && u.origin !== "external") return { kind: "rejected", reason: "invalid-command" };
      if (u.observation <= (l.parameterObservations.get(p) ?? -1)) return { kind: "accepted", revision: l.snapshot.revision };
      const v = new Map(l.parameterObservations).set(p, u.observation);
      if (u.origin === "owner" || u.intent < (l.parameterIntents.get(p) ?? 0))
        return Y({ ...l, parameterObservations: v }), { kind: "accepted", revision: l.snapshot.revision };
      const k = l.snapshot.fields[p];
      if (!k || !("value" in k)) return { kind: "accepted", revision: l.snapshot.revision };
      const w = Object.is(k.value, u.value) ? l : M(l, {
        ...l.snapshot.fields,
        [p]: De(u.value, { kind: "host-managed" }, k.version + 1, k.metadata, k.gesture, { kind: "unconfirmed" })
      }), z = y(l, p), V = z && w !== l ? A(l, z, { ...z, guardFloorVersions: new Map(z.guardFloorVersions).set(p, k.version + 1) }) : l.gestures;
      Y({ ...w, gestures: V, parameterObservations: v });
    } else {
      if (!l.snapshot.scope || !Ke(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const p = l.publications.get(u.request);
      if (p) {
        const S = new Map(l.publications);
        S.delete(u.request);
        const v = new Map(l.parameterAppliedIntents), k = new Map(l.parameterIntents), w = new Map(l.parameterObservations), z = e[p.key];
        if (z?.kind === "parameter") {
          u.result.kind === "observed" && v.set(
            p.key,
            Math.max(u.request, v.get(p.key) ?? 0)
          );
          const j = u.observations?.find((Z) => Z.endpoint === z.endpoint);
          j && w.set(
            p.key,
            Math.max(w.get(p.key) ?? -1, j.observation)
          );
          let $ = v.get(p.key) ?? 0;
          for (const [Z, P] of S) P.key === p.key && ($ = Math.max($, Z));
          (u.result.kind === "observed" || j) && k.set(p.key, $);
        }
        const V = l.snapshot.fields[p.key];
        if (V && "value" in V && V.version === p.version) {
          const j = u.result.kind === "observed" ? { kind: e[p.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: u.result.reason }, $ = e[p.key]?.kind === "parameter" ? u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: u.result.reason }) } : V.application, Z = M(l, { ...l.snapshot.fields, [p.key]: Object.freeze({
            ...De(V.value, j, V.version, V.metadata, V.gesture, $),
            ...u.result.kind === "failed" ? { persistenceRequest: u.request } : {}
          }) });
          Y({ ...Z, publications: S, parameterIntents: k, parameterAppliedIntents: v, parameterObservations: w });
        } else Y({ ...l, publications: S, parameterIntents: k, parameterAppliedIntents: v, parameterObservations: w });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, E = (u) => {
    if (a) return;
    a = !0;
    let l = () => {
    };
    s = new Promise((k) => {
      l = k;
    });
    const p = [];
    for (const k of t.bindings ?? [])
      try {
        p.push(k.stop());
      } catch (w) {
        p.push(Promise.reject(w));
      }
    Promise.allSettled(p).then((k) => {
      for (const w of k) w.status === "rejected" && t.onDefect(w.reason);
      l();
    });
    const S = n.get(i), v = {};
    for (const [k, w] of Object.entries(S.snapshot.fields)) {
      const { gesture: z, ...V } = "value" in w ? w : { ...w, gesture: void 0 };
      v[k] = Object.freeze({ ...V, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...M(S, v), gestures: [], publications: /* @__PURE__ */ new Map() });
    } catch (k) {
      t.onDefect(k);
    }
    if (u)
      try {
        t.native.update(g(), u);
      } catch (k) {
        t.onDefect(k);
      }
    t.native.close({ reason: "service-closed" });
  }, O = (u) => {
    try {
      return R(u);
    } catch (l) {
      if (!(l instanceof pi) || u.kind !== "command") throw l;
      return t.onDefect(l), { kind: "rejected", reason: "invalid-value" };
    }
  }, H = () => {
    if (!m) {
      m = !0;
      try {
        for (let u = f.shift(); u; u = f.shift()) {
          d = void 0, h = [];
          let l, p = !1;
          try {
            const S = n.get(i).snapshot;
            l = a ? { kind: "rejected", reason: "service-closed" } : O(u.event), d = l;
            for (const v of h)
              a || v();
            !a && (n.get(i).snapshot !== S || u.event.kind === "command") && (p = !0, t.native.update(g(), u.event.kind === "command" ? { address: u.event.address, result: l } : void 0));
          } catch (S) {
            l = d ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(S), E(!p && u.event.kind === "command" ? { address: u.event.address, result: l } : void 0);
          }
          u.finish(l);
        }
      } finally {
        m = !1;
      }
    }
  };
  return {
    getSnapshot: g,
    subscribe: (u) => n.sub(o, () => u(g())),
    dispatch: (u) => new Promise((l) => {
      f.push({ event: u, finish: l }), H();
    }),
    stop: () => (E(), s ?? Promise.resolve())
  };
}
const Ms = 5e3;
function Ds(e) {
  const t = /* @__PURE__ */ new Set();
  return (n) => {
    t.has(n) || (t.add(n), e(new Error(`Ignoring "${n}" state-channel messages, which this kit version does not understand.`)));
  };
}
function Ie(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function _s(e) {
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
function Cs(e, t, n) {
  let r = !1, i = !1, o, a = 0, s = 0, c, m, d, h = () => {
  }, f = () => {
  };
  const g = /* @__PURE__ */ new Map();
  let b;
  const I = (R) => {
    if (!Kn(R)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: R });
  }, y = /* @__PURE__ */ new Map(), A = [], F = Ka(t);
  function _(R) {
    try {
      return R();
    } catch (E) {
      return n.onDefect(E), { kind: "failed", error: { kind: "defect", message: "Data preparation failed unexpectedly." } };
    }
  }
  async function M(R) {
    try {
      return { kind: "ok", value: await R() };
    } catch (E) {
      return n.onDefect(E), { kind: "error", error: { kind: "defect", message: "Preparation failed unexpectedly." } };
    }
  }
  for (const { key: R, input: E } of mi(e)) {
    const O = e[R];
    if (O?.kind !== "stored" || O.engine?.kind !== "shared-prepared") continue;
    const H = O.engine, u = vn({
      async prepare(l, p) {
        const S = await M(() => H.prepare(l.value, { resources: F, parameters: l.parameters, reason: l.reason, signal: p }));
        if (S.kind === "error") return S;
        const v = S.value;
        return Bt(v) ? { kind: "error", error: v.error } : !v || !Number.isSafeInteger(v.length) || v.length <= 0 || typeof v.write != "function" ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size or writer." } } : { kind: "ok", value: { plan: v, target: l.target } };
      },
      transport: {
        apply(l, p) {
          if (p.signal.aborted || !Ie(D.getSnapshot().scope, l.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          o ??= Qr(t);
          const S = H.storage.type === "float32" ? l.plan.length * 4 : l.plan.length;
          return o.prepare({ input: E, byteLength: S }, l.target, p.signal, (v) => {
            const k = H.storage.type === "float32" ? new Float32Array(v.buffer, v.byteOffset, l.plan.length) : new Uint8Array(v.buffer, v.byteOffset, l.plan.length), w = _(() => l.plan.write(k));
            if (w) return w;
            if (k instanceof Float32Array && !k.every(Number.isFinite))
              return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
          });
        },
        stop() {
        }
      },
      onStatus(l, p) {
        D.dispatch({ kind: "engine", target: l, status: p });
      },
      onDefect(l) {
        n.onDefect(l), te();
      }
    });
    A.push({
      key: R,
      dependencies: H.dependencies,
      replace(l, p) {
        u.replace({ ...l, target: p }, p);
      },
      cancel: u.cancel,
      stop: u.stop
    });
  }
  for (const [R, E] of Object.entries(e)) {
    if (E.kind !== "stored" || E.engine?.kind !== "event-value") continue;
    const O = E.engine, H = vn({
      async prepare(u, l) {
        const p = await M(() => O.prepare(u.value, { resources: F, parameters: u.parameters, reason: u.reason, signal: l }));
        if (p.kind === "error") return p;
        const S = p.value;
        if (Bt(S)) return { kind: "error", error: S.error };
        const v = Jr(S);
        return v.kind === "ok" ? { kind: "ok", value: { target: u.target, value: v.value } } : { kind: "error", error: { kind: "engine-rejected", message: v.message } };
      },
      transport: {
        apply(u, l) {
          return new Promise((p) => {
            let S = 0, v = () => {
            };
            const k = (w) => {
              v(), y.delete(S), p(w);
            };
            v = l.signal.onAbort(() => k({ kind: "cancelled" }));
            try {
              const w = l.send(() => Ie(D.getSnapshot().scope, u.target.scope) ? (S = ++a, y.set(S, { kind: "event-value", key: R, scope: u.target.scope, finish: k }), I({
                kind: "publish",
                request: S,
                scope: u.target.scope,
                operations: [{ kind: "event", endpoint: O.endpoint, value: u.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              w.kind !== "sent" && k(w);
            } catch (w) {
              v(), y.delete(S), n.onDefect(w), te(), p({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const u of y.values()) u.key === R && u.finish({ kind: "cancelled" });
        }
      },
      onStatus(u, l) {
        D.dispatch({ kind: "engine", target: u, status: l });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: R,
      dependencies: O.dependencies,
      replace(u, l) {
        H.replace({ ...u, target: l }, l);
      },
      cancel: H.cancel,
      stop: H.stop
    });
  }
  const D = ws(e, {
    historyLimit: Os(e).historyLimit,
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(R) {
        const E = ++a;
        g.set(E, { request: R.request, scope: R.scope }), I({ kind: "publish", ...R, request: E, operations: R.operations.map((O) => O.kind === "parameter" ? { ...O, intent: R.request } : O) });
      },
      update(R, E) {
        R.scope && (I({
          kind: "update",
          scope: R.scope,
          revision: R.revision,
          state: Gr(e, R, b),
          ...E ? { receipt: E } : {}
        }), b = R);
      },
      close(R) {
        i = !0, o?.stop();
        for (const E of y.values()) E.finish({ kind: "cancelled" });
        f(new Error("State service closed before native initialization completed."));
        try {
          r && D.getSnapshot().scope && I({ kind: "close", ...R });
        } catch (E) {
          n.onDefect(E);
        }
        r && t.removeEventListener("kit_state", pe), r = !1, g.clear();
      }
    }
  }), ee = Ds(n.onDefect), Y = (R) => {
    if (i) return;
    const E = ks(R);
    if (E.kind === "unknown") {
      ee(E.messageKind);
      return;
    }
    if (E.kind === "invalid") {
      const H = new Error(E.message);
      n.onDefect(H), f(H), te();
      return;
    }
    const O = E.value;
    if (O.kind === "closed")
      f(new Error(`Native state service closed: ${O.reason}`)), te();
    else if (O.kind === "open-failed") {
      if (O.request !== s || D.getSnapshot().scope) return;
      f(new Error(`Native state open failed: ${O.reason}`)), te();
    } else if (O.kind === "opened") {
      if (O.request !== s || D.getSnapshot().scope) return;
      D.dispatch(O).then((H) => {
        H.kind === "accepted" ? h() : f(new Error("Native state could not initialize the service."));
      });
    } else if (O.kind === "attached-client") {
      const H = D.getSnapshot();
      if (!Ie(H.scope, O.scope)) return;
      I({
        kind: "snapshot",
        scope: O.scope,
        to: O.client,
        attachRequest: O.request,
        revision: H.revision,
        state: Gr(e, H)
      }), b = void 0;
    } else if (O.kind === "detach")
      D.dispatch({ kind: "detached", scope: O.scope, client: O.client });
    else if (O.kind === "parameter")
      Ie(D.getSnapshot().scope, O.scope) && D.dispatch(O);
    else if (O.kind === "replaced")
      D.dispatch(O).then((H) => {
        if (H.kind !== "accepted") return;
        const u = D.getSnapshot().scope;
        for (const l of y.values())
          Ie(u, l.scope) || l.finish({ kind: "cancelled" });
        for (const [l, p] of g)
          Ie(u, p.scope) || g.delete(l);
      });
    else if (O.kind === "command")
      D.dispatch(O);
    else if (O.kind === "invalid-command")
      Ie(D.getSnapshot().scope, O.address) && I({
        kind: "receipt",
        address: O.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const H = y.get(O.request);
      if (H) {
        if (!Ie(H.scope, O.scope) || !Ie(D.getSnapshot().scope, O.scope)) return;
        if (H.kind === "custom" && O.result.kind === "failed" && (O.result.reason === "stale-scope" || O.result.reason === "closed")) {
          H.finish({ kind: "cancelled" });
          return;
        }
        H.finish(O.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: O.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: O.result.reason } });
        return;
      }
      const u = g.get(O.request);
      if (!u || !Ie(u.scope, O.scope) || !Ie(D.getSnapshot().scope, O.scope)) return;
      g.delete(O.request), D.dispatch({ ...O, request: u.request });
    }
  }, pe = (R) => {
    if (!i)
      try {
        Y(R);
      } catch (E) {
        n.onDefect(E), f(E), te();
      }
  }, te = () => d || (i = !0, f(new Error("State service stopped before native initialization completed.")), d = D.stop(), d);
  function ge(R) {
    n.onDefect(R), te();
  }
  function N({ key: R, declaration: E }) {
    const O = E.delivery;
    let H, u = !1;
    const l = /* @__PURE__ */ new Set();
    function p() {
      const v = H;
      if (H = void 0, !v) return;
      const k = v.close();
      l.add(k), k.then(() => l.delete(k), (w) => {
        l.delete(k), ge(w);
      });
    }
    function S(v) {
      const k = Object.freeze({ ...v.scope }), w = St(), z = w.signal;
      let V = v;
      function j(x, T) {
        if (x.signal.aborted || i || !Ie(D.getSnapshot().scope, k)) return { kind: "cancelled" };
        if (!T || typeof T != "object" || T.kind !== "event" && T.kind !== "host-effect")
          return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
        if (!(T.kind === "event" ? O.eventEndpoints.includes(T.endpoint) : O.hostEffects?.includes(T.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
        const K = Jr(T.value);
        if (K.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: K.message } };
        const Q = T.kind === "event" ? { kind: "event", endpoint: T.endpoint, value: K.value } : { kind: "host-effect", name: T.name, value: K.value }, B = { kind: "publish", request: a + 1, scope: k, operations: [Q] };
        if (!Kn(B)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
        const ae = ++a;
        let de = (be) => {
        };
        const ye = new Promise((be) => {
          let ke = () => {
          };
          de = (gt) => {
            y.delete(ae) && (ke(), be(gt));
          }, y.set(ae, { kind: "custom", key: R, scope: k, finish: de }), ke = x.signal.onAbort(() => de({ kind: "cancelled" }));
        });
        try {
          t.sendMessageToServer({ type: "kit_state", message: B });
        } catch (be) {
          const ke = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
          return de(ke), n.onDefect(be), ke;
        }
        return { kind: "submitted", completion: ye };
      }
      function $(x, T, C) {
        if (!O.outputEndpoints?.includes(T)) throw new Error("Undeclared engine output endpoint.");
        if (x.signal.aborted) return () => {
        };
        let K = !0, Q = () => {
        };
        const B = (de) => {
          if (!(!K || x.signal.aborted))
            try {
              C(de);
            } catch (ye) {
              ge(ye);
            }
        }, ae = () => {
          K && (K = !1, Q(), t.removeEndpointListener?.(T, B));
        };
        return Q = x.signal.onAbort(ae), t.addEndpointListener?.(T, B), ae;
      }
      const Z = F, P = {
        signal: z,
        send: (x) => j(w, x),
        listen: (x, T) => $(w, x, T),
        readStored(x) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          return z.aborted ? Promise.resolve(void 0) : new Promise((T) => {
            const C = z.onAbort(() => T(void 0));
            t.requestFullStoredState?.((K) => {
              C();
              const Q = ce(K) && ce(K.values) ? K.values : K;
              T(!z.aborted && ce(Q) ? Q[x] : void 0);
            });
          });
        },
        subscribeStored(x, T) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          if (z.aborted) return () => {
          };
          let C = !0, K = () => {
          };
          const Q = (ae) => {
            if (!(!C || z.aborted || !ce(ae) || ae.key !== x))
              try {
                T(ae.value);
              } catch (de) {
                ge(de);
              }
          }, B = () => {
            C && (C = !1, K(), t.removeStoredStateValueListener?.(Q));
          };
          return K = z.onAbort(B), t.addStoredStateValueListener?.(Q), B;
        },
        async prepareData(x, T, C, K) {
          if (!O.dataInputs?.includes(x)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
          const Q = K ? St(z, K) : St(z);
          try {
            return o ??= Qr(t), await o.prepare({ input: x, byteLength: T }, { ...V, scope: k }, Q.signal, (B) => _(() => C(B)));
          } finally {
            Q.cancel();
          }
        },
        report(x) {
          z.aborted || D.dispatch({ kind: "engine", target: V, status: x });
        },
        fail(x) {
          z.aborted || ge(x);
        }
      };
      let q;
      try {
        q = O.create(P);
      } catch (x) {
        throw w.cancel(), x;
      }
      const W = vn({
        replacement: O.replacement,
        async prepare(x, T) {
          const C = await M(() => E.prepare(x.value, { resources: Z, parameters: x.parameters, reason: x.reason, signal: T }));
          if (C.kind === "error") return C;
          const K = C.value;
          return Bt(K) ? { kind: "error", error: K.error } : { kind: "ok", value: { value: K, target: x.target } };
        },
        transport: {
          async apply(x, T) {
            V = x.target;
            const C = St(z, T.signal);
            try {
              return await q.apply(x.value, {
                signal: C.signal,
                send: (K) => j(C, K),
                listen: (K, Q) => $(C, K, Q)
              });
            } finally {
              C.cancel();
            }
          },
          stop() {
            return q.stop();
          }
        },
        onStatus(x, T) {
          D.dispatch({ kind: "engine", target: x, status: T });
        },
        onDefect: ge
      });
      return { scope: k, binding: W, close() {
        return w.cancel(), W.stop();
      } };
    }
    return {
      key: R,
      dependencies: E.dependencies,
      replace(v, k) {
        if (!u) {
          if ((!H || !Ie(H.scope, k.scope)) && (p(), H = S(k)), u) {
            p();
            return;
          }
          H.binding.replace({ ...v, target: k }, k);
        }
      },
      cancel: p,
      async stop() {
        u = !0, p(), await Promise.all(l);
      }
    };
  }
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (c) return c;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return te(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      c = new Promise((R, E) => {
        h = () => {
          clearTimeout(m), R();
        }, f = (O) => {
          clearTimeout(m), E(O);
        };
      });
      try {
        const R = _s(e);
        if (R.some(({ declaration: E }) => E.delivery.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (R.some(({ declaration: E }) => E.delivery.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const E of R) A.push(N(E));
        r = !0, t.addEventListener("kit_state", pe), s = ++a, m = setTimeout(() => {
          f(new Error("Cmajor state-channel is unavailable: native open timed out.")), te();
        }, Ms), I({
          kind: "open",
          request: s,
          parameters: Object.values(e).filter((E) => E.kind === "parameter").map((E) => E.endpoint),
          storedKeys: Object.entries(e).filter(([, E]) => kt(E)).map(([E]) => E),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((E) => E.kind === "stored" && E.engine?.kind === "event-value" ? [E.engine.endpoint] : []),
            ...R.flatMap((E) => E.declaration.delivery.eventEndpoints)
          ])],
          ...R.some((E) => E.declaration.delivery.hostEffects?.length) ? {
            hostEffects: [...new Set(R.flatMap((E) => E.declaration.delivery.hostEffects ?? []))]
          } : {}
        });
      } catch (R) {
        n.onDefect(R), f(R), te();
      }
      return c;
    },
    /** Release this owner and its channel resources. */
    stop: te
  };
}
const hi = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), $n = Reflect.get(globalThis, hi), Zr = $n instanceof WeakMap ? $n : /* @__PURE__ */ new WeakMap();
$n !== Zr && Object.defineProperty(globalThis, hi, { value: Zr });
const ut = (e) => ({ kind: "ok", value: e }), Ot = (e) => ({ kind: "error", message: e }), Ye = (e) => typeof e == "object" && e !== null && !Array.isArray(e);
function Qt(e) {
  if (e === null || typeof e == "boolean" || typeof e == "string") return e;
  if (typeof e == "number") return Number.isFinite(e) ? e : void 0;
  if (Array.isArray(e)) {
    const r = [];
    for (const i of e) {
      const o = Qt(i);
      if (o === void 0) return;
      r.push(o);
    }
    return Object.freeze(r);
  }
  if (!Ye(e)) return;
  const t = Object.getPrototypeOf(e);
  if (t !== Object.prototype && t !== null) return;
  const n = {};
  for (const [r, i] of Object.entries(e)) {
    const o = Qt(i);
    if (o === void 0) return;
    n[r] = o;
  }
  return Object.freeze(n);
}
function xt(e, t) {
  if (Object.is(e, t)) return !0;
  if (Array.isArray(e) || Array.isArray(t))
    return Array.isArray(e) && Array.isArray(t) && e.length === t.length && e.every((o, a) => xt(o, t[a]));
  if (!Ye(e) || !Ye(t)) return !1;
  const n = e, r = t, i = Object.keys(n);
  return i.length === Object.keys(r).length && i.every((o) => Object.hasOwn(r, o) && xt(n[o], r[o]));
}
function Ls(e) {
  const t = Ye(e) ? Qt(e) : void 0;
  return t !== void 0 && Ye(t) ? ut(t) : Ot("Preset values must be an object of JSON values.");
}
function gi(e) {
  if (!Ye(e) || typeof e.id != "string" || e.id.length === 0 || typeof e.name != "string" || e.name.trim().length === 0)
    return Ot("A preset needs a non-empty id and name.");
  const t = Ls(e.values);
  return t.kind === "ok" ? ut(Object.freeze({ id: e.id, name: e.name, values: t.value })) : t;
}
const Ns = {
  parse(e) {
    if (!Ye(e) || e.version !== 1 || !Array.isArray(e.presets)) return Ot("Expected a version 1 preset library.");
    const t = [];
    for (const n of e.presets) {
      const r = gi(n);
      if (r.kind === "error") return r;
      if (t.some((i) => i.id === r.value.id)) return Ot(`Preset id "${r.value.id}" appears twice.`);
      t.push(r.value);
    }
    return ut(Object.freeze({ version: 1, presets: Object.freeze(t) }));
  },
  encode: (e) => e,
  equals: (e, t) => xt(e, t)
}, eo = {
  parse: (e) => e === null ? ut(null) : gi(e),
  encode: (e) => e,
  equals: (e, t) => xt(e, t)
};
function yi(e, t) {
  if (e.kind === "parameter")
    return typeof t == "number" && Number.isFinite(t) ? ut(t) : Ot("Expected a finite number.");
  const n = e.codec.parse(t);
  return n.kind === "ok" ? ut(e.codec.encode(n.value)) : n;
}
function Ps(e, t, n) {
  if (t !== void 0 && !e.some((o) => o.id === t))
    throw new Error(`The initial preset "${t}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = xs(n), i = /* @__PURE__ */ new Set();
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
      const c = yi(s, o.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function Fs(e = {}) {
  const t = Object.freeze((e.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = e, r = Object.freeze({
    ...Je({ codec: Ns, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: t,
    [di]: (a) => Ps(t, n, a)
  }), i = Je({ codec: eo, initial: null, preset: !1 }), o = t.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [ui]: (a) => eo.parse({ id: o.id, name: o.name, values: js(a, o) })
    })
  };
}
const to = /* @__PURE__ */ new WeakMap();
function js(e, t) {
  let n = to.get(t);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(t.values)) {
      const a = e[i], s = a && yi(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), to.set(t, n);
  }
  return n;
}
const zs = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function Us(e) {
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
        const o = typeof i == "object" ? Qt(Reflect.get(i, "values")) : void 0;
        if (typeof o != "object" || o === null || Array.isArray(o)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: o });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (t) => t,
    equals: (t, n) => xt(t, n)
  };
}
function Ks(e) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (t) => t === null || typeof t == "string" ? { kind: "ok", value: typeof t == "string" && e.includes(t) ? t : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (t) => t,
    equals: Object.is
  };
}
function $s(e = {}) {
  const t = Object.freeze([...e.slots ?? zs]);
  if (t.length === 0 || t.some((r) => typeof r != "string" || r.length === 0) || new Set(t).size !== t.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(t.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...Je({ codec: Us(t), initial: n, history: !1, preset: !1 }), slots: t }),
    activeSnapshot: Je({ codec: Ks(t), initial: null, preset: !1 })
  };
}
const Ve = 2048, Rt = Ve + 3, no = 20, vi = "MSEG 1";
function bi(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function Ii(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function wt(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Vs(e) {
  return Ii(Number.isFinite(e) ? e : 0, -no, no);
}
function Qe(e) {
  return Ii(Number.isFinite(e) ? e : 0, 0, 1);
}
function Si(e = vi) {
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
function Bs(e, t, n) {
  const r = bi(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Qe(i)), {
    x: i,
    y: Qe(Number(r.y)),
    curvePower: Vs(Number(r.curvePower))
  };
}
function fr(e = Si()) {
  const t = bi(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Bs(i, o, n.length));
  if (!wt(r[0].x, 0) || !wt(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : vi,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Hs(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function qs(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (wt(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && wt(e[o + 1].x, t); )
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
function Ws(e, t) {
  const n = Qe(Number(t)), r = qs(e, n);
  if (r.laterPointWins || wt(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Qe(Hs(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Gs(e, t) {
  return Ws(fr(e).points, t);
}
function Js(e) {
  const t = new Float32Array(Rt);
  return ki(e, t), t;
}
function ki(e, t) {
  if (t.length !== Rt) throw new Error("Invalid MSEG destination length.");
  const n = fr(e);
  for (let r = 0; r < Ve; r += 1) {
    const i = r / (Ve - 1);
    t[r + 1] = Gs(n, i);
  }
  t[0] = t[1], t[Ve + 1] = t[Ve], t[Ve + 2] = t[Ve];
}
const We = -100, Mt = 35, mr = 5, pr = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Ai(e) {
  const t = pr.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function Ae(e) {
  return Ai(e).laneEndpointID;
}
function hr(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > mr)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${Ai(e).hostStem}${t}OutputTrimDb`;
}
function gr() {
  return pr.flatMap((e) => Array.from(
    { length: mr },
    (t, n) => hr(e.deviceType, n + 1)
  ));
}
function Ys(e) {
  if (typeof e != "string")
    return null;
  for (const t of pr)
    for (let n = 1; n <= mr; n += 1)
      if (e === hr(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function Ti(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Qs(e) {
  const t = (Ti(e, We, Mt) - We) / (Mt - We);
  return t * t;
}
function Xs(e) {
  const t = Math.sqrt(Ti(e, 0, 1));
  return We + t * (Mt - We);
}
const ve = (e, t) => ({ label: e, value: t });
function _e(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const Ce = Object.freeze({
  filter: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: _e(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), U = (e, t, n, r, i, o, a, s = {}) => ({
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
function Le(e, t, n) {
  return U(
    e,
    t,
    "Output Trim",
    "Trim",
    We,
    Mt,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const Zs = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ec = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], tc = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: Ce.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      U("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(ve), quick: !0 }),
      U("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      U("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      U("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      Le("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: Ce.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      U("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [ve("Classic", 0), ve("Harmonics", 1)] }),
      U("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      U("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      U("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      U("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      U("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      U("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [ve("Symmetric", 0), ve("Asymmetric", 1), ve("Wavefold", 2)] }),
      Le("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: Ce.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      U("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      U("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      U("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      U("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      U("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      Le("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: Ce.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      U("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(ve) }),
      U("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(ve) }),
      U("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      U("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      U("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      U("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      U("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      Le("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: Ce.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      U("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      U("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      U("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      U("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      U("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      Le("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: Ce.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      U("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [ve("Free", 0), ve("Sync", 1)] }),
      U("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      U("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Zs.map(ve) }),
      U("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      U("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      U("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      U("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      U("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      Le("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: Ce.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      U("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [ve("Free", 0), ve("Sync", 1)] }),
      U("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      U("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ec.map(ve) }),
      U("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      U("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      U("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      Le("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: Ce.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      U("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      U("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      U("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      U("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      Le("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], pn = tc, Ei = Object.freeze(
  pn.flatMap((e) => e.parameters)
);
new Map(
  Ei.map((e) => [e.endpointID, e])
);
function Oi(e) {
  const t = pn.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function xi() {
  return Ei;
}
function yr(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const J = ["A", "B", "C"], vr = [
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
], nc = [
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
], tt = Object.freeze([
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
]), rc = Object.freeze([
  ...J.flatMap((e) => vr.map(
    (t) => `osc${e}.${t}`
  )),
  ...nc
]);
new Set(
  J.flatMap((e) => vr.map(
    (t) => `osc${e}.${t}`
  ))
);
const Ri = Object.freeze(
  rc.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), oc = xi().filter(
  (e) => e.modulationTargetIndex !== null
), ic = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function br(e) {
  const t = ac(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function ac(e) {
  const t = ic.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const sc = [
  ...oc.map((e) => ({
    kind: br(yr(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], wi = Object.freeze(
  sc.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), je = Object.freeze([
  ...Ri,
  ...wi
]), Ht = tt.length, Mi = Ri.length, hn = wi.length, cc = Ht * je.length, lc = new Map(tt.map((e) => [e.id, e])), Di = new Map(tt.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), pt = new Map(je.map((e) => [e.kind, e]));
function dc() {
  if (Ht !== 14 || Mi !== 59 || hn !== 47 || cc !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = tt.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = je.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (lc.size !== Ht || Di.size !== Ht || pt.size !== je.length)
    throw new Error("Modulation identities must be unique");
}
dc();
function _i(e, t) {
  const n = Di.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function Ir(e) {
  return typeof e != "string" ? null : pt.has(e) ? e : null;
}
function uc(e) {
  const t = Ir(e);
  return t !== null && pt.get(t)?.group === "voice" ? t : null;
}
function Sr(e) {
  const t = Ir(e);
  return t !== null && pt.get(t)?.group === "rack" ? t : null;
}
function Ci(e) {
  const t = pt.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function Li(e) {
  const t = pt.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function fc(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Ni = 4, mc = Ni * hn, pc = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), hc = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function nt(e) {
  if (typeof e != "string")
    return null;
  const t = hc.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = pc.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function kr(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function Pi(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function Fi(e) {
  if (e === null)
    return null;
  const t = Pi(e) - 1;
  return t > Ni ? null : t * hn + Li(kr(e));
}
const gc = 0, Be = 2;
function Vn(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function yc(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function vc(...e) {
  return { ...Si(...e), format: "cosimo.mseg.shape" };
}
function Bn(...e) {
  return { ...fr(...e), format: "cosimo.mseg.shape" };
}
function ro(e) {
  return JSON.stringify(Bn(e));
}
function oo(e, t) {
  return ro(e) === ro(t);
}
function bc(e) {
  const t = Number(e);
  return yc(
    Number.isFinite(t) ? t : 1,
    gc,
    Be
  );
}
function Hn() {
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
function Ic(e) {
  if (!e || typeof e != "object")
    return null;
  const t = Vn(e), n = Qe(Number(t.startX)), r = Qe(Number(t.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function Sc(e = Hn()) {
  const t = Vn(e), n = Vn(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: bc(Number.isFinite(r) ? r : 1)
    },
    loop: Ic(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
const bn = "modulationProgram", kc = "modulationAmount", ji = tt.filter((e) => e.group === "voice").length, zi = tt.filter((e) => e.group === "macro").length, Xt = Mi, Ac = hn, Zt = Ac + mc, He = ji * Xt, it = zi * Xt, Tc = ji * Zt, Ec = zi * Zt, $e = 512, rt = 256, Ui = He + it;
function Oc(e) {
  const t = _i(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function xc(e) {
  const t = uc(e);
  return t === null ? null : Ci(t);
}
function Ki(e) {
  const t = xc(e.targetKind), n = Sr(e.targetKind);
  let r = n === null ? void 0 : Li(n);
  if (r === void 0) {
    const a = Fi(
      nt(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = _i(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (t !== null) {
      const m = s * Xt + t;
      return {
        path: "macroVoice",
        cellIndex: m,
        sourceIndex: s,
        targetIndex: t,
        articulationCellIndex: He + m
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Zt + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const i = Oc(e);
  if (t !== null) {
    const a = i * Xt + t;
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
    cellIndex: i * Zt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function $i(e) {
  return nt(e.targetKind) !== null ? null : Ki(e).articulationCellIndex;
}
function Rc(e) {
  if (Sr(e.targetKind) !== null)
    return !1;
  const t = nt(e.targetKind);
  return t !== null && Fi(t) === null;
}
function wc(e) {
  return {
    ...Ki(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function Vi(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Rc(n))
      continue;
    const r = wc(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Mc(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function at(e) {
  return [...e.values()].filter(Mc).sort((t, n) => t.cellIndex - n.cellIndex);
}
function jt(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function In(e) {
  const t = Vi(e), n = at(t.voice), r = at(t.macroVoice), i = at(t.voiceRack), o = at(t.macroRack), a = Array.from({ length: He }, () => 0), s = Array.from({ length: He }, () => 0), c = Array.from({ length: He }, () => 0), m = Array.from({ length: He }, () => 0), d = Array.from({ length: He }, () => 0);
  jt(n, a, s, c, m);
  const h = Array.from({ length: it }, () => 0), f = Array.from({ length: it }, () => 0), g = Array.from({ length: it }, () => 0), b = Array.from({ length: it }, () => 0), I = Array.from({ length: it }, () => 0);
  if (jt(
    r,
    h,
    f,
    g,
    b
  ), i.length > $e || o.length > rt)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${$e}), ${o.length} macro-rack (max ${rt})`
    );
  const y = Array.from({ length: $e }, () => 0), A = Array.from({ length: $e }, () => 0), F = Array.from({ length: $e }, () => 0), _ = Array.from({ length: $e }, () => 0), M = Array.from({ length: $e }, () => 0), D = Array.from({ length: Tc }, () => 0);
  jt(
    i,
    y,
    A,
    F,
    _
  );
  const ee = Array.from({ length: rt }, () => 0), Y = Array.from({ length: rt }, () => 0), pe = Array.from({ length: rt }, () => 0), te = Array.from({ length: rt }, () => 0), ge = Array.from({ length: Ec }, () => 0);
  jt(
    o,
    ee,
    Y,
    pe,
    te
  );
  for (const N of t.voice.values()) d[N.cellIndex] = N.amount;
  for (const N of t.macroVoice.values()) I[N.cellIndex] = N.amount;
  for (const N of t.voiceRack.values()) D[N.cellIndex] = N.amount;
  for (const N of t.macroRack.values()) ge[N.cellIndex] = N.amount;
  for (let N = 0; N < i.length; N += 1) {
    const R = i[N];
    if (R === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    M[N] = R.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: m,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: h,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: g,
    macroVoiceRoutePolarities: b,
    macroVoiceRouteAmounts: I,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: y,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: F,
    voiceRackRoutePolarities: _,
    voiceRackRouteReducers: M,
    voiceRackRouteAmounts: D,
    macroRackRouteCount: o.length,
    macroRackRouteCells: ee,
    macroRackRouteSources: Y,
    macroRackRouteTargets: pe,
    macroRackRoutePolarities: te,
    macroRackRouteAmounts: ge
  };
}
const Dc = ["voice", "macroVoice", "voiceRack", "macroRack"], _c = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function io(e) {
  return Vi(e);
}
function Cc(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function Lc(e, t) {
  if (e === null)
    return [{ endpointID: bn, value: In(t) }];
  const n = io(e), r = io(t), i = [];
  for (const o of Dc) {
    const a = at(n[o]), s = at(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: bn, value: In(t) }];
    for (let c = 0; c < s.length; c += 1) {
      const m = a[c], d = s[c];
      if (m === void 0 || d === void 0 || !Cc(m, d))
        return [{ endpointID: bn, value: In(t) }];
      m.amount !== d.amount && i.push({
        endpointID: kc,
        value: {
          pathKind: _c[o],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return i;
}
function ht(e) {
  return { _tag: "ok", value: e };
}
function Tt(e) {
  return { _tag: "err", error: e };
}
function Nc(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Pc(e) {
  throw new Error(e ?? "Invariant violated");
}
const Fc = "globalTune", jc = "globalTuneSemitones", Ne = -24, vt = 24, ao = 0, Bi = -48, Hi = 48, qn = -48, qi = 6, Ar = 0, so = (Ar - qn) / (qi - qn), Et = Object.freeze({
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
}), ot = 241;
function zc(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Sn(e) {
  return Et.minimumHz * Math.pow(
    Et.maximumHz / Et.minimumHz,
    zc(e, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: ot }, (e, t) => {
    const n = t / (ot - 1), r = Sn(n), i = Sn(
      Math.max(0, t - 0.5) / (ot - 1)
    ), o = Sn(
      Math.min(ot - 1, t + 0.5) / (ot - 1)
    );
    return {
      centerHz: r,
      lowHz: t === 0 ? Et.minimumHz : i,
      highHz: t === ot - 1 ? Et.maximumHz : o
    };
  })
);
const Uc = "voiceEnhancerFrequency", Kc = "voiceEnhancerQ", $c = "voiceEnhancerAmount", Vc = "voiceEnhancerFrequencyOctaves", Bc = "voiceEnhancerQ", Hc = "voiceEnhancerAmount", Wi = "voice.enhancerFrequency", qc = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Uc,
    targetKind: Vc,
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
    endpointID: Kc,
    targetKind: Bc,
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
    endpointID: $c,
    targetKind: Hc,
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
function co(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Wc(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function zt(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Gc = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      zt("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      zt("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      zt("mix", "Mix", 100, 100),
      zt("drive", "Drive", 15, 0)
    ]
  }
], lo = 1e-6;
function Oe(e, t) {
  if (!Number.isFinite(e) || e < -lo || e > 1 + lo)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function en(e, t) {
  return Oe(e / 100, `${t} catalog percentage`);
}
function Ct(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function Jc(e) {
  return 20 * 1e3 ** e;
}
function Yc(e) {
  return Oe(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Qc(e) {
  return 0.1 * 200 ** e;
}
function Xc(e) {
  return Oe(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Zc(e) {
  return e;
}
function el(e) {
  return Oe(e, "filterMix endpoint conversion");
}
function lt(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function tl(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: lt("filterCutoff", Jc, Yc),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: lt("filterQ", Qc, Xc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: lt("filterMix", Zc, el),
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
function Gi(e) {
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
      return Nc(e);
  }
}
function nl(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function rl(e, t) {
  const n = Ct(e.moduleId, t.id), r = Gi(t.format), i = tl(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: en(t.defaultPercent, n),
    initialValue: en(t.initialPercent, n),
    format: r,
    modAmount: nl(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const ol = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: so * 100, defaultPercent: so * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function il(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function al(e, t) {
  const n = `osc${e}`, r = Ct(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: en(t.defaultPercent, r),
    initialValue: en(t.initialPercent, r),
    format: Gi(t.format),
    modAmount: il(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const sl = Object.freeze(
  J.flatMap((e) => ol.map((t) => al(e, t)))
), cl = Object.freeze({
  targetId: Ct("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: Oe(
    (ao - Ne) / (vt - Ne),
    "Global Tune default"
  ),
  initialValue: Oe(
    (ao - Ne) / (vt - Ne),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: vt },
  modAmount: {
    min: Bi,
    max: Hi,
    unit: "st",
    digits: 2
  },
  binding: lt(
    Fc,
    (e) => Ne + (vt - Ne) * e,
    (e) => Oe(
      (e - Ne) / (vt - Ne),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: jc
});
function ll(e) {
  const t = Ct("voice-enhancer", e.key), n = Oe(
    co(e, e.initial),
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
    binding: lt(
      e.endpointID,
      (r) => Wc(e, r),
      (r) => Oe(
        co(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const dl = Object.freeze(
  Object.values(qc).map(ll)
), ul = Object.freeze([
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
function fl(e) {
  const t = Ct(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => Oe(
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
    binding: lt(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const ml = Object.freeze(
  ul.map(fl)
), pl = Object.freeze([
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
function hl(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function kn(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? Qs(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return Oe(n, `${e.endpointID} endpoint conversion`);
}
function gl(e, t) {
  return e.valueKind === "effect-output-trim-db" ? Xs(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function yl(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function vl(e) {
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
function bl(e) {
  const t = hl(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: kn(e, e.initial),
    initialValue: kn(e, e.initial),
    format: yl(e),
    modAmount: vl(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => gl(e, n),
      fromEngine: (n) => kn(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : br(yr(e))
  });
}
const Tr = Object.freeze(
  [
    ...pn.flatMap((e) => e.parameters.map(bl)),
    ...pl,
    cl,
    ...dl,
    ...sl,
    ...ml,
    ...Gc.flatMap(
      (e) => e.parameters.map(
        (t) => rl(e, t)
      )
    )
  ]
), Il = new Map(
  Tr.map((e) => [e.targetId, e])
), Ji = Tr.filter(
  (e) => e.modulationTargetKind !== null
), Wn = new Map(
  Ji.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Il.size !== Tr.length)
  throw new Error("Target descriptor IDs must be unique");
if (Ji.length !== je.length || Wn.size !== je.length || je.some((e) => Wn.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function An(e) {
  const t = Wn.get(e);
  return t === void 0 ? Pc(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  pn.map((e) => [e.id, e.label])
);
function Sl(e) {
  const t = Pi(e);
  return t === 1 ? "" : ` ${t}`;
}
function kl(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = An(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = nt(e);
  if (n !== null) {
    const r = An(kr(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Sl(n)} ${r.label.toUpperCase()}`;
  }
  return An(e).label.toUpperCase();
}
const qe = "modulation.v6", Yi = 6, Lt = 3, st = 3, Al = 4, uo = "modulationMsegBuffer", Tl = "modulationMsegPlayback", Qi = 4, El = ["MSEG 1", "MSEG 2", "MSEG 3"], Xi = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Ol = ["Env 1", "Env 2", "Env 3"], xl = 1e-3, re = 10, Rl = 0.1, wl = 20, fo = 10 - 0.1, Ml = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: wl - Rl },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Bi,
    max: Hi
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
  mseg1Rate: { min: -Be, max: Be },
  mseg2Rate: { min: -Be, max: Be },
  mseg3Rate: { min: -Be, max: Be },
  env1Attack: { min: -re, max: re },
  env1Decay: { min: -re, max: re },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -re, max: re },
  env2Attack: { min: -re, max: re },
  env2Decay: { min: -re, max: re },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -re, max: re },
  env3Attack: { min: -re, max: re },
  env3Decay: { min: -re, max: re },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -re, max: re },
  ampAttack: { min: -re, max: re },
  ampDecay: { min: -re, max: re },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -re, max: re },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -fo, max: fo },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Dl = xi().filter((e) => e.modulationTargetIndex !== null), _l = new Map(
  Dl.map((e) => [
    br(yr(e)),
    e
  ])
);
class Tn extends Error {
  name = "ModulationStateParseError";
}
const Cl = {
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
tt.map((e) => ({
  value: e.id,
  label: Cl[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Ll = je.map((e) => ({
  value: e.kind,
  label: kl(e.kind)
}));
Ll.filter((e) => !Pl(e.value));
function Nl(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Er(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function En(e, t) {
  const n = Number(e);
  return Er(Number.isFinite(n) ? n : t, xl, re);
}
function Pl(e) {
  return Sr(e) !== null;
}
function Fl(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function jl(e) {
  const t = nt(e);
  return t !== null ? kr(t) : e;
}
function zl(e) {
  const t = jl(e);
  if (nt(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = _l.get(t);
  return n !== void 0 ? Fl(n) : Ml[fc(t)];
}
function Ul(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Kl(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function $l(e, t) {
  const n = zl(e), r = Number(t);
  return Er(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Vl(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Bl(e) {
  return Vl(e) ?? "mseg";
}
function Hl(e) {
  const t = Ir(e);
  return t !== null ? t : nt(e) !== null ? e : null;
}
function ql(e) {
  return Hl(e) ?? "oscA.wavetablePosition";
}
function Wl(e, t) {
  const n = Xi[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Gl(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Lt : e === "macro" ? Qi : Al;
  return Er(Number.isFinite(n) ? n : 1, 1, r);
}
function ct(e) {
  return {
    name: Ol[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Zi(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = ct(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: En(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: En(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Qe(n.sustain ?? r.sustain),
    releaseSeconds: En(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Jl(e, t = 0) {
  return { name: Zi(e, t).name };
}
function Yl(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: Ul(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Gl(n, e.sourceSlot),
    polarity: Kl(e.polarity),
    targetKind: r,
    amount: $l(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function Ql(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Bl(r.sourceKind), o = ql(r.targetKind);
  return Yl(r, t, i, o);
}
function Xl(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function Zl(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => Ql(n, r));
}
function ed(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = Xl(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function Gn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, s) => Gn(a, t[s]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Nl(r, a) && Gn(n[a], r[a]));
}
function ea(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = vc(El[t] ?? `MSEG ${t + 1}`), i = Bn(n.shapeA ?? r), o = Sc({
    ...Hn(),
    ...n.playback ?? {},
    rate: Hn().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: Bn(n.shapeB ?? i),
    playback: s
  };
}
function Dt() {
  return {
    format: "cosimo.modulation",
    version: Yi,
    msegSlots: Array.from({ length: Lt }, (e, t) => ea({}, t)),
    envelopeSlots: Array.from({ length: st }, (e, t) => ({
      name: ct(t).name
    })),
    routes: [],
    macroNames: Xi.slice()
  };
}
function td(e = Dt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Yi,
    msegSlots: Array.from({ length: Lt }, (o, a) => ea(n[a], a)),
    envelopeSlots: Array.from({ length: st }, (o, a) => Jl(r[a], a)),
    routes: Zl(t.routes),
    macroNames: Array.from(
      { length: Qi },
      (o, a) => Wl(i[a], a)
    )
  };
}
function On(e) {
  const t = tn(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function tn(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Tt(new Tn("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Tt(new Tn("Expected valid modulation JSON"));
    }
  }
  const n = td(t);
  return !Gn(t, n) || !ed(n.routes) ? Tt(new Tn("Expected the current modulation schema")) : ht(n);
}
function nd(e, t) {
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
function mo(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Js(n))
  };
}
function rd(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function po(e, t = null, n) {
  const r = [];
  for (let i = 0; i < Lt; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !oo(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: uo,
      value: mo(i, 0, o.shapeA)
    }), (a === void 0 || !oo(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: uo,
      value: mo(i, 1, o.shapeB)
    }), (a === void 0 || !rd(a.playback, o.playback)) && r.push({
      endpointID: Tl,
      value: nd(i, o.playback)
    });
  }
  return r.push(...Lc(t?.routes ?? null, e.routes)), r;
}
function ta(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) ta(t);
    Object.freeze(e);
  }
}
const od = {
  parse(e) {
    const t = tn(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (ta(t.value), { kind: "ok", value: t.value });
  },
  encode: On,
  equals: (e, t) => On(e) === On(t)
}, id = [
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
], ad = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function sd(e) {
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
function cd(e, t, n) {
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
function ld(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${sd(n)}`,
    runtimeTargetIndex: Ci(r),
    oscillatorIndex: t
  });
}
function dd(e, t) {
  const n = Object.freeze(id.map(
    (o) => cd(e, t, o)
  )), r = Object.freeze(vr.map(
    (o) => ld(e, t, o)
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
const qt = Object.freeze(
  ad.map(({ id: e, oscillatorIndex: t }) => dd(e, t))
);
function ud() {
  if (qt.length !== J.length || qt.some((t, n) => t.id !== J[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = qt.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
ud();
const xn = "articulationSnapshot", ie = 128, ho = 48, fd = 1e6, me = -1, Rn = [
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
function Or(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function wn(e) {
  return Or(Number.isFinite(e) ? e : 0, 0, 1);
}
function he(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return Or(Number.isFinite(i) ? i : t, n, r);
}
function fe(e, t, n, r) {
  return Or(Math.round(he(e, t)), n, r);
}
function na(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function Mn() {
  return Array.from({ length: ie }, () => me);
}
function md(e) {
  const t = fe(e, 0, 0, ie - 1), n = Rn[t % Rn.length], r = Math.floor(t / Rn.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function pd() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Ar,
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
function hd(e) {
  const t = pd(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: he(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: he(n.pan, t.pan, -1, 1),
    octave: fe(n.octave, t.octave, -4, 4),
    semitone: fe(n.semitone, t.semitone, -12, 12),
    fineCents: he(n.fineCents, t.fineCents, -100, 100),
    volumeDb: he(
      n.volumeDb,
      t.volumeDb,
      qn,
      qi
    ),
    mute: fe(n.mute, t.mute, 0, 1),
    solo: fe(n.solo, t.solo, 0, 1),
    warpMode: fe(n.warpMode, t.warpMode, 0, 4),
    warpAmount: he(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: fe(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: he(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: he(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: he(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: fe(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: he(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: he(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: he(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: he(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: he(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: fe(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: fe(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: fe(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: he(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: he(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      wn(Number(r[0])),
      wn(Number(r[1])),
      wn(Number(r[2]))
    ]
  };
}
function gd(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: he(t.amount, 0, -48, 48)
  } : null;
}
function yd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(gd).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: hd(t.parameters),
    envelopes: [0, 1, 2].map((i) => Zi(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function vd(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = fe(n.runtimeSlot, t, 0, ie - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : md(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: yd(n.snapshot)
  };
}
function bd(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: fe(n.note, 0, 0, ie - 1),
    articulationId: r
  } : null;
}
function Id(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let s = fe(o.min, i, i, ie - 1), c = fe(o.max, s, i, ie - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function go(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = Id(
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
function Sd(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = bd(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function kd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < ie; c += 1) {
    const m = vd(n[c], c);
    !m || r.has(m.runtimeSlot) || i.has(m.id) || (r.add(m.runtimeSlot), i.add(m.id), o.push(m));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((c) => c.id === t.selectedSlotId) ? t.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: na(t.activeTriggerMode),
    slots: o,
    chainAssignments: go(t.chainAssignments, s, "chain", 0),
    keyAssignments: Sd(t.keyAssignments, s),
    velocityAssignments: go(t.velocityAssignments, s, "velocity", 1)
  };
}
function yo(e) {
  const t = (n) => J.map(() => n);
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
    volumeDbs: t(Ar),
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
    msegMorphs: Array.from({ length: Lt }, () => 0),
    routeAmounts: Array.from({ length: Ui }, () => 0),
    envelopeAttackSeconds: Array.from({ length: st }, (n, r) => ct(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: st }, (n, r) => ct(r).decaySeconds),
    envelopeSustain: Array.from({ length: st }, (n, r) => ct(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: st }, (n, r) => ct(r).releaseSeconds)
  };
}
function vo(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === me && (e[o] = i);
  }
}
function Ad(e) {
  const t = kd(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = Mn(), i = Mn(), o = Mn();
  vo(r, t.chainAssignments, n), vo(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== me || (i[a.note] = s);
  }
  return o[0] = me, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function ra(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : Ad(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: na(t.activeMode),
    chain: Array.from({ length: ie }, (n, r) => fe(t.chain?.[r], me, me, ie - 1)),
    key: Array.from({ length: ie }, (n, r) => fe(t.key?.[r], me, me, ie - 1)),
    velocity: Array.from({ length: ie }, (n, r) => r === 0 ? me : fe(t.velocity?.[r], me, me, ie - 1))
  });
}
function Td(e, t) {
  const n = ra(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const Se = "articulations.v4", xr = [
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
], Rr = [
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
], oa = [
  ...J.flatMap((e) => xr.map(
    (t) => `osc${e}.${t}`
  )),
  ...Rr
];
class ia extends Error {
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
function G(e) {
  return Tt(new ia("malformed", e));
}
function Nt(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function wr(e, t, n) {
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
function nn(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < ie;
}
function Ed(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function Od(e) {
  return oa.some((t) => t === e);
}
function bo(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = wr(e, ["min", "max"], t);
  return n !== null ? G(n) : nn(e.min) ? nn(e.max) ? e.min > e.max ? G(`${t}.min must be less than or equal to ${t}.max`) : ht({ min: e.min, max: e.max }) : G(`${t}.max must be an integer in 0..127`) : G(`${t}.min must be an integer in 0..127`);
}
function xd(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return G(`${t} has a non-string parameter id`);
    if (!Od(r))
      return G(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return G(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return ht(n);
}
function aa(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function sa() {
  return {};
}
function Rd(e, t, n) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const r = sa();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return G(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > ho)
      return G(
        `${t}.${i} must be a finite route amount within ±${ho}`
      );
    if (!n.has(i))
      return G(`${t}.${i} does not name a current articulable mapping`);
    aa(r, i, o);
  }
  return ht(r);
}
function wd(e, t, n) {
  const r = `slots[${t}]`;
  if (!Nt(e))
    return G(`${r} must be an object`);
  const i = wr(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return G(i);
  if (typeof e.id != "string")
    return G(`${r}.id must be a string`);
  if (!nn(e.runtimeSlot))
    return G(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return G(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return G(`${r}.color must be a string`);
  if (!nn(e.key))
    return G(`${r}.key must be an integer in 0..127`);
  const o = bo(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = bo(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = xd(e.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = Rd(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : ht({
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
function Md(e) {
  const t = {};
  for (const n of oa) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function Dd(e) {
  const t = sa();
  for (const [n, r] of Object.entries(e))
    aa(t, n, r);
  return t;
}
const _d = Object.fromEntries(
  xr.map((e, t) => [e, 2 ** t])
), Cd = Object.fromEntries(
  Rr.map((e, t) => [e, 2 ** t])
);
function Io(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Ld(e, t) {
  return xr.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | _d[r] : n, 0);
}
function Nd(e) {
  return Rr.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | Cd[n] : t, 0);
}
function Pd(e, t) {
  const n = (o, a) => Io(e, `osc${o}.${a}`), r = (o) => Io(e, o), i = Array.from(
    { length: Ui },
    () => fd
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const s = t[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: J.map((o) => Ld(e, o)),
    sharedOverrideMask: Nd(e),
    framePositions: J.map((o) => n(o, "framePosition")),
    pans: J.map((o) => n(o, "pan")),
    octaves: J.map((o) => n(o, "octave")),
    semitones: J.map((o) => n(o, "semitone")),
    fineCents: J.map((o) => n(o, "fineCents")),
    phases: J.map((o) => n(o, "phase")),
    phaseRandoms: J.map((o) => n(o, "phaseRandom")),
    retriggers: J.map((o) => n(o, "retrigger")),
    volumeDbs: J.map((o) => n(o, "volumeDb")),
    mutes: J.map((o) => n(o, "mute")),
    solos: J.map((o) => n(o, "solo")),
    warpModes: J.map((o) => n(o, "warpMode")),
    warpAmounts: J.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: J.map((o) => n(o, "unisonVoices")),
    unisonDetunes: J.map((o) => n(o, "unisonDetune")),
    unisonBlends: J.map((o) => n(o, "unisonBlend")),
    unisonWidths: J.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: J.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: J.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: J.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: J.map((o) => n(o, "unisonWarpSpread")),
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
function Fd(e, t) {
  return e.slots.map((n) => Pd(n, t));
}
function ca(e, t) {
  if (!Nt(e))
    return G("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return G('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Tt(new ia(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = wr(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return G(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return G("selectedSlotId must be null or a string");
  if (!Ed(e.activeTriggerMode))
    return G('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return G("slots must be an array");
  if (e.slots.length > ie)
    return G(`slots must contain at most ${ie} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const s = wd(e.slots[a], a, t);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (i.has(c.id))
      return G(`slots[${a}].id duplicates "${c.id}"`);
    if (o.has(c.runtimeSlot))
      return G(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    i.add(c.id), o.add(c.runtimeSlot), r.push(c);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? G(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : ht({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function So(e) {
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
      overrides: Md(t.overrides),
      routeAmounts: Dd(t.routeAmounts)
    }))
  };
}
function gn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function jd(e) {
  const t = Array.from({ length: ie }, () => me), n = Array.from({ length: ie }, () => me), r = Array.from({ length: ie }, () => me);
  for (const i of e.slots) {
    n[i.key] === me && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === me && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === me && (r[o] = i.runtimeSlot);
  }
  return r[0] = me, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
async function zd(e, t, n, r = {}) {
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
const Ud = 3, Kd = (4 + Rt) * 4, ko = "runtimeState";
function $d(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Ao = "runtimeInstallAck", la = "runtimeSyncRequest", Jn = 0, Vd = 8e3, rn = /* @__PURE__ */ new WeakMap(), da = 1e9;
let Ut = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % da;
function Bd(e) {
  return Ut = Ut % da + 1, e === "modulation" ? -1e9 - Ut : 1e9 + Ut;
}
function Hd(e, t) {
  const n = e, r = rn.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), rn.set(n, r);
}
function To(e, t) {
  const n = e, r = rn.get(n);
  r?.delete(t), r?.size === 0 && rn.delete(n);
}
const qd = [100, 250, 500, 1e3], Kt = { _tag: "accepted" }, Wd = { _tag: "superseded" }, Gd = { _tag: "stopped" }, Eo = { _tag: "transport-timeout" };
function Jd(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
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
  ].every((h) => typeof h == "number" && Number.isSafeInteger(h) && h >= -2147483648 && h <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof m != "number" || i < 0 || o < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: m
  };
}
function Yd(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Oo {
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
  #k = this.#w.bind(this);
  constructor(t, n) {
    this.#t = t, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#o = r && r.length > 0 ? r : [...qd], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Vd)
    );
  }
  start() {
    if (!this.#i) {
      Hd(this.#t, this.#e);
      try {
        this.#h += 1, this.#i = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(Ao, this.#k);
      } catch (t) {
        throw this.#i = !1, To(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(Ao, this.#k), To(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#S();
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
    } : this.#A(t, n) : {
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
      const i = await this.#A(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of t) {
        const s = await this.#x(
          a,
          n,
          r
        );
        if (s._tag === "rejected" && this.#e === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? Kt;
    } finally {
      this.#a = !1;
    }
  }
  #T(t) {
    return this.#e === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #E(t, n) {
    const r = this.#T(t);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #O() {
    const t = this.getAcceptedFrontier();
    return this.#e === "modulation" ? t + 1 : t - 1;
  }
  async #A(t, n) {
    if (this.#c === t)
      return Kt;
    const r = Bd(this.#e);
    this.#u.add(r);
    const i = Date.now() + this.#d;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#f(t, n);
        if (a)
          return a;
        if (this.#c === t)
          return Kt;
        const s = i - Date.now();
        if (s <= 0)
          return Eo;
        const c = this.#l;
        this.#b(r), await this.#I(
          c,
          Math.min(this.#v(o), s)
        ), o += 1;
      }
    } finally {
      this.#u.delete(r);
    }
  }
  async #x(t, n, r) {
    const i = this.#O(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const s = () => {
      a = !0;
      for (const d of o) d();
      o.clear();
    }, c = {
      get aborted() {
        return a;
      },
      onAbort(d) {
        return a ? d() : o.add(d), () => {
          o.delete(d);
        };
      }
    };
    this.#m.add(s);
    const m = async () => {
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#R(t.endpointID, Yd(t.value, n, i)));
    };
    try {
      let d = 0, h = 0, f = this.#p;
      for (await m(); ; ) {
        const g = this.#f(n, r);
        if (g)
          return g;
        const b = this.#y(n, i, f);
        if (b !== null)
          return b;
        const I = this.#l;
        await this.#I(
          I,
          this.#v(d)
        );
        const y = this.#y(
          n,
          i,
          f
        );
        if (y !== null)
          return y;
        let A = this.#l;
        for (this.#b(i); ; ) {
          const F = this.#f(n, r);
          if (F)
            return F;
          const _ = await this.#I(
            A,
            this.#v(d)
          ), M = this.#y(
            n,
            i,
            f
          );
          if (M !== null)
            return M;
          if (_ && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
            if (h >= 1)
              return Eo;
            f = this.#p, await m(), h += 1, d += 1;
            break;
          }
          if (_) {
            A = this.#l;
            continue;
          }
          _ || (d += 1, A = this.#l, this.#b(i));
        }
      }
    } catch (d) {
      const h = this.#f(n, r);
      if (h) return h;
      throw d;
    } finally {
      s(), this.#m.delete(s);
    }
  }
  #y(t, n, r) {
    const i = this.#n;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#s.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#s.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#E(i, n) ? (this.#s.delete(n), Kt) : null;
  }
  #f(t, n) {
    return !this.#i || this.#h !== n ? Gd : this.#r !== t ? Wd : null;
  }
  #v(t) {
    return this.#o[Math.min(
      t,
      this.#o.length - 1
    )];
  }
  #R(t, n) {
    try {
      this.#t.sendEventOrValue?.(
        t,
        n,
        void 0,
        Jn
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#i)
      try {
        this.#t.sendEventOrValue?.(
          la,
          t,
          void 0,
          Jn
        );
      } catch {
      }
  }
  #w(t) {
    const n = Jd(t);
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
const Qd = 1e3, Xd = [qe, Se];
function xo(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Dn(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (xo(r, t)) return r[t];
  if (xo(n, t)) return n[t];
}
function _n(e, t) {
  if (e === void 0) return gn();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = ca(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Ro(e) {
  return new Set(e.routes.flatMap((t) => $i(t) === null ? [] : [t.id]));
}
function wo(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Mo(e, t) {
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
class Zd {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Oo(t, { laneKind: "modulation" }), this.articulationLane = new Oo(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Dt();
  articulationBank = gn();
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
    { length: ie },
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
    return this.frameworkInput ? [Se] : Xd;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(ko, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(ko, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = Dn(t, qe), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Dt() } : tn(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${qe} is invalid; boot state was not installed.`);
      const a = Dn(t, Se), s = _n(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = Dn(t, Se), o = _n(
      i,
      Ro(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${Se} is invalid; boot state was not installed.`);
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
      const i = tn(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${qe}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = _n(n, Ro(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${Se}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = $d(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(la, 0, void 0, Jn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? po(r, s, this.frameworkInput.curveCommand) : po(r, s), m = await this.modulationLane.sendBatch(c);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", m, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const y = Mo("modulation", m);
      y && o?.(y), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const d = this.buildUploadsBySelector(r, i), h = Array.from({ length: ie }, (y, A) => {
      const F = d.get(A);
      return F ? wo(F) : null;
    }), f = this.lastAppliedArticulationGeneration !== n, g = f && this.articulationLane.getAcceptedFrontier() !== 0, b = [];
    for (let y = 0; y < ie; y += 1) {
      const A = d.get(y), F = h[y] !== this.lastAppliedArticulationTokens[y];
      g ? b.push({
        endpointID: xn,
        value: A ?? yo(y)
      }) : f ? A && b.push({ endpointID: xn, value: A }) : F && b.push({
        endpointID: xn,
        value: A ?? yo(y)
      });
    }
    const I = await this.articulationLane.sendBatch(b);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", I, h)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = h;
        const y = jd(i);
        if (this.frameworkInput) {
          const A = await this.frameworkInput.publishTriggerConfig(y);
          if (!this.started || t !== this.lifecycleEpoch) return;
          A.kind !== "cancelled" && o?.(A);
        } else
          Td(y, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const A of b) this.lastAppliedArticulationTokens[A.value.selectorA] = void 0;
        const y = Mo("articulation", I);
        y && o?.(y);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = $i(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      Fd(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = wo(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Qd));
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
const eu = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [Se],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = Do(e);
    return {
      apply(n, r) {
        return t.closed && (t = Do(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function Do(e) {
  let t = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(f) {
    const g = r;
    r = void 0, g ? g(f) : f.kind !== "cancelled" && e.report(f);
  }
  function c() {
    t || (t = !0, h.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function m(f) {
    if (f.kind !== "submitted") {
      f.kind === "failed" && f.error.kind !== "transport" && (s(f), c());
      return;
    }
    i.add(f.completion), f.completion.then((g) => {
      i.delete(f.completion), !(t || g.kind === "sent") && (s(g), c());
    }, (g) => {
      t || (c(), e.fail(g));
    });
  }
  const d = {
    addEndpointListener(f, g) {
      const b = o.get(f) ?? /* @__PURE__ */ new Map();
      b.set(g, e.listen(f, g)), o.set(f, b);
    },
    removeEndpointListener(f, g) {
      o.get(f)?.get(g)?.(), o.get(f)?.delete(g);
    },
    addStoredStateValueListener(f) {
      a.set(f, e.subscribeStored(
        Se,
        (g) => f({ key: Se, value: g })
      ));
    },
    removeStoredStateValueListener(f) {
      a.get(f)?.(), a.delete(f);
    },
    requestFullStoredState(f) {
      e.readStored(Se).then((g) => {
        t || f({ values: { [Se]: g } });
      }, (g) => e.fail(g));
    },
    sendEventOrValue(f, g) {
      t || m(e.send({ kind: "event", endpoint: f, value: g }));
    }
  }, h = new Zd(d, {
    onDefect(f) {
      c(), e.fail(f);
    },
    curveCommand: (f, g, b) => ({
      async submit({ dspSessionId: I, deliverySerial: y, signal: A }) {
        const F = await e.prepareData(
          Ud + f * 2 + g,
          Kd,
          (_) => {
            new Int32Array(_.buffer, _.byteOffset, 4).set([1297302855, I, y, Rt]), ki(b, new Float32Array(_.buffer, _.byteOffset + 16, Rt));
          },
          A
        );
        F.kind === "failed" && (s(F), c());
      }
    }),
    async publishTriggerConfig(f) {
      const b = (await Promise.all(i)).find((y) => y.kind !== "sent");
      if (b) return b.kind === "failed" ? b : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const I = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: ra(f) });
      return I.kind === "submitted" ? I.completion : I;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(f, g) {
      if (t || g.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const b = ++n;
      return new Promise((I) => {
        const y = g.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (A) => {
          y(), I(A);
        }, h.replaceModulation(f, (A) => {
          b === n && A.kind !== "preparing" && s(A);
        }), h.start();
      });
    },
    stop: c
  };
}
const ua = 13, Mr = 5, fa = 8, tu = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Dr = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    Ae("globalFilter")
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
    Ae("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    Ae("ott")
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
    Ae("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    Ae("flanger")
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
    Ae("phaser")
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
    Ae("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    Ae("reverb")
  ]
}), ma = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), nu = Object.freeze([
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
]), ru = Object.freeze({
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
function ou(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function pa(e, t) {
  const n = {};
  for (const s of Dr[e]) {
    const c = t[s];
    if (typeof c == "number" && Number.isFinite(c)) {
      n[s] = c;
      continue;
    }
    const m = ru[s];
    if (m === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${s}`);
    n[s] = m;
  }
  const i = [
    ...ma.chorus,
    Ae("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((s) => i.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = ou(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function _r(e) {
  return Dr[e];
}
function iu(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Mr)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * fa + tu[e];
}
function au(e, t) {
  const n = new Array(ua).fill(0), r = pa(e, t);
  return Dr[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const ha = "lane.v1", on = "laneTopology", _t = "laneSlotParams", Yn = "laneSlotParamValue", ga = "laneOutputControl", Qn = 16, su = 8, ya = 4, cu = 3, va = Mr * fa, ba = 4, lu = 4, du = va, uu = va + ba, fu = 0, mu = 1, pu = 2, hu = 3, gu = 4, yu = 5;
function vu(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > ya)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << su;
}
const an = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), sn = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Ia = new Map(
  Object.entries(sn).map(([e, t]) => [t, e])
), bu = Object.freeze({
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
  an.map((e) => [bu[e], e])
);
const Iu = Object.freeze([
  "voice.filterCutoff",
  Wi,
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
]), Su = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Wi]: "enhancer-frequency",
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
  Iu.map((e) => [e, Object.freeze({
    id: e,
    family: Su[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Sa = 40, ka = 18e3, Xn = an.map((e) => sn[e]), ku = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Au = /^(parallel|split)#([1-9][0-9]*)$/;
function Pt(e) {
  if (typeof e != "string")
    return null;
  const t = ku.exec(e);
  if (t === null)
    return null;
  const n = Xn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Mr ? null : { deviceType: n, instanceNumber: r };
}
function Aa(e) {
  if (typeof e != "string")
    return null;
  const t = Au.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? ba : lu) ? null : { groupKind: n, unitNumber: r };
}
function Ge(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function dt(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function X(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function Tu(e, t) {
  const n = Pt(e);
  if (n === null)
    return { failure: X(`device id ${e} is not a pool instance`) };
  if (!Ge(t) || !dt(t, ["params"]) || !Ge(t.params))
    return { failure: X(`device ${e} must be { params }`) };
  const r = _r(n.deviceType), i = Ia.get(n.deviceType);
  if (i === void 0)
    return { failure: X(`device ${e} has no effect descriptor`) };
  const o = Oi(i).parameters.map((g) => g.endpointID), a = t.params, s = Object.keys(a), c = (g) => s.length === g.length && s.every((b) => g.includes(b)), m = Ae(n.deviceType), d = [
    ...ma[n.deviceType],
    m
  ], h = [
    ...nu,
    m
  ];
  if (!(s.includes(m) && (c(r) || c(o) || c(d) || n.deviceType === "chorus" && c(h))))
    return { failure: X(`device ${e} must carry every parameter once`) };
  for (const g of s) {
    const b = a[g];
    if (typeof b != "number" || !Number.isFinite(b))
      return { failure: X(`device ${e}.${g} must be a finite number`) };
  }
  return { record: { params: pa(n.deviceType, a) } };
}
function Eu(e, t) {
  return !Ge(e) || e.kind !== "device" ? { failure: X("branches may hold device placements only") } : dt(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: X(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: X(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: X("a device placement is { kind, deviceId, enabled }") };
}
function _o(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= Sa && e <= ka;
}
function Ta() {
  return { mix: 1, bypassed: !1 };
}
function Ou(e) {
  return !Ge(e) || !dt(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function xu(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (d) {
      const h = d instanceof Error ? d.message : String(d);
      return X(`is not valid JSON: ${h}`);
    }
  if (!Ge(t) || !dt(t, ["format", "version", "output", "devices", "chain"]))
    return X("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return X("must be cosimo.lane version 2");
  if (!Ge(t.devices))
    return X("devices must be an object");
  if (!Array.isArray(t.chain))
    return X("chain must be an array");
  const n = Ou(t.output);
  if (n === null)
    return X("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const d of Reflect.ownKeys(t.devices)) {
    if (typeof d != "string")
      return X("device ids must be strings");
    const h = Tu(d, t.devices[d]);
    if ("failure" in h)
      return h.failure;
    r[d] = h.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const m = (d) => {
    const h = Eu(d, i);
    return "placement" in h && (o.set(
      h.placement.deviceId,
      (o.get(h.placement.deviceId) ?? 0) + 1
    ), c += 1), h;
  };
  for (const d of t.chain) {
    if (!Ge(d))
      return X("chain nodes must be objects");
    if (d.kind === "device") {
      const _ = m(d);
      if ("failure" in _)
        return _.failure;
      s.push(_.placement);
      continue;
    }
    if (d.kind !== "parallel" && d.kind !== "split")
      return X(`unknown chain node kind ${String(d.kind)}`);
    const h = d.kind === "split", f = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], b = h ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], I = h && dt(d, f);
    if (!dt(d, b) && !I)
      return X(`a ${d.kind} group is { ${b.join(", ")} }`);
    const y = Aa(d.groupId);
    if (y === null || y.groupKind !== d.kind)
      return X(`group id ${String(d.groupId)} does not name a ${d.kind} unit`);
    if (a.has(String(d.groupId)))
      return X(`group ${String(d.groupId)} is used twice`);
    if (a.add(String(d.groupId)), typeof d.enabled != "boolean")
      return X(`group ${String(d.groupId)} needs a boolean enable`);
    const A = h ? cu : ya;
    if (!Array.isArray(d.branches) || d.branches.length < 2 || d.branches.length > A)
      return X(`group ${String(d.groupId)} needs 2..${A} branches`);
    if (h && (!_o(d.xoverLowHz) || !_o(d.xoverHighHz)))
      return X(`group ${String(d.groupId)} crossovers must sit in ${Sa}..${ka} Hz`);
    if (h && !I && (typeof d.xoverLowKeyTrackEnabled != "boolean" || typeof d.xoverHighKeyTrackEnabled != "boolean" || typeof d.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverLowKeyTrackOffsetSemitones) || typeof d.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverHighKeyTrackOffsetSemitones)))
      return X(`group ${String(d.groupId)} Key Track state must be finite`);
    c += 1;
    const F = [];
    for (const _ of d.branches) {
      if (!Array.isArray(_))
        return X(`group ${String(d.groupId)} branches must be arrays`);
      const M = [];
      for (const D of _) {
        const ee = m(D);
        if ("failure" in ee)
          return ee.failure;
        M.push(ee.placement);
      }
      F.push(M);
    }
    s.push(h ? {
      kind: "split",
      groupId: String(d.groupId),
      enabled: d.enabled,
      xoverLowHz: d.xoverLowHz,
      xoverHighHz: d.xoverHighHz,
      xoverLowKeyTrackEnabled: I ? !1 : d.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: I ? 0 : d.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: I ? !1 : d.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: I ? 0 : d.xoverHighKeyTrackOffsetSemitones,
      branches: F
    } : {
      kind: "parallel",
      groupId: String(d.groupId),
      enabled: d.enabled,
      branches: F
    });
  }
  for (const d of i)
    if ((o.get(d) ?? 0) !== 1)
      return X(`device ${d} must be placed exactly once`);
  return c > Qn ? X(`flattens to ${c} wire entries; the topology upload holds ${Qn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function Ru() {
  const e = {};
  for (const t of an) {
    const n = sn[t];
    e[`${n}#1`] = {
      params: Pu(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Ta(),
    devices: e,
    chain: an.map((t) => ({
      kind: "device",
      deviceId: `${sn[t]}#1`,
      enabled: !1
    }))
  };
}
const Co = ["distortion#1", "delay#1", "reverb#1"];
function Cr() {
  const e = Ru(), t = {};
  for (const n of Co) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Ta(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && Co.includes(n.deviceId))
  };
}
function wu(e) {
  if (e === void 0)
    return Cr();
  const t = xu(e);
  return t._tag === "ok" ? t.value : null;
}
function Cn(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function Mu(e) {
  return Object.keys(e.devices).map((t) => {
    const n = Pt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Xn.indexOf(t.parsed.deviceType) - Xn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Zn(e) {
  const t = Pt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return iu(t.deviceType, t.instanceNumber - 1);
}
function Ea(e) {
  const t = Aa(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? du : uu) + (t.unitNumber - 1);
}
function Du(e) {
  const t = new Array(Qn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    t[r] = vu(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Zn(o.deviceId), 0, o.enabled);
      continue;
    }
    i(Ea(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(Zn(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function _u(e) {
  const t = new Array(ua).fill(0);
  return t[fu] = e.xoverLowHz, t[mu] = e.xoverHighHz, t[pu] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[hu] = e.xoverLowKeyTrackOffsetSemitones, t[gu] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[yu] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function Cu(e) {
  const t = [{
    endpointID: ga,
    value: e.output
  }];
  let n = 0;
  for (const r of Mu(e)) {
    const i = Pt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: hr(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[Ae(i.deviceType)]
    }), n += 1, t.push({
      endpointID: _t,
      value: {
        slotId: Zn(r.instanceId),
        deliverySerial: n,
        values: au(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: _t,
      value: {
        slotId: Ea(r),
        deliverySerial: n,
        values: _u(r)
      }
    }));
  return t.push({
    endpointID: on,
    value: Du(e)
  }), t;
}
function Lu(e, t, n, r) {
  const i = e.devices[t], o = Pt(t);
  if (i === void 0 || o === null || !_r(o.deviceType).includes(n) || !Number.isFinite(r))
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
function Nu(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = Ys(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      Mt,
      Math.max(We, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = Lu(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function Pu(e) {
  const t = Ia.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Oi(t).parameters;
  return Object.fromEntries(_r(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function Lr(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Lr(t);
    Object.freeze(e);
  }
}
const Fu = {
  parse(e) {
    const t = wu(e);
    return t ? (Lr(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Cn,
  equals: (e, t) => Cn(e) === Cn(t)
}, Lo = /* @__PURE__ */ new WeakMap();
function Ln(e) {
  if (!Object.isFrozen(e)) return JSON.stringify(So(e));
  let t = Lo.get(e);
  return t === void 0 && Lo.set(e, t = JSON.stringify(So(e))), t;
}
const ju = {
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
    const r = ca(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (Lr(r.value), { kind: "ok", value: r.value });
  },
  encode: Ln,
  equals: (e, t) => e === t || Ln(e) === Ln(t)
}, No = [ga, _t, Yn, on], zu = { kind: "sent", proof: "native-publication-processed" };
const Uu = {
  eventEndpoints: No,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (f) => Cu(f).filter((g) => No.includes(g.endpointID));
    async function m(f, g, b = !1) {
      if (a || g.aborted) return { kind: "cancelled" };
      const I = c(f), y = t && !b ? c(t) : [], A = (M) => M.find((D) => D.endpointID === on)?.value, F = y.length > 0 && JSON.stringify(A(y)) === JSON.stringify(A(I)), _ = [];
      for (const M of I) {
        if (!F) {
          _.push(M);
          continue;
        }
        if (M.endpointID !== on)
          if (M.endpointID === _t) {
            const D = M.value, ee = y.find((te) => te.endpointID === M.endpointID && te.value.slotId === D.slotId), Y = ee ? ee.value.values : [], pe = D.values.flatMap((te, ge) => Object.is(te, Y[ge]) ? [] : [ge]);
            pe.length === 1 ? _.push({
              endpointID: Yn,
              value: { slotId: D.slotId, paramIndex: pe[0], value: D.values[pe[0]] }
            }) : pe.length > 1 && _.push(M);
          } else JSON.stringify(M.value) !== JSON.stringify(y.find((D) => D.endpointID === M.endpointID)?.value) && _.push(M);
      }
      t = void 0;
      for (const M of _) {
        if (a || g.aborted) return { kind: "cancelled" };
        const D = M.endpointID === _t || M.endpointID === Yn ? { ...Object(M.value), deliverySerial: ++r } : M.value, ee = e.send({ kind: "event", endpoint: M.endpointID, value: D }), Y = ee.kind === "submitted" ? await ee.completion : ee;
        if (Y.kind !== "sent") return Y;
      }
      return a || g.aborted ? { kind: "cancelled" } : (t = f, zu);
    }
    function d(f, g, b = !1) {
      const I = s.then(() => m(f, g, b));
      return s = I.catch(() => {
      }), I;
    }
    const h = e.listen("runtimeState", (f) => {
      const g = f !== null && typeof f == "object" ? Reflect.get(f, "dspSessionId") : void 0;
      if (typeof g != "number" || g === o) return;
      const b = o !== void 0;
      o = g;
      const I = i;
      b && n && d(n, e.signal, !0).then((y) => {
        y.kind === "failed" && I === i && e.report(y);
      }, e.fail);
    });
    return {
      apply(f, g) {
        return i += 1, n = f, d(f, g.signal);
      },
      stop() {
        a = !0, h();
      }
    };
  }
};
function Nn(e, t) {
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
const Ku = {
  ...Nn("A", 0),
  ...Nn("B", 1),
  ...Nn("C", 1),
  ...Object.fromEntries(gr().map((e) => [e, 0])),
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
  [qe]: Dt(),
  [ha]: Cr(),
  [Se]: gn()
}, $u = [
  { id: "init", name: "Init", values: Ku }
], Oa = "bounce.v1", Vu = "cosimo.bounce", Bu = 1, xa = "cosimo.patch-document", Ra = 1;
function le(e, t) {
  if (!e) throw new Error(t);
}
function Fe(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Xe(e, t = "value") {
  return e === null || typeof e == "boolean" || typeof e == "string" ? e : typeof e == "number" ? (le(Number.isFinite(e), `${t} must be finite JSON data`), e) : Array.isArray(e) ? e.map((n, r) => Xe(n, `${t}[${r}]`)) : (le(Fe(e), `${t} must be JSON-compatible`), Object.fromEntries(
    Object.keys(e).sort().map((n) => [n, Xe(e[n], `${t}.${n}`)])
  ));
}
function wa(e, t) {
  if (typeof e != "string") return Xe(e, t);
  try {
    return Xe(JSON.parse(e), t);
  } catch (n) {
    throw new Error(`${t} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function Hu(e) {
  return JSON.stringify(Xe(e));
}
function qu({ parameters: e, storedState: t } = {}) {
  le(Fe(e), "Bounce patch parameters must be an object"), le(Fe(t), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(e).sort()) {
    const i = e[r];
    le(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), le(
      typeof i == "number" && Number.isFinite(i),
      `Bounce parameter ${r} must be finite`
    ), n[r] = i;
  }
  return Object.freeze({
    format: xa,
    version: Ra,
    parameters: Object.freeze(n),
    storedState: Object.freeze(Xe(t, "storedState"))
  });
}
function Wu(e) {
  const t = wa(e, "Bounce patch document");
  return le(
    Fe(t) && t.format === xa && t.version === Ra,
    "Unsupported Bounce patch document"
  ), le(
    Object.keys(t).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), qu(t);
}
function Ma(e) {
  const t = wa(e, Oa);
  le(
    Fe(t) && t.format === Vu && t.version === Bu,
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
  le(
    Object.keys(t).sort().join(",") === n.sort().join(","),
    "bounce.v1 has unexpected fields"
  ), le(
    typeof t.digest == "string" && /^[0-9a-f]{64}$/.test(t.digest),
    "bounce.v1 digest must be lowercase SHA-256"
  ), le(
    Number.isInteger(t.generation) && t.generation > 0,
    "bounce.v1 generation must be positive"
  ), le(
    Number.isInteger(t.bankByteLength) && t.bankByteLength > 0,
    "bounce.v1 bankByteLength must be positive"
  ), le(
    Array.isArray(t.roots) && t.roots.length > 0 && t.roots.every((a) => Number.isInteger(a) && a >= 0 && a <= 127),
    "bounce.v1 roots are invalid"
  ), le(
    Array.isArray(t.segments) && t.segments.length === t.roots.length,
    "bounce.v1 segments must match roots"
  );
  let r = 0;
  t.segments.forEach((a, s) => {
    le(
      Fe(a) && a.rootNote === t.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), le(
    Fe(t.capture) && Number.isInteger(t.capture.sampleRate) && t.capture.sampleRate > 0 && typeof t.capture.tempoBpm == "number" && t.capture.tempoBpm > 0 && t.capture.velocity === 100 && Number.isInteger(t.capture.holdFrames) && t.capture.holdFrames > 0 && Number.isInteger(t.capture.tailCapFrames) && t.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), le(Fe(t.revertRef), "bounce.v1 revertRef is invalid");
  const i = t.revertRef.bankDigest;
  le(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = Wu(t.revertRef.patchDocument);
  return Object.freeze({
    ...Xe(t),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function Gu(e) {
  return Hu(Ma(e));
}
const Ju = L("sourceMode", { preset: !1 });
function Da(e) {
  if (e !== null && typeof e == "object") {
    for (const t of Object.values(e)) Da(t);
    Object.freeze(e);
  }
  return e;
}
const Po = /* @__PURE__ */ new WeakMap();
function Pn(e) {
  let t = Po.get(e);
  return t === void 0 && Po.set(e, t = Gu(e)), t;
}
const Yu = {
  parse(e) {
    if (e === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: Da(Ma(e)) };
    } catch (t) {
      return { kind: "error", message: t instanceof Error ? t.message : String(t) };
    }
  },
  encode: (e) => e === null ? null : Pn(e),
  equals: (e, t) => e === t || e !== null && t !== null && Pn(e) === Pn(t)
}, Qu = Je({ initial: null, codec: Yu, preset: !1 }), Xu = Object.freeze({
  ...Object.fromEntries(qt.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, L(t)]))),
  ...Object.fromEntries(gr().map((e) => [e, L(e)])),
  playMode: L("playMode"),
  glideTime: L("glideTime"),
  macro1: L("macro1"),
  macro2: L("macro2"),
  macro3: L("macro3"),
  macro4: L("macro4"),
  filterMode: L("filterMode"),
  filterCutoff: L("filterCutoff"),
  filterQ: L("filterQ"),
  mseg1Morph: L("mseg1Morph"),
  mseg2Morph: L("mseg2Morph"),
  mseg3Morph: L("mseg3Morph"),
  mseg1Rate: L("mseg1Rate"),
  mseg2Rate: L("mseg2Rate"),
  mseg3Rate: L("mseg3Rate"),
  env1Attack: L("env1Attack"),
  env1Decay: L("env1Decay"),
  env1Sustain: L("env1Sustain"),
  env1Release: L("env1Release"),
  env2Attack: L("env2Attack"),
  env2Decay: L("env2Decay"),
  env2Sustain: L("env2Sustain"),
  env2Release: L("env2Release"),
  env3Attack: L("env3Attack"),
  env3Decay: L("env3Decay"),
  env3Sustain: L("env3Sustain"),
  env3Release: L("env3Release"),
  filterMix: L("filterMix"),
  ampRelease: L("ampRelease"),
  sourceMode: Ju,
  globalTune: L("globalTune"),
  ampAttack: L("ampAttack"),
  ampDecay: L("ampDecay"),
  ampSustain: L("ampSustain"),
  filterCutoffKeyTrackEnabled: L("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: L("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: L("voiceEnhancerFrequency"),
  voiceEnhancerQ: L("voiceEnhancerQ"),
  voiceEnhancerAmount: L("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: L("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: L("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: L("polishEnhancerAmount"),
  polishCompressionClipAmount: L("polishCompressionClipAmount"),
  polishOutputTrimDb: L("polishOutputTrimDb"),
  polishSafeBassAmount: L("polishSafeBassAmount"),
  polishSafeBassBypass: L("polishSafeBassBypass"),
  polishEnhancerBypass: L("polishEnhancerBypass"),
  polishCompressionClipBypass: L("polishCompressionClipBypass"),
  polishOutputTrimBypass: L("polishOutputTrimBypass")
}), Zu = Rs({
  ...Xu,
  [qe]: Yr({ initial: Dt(), codec: od, prepare: (e) => e, engine: eu }),
  [ha]: Yr({
    initial: Cr(),
    codec: Fu,
    dependencies: gr(),
    prepare: (e, { parameters: t }) => Nu(e, t),
    engine: Uu
  }),
  [Se]: Je({ initial: gn(), codec: ju }),
  [Oa]: Qu,
  ...Fs({ factory: $u, initial: "init" }),
  ...$s()
});
function Ee(e, t) {
  if (!e)
    throw new Error(t);
}
function Fn(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function ef(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function er(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function _a(e) {
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
function tf() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function jn(e, t) {
  const n = tf();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (ef(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function Fo(e) {
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
  throw new Error(`Unsupported text resource payload (${_a(e)})`);
}
function nf(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return er(e);
  throw new Error(`Unsupported binary resource payload (${_a(e)})`);
}
function rf(e) {
  const t = e?.frames;
  Ee(
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
      Ee(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function Ca(e) {
  const t = new DataView(e);
  Ee(Fn(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), Ee(Fn(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, c = null, m = 12;
  for (; m + 8 <= t.byteLength; ) {
    const h = Fn(t, m, 4), f = t.getUint32(m + 4, !0), g = m + 8;
    h === "fmt " ? (n = t.getUint16(g, !0), r = t.getUint16(g + 2, !0), i = t.getUint32(g + 4, !0), a = t.getUint16(g + 12, !0), o = t.getUint16(g + 14, !0)) : h === "data" && (s = g, c = f), m = g + f + f % 2;
  }
  Ee(n !== null, "Wave file is missing a fmt chunk"), Ee(s !== null && c !== null, "Wave file is missing a data chunk"), Ee(r === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && o === 32)
    d = new Float32Array(e.slice(s, s + c));
  else if (n === 1 && o === 16) {
    const h = c / 2, f = new Int16Array(e.slice(s, s + c));
    d = new Float32Array(h);
    for (let g = 0; g < h; g += 1)
      d[g] = f[g] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: d
  };
}
async function jo(e) {
  Ee(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return Ee(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function tr(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function La(e) {
  const t = new Uint8Array(e).buffer, n = Ca(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function of(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => (Ee(typeof e.readResource == "function", `Resource bridge cannot read ${c}`), e.readResource(c)), i = async (c) => {
    Ee(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const m = await e.readResourceAsAudioData(c);
    return rf(m);
  }, o = (c) => {
    const m = e.getResourceAddress?.(c);
    return m ?? null;
  }, a = async (c, m = e.getResourceAddress?.(c)) => {
    const d = jn(c, m), h = await jo(d), f = Ca(h);
    return {
      sampleRate: f.sampleRate,
      samples: f.samples
    };
  }, s = async (c, m = e.getResourceAddress?.(c)) => {
    const d = jn(c, m);
    return new Uint8Array(await jo(d));
  };
  return {
    async readText(c) {
      if (t === "bridge" && typeof e.readResource == "function")
        return Fo(await r(c));
      const m = o(c);
      return t === "url" && m !== null ? tr(await s(c, m)) : typeof e.readResource == "function" ? Fo(await r(c)) : tr(await s(c, m));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof e.readResource == "function" ? nf(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(c);
      const m = o(c);
      return n === "url" && m !== null ? a(c, m) : typeof e.readResourceAsAudioData == "function" ? i(c) : La(await this.readBytes(c));
    },
    getURL(c) {
      return jn(c, e.getResourceAddress?.(c));
    }
  };
}
function af(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return of(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function sf(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return tr(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return er(await t(a));
      if (n)
        return er(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : La(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function cf(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function lf(e) {
  return cf(e) ? sf(e) : af(e);
}
const Wt = 2048;
function bt(e, t) {
  if (!e)
    throw new Error(t);
}
function df(e) {
  bt(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    bt(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), bt(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), bt(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), bt(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const uf = 2048, cn = 11, ff = 256;
function we(e, t) {
  if (!e)
    throw new Error(t);
}
function mf(e) {
  return e > 0 && (e & e - 1) === 0;
}
const zo = /* @__PURE__ */ new Map();
function pf(e) {
  const t = zo.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return zo.set(e, r), r;
}
function Na(e, t, n = !1) {
  const r = e.length;
  we(r === t.length, "FFT real and imaginary buffers must have the same length"), we(mf(r), "FFT input length must be a power of two");
  const i = pf(r);
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
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, c = Math.cos(s), m = Math.sin(s);
    for (let d = 0; d < r; d += o) {
      let h = 1, f = 0;
      for (let g = 0; g < a; g += 1) {
        const b = d + g, I = b + a, y = e[I], A = t[I], F = h * y - f * A, _ = h * A + f * y, M = e[b], D = t[b];
        e[b] = M + F, t[b] = D + _, e[I] = M - F, t[I] = D - _;
        const ee = h * c - f * m;
        f = h * m + f * c, h = ee;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Pa(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function hf(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = uf,
  maxFramesPerTable: r = ff
} = {}) {
  const i = Float32Array.from(e);
  we(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  we(o > 0, "Source wavetable files must contain at least one frame"), we(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && we(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, m = c + n;
    a.push(Pa(i.slice(c, m)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Uo(e) {
  const t = Pa(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Na(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Fa(e, t, {
  mipLevelCount: n = cn
} = {}) {
  const r = e?.real?.length ?? 0;
  we(r > 0, "Spectrum must contain real samples"), we(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), we(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = e.real[s], a[s] = e.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = e.real[c], a[c] = e.imaginary[c]);
  }
  return Na(o, a, !0), Float32Array.from(o);
}
async function Ko(e) {
  const t = [];
  for (const n of [...e].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      t.push(r);
    }
  return t;
}
async function gf(e, t) {
  const n = [];
  try {
    for (const i of t) {
      const o = await i(e);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await Ko(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await Ko(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const Gt = 256, It = 2048, ja = 8, yf = 12811, nr = (ja + Gt * yf) * 4;
function $o(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function vf(e, t, n) {
  if (e.byteLength !== nr || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Gt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    cn,
    Gt
  ]);
  let i = ja;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let m = 0; m < cn; ++m) {
    const d = Math.min(It, Math.max(256, (1 << m) * 32)), h = It / d;
    for (let f = 0; f < t.frameCount; ++f) {
      const g = Fa(n(f), m), b = i + f * (d + 1);
      for (let I = 0; I <= d; ++I) {
        const y = (I === d ? 0 : I) * h, A = (y + It - h) % It, F = (y + h) % It, _ = g[y], M = g[A], D = g[F];
        if (_ === void 0 || M === void 0 || D === void 0 || !Number.isFinite(_) || !Number.isFinite(M) || !Number.isFinite(D))
          throw new Error("Wavetable preparation produced invalid samples.");
        const ee = Math.fround(0.5 * Math.fround(D - M));
        r[b + I] = $o(_, s, o) & 262143 | $o(ee, c, a) << 18;
      }
    }
    i += (d + 1) * Gt;
  }
}
const bf = "runtimeSyncRequest", If = 2147483647, Sf = "runtimeState", kf = "retryDesiredTableRequest", Af = "workerLoadFailure", Tf = "serviceLoadAbort", Ef = "wavetableLoadBegin", Of = "wavetableMipFrame", xf = "wavetableUploadAck", Rf = "wavetableMipRequest", wf = "wavetablePrewarmRequest", Mf = "wavetablePrewarmNotification", Df = "assets/factory-bank-catalog.json", rr = 3, _f = 1, Cf = rr * Wt, Lf = 1, Nf = 2, Pf = 3, Ff = 1, jf = 2, zf = 2e4, $t = Lf, Vo = Nf, Bo = Pf, Pe = Ff, Ho = jf, Uf = 48 * 1024 * 1024, zn = 3;
function qo(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function se(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function Wo(e) {
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
function Go(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function Jo(e, t) {
  if (!e)
    throw new Error(t);
}
function Kf(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function $f(e, t) {
  return df(await e.readJSON(t));
}
function Vf(e) {
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
function Bf(e, t) {
  const n = Math.round(Number(e) || 0);
  return Kf(n, 0, Math.max(0, t - 1));
}
function Un(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Hf(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Yo(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function Qo(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Vt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function qf(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class Wf {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = lf(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? Df, this.maxBatchesInFlight = qo(
      n.maxFramesInFlight,
      _f
    ), this.mipLevelCount = n.mipLevelCount ?? cn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Uf) || 0)), this.serviceLoadTimeoutMs = qo(n.serviceLoadTimeoutMs, zf), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, se("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Sf, this.handleRuntimeState), this.connection.addEndpointListener?.(xf, this.handleUploadAck), this.connection.addEndpointListener?.(Rf, this.handleMipRequest), this.connection.addEndpointListener?.(wf, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Mf, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      bf,
      If
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await $f(this.resourceClient, this.catalogPath), se("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < zn; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Yo(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Yo(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Un(
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
          ...Qo(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (se("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Bo,
          failureReasonCode: Ho
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== Bo || t.failureReasonCode !== Ho ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = $t,
    failureReasonCode: s = Pe
  }) {
    this.connection.sendEventOrValue?.(Af, {
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
    failureReasonCode: o = Pe
  }) {
    this.connection.sendEventOrValue?.(Tf, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    se("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? Wo(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(kf, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = Bf(t, r.tables.length), o = r.tables[i];
    Jo(o, `Could not resolve table ${i}`);
    const a = Hf(o, Wt, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, se("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = Vt();
    se("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const m = await this.resourceClient.readAudio(o.sourceWav), d = hf(m.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Wt
    });
    return se("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(Vt() - c)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: d.frameCount,
      frames: d.frames,
      spectra: new Array(d.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, r) {
    if (se("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(Ef, {
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
    const n = Vt();
    try {
      if (await zd(this.connection, {
        input: t.oscillatorIndex,
        byteLength: nr
      }, (r) => {
        vf(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      se("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: nr,
        preparationMs: Vt() - n,
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
        failurePhase: Vo,
        failureReasonCode: Pe
      }), this.serviceTable = null, this.clearMipTransferState(), se("error", "Shared wavetable preparation failed", { detail: At(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    se("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: $t,
      failureReasonCode: Pe
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: $t,
      failureReasonCode: Pe
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = $t,
    failureReasonCode: r = Pe
  } = {}) {
    se("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (se("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: At(o)
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
      this.isCurrentRuntimeState(t) && (se("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: At(a)
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
    for (let t = 0; t < zn; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, qf(() => {
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
        se("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: Pe
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
    const n = Vf(t ?? {});
    if (se("info", "Received runtime state", Wo(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= zn)
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
          i.spectra[a] || (i.spectra[a] = Uo(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), se("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        se("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: At(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), s = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = Un(
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
      ...Qo(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, m), m);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (se("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), m = Math.trunc(Number(n.frameCount)), d = Un(
      r,
      i,
      o,
      a,
      s
    ), h = this.mipJobs.get(d), f = this.serviceTable?.frameCount ?? 0, g = Math.min(
      rr,
      f - c
    );
    if (!(!h || h.completed || !h.inFlightBatchBases.has(c) || m <= 0 || m !== g)) {
      h.inFlightBatchBases.delete(c);
      for (let b = 0; b < m; b += 1) {
        const I = c + b;
        h.ackedFrames[I] || (h.ackedFrames[I] = 1, h.ackedFrameCount += 1);
      }
      h.ackedFrameCount === f && h.nextFrameIndex >= f && h.inFlightBatchBases.size === 0 && (h.completed = !0, this.activeUploadKey === h.key && (this.activeUploadKey = null)), Go(c, m, f) && se("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: h.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: m,
        ackedFrameCount: h.ackedFrameCount,
        frameCount: f,
        inFlightBatches: h.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (Jo(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = Uo(this.serviceTable.frames[t]);
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
        rr,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Cf);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Fa(s, t.mipIndex);
          i.set(c, o * Wt);
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
            failurePhase: Vo,
            failureReasonCode: Pe
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Of, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Go(n, r, this.serviceTable.frameCount) && se("info", "Sent wavetable mip batch", {
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
function At(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Gf(e, t = {}) {
  return new Wf(e, t);
}
async function Jf(e, t = {}) {
  return gf(e, [
    () => Gf(e, { ...t, delivery: "shared" }),
    () => Cs(Zu, e, {
      onDefect: (n) => console.error("Cosimo state failed", At(n))
    })
  ]);
}
export {
  _f as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Nf as FAILURE_PHASE_BUILD_MIP,
  Lf as FAILURE_PHASE_LOAD_SOURCE,
  Pf as FAILURE_PHASE_TRANSFER_MIP,
  Ff as FAILURE_REASON_GENERIC,
  jf as FAILURE_REASON_TIMEOUT,
  rr as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  If as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Wf as WavetableWorkerController,
  Gf as createWavetableWorkerController,
  Jf as default
};
