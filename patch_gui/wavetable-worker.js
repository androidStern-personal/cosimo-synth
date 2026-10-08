function xe(e) {
  throw new Error(e);
}
function hn(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function wr(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function ka(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Rr(e, t) {
  return typeof t == "string" ? ka(t) : t instanceof ArrayBuffer ? new Uint8Array(t.slice(0)) : ArrayBuffer.isView(t) ? new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength)) : Array.isArray(t) ? Uint8Array.from(t) : xe(`The host returned ${e} in a form this kit cannot read.`);
}
function Mr(e, t) {
  const n = new DataView(t);
  (n.byteLength < 12 || hn(n, 0, 4) !== "RIFF" || hn(n, 8, 4) !== "WAVE") && xe(`${e} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, d = 0;
  for (let u = 12; u + 8 <= n.byteLength; ) {
    const g = hn(n, u, 4), f = n.getUint32(u + 4, !0), v = u + 8;
    g === "fmt " ? (r = n.getUint16(v, !0), i = n.getUint16(v + 2, !0), o = n.getUint32(v + 4, !0), a = n.getUint16(v + 14, !0)) : g === "data" && (s = v, d = Math.min(f, n.byteLength - v)), u = v + f + f % 2;
  }
  (s < 0 || r === 0) && xe(`${e} is missing its WAV format or data chunk.`), i !== 1 && xe(`${e} has ${i} channels; readAudio reads mono WAV files only.`);
  const p = t.slice(s, s + d);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(p, 0, Math.floor(d / 4)) };
  if (r === 1 && a === 16) {
    const u = new Int16Array(p, 0, Math.floor(d / 2));
    return { sampleRate: o, samples: Float32Array.from(u, (g) => g / 32768) };
  }
  return xe(`${e} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function Aa(e, t) {
  const n = t ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && xe(`The host decoded ${e} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : xe(`${e} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function Ta() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && URL.canParse("/", e)) return new URL("/", e);
  const t = new URL(import.meta.url);
  return t.pathname = t.pathname.replace(/\/[^/]*$/, "/"), t;
}
function _r(e, t, n) {
  return t instanceof URL ? t : typeof t == "string" && t.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t) ? new URL(t) : new URL(t.replace(/^\//, ""), n()) : new URL(e, n());
}
function Ko(e, t = {}) {
  const n = e ?? {};
  let r = t.patchRoot;
  const i = () => r ??= Ta(), o = async (s, d = n.getResourceAddress?.(s)) => {
    typeof fetch != "function" && xe(`Cannot read ${s}: this host has neither a resource bridge nor fetch.`);
    const p = _r(s, d, i), u = await fetch(p.toString());
    return u.ok || xe(`Could not read ${s} from ${p} (HTTP ${u.status}).`), u.arrayBuffer();
  }, a = async (s) => n.readResource ? Rr(s, await n.readResource(s)) : new Uint8Array(await o(s));
  return {
    async readText(s) {
      if (!n.readResource) return wr(new Uint8Array(await o(s)));
      const d = await n.readResource(s);
      return typeof d == "string" ? d : typeof d == "object" && d !== null && "text" in d && typeof d.text == "function" ? String(await d.text()) : wr(Rr(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    readBytes: a,
    async readAudio(s) {
      const d = n.getResourceAddress?.(s);
      return d != null && typeof fetch == "function" ? Mr(s, await o(s, d)) : n.readResourceAsAudioData ? Aa(s, await n.readResourceAsAudioData(s)) : Mr(s, new Uint8Array(await a(s)).buffer);
    },
    getURL(s) {
      return _r(s, n.getResourceAddress?.(s), i);
    }
  };
}
function bt(...e) {
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
function Dr(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function gn(e) {
  let t = !1, n;
  const r = () => n ??= Promise.resolve(e.transport.stop());
  let i, o;
  const a = /* @__PURE__ */ new Set();
  async function s(p, u, g) {
    const { signal: f } = g;
    if (e.onStatus(u, { kind: "preparing" }), f.aborted) return;
    const v = await Dr(e.prepare(p, f), f);
    if (v.kind === "cancelled" || f.aborted) return;
    const I = v.value;
    if (I.kind === "error") {
      e.onStatus(u, { kind: "failed", error: I.error });
      return;
    }
    let S = !0;
    g.applying = !0;
    let h;
    try {
      h = await Dr(e.transport.apply(I.value, {
        signal: f,
        send: (A) => f.aborted || !S ? { kind: "cancelled" } : A()
      }), f);
    } catch (A) {
      f.aborted || (t = !0, i?.cancel(), r(), e.onDefect(A), e.onStatus(u, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      S = !1, g.applying = !1;
    }
    h.kind === "value" && !f.aborted && h.value.kind !== "cancelled" && e.onStatus(u, h.value);
  }
  function d(p, u) {
    o = void 0;
    const g = i, f = { ...bt(), applying: !1, target: u };
    if (i = f, g?.cancel(), t || f.signal.aborted) return;
    const v = s(p, u, f).catch((I) => {
      f.signal.aborted || (f.cancel(), e.onDefect(I), e.onStatus(u, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    a.add(v), v.then(() => {
      if (a.delete(v), i !== f) return;
      i = void 0;
      const I = o;
      o = void 0, !t && I && d(I.input, I.target);
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
        d(p, u);
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
let Ea = 0;
function Lr(e, t) {
  const n = `atom${++Ea}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = Oa, r.write = xa), r;
}
function Oa(e) {
  return e(this);
}
function xa(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Uo = "a", Fe = "m", sn = "i", Xe = "c", Xn = "q", Zn = "Q", ze = "h", $o = "R", Vo = "W", Bo = "I", Ho = "M", Re = "e", dt = "f", Ze = "C", ut = "r", er = "d", cn = "w", ln = "D", dn = "t", un = "T", tr = "v", Nr = "g", Cr = "s", Pr = "b", wa = "B", nr = "p", qo = "H", Wo = "A", rr = "E";
function Go(e) {
  return "init" in e;
}
function Ra(e) {
  return typeof e.write == "function";
}
function Ma(e) {
  return !!e.onMount;
}
function jr(e) {
  return "v" in e || "e" in e;
}
function Gt(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function Jt(e) {
  return typeof e?.then == "function";
}
function _a(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function Jo(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function Yo(e, t, n) {
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
function Da(e) {
  return !!e.INTERNAL_onInit;
}
const La = (e, t, n, ...r) => n.read(...r), Na = (e, t, n, ...r) => n.write(...r), Ca = (e, t, n) => n.INTERNAL_onInit(t), Pa = (e, t, n, r) => n.onMount?.(r), ja = (e, t, n) => {
  const r = e[Uo];
  let i = r.get(n);
  if (!i) {
    const o = e[ze], a = e[Bo];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), Da(n) && a(e, t, n);
  }
  return i;
}, Fa = (e, t) => {
  const n = e[Fe], r = e[Xe], i = e[Xn], o = e[Zn], a = e[ze], s = e[Ze];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const d = [], p = (u) => {
    try {
      u();
    } catch (g) {
      d.push(g);
    }
  };
  do {
    a.f && p(a.f);
    const u = /* @__PURE__ */ new Set();
    for (const g of r) {
      const f = n.get(g)?.l;
      if (f)
        for (const v of f)
          u.add(v);
    }
    r.clear();
    for (const g of o)
      u.add(g);
    o.clear();
    for (const g of i)
      u.add(g);
    i.clear();
    for (const g of u)
      p(g);
    r.size && s(e, t);
  } while (r.size || o.size || i.size);
  if (d.length)
    throw typeof AggregateError == "function" ? new AggregateError(d) : Object.assign(new Error(), { errors: d });
}, za = (e, t) => {
  const n = e[Fe], r = e[sn], i = e[Xe], o = e[Re], a = e[ut], s = e[ln];
  if (!i.size)
    return;
  const d = [], p = [], u = /* @__PURE__ */ new WeakSet(), g = /* @__PURE__ */ new WeakSet(), f = [], v = [];
  for (const I of i)
    f.push(I), v.push(o(e, t, I));
  for (; f.length; ) {
    const I = f.length - 1, S = f[I], h = v[I];
    if (g.has(S)) {
      f.pop(), v.pop();
      continue;
    }
    if (u.has(S)) {
      r.get(S) === h.n && (d.push(S), p.push(h)), g.add(S), f.pop(), v.pop();
      continue;
    }
    u.add(S);
    for (const A of Yo(S, h, n))
      u.has(A) || (f.push(A), v.push(o(e, t, A)));
  }
  for (let I = d.length - 1; I >= 0; --I) {
    const S = d[I], h = p[I];
    let A = !1;
    for (const K of h.d.keys())
      if (K !== S && i.has(K)) {
        A = !0;
        break;
      }
    A && (r.set(S, h.n), a(e, t, S), s(e, t, S)), r.delete(S);
  }
};
const Ka = (e, t, n) => {
  const r = e[Fe], i = e[sn], o = e[Xe], a = e[ze], s = e[$o], d = e[Re], p = e[dt], u = e[Ze], g = e[ut], f = e[ln], v = e[tr], I = e[qo], S = e[rr], h = d(e, t, n), A = S[0];
  if (jr(h)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== h.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      h.m === A
    )
      return h.m = A, h;
    let N = !1;
    for (const [w, E] of h.d)
      if (g(e, t, w).n !== E) {
        N = !0;
        break;
      }
    if (!N)
      return h.m = A, h;
  }
  let K = !0;
  const C = new Set(h.d.keys()), _ = () => {
    for (const N of C)
      h.d.delete(N);
  }, M = () => {
    if (r.has(n)) {
      const N = !o.size;
      f(e, t, n), N && (u(e, t), p(e, t));
    }
  }, re = (N) => {
    if (N === n) {
      const E = d(e, t, N);
      if (!jr(E))
        if (Go(N))
          v(e, t, N, N.init);
        else
          throw new Error("no atom init");
      return Gt(E);
    }
    const w = g(e, t, N);
    try {
      return Gt(w);
    } finally {
      C.delete(N), h.d.set(N, w.n), Jt(h.v) && Jo(n, h.v, w), r.has(n) && r.get(N)?.t.add(n), K || M();
    }
  };
  let Y;
  const pe = {
    get signal() {
      return Y || (Y = new AbortController()), Y.signal;
    }
  }, Z = h.n, ge = i.get(n) === Z;
  try {
    const N = s(e, t, n, re, pe);
    if (v(e, t, n, N), Jt(N)) {
      I(e, t, N, () => Y?.abort());
      const w = () => {
        _(), M();
      };
      N.then(w, w);
    } else
      _();
    return a.r?.(n), h.m = A, h;
  } catch (N) {
    if (_a(N))
      throw N;
    return delete h.v, h.e = N, ++h.n, h.m = A, h;
  } finally {
    K = !1, h.n !== Z && ge && (i.set(n, h.n), o.add(n), a.c?.(n));
  }
}, Ua = (e, t, n) => {
  const r = e[Fe], i = e[sn], o = e[Re], a = [n];
  for (; a.length; ) {
    const s = a.pop(), d = o(e, t, s);
    for (const p of Yo(s, d, r)) {
      const u = o(e, t, p);
      i.get(p) !== u.n && (i.set(p, u.n), a.push(p));
    }
  }
}, $a = (e, t, n, r) => {
  const i = e[Xe], o = e[ze], a = e[Vo], s = e[Re], d = e[dt], p = e[Ze], u = e[ut], g = e[er], f = e[cn], v = e[ln], I = e[tr], S = e[rr];
  let h = !0;
  const A = (C) => Gt(u(e, t, C)), K = (C, ..._) => {
    const M = s(e, t, C);
    try {
      if (C === n) {
        if (!Go(C))
          throw new Error("atom not writable");
        const re = M.n, Y = _[0];
        I(e, t, C, Y), v(e, t, C), re !== M.n && (++S[0], i.add(C), g(e, t, C), o.c?.(C));
        return;
      } else
        return f(e, t, C, _);
    } finally {
      h || (p(e, t), d(e, t));
    }
  };
  try {
    return a(e, t, n, A, K, ...r);
  } finally {
    h = !1;
  }
}, Va = (e, t, n) => {
  const r = e[Fe], i = e[Xe], o = e[ze], a = e[Re], s = e[er], d = e[dn], p = e[un], u = a(e, t, n), g = r.get(n);
  if (g && u.d.size > 0) {
    for (const [f, v] of u.d)
      if (!g.d.has(f)) {
        const I = a(e, t, f);
        d(e, t, f).t.add(n), g.d.add(f), v !== I.n && (i.add(f), s(e, t, f), o.c?.(f));
      }
    for (const f of g.d)
      u.d.has(f) || (g.d.delete(f), p(e, t, f)?.t.delete(n));
  }
}, Ba = (e, t, n) => {
  const r = e[Fe], i = e[Xn], o = e[ze], a = e[Ho], s = e[Re], d = e[dt], p = e[Ze], u = e[ut], g = e[cn], f = e[dn], v = s(e, t, n);
  let I = r.get(n);
  if (!I) {
    u(e, t, n);
    for (const S of v.d.keys())
      f(e, t, S).t.add(n);
    if (I = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(v.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, I), Ra(n) && Ma(n)) {
      const S = () => {
        let h = !0;
        const A = (...K) => {
          try {
            return g(e, t, n, K);
          } finally {
            h || (p(e, t), d(e, t));
          }
        };
        try {
          const K = a(e, t, n, A);
          K && (I.u = () => {
            h = !0;
            try {
              K();
            } finally {
              h = !1;
            }
          });
        } finally {
          h = !1;
        }
      };
      i.add(S);
    }
    o.m?.(n);
  }
  return I;
}, Ha = (e, t, n) => {
  const r = e[Fe], i = e[Zn], o = e[ze], a = e[Re], s = e[un], d = a(e, t, n);
  let p = r.get(n);
  if (!p || p.l.size)
    return p;
  let u = !1;
  for (const g of p.t)
    if (r.get(g)?.d.has(n)) {
      u = !0;
      break;
    }
  if (!u) {
    p.u && i.add(p.u), p = void 0, r.delete(n);
    for (const g of d.d.keys())
      s(e, t, g)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return p;
}, qa = (e, t, n, r) => {
  const i = e[Re], o = e[Wo], a = i(e, t, n), s = "v" in a, d = a.v;
  if (Jt(r))
    for (const p of a.d.keys())
      Jo(n, r, i(e, t, p));
  a.v = r, delete a.e, (!s || !Object.is(d, a.v)) && (++a.n, Jt(d) && o(e, t, d));
}, Wa = (e, t, n) => {
  const r = e[ut];
  return Gt(r(e, t, n));
}, Ga = (e, t, n, ...r) => {
  const i = e[Xe], o = e[dt], a = e[Ze], s = e[cn], d = i.size;
  try {
    return s(e, t, n, r);
  } finally {
    i.size !== d && (a(e, t), o(e, t));
  }
}, Ja = (e, t, n, r) => {
  const i = e[dt], o = e[Ze], a = e[dn], s = e[un], p = a(e, t, n).l;
  return p.add(r), o(e, t), i(e, t), () => {
    p.delete(r), s(e, t, n), o(e, t), i(e, t);
  };
}, Ya = (e, t, n, r) => {
  const i = e[nr];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, Qa = (e, t, n) => {
  e[nr].get(n)?.forEach((o) => o());
}, Xa = /* @__PURE__ */ new WeakMap();
function Za(e) {
  const t = {
    get(s) {
      return i(r, t, s);
    },
    set(s, ...d) {
      return o(r, t, s, ...d);
    },
    sub(s, d) {
      return a(r, t, s, d);
    }
  }, n = {
    // store state
    [Uo]: /* @__PURE__ */ new WeakMap(),
    [Fe]: /* @__PURE__ */ new WeakMap(),
    [sn]: /* @__PURE__ */ new WeakMap(),
    [Xe]: /* @__PURE__ */ new Set(),
    [Xn]: /* @__PURE__ */ new Set(),
    [Zn]: /* @__PURE__ */ new Set(),
    [ze]: {},
    // atom interceptors
    [$o]: La,
    [Vo]: Na,
    [Bo]: Ca,
    [Ho]: Pa,
    // building-block functions
    [Re]: ja,
    [dt]: Fa,
    [Ze]: za,
    [ut]: Ka,
    [er]: Ua,
    [cn]: $a,
    [ln]: Va,
    [dn]: Ba,
    [un]: Ha,
    [tr]: qa,
    // store api
    [Nr]: Wa,
    [Cr]: Ga,
    [Pr]: Ja,
    [wa]: void 0,
    // abortable promise support
    [nr]: /* @__PURE__ */ new WeakMap(),
    [qo]: Ya,
    [Wo]: Qa,
    // store epoch
    [rr]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  Xa.set(t, r);
  const i = r[Nr], o = r[Cr], a = r[Pr];
  return t;
}
function es() {
  return Za();
}
const ts = /* @__PURE__ */ new Set(["closed", "open-failed", "opened", "replaced", "parameter", "attached-client", "detach", "command", "published"]);
function le(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function Qo(e, t = 1 / 0) {
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
function Xo() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= Qo(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Pn(e) {
  const t = Xo(), n = (r, i) => {
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
  return typeof e == "string" && e.length > 0 && Qo(e) <= 256;
}
function or(e) {
  return le(e) && Ae(e.owner) && oe(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function ns(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function rs(e) {
  if (!le(e) || !oe(e.id)) return;
  const t = or(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function os(e) {
  const t = or(e);
  return t && le(e) && oe(e.client) && oe(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function Fr(e) {
  if (!le(e) || !Array.isArray(e.parameters) || !le(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!le(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: s, defaultValue: d } = n;
    if (!Ae(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof d != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: s, defaultValue: d }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function is(e) {
  if (le(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = rs(e.expectedEntry);
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
function as(e) {
  if (!Pn(e) || !le(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (typeof e.kind == "string" && !ts.has(e.kind)) return { kind: "unknown", messageKind: e.kind };
  if (e.kind === "open-failed" && oe(e.request) && Ae(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && Ae(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = or(e.scope);
  if (e.kind === "opened" && t && oe(e.request)) {
    const n = Fr(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = Fr(e.native);
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
    const n = os(e.address);
    if (n) {
      const r = is(e.command);
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
function zr(e, t, n) {
  const r = n && t.scope && ns(n.scope, t.scope) ? n : void 0, i = {};
  for (const [o, a] of Object.entries(e)) {
    const s = t.fields[o], d = r?.fields[o];
    if (!(r && s === d))
      if (!s || !("value" in s)) i[o] = s;
      else if (d && "value" in d && d.version === s.version && Object.is(d.value, s.value)) {
        const { value: p, ...u } = s;
        i[o] = { ...u, valueUnchanged: !0 };
      } else i[o] = { ...s, value: a.kind === "stored" ? a.codec.encode(s.value) : s.value };
  }
  return { ...t, ...r ? { base: r.revision } : {}, fields: i };
}
function Kr(e) {
  const t = Xo(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
    if (t.node(a)) {
      if (o === null || typeof o == "boolean") return o;
      if (typeof o == "number") return Number.isFinite(o) ? o : void 0;
      if (typeof o == "string") return t.text(o) ? o : void 0;
      if (!(typeof o != "object" || n.has(o))) {
        n.add(o);
        try {
          if (Array.isArray(o) || o instanceof Float32Array || o instanceof Float64Array || o instanceof Int8Array || o instanceof Int16Array || o instanceof Int32Array || o instanceof Uint8Array || o instanceof Uint8ClampedArray || o instanceof Uint16Array || o instanceof Uint32Array) {
            if (!t.elements(o.length)) return;
            const d = [];
            for (const p of o) {
              const u = r(p, a + 1);
              if (u === void 0) return;
              d.push(u);
            }
            return d;
          }
          if (!le(o)) return;
          const s = /* @__PURE__ */ Object.create(null);
          for (const d in o) {
            if (!Object.hasOwn(o, d)) continue;
            if (!t.text(d)) return;
            const p = r(o[d], a + 1);
            if (p === void 0) return;
            s[d] = p;
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
const ss = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function cs(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !ss.has(e);
}
function Vt(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function ls(e) {
  return `The codec for "${e}" threw instead of returning { kind: "error" }; the edit was rejected.`;
}
const Zo = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), ei = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function L(e, t = {}) {
  return Object.freeze({ kind: "parameter", endpoint: e, ...t });
}
function Ge(e) {
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
function Ur(e) {
  const t = Ge({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history, preset: e.preset }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const o = e.engine, a = e.prepare, s = e.prepare, d = o.length;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: d ?? null }),
      prepare: d === void 0 ? s : (p, u) => ({
        length: d,
        write: (g) => a(p, g, u)
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
const ti = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function ds(e) {
  return e[ti] ?? {};
}
function ni(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function It(e) {
  return e.kind === "stored" && (e.lifetime ?? "project") === "project";
}
function us(e) {
  return Object.keys(e).filter((t) => e[t]?.preset !== !1);
}
function fs(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = ni(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !cs(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(e)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(e)) o.kind === "stored" && o[Zo]?.(e);
  const i = { ...e };
  for (const [o, a] of Object.entries(e)) {
    const s = a.kind === "stored" ? a[ei] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(e) }));
  }
  return Object.freeze(Object.defineProperty(i, ti, { value: Object.freeze({ ...t }) }));
}
const Ee = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function $r(e, t = {}) {
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
      } else o.kind === "failed" && a.finish(o.reason === "cancelled" || o.reason === "superseded" || o.reason === "stale-scope" ? { kind: "cancelled" } : Ee("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", i), {
    async prepare(o, a, s, d) {
      if (r || s.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(o.byteLength) || o.byteLength <= 0 || o.byteLength % 4 !== 0 || o.byteLength > 2147483647)
        return Ee("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const p = e.sharedData;
      if (!p) return Ee("This host does not support shared-data preparation.");
      let u;
      try {
        u = p.reserve(o.input, o.byteLength);
      } catch {
        return Ee("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let g = !1;
      try {
        if (u.byteLength !== o.byteLength) return Ee("The host supplied a differently sized shared allocation.");
        const f = d(u);
        if (f?.kind === "failed") return f;
        if (Vt(f)) return { kind: "failed", error: f.error };
        if (s.aborted || r) return { kind: "cancelled" };
        const v = new Promise((I) => {
          let S = () => {
          }, h;
          const A = (K) => {
            if (n.delete(u.id)) {
              if (clearTimeout(h), S(), K.kind !== "acknowledged")
                try {
                  p.cancel(u.id);
                } catch {
                  K = Ee("Cancellation of the shared resource could not be confirmed.");
                }
              I(K);
            }
          };
          n.set(u.id, { input: o.input, target: a, submitted: null, early: null, finish: A }), S = s.onAbort(() => A({ kind: "cancelled" })), n.has(u.id) && (h = setTimeout(() => A(Ee("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(u.id)) return v;
        try {
          const I = await Promise.race([
            Promise.resolve(p.commit(u.id)).then((A) => ({ kind: "submitted", receipt: A })),
            v.then((A) => ({ kind: "finished", outcome: A }))
          ]);
          if (I.kind === "finished") return I.outcome;
          const S = I.receipt;
          g = !0;
          const h = n.get(u.id);
          h && (!le(S) || S.kind !== "submitted" || S.id !== u.id || S.input !== o.input || S.generation !== u.id || typeof S.serial != "number" || !Number.isSafeInteger(S.serial) || S.serial <= 0 ? h.finish(Ee("The host returned an invalid shared-resource submission receipt.")) : (h.submitted = { generation: S.generation, serial: S.serial }, h.early && i(h.early)));
        } catch {
          n.get(u.id)?.finish(s.aborted ? { kind: "cancelled" } : Ee("The shared resource could not be submitted."));
        }
        return v;
      } finally {
        if (!g)
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
class ir {
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
    const r = new ir({ limit: this.#o, compare: this.#d });
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
function Pt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function Vr(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function Me(e, t, n = 0, r, i, o, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
class ri extends Error {
  constructor(t, n) {
    super(ls(t), { cause: n });
  }
}
function ht(e, t) {
  try {
    return t();
  } catch (n) {
    throw new ri(e, n);
  }
}
function ms(e, t) {
  const n = es(), r = {};
  for (const l of Object.keys(e)) r[l] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = Lr({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new ir({ limit: t.historyLimit, compare: (l, c) => l.order - c.order }),
    gestures: [],
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map(),
    parameterIntents: /* @__PURE__ */ new Map(),
    parameterAppliedIntents: /* @__PURE__ */ new Map(),
    parameterObservations: /* @__PURE__ */ new Map()
  }), o = Lr((l) => l(i).snapshot);
  let a = !1, s, d = 0, p = !1, u, g = [];
  const f = [], v = () => n.get(o), I = (l) => e[l]?.history !== !1, S = (l) => l.gestures.some((c) => c.keys.some(I)), h = (l, c) => l.gestures.find((m) => m.keys.includes(c)), A = (l, c, m) => m ? l.gestures.map((b) => b === c ? m : b) : l.gestures.filter((b) => b !== c), K = (l, c) => {
    const m = c.keys.filter(I).flatMap((b) => {
      const y = c.before.get(b), k = c.after.get(b);
      return N(b, y, k) ? [] : [{ key: b, before: y, after: k }];
    });
    return m.length ? l.record({ changes: m, order: c.order }) : l;
  }, C = (l, c, m, b) => m === void 0 || m === b || l !== void 0 && m >= (l.guardFloorVersions.get(c) ?? b) && m <= b, _ = (l, c, m = l.history) => {
    const b = m.undoEntry, y = m.redoEntry;
    return {
      ...l,
      history: m,
      snapshot: Object.freeze({
        ...l.snapshot,
        revision: l.snapshot.revision + 1,
        fields: Object.freeze(c),
        history: Object.freeze({
          canUndo: !a && !S(l) && b !== void 0 && b.changes.every((k) => c[k.key]?.readiness.kind === "ready"),
          canRedo: !a && !S(l) && y !== void 0 && y.changes.every((k) => c[k.key]?.readiness.kind === "ready"),
          ...l.snapshot.scope && b ? { undoEntry: Pt(l.snapshot.scope, b) } : {},
          ...l.snapshot.scope && y ? { redoEntry: Pt(l.snapshot.scope, y) } : {}
        })
      })
    };
  }, M = (l, c, m) => {
    if (c === m) return !1;
    const b = c && "value" in c ? c : void 0, y = m && "value" in m ? m : void 0;
    return b && y ? !Object.is(b.value, y.value) && !N(l, b.value, y.value) : b !== y;
  }, re = /* @__PURE__ */ new Map(), Y = (l, c, m = "edit") => {
    const b = n.get(i);
    if (l.snapshot === b.snapshot) {
      n.set(i, l);
      return;
    }
    const y = l.snapshot.scope, k = y !== null && (!b.snapshot.scope || !Ke(y, b.snapshot.scope)), R = Object.keys(e).filter((j) => M(j, b.snapshot.fields[j], l.snapshot.fields[j])), F = R.length ? Object.freeze({ reason: k ? "load" : m, keys: Object.freeze(R), revision: l.snapshot.revision }) : l.snapshot.lastChange, V = { ...l.snapshot.fields };
    if (y) for (const j of t.bindings ?? []) {
      const $ = V[j.key];
      if (!$) continue;
      const Q = b.snapshot.fields[j.key];
      if (!(k || j.key === c || !Q || Q.readiness.kind !== $.readiness.kind || "value" in $ && (!("value" in Q) || !Object.is($.value, Q.value)) || j.dependencies.some((T) => {
        const D = b.snapshot.fields[T], U = V[T];
        return D !== U && (!D || !U || !("value" in D) || !("value" in U) || !Object.is(D.value, U.value));
      }))) {
        const T = $.application ?? Q?.application, D = Q?.target ?? $.target;
        V[j.key] = $.application === T && $.target === D ? $ : Object.freeze({ ...$, ...T ? { application: T } : {}, ...D ? { target: D } : {} });
        continue;
      }
      const q = Object.freeze({ scope: y, key: j.key, generation: k ? 0 : (Q?.target?.generation ?? -1) + 1 }), W = {};
      let x = "value" in $ && $.readiness.kind === "ready";
      for (const T of j.dependencies) {
        const D = V[T];
        e[T]?.kind !== "parameter" || !D || !("value" in D) || D.readiness.kind !== "ready" || typeof D.value != "number" ? x = !1 : W[T] = D.value;
      }
      if (V[j.key] = Object.freeze({ ...$, target: q, application: Object.freeze({ kind: x ? "pending" : "waiting-for-inputs" }) }), x && "value" in $) {
        const T = k ? "load" : j.key === c ? re.get(j.key) ?? "edit" : m;
        re.set(j.key, T);
        const D = Object.freeze({ value: $.value, parameters: Object.freeze(W), reason: T });
        g.push(() => j.replace(D, q));
      } else g.push(() => j.cancel());
    }
    n.set(i, { ...l, snapshot: Object.freeze({ ...l.snapshot, fields: Object.freeze(V), ...F ? { lastChange: F } : {} }) });
  }, pe = (l, c, m, b) => {
    if (!l.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
    const y = { ...l.snapshot.fields }, k = new Map(l.publications), R = new Map(l.parameterIntents), F = [];
    for (const { key: P, value: q } of c) {
      const W = e[P], x = y[P];
      if (!W || !x) return { kind: "rejected", reason: "not-ready" };
      const T = "value" in x ? x : void 0;
      if (!T && b !== "recover") return { kind: "rejected", reason: "not-ready" };
      if (b === "history" && x.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      let D;
      if (W.kind === "parameter") {
        if (typeof q != "number") return { kind: "rejected", reason: "invalid-value" };
        D = h(l, P) ? [{ kind: "parameter", endpoint: W.endpoint, value: q }] : [
          { kind: "gesture-start", endpoint: W.endpoint },
          { kind: "parameter", endpoint: W.endpoint, value: q },
          { kind: "gesture-end", endpoint: W.endpoint }
        ];
      } else D = It(W) ? [{ kind: "stored", key: P, value: ht(P, () => W.codec.encode(q)) }] : [];
      const U = (T?.version ?? 0) + 1;
      if (D.length) {
        const ee = ++d;
        k.set(ee, { key: P, version: U }), W.kind === "parameter" && R.set(P, ee), F.push({ request: ee, scope: l.snapshot.scope, operations: D });
      }
      y[P] = Me(q, { kind: W.kind === "parameter" ? "host-managed" : It(W) ? "pending" : "not-written" }, U, T?.metadata, T?.gesture, W.kind === "parameter" ? { kind: "pending" } : void 0);
    }
    const V = _(l, y, m), j = c[0], $ = c.length === 1 && j ? y[j.key] : void 0, Q = {
      kind: "accepted",
      revision: V.snapshot.revision,
      ...$ && "version" in $ ? { version: $.version } : {},
      ...b !== "history" ? { changed: !0 } : {},
      ...(b === "edit" || b === "recall") && m.undoEntry && m.undoEntry !== l.history.undoEntry ? { historyEntry: Pt(l.snapshot.scope, m.undoEntry) } : {}
    };
    u = Q, Y({ ...V, publications: k, parameterIntents: R }, void 0, b === "recover" ? "edit" : b);
    for (const P of F)
      a || t.native.publish(P);
    return Q;
  }, Z = (l, c, m, b, y) => pe(l, [{ key: c, value: m }], b, y), ge = (l, c, m) => {
    const b = e[c];
    if (!b) return { kind: "error" };
    if (b.kind === "stored") return ht(c, () => b.codec.parse(m));
    const y = l.parameters.get(c);
    if (!y || typeof m != "number" || !Number.isFinite(m)) return { kind: "error" };
    const k = Math.min(y.max, Math.max(y.min, m));
    return { kind: "ok", value: y.step > 0 ? Math.min(y.max, Math.max(y.min, y.min + Math.round((k - y.min) / y.step) * y.step)) : k };
  };
  function N(l, c, m) {
    const b = e[l];
    return b?.kind === "stored" ? ht(l, () => b.codec.equals(c, m)) : Object.is(c, m);
  }
  const w = (l) => {
    const c = n.get(i);
    if (l.kind === "opened" || l.kind === "replaced") {
      if (c.snapshot.scope && (l.kind === "opened" || l.scope.owner !== c.snapshot.scope.owner || l.scope.document <= c.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const m = {}, b = /* @__PURE__ */ new Map();
      for (const [k, R] of Object.entries(e))
        if (R.kind === "parameter") {
          const F = l.native.parameters.find((V) => V.endpoint === R.endpoint);
          if (F && Vr(F)) {
            b.set(k, Object.freeze({ ...F }));
            const { min: V, max: j, step: $, defaultValue: Q } = F;
            m[k] = Me(F.value, { kind: "host-managed" }, 0, Object.freeze({ min: V, max: j, step: $, defaultValue: Q }), void 0, { kind: "unconfirmed" });
          } else m[k] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: F ? "invalid-state" : "missing-parameter" }) });
        } else {
          const F = c.snapshot.fields[k];
          if (!It(R) && l.kind === "replaced" && F && "value" in F) {
            m[k] = Me(F.value, { kind: "not-written" }, F.version);
            continue;
          }
          const V = It(R) && Object.hasOwn(l.native.values, k), j = V ? R.codec.parse(l.native.values[k]) : R.initial;
          if (j.kind === "ok") m[k] = Me(j.value, { kind: V ? "observed-in-native-state" : "not-written" });
          else {
            const $ = c.snapshot.fields[k], Q = l.kind === "replaced" && l.changedStoredKey !== void 0 && $ && "value" in $;
            m[k] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...Q ? { value: $.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const y = _(c, m, c.history.clear());
      Y({ ...y, gestures: [], detached: /* @__PURE__ */ new Set(), publications: /* @__PURE__ */ new Map(), parameterIntents: /* @__PURE__ */ new Map(), parameterAppliedIntents: /* @__PURE__ */ new Map(), parameterObservations: /* @__PURE__ */ new Map(), editOrder: 0, parameters: b, snapshot: Object.freeze({ ...y.snapshot, scope: Object.freeze({ ...l.scope }) }) });
    } else if (l.kind === "command") {
      if (!c.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!Ke(l.address, c.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (c.detached.has(l.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (l.command.kind === "undo" || l.command.kind === "redo") {
        if (S(c)) return { kind: "rejected", reason: "busy" };
        const P = l.command.kind === "undo", q = P ? c.history.undoEntry : c.history.redoEntry, W = l.command.expectedEntry;
        return W && (!q || !Ke(W.scope, c.snapshot.scope) || W.id !== q.order) ? { kind: "rejected", reason: "stale-history" } : q ? pe(
          c,
          q.changes.map((x) => ({ key: x.key, value: P ? x.before : x.after })),
          P ? c.history.undo() : c.history.redo(),
          "history"
        ) : { kind: "accepted", revision: c.snapshot.revision };
      }
      if (l.command.kind === "edit-many") {
        const P = [], q = /* @__PURE__ */ new Set(), { client: W } = l.address, x = l.command.gesture;
        if (!Array.isArray(l.command.edits) || l.command.edits.length === 0 || x !== void 0 && (l.command.history === !1 || l.command.recall)) return { kind: "rejected", reason: "invalid-command" };
        const T = x === void 0 ? void 0 : c.gestures.find((B) => B.client === W && B.gesture === x);
        if (x !== void 0 && !T) return { kind: "rejected", reason: "invalid-command" };
        for (const { key: B, value: ae, expectedVersion: de } of l.command.edits) {
          if (!Object.hasOwn(e, B) || q.has(B)) return { kind: "rejected", reason: "invalid-command" };
          q.add(B);
          const ve = c.snapshot.fields[B];
          if (!ve || !("value" in ve) || ve.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          const be = h(c, B);
          if (be && be !== T) return { kind: "rejected", reason: be.client === W ? "invalid-command" : "busy" };
          if (T && !be) return { kind: "rejected", reason: "invalid-command" };
          if (!C(be, B, de, ve.version)) return { kind: "rejected", reason: "stale-version" };
          const ke = ge(c, B, ae);
          if (ke.kind === "error") return { kind: "rejected", reason: "invalid-value" };
          N(B, ve.value, ke.value) || P.push({ key: B, before: ve.value, after: ke.value });
        }
        if (!P.length) return { kind: "accepted", revision: c.snapshot.revision, changed: !1 };
        const D = c.editOrder + 1, U = P.map(({ key: B, after: ae }) => ({ key: B, value: ae }));
        if (T) {
          const B = new Map(T.after);
          for (const { key: de, value: ve } of U) B.set(de, ve);
          const ae = A(c, T, { ...T, after: B, order: D });
          return pe(
            { ...c, gestures: ae, editOrder: D },
            U,
            P.some(({ key: de }) => I(de)) ? c.history.clearRedo() : c.history,
            "edit"
          );
        }
        const ee = l.command.history === !1 ? [] : P.filter(({ key: B }) => I(B));
        return pe({ ...c, editOrder: D }, U, ee.length ? c.history.record({ changes: ee, order: D }) : c.history, l.command.recall ? "recall" : "edit");
      }
      if (l.command.kind === "begin" || l.command.kind === "end") {
        const { keys: P, gesture: q } = l.command, { client: W } = l.address;
        if (!Array.isArray(P) || P.length === 0 || new Set(P).size !== P.length || !P.every((ue) => Object.hasOwn(e, ue))) return { kind: "rejected", reason: "invalid-command" };
        if (!Number.isSafeInteger(q) || q <= 0) return { kind: "rejected", reason: "invalid-command" };
        const x = {};
        for (const ue of P) {
          const te = c.snapshot.fields[ue];
          if (!te || !("value" in te) || te.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          x[ue] = te;
        }
        for (const ue of P) {
          const te = h(c, ue);
          if (te && te.client !== W) return { kind: "rejected", reason: "busy" };
          if (te && te.gesture !== q) return { kind: "rejected", reason: "invalid-command" };
        }
        const T = c.gestures.find((ue) => ue.client === W && ue.gesture === q);
        if (T && (T.keys.length !== P.length || !P.every((ue) => T.keys.includes(ue))))
          return { kind: "rejected", reason: "invalid-command" };
        const D = l.command.kind === "begin", U = P.length === 1 && P[0] !== void 0 ? x[P[0]] : void 0, ee = U ? { version: U.version } : {};
        if (D === !!T) return { kind: "accepted", revision: c.snapshot.revision, ...ee };
        let B, ae = c.history, de, ve;
        if (T)
          B = A(c, T), ae = K(ae, T), ae !== c.history && ae.undoEntry && (de = Pt(c.snapshot.scope, T));
        else {
          ve = Object.freeze({ client: W, gesture: q });
          const ue = new Map(P.map((te) => [te, x[te]?.value]));
          B = [...c.gestures, {
            ...ve,
            keys: Object.freeze([...P]),
            before: ue,
            after: ue,
            guardFloorVersions: new Map(P.map((te) => [te, x[te]?.version ?? 0])),
            order: 0
          }];
        }
        const be = { ...c.snapshot.fields };
        for (const [ue, te] of Object.entries(x))
          be[ue] = Me(te.value, te.persistence, te.version, te.metadata, ve, te.application, te.persistenceRequest);
        const ke = _({ ...c, gestures: B }, be, ae), pt = {
          kind: "accepted",
          revision: ke.snapshot.revision,
          ...ee,
          ...de ? { historyEntry: de } : {}
        };
        if (u = pt, Y({ ...ke, gestures: B }), a) return pt;
        const xr = P.flatMap((ue) => {
          const te = e[ue];
          return te?.kind === "parameter" ? [{ kind: D ? "gesture-start" : "gesture-end", endpoint: te.endpoint }] : [];
        });
        return xr.length && t.native.publish({ request: ++d, scope: c.snapshot.scope, operations: xr }), pt;
      }
      const { key: m } = l.command;
      if (!Object.hasOwn(e, m)) return { kind: "rejected", reason: "invalid-command" };
      const b = e[m], y = c.snapshot.fields[m];
      if (!b || !y) return { kind: "rejected", reason: "invalid-command" };
      if (l.command.kind === "retry") {
        if (!("value" in y) || y.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (l.command.expectedVersion !== y.version || l.command.expectedGeneration !== (y.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const P = y.persistence.kind === "failed" && y.persistenceRequest !== void 0;
        if (l.command.expectedPersistenceRequest !== (P ? y.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (P) {
          const x = b.kind === "parameter" ? [{ kind: "parameter", endpoint: b.endpoint, value: Number(y.value) }] : [{ kind: "stored", key: m, value: ht(m, () => b.codec.encode(y.value)) }], T = ++d, D = new Map(c.publications).set(T, { key: m, version: y.version }), U = _(c, { ...c.snapshot.fields, [m]: Object.freeze({
            ...y,
            persistence: Object.freeze({ kind: "pending" }),
            ...b.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), ee = { kind: "accepted", revision: U.snapshot.revision, version: y.version, changed: !1 };
          return u = ee, Y({ ...U, publications: D, parameterIntents: b.kind === "parameter" ? new Map(c.parameterIntents).set(m, T) : c.parameterIntents }), a || t.native.publish({ request: T, scope: c.snapshot.scope, operations: x }), ee;
        }
        if (y.application?.kind !== "failed" || y.application.error.kind === "defect" || !t.bindings?.some((x) => x.key === m))
          return { kind: "rejected", reason: "not-ready" };
        const q = _(c, c.snapshot.fields), W = { kind: "accepted", revision: q.snapshot.revision, version: y.version, changed: !1 };
        return u = W, Y(q, m), W;
      }
      if (l.command.kind === "recover") {
        if (l.command.expectedVersion !== 0 || Object.hasOwn(l.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (b.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in y && y.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (y.readiness.kind !== "failed" || y.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const { value: P } = l.command, q = ht(m, () => b.codec.parse(P));
        return q.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : Z(c, m, q.value, c.history, "recover");
      }
      if (!("value" in y) || y.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const k = y, R = h(c, m);
      if (R && R.client !== l.address.client) return { kind: "rejected", reason: "busy" };
      const { value: F, expectedVersion: V } = l.command;
      if (l.command.gesture !== void 0 && (!R || R.gesture !== l.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (R && l.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (!C(R, m, V, k.version)) return { kind: "rejected", reason: "stale-version" };
      const j = ge(c, m, F);
      if (j.kind === "error") return { kind: "rejected", reason: "invalid-value" };
      const $ = j.value;
      if (N(m, k.value, $)) return { kind: "accepted", revision: c.snapshot.revision, version: k.version, changed: !1 };
      const Q = c.editOrder + 1;
      if (R) {
        const P = A(c, R, { ...R, after: new Map(R.after).set(m, $), order: Q });
        return Z({ ...c, gestures: P, editOrder: Q }, m, $, I(m) ? c.history.clearRedo() : c.history, "edit");
      }
      return Z({ ...c, editOrder: Q }, m, $, I(m) ? c.history.record({ changes: [{ key: m, before: k.value, after: $ }], order: Q }) : c.history, "edit");
    } else if (l.kind === "engine") {
      const m = c.snapshot.fields[l.target.key];
      if (!m?.target || !Ke(m.target.scope, l.target.scope) || m.target.generation !== l.target.generation) return { kind: "accepted", revision: c.snapshot.revision };
      Y(_(c, {
        ...c.snapshot.fields,
        [l.target.key]: Object.freeze({ ...m, application: Object.freeze({ ...l.status }) })
      }));
    } else if (l.kind === "detached") {
      if (!c.snapshot.scope || !Ke(l.scope, c.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (c.detached.has(l.client)) return { kind: "accepted", revision: c.snapshot.revision };
      const m = c.gestures.filter((F) => F.client !== l.client), b = { ...c.snapshot.fields }, y = [];
      let k = c.history;
      for (const F of c.gestures)
        if (F.client === l.client) {
          k = K(k, F);
          for (const V of F.keys) {
            const j = b[V];
            j && "value" in j && (b[V] = Me(j.value, j.persistence, j.version, j.metadata, void 0, j.application, j.persistenceRequest));
            const $ = e[V];
            $?.kind === "parameter" && y.push({ kind: "gesture-end", endpoint: $.endpoint });
          }
        }
      const R = m.length === c.gestures.length ? c : _({ ...c, gestures: m }, b, k);
      return u = { kind: "accepted", revision: R.snapshot.revision }, Y({ ...R, gestures: m, detached: new Set(c.detached).add(l.client) }), !a && y.length > 0 && t.native.publish({ request: ++d, scope: c.snapshot.scope, operations: y }), u;
    } else if (l.kind === "parameter") {
      if (!c.snapshot.scope || !Ke(l.scope, c.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const [m, b] = [...c.parameters].find(([, j]) => j.endpoint === l.endpoint) ?? [];
      if (m === void 0 || b === void 0) return { kind: "accepted", revision: c.snapshot.revision };
      if (!Vr({ ...b, value: l.value })) return { kind: "rejected", reason: "invalid-value" };
      if (!Number.isSafeInteger(l.intent) || l.intent < 0 || !Number.isSafeInteger(l.observation) || l.observation < 0 || l.origin !== "owner" && l.origin !== "external") return { kind: "rejected", reason: "invalid-command" };
      if (l.observation <= (c.parameterObservations.get(m) ?? -1)) return { kind: "accepted", revision: c.snapshot.revision };
      const y = new Map(c.parameterObservations).set(m, l.observation);
      if (l.origin === "owner" || l.intent < (c.parameterIntents.get(m) ?? 0))
        return Y({ ...c, parameterObservations: y }), { kind: "accepted", revision: c.snapshot.revision };
      const k = c.snapshot.fields[m];
      if (!k || !("value" in k)) return { kind: "accepted", revision: c.snapshot.revision };
      const R = Object.is(k.value, l.value) ? c : _(c, {
        ...c.snapshot.fields,
        [m]: Me(l.value, { kind: "host-managed" }, k.version + 1, k.metadata, k.gesture, { kind: "unconfirmed" })
      }), F = h(c, m), V = F && R !== c ? A(c, F, { ...F, guardFloorVersions: new Map(F.guardFloorVersions).set(m, k.version + 1) }) : c.gestures;
      Y({ ...R, gestures: V, parameterObservations: y });
    } else {
      if (!c.snapshot.scope || !Ke(l.scope, c.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const m = c.publications.get(l.request);
      if (m) {
        const b = new Map(c.publications);
        b.delete(l.request);
        const y = new Map(c.parameterAppliedIntents), k = new Map(c.parameterIntents), R = new Map(c.parameterObservations), F = e[m.key];
        if (F?.kind === "parameter") {
          l.result.kind === "observed" && y.set(
            m.key,
            Math.max(l.request, y.get(m.key) ?? 0)
          );
          const j = l.observations?.find((Q) => Q.endpoint === F.endpoint);
          j && R.set(
            m.key,
            Math.max(R.get(m.key) ?? -1, j.observation)
          );
          let $ = y.get(m.key) ?? 0;
          for (const [Q, P] of b) P.key === m.key && ($ = Math.max($, Q));
          (l.result.kind === "observed" || j) && k.set(m.key, $);
        }
        const V = c.snapshot.fields[m.key];
        if (V && "value" in V && V.version === m.version) {
          const j = l.result.kind === "observed" ? { kind: e[m.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: l.result.reason }, $ = e[m.key]?.kind === "parameter" ? l.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: l.result.reason }) } : V.application, Q = _(c, { ...c.snapshot.fields, [m.key]: Object.freeze({
            ...Me(V.value, j, V.version, V.metadata, V.gesture, $),
            ...l.result.kind === "failed" ? { persistenceRequest: l.request } : {}
          }) });
          Y({ ...Q, publications: b, parameterIntents: k, parameterAppliedIntents: y, parameterObservations: R });
        } else Y({ ...c, publications: b, parameterIntents: k, parameterAppliedIntents: y, parameterObservations: R });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, E = (l) => {
    if (a) return;
    a = !0;
    let c = () => {
    };
    s = new Promise((k) => {
      c = k;
    });
    const m = [];
    for (const k of t.bindings ?? [])
      try {
        m.push(k.stop());
      } catch (R) {
        m.push(Promise.reject(R));
      }
    Promise.allSettled(m).then((k) => {
      for (const R of k) R.status === "rejected" && t.onDefect(R.reason);
      c();
    });
    const b = n.get(i), y = {};
    for (const [k, R] of Object.entries(b.snapshot.fields)) {
      const { gesture: F, ...V } = "value" in R ? R : { ...R, gesture: void 0 };
      y[k] = Object.freeze({ ...V, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ..._(b, y), gestures: [], publications: /* @__PURE__ */ new Map() });
    } catch (k) {
      t.onDefect(k);
    }
    if (l)
      try {
        t.native.update(v(), l);
      } catch (k) {
        t.onDefect(k);
      }
    t.native.close({ reason: "service-closed" });
  }, O = (l) => {
    try {
      return w(l);
    } catch (c) {
      if (!(c instanceof ri) || l.kind !== "command") throw c;
      return t.onDefect(c), { kind: "rejected", reason: "invalid-value" };
    }
  }, H = () => {
    if (!p) {
      p = !0;
      try {
        for (let l = f.shift(); l; l = f.shift()) {
          u = void 0, g = [];
          let c, m = !1;
          try {
            const b = n.get(i).snapshot;
            c = a ? { kind: "rejected", reason: "service-closed" } : O(l.event), u = c;
            for (const y of g)
              a || y();
            !a && (n.get(i).snapshot !== b || l.event.kind === "command") && (m = !0, t.native.update(v(), l.event.kind === "command" ? { address: l.event.address, result: c } : void 0));
          } catch (b) {
            c = u ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(b), E(!m && l.event.kind === "command" ? { address: l.event.address, result: c } : void 0);
          }
          l.finish(c);
        }
      } finally {
        p = !1;
      }
    }
  };
  return {
    getSnapshot: v,
    subscribe: (l) => n.sub(o, () => l(v())),
    dispatch: (l) => new Promise((c) => {
      f.push({ event: l, finish: c }), H();
    }),
    stop: () => (E(), s ?? Promise.resolve())
  };
}
const ps = 5e3;
function hs(e) {
  const t = /* @__PURE__ */ new Set();
  return (n) => {
    t.has(n) || (t.add(n), e(new Error(`Ignoring "${n}" state-channel messages, which this kit version does not understand.`)));
  };
}
function Ie(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function gs(e) {
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
function vs(e, t, n) {
  let r = !1, i = !1, o, a = 0, s = 0, d, p, u, g = () => {
  }, f = () => {
  };
  const v = /* @__PURE__ */ new Map();
  let I;
  const S = (w) => {
    if (!Pn(w)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: w });
  }, h = /* @__PURE__ */ new Map(), A = [], K = Ko(t);
  function C(w) {
    try {
      return w();
    } catch (E) {
      return n.onDefect(E), { kind: "failed", error: { kind: "defect", message: "Data preparation failed unexpectedly." } };
    }
  }
  async function _(w) {
    try {
      return { kind: "ok", value: await w() };
    } catch (E) {
      return n.onDefect(E), { kind: "error", error: { kind: "defect", message: "Preparation failed unexpectedly." } };
    }
  }
  for (const { key: w, input: E } of ni(e)) {
    const O = e[w];
    if (O?.kind !== "stored" || O.engine?.kind !== "shared-prepared") continue;
    const H = O.engine, l = gn({
      async prepare(c, m) {
        const b = await _(() => H.prepare(c.value, { resources: K, parameters: c.parameters, reason: c.reason, signal: m }));
        if (b.kind === "error") return b;
        const y = b.value;
        return Vt(y) ? { kind: "error", error: y.error } : !y || !Number.isSafeInteger(y.length) || y.length <= 0 || typeof y.write != "function" ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size or writer." } } : { kind: "ok", value: { plan: y, target: c.target } };
      },
      transport: {
        apply(c, m) {
          if (m.signal.aborted || !Ie(M.getSnapshot().scope, c.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          o ??= $r(t);
          const b = H.storage.type === "float32" ? c.plan.length * 4 : c.plan.length;
          return o.prepare({ input: E, byteLength: b }, c.target, m.signal, (y) => {
            const k = H.storage.type === "float32" ? new Float32Array(y.buffer, y.byteOffset, c.plan.length) : new Uint8Array(y.buffer, y.byteOffset, c.plan.length), R = C(() => c.plan.write(k));
            if (R) return R;
            if (k instanceof Float32Array && !k.every(Number.isFinite))
              return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
          });
        },
        stop() {
        }
      },
      onStatus(c, m) {
        M.dispatch({ kind: "engine", target: c, status: m });
      },
      onDefect(c) {
        n.onDefect(c), Z();
      }
    });
    A.push({
      key: w,
      dependencies: H.dependencies,
      replace(c, m) {
        l.replace({ ...c, target: m }, m);
      },
      cancel: l.cancel,
      stop: l.stop
    });
  }
  for (const [w, E] of Object.entries(e)) {
    if (E.kind !== "stored" || E.engine?.kind !== "event-value") continue;
    const O = E.engine, H = gn({
      async prepare(l, c) {
        const m = await _(() => O.prepare(l.value, { resources: K, parameters: l.parameters, reason: l.reason, signal: c }));
        if (m.kind === "error") return m;
        const b = m.value;
        if (Vt(b)) return { kind: "error", error: b.error };
        const y = Kr(b);
        return y.kind === "ok" ? { kind: "ok", value: { target: l.target, value: y.value } } : { kind: "error", error: { kind: "engine-rejected", message: y.message } };
      },
      transport: {
        apply(l, c) {
          return new Promise((m) => {
            let b = 0, y = () => {
            };
            const k = (R) => {
              y(), h.delete(b), m(R);
            };
            y = c.signal.onAbort(() => k({ kind: "cancelled" }));
            try {
              const R = c.send(() => Ie(M.getSnapshot().scope, l.target.scope) ? (b = ++a, h.set(b, { kind: "event-value", key: w, scope: l.target.scope, finish: k }), S({
                kind: "publish",
                request: b,
                scope: l.target.scope,
                operations: [{ kind: "event", endpoint: O.endpoint, value: l.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              R.kind !== "sent" && k(R);
            } catch (R) {
              y(), h.delete(b), n.onDefect(R), Z(), m({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const l of h.values()) l.key === w && l.finish({ kind: "cancelled" });
        }
      },
      onStatus(l, c) {
        M.dispatch({ kind: "engine", target: l, status: c });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: w,
      dependencies: O.dependencies,
      replace(l, c) {
        H.replace({ ...l, target: c }, c);
      },
      cancel: H.cancel,
      stop: H.stop
    });
  }
  const M = ms(e, {
    historyLimit: ds(e).historyLimit,
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(w) {
        const E = ++a;
        v.set(E, { request: w.request, scope: w.scope }), S({ kind: "publish", ...w, request: E, operations: w.operations.map((O) => O.kind === "parameter" ? { ...O, intent: w.request } : O) });
      },
      update(w, E) {
        w.scope && (S({
          kind: "update",
          scope: w.scope,
          revision: w.revision,
          state: zr(e, w, I),
          ...E ? { receipt: E } : {}
        }), I = w);
      },
      close(w) {
        i = !0, o?.stop();
        for (const E of h.values()) E.finish({ kind: "cancelled" });
        f(new Error("State service closed before native initialization completed."));
        try {
          r && M.getSnapshot().scope && S({ kind: "close", ...w });
        } catch (E) {
          n.onDefect(E);
        }
        r && t.removeEventListener("kit_state", pe), r = !1, v.clear();
      }
    }
  }), re = hs(n.onDefect), Y = (w) => {
    if (i) return;
    const E = as(w);
    if (E.kind === "unknown") {
      re(E.messageKind);
      return;
    }
    if (E.kind === "invalid") {
      const H = new Error(E.message);
      n.onDefect(H), f(H), Z();
      return;
    }
    const O = E.value;
    if (O.kind === "closed")
      f(new Error(`Native state service closed: ${O.reason}`)), Z();
    else if (O.kind === "open-failed") {
      if (O.request !== s || M.getSnapshot().scope) return;
      f(new Error(`Native state open failed: ${O.reason}`)), Z();
    } else if (O.kind === "opened") {
      if (O.request !== s || M.getSnapshot().scope) return;
      M.dispatch(O).then((H) => {
        H.kind === "accepted" ? g() : f(new Error("Native state could not initialize the service."));
      });
    } else if (O.kind === "attached-client") {
      const H = M.getSnapshot();
      if (!Ie(H.scope, O.scope)) return;
      S({
        kind: "snapshot",
        scope: O.scope,
        to: O.client,
        attachRequest: O.request,
        revision: H.revision,
        state: zr(e, H)
      }), I = void 0;
    } else if (O.kind === "detach")
      M.dispatch({ kind: "detached", scope: O.scope, client: O.client });
    else if (O.kind === "parameter")
      Ie(M.getSnapshot().scope, O.scope) && M.dispatch(O);
    else if (O.kind === "replaced")
      M.dispatch(O).then((H) => {
        if (H.kind !== "accepted") return;
        const l = M.getSnapshot().scope;
        for (const c of h.values())
          Ie(l, c.scope) || c.finish({ kind: "cancelled" });
        for (const [c, m] of v)
          Ie(l, m.scope) || v.delete(c);
      });
    else if (O.kind === "command")
      M.dispatch(O);
    else if (O.kind === "invalid-command")
      Ie(M.getSnapshot().scope, O.address) && S({
        kind: "receipt",
        address: O.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const H = h.get(O.request);
      if (H) {
        if (!Ie(H.scope, O.scope) || !Ie(M.getSnapshot().scope, O.scope)) return;
        if (H.kind === "custom" && O.result.kind === "failed" && (O.result.reason === "stale-scope" || O.result.reason === "closed")) {
          H.finish({ kind: "cancelled" });
          return;
        }
        H.finish(O.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: O.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: O.result.reason } });
        return;
      }
      const l = v.get(O.request);
      if (!l || !Ie(l.scope, O.scope) || !Ie(M.getSnapshot().scope, O.scope)) return;
      v.delete(O.request), M.dispatch({ ...O, request: l.request });
    }
  }, pe = (w) => {
    if (!i)
      try {
        Y(w);
      } catch (E) {
        n.onDefect(E), f(E), Z();
      }
  }, Z = () => u || (i = !0, f(new Error("State service stopped before native initialization completed.")), u = M.stop(), u);
  function ge(w) {
    n.onDefect(w), Z();
  }
  function N({ key: w, declaration: E }) {
    const O = E.delivery;
    let H, l = !1;
    const c = /* @__PURE__ */ new Set();
    function m() {
      const y = H;
      if (H = void 0, !y) return;
      const k = y.close();
      c.add(k), k.then(() => c.delete(k), (R) => {
        c.delete(k), ge(R);
      });
    }
    function b(y) {
      const k = Object.freeze({ ...y.scope }), R = bt(), F = R.signal;
      let V = y;
      function j(x, T) {
        if (x.signal.aborted || i || !Ie(M.getSnapshot().scope, k)) return { kind: "cancelled" };
        if (!T || typeof T != "object" || T.kind !== "event" && T.kind !== "host-effect")
          return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
        if (!(T.kind === "event" ? O.eventEndpoints.includes(T.endpoint) : O.hostEffects?.includes(T.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
        const U = Kr(T.value);
        if (U.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: U.message } };
        const ee = T.kind === "event" ? { kind: "event", endpoint: T.endpoint, value: U.value } : { kind: "host-effect", name: T.name, value: U.value }, B = { kind: "publish", request: a + 1, scope: k, operations: [ee] };
        if (!Pn(B)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
        const ae = ++a;
        let de = (be) => {
        };
        const ve = new Promise((be) => {
          let ke = () => {
          };
          de = (pt) => {
            h.delete(ae) && (ke(), be(pt));
          }, h.set(ae, { kind: "custom", key: w, scope: k, finish: de }), ke = x.signal.onAbort(() => de({ kind: "cancelled" }));
        });
        try {
          t.sendMessageToServer({ type: "kit_state", message: B });
        } catch (be) {
          const ke = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
          return de(ke), n.onDefect(be), ke;
        }
        return { kind: "submitted", completion: ve };
      }
      function $(x, T, D) {
        if (!O.outputEndpoints?.includes(T)) throw new Error("Undeclared engine output endpoint.");
        if (x.signal.aborted) return () => {
        };
        let U = !0, ee = () => {
        };
        const B = (de) => {
          if (!(!U || x.signal.aborted))
            try {
              D(de);
            } catch (ve) {
              ge(ve);
            }
        }, ae = () => {
          U && (U = !1, ee(), t.removeEndpointListener?.(T, B));
        };
        return ee = x.signal.onAbort(ae), t.addEndpointListener?.(T, B), ae;
      }
      const Q = K, P = {
        signal: F,
        send: (x) => j(R, x),
        listen: (x, T) => $(R, x, T),
        readStored(x) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          return F.aborted ? Promise.resolve(void 0) : new Promise((T) => {
            const D = F.onAbort(() => T(void 0));
            t.requestFullStoredState?.((U) => {
              D(), T(!F.aborted && le(U) && le(U.values) ? U.values[x] : void 0);
            });
          });
        },
        subscribeStored(x, T) {
          if (!O.storedKeys?.includes(x)) throw new Error("Undeclared stored-state input.");
          if (F.aborted) return () => {
          };
          let D = !0, U = () => {
          };
          const ee = (ae) => {
            if (!(!D || F.aborted || !le(ae) || ae.key !== x))
              try {
                T(ae.value);
              } catch (de) {
                ge(de);
              }
          }, B = () => {
            D && (D = !1, U(), t.removeStoredStateValueListener?.(ee));
          };
          return U = F.onAbort(B), t.addStoredStateValueListener?.(ee), B;
        },
        async prepareData(x, T, D, U) {
          if (!O.dataInputs?.includes(x)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
          const ee = U ? bt(F, U) : bt(F);
          try {
            return o ??= $r(t), await o.prepare({ input: x, byteLength: T }, { ...V, scope: k }, ee.signal, (B) => C(() => D(B)));
          } finally {
            ee.cancel();
          }
        },
        report(x) {
          F.aborted || M.dispatch({ kind: "engine", target: V, status: x });
        },
        fail(x) {
          F.aborted || ge(x);
        }
      };
      let q;
      try {
        q = O.create(P);
      } catch (x) {
        throw R.cancel(), x;
      }
      const W = gn({
        replacement: O.replacement,
        async prepare(x, T) {
          const D = await _(() => E.prepare(x.value, { resources: Q, parameters: x.parameters, reason: x.reason, signal: T }));
          if (D.kind === "error") return D;
          const U = D.value;
          return Vt(U) ? { kind: "error", error: U.error } : { kind: "ok", value: { value: U, target: x.target } };
        },
        transport: {
          async apply(x, T) {
            V = x.target;
            const D = bt(F, T.signal);
            try {
              return await q.apply(x.value, {
                signal: D.signal,
                send: (U) => j(D, U),
                listen: (U, ee) => $(D, U, ee)
              });
            } finally {
              D.cancel();
            }
          },
          stop() {
            return q.stop();
          }
        },
        onStatus(x, T) {
          M.dispatch({ kind: "engine", target: x, status: T });
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
        if (!l) {
          if ((!H || !Ie(H.scope, k.scope)) && (m(), H = b(k)), l) {
            m();
            return;
          }
          H.binding.replace({ ...y, target: k }, k);
        }
      },
      cancel: m,
      async stop() {
        l = !0, m(), await Promise.all(c);
      }
    };
  }
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (d) return d;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return Z(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      d = new Promise((w, E) => {
        g = () => {
          clearTimeout(p), w();
        }, f = (O) => {
          clearTimeout(p), E(O);
        };
      });
      try {
        const w = gs(e);
        if (w.some(({ declaration: E }) => E.delivery.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (w.some(({ declaration: E }) => E.delivery.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const E of w) A.push(N(E));
        r = !0, t.addEventListener("kit_state", pe), s = ++a, p = setTimeout(() => {
          f(new Error("Cmajor state-channel is unavailable: native open timed out.")), Z();
        }, ps), S({
          kind: "open",
          request: s,
          parameters: Object.values(e).filter((E) => E.kind === "parameter").map((E) => E.endpoint),
          storedKeys: Object.entries(e).filter(([, E]) => It(E)).map(([E]) => E),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((E) => E.kind === "stored" && E.engine?.kind === "event-value" ? [E.engine.endpoint] : []),
            ...w.flatMap((E) => E.declaration.delivery.eventEndpoints)
          ])],
          ...w.some((E) => E.declaration.delivery.hostEffects?.length) ? {
            hostEffects: [...new Set(w.flatMap((E) => E.declaration.delivery.hostEffects ?? []))]
          } : {}
        });
      } catch (w) {
        n.onDefect(w), f(w), Z();
      }
      return d;
    },
    /** Release this owner and its channel resources. */
    stop: Z
  };
}
const oi = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), jn = Reflect.get(globalThis, oi), Br = jn instanceof WeakMap ? jn : /* @__PURE__ */ new WeakMap();
jn !== Br && Object.defineProperty(globalThis, oi, { value: Br });
const lt = (e) => ({ kind: "ok", value: e }), Tt = (e) => ({ kind: "error", message: e }), Je = (e) => typeof e == "object" && e !== null && !Array.isArray(e);
function Yt(e) {
  if (e === null || typeof e == "boolean" || typeof e == "string") return e;
  if (typeof e == "number") return Number.isFinite(e) ? e : void 0;
  if (Array.isArray(e)) {
    const r = [];
    for (const i of e) {
      const o = Yt(i);
      if (o === void 0) return;
      r.push(o);
    }
    return Object.freeze(r);
  }
  if (!Je(e)) return;
  const t = Object.getPrototypeOf(e);
  if (t !== Object.prototype && t !== null) return;
  const n = {};
  for (const [r, i] of Object.entries(e)) {
    const o = Yt(i);
    if (o === void 0) return;
    n[r] = o;
  }
  return Object.freeze(n);
}
function Et(e, t) {
  if (Object.is(e, t)) return !0;
  if (Array.isArray(e) || Array.isArray(t))
    return Array.isArray(e) && Array.isArray(t) && e.length === t.length && e.every((o, a) => Et(o, t[a]));
  if (!Je(e) || !Je(t)) return !1;
  const n = e, r = t, i = Object.keys(n);
  return i.length === Object.keys(r).length && i.every((o) => Object.hasOwn(r, o) && Et(n[o], r[o]));
}
function ys(e) {
  const t = Je(e) ? Yt(e) : void 0;
  return t !== void 0 && Je(t) ? lt(t) : Tt("Preset values must be an object of JSON values.");
}
function ii(e) {
  if (!Je(e) || typeof e.id != "string" || e.id.length === 0 || typeof e.name != "string" || e.name.trim().length === 0)
    return Tt("A preset needs a non-empty id and name.");
  const t = ys(e.values);
  return t.kind === "ok" ? lt(Object.freeze({ id: e.id, name: e.name, values: t.value })) : t;
}
const bs = {
  parse(e) {
    if (!Je(e) || e.version !== 1 || !Array.isArray(e.presets)) return Tt("Expected a version 1 preset library.");
    const t = [];
    for (const n of e.presets) {
      const r = ii(n);
      if (r.kind === "error") return r;
      if (t.some((i) => i.id === r.value.id)) return Tt(`Preset id "${r.value.id}" appears twice.`);
      t.push(r.value);
    }
    return lt(Object.freeze({ version: 1, presets: Object.freeze(t) }));
  },
  encode: (e) => e,
  equals: (e, t) => Et(e, t)
}, Hr = {
  parse: (e) => e === null ? lt(null) : ii(e),
  encode: (e) => e,
  equals: (e, t) => Et(e, t)
};
function ai(e, t) {
  if (e.kind === "parameter")
    return typeof t == "number" && Number.isFinite(t) ? lt(t) : Tt("Expected a finite number.");
  const n = e.codec.parse(t);
  return n.kind === "ok" ? lt(e.codec.encode(n.value)) : n;
}
function Is(e, t, n) {
  if (t !== void 0 && !e.some((o) => o.id === t))
    throw new Error(`The initial preset "${t}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = us(n), i = /* @__PURE__ */ new Set();
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
      const d = ai(s, o.values[a]);
      if (d.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${d.message}`);
    }
  }
}
function Ss(e = {}) {
  const t = Object.freeze((e.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = e, r = Object.freeze({
    ...Ge({ codec: bs, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: t,
    [Zo]: (a) => Is(t, n, a)
  }), i = Ge({ codec: Hr, initial: null, preset: !1 }), o = t.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [ei]: (a) => Hr.parse({ id: o.id, name: o.name, values: ks(a, o) })
    })
  };
}
const qr = /* @__PURE__ */ new WeakMap();
function ks(e, t) {
  let n = qr.get(t);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(t.values)) {
      const a = e[i], s = a && ai(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), qr.set(t, n);
  }
  return n;
}
const As = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function Ts(e) {
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
        const o = typeof i == "object" ? Yt(Reflect.get(i, "values")) : void 0;
        if (typeof o != "object" || o === null || Array.isArray(o)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: o });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (t) => t,
    equals: (t, n) => Et(t, n)
  };
}
function Es(e) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (t) => t === null || typeof t == "string" ? { kind: "ok", value: typeof t == "string" && e.includes(t) ? t : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (t) => t,
    equals: Object.is
  };
}
function Os(e = {}) {
  const t = Object.freeze([...e.slots ?? As]);
  if (t.length === 0 || t.some((r) => typeof r != "string" || r.length === 0) || new Set(t).size !== t.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(t.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...Ge({ codec: Ts(t), initial: n, history: !1, preset: !1 }), slots: t }),
    activeSnapshot: Ge({ codec: Es(t), initial: null, preset: !1 })
  };
}
const $e = 2048, Ot = $e + 3, Wr = 20, si = "MSEG 1";
function ci(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function li(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function xt(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function xs(e) {
  return li(Number.isFinite(e) ? e : 0, -Wr, Wr);
}
function Ye(e) {
  return li(Number.isFinite(e) ? e : 0, 0, 1);
}
function di(e = si) {
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
function ws(e, t, n) {
  const r = ci(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Ye(i)), {
    x: i,
    y: Ye(Number(r.y)),
    curvePower: xs(Number(r.curvePower))
  };
}
function ar(e = di()) {
  const t = ci(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => ws(i, o, n.length));
  if (!xt(r[0].x, 0) || !xt(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : si,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Rs(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function Ms(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (xt(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && xt(e[o + 1].x, t); )
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
function _s(e, t) {
  const n = Ye(Number(t)), r = Ms(e, n);
  if (r.laterPointWins || xt(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Ye(Rs(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Ds(e, t) {
  return _s(ar(e).points, t);
}
function Ls(e) {
  const t = new Float32Array(Ot);
  return ui(e, t), t;
}
function ui(e, t) {
  if (t.length !== Ot) throw new Error("Invalid MSEG destination length.");
  const n = ar(e);
  for (let r = 0; r < $e; r += 1) {
    const i = r / ($e - 1);
    t[r + 1] = Ds(n, i);
  }
  t[0] = t[1], t[$e + 1] = t[$e], t[$e + 2] = t[$e];
}
const qe = -100, wt = 35, sr = 5, cr = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function fi(e) {
  const t = cr.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function Oe(e) {
  return fi(e).laneEndpointID;
}
function lr(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > sr)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${fi(e).hostStem}${t}OutputTrimDb`;
}
function dr() {
  return cr.flatMap((e) => Array.from(
    { length: sr },
    (t, n) => lr(e.deviceType, n + 1)
  ));
}
function Ns(e) {
  if (typeof e != "string")
    return null;
  for (const t of cr)
    for (let n = 1; n <= sr; n += 1)
      if (e === lr(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function mi(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Cs(e) {
  const t = (mi(e, qe, wt) - qe) / (wt - qe);
  return t * t;
}
function Ps(e) {
  const t = Math.sqrt(mi(e, 0, 1));
  return qe + t * (wt - qe);
}
const ye = (e, t) => ({ label: e, value: t });
function _e(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const De = Object.freeze({
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
  modulationDragStyle: s.modulationDragStyle
});
function Le(e, t, n) {
  return z(
    e,
    t,
    "Output Trim",
    "Trim",
    qe,
    wt,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const js = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Fs = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], zs = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: De.filter,
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
    iconUrl: De.drive,
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
    iconUrl: De.ott,
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
    iconUrl: De.chorus,
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
      z("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, { unit: "Hz", scale: "log", modulationTargetIndex: 17, modulationApplication: "semitones" }),
      Le("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: De.flanger,
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
    iconUrl: De.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      z("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [ye("Free", 0), ye("Sync", 1)] }),
      z("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      z("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: js.map(ye) }),
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
    iconUrl: De.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      z("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [ye("Free", 0), ye("Sync", 1)] }),
      z("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      z("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Fs.map(ye) }),
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
    iconUrl: De.reverb,
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
], fn = zs, pi = Object.freeze(
  fn.flatMap((e) => e.parameters)
);
new Map(
  pi.map((e) => [e.endpointID, e])
);
function Ks(e) {
  const t = fn.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function hi() {
  return pi;
}
const J = ["A", "B", "C"], ur = [
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
], Us = [
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
], et = Object.freeze([
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
]), $s = Object.freeze([
  ...J.flatMap((e) => ur.map(
    (t) => `osc${e}.${t}`
  )),
  ...Us
]);
new Set(
  J.flatMap((e) => ur.map(
    (t) => `osc${e}.${t}`
  ))
);
const gi = Object.freeze(
  $s.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), Vs = hi().filter(
  (e) => e.modulationTargetIndex !== null
), Bs = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function fr(e) {
  const t = Hs(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function Hs(e) {
  const t = Bs.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const qs = [
  ...Vs.map((e) => ({
    kind: fr(e.endpointID),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], vi = Object.freeze(
  qs.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), je = Object.freeze([
  ...gi,
  ...vi
]), Bt = et.length, yi = gi.length, mn = vi.length, Ws = Bt * je.length, Gs = new Map(et.map((e) => [e.id, e])), bi = new Map(et.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), ft = new Map(je.map((e) => [e.kind, e]));
function Js() {
  if (Bt !== 14 || yi !== 59 || mn !== 47 || Ws !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = et.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = je.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (Gs.size !== Bt || bi.size !== Bt || ft.size !== je.length)
    throw new Error("Modulation identities must be unique");
}
Js();
function Ii(e, t) {
  const n = bi.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function mr(e) {
  return typeof e != "string" ? null : ft.has(e) ? e : null;
}
function Ys(e) {
  const t = mr(e);
  return t !== null && ft.get(t)?.group === "voice" ? t : null;
}
function pr(e) {
  const t = mr(e);
  return t !== null && ft.get(t)?.group === "rack" ? t : null;
}
function Si(e) {
  const t = ft.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function ki(e) {
  const t = ft.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Qs(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Ai = 4, Xs = Ai * mn, Zs = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFrequencyHz", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), ec = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function tt(e) {
  if (typeof e != "string")
    return null;
  const t = ec.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Zs.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function hr(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function Ti(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function Ei(e) {
  if (e === null)
    return null;
  const t = Ti(e) - 1;
  return t > Ai ? null : t * mn + ki(hr(e));
}
const tc = 0, Ve = 2;
function Fn(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function nc(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function rc(...e) {
  return { ...di(...e), format: "cosimo.mseg.shape" };
}
function zn(...e) {
  return { ...ar(...e), format: "cosimo.mseg.shape" };
}
function Gr(e) {
  return JSON.stringify(zn(e));
}
function Jr(e, t) {
  return Gr(e) === Gr(t);
}
function oc(e) {
  const t = Number(e);
  return nc(
    Number.isFinite(t) ? t : 1,
    tc,
    Ve
  );
}
function Kn() {
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
function ic(e) {
  if (!e || typeof e != "object")
    return null;
  const t = Fn(e), n = Ye(Number(t.startX)), r = Ye(Number(t.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function ac(e = Kn()) {
  const t = Fn(e), n = Fn(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: oc(Number.isFinite(r) ? r : 1)
    },
    loop: ic(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
const vn = "modulationProgram", sc = "modulationAmount", Oi = et.filter((e) => e.group === "voice").length, xi = et.filter((e) => e.group === "macro").length, Qt = yi, cc = mn, Xt = cc + Xs, Be = Oi * Qt, ot = xi * Qt, lc = Oi * Xt, dc = xi * Xt, Ue = 512, nt = 256, wi = Be + ot;
function uc(e) {
  const t = Ii(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function fc(e) {
  const t = Ys(e);
  return t === null ? null : Si(t);
}
function Ri(e) {
  const t = fc(e.targetKind), n = pr(e.targetKind);
  let r = n === null ? void 0 : ki(n);
  if (r === void 0) {
    const a = Ei(
      tt(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Ii(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (t !== null) {
      const p = s * Qt + t;
      return {
        path: "macroVoice",
        cellIndex: p,
        sourceIndex: s,
        targetIndex: t,
        articulationCellIndex: Be + p
      };
    }
    const d = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Xt + d,
      sourceIndex: s,
      targetIndex: d,
      articulationCellIndex: null
    };
  }
  const i = uc(e);
  if (t !== null) {
    const a = i * Qt + t;
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
    cellIndex: i * Xt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Mi(e) {
  return tt(e.targetKind) !== null ? null : Ri(e).articulationCellIndex;
}
function mc(e) {
  if (pr(e.targetKind) !== null)
    return !1;
  const t = tt(e.targetKind);
  return t !== null && Ei(t) === null;
}
function pc(e) {
  return {
    ...Ri(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function _i(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (mc(n))
      continue;
    const r = pc(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function hc(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function it(e) {
  return [...e.values()].filter(hc).sort((t, n) => t.cellIndex - n.cellIndex);
}
function jt(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function yn(e) {
  const t = _i(e), n = it(t.voice), r = it(t.macroVoice), i = it(t.voiceRack), o = it(t.macroRack), a = Array.from({ length: Be }, () => 0), s = Array.from({ length: Be }, () => 0), d = Array.from({ length: Be }, () => 0), p = Array.from({ length: Be }, () => 0), u = Array.from({ length: Be }, () => 0);
  jt(n, a, s, d, p);
  const g = Array.from({ length: ot }, () => 0), f = Array.from({ length: ot }, () => 0), v = Array.from({ length: ot }, () => 0), I = Array.from({ length: ot }, () => 0), S = Array.from({ length: ot }, () => 0);
  if (jt(
    r,
    g,
    f,
    v,
    I
  ), i.length > Ue || o.length > nt)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${Ue}), ${o.length} macro-rack (max ${nt})`
    );
  const h = Array.from({ length: Ue }, () => 0), A = Array.from({ length: Ue }, () => 0), K = Array.from({ length: Ue }, () => 0), C = Array.from({ length: Ue }, () => 0), _ = Array.from({ length: Ue }, () => 0), M = Array.from({ length: lc }, () => 0);
  jt(
    i,
    h,
    A,
    K,
    C
  );
  const re = Array.from({ length: nt }, () => 0), Y = Array.from({ length: nt }, () => 0), pe = Array.from({ length: nt }, () => 0), Z = Array.from({ length: nt }, () => 0), ge = Array.from({ length: dc }, () => 0);
  jt(
    o,
    re,
    Y,
    pe,
    Z
  );
  for (const N of t.voice.values()) u[N.cellIndex] = N.amount;
  for (const N of t.macroVoice.values()) S[N.cellIndex] = N.amount;
  for (const N of t.voiceRack.values()) M[N.cellIndex] = N.amount;
  for (const N of t.macroRack.values()) ge[N.cellIndex] = N.amount;
  for (let N = 0; N < i.length; N += 1) {
    const w = i[N];
    if (w === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    _[N] = w.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: d,
    voiceRoutePolarities: p,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: g,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: v,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: S,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: h,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: K,
    voiceRackRoutePolarities: C,
    voiceRackRouteReducers: _,
    voiceRackRouteAmounts: M,
    macroRackRouteCount: o.length,
    macroRackRouteCells: re,
    macroRackRouteSources: Y,
    macroRackRouteTargets: pe,
    macroRackRoutePolarities: Z,
    macroRackRouteAmounts: ge
  };
}
const gc = ["voice", "macroVoice", "voiceRack", "macroRack"], vc = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Yr(e) {
  return _i(e);
}
function yc(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function bc(e, t) {
  if (e === null)
    return [{ endpointID: vn, value: yn(t) }];
  const n = Yr(e), r = Yr(t), i = [];
  for (const o of gc) {
    const a = it(n[o]), s = it(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: vn, value: yn(t) }];
    for (let d = 0; d < s.length; d += 1) {
      const p = a[d], u = s[d];
      if (p === void 0 || u === void 0 || !yc(p, u))
        return [{ endpointID: vn, value: yn(t) }];
      p.amount !== u.amount && i.push({
        endpointID: sc,
        value: {
          pathKind: vc[o],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return i;
}
function mt(e) {
  return { _tag: "ok", value: e };
}
function kt(e) {
  return { _tag: "err", error: e };
}
function Ic(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Sc(e) {
  throw new Error(e ?? "Invariant violated");
}
const kc = "globalTune", Ac = "globalTuneSemitones", Ne = -24, gt = 24, Qr = 0, Di = -48, Li = 48, Un = -48, Ni = 6, gr = 0, Xr = (gr - Un) / (Ni - Un), At = Object.freeze({
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
}), rt = 241;
function Tc(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function bn(e) {
  return At.minimumHz * Math.pow(
    At.maximumHz / At.minimumHz,
    Tc(e, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: rt }, (e, t) => {
    const n = t / (rt - 1), r = bn(n), i = bn(
      Math.max(0, t - 0.5) / (rt - 1)
    ), o = bn(
      Math.min(rt - 1, t + 0.5) / (rt - 1)
    );
    return {
      centerHz: r,
      lowHz: t === 0 ? At.minimumHz : i,
      highHz: t === rt - 1 ? At.maximumHz : o
    };
  })
);
const Ec = "voiceEnhancerFrequency", Oc = "voiceEnhancerQ", xc = "voiceEnhancerAmount", wc = "voiceEnhancerFrequencyOctaves", Rc = "voiceEnhancerQ", Mc = "voiceEnhancerAmount", Ci = "voice.enhancerFrequency", _c = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Ec,
    targetKind: wc,
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
    endpointID: Oc,
    targetKind: Rc,
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
    endpointID: xc,
    targetKind: Mc,
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
function Zr(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Dc(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function Ft(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Lc = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults,
      // 1000 Hz and Q 0.707107, so an instance sounds the same whether or
      // not its editor is open.
      Ft("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ft("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's filterMix default 1.0.
      Ft("mix", "Mix", 100, 100),
      Ft("drive", "Drive", 15, 0)
    ]
  }
], eo = 1e-6;
function Te(e, t) {
  if (!Number.isFinite(e) || e < -eo || e > 1 + eo)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function Zt(e, t) {
  return Te(e / 100, `${t} catalog percentage`);
}
function Dt(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function Nc(e) {
  return 20 * 1e3 ** e;
}
function Cc(e) {
  return Te(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Pc(e) {
  return 0.1 * 200 ** e;
}
function jc(e) {
  return Te(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Fc(e) {
  return e;
}
function zc(e) {
  return Te(e, "filterMix endpoint conversion");
}
function ct(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function Kc(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: ct("filterCutoff", Nc, Cc),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ct("filterQ", Pc, jc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: ct("filterMix", Fc, zc),
        // Articulations do not own Mix: capturing it would extend
        // the persisted articulation schema.
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
function Pi(e) {
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
      return Ic(e);
  }
}
function Uc(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function $c(e, t) {
  const n = Dt(e.moduleId, t.id), r = Pi(t.format), i = Kc(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: Zt(t.defaultPercent, n),
    initialValue: Zt(t.initialPercent, n),
    format: r,
    modAmount: Uc(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Vc = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Xr * 100, defaultPercent: Xr * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Bc(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Hc(e, t) {
  const n = `osc${e}`, r = Dt(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: Zt(t.defaultPercent, r),
    initialValue: Zt(t.initialPercent, r),
    format: Pi(t.format),
    modAmount: Bc(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const qc = Object.freeze(
  J.flatMap((e) => Vc.map((t) => Hc(e, t)))
), Wc = Object.freeze({
  targetId: Dt("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: Te(
    (Qr - Ne) / (gt - Ne),
    "Global Tune default"
  ),
  initialValue: Te(
    (Qr - Ne) / (gt - Ne),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: gt },
  modAmount: {
    min: Di,
    max: Li,
    unit: "st",
    digits: 2
  },
  binding: ct(
    kc,
    (e) => Ne + (gt - Ne) * e,
    (e) => Te(
      (e - Ne) / (gt - Ne),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Ac
});
function Gc(e) {
  const t = Dt("voice-enhancer", e.key), n = Te(
    Zr(e, e.initial),
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
    binding: ct(
      e.endpointID,
      (r) => Dc(e, r),
      (r) => Te(
        Zr(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Jc = Object.freeze(
  Object.values(_c).map(Gc)
), Yc = Object.freeze([
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
function Qc(e) {
  const t = Dt(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => Te(
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
    binding: ct(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const Xc = Object.freeze(
  Yc.map(Qc)
), Zc = Object.freeze([
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
function el(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function In(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? Cs(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return Te(n, `${e.endpointID} endpoint conversion`);
}
function tl(e, t) {
  return e.valueKind === "effect-output-trim-db" ? Ps(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function nl(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function rl(e) {
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
function ol(e) {
  const t = el(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: In(e, e.initial),
    initialValue: In(e, e.initial),
    format: nl(e),
    modAmount: rl(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => tl(e, n),
      fromEngine: (n) => In(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : fr(e.endpointID)
  });
}
const vr = Object.freeze(
  [
    ...fn.flatMap((e) => e.parameters.map(ol)),
    ...Zc,
    Wc,
    ...Jc,
    ...qc,
    ...Xc,
    ...Lc.flatMap(
      (e) => e.parameters.map(
        (t) => $c(e, t)
      )
    )
  ]
), il = new Map(
  vr.map((e) => [e.targetId, e])
), ji = vr.filter(
  (e) => e.modulationTargetKind !== null
), $n = new Map(
  ji.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (il.size !== vr.length)
  throw new Error("Target descriptor IDs must be unique");
if (ji.length !== je.length || $n.size !== je.length || je.some((e) => $n.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Sn(e) {
  const t = $n.get(e);
  return t === void 0 ? Sc(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  fn.map((e) => [e.id, e.label])
);
function al(e) {
  const t = Ti(e);
  return t === 1 ? "" : ` ${t}`;
}
function sl(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = Sn(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = tt(e);
  if (n !== null) {
    const r = Sn(hr(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${al(n)} ${r.label.toUpperCase()}`;
  }
  return Sn(e).label.toUpperCase();
}
const He = "modulation.v6", Fi = 6, Lt = 3, at = 3, cl = 4, to = "modulationMsegBuffer", ll = "modulationMsegPlayback", zi = 4, dl = ["MSEG 1", "MSEG 2", "MSEG 3"], Ki = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], ul = ["Env 1", "Env 2", "Env 3"], fl = 1e-3, ne = 10, ml = 0.1, pl = 20, no = 10 - 0.1, hl = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: pl - ml },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Di,
    max: Li
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
  mseg1Rate: { min: -Ve, max: Ve },
  mseg2Rate: { min: -Ve, max: Ve },
  mseg3Rate: { min: -Ve, max: Ve },
  env1Attack: { min: -ne, max: ne },
  env1Decay: { min: -ne, max: ne },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -ne, max: ne },
  env2Attack: { min: -ne, max: ne },
  env2Decay: { min: -ne, max: ne },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -ne, max: ne },
  env3Attack: { min: -ne, max: ne },
  env3Decay: { min: -ne, max: ne },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -ne, max: ne },
  ampAttack: { min: -ne, max: ne },
  ampDecay: { min: -ne, max: ne },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -ne, max: ne },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -no, max: no },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, gl = hi().filter((e) => e.modulationTargetIndex !== null), vl = new Map(
  gl.map((e) => [
    fr(e.endpointID),
    e
  ])
);
class kn extends Error {
  name = "ModulationStateParseError";
}
const yl = {
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
et.map((e) => ({
  value: e.id,
  label: yl[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const bl = je.map((e) => ({
  value: e.kind,
  label: sl(e.kind)
}));
bl.filter((e) => !Sl(e.value));
function Il(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function yr(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function An(e, t) {
  const n = Number(e);
  return yr(Number.isFinite(n) ? n : t, fl, ne);
}
function Sl(e) {
  return pr(e) !== null;
}
function kl(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function Al(e) {
  const t = tt(e);
  return t !== null ? hr(t) : e;
}
function Tl(e) {
  const t = Al(e);
  if (tt(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = vl.get(t);
  return n !== void 0 ? kl(n) : hl[Qs(t)];
}
function El(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Ol(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function xl(e, t) {
  const n = Tl(e), r = Number(t);
  return yr(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function wl(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Rl(e) {
  return wl(e) ?? "mseg";
}
function Ml(e) {
  const t = mr(e);
  return t !== null ? t : tt(e) !== null ? e : null;
}
function _l(e) {
  return Ml(e) ?? "oscA.wavetablePosition";
}
function Dl(e, t) {
  const n = Ki[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Ll(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Lt : e === "macro" ? zi : cl;
  return yr(Number.isFinite(n) ? n : 1, 1, r);
}
function st(e) {
  return {
    name: ul[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ui(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = st(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: An(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: An(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Ye(n.sustain ?? r.sustain),
    releaseSeconds: An(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Nl(e, t = 0) {
  return { name: Ui(e, t).name };
}
function Cl(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: El(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Ll(n, e.sourceSlot),
    polarity: Ol(e.polarity),
    targetKind: r,
    amount: xl(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function Pl(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Rl(r.sourceKind), o = _l(r.targetKind);
  return Cl(r, t, i, o);
}
function jl(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function Fl(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => Pl(n, r));
}
function zl(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = jl(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function Vn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, s) => Vn(a, t[s]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Il(r, a) && Vn(n[a], r[a]));
}
function $i(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = rc(dl[t] ?? `MSEG ${t + 1}`), i = zn(n.shapeA ?? r), o = ac({
    ...Kn(),
    ...n.playback ?? {},
    rate: Kn().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: zn(n.shapeB ?? i),
    playback: s
  };
}
function Rt() {
  return {
    format: "cosimo.modulation",
    version: Fi,
    msegSlots: Array.from({ length: Lt }, (e, t) => $i({}, t)),
    envelopeSlots: Array.from({ length: at }, (e, t) => ({
      name: st(t).name
    })),
    routes: [],
    macroNames: Ki.slice()
  };
}
function Kl(e = Rt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Fi,
    msegSlots: Array.from({ length: Lt }, (o, a) => $i(n[a], a)),
    envelopeSlots: Array.from({ length: at }, (o, a) => Nl(r[a], a)),
    routes: Fl(t.routes),
    macroNames: Array.from(
      { length: zi },
      (o, a) => Dl(i[a], a)
    )
  };
}
function Tn(e) {
  const t = en(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function en(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return kt(new kn("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return kt(new kn("Expected valid modulation JSON"));
    }
  }
  const n = Kl(t);
  return !Vn(t, n) || !zl(n.routes) ? kt(new kn("Expected the current modulation schema")) : mt(n);
}
function Ul(e, t) {
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
function ro(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Ls(n))
  };
}
function $l(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function oo(e, t = null, n) {
  const r = [];
  for (let i = 0; i < Lt; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !Jr(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: to,
      value: ro(i, 0, o.shapeA)
    }), (a === void 0 || !Jr(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: to,
      value: ro(i, 1, o.shapeB)
    }), (a === void 0 || !$l(a.playback, o.playback)) && r.push({
      endpointID: ll,
      value: Ul(i, o.playback)
    });
  }
  return r.push(...bc(t?.routes ?? null, e.routes)), r;
}
function Vi(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Vi(t);
    Object.freeze(e);
  }
}
const Vl = {
  parse(e) {
    const t = en(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (Vi(t.value), { kind: "ok", value: t.value });
  },
  encode: Tn,
  equals: (e, t) => Tn(e) === Tn(t)
}, Bl = [
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
], Hl = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function ql(e) {
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
function Wl(e, t, n) {
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
function Gl(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${ql(n)}`,
    runtimeTargetIndex: Si(r),
    oscillatorIndex: t
  });
}
function Jl(e, t) {
  const n = Object.freeze(Bl.map(
    (o) => Wl(e, t, o)
  )), r = Object.freeze(ur.map(
    (o) => Gl(e, t, o)
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
const Ht = Object.freeze(
  Hl.map(({ id: e, oscillatorIndex: t }) => Jl(e, t))
);
function Yl() {
  if (Ht.length !== J.length || Ht.some((t, n) => t.id !== J[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = Ht.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
Yl();
const En = "articulationSnapshot", ie = 128, io = 48, Ql = 1e6, me = -1, On = [
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
function br(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function xn(e) {
  return br(Number.isFinite(e) ? e : 0, 0, 1);
}
function he(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return br(Number.isFinite(i) ? i : t, n, r);
}
function fe(e, t, n, r) {
  return br(Math.round(he(e, t)), n, r);
}
function Bi(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function wn() {
  return Array.from({ length: ie }, () => me);
}
function Xl(e) {
  const t = fe(e, 0, 0, ie - 1), n = On[t % On.length], r = Math.floor(t / On.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function Zl() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: gr,
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
function ed(e) {
  const t = Zl(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: he(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: he(n.pan, t.pan, -1, 1),
    octave: fe(n.octave, t.octave, -4, 4),
    semitone: fe(n.semitone, t.semitone, -12, 12),
    fineCents: he(n.fineCents, t.fineCents, -100, 100),
    volumeDb: he(
      n.volumeDb,
      t.volumeDb,
      Un,
      Ni
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
      xn(Number(r[0])),
      xn(Number(r[1])),
      xn(Number(r[2]))
    ]
  };
}
function td(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: he(t.amount, 0, -48, 48)
  } : null;
}
function nd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(td).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: ed(t.parameters),
    envelopes: [0, 1, 2].map((i) => Ui(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function rd(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = fe(n.runtimeSlot, t, 0, ie - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Xl(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: nd(n.snapshot)
  };
}
function od(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: fe(n.note, 0, 0, ie - 1),
    articulationId: r
  } : null;
}
function id(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let s = fe(o.min, i, i, ie - 1), d = fe(o.max, s, i, ie - 1);
  return d < s && ([s, d] = [d, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: d
  };
}
function ao(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const d = id(
      i[s],
      t,
      s,
      n,
      r
    );
    !d || o.has(d.id) || (o.add(d.id), a.push(d));
  }
  return a;
}
function ad(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = od(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function sd(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let d = 0; d < n.length && o.length < ie; d += 1) {
    const p = rd(n[d], d);
    !p || r.has(p.runtimeSlot) || i.has(p.id) || (r.add(p.runtimeSlot), i.add(p.id), o.push(p));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((d) => d.id === t.selectedSlotId) ? t.selectedSlotId : null, s = new Set(o.map((d) => d.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Bi(t.activeTriggerMode),
    slots: o,
    chainAssignments: ao(t.chainAssignments, s, "chain", 0),
    keyAssignments: ad(t.keyAssignments, s),
    velocityAssignments: ao(t.velocityAssignments, s, "velocity", 1)
  };
}
function so(e) {
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
    volumeDbs: t(gr),
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
    routeAmounts: Array.from({ length: wi }, () => 0),
    envelopeAttackSeconds: Array.from({ length: at }, (n, r) => st(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: at }, (n, r) => st(r).decaySeconds),
    envelopeSustain: Array.from({ length: at }, (n, r) => st(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: at }, (n, r) => st(r).releaseSeconds)
  };
}
function co(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === me && (e[o] = i);
  }
}
function cd(e) {
  const t = sd(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = wn(), i = wn(), o = wn();
  co(r, t.chainAssignments, n), co(o, t.velocityAssignments, n);
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
function Hi(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : cd(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Bi(t.activeMode),
    chain: Array.from({ length: ie }, (n, r) => fe(t.chain?.[r], me, me, ie - 1)),
    key: Array.from({ length: ie }, (n, r) => fe(t.key?.[r], me, me, ie - 1)),
    velocity: Array.from({ length: ie }, (n, r) => r === 0 ? me : fe(t.velocity?.[r], me, me, ie - 1))
  });
}
function ld(e, t) {
  const n = Hi(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const Se = "articulations.v4", Ir = [
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
], Sr = [
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
], qi = [
  ...J.flatMap((e) => Ir.map(
    (t) => `osc${e}.${t}`
  )),
  ...Sr
];
class Wi extends Error {
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
  return kt(new Wi("malformed", e));
}
function Nt(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function kr(e, t, n) {
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
function tn(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < ie;
}
function dd(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function ud(e) {
  return qi.some((t) => t === e);
}
function lo(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = kr(e, ["min", "max"], t);
  return n !== null ? G(n) : tn(e.min) ? tn(e.max) ? e.min > e.max ? G(`${t}.min must be less than or equal to ${t}.max`) : mt({ min: e.min, max: e.max }) : G(`${t}.max must be an integer in 0..127`) : G(`${t}.min must be an integer in 0..127`);
}
function fd(e, t) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return G(`${t} has a non-string parameter id`);
    if (!ud(r))
      return G(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return G(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return mt(n);
}
function Gi(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Ji() {
  return {};
}
function md(e, t, n) {
  if (!Nt(e))
    return G(`${t} must be an object`);
  const r = Ji();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return G(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > io)
      return G(
        `${t}.${i} must be a finite route amount within ±${io}`
      );
    if (!n.has(i))
      return G(`${t}.${i} does not name a current articulable mapping`);
    Gi(r, i, o);
  }
  return mt(r);
}
function pd(e, t, n) {
  const r = `slots[${t}]`;
  if (!Nt(e))
    return G(`${r} must be an object`);
  const i = kr(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return G(i);
  if (typeof e.id != "string")
    return G(`${r}.id must be a string`);
  if (!tn(e.runtimeSlot))
    return G(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return G(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return G(`${r}.color must be a string`);
  if (!tn(e.key))
    return G(`${r}.key must be an integer in 0..127`);
  const o = lo(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = lo(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = fd(e.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const d = md(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return d._tag === "err" ? d : mt({
    id: e.id,
    runtimeSlot: e.runtimeSlot,
    name: e.name,
    color: e.color,
    key: e.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: d.value
  });
}
function hd(e) {
  const t = {};
  for (const n of qi) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function gd(e) {
  const t = Ji();
  for (const [n, r] of Object.entries(e))
    Gi(t, n, r);
  return t;
}
const vd = Object.fromEntries(
  Ir.map((e, t) => [e, 2 ** t])
), yd = Object.fromEntries(
  Sr.map((e, t) => [e, 2 ** t])
);
function uo(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function bd(e, t) {
  return Ir.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | vd[r] : n, 0);
}
function Id(e) {
  return Sr.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | yd[n] : t, 0);
}
function Sd(e, t) {
  const n = (o, a) => uo(e, `osc${o}.${a}`), r = (o) => uo(e, o), i = Array.from(
    { length: wi },
    () => Ql
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const s = t[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: J.map((o) => bd(e, o)),
    sharedOverrideMask: Id(e),
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
function kd(e, t) {
  return e.slots.map((n) => Sd(n, t));
}
function Yi(e, t) {
  if (!Nt(e))
    return G("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return G('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return kt(new Wi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = kr(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return G(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return G("selectedSlotId must be null or a string");
  if (!dd(e.activeTriggerMode))
    return G('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return G("slots must be an array");
  if (e.slots.length > ie)
    return G(`slots must contain at most ${ie} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const s = pd(e.slots[a], a, t);
    if (s._tag === "err")
      return s;
    const d = s.value;
    if (i.has(d.id))
      return G(`slots[${a}].id duplicates "${d.id}"`);
    if (o.has(d.runtimeSlot))
      return G(`slots[${a}].runtimeSlot duplicates ${d.runtimeSlot}`);
    i.add(d.id), o.add(d.runtimeSlot), r.push(d);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? G(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : mt({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function fo(e) {
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
      overrides: hd(t.overrides),
      routeAmounts: gd(t.routeAmounts)
    }))
  };
}
function pn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ad(e) {
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
async function Td(e, t, n, r = {}) {
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
const Ed = 3, Od = (4 + Ot) * 4;
function xd(e) {
  if (typeof e != "object" || e === null) return {};
  const t = Reflect.get(e, "values");
  return typeof t == "object" && t !== null && !Array.isArray(t) ? t : {};
}
const mo = "runtimeState";
function wd(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const po = "runtimeInstallAck", Qi = "runtimeSyncRequest", Bn = 0, Rd = 8e3, nn = /* @__PURE__ */ new WeakMap(), Xi = 1e9;
let zt = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Xi;
function Md(e) {
  return zt = zt % Xi + 1, e === "modulation" ? -1e9 - zt : 1e9 + zt;
}
function _d(e, t) {
  const n = e, r = nn.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), nn.set(n, r);
}
function ho(e, t) {
  const n = e, r = nn.get(n);
  r?.delete(t), r?.size === 0 && nn.delete(n);
}
const Dd = [100, 250, 500, 1e3], Kt = { _tag: "accepted" }, Ld = { _tag: "superseded" }, Nd = { _tag: "stopped" }, go = { _tag: "transport-timeout" };
function Cd(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, d = r.rejectionReason, p = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    d,
    p
  ].every((g) => typeof g == "number" && Number.isSafeInteger(g) && g >= -2147483648 && g <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof d != "number" || typeof p != "number" || i < 0 || o < 0 || a > 0 || d < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: d,
    syncSerial: p
  };
}
function Pd(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class vo {
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
    this.#o = r && r.length > 0 ? r : [...Dd], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Rd)
    );
  }
  start() {
    if (!this.#i) {
      _d(this.#t, this.#e);
      try {
        this.#h += 1, this.#i = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(po, this.#k);
      } catch (t) {
        throw this.#i = !1, ho(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(po, this.#k), ho(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#S();
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
    const r = Md(this.#e);
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
          return go;
        const d = this.#l;
        this.#b(r), await this.#I(
          d,
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
      for (const u of o) u();
      o.clear();
    }, d = {
      get aborted() {
        return a;
      },
      onAbort(u) {
        return a ? u() : o.add(u), () => {
          o.delete(u);
        };
      }
    };
    this.#m.add(s);
    const p = async () => {
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: d }) : this.#w(t.endpointID, Pd(t.value, n, i)));
    };
    try {
      let u = 0, g = 0, f = this.#p;
      for (await p(); ; ) {
        const v = this.#f(n, r);
        if (v)
          return v;
        const I = this.#v(n, i, f);
        if (I !== null)
          return I;
        const S = this.#l;
        await this.#I(
          S,
          this.#y(u)
        );
        const h = this.#v(
          n,
          i,
          f
        );
        if (h !== null)
          return h;
        let A = this.#l;
        for (this.#b(i); ; ) {
          const K = this.#f(n, r);
          if (K)
            return K;
          const C = await this.#I(
            A,
            this.#y(u)
          ), _ = this.#v(
            n,
            i,
            f
          );
          if (_ !== null)
            return _;
          if (C && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
            if (g >= 1)
              return go;
            f = this.#p, await p(), g += 1, u += 1;
            break;
          }
          if (C) {
            A = this.#l;
            continue;
          }
          C || (u += 1, A = this.#l, this.#b(i));
        }
      }
    } catch (u) {
      const g = this.#f(n, r);
      if (g) return g;
      throw u;
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
    return !this.#i || this.#h !== n ? Nd : this.#r !== t ? Ld : null;
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
        Bn
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#i)
      try {
        this.#t.sendEventOrValue?.(
          Qi,
          t,
          void 0,
          Bn
        );
      } catch {
      }
  }
  #R(t) {
    const n = Cd(t);
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
const jd = 1e3, Fd = [He, Se];
function Rn(e, t) {
  if (e === void 0) return pn();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = Yi(n, t);
  return r._tag === "ok" ? r.value : null;
}
function yo(e) {
  return new Set(e.routes.flatMap((t) => Mi(t) === null ? [] : [t.id]));
}
function bo(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Io(e, t) {
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
class zd {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new vo(t, { laneKind: "modulation" }), this.articulationLane = new vo(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Rt();
  articulationBank = pn();
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
    return this.frameworkInput ? [Se] : Fd;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(mo, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(mo, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(t) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || t !== this.lifecycleEpoch || (this.applyBootState(xd(n)), this.finishBoot());
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
    const n = t[He], r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Rt() } : en(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${He} is invalid; boot state was not installed.`);
      const a = t[Se], s = Rn(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = t[Se], o = Rn(
      i,
      yo(r.value)
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
    if (t === He) {
      const i = en(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${He}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Rn(n, yo(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${Se}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = wd(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Qi, 0, void 0, Bn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, d = this.frameworkInput?.curveCommand ? oo(r, s, this.frameworkInput.curveCommand) : oo(r, s), p = await this.modulationLane.sendBatch(d);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", p, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const h = Io("modulation", p);
      h && o?.(h), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const u = this.buildUploadsBySelector(r, i), g = Array.from({ length: ie }, (h, A) => {
      const K = u.get(A);
      return K ? bo(K) : null;
    }), f = this.lastAppliedArticulationGeneration !== n, v = f && this.articulationLane.getAcceptedFrontier() !== 0, I = [];
    for (let h = 0; h < ie; h += 1) {
      const A = u.get(h), K = g[h] !== this.lastAppliedArticulationTokens[h];
      v ? I.push({
        endpointID: En,
        value: A ?? so(h)
      }) : f ? A && I.push({ endpointID: En, value: A }) : K && I.push({
        endpointID: En,
        value: A ?? so(h)
      });
    }
    const S = await this.articulationLane.sendBatch(I);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", S, g)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = g;
        const h = Ad(i);
        if (this.frameworkInput) {
          const A = await this.frameworkInput.publishTriggerConfig(h);
          if (!this.started || t !== this.lifecycleEpoch) return;
          A.kind !== "cancelled" && o?.(A);
        } else
          ld(h, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const A of I) this.lastAppliedArticulationTokens[A.value.selectorA] = void 0;
        const h = Io("articulation", S);
        h && o?.(h);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = Mi(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      kd(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = bo(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, jd));
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
const Kd = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [Se],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = So(e);
    return {
      apply(n, r) {
        return t.closed && (t = So(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function So(e) {
  let t = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(f) {
    const v = r;
    r = void 0, v ? v(f) : f.kind !== "cancelled" && e.report(f);
  }
  function d() {
    t || (t = !0, g.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function p(f) {
    if (f.kind !== "submitted") {
      f.kind === "failed" && f.error.kind !== "transport" && (s(f), d());
      return;
    }
    i.add(f.completion), f.completion.then((v) => {
      i.delete(f.completion), !(t || v.kind === "sent") && (s(v), d());
    }, (v) => {
      t || (d(), e.fail(v));
    });
  }
  const u = {
    addEndpointListener(f, v) {
      const I = o.get(f) ?? /* @__PURE__ */ new Map();
      I.set(v, e.listen(f, v)), o.set(f, I);
    },
    removeEndpointListener(f, v) {
      o.get(f)?.get(v)?.(), o.get(f)?.delete(v);
    },
    addStoredStateValueListener(f) {
      a.set(f, e.subscribeStored(
        Se,
        (v) => f({ key: Se, value: v })
      ));
    },
    removeStoredStateValueListener(f) {
      a.get(f)?.(), a.delete(f);
    },
    requestFullStoredState(f) {
      e.readStored(Se).then((v) => {
        t || f({ values: { [Se]: v } });
      }, (v) => e.fail(v));
    },
    sendEventOrValue(f, v) {
      t || p(e.send({ kind: "event", endpoint: f, value: v }));
    }
  }, g = new zd(u, {
    onDefect(f) {
      d(), e.fail(f);
    },
    curveCommand: (f, v, I) => ({
      async submit({ dspSessionId: S, deliverySerial: h, signal: A }) {
        const K = await e.prepareData(
          Ed + f * 2 + v,
          Od,
          (C) => {
            new Int32Array(C.buffer, C.byteOffset, 4).set([1297302855, S, h, Ot]), ui(I, new Float32Array(C.buffer, C.byteOffset + 16, Ot));
          },
          A
        );
        K.kind === "failed" && (s(K), d());
      }
    }),
    async publishTriggerConfig(f) {
      const I = (await Promise.all(i)).find((h) => h.kind !== "sent");
      if (I) return I.kind === "failed" ? I : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const S = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Hi(f) });
      return S.kind === "submitted" ? S.completion : S;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(f, v) {
      if (t || v.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const I = ++n;
      return new Promise((S) => {
        const h = v.signal.onAbort(() => {
          s({ kind: "cancelled" }), d();
        });
        r = (A) => {
          h(), S(A);
        }, g.replaceModulation(f, (A) => {
          I === n && A.kind !== "preparing" && s(A);
        }), g.start();
      });
    },
    stop: d
  };
}
const Zi = 12, Ar = 5, ea = 8, Ud = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), ta = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    Oe("globalFilter")
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
    Oe("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    Oe("ott")
  ],
  chorus: [
    "chorusMix",
    "chorusMotionMode",
    "chorusBloomMode",
    "chorusTone",
    "chorusFeedback",
    "chorusRingAmount",
    "chorusRingFrequencyHz",
    "chorusRingKeyTrackEnabled",
    "chorusRingKeyTrackOffsetSemitones",
    Oe("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    Oe("flanger")
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
    Oe("phaser")
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
    Oe("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    Oe("reverb")
  ]
});
function Tr(e) {
  return ta[e];
}
function $d(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Ar)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * ea + Ud[e];
}
function Vd(e, t) {
  const n = new Array(Zi).fill(0);
  return ta[e].forEach((r, i) => {
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o))
      throw new Error(`Missing lane parameter value: ${e}.${r}`);
    n[i] = o;
  }), n;
}
const na = "lane.v1", rn = "laneTopology", Mt = "laneSlotParams", Hn = "laneSlotParamValue", ra = "laneOutputControl", qn = 16, Bd = 8, oa = 4, Hd = 3, ia = Ar * ea, aa = 4, qd = 4, Wd = ia, Gd = ia + aa, Jd = 0, Yd = 1, Qd = 2, Xd = 3, Zd = 4, eu = 5;
function tu(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > oa)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << Bd;
}
const Wn = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), on = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), nu = new Map(
  Object.entries(on).map(([e, t]) => [t, e])
), ru = Object.freeze([
  "voice.filterCutoff",
  Ci,
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
]), ou = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Ci]: "enhancer-frequency",
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
  ru.map((e) => [e, Object.freeze({
    id: e,
    family: ou[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const sa = 40, ca = 18e3, Gn = Wn.map((e) => on[e]), iu = /^([a-zA-Z]+)#([1-9][0-9]*)$/, au = /^(parallel|split)#([1-9][0-9]*)$/;
function Ct(e) {
  if (typeof e != "string")
    return null;
  const t = iu.exec(e);
  if (t === null)
    return null;
  const n = Gn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Ar ? null : { deviceType: n, instanceNumber: r };
}
function la(e) {
  if (typeof e != "string")
    return null;
  const t = au.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? aa : qd) ? null : { groupKind: n, unitNumber: r };
}
function We(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function _t(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function X(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function su(e, t) {
  const n = Ct(e);
  if (n === null)
    return { failure: X(`device id ${e} is not a pool instance`) };
  if (!We(t) || !_t(t, ["params"]) || !We(t.params))
    return { failure: X(`device ${e} must be { params }`) };
  const r = Tr(n.deviceType), i = t.params;
  if (Object.keys(i).length !== r.length || !r.every((s) => Object.hasOwn(i, s)))
    return { failure: X(`device ${e} must carry every parameter once`) };
  const a = {};
  for (const s of r) {
    const d = i[s];
    if (typeof d != "number" || !Number.isFinite(d))
      return { failure: X(`device ${e}.${s} must be a finite number`) };
    a[s] = d;
  }
  return { record: { params: a } };
}
function cu(e, t) {
  return !We(e) || e.kind !== "device" ? { failure: X("branches may hold device placements only") } : _t(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: X(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: X(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: X("a device placement is { kind, deviceId, enabled }") };
}
function ko(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= sa && e <= ca;
}
function da() {
  return { mix: 1, bypassed: !1 };
}
function lu(e) {
  return !We(e) || !_t(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function du(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (u) {
      const g = u instanceof Error ? u.message : String(u);
      return X(`is not valid JSON: ${g}`);
    }
  if (!We(t) || !_t(t, ["format", "version", "output", "devices", "chain"]))
    return X("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return X("must be cosimo.lane version 2");
  if (!We(t.devices))
    return X("devices must be an object");
  if (!Array.isArray(t.chain))
    return X("chain must be an array");
  const n = lu(t.output);
  if (n === null)
    return X("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const u of Reflect.ownKeys(t.devices)) {
    if (typeof u != "string")
      return X("device ids must be strings");
    const g = su(u, t.devices[u]);
    if ("failure" in g)
      return g.failure;
    r[u] = g.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let d = 0;
  const p = (u) => {
    const g = cu(u, i);
    return "placement" in g && (o.set(
      g.placement.deviceId,
      (o.get(g.placement.deviceId) ?? 0) + 1
    ), d += 1), g;
  };
  for (const u of t.chain) {
    if (!We(u))
      return X("chain nodes must be objects");
    if (u.kind === "device") {
      const h = p(u);
      if ("failure" in h)
        return h.failure;
      s.push(h.placement);
      continue;
    }
    if (u.kind !== "parallel" && u.kind !== "split")
      return X(`unknown chain node kind ${String(u.kind)}`);
    const g = u.kind === "split", f = g ? [
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
    if (!_t(u, f))
      return X(`a ${u.kind} group is { ${f.join(", ")} }`);
    const v = la(u.groupId);
    if (v === null || v.groupKind !== u.kind)
      return X(`group id ${String(u.groupId)} does not name a ${u.kind} unit`);
    if (a.has(String(u.groupId)))
      return X(`group ${String(u.groupId)} is used twice`);
    if (a.add(String(u.groupId)), typeof u.enabled != "boolean")
      return X(`group ${String(u.groupId)} needs a boolean enable`);
    const I = g ? Hd : oa;
    if (!Array.isArray(u.branches) || u.branches.length < 2 || u.branches.length > I)
      return X(`group ${String(u.groupId)} needs 2..${I} branches`);
    if (g && (!ko(u.xoverLowHz) || !ko(u.xoverHighHz)))
      return X(`group ${String(u.groupId)} crossovers must sit in ${sa}..${ca} Hz`);
    if (g && (typeof u.xoverLowKeyTrackEnabled != "boolean" || typeof u.xoverHighKeyTrackEnabled != "boolean" || typeof u.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(u.xoverLowKeyTrackOffsetSemitones) || typeof u.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(u.xoverHighKeyTrackOffsetSemitones)))
      return X(`group ${String(u.groupId)} Key Track state must be finite`);
    d += 1;
    const S = [];
    for (const h of u.branches) {
      if (!Array.isArray(h))
        return X(`group ${String(u.groupId)} branches must be arrays`);
      const A = [];
      for (const K of h) {
        const C = p(K);
        if ("failure" in C)
          return C.failure;
        A.push(C.placement);
      }
      S.push(A);
    }
    s.push(g ? {
      kind: "split",
      groupId: String(u.groupId),
      enabled: u.enabled,
      xoverLowHz: u.xoverLowHz,
      xoverHighHz: u.xoverHighHz,
      xoverLowKeyTrackEnabled: u.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: u.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: u.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: u.xoverHighKeyTrackOffsetSemitones,
      branches: S
    } : {
      kind: "parallel",
      groupId: String(u.groupId),
      enabled: u.enabled,
      branches: S
    });
  }
  for (const u of i)
    if ((o.get(u) ?? 0) !== 1)
      return X(`device ${u} must be placed exactly once`);
  return d > qn ? X(`flattens to ${d} wire entries; the topology upload holds ${qn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function uu() {
  const e = {};
  for (const t of Wn) {
    const n = on[t];
    e[`${n}#1`] = {
      params: bu(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: da(),
    devices: e,
    chain: Wn.map((t) => ({
      kind: "device",
      deviceId: `${on[t]}#1`,
      enabled: !1
    }))
  };
}
const Ao = ["distortion#1", "delay#1", "reverb#1"];
function Er() {
  const e = uu(), t = {};
  for (const n of Ao) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: da(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && Ao.includes(n.deviceId))
  };
}
function fu(e) {
  if (e === void 0)
    return Er();
  const t = du(e);
  return t._tag === "ok" ? t.value : null;
}
function Mn(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function mu(e) {
  return Object.keys(e.devices).map((t) => {
    const n = Ct(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Gn.indexOf(t.parsed.deviceType) - Gn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Jn(e) {
  const t = Ct(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return $d(t.deviceType, t.instanceNumber - 1);
}
function ua(e) {
  const t = la(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Wd : Gd) + (t.unitNumber - 1);
}
function pu(e) {
  const t = new Array(qn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    t[r] = tu(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Jn(o.deviceId), 0, o.enabled);
      continue;
    }
    i(ua(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const d of a)
        i(Jn(d.deviceId), s + 1, d.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function hu(e) {
  const t = new Array(Zi).fill(0);
  return t[Jd] = e.xoverLowHz, t[Yd] = e.xoverHighHz, t[Qd] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Xd] = e.xoverLowKeyTrackOffsetSemitones, t[Zd] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[eu] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function gu(e) {
  const t = [{
    endpointID: ra,
    value: e.output
  }];
  let n = 0;
  for (const r of mu(e)) {
    const i = Ct(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: lr(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[Oe(i.deviceType)]
    }), n += 1, t.push({
      endpointID: Mt,
      value: {
        slotId: Jn(r.instanceId),
        deliverySerial: n,
        values: Vd(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: Mt,
      value: {
        slotId: ua(r),
        deliverySerial: n,
        values: hu(r)
      }
    }));
  return t.push({
    endpointID: rn,
    value: pu(e)
  }), t;
}
function vu(e, t, n, r) {
  const i = e.devices[t], o = Ct(t);
  if (i === void 0 || o === null || !Tr(o.deviceType).includes(n) || !Number.isFinite(r))
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
function yu(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = Ns(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      wt,
      Math.max(qe, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = vu(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function bu(e) {
  const t = nu.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Ks(t).parameters;
  return Object.fromEntries(Tr(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function Or(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Or(t);
    Object.freeze(e);
  }
}
const Iu = {
  parse(e) {
    const t = fu(e);
    return t ? (Or(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Mn,
  equals: (e, t) => Mn(e) === Mn(t)
}, To = /* @__PURE__ */ new WeakMap();
function _n(e) {
  if (!Object.isFrozen(e)) return JSON.stringify(fo(e));
  let t = To.get(e);
  return t === void 0 && To.set(e, t = JSON.stringify(fo(e))), t;
}
const Su = {
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
    const r = Yi(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (Or(r.value), { kind: "ok", value: r.value });
  },
  encode: _n,
  equals: (e, t) => e === t || _n(e) === _n(t)
}, Eo = [ra, Mt, Hn, rn], ku = { kind: "sent", proof: "native-publication-processed" };
const Au = {
  eventEndpoints: Eo,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const d = (f) => gu(f).filter((v) => Eo.includes(v.endpointID));
    async function p(f, v, I = !1) {
      if (a || v.aborted) return { kind: "cancelled" };
      const S = d(f), h = t && !I ? d(t) : [], A = (_) => _.find((M) => M.endpointID === rn)?.value, K = h.length > 0 && JSON.stringify(A(h)) === JSON.stringify(A(S)), C = [];
      for (const _ of S) {
        if (!K) {
          C.push(_);
          continue;
        }
        if (_.endpointID !== rn)
          if (_.endpointID === Mt) {
            const M = _.value, re = h.find((Z) => Z.endpointID === _.endpointID && Z.value.slotId === M.slotId), Y = re ? re.value.values : [], pe = M.values.flatMap((Z, ge) => Object.is(Z, Y[ge]) ? [] : [ge]);
            pe.length === 1 ? C.push({
              endpointID: Hn,
              value: { slotId: M.slotId, paramIndex: pe[0], value: M.values[pe[0]] }
            }) : pe.length > 1 && C.push(_);
          } else JSON.stringify(_.value) !== JSON.stringify(h.find((M) => M.endpointID === _.endpointID)?.value) && C.push(_);
      }
      t = void 0;
      for (const _ of C) {
        if (a || v.aborted) return { kind: "cancelled" };
        const M = _.endpointID === Mt || _.endpointID === Hn ? { ...Object(_.value), deliverySerial: ++r } : _.value, re = e.send({ kind: "event", endpoint: _.endpointID, value: M }), Y = re.kind === "submitted" ? await re.completion : re;
        if (Y.kind !== "sent") return Y;
      }
      return a || v.aborted ? { kind: "cancelled" } : (t = f, ku);
    }
    function u(f, v, I = !1) {
      const S = s.then(() => p(f, v, I));
      return s = S.catch(() => {
      }), S;
    }
    const g = e.listen("runtimeState", (f) => {
      const v = f !== null && typeof f == "object" ? Reflect.get(f, "dspSessionId") : void 0;
      if (typeof v != "number" || v === o) return;
      const I = o !== void 0;
      o = v;
      const S = i;
      I && n && u(n, e.signal, !0).then((h) => {
        h.kind === "failed" && S === i && e.report(h);
      }, e.fail);
    });
    return {
      apply(f, v) {
        return i += 1, n = f, u(f, v.signal);
      },
      stop() {
        a = !0, g();
      }
    };
  }
};
function Dn(e, t) {
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
const Tu = {
  ...Dn("A", 0),
  ...Dn("B", 1),
  ...Dn("C", 1),
  ...Object.fromEntries(dr().map((e) => [e, 0])),
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
  [He]: Rt(),
  [na]: Er(),
  [Se]: pn()
}, Eu = [
  { id: "init", name: "Init", values: Tu }
], fa = "bounce.v1", Ou = "cosimo.bounce", xu = 1, ma = "cosimo.patch-document", pa = 1;
function ce(e, t) {
  if (!e) throw new Error(t);
}
function Pe(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Qe(e, t = "value") {
  return e === null || typeof e == "boolean" || typeof e == "string" ? e : typeof e == "number" ? (ce(Number.isFinite(e), `${t} must be finite JSON data`), e) : Array.isArray(e) ? e.map((n, r) => Qe(n, `${t}[${r}]`)) : (ce(Pe(e), `${t} must be JSON-compatible`), Object.fromEntries(
    Object.keys(e).sort().map((n) => [n, Qe(e[n], `${t}.${n}`)])
  ));
}
function ha(e, t) {
  if (typeof e != "string") return Qe(e, t);
  try {
    return Qe(JSON.parse(e), t);
  } catch (n) {
    throw new Error(`${t} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function wu(e) {
  return JSON.stringify(Qe(e));
}
function Ru({ parameters: e, storedState: t } = {}) {
  ce(Pe(e), "Bounce patch parameters must be an object"), ce(Pe(t), "Bounce patch storedState must be an object");
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
    format: ma,
    version: pa,
    parameters: Object.freeze(n),
    storedState: Object.freeze(Qe(t, "storedState"))
  });
}
function Mu(e) {
  const t = ha(e, "Bounce patch document");
  return ce(
    Pe(t) && t.format === ma && t.version === pa,
    "Unsupported Bounce patch document"
  ), ce(
    Object.keys(t).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), Ru(t);
}
function ga(e) {
  const t = ha(e, fa);
  ce(
    Pe(t) && t.format === Ou && t.version === xu,
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
      Pe(a) && a.rootNote === t.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), ce(
    Pe(t.capture) && Number.isInteger(t.capture.sampleRate) && t.capture.sampleRate > 0 && typeof t.capture.tempoBpm == "number" && t.capture.tempoBpm > 0 && t.capture.velocity === 100 && Number.isInteger(t.capture.holdFrames) && t.capture.holdFrames > 0 && Number.isInteger(t.capture.tailCapFrames) && t.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), ce(Pe(t.revertRef), "bounce.v1 revertRef is invalid");
  const i = t.revertRef.bankDigest;
  ce(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = Mu(t.revertRef.patchDocument);
  return Object.freeze({
    ...Qe(t),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function _u(e) {
  return wu(ga(e));
}
const Du = L("sourceMode", { preset: !1 });
function va(e) {
  if (e !== null && typeof e == "object") {
    for (const t of Object.values(e)) va(t);
    Object.freeze(e);
  }
  return e;
}
const Oo = /* @__PURE__ */ new WeakMap();
function Ln(e) {
  let t = Oo.get(e);
  return t === void 0 && Oo.set(e, t = _u(e)), t;
}
const Lu = {
  parse(e) {
    if (e === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: va(ga(e)) };
    } catch (t) {
      return { kind: "error", message: t instanceof Error ? t.message : String(t) };
    }
  },
  encode: (e) => e === null ? null : Ln(e),
  equals: (e, t) => e === t || e !== null && t !== null && Ln(e) === Ln(t)
}, Nu = Ge({ initial: null, codec: Lu, preset: !1 }), Cu = Object.freeze({
  ...Object.fromEntries(Ht.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, L(t)]))),
  ...Object.fromEntries(dr().map((e) => [e, L(e)])),
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
  sourceMode: Du,
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
}), Pu = fs({
  ...Cu,
  [He]: Ur({ initial: Rt(), codec: Vl, prepare: (e) => e, engine: Kd }),
  [na]: Ur({
    initial: Er(),
    codec: Iu,
    dependencies: dr(),
    prepare: (e, { parameters: t }) => yu(e, t),
    engine: Au
  }),
  [Se]: Ge({ initial: pn(), codec: Su }),
  [fa]: Nu,
  ...Ss({ factory: Eu, initial: "init" }),
  ...Os()
}), qt = 2048;
function vt(e, t) {
  if (!e)
    throw new Error(t);
}
function ju(e) {
  vt(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    vt(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), vt(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), vt(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), vt(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const Fu = 2048, an = 11, zu = 256;
function we(e, t) {
  if (!e)
    throw new Error(t);
}
function Ku(e) {
  return e > 0 && (e & e - 1) === 0;
}
const xo = /* @__PURE__ */ new Map();
function Uu(e) {
  const t = xo.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return xo.set(e, r), r;
}
function ya(e, t, n = !1) {
  const r = e.length;
  we(r === t.length, "FFT real and imaginary buffers must have the same length"), we(Ku(r), "FFT input length must be a power of two");
  const i = Uu(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const s = e[o];
    e[o] = e[a], e[a] = s;
    const d = t[o];
    t[o] = t[a], t[a] = d;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, d = Math.cos(s), p = Math.sin(s);
    for (let u = 0; u < r; u += o) {
      let g = 1, f = 0;
      for (let v = 0; v < a; v += 1) {
        const I = u + v, S = I + a, h = e[S], A = t[S], K = g * h - f * A, C = g * A + f * h, _ = e[I], M = t[I];
        e[I] = _ + K, t[I] = M + C, e[S] = _ - K, t[S] = M - C;
        const re = g * d - f * p;
        f = g * p + f * d, g = re;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function ba(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function $u(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Fu,
  maxFramesPerTable: r = zu
} = {}) {
  const i = Float32Array.from(e);
  we(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  we(o > 0, "Source wavetable files must contain at least one frame"), we(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && we(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const d = s * n, p = d + n;
    a.push(ba(i.slice(d, p)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function wo(e) {
  const t = ba(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return ya(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Ia(e, t, {
  mipLevelCount: n = an
} = {}) {
  const r = e?.real?.length ?? 0;
  we(r > 0, "Spectrum must contain real samples"), we(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), we(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = e.real[s], a[s] = e.imaginary[s];
    const d = (r - s) % r;
    d !== s && (o[d] = e.real[d], a[d] = e.imaginary[d]);
  }
  return ya(o, a, !0), Float32Array.from(o);
}
function Vu() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0) return new URL("/", e);
  const t = new URL(import.meta.url);
  return t.pathname = t.pathname.replace(/[^/]*\/[^/]*$/, ""), t;
}
async function Ro(e) {
  const t = [];
  for (const n of [...e].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      t.push(r);
    }
  return t;
}
async function Bu(e, t) {
  const n = [];
  try {
    for (const i of t) {
      const o = await i(e);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await Ro(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await Ro(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const Wt = 256, yt = 2048, Sa = 8, Hu = 12811, Yn = (Sa + Wt * Hu) * 4;
function Mo(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function qu(e, t, n) {
  if (e.byteLength !== Yn || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Wt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    an,
    Wt
  ]);
  let i = Sa;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), d = Math.fround(a / 0.5);
  for (let p = 0; p < an; ++p) {
    const u = Math.min(yt, Math.max(256, (1 << p) * 32)), g = yt / u;
    for (let f = 0; f < t.frameCount; ++f) {
      const v = Ia(n(f), p), I = i + f * (u + 1);
      for (let S = 0; S <= u; ++S) {
        const h = (S === u ? 0 : S) * g, A = (h + yt - g) % yt, K = (h + g) % yt, C = v[h], _ = v[A], M = v[K];
        if (C === void 0 || _ === void 0 || M === void 0 || !Number.isFinite(C) || !Number.isFinite(_) || !Number.isFinite(M))
          throw new Error("Wavetable preparation produced invalid samples.");
        const re = Math.fround(0.5 * Math.fround(M - _));
        r[I + S] = Mo(C, s, o) & 262143 | Mo(re, d, a) << 18;
      }
    }
    i += (u + 1) * Wt;
  }
}
const Wu = "runtimeSyncRequest", Gu = 2147483647, Ju = "runtimeState", Yu = "retryDesiredTableRequest", Qu = "workerLoadFailure", Xu = "serviceLoadAbort", Zu = "wavetableLoadBegin", ef = "wavetableMipFrame", tf = "wavetableUploadAck", nf = "wavetableMipRequest", rf = "wavetablePrewarmRequest", of = "wavetablePrewarmNotification", af = "assets/factory-bank-catalog.json", Qn = 3, sf = 1, cf = Qn * qt, lf = 1, df = 2, uf = 3, ff = 1, mf = 2, pf = 2e4, Ut = lf, _o = df, Do = uf, Ce = ff, Lo = mf, hf = 48 * 1024 * 1024, Nn = 3;
function No(e, t) {
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
function Co(e) {
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
function Po(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function jo(e, t) {
  if (!e)
    throw new Error(t);
}
function gf(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function vf(e, t) {
  return ju(await e.readJSON(t));
}
function yf(e) {
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
function bf(e, t) {
  const n = Math.round(Number(e) || 0);
  return gf(n, 0, Math.max(0, t - 1));
}
function Cn(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function If(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Fo(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function zo(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function $t() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Sf(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class kf {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = n.resourceClient ?? Ko(t, { patchRoot: Vu() }), this.catalogPath = n.catalogPath ?? af, this.maxBatchesInFlight = No(
      n.maxFramesInFlight,
      sf
    ), this.mipLevelCount = n.mipLevelCount ?? an, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? hf) || 0)), this.serviceLoadTimeoutMs = No(n.serviceLoadTimeoutMs, pf), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(Ju, this.handleRuntimeState), this.connection.addEndpointListener?.(tf, this.handleUploadAck), this.connection.addEndpointListener?.(nf, this.handleMipRequest), this.connection.addEndpointListener?.(rf, this.handlePrewarmRequest), this.connection.addEndpointListener?.(of, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Wu,
      Gu
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await vf(this.resourceClient, this.catalogPath), se("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Nn; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Fo(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Fo(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Cn(
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
          ...zo(this.serviceTable.frameCount),
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
          failurePhase: Do,
          failureReasonCode: Lo
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== Do || t.failureReasonCode !== Lo ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Ut,
    failureReasonCode: s = Ce
  }) {
    this.connection.sendEventOrValue?.(Qu, {
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
    failureReasonCode: o = Ce
  }) {
    this.connection.sendEventOrValue?.(Xu, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    se("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? Co(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(Yu, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = bf(t, r.tables.length), o = r.tables[i];
    jo(o, `Could not resolve table ${i}`);
    const a = If(o, qt, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, se("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const d = $t();
    se("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const p = await this.resourceClient.readAudio(o.sourceWav), u = $u(p.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: qt
    });
    return se("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round($t() - d)
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
    this.connection.sendEventOrValue?.(Zu, {
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
    const n = $t();
    try {
      if (await Td(this.connection, {
        input: t.oscillatorIndex,
        byteLength: Yn
      }, (r) => {
        qu(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      se("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: Yn,
        preparationMs: $t() - n,
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
        failurePhase: _o,
        failureReasonCode: Ce
      }), this.serviceTable = null, this.clearMipTransferState(), se("error", "Shared wavetable preparation failed", { detail: St(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    se("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: Ut,
      failureReasonCode: Ce
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: Ut,
      failureReasonCode: Ce
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = Ut,
    failureReasonCode: r = Ce
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
        detail: St(o)
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
        detail: St(a)
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
    for (let t = 0; t < Nn; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Sf(() => {
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
          failureReasonCode: Ce
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
    const n = yf(t ?? {});
    if (se("info", "Received runtime state", Co(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Nn)
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
          i.spectra[a] || (i.spectra[a] = wo(i.frames[a]));
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
          detail: St(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), s = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const d = Cn(
      n,
      r,
      i,
      o,
      a
    );
    let p = this.mipJobs.get(d);
    return p ? (!p.completed && s > p.urgencyLevel && (p.urgencyLevel = s), p) : (p = {
      key: d,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...zo(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(d, p), p);
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), d = Math.trunc(Number(n.frameIndexBase)), p = Math.trunc(Number(n.frameCount)), u = Cn(
      r,
      i,
      o,
      a,
      s
    ), g = this.mipJobs.get(u), f = this.serviceTable?.frameCount ?? 0, v = Math.min(
      Qn,
      f - d
    );
    if (!(!g || g.completed || !g.inFlightBatchBases.has(d) || p <= 0 || p !== v)) {
      g.inFlightBatchBases.delete(d);
      for (let I = 0; I < p; I += 1) {
        const S = d + I;
        g.ackedFrames[S] || (g.ackedFrames[S] = 1, g.ackedFrameCount += 1);
      }
      g.ackedFrameCount === f && g.nextFrameIndex >= f && g.inFlightBatchBases.size === 0 && (g.completed = !0, this.activeUploadKey === g.key && (this.activeUploadKey = null)), Po(d, p, f) && se("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: g.tableIndex,
        mipIndex: s,
        frameIndexBase: d,
        batchFrameCount: p,
        ackedFrameCount: g.ackedFrameCount,
        frameCount: f,
        inFlightBatches: g.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (jo(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = wo(this.serviceTable.frames[t]);
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
        Qn,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(cf);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), d = Ia(s, t.mipIndex);
          i.set(d, o * qt);
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
            failurePhase: _o,
            failureReasonCode: Ce
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ef, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Po(n, r, this.serviceTable.frameCount) && se("info", "Sent wavetable mip batch", {
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
function St(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Af(e, t = {}) {
  return new kf(e, t);
}
async function Tf(e, t = {}) {
  return Bu(e, [
    () => Af(e, { ...t, delivery: "shared" }),
    () => vs(Pu, e, {
      onDefect: (n) => console.error("Cosimo state failed", St(n))
    })
  ]);
}
export {
  sf as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  df as FAILURE_PHASE_BUILD_MIP,
  lf as FAILURE_PHASE_LOAD_SOURCE,
  uf as FAILURE_PHASE_TRANSFER_MIP,
  ff as FAILURE_REASON_GENERIC,
  mf as FAILURE_REASON_TIMEOUT,
  Qn as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Gu as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  kf as WavetableWorkerController,
  Af as createWavetableWorkerController,
  Tf as default
};
