function we(e) {
  throw new Error(e);
}
function gn(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function Lr(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Ca(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Nr(e, t) {
  return typeof t == "string" ? Ca(t) : t instanceof ArrayBuffer ? new Uint8Array(t.slice(0)) : ArrayBuffer.isView(t) ? new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength)) : Array.isArray(t) ? Uint8Array.from(t) : we(`The host returned ${e} in a form this kit cannot read.`);
}
function Pr(e, t) {
  const n = new DataView(t);
  (n.byteLength < 12 || gn(n, 0, 4) !== "RIFF" || gn(n, 8, 4) !== "WAVE") && we(`${e} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, c = 0;
  for (let d = 12; d + 8 <= n.byteLength; ) {
    const h = gn(n, d, 4), f = n.getUint32(d + 4, !0), g = d + 8;
    h === "fmt " ? (r = n.getUint16(g, !0), i = n.getUint16(g + 2, !0), o = n.getUint32(g + 4, !0), a = n.getUint16(g + 14, !0)) : h === "data" && (s = g, c = Math.min(f, n.byteLength - g)), d = g + f + f % 2;
  }
  (s < 0 || r === 0) && we(`${e} is missing its WAV format or data chunk.`), i !== 1 && we(`${e} has ${i} channels; readAudio reads mono WAV files only.`);
  const m = t.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(m, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const d = new Int16Array(m, 0, Math.floor(c / 2));
    return { sampleRate: o, samples: Float32Array.from(d, (h) => h / 32768) };
  }
  return we(`${e} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function La(e, t) {
  const n = t ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && we(`The host decoded ${e} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : we(`${e} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function jr() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0) return new URL("/", e);
  const t = new URL(import.meta.url);
  return t.pathname = t.pathname.replace(/\/[^/]*$/, "/"), t;
}
function Fr(e, t) {
  return t instanceof URL ? t : typeof t == "string" && t.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t) ? new URL(t) : new URL(t.replace(/^\//, ""), jr()) : new URL(e, jr());
}
function Na(e) {
  const t = e ?? {}, n = async (i) => {
    typeof fetch != "function" && we(`Cannot read ${i}: this host has neither a resource bridge nor fetch.`);
    const o = Fr(i, t.getResourceAddress?.(i)), a = await fetch(o.toString());
    return a.ok || we(`Could not read ${i} from ${o} (HTTP ${a.status}).`), a.arrayBuffer();
  }, r = async (i) => t.readResource ? Nr(i, await t.readResource(i)) : new Uint8Array(await n(i));
  return {
    async readText(i) {
      if (!t.readResource) return Lr(new Uint8Array(await n(i)));
      const o = await t.readResource(i);
      return typeof o == "string" ? o : typeof o == "object" && o !== null && "text" in o && typeof o.text == "function" ? String(await o.text()) : Lr(Nr(i, o));
    },
    async readJSON(i) {
      return JSON.parse(await this.readText(i));
    },
    readBytes: r,
    async readAudio(i) {
      const o = t.getResourceAddress?.(i);
      return o != null && typeof fetch == "function" ? Pr(i, await n(i)) : t.readResourceAsAudioData ? La(i, await t.readResourceAsAudioData(i)) : Pr(i, new Uint8Array(await r(i)).buffer);
    },
    getURL(i) {
      return Fr(i, t.getResourceAddress?.(i));
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
function Ur(e, t) {
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
    const g = await Ur(e.prepare(m, f), f);
    if (g.kind === "cancelled" || f.aborted) return;
    const S = g.value;
    if (S.kind === "error") {
      e.onStatus(d, { kind: "failed", error: S.error });
      return;
    }
    let b = !0;
    h.applying = !0;
    let v;
    try {
      v = await Ur(e.transport.apply(S.value, {
        signal: f,
        send: (A) => f.aborted || !b ? { kind: "cancelled" } : A()
      }), f);
    } catch (A) {
      f.aborted || (t = !0, i?.cancel(), r(), e.onDefect(A), e.onStatus(d, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      b = !1, h.applying = !1;
    }
    v.kind === "value" && !f.aborted && v.value.kind !== "cancelled" && e.onStatus(d, v.value);
  }
  function c(m, d) {
    o = void 0;
    const h = i, f = { ...St(), applying: !1, target: d };
    if (i = f, h?.cancel(), t || f.signal.aborted) return;
    const g = s(m, d, f).catch((S) => {
      f.signal.aborted || (f.cancel(), e.onDefect(S), e.onStatus(d, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    a.add(g), g.then(() => {
      if (a.delete(g), i !== f) return;
      i = void 0;
      const S = o;
      o = void 0, !t && S && c(S.input, S.target);
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
let Pa = 0;
function zr(e, t) {
  const n = `atom${++Pa}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = ja, r.write = Fa), r;
}
function ja(e) {
  return e(this);
}
function Fa(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Jo = "a", Ue = "m", cn = "i", Ze = "c", rr = "q", or = "Q", ze = "h", Yo = "R", Qo = "W", Xo = "I", Zo = "M", Me = "e", ft = "f", et = "C", mt = "r", ir = "d", ln = "w", dn = "D", un = "t", fn = "T", ar = "v", Kr = "g", $r = "s", Vr = "b", Ua = "B", sr = "p", ei = "H", ti = "A", cr = "E";
function ni(e) {
  return "init" in e;
}
function za(e) {
  return typeof e.write == "function";
}
function Ka(e) {
  return !!e.onMount;
}
function Br(e) {
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
function $a(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function ri(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function oi(e, t, n) {
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
function Va(e) {
  return !!e.INTERNAL_onInit;
}
const Ba = (e, t, n, ...r) => n.read(...r), Ha = (e, t, n, ...r) => n.write(...r), qa = (e, t, n) => n.INTERNAL_onInit(t), Wa = (e, t, n, r) => n.onMount?.(r), Ga = (e, t, n) => {
  const r = e[Jo];
  let i = r.get(n);
  if (!i) {
    const o = e[ze], a = e[Xo];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), Va(n) && a(e, t, n);
  }
  return i;
}, Ja = (e, t) => {
  const n = e[Ue], r = e[Ze], i = e[rr], o = e[or], a = e[ze], s = e[et];
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
}, Ya = (e, t) => {
  const n = e[Ue], r = e[cn], i = e[Ze], o = e[Me], a = e[mt], s = e[dn];
  if (!i.size)
    return;
  const c = [], m = [], d = /* @__PURE__ */ new WeakSet(), h = /* @__PURE__ */ new WeakSet(), f = [], g = [];
  for (const S of i)
    f.push(S), g.push(o(e, t, S));
  for (; f.length; ) {
    const S = f.length - 1, b = f[S], v = g[S];
    if (h.has(b)) {
      f.pop(), g.pop();
      continue;
    }
    if (d.has(b)) {
      r.get(b) === v.n && (c.push(b), m.push(v)), h.add(b), f.pop(), g.pop();
      continue;
    }
    d.add(b);
    for (const A of oi(b, v, n))
      d.has(A) || (f.push(A), g.push(o(e, t, A)));
  }
  for (let S = c.length - 1; S >= 0; --S) {
    const b = c[S], v = m[S];
    let A = !1;
    for (const j of v.d.keys())
      if (j !== b && i.has(j)) {
        A = !0;
        break;
      }
    A && (r.set(b, v.n), a(e, t, b), s(e, t, b)), r.delete(b);
  }
};
const Qa = (e, t, n) => {
  const r = e[Ue], i = e[cn], o = e[Ze], a = e[ze], s = e[Yo], c = e[Me], m = e[ft], d = e[et], h = e[mt], f = e[dn], g = e[ar], S = e[ei], b = e[cr], v = c(e, t, n), A = b[0];
  if (Br(v)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== v.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      v.m === A
    )
      return v.m = A, v;
    let N = !1;
    for (const [w, E] of v.d)
      if (h(e, t, w).n !== E) {
        N = !0;
        break;
      }
    if (!N)
      return v.m = A, v;
  }
  let j = !0;
  const _ = new Set(v.d.keys()), M = () => {
    for (const N of _)
      v.d.delete(N);
  }, D = () => {
    if (r.has(n)) {
      const N = !o.size;
      f(e, t, n), N && (d(e, t), m(e, t));
    }
  }, Z = (N) => {
    if (N === n) {
      const E = c(e, t, N);
      if (!Br(E))
        if (ni(N))
          g(e, t, N, N.init);
        else
          throw new Error("no atom init");
      return Jt(E);
    }
    const w = h(e, t, N);
    try {
      return Jt(w);
    } finally {
      _.delete(N), v.d.set(N, w.n), Yt(v.v) && ri(n, v.v, w), r.has(n) && r.get(N)?.t.add(n), j || D();
    }
  };
  let Y;
  const pe = {
    get signal() {
      return Y || (Y = new AbortController()), Y.signal;
    }
  }, ee = v.n, ge = i.get(n) === ee;
  try {
    const N = s(e, t, n, Z, pe);
    if (g(e, t, n, N), Yt(N)) {
      S(e, t, N, () => Y?.abort());
      const w = () => {
        M(), D();
      };
      N.then(w, w);
    } else
      M();
    return a.r?.(n), v.m = A, v;
  } catch (N) {
    if ($a(N))
      throw N;
    return delete v.v, v.e = N, ++v.n, v.m = A, v;
  } finally {
    j = !1, v.n !== ee && ge && (i.set(n, v.n), o.add(n), a.c?.(n));
  }
}, Xa = (e, t, n) => {
  const r = e[Ue], i = e[cn], o = e[Me], a = [n];
  for (; a.length; ) {
    const s = a.pop(), c = o(e, t, s);
    for (const m of oi(s, c, r)) {
      const d = o(e, t, m);
      i.get(m) !== d.n && (i.set(m, d.n), a.push(m));
    }
  }
}, Za = (e, t, n, r) => {
  const i = e[Ze], o = e[ze], a = e[Qo], s = e[Me], c = e[ft], m = e[et], d = e[mt], h = e[ir], f = e[ln], g = e[dn], S = e[ar], b = e[cr];
  let v = !0;
  const A = (_) => Jt(d(e, t, _)), j = (_, ...M) => {
    const D = s(e, t, _);
    try {
      if (_ === n) {
        if (!ni(_))
          throw new Error("atom not writable");
        const Z = D.n, Y = M[0];
        S(e, t, _, Y), g(e, t, _), Z !== D.n && (++b[0], i.add(_), h(e, t, _), o.c?.(_));
        return;
      } else
        return f(e, t, _, M);
    } finally {
      v || (m(e, t), c(e, t));
    }
  };
  try {
    return a(e, t, n, A, j, ...r);
  } finally {
    v = !1;
  }
}, es = (e, t, n) => {
  const r = e[Ue], i = e[Ze], o = e[ze], a = e[Me], s = e[ir], c = e[un], m = e[fn], d = a(e, t, n), h = r.get(n);
  if (h && d.d.size > 0) {
    for (const [f, g] of d.d)
      if (!h.d.has(f)) {
        const S = a(e, t, f);
        c(e, t, f).t.add(n), h.d.add(f), g !== S.n && (i.add(f), s(e, t, f), o.c?.(f));
      }
    for (const f of h.d)
      d.d.has(f) || (h.d.delete(f), m(e, t, f)?.t.delete(n));
  }
}, ts = (e, t, n) => {
  const r = e[Ue], i = e[rr], o = e[ze], a = e[Zo], s = e[Me], c = e[ft], m = e[et], d = e[mt], h = e[ln], f = e[un], g = s(e, t, n);
  let S = r.get(n);
  if (!S) {
    d(e, t, n);
    for (const b of g.d.keys())
      f(e, t, b).t.add(n);
    if (S = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(g.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, S), za(n) && Ka(n)) {
      const b = () => {
        let v = !0;
        const A = (...j) => {
          try {
            return h(e, t, n, j);
          } finally {
            v || (m(e, t), c(e, t));
          }
        };
        try {
          const j = a(e, t, n, A);
          j && (S.u = () => {
            v = !0;
            try {
              j();
            } finally {
              v = !1;
            }
          });
        } finally {
          v = !1;
        }
      };
      i.add(b);
    }
    o.m?.(n);
  }
  return S;
}, ns = (e, t, n) => {
  const r = e[Ue], i = e[or], o = e[ze], a = e[Me], s = e[fn], c = a(e, t, n);
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
}, rs = (e, t, n, r) => {
  const i = e[Me], o = e[ti], a = i(e, t, n), s = "v" in a, c = a.v;
  if (Yt(r))
    for (const m of a.d.keys())
      ri(n, r, i(e, t, m));
  a.v = r, delete a.e, (!s || !Object.is(c, a.v)) && (++a.n, Yt(c) && o(e, t, c));
}, os = (e, t, n) => {
  const r = e[mt];
  return Jt(r(e, t, n));
}, is = (e, t, n, ...r) => {
  const i = e[Ze], o = e[ft], a = e[et], s = e[ln], c = i.size;
  try {
    return s(e, t, n, r);
  } finally {
    i.size !== c && (a(e, t), o(e, t));
  }
}, as = (e, t, n, r) => {
  const i = e[ft], o = e[et], a = e[un], s = e[fn], m = a(e, t, n).l;
  return m.add(r), o(e, t), i(e, t), () => {
    m.delete(r), s(e, t, n), o(e, t), i(e, t);
  };
}, ss = (e, t, n, r) => {
  const i = e[sr];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, cs = (e, t, n) => {
  e[sr].get(n)?.forEach((o) => o());
}, ls = /* @__PURE__ */ new WeakMap();
function ds(e) {
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
    [Jo]: /* @__PURE__ */ new WeakMap(),
    [Ue]: /* @__PURE__ */ new WeakMap(),
    [cn]: /* @__PURE__ */ new WeakMap(),
    [Ze]: /* @__PURE__ */ new Set(),
    [rr]: /* @__PURE__ */ new Set(),
    [or]: /* @__PURE__ */ new Set(),
    [ze]: {},
    // atom interceptors
    [Yo]: Ba,
    [Qo]: Ha,
    [Xo]: qa,
    [Zo]: Wa,
    // building-block functions
    [Me]: Ga,
    [ft]: Ja,
    [et]: Ya,
    [mt]: Qa,
    [ir]: Xa,
    [ln]: Za,
    [dn]: es,
    [un]: ts,
    [fn]: ns,
    [ar]: rs,
    // store api
    [Kr]: os,
    [$r]: is,
    [Vr]: as,
    [Ua]: void 0,
    // abortable promise support
    [sr]: /* @__PURE__ */ new WeakMap(),
    [ei]: ss,
    [ti]: cs,
    // store epoch
    [cr]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  ls.set(t, r);
  const i = r[Kr], o = r[$r], a = r[Vr];
  return t;
}
function us() {
  return ds();
}
const fs = /* @__PURE__ */ new Set(["closed", "open-failed", "opened", "replaced", "parameter", "attached-client", "detach", "command", "published"]);
function le(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function ii(e, t = 1 / 0) {
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
function ai() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= ii(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Un(e) {
  const t = ai(), n = (r, i) => {
    if (!t.node(i)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const o of r) if (!n(o, i + 1)) return !1;
      return !0;
    }
    if (!le(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function oe(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function Ae(e) {
  return typeof e == "string" && e.length > 0 && ii(e) <= 256;
}
function lr(e) {
  return le(e) && Ae(e.owner) && oe(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function ms(e) {
  if (!le(e) || !oe(e.id)) return;
  const t = lr(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function ps(e) {
  const t = lr(e);
  return t && le(e) && oe(e.client) && oe(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function Hr(e) {
  if (!le(e) || !Array.isArray(e.parameters) || !le(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!le(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c } = n;
    if (!Ae(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function hs(e) {
  if (le(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = ms(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (e.kind === "edit-many") {
      if (!Array.isArray(e.edits) || e.edits.length === 0 || e.history !== void 0 && e.history !== !1 || e.recall !== void 0 && e.recall !== !0 || e.gesture !== void 0 && (!oe(e.gesture) || e.history === !1 || e.recall === !0)) return;
      const t = [], n = /* @__PURE__ */ new Set();
      for (const r of e.edits) {
        if (!le(r) || !Ae(r.key) || n.has(r.key) || !Object.hasOwn(r, "value") || Object.hasOwn(r, "gesture") || r.expectedVersion !== void 0 && !oe(r.expectedVersion, !1)) return;
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
      if (!oe(e.gesture) || e.label !== void 0 && typeof e.label != "string" || !Array.isArray(e.keys) || e.keys.length === 0 || !e.keys.every(Ae) || new Set(e.keys).size !== e.keys.length) return;
      const t = Object.freeze([...e.keys]);
      return e.kind === "end" ? { kind: "end", keys: t, gesture: e.gesture } : { kind: "begin", keys: t, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
    }
    if (Ae(e.key)) {
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
function gs(e) {
  if (!Un(e) || !le(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (typeof e.kind == "string" && !fs.has(e.kind)) return { kind: "unknown", messageKind: e.kind };
  if (e.kind === "open-failed" && oe(e.request) && Ae(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && Ae(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = lr(e.scope);
  if (e.kind === "opened" && t && oe(e.request)) {
    const n = Hr(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = Hr(e.native);
    if (n && (e.changedStoredKey === void 0 || Ae(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && Ae(e.endpoint) && typeof e.value == "number" && oe(e.intent, !1) && oe(e.observation, !1) && (e.origin === "owner" || e.origin === "external"))
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
    const n = ps(e.address);
    if (n) {
      const r = hs(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && oe(e.request) && le(e.result)) {
    const n = [];
    if (e.observations !== void 0) {
      if (!Array.isArray(e.observations)) return { kind: "invalid", message: "Invalid publication observation barrier." };
      const r = /* @__PURE__ */ new Set();
      for (const i of e.observations) {
        if (!le(i) || !Ae(i.endpoint) || !oe(i.observation, !1) || r.has(i.endpoint))
          return { kind: "invalid", message: "Invalid publication observation barrier." };
        r.add(i.endpoint), n.push({ endpoint: i.endpoint, observation: i.observation });
      }
    }
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && Ae(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason },
      ...e.observations === void 0 ? {} : { observations: n }
    } };
  }
  return { kind: "invalid", message: `Malformed "${String(e.kind)}" state-channel message.` };
}
function qr(e, t, n) {
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
function Wr(e) {
  const t = ai(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
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
          if (!le(o)) return;
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
const vs = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function ys(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !vs.has(e);
}
function Bt(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function bs(e) {
  return `The codec for "${e}" threw instead of returning { kind: "error" }; the edit was rejected.`;
}
const si = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), ci = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
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
function Gr(e) {
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
const li = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Is(e) {
  return e[li] ?? {};
}
function di(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function kt(e) {
  return e.kind === "stored" && (e.lifetime ?? "project") === "project";
}
function Ss(e) {
  return Object.keys(e).filter((t) => e[t]?.preset !== !1);
}
function ks(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = di(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !ys(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(e)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(e)) o.kind === "stored" && o[si]?.(e);
  const i = { ...e };
  for (const [o, a] of Object.entries(e)) {
    const s = a.kind === "stored" ? a[ci] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(e) }));
  }
  return Object.freeze(Object.defineProperty(i, li, { value: Object.freeze({ ...t }) }));
}
const Oe = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function Jr(e, t = {}) {
  const n = /* @__PURE__ */ new Map();
  let r = !1;
  function i(o) {
    if (!le(o) || typeof o.id != "number" || !le(o.scope)) return;
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
      } else o.kind === "failed" && a.finish(o.reason === "cancelled" || o.reason === "superseded" || o.reason === "stale-scope" ? { kind: "cancelled" } : Oe("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", i), {
    async prepare(o, a, s, c) {
      if (r || s.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(o.byteLength) || o.byteLength <= 0 || o.byteLength % 4 !== 0 || o.byteLength > 2147483647)
        return Oe("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const m = e.sharedData;
      if (!m) return Oe("This host does not support shared-data preparation.");
      let d;
      try {
        d = m.reserve(o.input, o.byteLength);
      } catch {
        return Oe("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let h = !1;
      try {
        if (d.byteLength !== o.byteLength) return Oe("The host supplied a differently sized shared allocation.");
        const f = c(d);
        if (f?.kind === "failed") return f;
        if (Bt(f)) return { kind: "failed", error: f.error };
        if (s.aborted || r) return { kind: "cancelled" };
        const g = new Promise((S) => {
          let b = () => {
          }, v;
          const A = (j) => {
            if (n.delete(d.id)) {
              if (clearTimeout(v), b(), j.kind !== "acknowledged")
                try {
                  m.cancel(d.id);
                } catch {
                  j = Oe("Cancellation of the shared resource could not be confirmed.");
                }
              S(j);
            }
          };
          n.set(d.id, { input: o.input, target: a, submitted: null, early: null, finish: A }), b = s.onAbort(() => A({ kind: "cancelled" })), n.has(d.id) && (v = setTimeout(() => A(Oe("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(d.id)) return g;
        try {
          const S = await Promise.race([
            Promise.resolve(m.commit(d.id)).then((A) => ({ kind: "submitted", receipt: A })),
            g.then((A) => ({ kind: "finished", outcome: A }))
          ]);
          if (S.kind === "finished") return S.outcome;
          const b = S.receipt;
          h = !0;
          const v = n.get(d.id);
          v && (!le(b) || b.kind !== "submitted" || b.id !== d.id || b.input !== o.input || b.generation !== d.id || typeof b.serial != "number" || !Number.isSafeInteger(b.serial) || b.serial <= 0 ? v.finish(Oe("The host returned an invalid shared-resource submission receipt.")) : (v.submitted = { generation: b.generation, serial: b.serial }, v.early && i(v.early)));
        } catch {
          n.get(d.id)?.finish(s.aborted ? { kind: "cancelled" } : Oe("The shared resource could not be submitted."));
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
class dr {
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
    const r = new dr({ limit: this.#o, compare: this.#d });
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
function jt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function Yr(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function De(e, t, n = 0, r, i, o, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
class ui extends Error {
  constructor(t, n) {
    super(bs(t), { cause: n });
  }
}
function vt(e, t) {
  try {
    return t();
  } catch (n) {
    throw new ui(e, n);
  }
}
function As(e, t) {
  const n = us(), r = {};
  for (const u of Object.keys(e)) r[u] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = zr({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new dr({ limit: t.historyLimit, compare: (u, l) => u.order - l.order }),
    gestures: [],
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map(),
    parameterIntents: /* @__PURE__ */ new Map(),
    parameterAppliedIntents: /* @__PURE__ */ new Map(),
    parameterObservations: /* @__PURE__ */ new Map()
  }), o = zr((u) => u(i).snapshot);
  let a = !1, s, c = 0, m = !1, d, h = [];
  const f = [], g = () => n.get(o), S = (u) => e[u]?.history !== !1, b = (u) => u.gestures.some((l) => l.keys.some(S)), v = (u, l) => u.gestures.find((p) => p.keys.includes(l)), A = (u, l, p) => p ? u.gestures.map((I) => I === l ? p : I) : u.gestures.filter((I) => I !== l), j = (u, l) => {
    const p = l.keys.filter(S).flatMap((I) => {
      const y = l.before.get(I), k = l.after.get(I);
      return N(I, y, k) ? [] : [{ key: I, before: y, after: k }];
    });
    return p.length ? u.record({ changes: p, order: l.order }) : u;
  }, _ = (u, l, p, I) => p === void 0 || p === I || u !== void 0 && p >= (u.guardFloorVersions.get(l) ?? I) && p <= I, M = (u, l, p = u.history) => {
    const I = p.undoEntry, y = p.redoEntry;
    return {
      ...u,
      history: p,
      snapshot: Object.freeze({
        ...u.snapshot,
        revision: u.snapshot.revision + 1,
        fields: Object.freeze(l),
        history: Object.freeze({
          canUndo: !a && !b(u) && I !== void 0 && I.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          canRedo: !a && !b(u) && y !== void 0 && y.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          ...u.snapshot.scope && I ? { undoEntry: jt(u.snapshot.scope, I) } : {},
          ...u.snapshot.scope && y ? { redoEntry: jt(u.snapshot.scope, y) } : {}
        })
      })
    };
  }, D = (u, l, p) => {
    if (l === p) return !1;
    const I = l && "value" in l ? l : void 0, y = p && "value" in p ? p : void 0;
    return I && y ? !Object.is(I.value, y.value) && !N(u, I.value, y.value) : I !== y;
  }, Z = /* @__PURE__ */ new Map(), Y = (u, l, p = "edit") => {
    const I = n.get(i);
    if (u.snapshot === I.snapshot) {
      n.set(i, u);
      return;
    }
    const y = u.snapshot.scope, k = y !== null && (!I.snapshot.scope || !Ke(y, I.snapshot.scope)), R = Object.keys(e).filter((F) => D(F, I.snapshot.fields[F], u.snapshot.fields[F])), U = R.length ? Object.freeze({ reason: k ? "load" : p, keys: Object.freeze(R), revision: u.snapshot.revision }) : u.snapshot.lastChange, V = { ...u.snapshot.fields };
    if (y) for (const F of t.bindings ?? []) {
      const $ = V[F.key];
      if (!$) continue;
      const Q = I.snapshot.fields[F.key];
      if (!(k || F.key === l || !Q || Q.readiness.kind !== $.readiness.kind || "value" in $ && (!("value" in Q) || !Object.is($.value, Q.value)) || F.dependencies.some((T) => {
        const C = I.snapshot.fields[T], K = V[T];
        return C !== K && (!C || !K || !("value" in C) || !("value" in K) || !Object.is(C.value, K.value));
      }))) {
        const T = $.application ?? Q?.application, C = Q?.target ?? $.target;
        V[F.key] = $.application === T && $.target === C ? $ : Object.freeze({ ...$, ...T ? { application: T } : {}, ...C ? { target: C } : {} });
        continue;
      }
      const q = Object.freeze({ scope: y, key: F.key, generation: k ? 0 : (Q?.target?.generation ?? -1) + 1 }), W = {};
      let x = "value" in $ && $.readiness.kind === "ready";
      for (const T of F.dependencies) {
        const C = V[T];
        e[T]?.kind !== "parameter" || !C || !("value" in C) || C.readiness.kind !== "ready" || typeof C.value != "number" ? x = !1 : W[T] = C.value;
      }
      if (V[F.key] = Object.freeze({ ...$, target: q, application: Object.freeze({ kind: x ? "pending" : "waiting-for-inputs" }) }), x && "value" in $) {
        const T = k ? "load" : F.key === l ? Z.get(F.key) ?? "edit" : p;
        Z.set(F.key, T);
        const C = Object.freeze({ value: $.value, parameters: Object.freeze(W), reason: T });
        h.push(() => F.replace(C, q));
      } else h.push(() => F.cancel());
    }
    n.set(i, { ...u, snapshot: Object.freeze({ ...u.snapshot, fields: Object.freeze(V), ...U ? { lastChange: U } : {} }) });
  }, pe = (u, l, p, I) => {
    if (!u.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
    const y = { ...u.snapshot.fields }, k = new Map(u.publications), R = new Map(u.parameterIntents), U = [];
    for (const { key: P, value: q } of l) {
      const W = e[P], x = y[P];
      if (!W || !x) return { kind: "rejected", reason: "not-ready" };
      const T = "value" in x ? x : void 0;
      if (!T && I !== "recover") return { kind: "rejected", reason: "not-ready" };
      if (I === "history" && x.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      let C;
      if (W.kind === "parameter") {
        if (typeof q != "number") return { kind: "rejected", reason: "invalid-value" };
        C = v(u, P) ? [{ kind: "parameter", endpoint: W.endpoint, value: q }] : [
          { kind: "gesture-start", endpoint: W.endpoint },
          { kind: "parameter", endpoint: W.endpoint, value: q },
          { kind: "gesture-end", endpoint: W.endpoint }
        ];
      } else C = kt(W) ? [{ kind: "stored", key: P, value: vt(P, () => W.codec.encode(q)) }] : [];
      const K = (T?.version ?? 0) + 1;
      if (C.length) {
        const te = ++c;
        k.set(te, { key: P, version: K }), W.kind === "parameter" && R.set(P, te), U.push({ request: te, scope: u.snapshot.scope, operations: C });
      }
      y[P] = De(q, { kind: W.kind === "parameter" ? "host-managed" : kt(W) ? "pending" : "not-written" }, K, T?.metadata, T?.gesture, W.kind === "parameter" ? { kind: "pending" } : void 0);
    }
    const V = M(u, y, p), F = l[0], $ = l.length === 1 && F ? y[F.key] : void 0, Q = {
      kind: "accepted",
      revision: V.snapshot.revision,
      ...$ && "version" in $ ? { version: $.version } : {},
      ...I !== "history" ? { changed: !0 } : {},
      ...(I === "edit" || I === "recall") && p.undoEntry && p.undoEntry !== u.history.undoEntry ? { historyEntry: jt(u.snapshot.scope, p.undoEntry) } : {}
    };
    d = Q, Y({ ...V, publications: k, parameterIntents: R }, void 0, I === "recover" ? "edit" : I);
    for (const P of U)
      a || t.native.publish(P);
    return Q;
  }, ee = (u, l, p, I, y) => pe(u, [{ key: l, value: p }], I, y), ge = (u, l, p) => {
    const I = e[l];
    if (!I) return { kind: "error" };
    if (I.kind === "stored") return vt(l, () => I.codec.parse(p));
    const y = u.parameters.get(l);
    if (!y || typeof p != "number" || !Number.isFinite(p)) return { kind: "error" };
    const k = Math.min(y.max, Math.max(y.min, p));
    return { kind: "ok", value: y.step > 0 ? Math.min(y.max, Math.max(y.min, y.min + Math.round((k - y.min) / y.step) * y.step)) : k };
  };
  function N(u, l, p) {
    const I = e[u];
    return I?.kind === "stored" ? vt(u, () => I.codec.equals(l, p)) : Object.is(l, p);
  }
  const w = (u) => {
    const l = n.get(i);
    if (u.kind === "opened" || u.kind === "replaced") {
      if (l.snapshot.scope && (u.kind === "opened" || u.scope.owner !== l.snapshot.scope.owner || u.scope.document <= l.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const p = {}, I = /* @__PURE__ */ new Map();
      for (const [k, R] of Object.entries(e))
        if (R.kind === "parameter") {
          const U = u.native.parameters.find((V) => V.endpoint === R.endpoint);
          if (U && Yr(U)) {
            I.set(k, Object.freeze({ ...U }));
            const { min: V, max: F, step: $, defaultValue: Q } = U;
            p[k] = De(U.value, { kind: "host-managed" }, 0, Object.freeze({ min: V, max: F, step: $, defaultValue: Q }), void 0, { kind: "unconfirmed" });
          } else p[k] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: U ? "invalid-state" : "missing-parameter" }) });
        } else {
          const U = l.snapshot.fields[k];
          if (!kt(R) && u.kind === "replaced" && U && "value" in U) {
            p[k] = De(U.value, { kind: "not-written" }, U.version);
            continue;
          }
          const V = kt(R) && Object.hasOwn(u.native.values, k), F = V ? R.codec.parse(u.native.values[k]) : R.initial;
          if (F.kind === "ok") p[k] = De(F.value, { kind: V ? "observed-in-native-state" : "not-written" });
          else {
            const $ = l.snapshot.fields[k], Q = u.kind === "replaced" && u.changedStoredKey !== void 0 && $ && "value" in $;
            p[k] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...Q ? { value: $.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const y = M(l, p, l.history.clear());
      Y({ ...y, gestures: [], detached: /* @__PURE__ */ new Set(), publications: /* @__PURE__ */ new Map(), parameterIntents: /* @__PURE__ */ new Map(), parameterAppliedIntents: /* @__PURE__ */ new Map(), parameterObservations: /* @__PURE__ */ new Map(), editOrder: 0, parameters: I, snapshot: Object.freeze({ ...y.snapshot, scope: Object.freeze({ ...u.scope }) }) });
    } else if (u.kind === "command") {
      if (!l.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!Ke(u.address, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(u.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (u.command.kind === "undo" || u.command.kind === "redo") {
        if (b(l)) return { kind: "rejected", reason: "busy" };
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
          const ve = l.snapshot.fields[B];
          if (!ve || !("value" in ve) || ve.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          const be = v(l, B);
          if (be && be !== T) return { kind: "rejected", reason: be.client === W ? "invalid-command" : "busy" };
          if (T && !be) return { kind: "rejected", reason: "invalid-command" };
          if (!_(be, B, de, ve.version)) return { kind: "rejected", reason: "stale-version" };
          const ke = ge(l, B, ae);
          if (ke.kind === "error") return { kind: "rejected", reason: "invalid-value" };
          N(B, ve.value, ke.value) || P.push({ key: B, before: ve.value, after: ke.value });
        }
        if (!P.length) return { kind: "accepted", revision: l.snapshot.revision, changed: !1 };
        const C = l.editOrder + 1, K = P.map(({ key: B, after: ae }) => ({ key: B, value: ae }));
        if (T) {
          const B = new Map(T.after);
          for (const { key: de, value: ve } of K) B.set(de, ve);
          const ae = A(l, T, { ...T, after: B, order: C });
          return pe(
            { ...l, gestures: ae, editOrder: C },
            K,
            P.some(({ key: de }) => S(de)) ? l.history.clearRedo() : l.history,
            "edit"
          );
        }
        const te = u.command.history === !1 ? [] : P.filter(({ key: B }) => S(B));
        return pe({ ...l, editOrder: C }, K, te.length ? l.history.record({ changes: te, order: C }) : l.history, u.command.recall ? "recall" : "edit");
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
          const ne = v(l, ue);
          if (ne && ne.client !== W) return { kind: "rejected", reason: "busy" };
          if (ne && ne.gesture !== q) return { kind: "rejected", reason: "invalid-command" };
        }
        const T = l.gestures.find((ue) => ue.client === W && ue.gesture === q);
        if (T && (T.keys.length !== P.length || !P.every((ue) => T.keys.includes(ue))))
          return { kind: "rejected", reason: "invalid-command" };
        const C = u.command.kind === "begin", K = P.length === 1 && P[0] !== void 0 ? x[P[0]] : void 0, te = K ? { version: K.version } : {};
        if (C === !!T) return { kind: "accepted", revision: l.snapshot.revision, ...te };
        let B, ae = l.history, de, ve;
        if (T)
          B = A(l, T), ae = j(ae, T), ae !== l.history && ae.undoEntry && (de = jt(l.snapshot.scope, T));
        else {
          ve = Object.freeze({ client: W, gesture: q });
          const ue = new Map(P.map((ne) => [ne, x[ne]?.value]));
          B = [...l.gestures, {
            ...ve,
            keys: Object.freeze([...P]),
            before: ue,
            after: ue,
            guardFloorVersions: new Map(P.map((ne) => [ne, x[ne]?.version ?? 0])),
            order: 0
          }];
        }
        const be = { ...l.snapshot.fields };
        for (const [ue, ne] of Object.entries(x))
          be[ue] = De(ne.value, ne.persistence, ne.version, ne.metadata, ve, ne.application, ne.persistenceRequest);
        const ke = M({ ...l, gestures: B }, be, ae), gt = {
          kind: "accepted",
          revision: ke.snapshot.revision,
          ...te,
          ...de ? { historyEntry: de } : {}
        };
        if (d = gt, Y({ ...ke, gestures: B }), a) return gt;
        const Cr = P.flatMap((ue) => {
          const ne = e[ue];
          return ne?.kind === "parameter" ? [{ kind: C ? "gesture-start" : "gesture-end", endpoint: ne.endpoint }] : [];
        });
        return Cr.length && t.native.publish({ request: ++c, scope: l.snapshot.scope, operations: Cr }), gt;
      }
      const { key: p } = u.command;
      if (!Object.hasOwn(e, p)) return { kind: "rejected", reason: "invalid-command" };
      const I = e[p], y = l.snapshot.fields[p];
      if (!I || !y) return { kind: "rejected", reason: "invalid-command" };
      if (u.command.kind === "retry") {
        if (!("value" in y) || y.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (u.command.expectedVersion !== y.version || u.command.expectedGeneration !== (y.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const P = y.persistence.kind === "failed" && y.persistenceRequest !== void 0;
        if (u.command.expectedPersistenceRequest !== (P ? y.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (P) {
          const x = I.kind === "parameter" ? [{ kind: "parameter", endpoint: I.endpoint, value: Number(y.value) }] : [{ kind: "stored", key: p, value: vt(p, () => I.codec.encode(y.value)) }], T = ++c, C = new Map(l.publications).set(T, { key: p, version: y.version }), K = M(l, { ...l.snapshot.fields, [p]: Object.freeze({
            ...y,
            persistence: Object.freeze({ kind: "pending" }),
            ...I.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), te = { kind: "accepted", revision: K.snapshot.revision, version: y.version, changed: !1 };
          return d = te, Y({ ...K, publications: C, parameterIntents: I.kind === "parameter" ? new Map(l.parameterIntents).set(p, T) : l.parameterIntents }), a || t.native.publish({ request: T, scope: l.snapshot.scope, operations: x }), te;
        }
        if (y.application?.kind !== "failed" || y.application.error.kind === "defect" || !t.bindings?.some((x) => x.key === p))
          return { kind: "rejected", reason: "not-ready" };
        const q = M(l, l.snapshot.fields), W = { kind: "accepted", revision: q.snapshot.revision, version: y.version, changed: !1 };
        return d = W, Y(q, p), W;
      }
      if (u.command.kind === "recover") {
        if (u.command.expectedVersion !== 0 || Object.hasOwn(u.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (I.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in y && y.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (y.readiness.kind !== "failed" || y.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const { value: P } = u.command, q = vt(p, () => I.codec.parse(P));
        return q.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : ee(l, p, q.value, l.history, "recover");
      }
      if (!("value" in y) || y.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const k = y, R = v(l, p);
      if (R && R.client !== u.address.client) return { kind: "rejected", reason: "busy" };
      const { value: U, expectedVersion: V } = u.command;
      if (u.command.gesture !== void 0 && (!R || R.gesture !== u.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (R && u.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (!_(R, p, V, k.version)) return { kind: "rejected", reason: "stale-version" };
      const F = ge(l, p, U);
      if (F.kind === "error") return { kind: "rejected", reason: "invalid-value" };
      const $ = F.value;
      if (N(p, k.value, $)) return { kind: "accepted", revision: l.snapshot.revision, version: k.version, changed: !1 };
      const Q = l.editOrder + 1;
      if (R) {
        const P = A(l, R, { ...R, after: new Map(R.after).set(p, $), order: Q });
        return ee({ ...l, gestures: P, editOrder: Q }, p, $, S(p) ? l.history.clearRedo() : l.history, "edit");
      }
      return ee({ ...l, editOrder: Q }, p, $, S(p) ? l.history.record({ changes: [{ key: p, before: k.value, after: $ }], order: Q }) : l.history, "edit");
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
      const p = l.gestures.filter((U) => U.client !== u.client), I = { ...l.snapshot.fields }, y = [];
      let k = l.history;
      for (const U of l.gestures)
        if (U.client === u.client) {
          k = j(k, U);
          for (const V of U.keys) {
            const F = I[V];
            F && "value" in F && (I[V] = De(F.value, F.persistence, F.version, F.metadata, void 0, F.application, F.persistenceRequest));
            const $ = e[V];
            $?.kind === "parameter" && y.push({ kind: "gesture-end", endpoint: $.endpoint });
          }
        }
      const R = p.length === l.gestures.length ? l : M({ ...l, gestures: p }, I, k);
      return d = { kind: "accepted", revision: R.snapshot.revision }, Y({ ...R, gestures: p, detached: new Set(l.detached).add(u.client) }), !a && y.length > 0 && t.native.publish({ request: ++c, scope: l.snapshot.scope, operations: y }), d;
    } else if (u.kind === "parameter") {
      if (!l.snapshot.scope || !Ke(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const [p, I] = [...l.parameters].find(([, F]) => F.endpoint === u.endpoint) ?? [];
      if (p === void 0 || I === void 0) return { kind: "accepted", revision: l.snapshot.revision };
      if (!Yr({ ...I, value: u.value })) return { kind: "rejected", reason: "invalid-value" };
      if (!Number.isSafeInteger(u.intent) || u.intent < 0 || !Number.isSafeInteger(u.observation) || u.observation < 0 || u.origin !== "owner" && u.origin !== "external") return { kind: "rejected", reason: "invalid-command" };
      if (u.observation <= (l.parameterObservations.get(p) ?? -1)) return { kind: "accepted", revision: l.snapshot.revision };
      const y = new Map(l.parameterObservations).set(p, u.observation);
      if (u.origin === "owner" || u.intent < (l.parameterIntents.get(p) ?? 0))
        return Y({ ...l, parameterObservations: y }), { kind: "accepted", revision: l.snapshot.revision };
      const k = l.snapshot.fields[p];
      if (!k || !("value" in k)) return { kind: "accepted", revision: l.snapshot.revision };
      const R = Object.is(k.value, u.value) ? l : M(l, {
        ...l.snapshot.fields,
        [p]: De(u.value, { kind: "host-managed" }, k.version + 1, k.metadata, k.gesture, { kind: "unconfirmed" })
      }), U = v(l, p), V = U && R !== l ? A(l, U, { ...U, guardFloorVersions: new Map(U.guardFloorVersions).set(p, k.version + 1) }) : l.gestures;
      Y({ ...R, gestures: V, parameterObservations: y });
    } else {
      if (!l.snapshot.scope || !Ke(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const p = l.publications.get(u.request);
      if (p) {
        const I = new Map(l.publications);
        I.delete(u.request);
        const y = new Map(l.parameterAppliedIntents), k = new Map(l.parameterIntents), R = new Map(l.parameterObservations), U = e[p.key];
        if (U?.kind === "parameter") {
          u.result.kind === "observed" && y.set(
            p.key,
            Math.max(u.request, y.get(p.key) ?? 0)
          );
          const F = u.observations?.find((Q) => Q.endpoint === U.endpoint);
          F && R.set(
            p.key,
            Math.max(R.get(p.key) ?? -1, F.observation)
          );
          let $ = y.get(p.key) ?? 0;
          for (const [Q, P] of I) P.key === p.key && ($ = Math.max($, Q));
          (u.result.kind === "observed" || F) && k.set(p.key, $);
        }
        const V = l.snapshot.fields[p.key];
        if (V && "value" in V && V.version === p.version) {
          const F = u.result.kind === "observed" ? { kind: e[p.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: u.result.reason }, $ = e[p.key]?.kind === "parameter" ? u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: u.result.reason }) } : V.application, Q = M(l, { ...l.snapshot.fields, [p.key]: Object.freeze({
            ...De(V.value, F, V.version, V.metadata, V.gesture, $),
            ...u.result.kind === "failed" ? { persistenceRequest: u.request } : {}
          }) });
          Y({ ...Q, publications: I, parameterIntents: k, parameterAppliedIntents: y, parameterObservations: R });
        } else Y({ ...l, publications: I, parameterIntents: k, parameterAppliedIntents: y, parameterObservations: R });
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
      } catch (R) {
        p.push(Promise.reject(R));
      }
    Promise.allSettled(p).then((k) => {
      for (const R of k) R.status === "rejected" && t.onDefect(R.reason);
      l();
    });
    const I = n.get(i), y = {};
    for (const [k, R] of Object.entries(I.snapshot.fields)) {
      const { gesture: U, ...V } = "value" in R ? R : { ...R, gesture: void 0 };
      y[k] = Object.freeze({ ...V, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...M(I, y), gestures: [], publications: /* @__PURE__ */ new Map() });
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
      return w(u);
    } catch (l) {
      if (!(l instanceof ui) || u.kind !== "command") throw l;
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
            const I = n.get(i).snapshot;
            l = a ? { kind: "rejected", reason: "service-closed" } : O(u.event), d = l;
            for (const y of h)
              a || y();
            !a && (n.get(i).snapshot !== I || u.event.kind === "command") && (p = !0, t.native.update(g(), u.event.kind === "command" ? { address: u.event.address, result: l } : void 0));
          } catch (I) {
            l = d ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(I), E(!p && u.event.kind === "command" ? { address: u.event.address, result: l } : void 0);
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
const Ts = 5e3;
function Es(e) {
  const t = /* @__PURE__ */ new Set();
  return (n) => {
    t.has(n) || (t.add(n), e(new Error(`Ignoring "${n}" state-channel messages, which this kit version does not understand.`)));
  };
}
function Ie(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function Os(e) {
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
function xs(e, t, n) {
  let r = !1, i = !1, o, a = 0, s = 0, c, m, d, h = () => {
  }, f = () => {
  };
  const g = /* @__PURE__ */ new Map();
  let S;
  const b = (w) => {
    if (!Un(w)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: w });
  }, v = /* @__PURE__ */ new Map(), A = [], j = Na(t);
  function _(w) {
    try {
      return w();
    } catch (E) {
      return n.onDefect(E), { kind: "failed", error: { kind: "defect", message: "Data preparation failed unexpectedly." } };
    }
  }
  async function M(w) {
    try {
      return { kind: "ok", value: await w() };
    } catch (E) {
      return n.onDefect(E), { kind: "error", error: { kind: "defect", message: "Preparation failed unexpectedly." } };
    }
  }
  for (const { key: w, input: E } of di(e)) {
    const O = e[w];
    if (O?.kind !== "stored" || O.engine?.kind !== "shared-prepared") continue;
    const H = O.engine, u = vn({
      async prepare(l, p) {
        const I = await M(() => H.prepare(l.value, { resources: j, parameters: l.parameters, reason: l.reason, signal: p }));
        if (I.kind === "error") return I;
        const y = I.value;
        return Bt(y) ? { kind: "error", error: y.error } : !y || !Number.isSafeInteger(y.length) || y.length <= 0 || typeof y.write != "function" ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size or writer." } } : { kind: "ok", value: { plan: y, target: l.target } };
      },
      transport: {
        apply(l, p) {
          if (p.signal.aborted || !Ie(D.getSnapshot().scope, l.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          o ??= Jr(t);
          const I = H.storage.type === "float32" ? l.plan.length * 4 : l.plan.length;
          return o.prepare({ input: E, byteLength: I }, l.target, p.signal, (y) => {
            const k = H.storage.type === "float32" ? new Float32Array(y.buffer, y.byteOffset, l.plan.length) : new Uint8Array(y.buffer, y.byteOffset, l.plan.length), R = _(() => l.plan.write(k));
            if (R) return R;
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
        n.onDefect(l), ee();
      }
    });
    A.push({
      key: w,
      dependencies: H.dependencies,
      replace(l, p) {
        u.replace({ ...l, target: p }, p);
      },
      cancel: u.cancel,
      stop: u.stop
    });
  }
  for (const [w, E] of Object.entries(e)) {
    if (E.kind !== "stored" || E.engine?.kind !== "event-value") continue;
    const O = E.engine, H = vn({
      async prepare(u, l) {
        const p = await M(() => O.prepare(u.value, { resources: j, parameters: u.parameters, reason: u.reason, signal: l }));
        if (p.kind === "error") return p;
        const I = p.value;
        if (Bt(I)) return { kind: "error", error: I.error };
        const y = Wr(I);
        return y.kind === "ok" ? { kind: "ok", value: { target: u.target, value: y.value } } : { kind: "error", error: { kind: "engine-rejected", message: y.message } };
      },
      transport: {
        apply(u, l) {
          return new Promise((p) => {
            let I = 0, y = () => {
            };
            const k = (R) => {
              y(), v.delete(I), p(R);
            };
            y = l.signal.onAbort(() => k({ kind: "cancelled" }));
            try {
              const R = l.send(() => Ie(D.getSnapshot().scope, u.target.scope) ? (I = ++a, v.set(I, { kind: "event-value", key: w, scope: u.target.scope, finish: k }), b({
                kind: "publish",
                request: I,
                scope: u.target.scope,
                operations: [{ kind: "event", endpoint: O.endpoint, value: u.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              R.kind !== "sent" && k(R);
            } catch (R) {
              y(), v.delete(I), n.onDefect(R), ee(), p({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const u of v.values()) u.key === w && u.finish({ kind: "cancelled" });
        }
      },
      onStatus(u, l) {
        D.dispatch({ kind: "engine", target: u, status: l });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: w,
      dependencies: O.dependencies,
      replace(u, l) {
        H.replace({ ...u, target: l }, l);
      },
      cancel: H.cancel,
      stop: H.stop
    });
  }
  const D = As(e, {
    historyLimit: Is(e).historyLimit,
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(w) {
        const E = ++a;
        g.set(E, { request: w.request, scope: w.scope }), b({ kind: "publish", ...w, request: E, operations: w.operations.map((O) => O.kind === "parameter" ? { ...O, intent: w.request } : O) });
      },
      update(w, E) {
        w.scope && (b({
          kind: "update",
          scope: w.scope,
          revision: w.revision,
          state: qr(e, w, S),
          ...E ? { receipt: E } : {}
        }), S = w);
      },
      close(w) {
        i = !0, o?.stop();
        for (const E of v.values()) E.finish({ kind: "cancelled" });
        f(new Error("State service closed before native initialization completed."));
        try {
          r && D.getSnapshot().scope && b({ kind: "close", ...w });
        } catch (E) {
          n.onDefect(E);
        }
        r && t.removeEventListener("kit_state", pe), r = !1, g.clear();
      }
    }
  }), Z = Es(n.onDefect), Y = (w) => {
    if (i) return;
    const E = gs(w);
    if (E.kind === "unknown") {
      Z(E.messageKind);
      return;
    }
    if (E.kind === "invalid") {
      const H = new Error(E.message);
      n.onDefect(H), f(H), ee();
      return;
    }
    const O = E.value;
    if (O.kind === "closed")
      f(new Error(`Native state service closed: ${O.reason}`)), ee();
    else if (O.kind === "open-failed") {
      if (O.request !== s || D.getSnapshot().scope) return;
      f(new Error(`Native state open failed: ${O.reason}`)), ee();
    } else if (O.kind === "opened") {
      if (O.request !== s || D.getSnapshot().scope) return;
      D.dispatch(O).then((H) => {
        H.kind === "accepted" ? h() : f(new Error("Native state could not initialize the service."));
      });
    } else if (O.kind === "attached-client") {
      const H = D.getSnapshot();
      if (!Ie(H.scope, O.scope)) return;
      b({
        kind: "snapshot",
        scope: O.scope,
        to: O.client,
        attachRequest: O.request,
        revision: H.revision,
        state: qr(e, H)
      }), S = void 0;
    } else if (O.kind === "detach")
      D.dispatch({ kind: "detached", scope: O.scope, client: O.client });
    else if (O.kind === "parameter")
      Ie(D.getSnapshot().scope, O.scope) && D.dispatch(O);
    else if (O.kind === "replaced")
      D.dispatch(O).then((H) => {
        if (H.kind !== "accepted") return;
        const u = D.getSnapshot().scope;
        for (const l of v.values())
          Ie(u, l.scope) || l.finish({ kind: "cancelled" });
        for (const [l, p] of g)
          Ie(u, p.scope) || g.delete(l);
      });
    else if (O.kind === "command")
      D.dispatch(O);
    else if (O.kind === "invalid-command")
      Ie(D.getSnapshot().scope, O.address) && b({
        kind: "receipt",
        address: O.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const H = v.get(O.request);
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
  }, pe = (w) => {
    if (!i)
      try {
        Y(w);
      } catch (E) {
        n.onDefect(E), f(E), ee();
      }
  }, ee = () => d || (i = !0, f(new Error("State service stopped before native initialization completed.")), d = D.stop(), d);
  function ge(w) {
    n.onDefect(w), ee();
  }
  function N({ key: w, declaration: E }) {
    const O = E.delivery;
    let H, u = !1;
    const l = /* @__PURE__ */ new Set();
    function p() {
      const y = H;
      if (H = void 0, !y) return;
      const k = y.close();
      l.add(k), k.then(() => l.delete(k), (R) => {
        l.delete(k), ge(R);
      });
    }
    function I(y) {
      const k = Object.freeze({ ...y.scope }), R = St(), U = R.signal;
      let V = y;
      function F(x, T) {
        if (x.signal.aborted || i || !Ie(D.getSnapshot().scope, k)) return { kind: "cancelled" };
        if (!T || typeof T != "object" || T.kind !== "event" && T.kind !== "host-effect")
          return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
        if (!(T.kind === "event" ? O.eventEndpoints.includes(T.endpoint) : O.hostEffects?.includes(T.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
        const K = Wr(T.value);
        if (K.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: K.message } };
        const te = T.kind === "event" ? { kind: "event", endpoint: T.endpoint, value: K.value } : { kind: "host-effect", name: T.name, value: K.value }, B = { kind: "publish", request: a + 1, scope: k, operations: [te] };
        if (!Un(B)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
        const ae = ++a;
        let de = (be) => {
        };
        const ve = new Promise((be) => {
          let ke = () => {
          };
          de = (gt) => {
            v.delete(ae) && (ke(), be(gt));
          }, v.set(ae, { kind: "custom", key: w, scope: k, finish: de }), ke = x.signal.onAbort(() => de({ kind: "cancelled" }));
        });
        try {
          t.sendMessageToServer({ type: "kit_state", message: B });
        } catch (be) {
          const ke = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
          return de(ke), n.onDefect(be), ke;
        }
        return { kind: "submitted", completion: ve };
      }
      function $(x, T, C) {
        if (!O.outputEndpoints?.includes(T)) throw new Error("Undeclared engine output endpoint.");
        if (x.signal.aborted) return () => {
        };
        let K = !0, te = () => {
        };
        const B = (de) => {
          if (!(!K || x.signal.aborted))
            try {
              C(de);
            } catch (ve) {
              ge(ve);
            }
        }, ae = () => {
          K && (K = !1, te(), t.removeEndpointListener?.(T, B));
        };
        return te = x.signal.onAbort(ae), t.addEndpointListener?.(T, B), ae;
      }
      const Q = j, P = {
        signal: U,
        send: (x) => F(R, x),
        listen: (x, T) => $(R, x, T),
        readStored(x) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          return U.aborted ? Promise.resolve(void 0) : new Promise((T) => {
            const C = U.onAbort(() => T(void 0));
            t.requestFullStoredState?.((K) => {
              C(), T(!U.aborted && le(K) && le(K.values) ? K.values[x] : void 0);
            });
          });
        },
        subscribeStored(x, T) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          if (U.aborted) return () => {
          };
          let C = !0, K = () => {
          };
          const te = (ae) => {
            if (!(!C || U.aborted || !le(ae) || ae.key !== x))
              try {
                T(ae.value);
              } catch (de) {
                ge(de);
              }
          }, B = () => {
            C && (C = !1, K(), t.removeStoredStateValueListener?.(te));
          };
          return K = U.onAbort(B), t.addStoredStateValueListener?.(te), B;
        },
        async prepareData(x, T, C, K) {
          if (!O.dataInputs?.includes(x)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
          const te = K ? St(U, K) : St(U);
          try {
            return o ??= Jr(t), await o.prepare({ input: x, byteLength: T }, { ...V, scope: k }, te.signal, (B) => _(() => C(B)));
          } finally {
            te.cancel();
          }
        },
        report(x) {
          U.aborted || D.dispatch({ kind: "engine", target: V, status: x });
        },
        fail(x) {
          U.aborted || ge(x);
        }
      };
      let q;
      try {
        q = O.create(P);
      } catch (x) {
        throw R.cancel(), x;
      }
      const W = vn({
        replacement: O.replacement,
        async prepare(x, T) {
          const C = await M(() => E.prepare(x.value, { resources: Q, parameters: x.parameters, reason: x.reason, signal: T }));
          if (C.kind === "error") return C;
          const K = C.value;
          return Bt(K) ? { kind: "error", error: K.error } : { kind: "ok", value: { value: K, target: x.target } };
        },
        transport: {
          async apply(x, T) {
            V = x.target;
            const C = St(U, T.signal);
            try {
              return await q.apply(x.value, {
                signal: C.signal,
                send: (K) => F(C, K),
                listen: (K, te) => $(C, K, te)
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
        return R.cancel(), W.stop();
      } };
    }
    return {
      key: w,
      dependencies: E.dependencies,
      replace(y, k) {
        if (!u) {
          if ((!H || !Ie(H.scope, k.scope)) && (p(), H = I(k)), u) {
            p();
            return;
          }
          H.binding.replace({ ...y, target: k }, k);
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
        return ee(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      c = new Promise((w, E) => {
        h = () => {
          clearTimeout(m), w();
        }, f = (O) => {
          clearTimeout(m), E(O);
        };
      });
      try {
        const w = Os(e);
        if (w.some(({ declaration: E }) => E.delivery.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (w.some(({ declaration: E }) => E.delivery.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const E of w) A.push(N(E));
        r = !0, t.addEventListener("kit_state", pe), s = ++a, m = setTimeout(() => {
          f(new Error("Cmajor state-channel is unavailable: native open timed out.")), ee();
        }, Ts), b({
          kind: "open",
          request: s,
          parameters: Object.values(e).filter((E) => E.kind === "parameter").map((E) => E.endpoint),
          storedKeys: Object.entries(e).filter(([, E]) => kt(E)).map(([E]) => E),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((E) => E.kind === "stored" && E.engine?.kind === "event-value" ? [E.engine.endpoint] : []),
            ...w.flatMap((E) => E.declaration.delivery.eventEndpoints)
          ])],
          ...w.some((E) => E.declaration.delivery.hostEffects?.length) ? {
            hostEffects: [...new Set(w.flatMap((E) => E.declaration.delivery.hostEffects ?? []))]
          } : {}
        });
      } catch (w) {
        n.onDefect(w), f(w), ee();
      }
      return c;
    },
    /** Release this owner and its channel resources. */
    stop: ee
  };
}
const fi = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), zn = Reflect.get(globalThis, fi), Qr = zn instanceof WeakMap ? zn : /* @__PURE__ */ new WeakMap();
zn !== Qr && Object.defineProperty(globalThis, fi, { value: Qr });
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
function ws(e) {
  const t = Ye(e) ? Qt(e) : void 0;
  return t !== void 0 && Ye(t) ? ut(t) : Ot("Preset values must be an object of JSON values.");
}
function mi(e) {
  if (!Ye(e) || typeof e.id != "string" || e.id.length === 0 || typeof e.name != "string" || e.name.trim().length === 0)
    return Ot("A preset needs a non-empty id and name.");
  const t = ws(e.values);
  return t.kind === "ok" ? ut(Object.freeze({ id: e.id, name: e.name, values: t.value })) : t;
}
const Rs = {
  parse(e) {
    if (!Ye(e) || e.version !== 1 || !Array.isArray(e.presets)) return Ot("Expected a version 1 preset library.");
    const t = [];
    for (const n of e.presets) {
      const r = mi(n);
      if (r.kind === "error") return r;
      if (t.some((i) => i.id === r.value.id)) return Ot(`Preset id "${r.value.id}" appears twice.`);
      t.push(r.value);
    }
    return ut(Object.freeze({ version: 1, presets: Object.freeze(t) }));
  },
  encode: (e) => e,
  equals: (e, t) => xt(e, t)
}, Xr = {
  parse: (e) => e === null ? ut(null) : mi(e),
  encode: (e) => e,
  equals: (e, t) => xt(e, t)
};
function pi(e, t) {
  if (e.kind === "parameter")
    return typeof t == "number" && Number.isFinite(t) ? ut(t) : Ot("Expected a finite number.");
  const n = e.codec.parse(t);
  return n.kind === "ok" ? ut(e.codec.encode(n.value)) : n;
}
function Ms(e, t, n) {
  if (t !== void 0 && !e.some((o) => o.id === t))
    throw new Error(`The initial preset "${t}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = Ss(n), i = /* @__PURE__ */ new Set();
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
      const c = pi(s, o.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function Ds(e = {}) {
  const t = Object.freeze((e.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = e, r = Object.freeze({
    ...Je({ codec: Rs, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: t,
    [si]: (a) => Ms(t, n, a)
  }), i = Je({ codec: Xr, initial: null, preset: !1 }), o = t.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [ci]: (a) => Xr.parse({ id: o.id, name: o.name, values: _s(a, o) })
    })
  };
}
const Zr = /* @__PURE__ */ new WeakMap();
function _s(e, t) {
  let n = Zr.get(t);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(t.values)) {
      const a = e[i], s = a && pi(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), Zr.set(t, n);
  }
  return n;
}
const Cs = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function Ls(e) {
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
function Ns(e) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (t) => t === null || typeof t == "string" ? { kind: "ok", value: typeof t == "string" && e.includes(t) ? t : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (t) => t,
    equals: Object.is
  };
}
function Ps(e = {}) {
  const t = Object.freeze([...e.slots ?? Cs]);
  if (t.length === 0 || t.some((r) => typeof r != "string" || r.length === 0) || new Set(t).size !== t.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(t.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...Je({ codec: Ls(t), initial: n, history: !1, preset: !1 }), slots: t }),
    activeSnapshot: Je({ codec: Ns(t), initial: null, preset: !1 })
  };
}
const Ve = 2048, wt = Ve + 3, eo = 20, hi = "MSEG 1";
function gi(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function vi(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Rt(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function js(e) {
  return vi(Number.isFinite(e) ? e : 0, -eo, eo);
}
function Qe(e) {
  return vi(Number.isFinite(e) ? e : 0, 0, 1);
}
function yi(e = hi) {
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
function Fs(e, t, n) {
  const r = gi(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Qe(i)), {
    x: i,
    y: Qe(Number(r.y)),
    curvePower: js(Number(r.curvePower))
  };
}
function ur(e = yi()) {
  const t = gi(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Fs(i, o, n.length));
  if (!Rt(r[0].x, 0) || !Rt(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : hi,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Us(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function zs(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Rt(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && Rt(e[o + 1].x, t); )
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
function Ks(e, t) {
  const n = Qe(Number(t)), r = zs(e, n);
  if (r.laterPointWins || Rt(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Qe(Us(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function $s(e, t) {
  return Ks(ur(e).points, t);
}
function Vs(e) {
  const t = new Float32Array(wt);
  return bi(e, t), t;
}
function bi(e, t) {
  if (t.length !== wt) throw new Error("Invalid MSEG destination length.");
  const n = ur(e);
  for (let r = 0; r < Ve; r += 1) {
    const i = r / (Ve - 1);
    t[r + 1] = $s(n, i);
  }
  t[0] = t[1], t[Ve + 1] = t[Ve], t[Ve + 2] = t[Ve];
}
const We = -100, Mt = 35, fr = 5, mr = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Ii(e) {
  const t = mr.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function xe(e) {
  return Ii(e).laneEndpointID;
}
function pr(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > fr)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${Ii(e).hostStem}${t}OutputTrimDb`;
}
function hr() {
  return mr.flatMap((e) => Array.from(
    { length: fr },
    (t, n) => pr(e.deviceType, n + 1)
  ));
}
function Bs(e) {
  if (typeof e != "string")
    return null;
  for (const t of mr)
    for (let n = 1; n <= fr; n += 1)
      if (e === pr(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function Si(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Hs(e) {
  const t = (Si(e, We, Mt) - We) / (Mt - We);
  return t * t;
}
function qs(e) {
  const t = Math.sqrt(Si(e, 0, 1));
  return We + t * (Mt - We);
}
const ye = (e, t) => ({ label: e, value: t });
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
}), z = (e, t, n, r, i, o, a, s = {}) => ({
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
  return z(
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
const Ws = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Gs = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Js = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: Ce.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      z("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(ye), quick: !0 }),
      z("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      z("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      z("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
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
      z("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [ye("Classic", 0), ye("Harmonics", 1)] }),
      z("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      z("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      z("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      z("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      z("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      z("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [ye("Symmetric", 0), ye("Asymmetric", 1), ye("Wavefold", 2)] }),
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
      z("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      z("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      z("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      z("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      z("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
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
      z("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(ye) }),
      z("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(ye) }),
      z("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      z("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      z("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      z("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      z("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
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
      z("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      z("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      z("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      z("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      z("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
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
      z("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [ye("Free", 0), ye("Sync", 1)] }),
      z("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      z("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Ws.map(ye) }),
      z("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      z("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      z("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      z("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      z("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
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
      z("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [ye("Free", 0), ye("Sync", 1)] }),
      z("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      z("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Gs.map(ye) }),
      z("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      z("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      z("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
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
      z("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      z("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      z("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      z("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      Le("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], mn = Js, ki = Object.freeze(
  mn.flatMap((e) => e.parameters)
);
new Map(
  ki.map((e) => [e.endpointID, e])
);
function Ys(e) {
  const t = mn.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Ai() {
  return ki;
}
function gr(e) {
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
], Qs = [
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
]), Xs = Object.freeze([
  ...J.flatMap((e) => vr.map(
    (t) => `osc${e}.${t}`
  )),
  ...Qs
]);
new Set(
  J.flatMap((e) => vr.map(
    (t) => `osc${e}.${t}`
  ))
);
const Ti = Object.freeze(
  Xs.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), Zs = Ai().filter(
  (e) => e.modulationTargetIndex !== null
), ec = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function yr(e) {
  const t = tc(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function tc(e) {
  const t = ec.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const nc = [
  ...Zs.map((e) => ({
    kind: yr(gr(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Ei = Object.freeze(
  nc.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), Fe = Object.freeze([
  ...Ti,
  ...Ei
]), Ht = tt.length, Oi = Ti.length, pn = Ei.length, rc = Ht * Fe.length, oc = new Map(tt.map((e) => [e.id, e])), xi = new Map(tt.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), pt = new Map(Fe.map((e) => [e.kind, e]));
function ic() {
  if (Ht !== 14 || Oi !== 59 || pn !== 47 || rc !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = tt.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = Fe.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (oc.size !== Ht || xi.size !== Ht || pt.size !== Fe.length)
    throw new Error("Modulation identities must be unique");
}
ic();
function wi(e, t) {
  const n = xi.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function br(e) {
  return typeof e != "string" ? null : pt.has(e) ? e : null;
}
function ac(e) {
  const t = br(e);
  return t !== null && pt.get(t)?.group === "voice" ? t : null;
}
function Ir(e) {
  const t = br(e);
  return t !== null && pt.get(t)?.group === "rack" ? t : null;
}
function Ri(e) {
  const t = pt.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function Mi(e) {
  const t = pt.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function sc(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Di = 4, cc = Di * pn, lc = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), dc = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function nt(e) {
  if (typeof e != "string")
    return null;
  const t = dc.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = lc.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function Sr(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function _i(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function Ci(e) {
  if (e === null)
    return null;
  const t = _i(e) - 1;
  return t > Di ? null : t * pn + Mi(Sr(e));
}
const uc = 0, Be = 2;
function Kn(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function fc(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function mc(...e) {
  return { ...yi(...e), format: "cosimo.mseg.shape" };
}
function $n(...e) {
  return { ...ur(...e), format: "cosimo.mseg.shape" };
}
function to(e) {
  return JSON.stringify($n(e));
}
function no(e, t) {
  return to(e) === to(t);
}
function pc(e) {
  const t = Number(e);
  return fc(
    Number.isFinite(t) ? t : 1,
    uc,
    Be
  );
}
function Vn() {
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
function hc(e) {
  if (!e || typeof e != "object")
    return null;
  const t = Kn(e), n = Qe(Number(t.startX)), r = Qe(Number(t.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function gc(e = Vn()) {
  const t = Kn(e), n = Kn(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: pc(Number.isFinite(r) ? r : 1)
    },
    loop: hc(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
const yn = "modulationProgram", vc = "modulationAmount", Li = tt.filter((e) => e.group === "voice").length, Ni = tt.filter((e) => e.group === "macro").length, Xt = Oi, yc = pn, Zt = yc + cc, He = Li * Xt, it = Ni * Xt, bc = Li * Zt, Ic = Ni * Zt, $e = 512, rt = 256, Pi = He + it;
function Sc(e) {
  const t = wi(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function kc(e) {
  const t = ac(e);
  return t === null ? null : Ri(t);
}
function ji(e) {
  const t = kc(e.targetKind), n = Ir(e.targetKind);
  let r = n === null ? void 0 : Mi(n);
  if (r === void 0) {
    const a = Ci(
      nt(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = wi(e.sourceKind, e.sourceSlot);
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
  const i = Sc(e);
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
function Fi(e) {
  return nt(e.targetKind) !== null ? null : ji(e).articulationCellIndex;
}
function Ac(e) {
  if (Ir(e.targetKind) !== null)
    return !1;
  const t = nt(e.targetKind);
  return t !== null && Ci(t) === null;
}
function Tc(e) {
  return {
    ...ji(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function Ui(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Ac(n))
      continue;
    const r = Tc(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Ec(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function at(e) {
  return [...e.values()].filter(Ec).sort((t, n) => t.cellIndex - n.cellIndex);
}
function Ft(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function bn(e) {
  const t = Ui(e), n = at(t.voice), r = at(t.macroVoice), i = at(t.voiceRack), o = at(t.macroRack), a = Array.from({ length: He }, () => 0), s = Array.from({ length: He }, () => 0), c = Array.from({ length: He }, () => 0), m = Array.from({ length: He }, () => 0), d = Array.from({ length: He }, () => 0);
  Ft(n, a, s, c, m);
  const h = Array.from({ length: it }, () => 0), f = Array.from({ length: it }, () => 0), g = Array.from({ length: it }, () => 0), S = Array.from({ length: it }, () => 0), b = Array.from({ length: it }, () => 0);
  if (Ft(
    r,
    h,
    f,
    g,
    S
  ), i.length > $e || o.length > rt)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${$e}), ${o.length} macro-rack (max ${rt})`
    );
  const v = Array.from({ length: $e }, () => 0), A = Array.from({ length: $e }, () => 0), j = Array.from({ length: $e }, () => 0), _ = Array.from({ length: $e }, () => 0), M = Array.from({ length: $e }, () => 0), D = Array.from({ length: bc }, () => 0);
  Ft(
    i,
    v,
    A,
    j,
    _
  );
  const Z = Array.from({ length: rt }, () => 0), Y = Array.from({ length: rt }, () => 0), pe = Array.from({ length: rt }, () => 0), ee = Array.from({ length: rt }, () => 0), ge = Array.from({ length: Ic }, () => 0);
  Ft(
    o,
    Z,
    Y,
    pe,
    ee
  );
  for (const N of t.voice.values()) d[N.cellIndex] = N.amount;
  for (const N of t.macroVoice.values()) b[N.cellIndex] = N.amount;
  for (const N of t.voiceRack.values()) D[N.cellIndex] = N.amount;
  for (const N of t.macroRack.values()) ge[N.cellIndex] = N.amount;
  for (let N = 0; N < i.length; N += 1) {
    const w = i[N];
    if (w === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    M[N] = w.reducer;
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
    macroVoiceRoutePolarities: S,
    macroVoiceRouteAmounts: b,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: v,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: j,
    voiceRackRoutePolarities: _,
    voiceRackRouteReducers: M,
    voiceRackRouteAmounts: D,
    macroRackRouteCount: o.length,
    macroRackRouteCells: Z,
    macroRackRouteSources: Y,
    macroRackRouteTargets: pe,
    macroRackRoutePolarities: ee,
    macroRackRouteAmounts: ge
  };
}
const Oc = ["voice", "macroVoice", "voiceRack", "macroRack"], xc = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function ro(e) {
  return Ui(e);
}
function wc(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function Rc(e, t) {
  if (e === null)
    return [{ endpointID: yn, value: bn(t) }];
  const n = ro(e), r = ro(t), i = [];
  for (const o of Oc) {
    const a = at(n[o]), s = at(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: yn, value: bn(t) }];
    for (let c = 0; c < s.length; c += 1) {
      const m = a[c], d = s[c];
      if (m === void 0 || d === void 0 || !wc(m, d))
        return [{ endpointID: yn, value: bn(t) }];
      m.amount !== d.amount && i.push({
        endpointID: vc,
        value: {
          pathKind: xc[o],
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
function Mc(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Dc(e) {
  throw new Error(e ?? "Invariant violated");
}
const _c = "globalTune", Cc = "globalTuneSemitones", Ne = -24, yt = 24, oo = 0, zi = -48, Ki = 48, Bn = -48, $i = 6, kr = 0, io = (kr - Bn) / ($i - Bn), Et = Object.freeze({
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
function Lc(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function In(e) {
  return Et.minimumHz * Math.pow(
    Et.maximumHz / Et.minimumHz,
    Lc(e, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: ot }, (e, t) => {
    const n = t / (ot - 1), r = In(n), i = In(
      Math.max(0, t - 0.5) / (ot - 1)
    ), o = In(
      Math.min(ot - 1, t + 0.5) / (ot - 1)
    );
    return {
      centerHz: r,
      lowHz: t === 0 ? Et.minimumHz : i,
      highHz: t === ot - 1 ? Et.maximumHz : o
    };
  })
);
const Nc = "voiceEnhancerFrequency", Pc = "voiceEnhancerQ", jc = "voiceEnhancerAmount", Fc = "voiceEnhancerFrequencyOctaves", Uc = "voiceEnhancerQ", zc = "voiceEnhancerAmount", Vi = "voice.enhancerFrequency", Kc = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Nc,
    targetKind: Fc,
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
    endpointID: Pc,
    targetKind: Uc,
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
    endpointID: jc,
    targetKind: zc,
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
function ao(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function $c(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function Ut(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Vc = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Ut("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ut("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Ut("mix", "Mix", 100, 100),
      Ut("drive", "Drive", 15, 0)
    ]
  }
], so = 1e-6;
function Ee(e, t) {
  if (!Number.isFinite(e) || e < -so || e > 1 + so)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function en(e, t) {
  return Ee(e / 100, `${t} catalog percentage`);
}
function Ct(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function Bc(e) {
  return 20 * 1e3 ** e;
}
function Hc(e) {
  return Ee(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function qc(e) {
  return 0.1 * 200 ** e;
}
function Wc(e) {
  return Ee(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Gc(e) {
  return e;
}
function Jc(e) {
  return Ee(e, "filterMix endpoint conversion");
}
function lt(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function Yc(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: lt("filterCutoff", Bc, Hc),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: lt("filterQ", qc, Wc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: lt("filterMix", Gc, Jc),
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
function Bi(e) {
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
      return Mc(e);
  }
}
function Qc(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Xc(e, t) {
  const n = Ct(e.moduleId, t.id), r = Bi(t.format), i = Yc(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: en(t.defaultPercent, n),
    initialValue: en(t.initialPercent, n),
    format: r,
    modAmount: Qc(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Zc = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: io * 100, defaultPercent: io * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function el(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function tl(e, t) {
  const n = `osc${e}`, r = Ct(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: en(t.defaultPercent, r),
    initialValue: en(t.initialPercent, r),
    format: Bi(t.format),
    modAmount: el(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const nl = Object.freeze(
  J.flatMap((e) => Zc.map((t) => tl(e, t)))
), rl = Object.freeze({
  targetId: Ct("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: Ee(
    (oo - Ne) / (yt - Ne),
    "Global Tune default"
  ),
  initialValue: Ee(
    (oo - Ne) / (yt - Ne),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: yt },
  modAmount: {
    min: zi,
    max: Ki,
    unit: "st",
    digits: 2
  },
  binding: lt(
    _c,
    (e) => Ne + (yt - Ne) * e,
    (e) => Ee(
      (e - Ne) / (yt - Ne),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Cc
});
function ol(e) {
  const t = Ct("voice-enhancer", e.key), n = Ee(
    ao(e, e.initial),
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
      (r) => $c(e, r),
      (r) => Ee(
        ao(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const il = Object.freeze(
  Object.values(Kc).map(ol)
), al = Object.freeze([
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
function sl(e) {
  const t = Ct(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => Ee(
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
const cl = Object.freeze(
  al.map(sl)
), ll = Object.freeze([
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
function dl(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function Sn(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? Hs(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return Ee(n, `${e.endpointID} endpoint conversion`);
}
function ul(e, t) {
  return e.valueKind === "effect-output-trim-db" ? qs(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function fl(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function ml(e) {
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
function pl(e) {
  const t = dl(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: Sn(e, e.initial),
    initialValue: Sn(e, e.initial),
    format: fl(e),
    modAmount: ml(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => ul(e, n),
      fromEngine: (n) => Sn(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : yr(gr(e))
  });
}
const Ar = Object.freeze(
  [
    ...mn.flatMap((e) => e.parameters.map(pl)),
    ...ll,
    rl,
    ...il,
    ...nl,
    ...cl,
    ...Vc.flatMap(
      (e) => e.parameters.map(
        (t) => Xc(e, t)
      )
    )
  ]
), hl = new Map(
  Ar.map((e) => [e.targetId, e])
), Hi = Ar.filter(
  (e) => e.modulationTargetKind !== null
), Hn = new Map(
  Hi.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (hl.size !== Ar.length)
  throw new Error("Target descriptor IDs must be unique");
if (Hi.length !== Fe.length || Hn.size !== Fe.length || Fe.some((e) => Hn.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function kn(e) {
  const t = Hn.get(e);
  return t === void 0 ? Dc(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  mn.map((e) => [e.id, e.label])
);
function gl(e) {
  const t = _i(e);
  return t === 1 ? "" : ` ${t}`;
}
function vl(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = kn(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = nt(e);
  if (n !== null) {
    const r = kn(Sr(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${gl(n)} ${r.label.toUpperCase()}`;
  }
  return kn(e).label.toUpperCase();
}
const qe = "modulation.v6", qi = 6, Lt = 3, st = 3, yl = 4, co = "modulationMsegBuffer", bl = "modulationMsegPlayback", Wi = 4, Il = ["MSEG 1", "MSEG 2", "MSEG 3"], Gi = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Sl = ["Env 1", "Env 2", "Env 3"], kl = 1e-3, re = 10, Al = 0.1, Tl = 20, lo = 10 - 0.1, El = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Tl - Al },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: zi,
    max: Ki
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
  voiceEnhancerQ: { min: -lo, max: lo },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Ol = Ai().filter((e) => e.modulationTargetIndex !== null), xl = new Map(
  Ol.map((e) => [
    yr(gr(e)),
    e
  ])
);
class An extends Error {
  name = "ModulationStateParseError";
}
const wl = {
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
  label: wl[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Rl = Fe.map((e) => ({
  value: e.kind,
  label: vl(e.kind)
}));
Rl.filter((e) => !Dl(e.value));
function Ml(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Tr(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Tn(e, t) {
  const n = Number(e);
  return Tr(Number.isFinite(n) ? n : t, kl, re);
}
function Dl(e) {
  return Ir(e) !== null;
}
function _l(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function Cl(e) {
  const t = nt(e);
  return t !== null ? Sr(t) : e;
}
function Ll(e) {
  const t = Cl(e);
  if (nt(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = xl.get(t);
  return n !== void 0 ? _l(n) : El[sc(t)];
}
function Nl(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Pl(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function jl(e, t) {
  const n = Ll(e), r = Number(t);
  return Tr(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Fl(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Ul(e) {
  return Fl(e) ?? "mseg";
}
function zl(e) {
  const t = br(e);
  return t !== null ? t : nt(e) !== null ? e : null;
}
function Kl(e) {
  return zl(e) ?? "oscA.wavetablePosition";
}
function $l(e, t) {
  const n = Gi[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Vl(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Lt : e === "macro" ? Wi : yl;
  return Tr(Number.isFinite(n) ? n : 1, 1, r);
}
function ct(e) {
  return {
    name: Sl[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ji(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = ct(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: Tn(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: Tn(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Qe(n.sustain ?? r.sustain),
    releaseSeconds: Tn(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Bl(e, t = 0) {
  return { name: Ji(e, t).name };
}
function Hl(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: Nl(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Vl(n, e.sourceSlot),
    polarity: Pl(e.polarity),
    targetKind: r,
    amount: jl(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function ql(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Ul(r.sourceKind), o = Kl(r.targetKind);
  return Hl(r, t, i, o);
}
function Wl(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function Gl(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => ql(n, r));
}
function Jl(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = Wl(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function qn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, s) => qn(a, t[s]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Ml(r, a) && qn(n[a], r[a]));
}
function Yi(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = mc(Il[t] ?? `MSEG ${t + 1}`), i = $n(n.shapeA ?? r), o = gc({
    ...Vn(),
    ...n.playback ?? {},
    rate: Vn().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: $n(n.shapeB ?? i),
    playback: s
  };
}
function Dt() {
  return {
    format: "cosimo.modulation",
    version: qi,
    msegSlots: Array.from({ length: Lt }, (e, t) => Yi({}, t)),
    envelopeSlots: Array.from({ length: st }, (e, t) => ({
      name: ct(t).name
    })),
    routes: [],
    macroNames: Gi.slice()
  };
}
function Yl(e = Dt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: qi,
    msegSlots: Array.from({ length: Lt }, (o, a) => Yi(n[a], a)),
    envelopeSlots: Array.from({ length: st }, (o, a) => Bl(r[a], a)),
    routes: Gl(t.routes),
    macroNames: Array.from(
      { length: Wi },
      (o, a) => $l(i[a], a)
    )
  };
}
function En(e) {
  const t = tn(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function tn(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Tt(new An("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Tt(new An("Expected valid modulation JSON"));
    }
  }
  const n = Yl(t);
  return !qn(t, n) || !Jl(n.routes) ? Tt(new An("Expected the current modulation schema")) : ht(n);
}
function Ql(e, t) {
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
function uo(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Vs(n))
  };
}
function Xl(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function fo(e, t = null, n) {
  const r = [];
  for (let i = 0; i < Lt; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !no(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: co,
      value: uo(i, 0, o.shapeA)
    }), (a === void 0 || !no(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: co,
      value: uo(i, 1, o.shapeB)
    }), (a === void 0 || !Xl(a.playback, o.playback)) && r.push({
      endpointID: bl,
      value: Ql(i, o.playback)
    });
  }
  return r.push(...Rc(t?.routes ?? null, e.routes)), r;
}
function Qi(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Qi(t);
    Object.freeze(e);
  }
}
const Zl = {
  parse(e) {
    const t = tn(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (Qi(t.value), { kind: "ok", value: t.value });
  },
  encode: En,
  equals: (e, t) => En(e) === En(t)
}, ed = [
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
], td = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function nd(e) {
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
function rd(e, t, n) {
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
function od(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${nd(n)}`,
    runtimeTargetIndex: Ri(r),
    oscillatorIndex: t
  });
}
function id(e, t) {
  const n = Object.freeze(ed.map(
    (o) => rd(e, t, o)
  )), r = Object.freeze(vr.map(
    (o) => od(e, t, o)
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
  td.map(({ id: e, oscillatorIndex: t }) => id(e, t))
);
function ad() {
  if (qt.length !== J.length || qt.some((t, n) => t.id !== J[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = qt.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
ad();
const On = "articulationSnapshot", ie = 128, mo = 48, sd = 1e6, me = -1, xn = [
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
function Er(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function wn(e) {
  return Er(Number.isFinite(e) ? e : 0, 0, 1);
}
function he(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return Er(Number.isFinite(i) ? i : t, n, r);
}
function fe(e, t, n, r) {
  return Er(Math.round(he(e, t)), n, r);
}
function Xi(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function Rn() {
  return Array.from({ length: ie }, () => me);
}
function cd(e) {
  const t = fe(e, 0, 0, ie - 1), n = xn[t % xn.length], r = Math.floor(t / xn.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function ld() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: kr,
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
function dd(e) {
  const t = ld(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: he(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: he(n.pan, t.pan, -1, 1),
    octave: fe(n.octave, t.octave, -4, 4),
    semitone: fe(n.semitone, t.semitone, -12, 12),
    fineCents: he(n.fineCents, t.fineCents, -100, 100),
    volumeDb: he(
      n.volumeDb,
      t.volumeDb,
      Bn,
      $i
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
function ud(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: he(t.amount, 0, -48, 48)
  } : null;
}
function fd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(ud).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: dd(t.parameters),
    envelopes: [0, 1, 2].map((i) => Ji(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function md(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = fe(n.runtimeSlot, t, 0, ie - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : cd(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: fd(n.snapshot)
  };
}
function pd(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: fe(n.note, 0, 0, ie - 1),
    articulationId: r
  } : null;
}
function hd(e, t, n, r, i) {
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
function po(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = hd(
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
function gd(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = pd(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function vd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < ie; c += 1) {
    const m = md(n[c], c);
    !m || r.has(m.runtimeSlot) || i.has(m.id) || (r.add(m.runtimeSlot), i.add(m.id), o.push(m));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((c) => c.id === t.selectedSlotId) ? t.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Xi(t.activeTriggerMode),
    slots: o,
    chainAssignments: po(t.chainAssignments, s, "chain", 0),
    keyAssignments: gd(t.keyAssignments, s),
    velocityAssignments: po(t.velocityAssignments, s, "velocity", 1)
  };
}
function ho(e) {
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
    volumeDbs: t(kr),
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
    routeAmounts: Array.from({ length: Pi }, () => 0),
    envelopeAttackSeconds: Array.from({ length: st }, (n, r) => ct(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: st }, (n, r) => ct(r).decaySeconds),
    envelopeSustain: Array.from({ length: st }, (n, r) => ct(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: st }, (n, r) => ct(r).releaseSeconds)
  };
}
function go(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === me && (e[o] = i);
  }
}
function yd(e) {
  const t = vd(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = Rn(), i = Rn(), o = Rn();
  go(r, t.chainAssignments, n), go(o, t.velocityAssignments, n);
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
function Zi(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : yd(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Xi(t.activeMode),
    chain: Array.from({ length: ie }, (n, r) => fe(t.chain?.[r], me, me, ie - 1)),
    key: Array.from({ length: ie }, (n, r) => fe(t.key?.[r], me, me, ie - 1)),
    velocity: Array.from({ length: ie }, (n, r) => r === 0 ? me : fe(t.velocity?.[r], me, me, ie - 1))
  });
}
function bd(e, t) {
  const n = Zi(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const Se = "articulations.v4", Or = [
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
], xr = [
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
], ea = [
  ...J.flatMap((e) => Or.map(
    (t) => `osc${e}.${t}`
  )),
  ...xr
];
class ta extends Error {
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
  return Tt(new ta("malformed", e));
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
function Id(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function Sd(e) {
  return ea.some((t) => t === e);
}
function vo(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = wr(e, ["min", "max"], t);
  return n !== null ? G(n) : nn(e.min) ? nn(e.max) ? e.min > e.max ? G(`${t}.min must be less than or equal to ${t}.max`) : ht({ min: e.min, max: e.max }) : G(`${t}.max must be an integer in 0..127`) : G(`${t}.min must be an integer in 0..127`);
}
function kd(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return G(`${t} has a non-string parameter id`);
    if (!Sd(r))
      return G(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return G(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return ht(n);
}
function na(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function ra() {
  return {};
}
function Ad(e, t, n) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const r = ra();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return G(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > mo)
      return G(
        `${t}.${i} must be a finite route amount within ±${mo}`
      );
    if (!n.has(i))
      return G(`${t}.${i} does not name a current articulable mapping`);
    na(r, i, o);
  }
  return ht(r);
}
function Td(e, t, n) {
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
  const o = vo(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = vo(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = kd(e.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = Ad(
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
function Ed(e) {
  const t = {};
  for (const n of ea) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function Od(e) {
  const t = ra();
  for (const [n, r] of Object.entries(e))
    na(t, n, r);
  return t;
}
const xd = Object.fromEntries(
  Or.map((e, t) => [e, 2 ** t])
), wd = Object.fromEntries(
  xr.map((e, t) => [e, 2 ** t])
);
function yo(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Rd(e, t) {
  return Or.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | xd[r] : n, 0);
}
function Md(e) {
  return xr.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | wd[n] : t, 0);
}
function Dd(e, t) {
  const n = (o, a) => yo(e, `osc${o}.${a}`), r = (o) => yo(e, o), i = Array.from(
    { length: Pi },
    () => sd
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const s = t[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: J.map((o) => Rd(e, o)),
    sharedOverrideMask: Md(e),
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
function _d(e, t) {
  return e.slots.map((n) => Dd(n, t));
}
function oa(e, t) {
  if (!Nt(e))
    return G("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return G('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Tt(new ta(
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
  if (!Id(e.activeTriggerMode))
    return G('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return G("slots must be an array");
  if (e.slots.length > ie)
    return G(`slots must contain at most ${ie} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const s = Td(e.slots[a], a, t);
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
function bo(e) {
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
      overrides: Ed(t.overrides),
      routeAmounts: Od(t.routeAmounts)
    }))
  };
}
function hn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Cd(e) {
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
async function Ld(e, t, n, r = {}) {
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
const Nd = 3, Pd = (4 + wt) * 4, Io = "runtimeState";
function jd(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const So = "runtimeInstallAck", ia = "runtimeSyncRequest", Wn = 0, Fd = 8e3, rn = /* @__PURE__ */ new WeakMap(), aa = 1e9;
let zt = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % aa;
function Ud(e) {
  return zt = zt % aa + 1, e === "modulation" ? -1e9 - zt : 1e9 + zt;
}
function zd(e, t) {
  const n = e, r = rn.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), rn.set(n, r);
}
function ko(e, t) {
  const n = e, r = rn.get(n);
  r?.delete(t), r?.size === 0 && rn.delete(n);
}
const Kd = [100, 250, 500, 1e3], Kt = { _tag: "accepted" }, $d = { _tag: "superseded" }, Vd = { _tag: "stopped" }, Ao = { _tag: "transport-timeout" };
function Bd(e) {
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
function Hd(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class To {
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
  #k = this.#R.bind(this);
  constructor(t, n) {
    this.#t = t, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#o = r && r.length > 0 ? r : [...Kd], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Fd)
    );
  }
  start() {
    if (!this.#i) {
      zd(this.#t, this.#e);
      try {
        this.#h += 1, this.#i = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(So, this.#k);
      } catch (t) {
        throw this.#i = !1, ko(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(So, this.#k), ko(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#S();
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
    const r = Ud(this.#e);
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
          return Ao;
        const c = this.#l;
        this.#b(r), await this.#I(
          c,
          Math.min(this.#y(o), s)
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
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#w(t.endpointID, Hd(t.value, n, i)));
    };
    try {
      let d = 0, h = 0, f = this.#p;
      for (await m(); ; ) {
        const g = this.#f(n, r);
        if (g)
          return g;
        const S = this.#v(n, i, f);
        if (S !== null)
          return S;
        const b = this.#l;
        await this.#I(
          b,
          this.#y(d)
        );
        const v = this.#v(
          n,
          i,
          f
        );
        if (v !== null)
          return v;
        let A = this.#l;
        for (this.#b(i); ; ) {
          const j = this.#f(n, r);
          if (j)
            return j;
          const _ = await this.#I(
            A,
            this.#y(d)
          ), M = this.#v(
            n,
            i,
            f
          );
          if (M !== null)
            return M;
          if (_ && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
            if (h >= 1)
              return Ao;
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
  #v(t, n, r) {
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
    return !this.#i || this.#h !== n ? Vd : this.#r !== t ? $d : null;
  }
  #y(t) {
    return this.#o[Math.min(
      t,
      this.#o.length - 1
    )];
  }
  #w(t, n) {
    try {
      this.#t.sendEventOrValue?.(
        t,
        n,
        void 0,
        Wn
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#i)
      try {
        this.#t.sendEventOrValue?.(
          ia,
          t,
          void 0,
          Wn
        );
      } catch {
      }
  }
  #R(t) {
    const n = Bd(t);
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
const qd = 1e3, Wd = [qe, Se];
function Gd(e) {
  if (!e || typeof e != "object") return {};
  const { values: t } = e;
  return t && typeof t == "object" ? t : {};
}
function Mn(e, t) {
  if (e === void 0) return hn();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = oa(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Eo(e) {
  return new Set(e.routes.flatMap((t) => Fi(t) === null ? [] : [t.id]));
}
function Oo(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function xo(e, t) {
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
class Jd {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new To(t, { laneKind: "modulation" }), this.articulationLane = new To(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Dt();
  articulationBank = hn();
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
    return this.frameworkInput ? [Se] : Wd;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Io, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Io, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(t) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || t !== this.lifecycleEpoch || (this.applyBootState(Gd(n)), this.finishBoot());
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
    const n = t[qe], r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Dt() } : tn(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${qe} is invalid; boot state was not installed.`);
      const a = t[Se], s = Mn(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = t[Se], o = Mn(
      i,
      Eo(r.value)
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
    const r = Mn(n, Eo(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${Se}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = jd(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(ia, 0, void 0, Wn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? fo(r, s, this.frameworkInput.curveCommand) : fo(r, s), m = await this.modulationLane.sendBatch(c);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", m, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const v = xo("modulation", m);
      v && o?.(v), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const d = this.buildUploadsBySelector(r, i), h = Array.from({ length: ie }, (v, A) => {
      const j = d.get(A);
      return j ? Oo(j) : null;
    }), f = this.lastAppliedArticulationGeneration !== n, g = f && this.articulationLane.getAcceptedFrontier() !== 0, S = [];
    for (let v = 0; v < ie; v += 1) {
      const A = d.get(v), j = h[v] !== this.lastAppliedArticulationTokens[v];
      g ? S.push({
        endpointID: On,
        value: A ?? ho(v)
      }) : f ? A && S.push({ endpointID: On, value: A }) : j && S.push({
        endpointID: On,
        value: A ?? ho(v)
      });
    }
    const b = await this.articulationLane.sendBatch(S);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", b, h)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = h;
        const v = Cd(i);
        if (this.frameworkInput) {
          const A = await this.frameworkInput.publishTriggerConfig(v);
          if (!this.started || t !== this.lifecycleEpoch) return;
          A.kind !== "cancelled" && o?.(A);
        } else
          bd(v, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const A of S) this.lastAppliedArticulationTokens[A.value.selectorA] = void 0;
        const v = xo("articulation", b);
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
      const o = Fi(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      _d(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = Oo(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, qd));
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
const Yd = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [Se],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = wo(e);
    return {
      apply(n, r) {
        return t.closed && (t = wo(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function wo(e) {
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
      const S = o.get(f) ?? /* @__PURE__ */ new Map();
      S.set(g, e.listen(f, g)), o.set(f, S);
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
  }, h = new Jd(d, {
    onDefect(f) {
      c(), e.fail(f);
    },
    curveCommand: (f, g, S) => ({
      async submit({ dspSessionId: b, deliverySerial: v, signal: A }) {
        const j = await e.prepareData(
          Nd + f * 2 + g,
          Pd,
          (_) => {
            new Int32Array(_.buffer, _.byteOffset, 4).set([1297302855, b, v, wt]), bi(S, new Float32Array(_.buffer, _.byteOffset + 16, wt));
          },
          A
        );
        j.kind === "failed" && (s(j), c());
      }
    }),
    async publishTriggerConfig(f) {
      const S = (await Promise.all(i)).find((v) => v.kind !== "sent");
      if (S) return S.kind === "failed" ? S : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const b = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Zi(f) });
      return b.kind === "submitted" ? b.completion : b;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(f, g) {
      if (t || g.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const S = ++n;
      return new Promise((b) => {
        const v = g.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (A) => {
          v(), b(A);
        }, h.replaceModulation(f, (A) => {
          S === n && A.kind !== "preparing" && s(A);
        }), h.start();
      });
    },
    stop: c
  };
}
const sa = 13, Rr = 5, ca = 8, Qd = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), la = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    xe("globalFilter")
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
    xe("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    xe("ott")
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
    xe("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    xe("flanger")
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
    xe("phaser")
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
    xe("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    xe("reverb")
  ]
});
function Mr(e) {
  return la[e];
}
function Xd(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Rr)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * ca + Qd[e];
}
function Zd(e, t) {
  const n = new Array(sa).fill(0);
  return la[e].forEach((r, i) => {
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o))
      throw new Error(`Missing lane parameter value: ${e}.${r}`);
    n[i] = o;
  }), n;
}
const da = "lane.v1", on = "laneTopology", _t = "laneSlotParams", Gn = "laneSlotParamValue", ua = "laneOutputControl", Jn = 16, eu = 8, fa = 4, tu = 3, ma = Rr * ca, pa = 4, nu = 4, ru = ma, ou = ma + pa, iu = 0, au = 1, su = 2, cu = 3, lu = 4, du = 5;
function uu(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > fa)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << eu;
}
const Yn = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), an = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), fu = new Map(
  Object.entries(an).map(([e, t]) => [t, e])
), mu = Object.freeze([
  "voice.filterCutoff",
  Vi,
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
]), pu = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Vi]: "enhancer-frequency",
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
  mu.map((e) => [e, Object.freeze({
    id: e,
    family: pu[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const ha = 40, ga = 18e3, Qn = Yn.map((e) => an[e]), hu = /^([a-zA-Z]+)#([1-9][0-9]*)$/, gu = /^(parallel|split)#([1-9][0-9]*)$/;
function Pt(e) {
  if (typeof e != "string")
    return null;
  const t = hu.exec(e);
  if (t === null)
    return null;
  const n = Qn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Rr ? null : { deviceType: n, instanceNumber: r };
}
function va(e) {
  if (typeof e != "string")
    return null;
  const t = gu.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? pa : nu) ? null : { groupKind: n, unitNumber: r };
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
function vu(e, t) {
  const n = Pt(e);
  if (n === null)
    return { failure: X(`device id ${e} is not a pool instance`) };
  if (!Ge(t) || !dt(t, ["params"]) || !Ge(t.params))
    return { failure: X(`device ${e} must be { params }`) };
  const r = Mr(n.deviceType), i = t.params;
  if (Object.keys(i).length !== r.length || !r.every((s) => Object.hasOwn(i, s)))
    return { failure: X(`device ${e} must carry every parameter once`) };
  const a = {};
  for (const s of r) {
    const c = i[s];
    if (typeof c != "number" || !Number.isFinite(c))
      return { failure: X(`device ${e}.${s} must be a finite number`) };
    a[s] = c;
  }
  return { record: { params: a } };
}
function yu(e, t) {
  return !Ge(e) || e.kind !== "device" ? { failure: X("branches may hold device placements only") } : dt(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: X(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: X(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: X("a device placement is { kind, deviceId, enabled }") };
}
function Ro(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= ha && e <= ga;
}
function ya() {
  return { mix: 1, bypassed: !1 };
}
function bu(e) {
  return !Ge(e) || !dt(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function Iu(e) {
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
  const n = bu(t.output);
  if (n === null)
    return X("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const d of Reflect.ownKeys(t.devices)) {
    if (typeof d != "string")
      return X("device ids must be strings");
    const h = vu(d, t.devices[d]);
    if ("failure" in h)
      return h.failure;
    r[d] = h.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const m = (d) => {
    const h = yu(d, i);
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
    const h = d.kind === "split", f = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], S = h ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], b = h && dt(d, f);
    if (!dt(d, S) && !b)
      return X(`a ${d.kind} group is { ${S.join(", ")} }`);
    const v = va(d.groupId);
    if (v === null || v.groupKind !== d.kind)
      return X(`group id ${String(d.groupId)} does not name a ${d.kind} unit`);
    if (a.has(String(d.groupId)))
      return X(`group ${String(d.groupId)} is used twice`);
    if (a.add(String(d.groupId)), typeof d.enabled != "boolean")
      return X(`group ${String(d.groupId)} needs a boolean enable`);
    const A = h ? tu : fa;
    if (!Array.isArray(d.branches) || d.branches.length < 2 || d.branches.length > A)
      return X(`group ${String(d.groupId)} needs 2..${A} branches`);
    if (h && (!Ro(d.xoverLowHz) || !Ro(d.xoverHighHz)))
      return X(`group ${String(d.groupId)} crossovers must sit in ${ha}..${ga} Hz`);
    if (h && !b && (typeof d.xoverLowKeyTrackEnabled != "boolean" || typeof d.xoverHighKeyTrackEnabled != "boolean" || typeof d.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverLowKeyTrackOffsetSemitones) || typeof d.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverHighKeyTrackOffsetSemitones)))
      return X(`group ${String(d.groupId)} Key Track state must be finite`);
    c += 1;
    const j = [];
    for (const _ of d.branches) {
      if (!Array.isArray(_))
        return X(`group ${String(d.groupId)} branches must be arrays`);
      const M = [];
      for (const D of _) {
        const Z = m(D);
        if ("failure" in Z)
          return Z.failure;
        M.push(Z.placement);
      }
      j.push(M);
    }
    s.push(h ? {
      kind: "split",
      groupId: String(d.groupId),
      enabled: d.enabled,
      xoverLowHz: d.xoverLowHz,
      xoverHighHz: d.xoverHighHz,
      xoverLowKeyTrackEnabled: b ? !1 : d.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: b ? 0 : d.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: b ? !1 : d.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: b ? 0 : d.xoverHighKeyTrackOffsetSemitones,
      branches: j
    } : {
      kind: "parallel",
      groupId: String(d.groupId),
      enabled: d.enabled,
      branches: j
    });
  }
  for (const d of i)
    if ((o.get(d) ?? 0) !== 1)
      return X(`device ${d} must be placed exactly once`);
  return c > Jn ? X(`flattens to ${c} wire entries; the topology upload holds ${Jn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function Su() {
  const e = {};
  for (const t of Yn) {
    const n = an[t];
    e[`${n}#1`] = {
      params: Ru(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ya(),
    devices: e,
    chain: Yn.map((t) => ({
      kind: "device",
      deviceId: `${an[t]}#1`,
      enabled: !1
    }))
  };
}
const Mo = ["distortion#1", "delay#1", "reverb#1"];
function Dr() {
  const e = Su(), t = {};
  for (const n of Mo) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ya(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && Mo.includes(n.deviceId))
  };
}
function ku(e) {
  if (e === void 0)
    return Dr();
  const t = Iu(e);
  return t._tag === "ok" ? t.value : null;
}
function Dn(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function Au(e) {
  return Object.keys(e.devices).map((t) => {
    const n = Pt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Qn.indexOf(t.parsed.deviceType) - Qn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Xn(e) {
  const t = Pt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return Xd(t.deviceType, t.instanceNumber - 1);
}
function ba(e) {
  const t = va(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? ru : ou) + (t.unitNumber - 1);
}
function Tu(e) {
  const t = new Array(Jn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    t[r] = uu(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Xn(o.deviceId), 0, o.enabled);
      continue;
    }
    i(ba(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(Xn(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function Eu(e) {
  const t = new Array(sa).fill(0);
  return t[iu] = e.xoverLowHz, t[au] = e.xoverHighHz, t[su] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[cu] = e.xoverLowKeyTrackOffsetSemitones, t[lu] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[du] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function Ou(e) {
  const t = [{
    endpointID: ua,
    value: e.output
  }];
  let n = 0;
  for (const r of Au(e)) {
    const i = Pt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: pr(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[xe(i.deviceType)]
    }), n += 1, t.push({
      endpointID: _t,
      value: {
        slotId: Xn(r.instanceId),
        deliverySerial: n,
        values: Zd(
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
        slotId: ba(r),
        deliverySerial: n,
        values: Eu(r)
      }
    }));
  return t.push({
    endpointID: on,
    value: Tu(e)
  }), t;
}
function xu(e, t, n, r) {
  const i = e.devices[t], o = Pt(t);
  if (i === void 0 || o === null || !Mr(o.deviceType).includes(n) || !Number.isFinite(r))
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
function wu(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = Bs(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      Mt,
      Math.max(We, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = xu(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function Ru(e) {
  const t = fu.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Ys(t).parameters;
  return Object.fromEntries(Mr(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function _r(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) _r(t);
    Object.freeze(e);
  }
}
const Mu = {
  parse(e) {
    const t = ku(e);
    return t ? (_r(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Dn,
  equals: (e, t) => Dn(e) === Dn(t)
}, Do = /* @__PURE__ */ new WeakMap();
function _n(e) {
  if (!Object.isFrozen(e)) return JSON.stringify(bo(e));
  let t = Do.get(e);
  return t === void 0 && Do.set(e, t = JSON.stringify(bo(e))), t;
}
const Du = {
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
    const r = oa(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (_r(r.value), { kind: "ok", value: r.value });
  },
  encode: _n,
  equals: (e, t) => e === t || _n(e) === _n(t)
}, _o = [ua, _t, Gn, on], _u = { kind: "sent", proof: "native-publication-processed" };
const Cu = {
  eventEndpoints: _o,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (f) => Ou(f).filter((g) => _o.includes(g.endpointID));
    async function m(f, g, S = !1) {
      if (a || g.aborted) return { kind: "cancelled" };
      const b = c(f), v = t && !S ? c(t) : [], A = (M) => M.find((D) => D.endpointID === on)?.value, j = v.length > 0 && JSON.stringify(A(v)) === JSON.stringify(A(b)), _ = [];
      for (const M of b) {
        if (!j) {
          _.push(M);
          continue;
        }
        if (M.endpointID !== on)
          if (M.endpointID === _t) {
            const D = M.value, Z = v.find((ee) => ee.endpointID === M.endpointID && ee.value.slotId === D.slotId), Y = Z ? Z.value.values : [], pe = D.values.flatMap((ee, ge) => Object.is(ee, Y[ge]) ? [] : [ge]);
            pe.length === 1 ? _.push({
              endpointID: Gn,
              value: { slotId: D.slotId, paramIndex: pe[0], value: D.values[pe[0]] }
            }) : pe.length > 1 && _.push(M);
          } else JSON.stringify(M.value) !== JSON.stringify(v.find((D) => D.endpointID === M.endpointID)?.value) && _.push(M);
      }
      t = void 0;
      for (const M of _) {
        if (a || g.aborted) return { kind: "cancelled" };
        const D = M.endpointID === _t || M.endpointID === Gn ? { ...Object(M.value), deliverySerial: ++r } : M.value, Z = e.send({ kind: "event", endpoint: M.endpointID, value: D }), Y = Z.kind === "submitted" ? await Z.completion : Z;
        if (Y.kind !== "sent") return Y;
      }
      return a || g.aborted ? { kind: "cancelled" } : (t = f, _u);
    }
    function d(f, g, S = !1) {
      const b = s.then(() => m(f, g, S));
      return s = b.catch(() => {
      }), b;
    }
    const h = e.listen("runtimeState", (f) => {
      const g = f !== null && typeof f == "object" ? Reflect.get(f, "dspSessionId") : void 0;
      if (typeof g != "number" || g === o) return;
      const S = o !== void 0;
      o = g;
      const b = i;
      S && n && d(n, e.signal, !0).then((v) => {
        v.kind === "failed" && b === i && e.report(v);
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
function Cn(e, t) {
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
const Lu = {
  ...Cn("A", 0),
  ...Cn("B", 1),
  ...Cn("C", 1),
  ...Object.fromEntries(hr().map((e) => [e, 0])),
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
  [da]: Dr(),
  [Se]: hn()
}, Nu = [
  { id: "init", name: "Init", values: Lu }
], Ia = "bounce.v1", Pu = "cosimo.bounce", ju = 1, Sa = "cosimo.patch-document", ka = 1;
function ce(e, t) {
  if (!e) throw new Error(t);
}
function je(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Xe(e, t = "value") {
  return e === null || typeof e == "boolean" || typeof e == "string" ? e : typeof e == "number" ? (ce(Number.isFinite(e), `${t} must be finite JSON data`), e) : Array.isArray(e) ? e.map((n, r) => Xe(n, `${t}[${r}]`)) : (ce(je(e), `${t} must be JSON-compatible`), Object.fromEntries(
    Object.keys(e).sort().map((n) => [n, Xe(e[n], `${t}.${n}`)])
  ));
}
function Aa(e, t) {
  if (typeof e != "string") return Xe(e, t);
  try {
    return Xe(JSON.parse(e), t);
  } catch (n) {
    throw new Error(`${t} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function Fu(e) {
  return JSON.stringify(Xe(e));
}
function Uu({ parameters: e, storedState: t } = {}) {
  ce(je(e), "Bounce patch parameters must be an object"), ce(je(t), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(e).sort()) {
    const i = e[r];
    ce(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), ce(
      typeof i == "number" && Number.isFinite(i),
      `Bounce parameter ${r} must be finite`
    ), n[r] = i;
  }
  return Object.freeze({
    format: Sa,
    version: ka,
    parameters: Object.freeze(n),
    storedState: Object.freeze(Xe(t, "storedState"))
  });
}
function zu(e) {
  const t = Aa(e, "Bounce patch document");
  return ce(
    je(t) && t.format === Sa && t.version === ka,
    "Unsupported Bounce patch document"
  ), ce(
    Object.keys(t).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), Uu(t);
}
function Ta(e) {
  const t = Aa(e, Ia);
  ce(
    je(t) && t.format === Pu && t.version === ju,
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
  ce(
    Object.keys(t).sort().join(",") === n.sort().join(","),
    "bounce.v1 has unexpected fields"
  ), ce(
    typeof t.digest == "string" && /^[0-9a-f]{64}$/.test(t.digest),
    "bounce.v1 digest must be lowercase SHA-256"
  ), ce(
    Number.isInteger(t.generation) && t.generation > 0,
    "bounce.v1 generation must be positive"
  ), ce(
    Number.isInteger(t.bankByteLength) && t.bankByteLength > 0,
    "bounce.v1 bankByteLength must be positive"
  ), ce(
    Array.isArray(t.roots) && t.roots.length > 0 && t.roots.every((a) => Number.isInteger(a) && a >= 0 && a <= 127),
    "bounce.v1 roots are invalid"
  ), ce(
    Array.isArray(t.segments) && t.segments.length === t.roots.length,
    "bounce.v1 segments must match roots"
  );
  let r = 0;
  t.segments.forEach((a, s) => {
    ce(
      je(a) && a.rootNote === t.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), ce(
    je(t.capture) && Number.isInteger(t.capture.sampleRate) && t.capture.sampleRate > 0 && typeof t.capture.tempoBpm == "number" && t.capture.tempoBpm > 0 && t.capture.velocity === 100 && Number.isInteger(t.capture.holdFrames) && t.capture.holdFrames > 0 && Number.isInteger(t.capture.tailCapFrames) && t.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), ce(je(t.revertRef), "bounce.v1 revertRef is invalid");
  const i = t.revertRef.bankDigest;
  ce(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = zu(t.revertRef.patchDocument);
  return Object.freeze({
    ...Xe(t),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function Ku(e) {
  return Fu(Ta(e));
}
const $u = L("sourceMode", { preset: !1 });
function Ea(e) {
  if (e !== null && typeof e == "object") {
    for (const t of Object.values(e)) Ea(t);
    Object.freeze(e);
  }
  return e;
}
const Co = /* @__PURE__ */ new WeakMap();
function Ln(e) {
  let t = Co.get(e);
  return t === void 0 && Co.set(e, t = Ku(e)), t;
}
const Vu = {
  parse(e) {
    if (e === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: Ea(Ta(e)) };
    } catch (t) {
      return { kind: "error", message: t instanceof Error ? t.message : String(t) };
    }
  },
  encode: (e) => e === null ? null : Ln(e),
  equals: (e, t) => e === t || e !== null && t !== null && Ln(e) === Ln(t)
}, Bu = Je({ initial: null, codec: Vu, preset: !1 }), Hu = Object.freeze({
  ...Object.fromEntries(qt.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, L(t)]))),
  ...Object.fromEntries(hr().map((e) => [e, L(e)])),
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
  sourceMode: $u,
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
}), qu = ks({
  ...Hu,
  [qe]: Gr({ initial: Dt(), codec: Zl, prepare: (e) => e, engine: Yd }),
  [da]: Gr({
    initial: Dr(),
    codec: Mu,
    dependencies: hr(),
    prepare: (e, { parameters: t }) => wu(e, t),
    engine: Cu
  }),
  [Se]: Je({ initial: hn(), codec: Du }),
  [Ia]: Bu,
  ...Ds({ factory: Nu, initial: "init" }),
  ...Ps()
});
function Te(e, t) {
  if (!e)
    throw new Error(t);
}
function Nn(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function Wu(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function Zn(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Oa(e) {
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
function Gu() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function Pn(e, t) {
  const n = Gu();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (Wu(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function Lo(e) {
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
  throw new Error(`Unsupported text resource payload (${Oa(e)})`);
}
function Ju(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return Zn(e);
  throw new Error(`Unsupported binary resource payload (${Oa(e)})`);
}
function Yu(e) {
  const t = e?.frames;
  Te(
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
      Te(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function xa(e) {
  const t = new DataView(e);
  Te(Nn(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), Te(Nn(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, c = null, m = 12;
  for (; m + 8 <= t.byteLength; ) {
    const h = Nn(t, m, 4), f = t.getUint32(m + 4, !0), g = m + 8;
    h === "fmt " ? (n = t.getUint16(g, !0), r = t.getUint16(g + 2, !0), i = t.getUint32(g + 4, !0), a = t.getUint16(g + 12, !0), o = t.getUint16(g + 14, !0)) : h === "data" && (s = g, c = f), m = g + f + f % 2;
  }
  Te(n !== null, "Wave file is missing a fmt chunk"), Te(s !== null && c !== null, "Wave file is missing a data chunk"), Te(r === 1, "Only mono wavetable bank files are supported");
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
async function No(e) {
  Te(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return Te(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function er(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function wa(e) {
  const t = new Uint8Array(e).buffer, n = xa(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Qu(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => (Te(typeof e.readResource == "function", `Resource bridge cannot read ${c}`), e.readResource(c)), i = async (c) => {
    Te(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const m = await e.readResourceAsAudioData(c);
    return Yu(m);
  }, o = (c) => {
    const m = e.getResourceAddress?.(c);
    return m ?? null;
  }, a = async (c, m = e.getResourceAddress?.(c)) => {
    const d = Pn(c, m), h = await No(d), f = xa(h);
    return {
      sampleRate: f.sampleRate,
      samples: f.samples
    };
  }, s = async (c, m = e.getResourceAddress?.(c)) => {
    const d = Pn(c, m);
    return new Uint8Array(await No(d));
  };
  return {
    async readText(c) {
      if (t === "bridge" && typeof e.readResource == "function")
        return Lo(await r(c));
      const m = o(c);
      return t === "url" && m !== null ? er(await s(c, m)) : typeof e.readResource == "function" ? Lo(await r(c)) : er(await s(c, m));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof e.readResource == "function" ? Ju(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(c);
      const m = o(c);
      return n === "url" && m !== null ? a(c, m) : typeof e.readResourceAsAudioData == "function" ? i(c) : wa(await this.readBytes(c));
    },
    getURL(c) {
      return Pn(c, e.getResourceAddress?.(c));
    }
  };
}
function Xu(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return Qu(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Zu(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return er(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return Zn(await t(a));
      if (n)
        return Zn(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : wa(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function ef(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function tf(e) {
  return ef(e) ? Zu(e) : Xu(e);
}
const Wt = 2048;
function bt(e, t) {
  if (!e)
    throw new Error(t);
}
function nf(e) {
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
const rf = 2048, sn = 11, of = 256;
function Re(e, t) {
  if (!e)
    throw new Error(t);
}
function af(e) {
  return e > 0 && (e & e - 1) === 0;
}
const Po = /* @__PURE__ */ new Map();
function sf(e) {
  const t = Po.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return Po.set(e, r), r;
}
function Ra(e, t, n = !1) {
  const r = e.length;
  Re(r === t.length, "FFT real and imaginary buffers must have the same length"), Re(af(r), "FFT input length must be a power of two");
  const i = sf(r);
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
        const S = d + g, b = S + a, v = e[b], A = t[b], j = h * v - f * A, _ = h * A + f * v, M = e[S], D = t[S];
        e[S] = M + j, t[S] = D + _, e[b] = M - j, t[b] = D - _;
        const Z = h * c - f * m;
        f = h * m + f * c, h = Z;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Ma(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function cf(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = rf,
  maxFramesPerTable: r = of
} = {}) {
  const i = Float32Array.from(e);
  Re(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  Re(o > 0, "Source wavetable files must contain at least one frame"), Re(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && Re(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, m = c + n;
    a.push(Ma(i.slice(c, m)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function jo(e) {
  const t = Ma(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Ra(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Da(e, t, {
  mipLevelCount: n = sn
} = {}) {
  const r = e?.real?.length ?? 0;
  Re(r > 0, "Spectrum must contain real samples"), Re(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), Re(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = e.real[s], a[s] = e.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = e.real[c], a[c] = e.imaginary[c]);
  }
  return Ra(o, a, !0), Float32Array.from(o);
}
async function Fo(e) {
  const t = [];
  for (const n of [...e].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      t.push(r);
    }
  return t;
}
async function lf(e, t) {
  const n = [];
  try {
    for (const i of t) {
      const o = await i(e);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await Fo(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await Fo(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const Gt = 256, It = 2048, _a = 8, df = 12811, tr = (_a + Gt * df) * 4;
function Uo(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function uf(e, t, n) {
  if (e.byteLength !== tr || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Gt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    sn,
    Gt
  ]);
  let i = _a;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let m = 0; m < sn; ++m) {
    const d = Math.min(It, Math.max(256, (1 << m) * 32)), h = It / d;
    for (let f = 0; f < t.frameCount; ++f) {
      const g = Da(n(f), m), S = i + f * (d + 1);
      for (let b = 0; b <= d; ++b) {
        const v = (b === d ? 0 : b) * h, A = (v + It - h) % It, j = (v + h) % It, _ = g[v], M = g[A], D = g[j];
        if (_ === void 0 || M === void 0 || D === void 0 || !Number.isFinite(_) || !Number.isFinite(M) || !Number.isFinite(D))
          throw new Error("Wavetable preparation produced invalid samples.");
        const Z = Math.fround(0.5 * Math.fround(D - M));
        r[S + b] = Uo(_, s, o) & 262143 | Uo(Z, c, a) << 18;
      }
    }
    i += (d + 1) * Gt;
  }
}
const ff = "runtimeSyncRequest", mf = 2147483647, pf = "runtimeState", hf = "retryDesiredTableRequest", gf = "workerLoadFailure", vf = "serviceLoadAbort", yf = "wavetableLoadBegin", bf = "wavetableMipFrame", If = "wavetableUploadAck", Sf = "wavetableMipRequest", kf = "wavetablePrewarmRequest", Af = "wavetablePrewarmNotification", Tf = "assets/factory-bank-catalog.json", nr = 3, Ef = 1, Of = nr * Wt, xf = 1, wf = 2, Rf = 3, Mf = 1, Df = 2, _f = 2e4, $t = xf, zo = wf, Ko = Rf, Pe = Mf, $o = Df, Cf = 48 * 1024 * 1024, jn = 3;
function Vo(e, t) {
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
function Bo(e) {
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
function Ho(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function qo(e, t) {
  if (!e)
    throw new Error(t);
}
function Lf(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function Nf(e, t) {
  return nf(await e.readJSON(t));
}
function Pf(e) {
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
function jf(e, t) {
  const n = Math.round(Number(e) || 0);
  return Lf(n, 0, Math.max(0, t - 1));
}
function Fn(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Ff(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Wo(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function Go(e) {
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
function Uf(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class zf {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = tf(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? Tf, this.maxBatchesInFlight = Vo(
      n.maxFramesInFlight,
      Ef
    ), this.mipLevelCount = n.mipLevelCount ?? sn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Cf) || 0)), this.serviceLoadTimeoutMs = Vo(n.serviceLoadTimeoutMs, _f), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(pf, this.handleRuntimeState), this.connection.addEndpointListener?.(If, this.handleUploadAck), this.connection.addEndpointListener?.(Sf, this.handleMipRequest), this.connection.addEndpointListener?.(kf, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Af, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ff,
      mf
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Nf(this.resourceClient, this.catalogPath), se("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < jn; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Wo(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Wo(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Fn(
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
          ...Go(this.serviceTable.frameCount),
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
          failurePhase: Ko,
          failureReasonCode: $o
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== Ko || t.failureReasonCode !== $o ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
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
    this.connection.sendEventOrValue?.(gf, {
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
    this.connection.sendEventOrValue?.(vf, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    se("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? Bo(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(hf, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = jf(t, r.tables.length), o = r.tables[i];
    qo(o, `Could not resolve table ${i}`);
    const a = Ff(o, Wt, this.mipLevelCount), s = this.tableCache.get(a);
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
    const m = await this.resourceClient.readAudio(o.sourceWav), d = cf(m.samples, {
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
    this.connection.sendEventOrValue?.(yf, {
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
      if (await Ld(this.connection, {
        input: t.oscillatorIndex,
        byteLength: tr
      }, (r) => {
        uf(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      se("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: tr,
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
        failurePhase: zo,
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
    for (let t = 0; t < jn; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Uf(() => {
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
    const n = Pf(t ?? {});
    if (se("info", "Received runtime state", Bo(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= jn)
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
          i.spectra[a] || (i.spectra[a] = jo(i.frames[a]));
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
    const c = Fn(
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
      ...Go(this.serviceTable.frameCount),
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), m = Math.trunc(Number(n.frameCount)), d = Fn(
      r,
      i,
      o,
      a,
      s
    ), h = this.mipJobs.get(d), f = this.serviceTable?.frameCount ?? 0, g = Math.min(
      nr,
      f - c
    );
    if (!(!h || h.completed || !h.inFlightBatchBases.has(c) || m <= 0 || m !== g)) {
      h.inFlightBatchBases.delete(c);
      for (let S = 0; S < m; S += 1) {
        const b = c + S;
        h.ackedFrames[b] || (h.ackedFrames[b] = 1, h.ackedFrameCount += 1);
      }
      h.ackedFrameCount === f && h.nextFrameIndex >= f && h.inFlightBatchBases.size === 0 && (h.completed = !0, this.activeUploadKey === h.key && (this.activeUploadKey = null)), Ho(c, m, f) && se("info", "Acknowledged wavetable mip batch", {
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
    if (qo(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = jo(this.serviceTable.frames[t]);
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
        nr,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Of);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Da(s, t.mipIndex);
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
            failurePhase: zo,
            failureReasonCode: Pe
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(bf, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Ho(n, r, this.serviceTable.frameCount) && se("info", "Sent wavetable mip batch", {
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
function Kf(e, t = {}) {
  return new zf(e, t);
}
async function $f(e, t = {}) {
  return lf(e, [
    () => Kf(e, { ...t, delivery: "shared" }),
    () => xs(qu, e, {
      onDefect: (n) => console.error("Cosimo state failed", At(n))
    })
  ]);
}
export {
  Ef as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  wf as FAILURE_PHASE_BUILD_MIP,
  xf as FAILURE_PHASE_LOAD_SOURCE,
  Rf as FAILURE_PHASE_TRANSFER_MIP,
  Mf as FAILURE_REASON_GENERIC,
  Df as FAILURE_REASON_TIMEOUT,
  nr as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  mf as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  zf as WavetableWorkerController,
  Kf as createWavetableWorkerController,
  $f as default
};
