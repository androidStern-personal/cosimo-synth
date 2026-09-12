function Zi() {
  let e = !1;
  const t = /* @__PURE__ */ new Set();
  return {
    signal: {
      get aborted() {
        return e;
      },
      onAbort(r) {
        return e ? r() : t.add(r), () => {
          t.delete(r);
        };
      }
    },
    cancel() {
      if (e) return;
      e = !0;
      const r = [...t];
      t.clear();
      for (const i of r) i();
    }
  };
}
function mr(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function Zt(e) {
  let t = !1, n, r;
  const i = /* @__PURE__ */ new Set();
  async function o(s, c, f) {
    const { signal: d } = f;
    if (e.onStatus(c, { kind: "preparing" }), d.aborted) return;
    const h = await mr(e.prepare(s, d), d);
    if (h.kind === "cancelled" || d.aborted) return;
    const m = h.value;
    if (m.kind === "error") {
      e.onStatus(c, { kind: "failed", error: m.error });
      return;
    }
    let g = !0;
    f.applying = !0;
    let y;
    try {
      y = await mr(e.transport.apply(m.value, {
        signal: d,
        send: (S) => d.aborted || !g ? { kind: "cancelled" } : S()
      }), d);
    } catch (S) {
      d.aborted || (t = !0, n?.cancel(), e.transport.stop(), e.onDefect(S), e.onStatus(c, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      g = !1, f.applying = !1;
    }
    y.kind === "value" && !d.aborted && y.value.kind !== "cancelled" && e.onStatus(c, y.value);
  }
  function a(s, c) {
    r = void 0;
    const f = n, d = { ...Zi(), applying: !1, target: c };
    if (n = d, f?.cancel(), t || d.signal.aborted) return;
    const h = o(s, c, d).catch((m) => {
      d.signal.aborted || (d.cancel(), e.onDefect(m), e.onStatus(c, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    i.add(h), h.then(() => {
      if (i.delete(h), n !== d) return;
      n = void 0;
      const m = r;
      r = void 0, !t && m && a(m.input, m.target);
    });
  }
  return {
    /** Apply the declared replacement policy; ignored after stop or a transport defect. */
    replace(s, c) {
      if (!t) {
        if (e.replacement === "finish" && n?.applying && !n.signal.aborted && n.target.scope.owner === c.scope.owner && n.target.scope.document === c.scope.document) {
          r = { input: s, target: c }, e.onStatus(c, { kind: "preparing" });
          return;
        }
        a(s, c);
      }
    },
    /** Revoke the current request, retaining the transport for a later replacement. */
    cancel() {
      r = void 0, n?.cancel();
    },
    /** Close permanently and settle owned work without waiting for uncooperative external promises. */
    async stop() {
      t || (t = !0, r = void 0, n?.cancel(), e.transport.stop()), await Promise.all(i);
    }
  };
}
let ea = 0;
function pr(e, t) {
  const n = `atom${++ea}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = ta, r.write = na), r;
}
function ta(e) {
  return e(this);
}
function na(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Io = "a", _e = "m", Bt = "i", $e = "c", Cn = "q", Nn = "Q", Le = "h", So = "R", ko = "W", To = "I", Ao = "M", Te = "e", nt = "f", Be = "C", rt = "r", Pn = "d", Ht = "w", qt = "D", Wt = "t", Gt = "T", Fn = "v", hr = "g", gr = "s", vr = "b", ra = "B", Kn = "p", Eo = "H", xo = "A", jn = "E";
function Ro(e) {
  return "init" in e;
}
function oa(e) {
  return typeof e.write == "function";
}
function ia(e) {
  return !!e.onMount;
}
function yr(e) {
  return "v" in e || "e" in e;
}
function Dt(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function _t(e) {
  return typeof e?.then == "function";
}
function aa(e) {
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
function wo(e, t, n) {
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
function sa(e) {
  return !!e.INTERNAL_onInit;
}
const ca = (e, t, n, ...r) => n.read(...r), la = (e, t, n, ...r) => n.write(...r), da = (e, t, n) => n.INTERNAL_onInit(t), ua = (e, t, n, r) => n.onMount?.(r), fa = (e, t, n) => {
  const r = e[Io];
  let i = r.get(n);
  if (!i) {
    const o = e[Le], a = e[To];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), sa(n) && a(e, t, n);
  }
  return i;
}, ma = (e, t) => {
  const n = e[_e], r = e[$e], i = e[Cn], o = e[Nn], a = e[Le], s = e[Be];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const c = [], f = (d) => {
    try {
      d();
    } catch (h) {
      c.push(h);
    }
  };
  do {
    a.f && f(a.f);
    const d = /* @__PURE__ */ new Set();
    for (const h of r) {
      const m = n.get(h)?.l;
      if (m)
        for (const g of m)
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
      f(h);
    r.size && s(e, t);
  } while (r.size || o.size || i.size);
  if (c.length)
    throw typeof AggregateError == "function" ? new AggregateError(c) : Object.assign(new Error(), { errors: c });
}, pa = (e, t) => {
  const n = e[_e], r = e[Bt], i = e[$e], o = e[Te], a = e[rt], s = e[qt];
  if (!i.size)
    return;
  const c = [], f = [], d = /* @__PURE__ */ new WeakSet(), h = /* @__PURE__ */ new WeakSet(), m = [], g = [];
  for (const y of i)
    m.push(y), g.push(o(e, t, y));
  for (; m.length; ) {
    const y = m.length - 1, S = m[y], v = g[y];
    if (h.has(S)) {
      m.pop(), g.pop();
      continue;
    }
    if (d.has(S)) {
      r.get(S) === v.n && (c.push(S), f.push(v)), h.add(S), m.pop(), g.pop();
      continue;
    }
    d.add(S);
    for (const T of wo(S, v, n))
      d.has(T) || (m.push(T), g.push(o(e, t, T)));
  }
  for (let y = c.length - 1; y >= 0; --y) {
    const S = c[y], v = f[y];
    let T = !1;
    for (const O of v.d.keys())
      if (O !== S && i.has(O)) {
        T = !0;
        break;
      }
    T && (r.set(S, v.n), a(e, t, S), s(e, t, S)), r.delete(S);
  }
};
const ha = (e, t, n) => {
  const r = e[_e], i = e[Bt], o = e[$e], a = e[Le], s = e[So], c = e[Te], f = e[nt], d = e[Be], h = e[rt], m = e[qt], g = e[Fn], y = e[Eo], S = e[jn], v = c(e, t, n), T = S[0];
  if (yr(v)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== v.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      v.m === T
    )
      return v.m = T, v;
    let l = !1;
    for (const [p, I] of v.d)
      if (h(e, t, p).n !== I) {
        l = !0;
        break;
      }
    if (!l)
      return v.m = T, v;
  }
  let O = !0;
  const A = new Set(v.d.keys()), D = () => {
    for (const l of A)
      v.d.delete(l);
  }, F = () => {
    if (r.has(n)) {
      const l = !o.size;
      m(e, t, n), l && (d(e, t), f(e, t));
    }
  }, j = (l) => {
    if (l === n) {
      const I = c(e, t, l);
      if (!yr(I))
        if (Ro(l))
          g(e, t, l, l.init);
        else
          throw new Error("no atom init");
      return Dt(I);
    }
    const p = h(e, t, l);
    try {
      return Dt(p);
    } finally {
      A.delete(l), v.d.set(l, p.n), _t(v.v) && Oo(n, v.v, p), r.has(n) && r.get(l)?.t.add(n), O || F();
    }
  };
  let ne;
  const w = {
    get signal() {
      return ne || (ne = new AbortController()), ne.signal;
    }
  }, x = v.n, u = i.get(n) === x;
  try {
    const l = s(e, t, n, j, w);
    if (g(e, t, n, l), _t(l)) {
      y(e, t, l, () => ne?.abort());
      const p = () => {
        D(), F();
      };
      l.then(p, p);
    } else
      D();
    return a.r?.(n), v.m = T, v;
  } catch (l) {
    if (aa(l))
      throw l;
    return delete v.v, v.e = l, ++v.n, v.m = T, v;
  } finally {
    O = !1, v.n !== x && u && (i.set(n, v.n), o.add(n), a.c?.(n));
  }
}, ga = (e, t, n) => {
  const r = e[_e], i = e[Bt], o = e[Te], a = [n];
  for (; a.length; ) {
    const s = a.pop(), c = o(e, t, s);
    for (const f of wo(s, c, r)) {
      const d = o(e, t, f);
      i.get(f) !== d.n && (i.set(f, d.n), a.push(f));
    }
  }
}, va = (e, t, n, r) => {
  const i = e[$e], o = e[Le], a = e[ko], s = e[Te], c = e[nt], f = e[Be], d = e[rt], h = e[Pn], m = e[Ht], g = e[qt], y = e[Fn], S = e[jn];
  let v = !0;
  const T = (A) => Dt(d(e, t, A)), O = (A, ...D) => {
    const F = s(e, t, A);
    try {
      if (A === n) {
        if (!Ro(A))
          throw new Error("atom not writable");
        const j = F.n, ne = D[0];
        y(e, t, A, ne), g(e, t, A), j !== F.n && (++S[0], i.add(A), h(e, t, A), o.c?.(A));
        return;
      } else
        return m(e, t, A, D);
    } finally {
      v || (f(e, t), c(e, t));
    }
  };
  try {
    return a(e, t, n, T, O, ...r);
  } finally {
    v = !1;
  }
}, ya = (e, t, n) => {
  const r = e[_e], i = e[$e], o = e[Le], a = e[Te], s = e[Pn], c = e[Wt], f = e[Gt], d = a(e, t, n), h = r.get(n);
  if (h && d.d.size > 0) {
    for (const [m, g] of d.d)
      if (!h.d.has(m)) {
        const y = a(e, t, m);
        c(e, t, m).t.add(n), h.d.add(m), g !== y.n && (i.add(m), s(e, t, m), o.c?.(m));
      }
    for (const m of h.d)
      d.d.has(m) || (h.d.delete(m), f(e, t, m)?.t.delete(n));
  }
}, ba = (e, t, n) => {
  const r = e[_e], i = e[Cn], o = e[Le], a = e[Ao], s = e[Te], c = e[nt], f = e[Be], d = e[rt], h = e[Ht], m = e[Wt], g = s(e, t, n);
  let y = r.get(n);
  if (!y) {
    d(e, t, n);
    for (const S of g.d.keys())
      m(e, t, S).t.add(n);
    if (y = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(g.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, y), oa(n) && ia(n)) {
      const S = () => {
        let v = !0;
        const T = (...O) => {
          try {
            return h(e, t, n, O);
          } finally {
            v || (f(e, t), c(e, t));
          }
        };
        try {
          const O = a(e, t, n, T);
          O && (y.u = () => {
            v = !0;
            try {
              O();
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
  return y;
}, Ia = (e, t, n) => {
  const r = e[_e], i = e[Nn], o = e[Le], a = e[Te], s = e[Gt], c = a(e, t, n);
  let f = r.get(n);
  if (!f || f.l.size)
    return f;
  let d = !1;
  for (const h of f.t)
    if (r.get(h)?.d.has(n)) {
      d = !0;
      break;
    }
  if (!d) {
    f.u && i.add(f.u), f = void 0, r.delete(n);
    for (const h of c.d.keys())
      s(e, t, h)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return f;
}, Sa = (e, t, n, r) => {
  const i = e[Te], o = e[xo], a = i(e, t, n), s = "v" in a, c = a.v;
  if (_t(r))
    for (const f of a.d.keys())
      Oo(n, r, i(e, t, f));
  a.v = r, delete a.e, (!s || !Object.is(c, a.v)) && (++a.n, _t(c) && o(e, t, c));
}, ka = (e, t, n) => {
  const r = e[rt];
  return Dt(r(e, t, n));
}, Ta = (e, t, n, ...r) => {
  const i = e[$e], o = e[nt], a = e[Be], s = e[Ht], c = i.size;
  try {
    return s(e, t, n, r);
  } finally {
    i.size !== c && (a(e, t), o(e, t));
  }
}, Aa = (e, t, n, r) => {
  const i = e[nt], o = e[Be], a = e[Wt], s = e[Gt], f = a(e, t, n).l;
  return f.add(r), o(e, t), i(e, t), () => {
    f.delete(r), s(e, t, n), o(e, t), i(e, t);
  };
}, Ea = (e, t, n, r) => {
  const i = e[Kn];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, xa = (e, t, n) => {
  e[Kn].get(n)?.forEach((o) => o());
}, Ra = /* @__PURE__ */ new WeakMap();
function Oa(e) {
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
    [Io]: /* @__PURE__ */ new WeakMap(),
    [_e]: /* @__PURE__ */ new WeakMap(),
    [Bt]: /* @__PURE__ */ new WeakMap(),
    [$e]: /* @__PURE__ */ new Set(),
    [Cn]: /* @__PURE__ */ new Set(),
    [Nn]: /* @__PURE__ */ new Set(),
    [Le]: {},
    // atom interceptors
    [So]: ca,
    [ko]: la,
    [To]: da,
    [Ao]: ua,
    // building-block functions
    [Te]: fa,
    [nt]: ma,
    [Be]: pa,
    [rt]: ha,
    [Pn]: ga,
    [Ht]: va,
    [qt]: ya,
    [Wt]: ba,
    [Gt]: Ia,
    [Fn]: Sa,
    // store api
    [hr]: ka,
    [gr]: Ta,
    [vr]: Aa,
    [ra]: void 0,
    // abortable promise support
    [Kn]: /* @__PURE__ */ new WeakMap(),
    [Eo]: Ea,
    [xo]: xa,
    // store epoch
    [jn]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  Ra.set(t, r);
  const i = r[hr], o = r[gr], a = r[vr];
  return t;
}
function wa() {
  return Oa();
}
function te(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function Mo(e, t = 1 / 0) {
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
      return e -= Mo(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function In(e) {
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
    if (!te(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function oe(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function Se(e) {
  return typeof e == "string" && e.length > 0 && Mo(e) <= 256;
}
function Un(e) {
  return te(e) && Se(e.owner) && oe(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function Ma(e) {
  if (!te(e) || !oe(e.id)) return;
  const t = Un(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function Da(e) {
  const t = Un(e);
  return t && te(e) && oe(e.client) && oe(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function br(e) {
  if (!te(e) || !Array.isArray(e.parameters) || !te(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!te(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c } = n;
    if (!Se(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: s, defaultValue: c }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function _a(e) {
  if (te(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = Ma(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (e.kind === "edit-many") {
      if (!Array.isArray(e.edits) || e.edits.length === 0) return;
      const t = [], n = /* @__PURE__ */ new Set();
      for (const r of e.edits) {
        if (!te(r) || !Se(r.key) || n.has(r.key) || !Object.hasOwn(r, "value") || Object.hasOwn(r, "gesture") || r.expectedVersion !== void 0 && !oe(r.expectedVersion, !1)) return;
        n.add(r.key), t.push({ key: r.key, value: r.value, ...r.expectedVersion !== void 0 ? { expectedVersion: r.expectedVersion } : {} });
      }
      return { kind: "edit-many", edits: t };
    }
    if (Se(e.key)) {
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
      if (e.kind === "begin" || e.kind === "end")
        return !oe(e.gesture) || e.label !== void 0 && typeof e.label != "string" ? void 0 : e.kind === "end" ? { kind: "end", key: e.key, gesture: e.gesture } : { kind: "begin", key: e.key, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
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
function La(e) {
  if (!In(e) || !te(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && oe(e.request) && Se(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && Se(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = Un(e.scope);
  if (e.kind === "opened" && t && oe(e.request)) {
    const n = br(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = br(e.native);
    if (n && (e.changedStoredKey === void 0 || Se(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && Se(e.endpoint) && typeof e.value == "number")
    return { kind: "ok", value: { kind: "parameter", scope: t, endpoint: e.endpoint, value: e.value } };
  if (e.kind === "detach" && t && oe(e.client) && oe(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && oe(e.request) && oe(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = Da(e.address);
    if (n) {
      const r = _a(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && oe(e.request) && te(e.result)) {
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && Se(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function Ir(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, i]) => {
    const o = t.fields[r];
    return !o || !("value" in o) ? [r, o] : [r, { ...o, value: i.kind === "stored" ? i.codec.encode(o.value) : o.value }];
  }));
  return { ...t, fields: n };
}
function Sr(e) {
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
            const c = [];
            for (const f of o) {
              const d = r(f, a + 1);
              if (d === void 0) return;
              c.push(d);
            }
            return c;
          }
          if (!te(o)) return;
          const s = /* @__PURE__ */ Object.create(null);
          for (const c in o) {
            if (!Object.hasOwn(o, c)) continue;
            if (!t.text(c)) return;
            const f = r(o[c], a + 1);
            if (f === void 0) return;
            s[c] = f;
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
const Ca = (e) => ({ kind: "failed", error: { kind: "transport", message: e } }), Na = (e, t) => te(e) && e.owner === t.owner && e.document === t.document;
function Pa(e, t = {}) {
  let n = 0, r = !1;
  const i = /* @__PURE__ */ new Map(), o = t.timeoutMs ?? 1e4;
  function a(f) {
    if (!te(f) || typeof f.request != "number") return;
    const d = i.get(f.request);
    if (!(!d || !Na(f.scope, d.scope))) {
      if (f.kind !== "failed" && f.kind !== "cancelled" && !d.matches(f)) {
        d.finish({ kind: "failed", reason: "invalid-reply" });
        return;
      }
      f.kind === "ready" && typeof f.transfer == "number" && Number.isSafeInteger(f.transfer) && f.transfer > 0 ? d.finish({ kind: "ready", transfer: f.transfer }) : f.kind === "written" || f.kind === "applied" || f.kind === "cancelled" ? d.finish({ kind: f.kind }) : d.finish({ kind: "failed", reason: f.kind === "failed" && typeof f.reason == "string" ? f.reason : "invalid-reply" });
    }
  }
  e.addEventListener("kit_data", a);
  function s(f) {
    e.sendMessageToServer({ type: "kit_data", message: f });
  }
  function c(f, d, h, m, g) {
    return r || m.aborted ? Promise.resolve({ kind: "cancelled" }) : new Promise((y) => {
      let S = () => {
      }, v;
      const T = (O) => {
        i.delete(f) && (clearTimeout(v), S(), y(O));
      };
      if (i.set(f, { scope: h, matches: g, finish: T }), S = m.onAbort(() => T({ kind: "cancelled" })), !!i.has(f)) {
        v = setTimeout(() => T({ kind: "failed", reason: "reply-timeout" }), o);
        try {
          s({ ...d, scope: h, request: f });
        } catch {
          T({ kind: "failed", reason: "connection-failed" });
        }
      }
    });
  }
  return {
    /** Takes exclusive read ownership until completion. The caller must not
     * mutate or reuse samples while pending; avoiding a second whole-value
     * copy depends on this same ownership rule as native resource adoption.
     */
    async replace(f, d, h, m) {
      if (r || m.aborted) return { kind: "cancelled" };
      if (!(d instanceof Float32Array) || !d.every(Number.isFinite))
        return { kind: "failed", error: { kind: "engine-rejected", message: "Shared data requires finite Float32 samples." } };
      const g = Object.freeze({ ...h.scope }), y = ++n;
      let S = !1;
      const v = (T) => T.kind === "cancelled" ? T : Ca(T.kind === "failed" ? `Data delivery failed: ${T.reason}.` : "Unexpected data delivery reply.");
      try {
        const T = await c(
          y,
          { kind: "begin", input: f, generation: h.generation, sampleCount: d.length },
          g,
          m,
          (A) => A.kind === "ready"
        );
        if (T.kind !== "ready") return v(T);
        for (let A = 0; A < d.length; A += 8192) {
          const D = await c(
            ++n,
            {
              kind: "write",
              transfer: T.transfer,
              offset: A,
              samples: Array.from(d.subarray(A, A + 8192))
            },
            g,
            m,
            (F) => F.kind === "written" && F.transfer === T.transfer && F.offset === Math.min(A + 8192, d.length)
          );
          if (D.kind !== "written") return v(D);
        }
        const O = await c(
          ++n,
          { kind: "commit", transfer: T.transfer },
          g,
          m,
          (A) => A.kind === "applied" && A.transfer === T.transfer && A.input === f && A.generation === h.generation
        );
        return O.kind !== "applied" ? v(O) : (S = !0, { kind: "acknowledged", engineSession: `${g.owner}:${g.document}`, operation: String(y) });
      } finally {
        if (!S) try {
          s({ kind: "cancel", request: ++n, scope: g, beginRequest: y });
        } catch {
        }
      }
    },
    stop() {
      if (!r) {
        r = !0;
        for (const f of [...i.values()]) f.finish({ kind: "cancelled" });
        e.removeEventListener("kit_data", a);
      }
    }
  };
}
const Fa = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Ka(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !Fa.has(e);
}
function lt(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function M(e, t = {}) {
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
function kr(e) {
  const t = _o({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const o = e.prepare, a = e.engine;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: a.type, fixedLength: typeof a.length == "number" ? a.length : null }),
      measure(s, c) {
        return typeof a.length == "number" ? a.length : a.length(s, c);
      },
      prepare: o
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
const Ie = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function Tr(e, t = {}) {
  const n = /* @__PURE__ */ new Map();
  let r = !1;
  function i(o) {
    if (!te(o) || typeof o.id != "number" || !te(o.scope)) return;
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
      } else o.kind === "failed" && a.finish(o.reason === "cancelled" || o.reason === "superseded" || o.reason === "stale-scope" ? { kind: "cancelled" } : Ie("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", i), {
    async prepare(o, a, s, c) {
      if (r || s.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(o.byteLength) || o.byteLength <= 0 || o.byteLength % 4 !== 0 || o.byteLength > 2147483647)
        return Ie("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const f = e.sharedData;
      if (!f) return Ie("This host does not support shared-data preparation.");
      let d;
      try {
        d = f.reserve(o.input, o.byteLength);
      } catch {
        return Ie("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let h = !1;
      try {
        if (d.byteLength !== o.byteLength) return Ie("The host supplied a differently sized shared allocation.");
        const m = c(d);
        if (lt(m)) return { kind: "failed", error: m.error };
        if (s.aborted || r) return { kind: "cancelled" };
        const g = new Promise((y) => {
          let S = () => {
          }, v;
          const T = (O) => {
            if (n.delete(d.id)) {
              if (clearTimeout(v), S(), O.kind !== "acknowledged")
                try {
                  f.cancel(d.id);
                } catch {
                  O = Ie("Cancellation of the shared resource could not be confirmed.");
                }
              y(O);
            }
          };
          n.set(d.id, { input: o.input, target: a, submitted: null, early: null, finish: T }), S = s.onAbort(() => T({ kind: "cancelled" })), n.has(d.id) && (v = setTimeout(() => T(Ie("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(d.id)) return g;
        try {
          const y = await f.commit(d.id);
          h = !0;
          const S = n.get(d.id);
          S && (!te(y) || y.kind !== "submitted" || y.id !== d.id || y.input !== o.input || y.generation !== d.id || typeof y.serial != "number" || !Number.isSafeInteger(y.serial) || y.serial <= 0 ? S.finish(Ie("The host returned an invalid shared-resource submission receipt.")) : (S.submitted = { generation: y.generation, serial: y.serial }, S.early && i(S.early)));
        } catch {
          n.get(d.id)?.finish(s.aborted ? { kind: "cancelled" } : Ie("The shared resource could not be submitted."));
        }
        return g;
      } finally {
        if (!h)
          try {
            f.cancel(d.id);
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
class zn {
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
    const r = new zn({ limit: this.#o, compare: this.#d });
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
function Ne(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function It(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function Ar(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function Ee(e, t, n = 0, r, i, o, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
function za(e, t) {
  const n = wa(), r = {};
  for (const u of Object.keys(e)) r[u] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = pr({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new zn({ limit: t.historyLimit, compare: (u, l) => u.order - l.order }),
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map()
  }), o = pr((u) => u(i).snapshot);
  let a = !1, s, c = 0, f = !1, d, h = [];
  const m = [], g = () => n.get(o), y = (u) => e[u]?.history !== !1, S = (u) => [...u.gestures.keys()].some(y), v = (u, l, p = u.history) => {
    const I = p.undoEntry, b = p.redoEntry;
    return {
      ...u,
      history: p,
      snapshot: Object.freeze({
        ...u.snapshot,
        revision: u.snapshot.revision + 1,
        fields: Object.freeze(l),
        history: Object.freeze({
          canUndo: !a && !S(u) && I !== void 0 && I.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          canRedo: !a && !S(u) && b !== void 0 && b.changes.every((k) => l[k.key]?.readiness.kind === "ready"),
          ...u.snapshot.scope && I ? { undoEntry: It(u.snapshot.scope, I) } : {},
          ...u.snapshot.scope && b ? { redoEntry: It(u.snapshot.scope, b) } : {}
        })
      })
    };
  }, T = (u, l) => {
    const p = n.get(i);
    if (u.snapshot === p.snapshot) {
      n.set(i, u);
      return;
    }
    const I = u.snapshot.scope;
    if (!I || !t.bindings?.length) {
      n.set(i, u);
      return;
    }
    const b = { ...u.snapshot.fields };
    for (const k of t.bindings) {
      const E = b[k.key];
      if (!E) continue;
      const R = p.snapshot.fields[k.key], P = !p.snapshot.scope || !Ne(I, p.snapshot.scope);
      if (!(P || k.key === l || !R || R.readiness.kind !== E.readiness.kind || "value" in E && (!("value" in R) || !Object.is(E.value, R.value)) || k.dependencies.some((L) => {
        const _ = p.snapshot.fields[L], N = b[L];
        return _ !== N && (!_ || !N || !("value" in _) || !("value" in N) || !Object.is(_.value, N.value));
      }))) {
        const L = E.application ?? R?.application, _ = R?.target ?? E.target;
        b[k.key] = E.application === L && E.target === _ ? E : Object.freeze({ ...E, ...L ? { application: L } : {}, ..._ ? { target: _ } : {} });
        continue;
      }
      const B = Object.freeze({ scope: I, key: k.key, generation: P ? 0 : (R?.target?.generation ?? -1) + 1 }), z = {};
      let K = "value" in E && E.readiness.kind === "ready";
      for (const L of k.dependencies) {
        const _ = b[L];
        e[L]?.kind !== "parameter" || !_ || !("value" in _) || _.readiness.kind !== "ready" || typeof _.value != "number" ? K = !1 : z[L] = _.value;
      }
      if (b[k.key] = Object.freeze({ ...E, target: B, application: Object.freeze({ kind: K ? "pending" : "waiting-for-inputs" }) }), K && "value" in E) {
        const L = Object.freeze({ value: E.value, parameters: Object.freeze(z) });
        h.push(() => k.replace(L, B));
      } else h.push(() => k.cancel());
    }
    n.set(i, { ...u, snapshot: Object.freeze({ ...u.snapshot, fields: Object.freeze(b) }) });
  }, O = (u, l, p) => {
    if (!y(l)) return u;
    const I = e[l];
    return (I?.kind === "stored" ? I.codec.equals(p.before, p.after) : Object.is(p.before, p.after)) ? u : u.record({ changes: [{ key: l, before: p.before, after: p.after }], order: p.order });
  }, A = (u, l, p, I) => {
    if (!u.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
    const b = { ...u.snapshot.fields }, k = new Map(u.publications), E = [];
    for (const { key: z, value: K } of l) {
      const L = e[z], _ = b[z];
      if (!L || !_) return { kind: "rejected", reason: "not-ready" };
      const N = "value" in _ ? _ : void 0;
      if (!N && I !== "recover") return { kind: "rejected", reason: "not-ready" };
      if (I === "history" && _.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      let q;
      if (L.kind === "parameter") {
        if (typeof K != "number") return { kind: "rejected", reason: "invalid-value" };
        q = u.gestures.has(z) ? [{ kind: "parameter", endpoint: L.endpoint, value: K }] : [
          { kind: "gesture-start", endpoint: L.endpoint },
          { kind: "parameter", endpoint: L.endpoint, value: K },
          { kind: "gesture-end", endpoint: L.endpoint }
        ];
      } else q = L.lifetime === "instance" ? [] : [{ kind: "stored", key: z, value: L.codec.encode(K) }];
      const G = (N?.version ?? 0) + 1;
      if (q.length) {
        const de = ++c;
        k.set(de, { key: z, version: G }), E.push({ request: de, scope: u.snapshot.scope, operations: q });
      }
      b[z] = Ee(K, { kind: L.kind === "parameter" ? "host-managed" : L.lifetime === "instance" ? "not-written" : "pending" }, G, N?.metadata, N?.gesture, L.kind === "parameter" ? { kind: "pending" } : void 0);
    }
    const R = v(u, b, p), P = l[0], V = l.length === 1 && P ? b[P.key] : void 0, B = {
      kind: "accepted",
      revision: R.snapshot.revision,
      ...V && "version" in V ? { version: V.version } : {},
      ...I !== "history" ? { changed: !0 } : {},
      ...I === "edit" && l.some(({ key: z }) => y(z) && !u.gestures.has(z)) && p.undoEntry ? { historyEntry: It(u.snapshot.scope, p.undoEntry) } : {}
    };
    d = B, T({ ...R, publications: k });
    for (const z of E)
      a || t.native.publish(z);
    return B;
  }, D = (u, l, p, I, b) => A(u, [{ key: l, value: p }], I, b), F = (u, l, p) => {
    const I = e[l];
    if (!I) return { kind: "error" };
    if (I.kind === "stored") return I.codec.parse(p);
    const b = u.parameters.get(l);
    if (!b || typeof p != "number" || !Number.isFinite(p)) return { kind: "error" };
    const k = Math.min(b.max, Math.max(b.min, p));
    return { kind: "ok", value: b.step > 0 ? Math.min(b.max, Math.max(b.min, b.min + Math.round((k - b.min) / b.step) * b.step)) : k };
  }, j = (u, l, p) => {
    const I = e[u];
    return I?.kind === "stored" ? I.codec.equals(l, p) : Object.is(l, p);
  }, ne = (u) => {
    const l = n.get(i);
    if (u.kind === "opened" || u.kind === "replaced") {
      if (l.snapshot.scope && (u.kind === "opened" || u.scope.owner !== l.snapshot.scope.owner || u.scope.document <= l.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const p = {}, I = /* @__PURE__ */ new Map();
      for (const [k, E] of Object.entries(e))
        if (E.kind === "parameter") {
          const R = u.native.parameters.find((P) => P.endpoint === E.endpoint);
          if (R && Ar(R)) {
            I.set(k, Object.freeze({ ...R }));
            const { min: P, max: V, step: B, defaultValue: z } = R;
            p[k] = Ee(R.value, { kind: "host-managed" }, 0, Object.freeze({ min: P, max: V, step: B, defaultValue: z }), void 0, { kind: "unconfirmed" });
          } else p[k] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: R ? "invalid-state" : "missing-parameter" }) });
        } else {
          const R = l.snapshot.fields[k];
          if (E.lifetime === "instance" && u.kind === "replaced" && R && "value" in R) {
            p[k] = Ee(R.value, { kind: "not-written" }, R.version);
            continue;
          }
          const P = E.lifetime !== "instance" && Object.hasOwn(u.native.values, k), V = P ? E.codec.parse(u.native.values[k]) : E.initial;
          if (V.kind === "ok") p[k] = Ee(V.value, { kind: P ? "observed-in-native-state" : "not-written" });
          else {
            const B = l.snapshot.fields[k], z = u.kind === "replaced" && u.changedStoredKey !== void 0 && B && "value" in B;
            p[k] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...z ? { value: B.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const b = v(l, p, l.history.clear());
      T({ ...b, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), editOrder: 0, parameters: I, snapshot: Object.freeze({ ...b.snapshot, scope: Object.freeze({ ...u.scope }) }) });
    } else if (u.kind === "command") {
      if (!l.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!Ne(u.address, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(u.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (u.command.kind === "undo" || u.command.kind === "redo") {
        if (S(l)) return { kind: "rejected", reason: "busy" };
        const K = u.command.kind === "undo", L = K ? l.history.undoEntry : l.history.redoEntry, _ = u.command.expectedEntry;
        return _ && (!L || !Ne(_.scope, l.snapshot.scope) || _.id !== L.order) ? { kind: "rejected", reason: "stale-history" } : L ? A(
          l,
          L.changes.map((N) => ({ key: N.key, value: K ? N.before : N.after })),
          K ? l.history.undo() : l.history.redo(),
          "history"
        ) : { kind: "accepted", revision: l.snapshot.revision };
      }
      if (u.command.kind === "edit-many") {
        const K = [], L = /* @__PURE__ */ new Set();
        if (!Array.isArray(u.command.edits) || u.command.edits.length === 0) return { kind: "rejected", reason: "invalid-command" };
        for (const { key: q, value: G, expectedVersion: de } of u.command.edits) {
          if (!Object.hasOwn(e, q) || L.has(q)) return { kind: "rejected", reason: "invalid-command" };
          L.add(q);
          const ce = l.snapshot.fields[q];
          if (!ce || !("value" in ce) || ce.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
          if (l.gestures.has(q)) return { kind: "rejected", reason: "busy" };
          if (de !== void 0 && de !== ce.version) return { kind: "rejected", reason: "stale-version" };
          const ve = F(l, q, G);
          if (ve.kind === "error") return { kind: "rejected", reason: "invalid-value" };
          j(q, ce.value, ve.value) || K.push({ key: q, before: ce.value, after: ve.value });
        }
        if (!K.length) return { kind: "accepted", revision: l.snapshot.revision, changed: !1 };
        const _ = l.editOrder + 1, N = K.filter(({ key: q }) => y(q));
        return A({ ...l, editOrder: _ }, K.map(({ key: q, after: G }) => ({ key: q, value: G })), N.length ? l.history.record({ changes: N, order: _ }) : l.history, "edit");
      }
      const { key: p } = u.command;
      if (!Object.hasOwn(e, p)) return { kind: "rejected", reason: "invalid-command" };
      const I = e[p], b = l.snapshot.fields[p];
      if (!I || !b) return { kind: "rejected", reason: "invalid-command" };
      if (u.command.kind === "retry") {
        if (!("value" in b) || b.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (u.command.expectedVersion !== b.version || u.command.expectedGeneration !== (b.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const K = b.persistence.kind === "failed" && b.persistenceRequest !== void 0;
        if (u.command.expectedPersistenceRequest !== (K ? b.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (K) {
          const N = I.kind === "parameter" ? [{ kind: "parameter", endpoint: I.endpoint, value: Number(b.value) }] : [{ kind: "stored", key: p, value: I.codec.encode(b.value) }], q = ++c, G = new Map(l.publications).set(q, { key: p, version: b.version }), de = v(l, { ...l.snapshot.fields, [p]: Object.freeze({
            ...b,
            persistence: Object.freeze({ kind: "pending" }),
            ...I.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), ce = { kind: "accepted", revision: de.snapshot.revision, version: b.version, changed: !1 };
          return d = ce, T({ ...de, publications: G }), a || t.native.publish({ request: q, scope: l.snapshot.scope, operations: N }), ce;
        }
        if (b.application?.kind !== "failed" || !t.bindings?.some((N) => N.key === p))
          return { kind: "rejected", reason: "not-ready" };
        const L = v(l, l.snapshot.fields), _ = { kind: "accepted", revision: L.snapshot.revision, version: b.version, changed: !1 };
        return d = _, T(L, p), _;
      }
      if (u.command.kind === "recover") {
        if (u.command.expectedVersion !== 0 || Object.hasOwn(u.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (I.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in b && b.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (b.readiness.kind !== "failed" || b.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const K = I.codec.parse(u.command.value);
        return K.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : D(l, p, K.value, l.history, "recover");
      }
      if (!("value" in b) || b.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const k = b, E = l.gestures.get(p);
      if (E && E.client !== u.address.client) return { kind: "rejected", reason: "busy" };
      if (u.command.kind === "begin" || u.command.kind === "end") {
        const { gesture: K } = u.command;
        if (!Number.isSafeInteger(K) || K <= 0) return { kind: "rejected", reason: "invalid-command" };
        if (E && E.gesture !== K) return { kind: "rejected", reason: "invalid-command" };
        const L = u.command.kind === "begin";
        if (L === !!E) return { kind: "accepted", revision: l.snapshot.revision, version: k.version };
        const _ = new Map(l.gestures);
        let N = l.history, q, G;
        if (L) {
          q = Object.freeze({ client: u.address.client, gesture: K });
          const ve = k.value;
          _.set(p, { ...q, before: ve, after: ve, order: 0, guardFloorVersion: k.version });
        } else E && (_.delete(p), N = O(N, p, E), N !== l.history && N.undoEntry && (G = It(l.snapshot.scope, E)));
        const de = v({ ...l, gestures: _ }, {
          ...l.snapshot.fields,
          [p]: Ee(k.value, k.persistence, k.version, k.metadata, q, k.application, k.persistenceRequest)
        }, N), ce = {
          kind: "accepted",
          revision: de.snapshot.revision,
          version: k.version,
          ...G ? { historyEntry: G } : {}
        };
        return d = ce, T({ ...de, gestures: _ }), a || I.kind === "parameter" && t.native.publish({
          request: ++c,
          scope: l.snapshot.scope,
          operations: [{ kind: L ? "gesture-start" : "gesture-end", endpoint: I.endpoint }]
        }), ce;
      }
      const { value: R, expectedVersion: P } = u.command;
      if (u.command.gesture !== void 0 && (!E || E.gesture !== u.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (E && u.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (P !== void 0 && P !== k.version && !(E && P >= E.guardFloorVersion && P <= k.version))
        return { kind: "rejected", reason: "stale-version" };
      const V = F(l, p, R);
      if (V.kind === "error") return { kind: "rejected", reason: "invalid-value" };
      const B = V.value;
      if (j(p, k.value, B)) return { kind: "accepted", revision: l.snapshot.revision, version: k.version, changed: !1 };
      const z = l.editOrder + 1;
      if (E) {
        const K = new Map(l.gestures).set(p, { ...E, after: B, order: z });
        return D({ ...l, gestures: K, editOrder: z }, p, B, y(p) ? l.history.clearRedo() : l.history, "edit");
      }
      return D({ ...l, editOrder: z }, p, B, y(p) ? l.history.record({ changes: [{ key: p, before: k.value, after: B }], order: z }) : l.history, "edit");
    } else if (u.kind === "engine") {
      const p = l.snapshot.fields[u.target.key];
      if (!p?.target || !Ne(p.target.scope, u.target.scope) || p.target.generation !== u.target.generation) return { kind: "accepted", revision: l.snapshot.revision };
      T(v(l, {
        ...l.snapshot.fields,
        [u.target.key]: Object.freeze({ ...p, application: Object.freeze({ ...u.status }) })
      }));
    } else if (u.kind === "detached") {
      if (!l.snapshot.scope || !Ne(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(u.client)) return { kind: "accepted", revision: l.snapshot.revision };
      const p = new Map(l.gestures), I = { ...l.snapshot.fields }, b = [];
      let k = l.history;
      for (const [R, P] of l.gestures) {
        if (P.client !== u.client) continue;
        p.delete(R), k = O(k, R, P);
        const V = I[R];
        V && "value" in V && (I[R] = Ee(V.value, V.persistence, V.version, V.metadata, void 0, V.application, V.persistenceRequest));
        const B = e[R];
        B?.kind === "parameter" && b.push({ kind: "gesture-end", endpoint: B.endpoint });
      }
      const E = p.size === l.gestures.size ? l : v({ ...l, gestures: p }, I, k);
      return d = { kind: "accepted", revision: E.snapshot.revision }, T({ ...E, gestures: p, detached: new Set(l.detached).add(u.client) }), !a && b.length > 0 && t.native.publish({ request: ++c, scope: l.snapshot.scope, operations: b }), d;
    } else if (u.kind === "parameter") {
      if (!l.snapshot.scope || !Ne(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [p, I] of l.parameters) {
        if (I.endpoint !== u.endpoint) continue;
        if (!Ar({ ...I, value: u.value })) return { kind: "rejected", reason: "invalid-value" };
        const b = l.snapshot.fields[p];
        if (!b || !("value" in b)) continue;
        const k = Object.is(b.value, u.value) ? l : v(l, {
          ...l.snapshot.fields,
          [p]: Ee(u.value, { kind: "host-managed" }, b.version + 1, b.metadata, b.gesture, { kind: "unconfirmed" })
        }), E = l.gestures.get(p), R = E && k !== l ? new Map(l.gestures).set(p, { ...E, guardFloorVersion: b.version + 1 }) : l.gestures;
        T({ ...k, gestures: R });
      }
    } else {
      if (!l.snapshot.scope || !Ne(u.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const p = l.publications.get(u.request);
      if (p) {
        const I = new Map(l.publications);
        I.delete(u.request);
        const b = l.snapshot.fields[p.key];
        if (b && "value" in b && b.version === p.version) {
          const k = u.result.kind === "observed" ? { kind: e[p.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: u.result.reason }, E = e[p.key]?.kind === "parameter" ? u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: u.result.reason }) } : b.application, R = v(l, { ...l.snapshot.fields, [p.key]: Object.freeze({
            ...Ee(b.value, k, b.version, b.metadata, b.gesture, E),
            ...u.result.kind === "failed" ? { persistenceRequest: u.request } : {}
          }) });
          T({ ...R, publications: I });
        } else T({ ...l, publications: I });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, w = (u) => {
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
      } catch (E) {
        p.push(Promise.reject(E));
      }
    Promise.allSettled(p).then((k) => {
      for (const E of k) E.status === "rejected" && t.onDefect(E.reason);
      l();
    });
    const I = n.get(i), b = {};
    for (const [k, E] of Object.entries(I.snapshot.fields)) {
      const { gesture: R, ...P } = "value" in E ? E : { ...E, gesture: void 0 };
      b[k] = Object.freeze({ ...P, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...v(I, b), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
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
  }, x = () => {
    if (!f) {
      f = !0;
      try {
        for (let u = m.shift(); u; u = m.shift()) {
          d = void 0, h = [];
          let l, p = !1;
          try {
            l = a ? { kind: "rejected", reason: "service-closed" } : ne(u.event), d = l;
            for (const I of h)
              a || I();
            a || (p = !0, t.native.update(g(), u.event.kind === "command" ? { address: u.event.address, result: l } : void 0));
          } catch (I) {
            l = d ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(I), w(!p && u.event.kind === "command" ? { address: u.event.address, result: l } : void 0);
          }
          u.finish(l);
        }
      } finally {
        f = !1;
      }
    }
  };
  return {
    getSnapshot: g,
    subscribe: (u) => n.sub(o, () => u(g())),
    dispatch: (u) => new Promise((l) => {
      m.push({ event: u, finish: l }), x();
    }),
    stop: () => (w(), s ?? Promise.resolve())
  };
}
const Va = 5e3;
function ue(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function $a(e, t) {
  const n = (i) => Array.isArray(i) && i.every((o) => {
    if (typeof o != "string" || o.length === 0) return !1;
    try {
      return encodeURIComponent(o).replace(/%[0-9A-F]{2}/g, "x").length <= 256;
    } catch {
      return !1;
    }
  });
  if (!Array.isArray(t)) throw new Error("Invalid custom engine binding declarations.");
  const r = /* @__PURE__ */ new Set();
  for (const i of t) {
    if (!i || typeof i != "object" || typeof i.create != "function" || !n([i.key]) || !Object.hasOwn(e, i.key))
      throw new Error("Invalid custom engine binding key or factory.");
    const o = e[i.key];
    if (o?.kind !== "stored" || o.engine?.kind === "event-value" || r.has(i.key))
      throw new Error("A stored field must have exactly one engine binding.");
    r.add(i.key);
    const a = i.dependencies ?? [];
    if (!n(a) || a.some((s) => !Object.hasOwn(e, s) || e[s]?.kind !== "parameter") || !n(i.eventEndpoints) || !n(i.hostEffects ?? []) || !n(i.outputEndpoints ?? []) || !n(i.storedKeys ?? []))
      throw new Error("Invalid custom engine binding dependency or effect declaration.");
  }
  return Object.freeze(t.map((i) => Object.freeze({
    key: i.key,
    dependencies: Object.freeze([...i.dependencies ?? []]),
    eventEndpoints: Object.freeze([...i.eventEndpoints]),
    hostEffects: Object.freeze([...i.hostEffects ?? []]),
    outputEndpoints: Object.freeze([...i.outputEndpoints ?? []]),
    storedKeys: Object.freeze([...i.storedKeys ?? []]),
    create: (o) => i.create(o)
  })));
}
function Ba(e, t, n) {
  let r = !1, i = !1, o, a, s = 0, c = 0, f, d, h, m = () => {
  }, g = () => {
  };
  const y = /* @__PURE__ */ new Map(), S = (w) => {
    if (!In(w)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: w });
  }, v = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new WeakMap(), O = [];
  for (const { key: w, input: x } of Co(e)) {
    const u = e[w];
    if (u?.kind !== "stored" || u.engine?.kind !== "shared-prepared") continue;
    const l = u.engine, p = Zt({
      async prepare(I, b) {
        const k = { parameters: I.parameters, signal: b }, E = await l.measure(I.value, k);
        return lt(E) ? { kind: "error", error: E.error } : !Number.isSafeInteger(E) || E <= 0 ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size." } } : { kind: "ok", value: { value: I.value, context: k, target: I.target, length: E } };
      },
      transport: {
        apply(I, b) {
          if (b.signal.aborted || !ue(A.getSnapshot().scope, I.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          a ??= Tr(t);
          const k = l.storage.type === "float32" ? I.length * 4 : I.length;
          return a.prepare({ input: x, byteLength: k }, I.target, b.signal, (E) => {
            const R = l.storage.type === "float32" ? new Float32Array(E.buffer, E.byteOffset, I.length) : new Uint8Array(E.buffer, E.byteOffset, I.length), P = l.prepare(I.value, R, I.context);
            if (lt(P)) return P;
            if (R instanceof Float32Array && !R.every(Number.isFinite))
              return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
          });
        },
        stop() {
        }
      },
      onStatus(I, b) {
        A.dispatch({ kind: "engine", target: I, status: b });
      },
      onDefect(I) {
        n.onDefect(I), j();
      }
    });
    O.push({
      key: w,
      dependencies: l.dependencies,
      replace(I, b) {
        p.replace({ ...I, target: b }, b);
      },
      cancel: p.cancel,
      stop: p.stop
    });
  }
  for (const [w, x] of Object.entries(e)) {
    if (x.kind !== "stored" || x.engine?.kind !== "event-value") continue;
    const u = x.engine, l = Zt({
      async prepare(p, I) {
        const b = await u.prepare(p.value, { parameters: p.parameters, signal: I });
        if (lt(b)) return { kind: "error", error: b.error };
        const k = Sr(b);
        return k.kind === "ok" ? { kind: "ok", value: { target: p.target, value: k.value } } : { kind: "error", error: { kind: "engine-rejected", message: k.message } };
      },
      transport: {
        apply(p, I) {
          return new Promise((b) => {
            let k = 0, E = () => {
            };
            const R = (P) => {
              E(), v.delete(k), b(P);
            };
            E = I.signal.onAbort(() => R({ kind: "cancelled" }));
            try {
              const P = I.send(() => ue(A.getSnapshot().scope, p.target.scope) ? (k = ++s, v.set(k, { kind: "event-value", key: w, scope: p.target.scope, finish: R }), S({
                kind: "publish",
                request: k,
                scope: p.target.scope,
                operations: [{ kind: "event", endpoint: u.endpoint, value: p.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              P.kind !== "sent" && R(P);
            } catch (P) {
              E(), v.delete(k), n.onDefect(P), j(), b({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const p of v.values()) p.key === w && p.finish({ kind: "cancelled" });
        }
      },
      onStatus(p, I) {
        A.dispatch({ kind: "engine", target: p, status: I });
      },
      onDefect: n.onDefect
    });
    O.push({
      key: w,
      dependencies: u.dependencies,
      replace(p, I) {
        l.replace({ ...p, target: I }, I);
      },
      cancel: l.cancel,
      stop: l.stop
    });
  }
  const A = za(e, {
    historyLimit: ja(e).historyLimit,
    bindings: O,
    onDefect: n.onDefect,
    native: {
      publish(w) {
        const x = ++s;
        y.set(x, { request: w.request, scope: w.scope }), S({ kind: "publish", ...w, request: x });
      },
      update(w, x) {
        w.scope && S({
          kind: "update",
          scope: w.scope,
          revision: w.revision,
          state: Ir(e, w),
          ...x ? { receipt: x } : {}
        });
      },
      close(w) {
        i = !0, o?.stop(), a?.stop();
        for (const x of v.values()) x.finish({ kind: "cancelled" });
        g(new Error("State service closed before native initialization completed."));
        try {
          r && A.getSnapshot().scope && S({ kind: "close", ...w });
        } catch (x) {
          n.onDefect(x);
        }
        r && t.removeEventListener("kit_state", F), r = !1, y.clear();
      }
    }
  }), D = (w) => {
    if (i) return;
    const x = La(w);
    if (x.kind === "invalid") {
      const l = new Error(x.message);
      n.onDefect(l), g(l), j();
      return;
    }
    const u = x.value;
    if (u.kind === "closed")
      g(new Error(`Native state service closed: ${u.reason}`)), j();
    else if (u.kind === "open-failed") {
      if (u.request !== c || A.getSnapshot().scope) return;
      g(new Error(`Native state open failed: ${u.reason}`)), j();
    } else if (u.kind === "opened") {
      if (u.request !== c || A.getSnapshot().scope) return;
      A.dispatch(u).then((l) => {
        l.kind === "accepted" ? m() : g(new Error("Native state could not initialize the service."));
      });
    } else if (u.kind === "attached-client") {
      const l = A.getSnapshot();
      ue(l.scope, u.scope) && S({
        kind: "snapshot",
        scope: u.scope,
        to: u.client,
        attachRequest: u.request,
        revision: l.revision,
        state: Ir(e, l)
      });
    } else if (u.kind === "detach")
      A.dispatch({ kind: "detached", scope: u.scope, client: u.client });
    else if (u.kind === "parameter")
      ue(A.getSnapshot().scope, u.scope) && A.dispatch(u);
    else if (u.kind === "replaced")
      A.dispatch(u).then((l) => {
        if (l.kind !== "accepted") return;
        const p = A.getSnapshot().scope;
        for (const I of v.values())
          ue(p, I.scope) || I.finish({ kind: "cancelled" });
        for (const [I, b] of y)
          ue(p, b.scope) || y.delete(I);
      });
    else if (u.kind === "command")
      A.dispatch(u);
    else if (u.kind === "invalid-command")
      ue(A.getSnapshot().scope, u.address) && S({
        kind: "receipt",
        address: u.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const l = v.get(u.request);
      if (l) {
        if (!ue(l.scope, u.scope) || !ue(A.getSnapshot().scope, u.scope)) return;
        if (l.kind === "custom" && u.result.kind === "failed" && (u.result.reason === "stale-scope" || u.result.reason === "closed")) {
          l.finish({ kind: "cancelled" });
          return;
        }
        l.finish(u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: u.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: u.result.reason } });
        return;
      }
      const p = y.get(u.request);
      if (!p || !ue(p.scope, u.scope) || !ue(A.getSnapshot().scope, u.scope)) return;
      y.delete(u.request), A.dispatch({ ...u, request: p.request });
    }
  }, F = (w) => {
    if (!i)
      try {
        D(w);
      } catch (x) {
        n.onDefect(x), g(x), j();
      }
  }, j = () => h || (i = !0, g(new Error("State service stopped before native initialization completed.")), h = A.stop(), h), ne = () => Object.entries(e).flatMap(([w, x]) => {
    if (x.kind !== "stored" || x.engine?.kind !== "prepared") return [];
    const u = x.engine, l = u.delivery;
    if (!l || typeof l.create != "function" || l.replacement !== void 0 && l.replacement !== "supersede" && l.replacement !== "finish")
      throw new Error("Invalid prepared delivery factory or replacement policy.");
    const p = l.create.bind(l), I = l.replacement, b = Object.freeze([...l.dataInputs ?? []]);
    if (b.some((R) => !Number.isSafeInteger(R) || R < 0 || R > 2147483647))
      throw new Error("Invalid shared-data input declaration.");
    const k = Array.isArray(l.outputEndpoints) ? Object.freeze([...l.outputEndpoints]) : l.outputEndpoints, E = Array.isArray(l.storedKeys) ? Object.freeze([...l.storedKeys]) : l.storedKeys;
    return [{
      key: w,
      storedKeys: E,
      dependencies: u.dependencies,
      eventEndpoints: l.eventEndpoints,
      hostEffects: l.hostEffects,
      outputEndpoints: k,
      create(R) {
        let P, V = !1;
        const B = /* @__PURE__ */ new Set();
        function z() {
          const L = P;
          if (P = void 0, !L) return;
          const _ = L.close();
          B.add(_), _.then(() => B.delete(_), (N) => {
            B.delete(_), R.onDefect(N);
          });
        }
        function K(L) {
          const _ = Object.freeze({ ...L.scope });
          let N = !0, q = L;
          const G = /* @__PURE__ */ new Set(), de = {
            get aborted() {
              return !N;
            },
            onAbort(U) {
              return N ? G.add(U) : U(), () => {
                G.delete(U);
              };
            }
          }, ce = {
            signal: de,
            send(U) {
              if (!N) return { kind: "cancelled" };
              const J = R.publish(_, U);
              if (J.kind === "submitted") {
                const Y = T.get(J.completion);
                Y && (G.add(Y), J.completion.then(() => G.delete(Y)));
              }
              return J;
            },
            listen(U, J) {
              if (!k?.includes(U)) throw new Error("Undeclared engine output endpoint.");
              if (!N) return () => {
              };
              let Y = !0;
              const X = (ye) => {
                if (!(!N || !Y))
                  try {
                    J(ye);
                  } catch (Ae) {
                    R.onDefect(Ae);
                  }
              }, le = () => {
                Y && (Y = !1, G.delete(le), t.removeEndpointListener?.(U, X));
              };
              return G.add(le), t.addEndpointListener?.(U, X), le;
            },
            readStored(U) {
              if (!E?.includes(U)) throw new Error("Undeclared stored-state input.");
              return N ? new Promise((J) => {
                const Y = () => J(void 0);
                G.add(Y), t.requestFullStoredState?.((X) => {
                  G.delete(Y);
                  const le = te(X) && te(X.values) ? X.values : X;
                  J(N && te(le) ? le[U] : void 0);
                });
              }) : Promise.resolve(void 0);
            },
            subscribeStored(U, J) {
              if (!E?.includes(U)) throw new Error("Undeclared stored-state input.");
              if (!N) return () => {
              };
              let Y = !0;
              const X = (ye) => {
                if (!(!N || !Y || !te(ye) || ye.key !== U))
                  try {
                    J(ye.value);
                  } catch (Ae) {
                    R.onDefect(Ae);
                  }
              }, le = () => {
                Y && (Y = !1, G.delete(le), t.removeStoredStateValueListener?.(X));
              };
              return G.add(le), t.addStoredStateValueListener?.(X), le;
            },
            async prepareData(U, J, Y, X) {
              if (!b.includes(U)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
              if (!N || X?.aborted) return { kind: "cancelled" };
              const le = {
                get aborted() {
                  return !N || !!X?.aborted;
                },
                onAbort(ye) {
                  const Ae = de.onAbort(ye), se = X?.onAbort(ye);
                  return () => {
                    Ae(), se?.();
                  };
                }
              };
              return a ??= Tr(t), a.prepare({ input: U, byteLength: J }, { ...q, scope: _ }, le, Y);
            },
            report(U) {
              N && R.onStatus(q, U);
            },
            fail(U) {
              N && R.onDefect(U);
            }
          };
          let ve;
          try {
            ve = p(ce);
          } catch (U) {
            N = !1;
            for (const J of [...G]) J();
            throw G.clear(), U;
          }
          let dr = !1;
          const ur = Zt({
            replacement: I,
            async prepare(U, J) {
              const Y = await u.prepare(U.value, { parameters: U.parameters, signal: J });
              return lt(Y) ? { kind: "error", error: Y.error } : { kind: "ok", value: { value: Y, target: U.target } };
            },
            transport: {
              async apply(U, J) {
                q = U.target;
                let Y = !0;
                const X = /* @__PURE__ */ new Set(), le = () => {
                  const se = [...X];
                  X.clear();
                  for (const be of se) be();
                }, ye = J.signal.onAbort(le), Ae = {
                  get aborted() {
                    return !Y || J.signal.aborted;
                  },
                  onAbort(se) {
                    return !Y || J.signal.aborted ? se() : X.add(se), () => {
                      X.delete(se);
                    };
                  }
                };
                try {
                  return await ve.apply(U.value, {
                    signal: Ae,
                    replaceData(se, be) {
                      return b.includes(se) ? !Y || J.signal.aborted || !ue(A.getSnapshot().scope, U.target.scope) ? Promise.resolve({ kind: "cancelled" }) : (o ??= Pa(t), o.replace(se, be, U.target, Ae)) : Promise.resolve({ kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } });
                    },
                    send(se) {
                      if (!Y || J.signal.aborted) return { kind: "cancelled" };
                      const be = R.publish(U.target.scope, se);
                      if (be.kind === "submitted") {
                        const Ce = T.get(be.completion);
                        Ce && (X.add(Ce), be.completion.then(() => X.delete(Ce)));
                      }
                      return be;
                    },
                    listen(se, be) {
                      if (!k?.includes(se)) throw new Error("Undeclared engine output endpoint.");
                      if (!Y || J.signal.aborted) return () => {
                      };
                      let Ce = !0;
                      const fr = (Qi) => {
                        if (!(!Ce || J.signal.aborted))
                          try {
                            be(Qi);
                          } catch (Xi) {
                            R.onDefect(Xi);
                          }
                      }, Xt = () => {
                        Ce && (Ce = !1, X.delete(Xt), t.removeEndpointListener?.(se, fr));
                      };
                      return X.add(Xt), t.addEndpointListener?.(se, fr), Xt;
                    }
                  });
                } finally {
                  Y = !1, ye(), le();
                }
              },
              stop() {
                dr || (dr = !0, ve.stop());
              }
            },
            onStatus: R.onStatus,
            onDefect: R.onDefect
          });
          return {
            scope: _,
            binding: ur,
            close() {
              N = !1;
              for (const U of [...G]) U();
              return G.clear(), ur.stop();
            }
          };
        }
        return {
          replace(L, _) {
            if (!V) {
              if ((!P || !ue(P.scope, _.scope)) && (z(), P = K(_)), V) {
                z();
                return;
              }
              P.binding.replace({ ...L, target: _ }, _);
            }
          },
          cancel() {
            z();
          },
          async stop() {
            V = !0, z(), await Promise.all(B);
          }
        };
      }
    }];
  });
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (f) return f;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return j(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      f = new Promise((w, x) => {
        m = () => {
          clearTimeout(d), w();
        }, g = (u) => {
          clearTimeout(d), x(u);
        };
      });
      try {
        const w = $a(e, [...ne(), ...n.bindings ?? []]);
        if (w.some((x) => x.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (w.some((x) => x.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const x of w) {
          const u = x.create({
            publish(l, p) {
              if (i || !ue(A.getSnapshot().scope, l)) return { kind: "cancelled" };
              const I = Object.freeze({ owner: l.owner, document: l.document });
              if (!p || typeof p != "object" || p.kind !== "event" && p.kind !== "host-effect")
                return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
              if (!(p.kind === "event" ? x.eventEndpoints.includes(p.endpoint) : x.hostEffects?.includes(p.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
              const k = Sr(p.value);
              if (k.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: k.message } };
              const E = p.kind === "event" ? { kind: "event", endpoint: p.endpoint, value: k.value } : { kind: "host-effect", name: p.name, value: k.value }, R = { kind: "publish", request: s + 1, scope: I, operations: [E] };
              if (!In(R)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
              const P = ++s;
              let V = (z) => {
              };
              const B = new Promise((z) => {
                V = (K) => {
                  v.delete(P), T.delete(B), z(K);
                };
              });
              T.set(B, () => V({ kind: "cancelled" })), v.set(P, { kind: "custom", key: x.key, scope: I, finish: V });
              try {
                t.sendMessageToServer({ type: "kit_state", message: R });
              } catch (z) {
                const K = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
                return V(K), n.onDefect(z), K;
              }
              return { kind: "submitted", completion: B };
            },
            onStatus(l, p) {
              A.dispatch({ kind: "engine", target: l, status: p });
            },
            onDefect(l) {
              n.onDefect(l), j();
            }
          });
          if (i) {
            const l = Promise.resolve().then(() => u.stop()).catch(n.onDefect);
            return h = Promise.all([h, l]).then(() => {
            }), f;
          }
          O.push({
            key: x.key,
            dependencies: x.dependencies ?? [],
            replace: (l, p) => u.replace(l, p),
            cancel: () => u.cancel(),
            stop: () => u.stop()
          });
        }
        r = !0, t.addEventListener("kit_state", F), c = ++s, d = setTimeout(() => {
          g(new Error("Cmajor state-channel is unavailable: native open timed out.")), j();
        }, Va), S({
          kind: "open",
          request: c,
          parameters: Object.values(e).filter((x) => x.kind === "parameter").map((x) => x.endpoint),
          storedKeys: Object.keys(e).filter((x) => e[x]?.kind === "stored" && e[x].lifetime !== "instance"),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((x) => x.kind === "stored" && x.engine?.kind === "event-value" ? [x.engine.endpoint] : []),
            ...w.flatMap((x) => x.eventEndpoints)
          ])],
          ...w.some((x) => x.hostEffects?.length) ? {
            hostEffects: [...new Set(w.flatMap((x) => x.hostEffects ?? []))]
          } : {}
        });
      } catch (w) {
        n.onDefect(w), g(w), j();
      }
      return f;
    },
    /** Release this owner and its channel resources. */
    stop: j
  };
}
const No = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), Sn = Reflect.get(globalThis, No), Er = Sn instanceof WeakMap ? Sn : /* @__PURE__ */ new WeakMap();
Sn !== Er && Object.defineProperty(globalThis, No, { value: Er });
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
const Fe = 2048, ft = Fe + 3, xr = 20, Po = "MSEG 1", Ga = 0, Ke = 2;
function mt(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function Vn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function tt(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Ya(e) {
  return Vn(Number.isFinite(e) ? e : 0, -xr, xr);
}
function Ve(e) {
  return Vn(Number.isFinite(e) ? e : 0, 0, 1);
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
  return Vn(
    Number.isFinite(t) ? t : 1,
    Ga,
    Ke
  );
}
function Qa(e) {
  if (!e || typeof e != "object")
    return null;
  const t = mt(e), n = Ve(Number(t.startX)), r = Ve(Number(t.endX));
  return tt(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Xa(e = Ko()) {
  const t = mt(e), n = mt(t.rate), r = Number(n.seconds), i = t.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
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
  const r = mt(e);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Ve(i)), {
    x: i,
    y: Ve(Number(r.y)),
    curvePower: Ya(Number(r.curvePower))
  };
}
function Yt(e = Fo()) {
  const t = mt(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Za(i, o, n.length));
  if (!tt(r[0].x, 0) || !tt(r[r.length - 1].x, 1))
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
function Rr(e) {
  return JSON.stringify(Yt(e));
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
    if (tt(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && tt(e[o + 1].x, t); )
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
  const n = Ve(Number(t)), r = ts(e, n);
  if (r.laterPointWins || tt(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Ve(es(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function rs(e, t) {
  return ns(Yt(e).points, t);
}
function os(e) {
  const t = new Float32Array(ft);
  return jo(e, t), t;
}
function jo(e, t) {
  if (t.length !== ft) throw new Error("Invalid MSEG destination length.");
  const n = Yt(e);
  for (let r = 0; r < Fe; r += 1) {
    const i = r / (Fe - 1);
    t[r + 1] = rs(n, i);
  }
  t[0] = t[1], t[Fe + 1] = t[Fe], t[Fe + 2] = t[Fe];
}
function Or(e, t) {
  return Rr(e) === Rr(t);
}
function he(e, t) {
  if (!e)
    throw new Error(t);
}
function en(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function is(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function kn(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Uo(e) {
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
function as() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function tn(e, t) {
  const n = as();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (is(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function wr(e) {
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
  throw new Error(`Unsupported text resource payload (${Uo(e)})`);
}
function ss(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return kn(e);
  throw new Error(`Unsupported binary resource payload (${Uo(e)})`);
}
function cs(e) {
  const t = e?.frames;
  he(
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
      he(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function zo(e) {
  const t = new DataView(e);
  he(en(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), he(en(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, c = null, f = 12;
  for (; f + 8 <= t.byteLength; ) {
    const h = en(t, f, 4), m = t.getUint32(f + 4, !0), g = f + 8;
    h === "fmt " ? (n = t.getUint16(g, !0), r = t.getUint16(g + 2, !0), i = t.getUint32(g + 4, !0), a = t.getUint16(g + 12, !0), o = t.getUint16(g + 14, !0)) : h === "data" && (s = g, c = m), f = g + m + m % 2;
  }
  he(n !== null, "Wave file is missing a fmt chunk"), he(s !== null && c !== null, "Wave file is missing a data chunk"), he(r === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && o === 32)
    d = new Float32Array(e.slice(s, s + c));
  else if (n === 1 && o === 16) {
    const h = c / 2, m = new Int16Array(e.slice(s, s + c));
    d = new Float32Array(h);
    for (let g = 0; g < h; g += 1)
      d[g] = m[g] / 32768;
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
async function Mr(e) {
  he(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return he(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function Tn(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Vo(e) {
  const t = new Uint8Array(e).buffer, n = zo(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function ls(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => (he(typeof e.readResource == "function", `Resource bridge cannot read ${c}`), e.readResource(c)), i = async (c) => {
    he(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const f = await e.readResourceAsAudioData(c);
    return cs(f);
  }, o = (c) => {
    const f = e.getResourceAddress?.(c);
    return f ?? null;
  }, a = async (c, f = e.getResourceAddress?.(c)) => {
    const d = tn(c, f), h = await Mr(d), m = zo(h);
    return {
      sampleRate: m.sampleRate,
      samples: m.samples
    };
  }, s = async (c, f = e.getResourceAddress?.(c)) => {
    const d = tn(c, f);
    return new Uint8Array(await Mr(d));
  };
  return {
    async readText(c) {
      if (t === "bridge" && typeof e.readResource == "function")
        return wr(await r(c));
      const f = o(c);
      return t === "url" && f !== null ? Tn(await s(c, f)) : typeof e.readResource == "function" ? wr(await r(c)) : Tn(await s(c, f));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof e.readResource == "function" ? ss(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(c);
      const f = o(c);
      return n === "url" && f !== null ? a(c, f) : typeof e.readResourceAsAudioData == "function" ? i(c) : Vo(await this.readBytes(c));
    },
    getURL(c) {
      return tn(c, e.getResourceAddress?.(c));
    }
  };
}
function ds(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return ls(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function us(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Tn(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return kn(await t(a));
      if (n)
        return kn(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Vo(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function fs(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function ms(e) {
  return fs(e) ? us(e) : ds(e);
}
const Ue = -100, pt = 35, $n = 5, Bn = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function $o(e) {
  const t = Bn.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function pe(e) {
  return $o(e).laneEndpointID;
}
function Hn(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > $n)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${$o(e).hostStem}${t}OutputTrimDb`;
}
function Bo() {
  return Bn.flatMap((e) => Array.from(
    { length: $n },
    (t, n) => Hn(e.deviceType, n + 1)
  ));
}
function ps(e) {
  if (typeof e != "string")
    return null;
  for (const t of Bn)
    for (let n = 1; n <= $n; n += 1)
      if (e === Hn(t.deviceType, n))
        return {
          deviceType: t.deviceType,
          instanceNumber: n,
          laneEndpointID: t.laneEndpointID
        };
  return null;
}
function Ho(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function hs(e) {
  const t = (Ho(e, Ue, pt) - Ue) / (pt - Ue);
  return t * t;
}
function gs(e) {
  const t = Math.sqrt(Ho(e, 0, 1));
  return Ue + t * (pt - Ue);
}
const fe = (e, t) => ({ label: e, value: t });
function xe(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const Re = Object.freeze({
  filter: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: xe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), C = (e, t, n, r, i, o, a, s = {}) => ({
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
function Oe(e, t, n) {
  return C(
    e,
    t,
    "Output Trim",
    "Trim",
    Ue,
    pt,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const vs = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ys = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], bs = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: Re.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      C("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(fe), quick: !0 }),
      C("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      C("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      C("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      Oe("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: Re.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      C("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [fe("Classic", 0), fe("Harmonics", 1)] }),
      C("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      C("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      C("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      C("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      C("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      C("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [fe("Symmetric", 0), fe("Asymmetric", 1), fe("Wavefold", 2)] }),
      Oe("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: Re.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      C("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      C("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      C("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      C("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      C("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      Oe("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: Re.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      C("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(fe) }),
      C("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(fe) }),
      C("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      C("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      C("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      C("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      C("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      Oe("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: Re.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      C("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      C("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      C("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      C("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      C("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      Oe("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: Re.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      C("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [fe("Free", 0), fe("Sync", 1)] }),
      C("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      C("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: vs.map(fe) }),
      C("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      C("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      C("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      C("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      C("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      Oe("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: Re.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      C("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [fe("Free", 0), fe("Sync", 1)] }),
      C("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      C("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ys.map(fe) }),
      C("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      C("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      C("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      Oe("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: Re.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      C("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      C("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      C("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      C("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      Oe("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Jt = bs, qo = Object.freeze(
  Jt.flatMap((e) => e.parameters)
);
new Map(
  qo.map((e) => [e.endpointID, e])
);
function Wo(e) {
  const t = Jt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Go() {
  return qo;
}
function qn(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const H = ["A", "B", "C"], Wn = [
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
], Is = [
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
], He = Object.freeze([
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
]), Ss = Object.freeze([
  ...H.flatMap((e) => Wn.map(
    (t) => `osc${e}.${t}`
  )),
  ...Is
]);
new Set(
  H.flatMap((e) => Wn.map(
    (t) => `osc${e}.${t}`
  ))
);
const Yo = Object.freeze(
  Ss.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), ks = Go().filter(
  (e) => e.modulationTargetIndex !== null
), Ts = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Gn(e) {
  const t = As(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function As(e) {
  const t = Ts.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const Es = [
  ...ks.map((e) => ({
    kind: Gn(qn(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Jo = Object.freeze(
  Es.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), De = Object.freeze([
  ...Yo,
  ...Jo
]), Rt = He.length, Qo = Yo.length, Qt = Jo.length, xs = Rt * De.length, Rs = new Map(He.map((e) => [e.id, e])), Xo = new Map(He.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), ot = new Map(De.map((e) => [e.kind, e]));
function Os() {
  if (Rt !== 14 || Qo !== 59 || Qt !== 47 || xs !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = He.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = De.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (Rs.size !== Rt || Xo.size !== Rt || ot.size !== De.length)
    throw new Error("Modulation identities must be unique");
}
Os();
function Zo(e, t) {
  const n = Xo.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function Yn(e) {
  return typeof e != "string" ? null : ot.has(e) ? e : null;
}
function ws(e) {
  const t = Yn(e);
  return t !== null && ot.get(t)?.group === "voice" ? t : null;
}
function Jn(e) {
  const t = Yn(e);
  return t !== null && ot.get(t)?.group === "rack" ? t : null;
}
function ei(e) {
  const t = ot.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function ti(e) {
  const t = ot.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Ms(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const ni = 4, Ds = ni * Qt, _s = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Ls = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function qe(e) {
  if (typeof e != "string")
    return null;
  const t = Ls.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = _s.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function Qn(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function ri(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function oi(e) {
  if (e === null)
    return null;
  const t = ri(e) - 1;
  return t > ni ? null : t * Qt + ti(Qn(e));
}
function Cs(...e) {
  return { ...Fo(...e), format: "cosimo.mseg.shape" };
}
function Dr(...e) {
  return { ...Yt(...e), format: "cosimo.mseg.shape" };
}
function _r(...e) {
  return { ...Ko(...e), format: "cosimo.mseg.playback" };
}
function Ns(...e) {
  return { ...Xa(...e), format: "cosimo.mseg.playback" };
}
const nn = "modulationProgram", Ps = "modulationAmount", ii = He.filter((e) => e.group === "voice").length, ai = He.filter((e) => e.group === "macro").length, Lt = Qo, Fs = Qt, Ct = Fs + Ds, je = ii * Lt, Ge = ai * Lt, Ks = ii * Ct, js = ai * Ct, Pe = 512, We = 256, si = je + Ge;
function Us(e) {
  const t = Zo(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function zs(e) {
  const t = ws(e);
  return t === null ? null : ei(t);
}
function ci(e) {
  const t = zs(e.targetKind), n = Jn(e.targetKind);
  let r = n === null ? void 0 : ti(n);
  if (r === void 0) {
    const a = oi(
      qe(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Zo(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (t !== null) {
      const f = s * Lt + t;
      return {
        path: "macroVoice",
        cellIndex: f,
        sourceIndex: s,
        targetIndex: t,
        articulationCellIndex: je + f
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Ct + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const i = Us(e);
  if (t !== null) {
    const a = i * Lt + t;
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
    cellIndex: i * Ct + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function li(e) {
  return qe(e.targetKind) !== null ? null : ci(e).articulationCellIndex;
}
function Vs(e) {
  if (Jn(e.targetKind) !== null)
    return !1;
  const t = qe(e.targetKind);
  return t !== null && oi(t) === null;
}
function $s(e) {
  return {
    ...ci(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function di(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Vs(n))
      continue;
    const r = $s(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Bs(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function Ye(e) {
  return [...e.values()].filter(Bs).sort((t, n) => t.cellIndex - n.cellIndex);
}
function St(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function rn(e) {
  const t = di(e), n = Ye(t.voice), r = Ye(t.macroVoice), i = Ye(t.voiceRack), o = Ye(t.macroRack), a = Array.from({ length: je }, () => 0), s = Array.from({ length: je }, () => 0), c = Array.from({ length: je }, () => 0), f = Array.from({ length: je }, () => 0), d = Array.from({ length: je }, () => 0);
  St(n, a, s, c, f);
  const h = Array.from({ length: Ge }, () => 0), m = Array.from({ length: Ge }, () => 0), g = Array.from({ length: Ge }, () => 0), y = Array.from({ length: Ge }, () => 0), S = Array.from({ length: Ge }, () => 0);
  if (St(
    r,
    h,
    m,
    g,
    y
  ), i.length > Pe || o.length > We)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${Pe}), ${o.length} macro-rack (max ${We})`
    );
  const v = Array.from({ length: Pe }, () => 0), T = Array.from({ length: Pe }, () => 0), O = Array.from({ length: Pe }, () => 0), A = Array.from({ length: Pe }, () => 0), D = Array.from({ length: Pe }, () => 0), F = Array.from({ length: Ks }, () => 0);
  St(
    i,
    v,
    T,
    O,
    A
  );
  const j = Array.from({ length: We }, () => 0), ne = Array.from({ length: We }, () => 0), w = Array.from({ length: We }, () => 0), x = Array.from({ length: We }, () => 0), u = Array.from({ length: js }, () => 0);
  St(
    o,
    j,
    ne,
    w,
    x
  );
  for (const l of t.voice.values()) d[l.cellIndex] = l.amount;
  for (const l of t.macroVoice.values()) S[l.cellIndex] = l.amount;
  for (const l of t.voiceRack.values()) F[l.cellIndex] = l.amount;
  for (const l of t.macroRack.values()) u[l.cellIndex] = l.amount;
  for (let l = 0; l < i.length; l += 1) {
    const p = i[l];
    if (p === void 0) throw new Error(`Missing compiled voice-rack route at index ${l}`);
    D[l] = p.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: f,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: h,
    macroVoiceRouteSources: m,
    macroVoiceRouteTargets: g,
    macroVoiceRoutePolarities: y,
    macroVoiceRouteAmounts: S,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: v,
    voiceRackRouteSources: T,
    voiceRackRouteTargets: O,
    voiceRackRoutePolarities: A,
    voiceRackRouteReducers: D,
    voiceRackRouteAmounts: F,
    macroRackRouteCount: o.length,
    macroRackRouteCells: j,
    macroRackRouteSources: ne,
    macroRackRouteTargets: w,
    macroRackRoutePolarities: x,
    macroRackRouteAmounts: u
  };
}
const Hs = ["voice", "macroVoice", "voiceRack", "macroRack"], qs = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Lr(e) {
  return di(e);
}
function Ws(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function Gs(e, t) {
  if (e === null)
    return [{ endpointID: nn, value: rn(t) }];
  const n = Lr(e), r = Lr(t), i = [];
  for (const o of Hs) {
    const a = Ye(n[o]), s = Ye(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: nn, value: rn(t) }];
    for (let c = 0; c < s.length; c += 1) {
      const f = a[c], d = s[c];
      if (f === void 0 || d === void 0 || !Ws(f, d))
        return [{ endpointID: nn, value: rn(t) }];
      f.amount !== d.amount && i.push({
        endpointID: Ps,
        value: {
          pathKind: qs[o],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return i;
}
function it(e) {
  return { _tag: "ok", value: e };
}
function ut(e) {
  return { _tag: "err", error: e };
}
function Ys(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Js(e) {
  throw new Error(e ?? "Invariant violated");
}
const Qs = "globalTune", Xs = "globalTuneSemitones", we = -24, at = 24, Cr = 0, ui = -48, fi = 48, An = -48, mi = 6, Xn = 0, Nr = (Xn - An) / (mi - An), Zs = "voiceEnhancerFrequency", ec = "voiceEnhancerQ", tc = "voiceEnhancerAmount", nc = "voiceEnhancerFrequencyOctaves", rc = "voiceEnhancerQ", oc = "voiceEnhancerAmount", pi = "voice.enhancerFrequency", ic = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Zs,
    targetKind: nc,
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
    endpointID: ec,
    targetKind: rc,
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
    endpointID: tc,
    targetKind: oc,
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
function Pr(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function ac(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function kt(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const sc = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      kt("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      kt("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      kt("mix", "Mix", 100, 100),
      kt("drive", "Drive", 15, 0)
    ]
  }
], Fr = 1e-6;
function ge(e, t) {
  if (!Number.isFinite(e) || e < -Fr || e > 1 + Fr)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function Nt(e, t) {
  return ge(e / 100, `${t} catalog percentage`);
}
function gt(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function cc(e) {
  return 20 * 1e3 ** e;
}
function lc(e) {
  return ge(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function dc(e) {
  return 0.1 * 200 ** e;
}
function uc(e) {
  return ge(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function fc(e) {
  return e;
}
function mc(e) {
  return ge(e, "filterMix endpoint conversion");
}
function Ze(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function pc(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Ze("filterCutoff", cc, lc),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ze("filterQ", dc, uc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ze("filterMix", fc, mc),
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
function hi(e) {
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
      return Ys(e);
  }
}
function hc(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function gc(e, t) {
  const n = gt(e.moduleId, t.id), r = hi(t.format), i = pc(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: Nt(t.defaultPercent, n),
    initialValue: Nt(t.initialPercent, n),
    format: r,
    modAmount: hc(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const vc = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Nr * 100, defaultPercent: Nr * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function yc(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function bc(e, t) {
  const n = `osc${e}`, r = gt(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: Nt(t.defaultPercent, r),
    initialValue: Nt(t.initialPercent, r),
    format: hi(t.format),
    modAmount: yc(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const Ic = Object.freeze(
  H.flatMap((e) => vc.map((t) => bc(e, t)))
), Sc = Object.freeze({
  targetId: gt("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: ge(
    (Cr - we) / (at - we),
    "Global Tune default"
  ),
  initialValue: ge(
    (Cr - we) / (at - we),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: at },
  modAmount: {
    min: ui,
    max: fi,
    unit: "st",
    digits: 2
  },
  binding: Ze(
    Qs,
    (e) => we + (at - we) * e,
    (e) => ge(
      (e - we) / (at - we),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Xs
});
function kc(e) {
  const t = gt("voice-enhancer", e.key), n = ge(
    Pr(e, e.initial),
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
    binding: Ze(
      e.endpointID,
      (r) => ac(e, r),
      (r) => ge(
        Pr(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Tc = Object.freeze(
  Object.values(ic).map(kc)
), Ac = Object.freeze([
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
function Ec(e) {
  const t = gt(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => ge(
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
    binding: Ze(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const xc = Object.freeze(
  Ac.map(Ec)
), Rc = Object.freeze([
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
function Oc(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function on(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? hs(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return ge(n, `${e.endpointID} endpoint conversion`);
}
function wc(e, t) {
  return e.valueKind === "effect-output-trim-db" ? gs(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function Mc(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Dc(e) {
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
function _c(e) {
  const t = Oc(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: on(e, e.initial),
    initialValue: on(e, e.initial),
    format: Mc(e),
    modAmount: Dc(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => wc(e, n),
      fromEngine: (n) => on(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : Gn(qn(e))
  });
}
const Zn = Object.freeze(
  [
    ...Jt.flatMap((e) => e.parameters.map(_c)),
    ...Rc,
    Sc,
    ...Tc,
    ...Ic,
    ...xc,
    ...sc.flatMap(
      (e) => e.parameters.map(
        (t) => gc(e, t)
      )
    )
  ]
), Lc = new Map(
  Zn.map((e) => [e.targetId, e])
), gi = Zn.filter(
  (e) => e.modulationTargetKind !== null
), En = new Map(
  gi.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Lc.size !== Zn.length)
  throw new Error("Target descriptor IDs must be unique");
if (gi.length !== De.length || En.size !== De.length || De.some((e) => En.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function an(e) {
  const t = En.get(e);
  return t === void 0 ? Js(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  Jt.map((e) => [e.id, e.label])
);
function Cc(e) {
  const t = ri(e);
  return t === 1 ? "" : ` ${t}`;
}
function Nc(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = an(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = qe(e);
  if (n !== null) {
    const r = an(Qn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Cc(n)} ${r.label.toUpperCase()}`;
  }
  return an(e).label.toUpperCase();
}
const Je = "modulation.v6", vi = 6, vt = 3, Qe = 3, Pc = 4, Kr = "modulationMsegBuffer", Fc = "modulationMsegPlayback", yi = 4, Kc = ["MSEG 1", "MSEG 2", "MSEG 3"], bi = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], jc = ["Env 1", "Env 2", "Env 3"], Uc = 1e-3, Q = 10, zc = 0.1, Vc = 20, jr = 10 - 0.1, $c = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Vc - zc },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: ui,
    max: fi
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
  mseg1Rate: { min: -Ke, max: Ke },
  mseg2Rate: { min: -Ke, max: Ke },
  mseg3Rate: { min: -Ke, max: Ke },
  env1Attack: { min: -Q, max: Q },
  env1Decay: { min: -Q, max: Q },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -Q, max: Q },
  env2Attack: { min: -Q, max: Q },
  env2Decay: { min: -Q, max: Q },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -Q, max: Q },
  env3Attack: { min: -Q, max: Q },
  env3Decay: { min: -Q, max: Q },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -Q, max: Q },
  ampAttack: { min: -Q, max: Q },
  ampDecay: { min: -Q, max: Q },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -Q, max: Q },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -jr, max: jr },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Bc = Go().filter((e) => e.modulationTargetIndex !== null), Hc = new Map(
  Bc.map((e) => [
    Gn(qn(e)),
    e
  ])
);
class sn extends Error {
  name = "ModulationStateParseError";
}
const qc = {
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
He.map((e) => ({
  value: e.id,
  label: qc[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Wc = De.map((e) => ({
  value: e.kind,
  label: Nc(e.kind)
}));
Wc.filter((e) => !Yc(e.value));
function Gc(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function er(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function cn(e, t) {
  const n = Number(e);
  return er(Number.isFinite(n) ? n : t, Uc, Q);
}
function Yc(e) {
  return Jn(e) !== null;
}
function Jc(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function Qc(e) {
  const t = qe(e);
  return t !== null ? Qn(t) : e;
}
function Xc(e) {
  const t = Qc(e);
  if (qe(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Hc.get(t);
  return n !== void 0 ? Jc(n) : $c[Ms(t)];
}
function Zc(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function el(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function tl(e, t) {
  const n = Xc(e), r = Number(t);
  return er(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function nl(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function rl(e) {
  return nl(e) ?? "mseg";
}
function ol(e) {
  const t = Yn(e);
  return t !== null ? t : qe(e) !== null ? e : null;
}
function il(e) {
  return ol(e) ?? "oscA.wavetablePosition";
}
function al(e, t) {
  const n = bi[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function sl(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? vt : e === "macro" ? yi : Pc;
  return er(Number.isFinite(n) ? n : 1, 1, r);
}
function Xe(e) {
  return {
    name: jc[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ii(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = Xe(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: cn(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: cn(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Ve(n.sustain ?? r.sustain),
    releaseSeconds: cn(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function cl(e, t = 0) {
  return { name: Ii(e, t).name };
}
function ll(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: Zc(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: sl(n, e.sourceSlot),
    polarity: el(e.polarity),
    targetKind: r,
    amount: tl(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function dl(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = rl(r.sourceKind), o = il(r.targetKind);
  return ll(r, t, i, o);
}
function ul(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function fl(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => dl(n, r));
}
function ml(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = ul(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function xn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, s) => xn(a, t[s]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Gc(r, a) && xn(n[a], r[a]));
}
function Si(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = Cs(Kc[t] ?? `MSEG ${t + 1}`), i = Dr(n.shapeA ?? r), o = Ns({
    ..._r(),
    ...n.playback ?? {},
    rate: _r().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: Dr(n.shapeB ?? i),
    playback: s
  };
}
function Pt() {
  return {
    format: "cosimo.modulation",
    version: vi,
    msegSlots: Array.from({ length: vt }, (e, t) => Si({}, t)),
    envelopeSlots: Array.from({ length: Qe }, (e, t) => ({
      name: Xe(t).name
    })),
    routes: [],
    macroNames: bi.slice()
  };
}
function pl(e = Pt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: vi,
    msegSlots: Array.from({ length: vt }, (o, a) => Si(n[a], a)),
    envelopeSlots: Array.from({ length: Qe }, (o, a) => cl(r[a], a)),
    routes: fl(t.routes),
    macroNames: Array.from(
      { length: yi },
      (o, a) => al(i[a], a)
    )
  };
}
function ln(e) {
  const t = Ft(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function Ft(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return ut(new sn("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return ut(new sn("Expected valid modulation JSON"));
    }
  }
  const n = pl(t);
  return !xn(t, n) || !ml(n.routes) ? ut(new sn("Expected the current modulation schema")) : it(n);
}
function hl(e, t) {
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
function Ur(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(os(n))
  };
}
function gl(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function zr(e, t = null, n) {
  const r = [];
  for (let i = 0; i < vt; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !Or(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: Kr,
      value: Ur(i, 0, o.shapeA)
    }), (a === void 0 || !Or(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: Kr,
      value: Ur(i, 1, o.shapeB)
    }), (a === void 0 || !gl(a.playback, o.playback)) && r.push({
      endpointID: Fc,
      value: hl(i, o.playback)
    });
  }
  return r.push(...Gs(t?.routes ?? null, e.routes)), r;
}
function ki(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) ki(t);
    Object.freeze(e);
  }
}
const vl = {
  parse(e) {
    const t = Ft(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (ki(t.value), { kind: "ok", value: t.value });
  },
  encode: ln,
  equals: (e, t) => ln(e) === ln(t)
}, yl = [
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
], bl = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function Il(e) {
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
function Sl(e, t, n) {
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
function kl(e, t, n) {
  const r = `osc${e}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${e}.${Il(n)}`,
    runtimeTargetIndex: ei(r),
    oscillatorIndex: t
  });
}
function Tl(e, t) {
  const n = Object.freeze(yl.map(
    (o) => Sl(e, t, o)
  )), r = Object.freeze(Wn.map(
    (o) => kl(e, t, o)
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
const Ot = Object.freeze(
  bl.map(({ id: e, oscillatorIndex: t }) => Tl(e, t))
);
function Al() {
  if (Ot.length !== H.length || Ot.some((t, n) => t.id !== H[n] || t.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const e = Ot.flatMap(
    (t) => t.controls.map((n) => n.endpointID)
  );
  if (new Set(e).size !== e.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
Al();
const dn = "articulationSnapshot", Z = 128, Vr = 48, El = 1e6, ie = -1, un = [
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
function tr(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function fn(e) {
  return tr(Number.isFinite(e) ? e : 0, 0, 1);
}
function ae(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return tr(Number.isFinite(i) ? i : t, n, r);
}
function re(e, t, n, r) {
  return tr(Math.round(ae(e, t)), n, r);
}
function Ti(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function mn() {
  return Array.from({ length: Z }, () => ie);
}
function xl(e) {
  const t = re(e, 0, 0, Z - 1), n = un[t % un.length], r = Math.floor(t / un.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function Rl() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Xn,
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
function Ol(e) {
  const t = Rl(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: ae(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: ae(n.pan, t.pan, -1, 1),
    octave: re(n.octave, t.octave, -4, 4),
    semitone: re(n.semitone, t.semitone, -12, 12),
    fineCents: ae(n.fineCents, t.fineCents, -100, 100),
    volumeDb: ae(
      n.volumeDb,
      t.volumeDb,
      An,
      mi
    ),
    mute: re(n.mute, t.mute, 0, 1),
    solo: re(n.solo, t.solo, 0, 1),
    warpMode: re(n.warpMode, t.warpMode, 0, 4),
    warpAmount: ae(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: re(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: ae(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: ae(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: ae(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: re(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: ae(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: ae(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: ae(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: ae(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: ae(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: re(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: re(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: re(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: ae(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: ae(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      fn(Number(r[0])),
      fn(Number(r[1])),
      fn(Number(r[2]))
    ]
  };
}
function wl(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: ae(t.amount, 0, -48, 48)
  } : null;
}
function Ml(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(wl).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Ol(t.parameters),
    envelopes: [0, 1, 2].map((i) => Ii(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Dl(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = re(n.runtimeSlot, t, 0, Z - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : xl(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Ml(n.snapshot)
  };
}
function _l(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: re(n.note, 0, 0, Z - 1),
    articulationId: r
  } : null;
}
function Ll(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let s = re(o.min, i, i, Z - 1), c = re(o.max, s, i, Z - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function $r(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = Ll(
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
function Cl(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = _l(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function Nl(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < Z; c += 1) {
    const f = Dl(n[c], c);
    !f || r.has(f.runtimeSlot) || i.has(f.id) || (r.add(f.runtimeSlot), i.add(f.id), o.push(f));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((c) => c.id === t.selectedSlotId) ? t.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ti(t.activeTriggerMode),
    slots: o,
    chainAssignments: $r(t.chainAssignments, s, "chain", 0),
    keyAssignments: Cl(t.keyAssignments, s),
    velocityAssignments: $r(t.velocityAssignments, s, "velocity", 1)
  };
}
function Br(e) {
  const t = (n) => H.map(() => n);
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
    volumeDbs: t(Xn),
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
    msegMorphs: Array.from({ length: vt }, () => 0),
    routeAmounts: Array.from({ length: si }, () => 0),
    envelopeAttackSeconds: Array.from({ length: Qe }, (n, r) => Xe(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: Qe }, (n, r) => Xe(r).decaySeconds),
    envelopeSustain: Array.from({ length: Qe }, (n, r) => Xe(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: Qe }, (n, r) => Xe(r).releaseSeconds)
  };
}
function Hr(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === ie && (e[o] = i);
  }
}
function Pl(e) {
  const t = Nl(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = mn(), i = mn(), o = mn();
  Hr(r, t.chainAssignments, n), Hr(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== ie || (i[a.note] = s);
  }
  return o[0] = ie, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Ai(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : Pl(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ti(t.activeMode),
    chain: Array.from({ length: Z }, (n, r) => re(t.chain?.[r], ie, ie, Z - 1)),
    key: Array.from({ length: Z }, (n, r) => re(t.key?.[r], ie, ie, Z - 1)),
    velocity: Array.from({ length: Z }, (n, r) => r === 0 ? ie : re(t.velocity?.[r], ie, ie, Z - 1))
  });
}
function Fl(e, t) {
  const n = Ai(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const me = "articulations.v4", nr = [
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
], rr = [
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
], Ei = [
  ...H.flatMap((e) => nr.map(
    (t) => `osc${e}.${t}`
  )),
  ...rr
];
class xi extends Error {
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
function $(e) {
  return ut(new xi("malformed", e));
}
function yt(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function or(e, t, n) {
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
function Kt(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < Z;
}
function Kl(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function jl(e) {
  return Ei.some((t) => t === e);
}
function qr(e, t) {
  if (!yt(e))
    return $(`${t} must be an object`);
  const n = or(e, ["min", "max"], t);
  return n !== null ? $(n) : Kt(e.min) ? Kt(e.max) ? e.min > e.max ? $(`${t}.min must be less than or equal to ${t}.max`) : it({ min: e.min, max: e.max }) : $(`${t}.max must be an integer in 0..127`) : $(`${t}.min must be an integer in 0..127`);
}
function Ul(e, t) {
  if (!yt(e))
    return $(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return $(`${t} has a non-string parameter id`);
    if (!jl(r))
      return $(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return $(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return it(n);
}
function Ri(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Oi() {
  return {};
}
function zl(e, t, n) {
  if (!yt(e))
    return $(`${t} must be an object`);
  const r = Oi();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return $(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Vr)
      return $(
        `${t}.${i} must be a finite route amount within ±${Vr}`
      );
    if (!n.has(i))
      return $(`${t}.${i} does not name a current articulable mapping`);
    Ri(r, i, o);
  }
  return it(r);
}
function Vl(e, t, n) {
  const r = `slots[${t}]`;
  if (!yt(e))
    return $(`${r} must be an object`);
  const i = or(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return $(i);
  if (typeof e.id != "string")
    return $(`${r}.id must be a string`);
  if (!Kt(e.runtimeSlot))
    return $(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return $(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return $(`${r}.color must be a string`);
  if (!Kt(e.key))
    return $(`${r}.key must be an integer in 0..127`);
  const o = qr(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = qr(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Ul(e.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = zl(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : it({
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
function $l(e) {
  const t = {};
  for (const n of Ei) {
    if (!Object.hasOwn(e, n))
      continue;
    const r = e[n];
    r !== void 0 && (t[n] = r);
  }
  return t;
}
function Bl(e) {
  const t = Oi();
  for (const [n, r] of Object.entries(e))
    Ri(t, n, r);
  return t;
}
const Hl = Object.fromEntries(
  nr.map((e, t) => [e, 2 ** t])
), ql = Object.fromEntries(
  rr.map((e, t) => [e, 2 ** t])
);
function Wr(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Wl(e, t) {
  return nr.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | Hl[r] : n, 0);
}
function Gl(e) {
  return rr.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | ql[n] : t, 0);
}
function Yl(e, t) {
  const n = (o, a) => Wr(e, `osc${o}.${a}`), r = (o) => Wr(e, o), i = Array.from(
    { length: si },
    () => El
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const s = t[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: H.map((o) => Wl(e, o)),
    sharedOverrideMask: Gl(e),
    framePositions: H.map((o) => n(o, "framePosition")),
    pans: H.map((o) => n(o, "pan")),
    octaves: H.map((o) => n(o, "octave")),
    semitones: H.map((o) => n(o, "semitone")),
    fineCents: H.map((o) => n(o, "fineCents")),
    phases: H.map((o) => n(o, "phase")),
    phaseRandoms: H.map((o) => n(o, "phaseRandom")),
    retriggers: H.map((o) => n(o, "retrigger")),
    volumeDbs: H.map((o) => n(o, "volumeDb")),
    mutes: H.map((o) => n(o, "mute")),
    solos: H.map((o) => n(o, "solo")),
    warpModes: H.map((o) => n(o, "warpMode")),
    warpAmounts: H.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: H.map((o) => n(o, "unisonVoices")),
    unisonDetunes: H.map((o) => n(o, "unisonDetune")),
    unisonBlends: H.map((o) => n(o, "unisonBlend")),
    unisonWidths: H.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: H.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: H.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: H.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: H.map((o) => n(o, "unisonWarpSpread")),
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
function Jl(e, t) {
  return e.slots.map((n) => Yl(n, t));
}
function wi(e, t) {
  if (!yt(e))
    return $("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return $('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return ut(new xi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = or(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return $(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return $("selectedSlotId must be null or a string");
  if (!Kl(e.activeTriggerMode))
    return $('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return $("slots must be an array");
  if (e.slots.length > Z)
    return $(`slots must contain at most ${Z} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const s = Vl(e.slots[a], a, t);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (i.has(c.id))
      return $(`slots[${a}].id duplicates "${c.id}"`);
    if (o.has(c.runtimeSlot))
      return $(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    i.add(c.id), o.add(c.runtimeSlot), r.push(c);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? $(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : it({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function pn(e) {
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
      overrides: $l(t.overrides),
      routeAmounts: Bl(t.routeAmounts)
    }))
  };
}
function ir() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ql(e) {
  const t = Array.from({ length: Z }, () => ie), n = Array.from({ length: Z }, () => ie), r = Array.from({ length: Z }, () => ie);
  for (const i of e.slots) {
    n[i.key] === ie && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === ie && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === ie && (r[o] = i.runtimeSlot);
  }
  return r[0] = ie, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
async function Xl(e, t, n, r = {}) {
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
const Zl = 3, ed = (4 + ft) * 4, Gr = "runtimeState";
function td(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Yr = "runtimeInstallAck", Mi = "runtimeSyncRequest", Rn = 0, nd = 8e3, jt = /* @__PURE__ */ new WeakMap(), Di = 1e9;
let Tt = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Di;
function rd(e) {
  return Tt = Tt % Di + 1, e === "modulation" ? -1e9 - Tt : 1e9 + Tt;
}
function od(e, t) {
  const n = e, r = jt.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), jt.set(n, r);
}
function Jr(e, t) {
  const n = e, r = jt.get(n);
  r?.delete(t), r?.size === 0 && jt.delete(n);
}
const id = [100, 250, 500, 1e3], At = { _tag: "accepted" }, ad = { _tag: "superseded" }, sd = { _tag: "stopped" }, Qr = { _tag: "transport-timeout" };
function cd(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, f = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    c,
    f
  ].every((h) => typeof h == "number" && Number.isSafeInteger(h) && h >= -2147483648 && h <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof f != "number" || i < 0 || o < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: f
  };
}
function ld(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Xr {
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
    this.#o = r && r.length > 0 ? r : [...id], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? nd)
    );
  }
  start() {
    if (!this.#i) {
      od(this.#t, this.#e);
      try {
        this.#h += 1, this.#i = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(Yr, this.#k);
      } catch (t) {
        throw this.#i = !1, Jr(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(Yr, this.#k), Jr(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#S();
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
        const s = await this.#R(
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
      return o ?? At;
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
      return At;
    const r = rd(this.#e);
    this.#u.add(r);
    const i = Date.now() + this.#d;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#f(t, n);
        if (a)
          return a;
        if (this.#c === t)
          return At;
        const s = i - Date.now();
        if (s <= 0)
          return Qr;
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
  async #R(t, n, r) {
    const i = this.#x(), o = /* @__PURE__ */ new Set();
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
    const f = async () => {
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#O(t.endpointID, ld(t.value, n, i)));
    };
    try {
      let d = 0, h = 0, m = this.#p;
      for (await f(); ; ) {
        const g = this.#f(n, r);
        if (g)
          return g;
        const y = this.#v(n, i, m);
        if (y !== null)
          return y;
        const S = this.#l;
        await this.#I(
          S,
          this.#y(d)
        );
        const v = this.#v(
          n,
          i,
          m
        );
        if (v !== null)
          return v;
        let T = this.#l;
        for (this.#b(i); ; ) {
          const O = this.#f(n, r);
          if (O)
            return O;
          const A = await this.#I(
            T,
            this.#y(d)
          ), D = this.#v(
            n,
            i,
            m
          );
          if (D !== null)
            return D;
          if (A && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
            if (h >= 1)
              return Qr;
            m = this.#p, await f(), h += 1, d += 1;
            break;
          }
          if (A) {
            T = this.#l;
            continue;
          }
          A || (d += 1, T = this.#l, this.#b(i));
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
    }) : this.#E(i, n) ? (this.#s.delete(n), At) : null;
  }
  #f(t, n) {
    return !this.#i || this.#h !== n ? sd : this.#r !== t ? ad : null;
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
        Rn
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#i)
      try {
        this.#t.sendEventOrValue?.(
          Mi,
          t,
          void 0,
          Rn
        );
      } catch {
      }
  }
  #w(t) {
    const n = cd(t);
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
const dd = 1e3, ud = [Je, me];
function Zr(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function hn(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (Zr(r, t)) return r[t];
  if (Zr(n, t)) return n[t];
}
function gn(e, t) {
  if (e === void 0) return ir();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = wi(n, t);
  return r._tag === "ok" ? r.value : null;
}
function eo(e) {
  return new Set(e.routes.flatMap((t) => li(t) === null ? [] : [t.id]));
}
function to(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function no(e, t) {
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
class fd {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Xr(t, { laneKind: "modulation" }), this.articulationLane = new Xr(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Pt();
  articulationBank = ir();
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
    { length: Z },
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
    return this.frameworkInput ? [me] : ud;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Gr, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Gr, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = hn(t, Je), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Pt() } : Ft(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${Je} is invalid; boot state was not installed.`);
      const a = hn(t, me), s = gn(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = hn(t, me), o = gn(
      i,
      eo(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${me} is invalid; boot state was not installed.`);
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
    if (t === Je) {
      const i = Ft(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${Je}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = gn(n, eo(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${me}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = td(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Mi, 0, void 0, Rn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? zr(r, s, this.frameworkInput.curveCommand) : zr(r, s), f = await this.modulationLane.sendBatch(c);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", f, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const v = no("modulation", f);
      v && o?.(v), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const d = this.buildUploadsBySelector(r, i), h = Array.from({ length: Z }, (v, T) => {
      const O = d.get(T);
      return O ? to(O) : null;
    }), m = this.lastAppliedArticulationGeneration !== n, g = m && this.articulationLane.getAcceptedFrontier() !== 0, y = [];
    for (let v = 0; v < Z; v += 1) {
      const T = d.get(v), O = h[v] !== this.lastAppliedArticulationTokens[v];
      g ? y.push({
        endpointID: dn,
        value: T ?? Br(v)
      }) : m ? T && y.push({ endpointID: dn, value: T }) : O && y.push({
        endpointID: dn,
        value: T ?? Br(v)
      });
    }
    const S = await this.articulationLane.sendBatch(y);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", S, h)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = h;
        const v = Ql(i);
        if (this.frameworkInput) {
          const T = await this.frameworkInput.publishTriggerConfig(v);
          if (!this.started || t !== this.lifecycleEpoch) return;
          T.kind !== "cancelled" && o?.(T);
        } else
          Fl(v, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const T of y) this.lastAppliedArticulationTokens[T.value.selectorA] = void 0;
        const v = no("articulation", S);
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
      const o = li(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      Jl(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = to(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, dd));
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
const md = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [me],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = ro(e);
    return {
      apply(n, r) {
        return t.closed && (t = ro(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function ro(e) {
  let t = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(m) {
    const g = r;
    r = void 0, g ? g(m) : m.kind !== "cancelled" && e.report(m);
  }
  function c() {
    t || (t = !0, h.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function f(m) {
    if (m.kind !== "submitted") {
      m.kind === "failed" && m.error.kind !== "transport" && (s(m), c());
      return;
    }
    i.add(m.completion), m.completion.then((g) => {
      i.delete(m.completion), !(t || g.kind === "sent") && (s(g), c());
    }, (g) => {
      t || (c(), e.fail(g));
    });
  }
  const d = {
    addEndpointListener(m, g) {
      const y = o.get(m) ?? /* @__PURE__ */ new Map();
      y.set(g, e.listen(m, g)), o.set(m, y);
    },
    removeEndpointListener(m, g) {
      o.get(m)?.get(g)?.(), o.get(m)?.delete(g);
    },
    addStoredStateValueListener(m) {
      a.set(m, e.subscribeStored(
        me,
        (g) => m({ key: me, value: g })
      ));
    },
    removeStoredStateValueListener(m) {
      a.get(m)?.(), a.delete(m);
    },
    requestFullStoredState(m) {
      e.readStored(me).then((g) => {
        t || m({ values: { [me]: g } });
      }, (g) => e.fail(g));
    },
    sendEventOrValue(m, g) {
      t || f(e.send({ kind: "event", endpoint: m, value: g }));
    }
  }, h = new fd(d, {
    onDefect(m) {
      c(), e.fail(m);
    },
    curveCommand: (m, g, y) => ({
      async submit({ dspSessionId: S, deliverySerial: v, signal: T }) {
        const O = await e.prepareData(
          Zl + m * 2 + g,
          ed,
          (A) => {
            new Int32Array(A.buffer, A.byteOffset, 4).set([1297302855, S, v, ft]), jo(y, new Float32Array(A.buffer, A.byteOffset + 16, ft));
          },
          T
        );
        O.kind === "failed" && (s(O), c());
      }
    }),
    async publishTriggerConfig(m) {
      const y = (await Promise.all(i)).find((v) => v.kind !== "sent");
      if (y) return y.kind === "failed" ? y : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const S = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Ai(m) });
      return S.kind === "submitted" ? S.completion : S;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(m, g) {
      if (t || g.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const y = ++n;
      return new Promise((S) => {
        const v = g.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (T) => {
          v(), S(T);
        }, h.replaceModulation(m, (T) => {
          y === n && T.kind !== "preparing" && s(T);
        }), h.start();
      });
    },
    stop: c
  };
}
const _i = 13, ar = 5, Li = 8, pd = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), sr = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    pe("globalFilter")
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
    pe("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    pe("ott")
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
    pe("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    pe("flanger")
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
    pe("phaser")
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
    pe("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    pe("reverb")
  ]
}), Ci = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), hd = Object.freeze([
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
]), gd = Object.freeze({
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
function vd(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function Ni(e, t) {
  const n = {};
  for (const s of sr[e]) {
    const c = t[s];
    if (typeof c == "number" && Number.isFinite(c)) {
      n[s] = c;
      continue;
    }
    const f = gd[s];
    if (f === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${s}`);
    n[s] = f;
  }
  const i = [
    ...Ci.chorus,
    pe("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((s) => i.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = vd(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function cr(e) {
  return sr[e];
}
function yd(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= ar)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * Li + pd[e];
}
function bd(e, t) {
  const n = new Array(_i).fill(0), r = Ni(e, t);
  return sr[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const Id = "lane.v1", Ut = "laneTopology", ht = "laneSlotParams", On = "laneSlotParamValue", Pi = "laneOutputControl", wn = 16, Sd = 8, Fi = 4, kd = 3, Ki = ar * Li, ji = 4, Td = 4, Ad = Ki, Ed = Ki + ji, xd = 0, Rd = 1, Od = 2, wd = 3, Md = 4, Dd = 5;
function _d(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > Fi)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << Sd;
}
const zt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Vt = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Ui = new Map(
  Object.entries(Vt).map(([e, t]) => [t, e])
), Ld = Object.freeze({
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
  zt.map((e) => [Ld[e], e])
);
const Cd = Object.freeze([
  "voice.filterCutoff",
  pi,
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
]), Nd = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [pi]: "enhancer-frequency",
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
  Cd.map((e) => [e, Object.freeze({
    id: e,
    family: Nd[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const zi = 40, Vi = 18e3, Mn = zt.map((e) => Vt[e]), Pd = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Fd = /^(parallel|split)#([1-9][0-9]*)$/;
function bt(e) {
  if (typeof e != "string")
    return null;
  const t = Pd.exec(e);
  if (t === null)
    return null;
  const n = Mn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > ar ? null : { deviceType: n, instanceNumber: r };
}
function $i(e) {
  if (typeof e != "string")
    return null;
  const t = Fd.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? ji : Td) ? null : { groupKind: n, unitNumber: r };
}
function ze(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function et(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function W(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function Kd(e, t) {
  const n = bt(e);
  if (n === null)
    return { failure: W(`device id ${e} is not a pool instance`) };
  if (!ze(t) || !et(t, ["params"]) || !ze(t.params))
    return { failure: W(`device ${e} must be { params }`) };
  const r = cr(n.deviceType), i = Ui.get(n.deviceType);
  if (i === void 0)
    return { failure: W(`device ${e} has no effect descriptor`) };
  const o = Wo(i).parameters.map((g) => g.endpointID), a = t.params, s = Object.keys(a), c = (g) => s.length === g.length && s.every((y) => g.includes(y)), f = pe(n.deviceType), d = [
    ...Ci[n.deviceType],
    f
  ], h = [
    ...hd,
    f
  ];
  if (!(s.includes(f) && (c(r) || c(o) || c(d) || n.deviceType === "chorus" && c(h))))
    return { failure: W(`device ${e} must carry every parameter once`) };
  for (const g of s) {
    const y = a[g];
    if (typeof y != "number" || !Number.isFinite(y))
      return { failure: W(`device ${e}.${g} must be a finite number`) };
  }
  return { record: { params: Ni(n.deviceType, a) } };
}
function jd(e, t) {
  return !ze(e) || e.kind !== "device" ? { failure: W("branches may hold device placements only") } : et(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: W(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: W(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: W("a device placement is { kind, deviceId, enabled }") };
}
function oo(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= zi && e <= Vi;
}
function Bi() {
  return { mix: 1, bypassed: !1 };
}
function Ud(e) {
  return !ze(e) || !et(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function zd(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (d) {
      const h = d instanceof Error ? d.message : String(d);
      return W(`is not valid JSON: ${h}`);
    }
  if (!ze(t) || !et(t, ["format", "version", "output", "devices", "chain"]))
    return W("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return W("must be cosimo.lane version 2");
  if (!ze(t.devices))
    return W("devices must be an object");
  if (!Array.isArray(t.chain))
    return W("chain must be an array");
  const n = Ud(t.output);
  if (n === null)
    return W("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const d of Reflect.ownKeys(t.devices)) {
    if (typeof d != "string")
      return W("device ids must be strings");
    const h = Kd(d, t.devices[d]);
    if ("failure" in h)
      return h.failure;
    r[d] = h.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const f = (d) => {
    const h = jd(d, i);
    return "placement" in h && (o.set(
      h.placement.deviceId,
      (o.get(h.placement.deviceId) ?? 0) + 1
    ), c += 1), h;
  };
  for (const d of t.chain) {
    if (!ze(d))
      return W("chain nodes must be objects");
    if (d.kind === "device") {
      const A = f(d);
      if ("failure" in A)
        return A.failure;
      s.push(A.placement);
      continue;
    }
    if (d.kind !== "parallel" && d.kind !== "split")
      return W(`unknown chain node kind ${String(d.kind)}`);
    const h = d.kind === "split", m = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], y = h ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], S = h && et(d, m);
    if (!et(d, y) && !S)
      return W(`a ${d.kind} group is { ${y.join(", ")} }`);
    const v = $i(d.groupId);
    if (v === null || v.groupKind !== d.kind)
      return W(`group id ${String(d.groupId)} does not name a ${d.kind} unit`);
    if (a.has(String(d.groupId)))
      return W(`group ${String(d.groupId)} is used twice`);
    if (a.add(String(d.groupId)), typeof d.enabled != "boolean")
      return W(`group ${String(d.groupId)} needs a boolean enable`);
    const T = h ? kd : Fi;
    if (!Array.isArray(d.branches) || d.branches.length < 2 || d.branches.length > T)
      return W(`group ${String(d.groupId)} needs 2..${T} branches`);
    if (h && (!oo(d.xoverLowHz) || !oo(d.xoverHighHz)))
      return W(`group ${String(d.groupId)} crossovers must sit in ${zi}..${Vi} Hz`);
    if (h && !S && (typeof d.xoverLowKeyTrackEnabled != "boolean" || typeof d.xoverHighKeyTrackEnabled != "boolean" || typeof d.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverLowKeyTrackOffsetSemitones) || typeof d.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverHighKeyTrackOffsetSemitones)))
      return W(`group ${String(d.groupId)} Key Track state must be finite`);
    c += 1;
    const O = [];
    for (const A of d.branches) {
      if (!Array.isArray(A))
        return W(`group ${String(d.groupId)} branches must be arrays`);
      const D = [];
      for (const F of A) {
        const j = f(F);
        if ("failure" in j)
          return j.failure;
        D.push(j.placement);
      }
      O.push(D);
    }
    s.push(h ? {
      kind: "split",
      groupId: String(d.groupId),
      enabled: d.enabled,
      xoverLowHz: d.xoverLowHz,
      xoverHighHz: d.xoverHighHz,
      xoverLowKeyTrackEnabled: S ? !1 : d.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: S ? 0 : d.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: S ? !1 : d.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: S ? 0 : d.xoverHighKeyTrackOffsetSemitones,
      branches: O
    } : {
      kind: "parallel",
      groupId: String(d.groupId),
      enabled: d.enabled,
      branches: O
    });
  }
  for (const d of i)
    if ((o.get(d) ?? 0) !== 1)
      return W(`device ${d} must be placed exactly once`);
  return c > wn ? W(`flattens to ${c} wire entries; the topology upload holds ${wn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function Vd() {
  const e = {};
  for (const t of zt) {
    const n = Vt[t];
    e[`${n}#1`] = {
      params: Jd(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Bi(),
    devices: e,
    chain: zt.map((t) => ({
      kind: "device",
      deviceId: `${Vt[t]}#1`,
      enabled: !1
    }))
  };
}
const io = ["distortion#1", "delay#1", "reverb#1"];
function Hi() {
  const e = Vd(), t = {};
  for (const n of io) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Bi(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && io.includes(n.deviceId))
  };
}
function $d(e) {
  if (e === void 0)
    return Hi();
  const t = zd(e);
  return t._tag === "ok" ? t.value : null;
}
function vn(e) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: e.output,
    devices: e.devices,
    chain: e.chain
  });
}
function Bd(e) {
  return Object.keys(e.devices).map((t) => {
    const n = bt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Mn.indexOf(t.parsed.deviceType) - Mn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Dn(e) {
  const t = bt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return yd(t.deviceType, t.instanceNumber - 1);
}
function qi(e) {
  const t = $i(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Ad : Ed) + (t.unitNumber - 1);
}
function Hd(e) {
  const t = new Array(wn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    t[r] = _d(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Dn(o.deviceId), 0, o.enabled);
      continue;
    }
    i(qi(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(Dn(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function qd(e) {
  const t = new Array(_i).fill(0);
  return t[xd] = e.xoverLowHz, t[Rd] = e.xoverHighHz, t[Od] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[wd] = e.xoverLowKeyTrackOffsetSemitones, t[Md] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[Dd] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function Wd(e) {
  const t = [{
    endpointID: Pi,
    value: e.output
  }];
  let n = 0;
  for (const r of Bd(e)) {
    const i = bt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: Hn(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[pe(i.deviceType)]
    }), n += 1, t.push({
      endpointID: ht,
      value: {
        slotId: Dn(r.instanceId),
        deliverySerial: n,
        values: bd(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: ht,
      value: {
        slotId: qi(r),
        deliverySerial: n,
        values: qd(r)
      }
    }));
  return t.push({
    endpointID: Ut,
    value: Hd(e)
  }), t;
}
function Gd(e, t, n, r) {
  const i = e.devices[t], o = bt(t);
  if (i === void 0 || o === null || !cr(o.deviceType).includes(n) || !Number.isFinite(r))
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
function Yd(e, t) {
  let n = e;
  for (const [r, i] of Object.entries(t)) {
    const o = ps(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      pt,
      Math.max(Ue, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = Gd(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function Jd(e) {
  const t = Ui.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Wo(t).parameters;
  return Object.fromEntries(cr(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function lr(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) lr(t);
    Object.freeze(e);
  }
}
const Qd = {
  parse(e) {
    const t = $d(e);
    return t ? (lr(t), { kind: "ok", value: t }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: vn,
  equals: (e, t) => vn(e) === vn(t)
}, Xd = {
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
    const r = wi(t, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (lr(r.value), { kind: "ok", value: r.value });
  },
  encode: (e) => JSON.stringify(pn(e)),
  equals: (e, t) => JSON.stringify(pn(e)) === JSON.stringify(pn(t))
}, ao = [Pi, ht, On, Ut], Zd = { kind: "sent", proof: "native-publication-processed" };
const eu = {
  eventEndpoints: ao,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(e) {
    let t, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (m) => Wd(m).filter((g) => ao.includes(g.endpointID));
    async function f(m, g, y = !1) {
      if (a || g.aborted) return { kind: "cancelled" };
      const S = c(m), v = t && !y ? c(t) : [], T = (D) => D.find((F) => F.endpointID === Ut)?.value, O = v.length > 0 && JSON.stringify(T(v)) === JSON.stringify(T(S)), A = [];
      for (const D of S) {
        if (!O) {
          A.push(D);
          continue;
        }
        if (D.endpointID !== Ut)
          if (D.endpointID === ht) {
            const F = D.value, j = v.find((x) => x.endpointID === D.endpointID && x.value.slotId === F.slotId), ne = j ? j.value.values : [], w = F.values.flatMap((x, u) => Object.is(x, ne[u]) ? [] : [u]);
            w.length === 1 ? A.push({
              endpointID: On,
              value: { slotId: F.slotId, paramIndex: w[0], value: F.values[w[0]] }
            }) : w.length > 1 && A.push(D);
          } else JSON.stringify(D.value) !== JSON.stringify(v.find((F) => F.endpointID === D.endpointID)?.value) && A.push(D);
      }
      t = void 0;
      for (const D of A) {
        if (a || g.aborted) return { kind: "cancelled" };
        const F = D.endpointID === ht || D.endpointID === On ? { ...Object(D.value), deliverySerial: ++r } : D.value, j = e.send({ kind: "event", endpoint: D.endpointID, value: F }), ne = j.kind === "submitted" ? await j.completion : j;
        if (ne.kind !== "sent") return ne;
      }
      return a || g.aborted ? { kind: "cancelled" } : (t = m, Zd);
    }
    function d(m, g, y = !1) {
      const S = s.then(() => f(m, g, y));
      return s = S.catch(() => {
      }), S;
    }
    const h = e.listen("runtimeState", (m) => {
      const g = m !== null && typeof m == "object" ? Reflect.get(m, "dspSessionId") : void 0;
      if (typeof g != "number" || g === o) return;
      const y = o !== void 0;
      o = g;
      const S = i;
      y && n && d(n, e.signal, !0).then((v) => {
        v.kind === "failed" && S === i && e.report(v);
      }, e.fail);
    });
    return {
      apply(m, g) {
        return i += 1, n = m, d(m, g.signal);
      },
      stop() {
        a = !0, h();
      }
    };
  }
}, tu = Object.freeze({
  ...Object.fromEntries(Ot.flatMap(({ controls: e }) => e.map(({ endpointID: t }) => [t, M(t)]))),
  ...Object.fromEntries(Bo().map((e) => [e, M(e)])),
  playMode: M("playMode"),
  glideTime: M("glideTime"),
  macro1: M("macro1"),
  macro2: M("macro2"),
  macro3: M("macro3"),
  macro4: M("macro4"),
  filterMode: M("filterMode"),
  filterCutoff: M("filterCutoff"),
  filterQ: M("filterQ"),
  mseg1Morph: M("mseg1Morph"),
  mseg2Morph: M("mseg2Morph"),
  mseg3Morph: M("mseg3Morph"),
  mseg1Rate: M("mseg1Rate"),
  mseg2Rate: M("mseg2Rate"),
  mseg3Rate: M("mseg3Rate"),
  env1Attack: M("env1Attack"),
  env1Decay: M("env1Decay"),
  env1Sustain: M("env1Sustain"),
  env1Release: M("env1Release"),
  env2Attack: M("env2Attack"),
  env2Decay: M("env2Decay"),
  env2Sustain: M("env2Sustain"),
  env2Release: M("env2Release"),
  env3Attack: M("env3Attack"),
  env3Decay: M("env3Decay"),
  env3Sustain: M("env3Sustain"),
  env3Release: M("env3Release"),
  filterMix: M("filterMix"),
  ampRelease: M("ampRelease"),
  sourceMode: M("sourceMode"),
  globalTune: M("globalTune"),
  ampAttack: M("ampAttack"),
  ampDecay: M("ampDecay"),
  ampSustain: M("ampSustain"),
  filterCutoffKeyTrackEnabled: M("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: M("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: M("voiceEnhancerFrequency"),
  voiceEnhancerQ: M("voiceEnhancerQ"),
  voiceEnhancerAmount: M("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: M("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: M("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: M("polishEnhancerAmount"),
  polishCompressionClipAmount: M("polishCompressionClipAmount"),
  polishOutputTrimDb: M("polishOutputTrimDb"),
  polishSafeBassAmount: M("polishSafeBassAmount"),
  polishSafeBassBypass: M("polishSafeBassBypass"),
  polishEnhancerBypass: M("polishEnhancerBypass"),
  polishCompressionClipBypass: M("polishCompressionClipBypass"),
  polishOutputTrimBypass: M("polishOutputTrimBypass")
}), nu = Ua({
  ...tu,
  [Je]: kr({ initial: Pt(), codec: vl, prepare: (e) => e, engine: md }),
  [Id]: kr({
    initial: Hi(),
    codec: Qd,
    dependencies: Bo(),
    prepare: (e, { parameters: t }) => Yd(e, t),
    engine: eu
  }),
  [me]: _o({ initial: ir(), codec: Xd })
}), wt = 2048;
function st(e, t) {
  if (!e)
    throw new Error(t);
}
function ru(e) {
  st(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    st(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), st(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), st(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), st(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const ou = 2048, $t = 11, iu = 256;
function ke(e, t) {
  if (!e)
    throw new Error(t);
}
function au(e) {
  return e > 0 && (e & e - 1) === 0;
}
const so = /* @__PURE__ */ new Map();
function su(e) {
  const t = so.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return so.set(e, r), r;
}
function Wi(e, t, n = !1) {
  const r = e.length;
  ke(r === t.length, "FFT real and imaginary buffers must have the same length"), ke(au(r), "FFT input length must be a power of two");
  const i = su(r);
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
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, c = Math.cos(s), f = Math.sin(s);
    for (let d = 0; d < r; d += o) {
      let h = 1, m = 0;
      for (let g = 0; g < a; g += 1) {
        const y = d + g, S = y + a, v = e[S], T = t[S], O = h * v - m * T, A = h * T + m * v, D = e[y], F = t[y];
        e[y] = D + O, t[y] = F + A, e[S] = D - O, t[S] = F - A;
        const j = h * c - m * f;
        m = h * f + m * c, h = j;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Gi(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function cu(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = ou,
  maxFramesPerTable: r = iu
} = {}) {
  const i = Float32Array.from(e);
  ke(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  ke(o > 0, "Source wavetable files must contain at least one frame"), ke(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && ke(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, f = c + n;
    a.push(Gi(i.slice(c, f)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function co(e) {
  const t = Gi(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Wi(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Yi(e, t, {
  mipLevelCount: n = $t
} = {}) {
  const r = e?.real?.length ?? 0;
  ke(r > 0, "Spectrum must contain real samples"), ke(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), ke(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = e.real[s], a[s] = e.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = e.real[c], a[c] = e.imaginary[c]);
  }
  return Wi(o, a, !0), Float32Array.from(o);
}
const Mt = 256, ct = 2048, Ji = 8, lu = 12811, _n = (Ji + Mt * lu) * 4;
function lo(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function du(e, t, n) {
  if (e.byteLength !== _n || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Mt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    $t,
    Mt
  ]);
  let i = Ji;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let f = 0; f < $t; ++f) {
    const d = Math.min(ct, Math.max(256, (1 << f) * 32)), h = ct / d;
    for (let m = 0; m < t.frameCount; ++m) {
      const g = Yi(n(m), f), y = i + m * (d + 1);
      for (let S = 0; S <= d; ++S) {
        const v = (S === d ? 0 : S) * h, T = (v + ct - h) % ct, O = (v + h) % ct, A = g[v], D = g[T], F = g[O];
        if (A === void 0 || D === void 0 || F === void 0 || !Number.isFinite(A) || !Number.isFinite(D) || !Number.isFinite(F))
          throw new Error("Wavetable preparation produced invalid samples.");
        const j = Math.fround(0.5 * Math.fround(F - D));
        r[y + S] = lo(A, s, o) & 262143 | lo(j, c, a) << 18;
      }
    }
    i += (d + 1) * Mt;
  }
}
const uu = "runtimeSyncRequest", fu = 2147483647, mu = "runtimeState", pu = "retryDesiredTableRequest", hu = "workerLoadFailure", gu = "serviceLoadAbort", vu = "wavetableLoadBegin", yu = "wavetableMipFrame", bu = "wavetableUploadAck", Iu = "wavetableMipRequest", Su = "wavetablePrewarmRequest", ku = "wavetablePrewarmNotification", Tu = "assets/factory-bank-catalog.json", Ln = 3, Au = 1, Eu = Ln * wt, xu = 1, Ru = 2, Ou = 3, wu = 1, Mu = 2, Du = 2e4, Et = xu, uo = Ru, fo = Ou, Me = wu, mo = Mu, _u = 48 * 1024 * 1024, yn = 3;
function po(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function ee(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function ho(e) {
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
function go(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function vo(e, t) {
  if (!e)
    throw new Error(t);
}
function Lu(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function Cu(e, t) {
  return ru(await e.readJSON(t));
}
function Nu(e) {
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
function Pu(e, t) {
  const n = Math.round(Number(e) || 0);
  return Lu(n, 0, Math.max(0, t - 1));
}
function bn(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Fu(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function yo(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function bo(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function xt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Ku(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class ju {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = ms(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? Tu, this.maxBatchesInFlight = po(
      n.maxFramesInFlight,
      Au
    ), this.mipLevelCount = n.mipLevelCount ?? $t, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? _u) || 0)), this.serviceLoadTimeoutMs = po(n.serviceLoadTimeoutMs, Du), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, ee("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(mu, this.handleRuntimeState), this.connection.addEndpointListener?.(bu, this.handleUploadAck), this.connection.addEndpointListener?.(Iu, this.handleMipRequest), this.connection.addEndpointListener?.(Su, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ku, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      uu,
      fu
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Cu(this.resourceClient, this.catalogPath), ee("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < yn; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = yo(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: yo(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = bn(
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
          ...bo(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (ee("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: fo,
          failureReasonCode: mo
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== fo || t.failureReasonCode !== mo ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Et,
    failureReasonCode: s = Me
  }) {
    this.connection.sendEventOrValue?.(hu, {
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
    failureReasonCode: o = Me
  }) {
    this.connection.sendEventOrValue?.(gu, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    ee("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? ho(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(pu, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = Pu(t, r.tables.length), o = r.tables[i];
    vo(o, `Could not resolve table ${i}`);
    const a = Fu(o, wt, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, ee("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = xt();
    ee("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const f = await this.resourceClient.readAudio(o.sourceWav), d = cu(f.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: wt
    });
    return ee("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(xt() - c)
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
    if (ee("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(vu, {
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
    const n = xt();
    try {
      if (await Xl(this.connection, {
        input: t.oscillatorIndex,
        byteLength: _n
      }, (r) => {
        du(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      ee("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: _n,
        preparationMs: xt() - n,
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
        failurePhase: uo,
        failureReasonCode: Me
      }), this.serviceTable = null, this.clearMipTransferState(), ee("error", "Shared wavetable preparation failed", { detail: dt(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    ee("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: Et,
      failureReasonCode: Me
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: Et,
      failureReasonCode: Me
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = Et,
    failureReasonCode: r = Me
  } = {}) {
    ee("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (ee("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: dt(o)
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
      this.isCurrentRuntimeState(t) && (ee("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: dt(a)
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
    for (let t = 0; t < yn; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Ku(() => {
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
        ee("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: Me
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
    const n = Nu(t ?? {});
    if (ee("info", "Received runtime state", ho(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= yn)
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
          i.spectra[a] || (i.spectra[a] = co(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), ee("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        ee("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: dt(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), s = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = bn(
      n,
      r,
      i,
      o,
      a
    );
    let f = this.mipJobs.get(c);
    return f ? (!f.completed && s > f.urgencyLevel && (f.urgencyLevel = s), f) : (f = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...bo(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, f), f);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (ee("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), f = Math.trunc(Number(n.frameCount)), d = bn(
      r,
      i,
      o,
      a,
      s
    ), h = this.mipJobs.get(d), m = this.serviceTable?.frameCount ?? 0, g = Math.min(
      Ln,
      m - c
    );
    if (!(!h || h.completed || !h.inFlightBatchBases.has(c) || f <= 0 || f !== g)) {
      h.inFlightBatchBases.delete(c);
      for (let y = 0; y < f; y += 1) {
        const S = c + y;
        h.ackedFrames[S] || (h.ackedFrames[S] = 1, h.ackedFrameCount += 1);
      }
      h.ackedFrameCount === m && h.nextFrameIndex >= m && h.inFlightBatchBases.size === 0 && (h.completed = !0, this.activeUploadKey === h.key && (this.activeUploadKey = null)), go(c, f, m) && ee("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: h.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: f,
        ackedFrameCount: h.ackedFrameCount,
        frameCount: m,
        inFlightBatches: h.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (vo(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = co(this.serviceTable.frames[t]);
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
        Ln,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Eu);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Yi(s, t.mipIndex);
          i.set(c, o * wt);
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
            failurePhase: uo,
            failureReasonCode: Me
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(yu, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), go(n, r, this.serviceTable.frameCount) && ee("info", "Sent wavetable mip batch", {
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
function dt(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Uu(e, t = {}) {
  return new ju(e, t);
}
async function zu(e, t = {}) {
  return Wa(e, [
    () => Uu(e, { ...t, delivery: "shared" }),
    () => Ba(nu, e, {
      onDefect: (n) => console.error("Cosimo state failed", dt(n))
    })
  ]);
}
export {
  Au as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Ru as FAILURE_PHASE_BUILD_MIP,
  xu as FAILURE_PHASE_LOAD_SOURCE,
  Ou as FAILURE_PHASE_TRANSFER_MIP,
  wu as FAILURE_REASON_GENERIC,
  Mu as FAILURE_REASON_TIMEOUT,
  Ln as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  fu as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  ju as WavetableWorkerController,
  Uu as createWavetableWorkerController,
  zu as default
};
