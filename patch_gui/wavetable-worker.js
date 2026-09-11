function Fo() {
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
      for (const o of r) o();
    }
  };
}
function er(e, t) {
  return new Promise((n, r) => {
    const o = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((i) => {
      o(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: i });
    }, (i) => {
      o(), t.aborted ? n({ kind: "cancelled" }) : r(i);
    });
  });
}
function Wt(e) {
  let t = !1, n, r;
  const o = /* @__PURE__ */ new Set();
  async function i(c, s, d) {
    const { signal: l } = d;
    if (e.onStatus(s, { kind: "preparing" }), l.aborted) return;
    const p = await er(e.prepare(c, l), l);
    if (p.kind === "cancelled" || l.aborted) return;
    const g = p.value;
    if (g.kind === "error") {
      e.onStatus(s, { kind: "failed", error: g.error });
      return;
    }
    let y = !0;
    d.applying = !0;
    let T;
    try {
      T = await er(e.transport.apply(g.value, {
        signal: l,
        send: (k) => l.aborted || !y ? { kind: "cancelled" } : k()
      }), l);
    } catch (k) {
      l.aborted || (t = !0, n?.cancel(), e.transport.stop(), e.onDefect(k), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      y = !1, d.applying = !1;
    }
    T.kind === "value" && !l.aborted && T.value.kind !== "cancelled" && e.onStatus(s, T.value);
  }
  function a(c, s) {
    r = void 0;
    const d = n, l = { ...Fo(), applying: !1, target: s };
    if (n = l, d?.cancel(), t || l.signal.aborted) return;
    const p = i(c, s, l).catch((g) => {
      l.signal.aborted || (l.cancel(), e.onDefect(g), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    o.add(p), p.then(() => {
      if (o.delete(p), n !== l) return;
      n = void 0;
      const g = r;
      r = void 0, !t && g && a(g.input, g.target);
    });
  }
  return {
    /** Apply the declared replacement policy; ignored after stop or a transport defect. */
    replace(c, s) {
      if (!t) {
        if (e.replacement === "finish" && n?.applying && !n.signal.aborted && n.target.scope.owner === s.scope.owner && n.target.scope.document === s.scope.document) {
          r = { input: c, target: s }, e.onStatus(s, { kind: "preparing" });
          return;
        }
        a(c, s);
      }
    },
    /** Revoke the current request, retaining the transport for a later replacement. */
    cancel() {
      r = void 0, n?.cancel();
    },
    /** Close permanently and settle owned work without waiting for uncooperative external promises. */
    async stop() {
      t || (t = !0, r = void 0, n?.cancel(), e.transport.stop()), await Promise.all(o);
    }
  };
}
let Ko = 0;
function tr(e, t) {
  const n = `atom${++Ko}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = Uo, r.write = zo), r;
}
function Uo(e) {
  return e(this);
}
function zo(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const si = "a", xe = "m", Pt = "i", Fe = "c", xn = "q", wn = "Q", we = "h", ci = "R", li = "W", di = "I", ui = "M", ve = "e", Xe = "f", Ke = "C", Ze = "r", Mn = "d", Ft = "w", Kt = "D", Ut = "t", zt = "T", On = "v", nr = "g", rr = "s", ir = "b", jo = "B", _n = "p", fi = "H", mi = "A", Dn = "E";
function hi(e) {
  return "init" in e;
}
function Vo(e) {
  return typeof e.write == "function";
}
function $o(e) {
  return !!e.onMount;
}
function or(e) {
  return "v" in e || "e" in e;
}
function kt(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function Et(e) {
  return typeof e?.then == "function";
}
function Bo(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function pi(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function gi(e, t, n) {
  const o = n.get(e)?.t, i = t.p;
  if (!o?.size)
    return i;
  if (!i.size)
    return o;
  const a = new Set(o);
  for (const c of i)
    a.add(c);
  return a;
}
function qo(e) {
  return !!e.INTERNAL_onInit;
}
const Ho = (e, t, n, ...r) => n.read(...r), Wo = (e, t, n, ...r) => n.write(...r), Go = (e, t, n) => n.INTERNAL_onInit(t), Yo = (e, t, n, r) => n.onMount?.(r), Jo = (e, t, n) => {
  const r = e[si];
  let o = r.get(n);
  if (!o) {
    const i = e[we], a = e[di];
    o = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, o), i.i?.(n), qo(n) && a(e, t, n);
  }
  return o;
}, Qo = (e, t) => {
  const n = e[xe], r = e[Fe], o = e[xn], i = e[wn], a = e[we], c = e[Ke];
  if (!a.f && !r.size && !o.size && !i.size)
    return;
  const s = [], d = (l) => {
    try {
      l();
    } catch (p) {
      s.push(p);
    }
  };
  do {
    a.f && d(a.f);
    const l = /* @__PURE__ */ new Set();
    for (const p of r) {
      const g = n.get(p)?.l;
      if (g)
        for (const y of g)
          l.add(y);
    }
    r.clear();
    for (const p of i)
      l.add(p);
    i.clear();
    for (const p of o)
      l.add(p);
    o.clear();
    for (const p of l)
      d(p);
    r.size && c(e, t);
  } while (r.size || i.size || o.size);
  if (s.length)
    throw typeof AggregateError == "function" ? new AggregateError(s) : Object.assign(new Error(), { errors: s });
}, Xo = (e, t) => {
  const n = e[xe], r = e[Pt], o = e[Fe], i = e[ve], a = e[Ze], c = e[Kt];
  if (!o.size)
    return;
  const s = [], d = [], l = /* @__PURE__ */ new WeakSet(), p = /* @__PURE__ */ new WeakSet(), g = [], y = [];
  for (const T of o)
    g.push(T), y.push(i(e, t, T));
  for (; g.length; ) {
    const T = g.length - 1, k = g[T], S = y[T];
    if (p.has(k)) {
      g.pop(), y.pop();
      continue;
    }
    if (l.has(k)) {
      r.get(k) === S.n && (s.push(k), d.push(S)), p.add(k), g.pop(), y.pop();
      continue;
    }
    l.add(k);
    for (const E of gi(k, S, n))
      l.has(E) || (g.push(E), y.push(i(e, t, E)));
  }
  for (let T = s.length - 1; T >= 0; --T) {
    const k = s[T], S = d[T];
    let E = !1;
    for (const w of S.d.keys())
      if (w !== k && o.has(w)) {
        E = !0;
        break;
      }
    E && (r.set(k, S.n), a(e, t, k), c(e, t, k)), r.delete(k);
  }
};
const Zo = (e, t, n) => {
  const r = e[xe], o = e[Pt], i = e[Fe], a = e[we], c = e[ci], s = e[ve], d = e[Xe], l = e[Ke], p = e[Ze], g = e[Kt], y = e[On], T = e[fi], k = e[Dn], S = s(e, t, n), E = k[0];
  if (or(S)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && o.get(n) !== S.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      S.m === E
    )
      return S.m = E, S;
    let u = !1;
    for (const [v, I] of S.d)
      if (p(e, t, v).n !== I) {
        u = !0;
        break;
      }
    if (!u)
      return S.m = E, S;
  }
  let w = !0;
  const A = new Set(S.d.keys()), K = () => {
    for (const u of A)
      S.d.delete(u);
  }, j = () => {
    if (r.has(n)) {
      const u = !i.size;
      g(e, t, n), u && (l(e, t), d(e, t));
    }
  }, U = (u) => {
    if (u === n) {
      const I = s(e, t, u);
      if (!or(I))
        if (hi(u))
          y(e, t, u, u.init);
        else
          throw new Error("no atom init");
      return kt(I);
    }
    const v = p(e, t, u);
    try {
      return kt(v);
    } finally {
      A.delete(u), S.d.set(u, v.n), Et(S.v) && pi(n, S.v, v), r.has(n) && r.get(u)?.t.add(n), w || j();
    }
  };
  let h;
  const f = {
    get signal() {
      return h || (h = new AbortController()), h.signal;
    }
  }, m = S.n, b = o.get(n) === m;
  try {
    const u = c(e, t, n, U, f);
    if (y(e, t, n, u), Et(u)) {
      T(e, t, u, () => h?.abort());
      const v = () => {
        K(), j();
      };
      u.then(v, v);
    } else
      K();
    return a.r?.(n), S.m = E, S;
  } catch (u) {
    if (Bo(u))
      throw u;
    return delete S.v, S.e = u, ++S.n, S.m = E, S;
  } finally {
    w = !1, S.n !== m && b && (o.set(n, S.n), i.add(n), a.c?.(n));
  }
}, ea = (e, t, n) => {
  const r = e[xe], o = e[Pt], i = e[ve], a = [n];
  for (; a.length; ) {
    const c = a.pop(), s = i(e, t, c);
    for (const d of gi(c, s, r)) {
      const l = i(e, t, d);
      o.get(d) !== l.n && (o.set(d, l.n), a.push(d));
    }
  }
}, ta = (e, t, n, r) => {
  const o = e[Fe], i = e[we], a = e[li], c = e[ve], s = e[Xe], d = e[Ke], l = e[Ze], p = e[Mn], g = e[Ft], y = e[Kt], T = e[On], k = e[Dn];
  let S = !0;
  const E = (A) => kt(l(e, t, A)), w = (A, ...K) => {
    const j = c(e, t, A);
    try {
      if (A === n) {
        if (!hi(A))
          throw new Error("atom not writable");
        const U = j.n, h = K[0];
        T(e, t, A, h), y(e, t, A), U !== j.n && (++k[0], o.add(A), p(e, t, A), i.c?.(A));
        return;
      } else
        return g(e, t, A, K);
    } finally {
      S || (d(e, t), s(e, t));
    }
  };
  try {
    return a(e, t, n, E, w, ...r);
  } finally {
    S = !1;
  }
}, na = (e, t, n) => {
  const r = e[xe], o = e[Fe], i = e[we], a = e[ve], c = e[Mn], s = e[Ut], d = e[zt], l = a(e, t, n), p = r.get(n);
  if (p && l.d.size > 0) {
    for (const [g, y] of l.d)
      if (!p.d.has(g)) {
        const T = a(e, t, g);
        s(e, t, g).t.add(n), p.d.add(g), y !== T.n && (o.add(g), c(e, t, g), i.c?.(g));
      }
    for (const g of p.d)
      l.d.has(g) || (p.d.delete(g), d(e, t, g)?.t.delete(n));
  }
}, ra = (e, t, n) => {
  const r = e[xe], o = e[xn], i = e[we], a = e[ui], c = e[ve], s = e[Xe], d = e[Ke], l = e[Ze], p = e[Ft], g = e[Ut], y = c(e, t, n);
  let T = r.get(n);
  if (!T) {
    l(e, t, n);
    for (const k of y.d.keys())
      g(e, t, k).t.add(n);
    if (T = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(y.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, T), Vo(n) && $o(n)) {
      const k = () => {
        let S = !0;
        const E = (...w) => {
          try {
            return p(e, t, n, w);
          } finally {
            S || (d(e, t), s(e, t));
          }
        };
        try {
          const w = a(e, t, n, E);
          w && (T.u = () => {
            S = !0;
            try {
              w();
            } finally {
              S = !1;
            }
          });
        } finally {
          S = !1;
        }
      };
      o.add(k);
    }
    i.m?.(n);
  }
  return T;
}, ia = (e, t, n) => {
  const r = e[xe], o = e[wn], i = e[we], a = e[ve], c = e[zt], s = a(e, t, n);
  let d = r.get(n);
  if (!d || d.l.size)
    return d;
  let l = !1;
  for (const p of d.t)
    if (r.get(p)?.d.has(n)) {
      l = !0;
      break;
    }
  if (!l) {
    d.u && o.add(d.u), d = void 0, r.delete(n);
    for (const p of s.d.keys())
      c(e, t, p)?.t.delete(n);
    i.u?.(n);
    return;
  }
  return d;
}, oa = (e, t, n, r) => {
  const o = e[ve], i = e[mi], a = o(e, t, n), c = "v" in a, s = a.v;
  if (Et(r))
    for (const d of a.d.keys())
      pi(n, r, o(e, t, d));
  a.v = r, delete a.e, (!c || !Object.is(s, a.v)) && (++a.n, Et(s) && i(e, t, s));
}, aa = (e, t, n) => {
  const r = e[Ze];
  return kt(r(e, t, n));
}, sa = (e, t, n, ...r) => {
  const o = e[Fe], i = e[Xe], a = e[Ke], c = e[Ft], s = o.size;
  try {
    return c(e, t, n, r);
  } finally {
    o.size !== s && (a(e, t), i(e, t));
  }
}, ca = (e, t, n, r) => {
  const o = e[Xe], i = e[Ke], a = e[Ut], c = e[zt], d = a(e, t, n).l;
  return d.add(r), i(e, t), o(e, t), () => {
    d.delete(r), c(e, t, n), i(e, t), o(e, t);
  };
}, la = (e, t, n, r) => {
  const o = e[_n];
  let i = o.get(n);
  if (!i) {
    i = /* @__PURE__ */ new Set(), o.set(n, i);
    const a = () => o.delete(n);
    n.then(a, a);
  }
  i.add(r);
}, da = (e, t, n) => {
  e[_n].get(n)?.forEach((i) => i());
}, ua = /* @__PURE__ */ new WeakMap();
function fa(e) {
  const t = {
    get(c) {
      return o(r, t, c);
    },
    set(c, ...s) {
      return i(r, t, c, ...s);
    },
    sub(c, s) {
      return a(r, t, c, s);
    }
  }, n = {
    // store state
    [si]: /* @__PURE__ */ new WeakMap(),
    [xe]: /* @__PURE__ */ new WeakMap(),
    [Pt]: /* @__PURE__ */ new WeakMap(),
    [Fe]: /* @__PURE__ */ new Set(),
    [xn]: /* @__PURE__ */ new Set(),
    [wn]: /* @__PURE__ */ new Set(),
    [we]: {},
    // atom interceptors
    [ci]: Ho,
    [li]: Wo,
    [di]: Go,
    [ui]: Yo,
    // building-block functions
    [ve]: Jo,
    [Xe]: Qo,
    [Ke]: Xo,
    [Ze]: Zo,
    [Mn]: ea,
    [Ft]: ta,
    [Kt]: na,
    [Ut]: ra,
    [zt]: ia,
    [On]: oa,
    // store api
    [nr]: aa,
    [rr]: sa,
    [ir]: ca,
    [jo]: void 0,
    // abortable promise support
    [_n]: /* @__PURE__ */ new WeakMap(),
    [fi]: la,
    [mi]: da,
    // store epoch
    [Dn]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  ua.set(t, r);
  const o = r[nr], i = r[rr], a = r[ir];
  return t;
}
function ma() {
  return fa();
}
function J(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function vi(e, t = 1 / 0) {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    const o = e.charCodeAt(r);
    if (o < 128) n++;
    else if (o < 2048) n += 2;
    else if (o >= 55296 && o <= 56319) {
      const i = e.charCodeAt(++r);
      if (!(i >= 56320 && i <= 57343)) return 1 / 0;
      n += 4;
    } else {
      if (o >= 56320 && o <= 57343) return 1 / 0;
      n += 3;
    }
    if (n > t) return 1 / 0;
  }
  return n;
}
function yi() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= vi(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function mn(e) {
  const t = yi(), n = (r, o) => {
    if (!t.node(o)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const i of r) if (!n(i, o + 1)) return !1;
      return !0;
    }
    if (!J(r)) return !1;
    for (const i in r)
      if (Object.hasOwn(r, i) && (!t.text(i) || !n(r[i], o + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function ne(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function Ae(e) {
  return typeof e == "string" && e.length > 0 && vi(e) <= 256;
}
function Ln(e) {
  return J(e) && Ae(e.owner) && ne(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function ha(e) {
  if (!J(e) || !ne(e.id)) return;
  const t = Ln(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function pa(e) {
  const t = Ln(e);
  return t && J(e) && ne(e.client) && ne(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function ar(e) {
  if (!J(e) || !Array.isArray(e.parameters) || !J(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!J(n)) return;
    const { endpoint: r, value: o, min: i, max: a, step: c, defaultValue: s } = n;
    if (!Ae(r) || typeof o != "number" || typeof i != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number") return;
    t.push(Object.freeze({ endpoint: r, value: o, min: i, max: a, step: c, defaultValue: s }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function ga(e) {
  if (J(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = ha(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (Ae(e.key)) {
      if (e.kind === "retry")
        return ne(e.expectedVersion, !1) && (e.expectedGeneration === null || ne(e.expectedGeneration, !1)) && (e.expectedPersistenceRequest === null || ne(e.expectedPersistenceRequest)) ? {
          kind: "retry",
          key: e.key,
          expectedVersion: e.expectedVersion,
          expectedGeneration: e.expectedGeneration,
          expectedPersistenceRequest: e.expectedPersistenceRequest
        } : void 0;
      if (e.kind === "recover")
        return Object.hasOwn(e, "value") && e.expectedVersion === 0 && !Object.hasOwn(e, "gesture") ? { kind: "recover", key: e.key, value: e.value, expectedVersion: 0 } : void 0;
      if (e.kind === "begin" || e.kind === "end")
        return !ne(e.gesture) || e.label !== void 0 && typeof e.label != "string" ? void 0 : e.kind === "end" ? { kind: "end", key: e.key, gesture: e.gesture } : { kind: "begin", key: e.key, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
      if (!(e.kind !== "edit" || !Object.hasOwn(e, "value")) && !(e.expectedVersion !== void 0 && !ne(e.expectedVersion, !1)) && !(e.gesture !== void 0 && !ne(e.gesture)))
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
function va(e) {
  if (!mn(e) || !J(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && ne(e.request) && Ae(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && Ae(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = Ln(e.scope);
  if (e.kind === "opened" && t && ne(e.request)) {
    const n = ar(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = ar(e.native);
    if (n && (e.changedStoredKey === void 0 || Ae(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && Ae(e.endpoint) && typeof e.value == "number")
    return { kind: "ok", value: { kind: "parameter", scope: t, endpoint: e.endpoint, value: e.value } };
  if (e.kind === "detach" && t && ne(e.client) && ne(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && ne(e.request) && ne(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = pa(e.address);
    if (n) {
      const r = ga(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && ne(e.request) && J(e.result)) {
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && Ae(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function sr(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, o]) => {
    const i = t.fields[r];
    return !i || !("value" in i) ? [r, i] : [r, { ...i, value: o.kind === "stored" ? o.codec.encode(i.value) : i.value }];
  }));
  return { ...t, fields: n };
}
function cr(e) {
  const t = yi(), n = /* @__PURE__ */ new Set(), r = (i, a) => {
    if (t.node(a)) {
      if (i === null || typeof i == "boolean") return i;
      if (typeof i == "number") return Number.isFinite(i) ? i : void 0;
      if (typeof i == "string") return t.text(i) ? i : void 0;
      if (!(typeof i != "object" || n.has(i))) {
        n.add(i);
        try {
          if (Array.isArray(i) || i instanceof Float32Array || i instanceof Float64Array || i instanceof Int8Array || i instanceof Int16Array || i instanceof Int32Array || i instanceof Uint8Array || i instanceof Uint8ClampedArray || i instanceof Uint16Array || i instanceof Uint32Array) {
            if (!t.elements(i.length)) return;
            const s = [];
            for (const d of i) {
              const l = r(d, a + 1);
              if (l === void 0) return;
              s.push(l);
            }
            return s;
          }
          if (!J(i)) return;
          const c = /* @__PURE__ */ Object.create(null);
          for (const s in i) {
            if (!Object.hasOwn(i, s)) continue;
            if (!t.text(s)) return;
            const d = r(i[s], a + 1);
            if (d === void 0) return;
            c[s] = d;
          }
          return c;
        } finally {
          n.delete(i);
        }
      }
    }
  }, o = r(e, 0);
  return o !== void 0 ? { kind: "ok", value: o } : { kind: "invalid", message: "Prepared event payload does not satisfy the native JSON contract." };
}
const ya = (e) => ({ kind: "failed", error: { kind: "transport", message: e } }), ba = (e, t) => J(e) && e.owner === t.owner && e.document === t.document;
function Sa(e, t = {}) {
  let n = 0, r = !1;
  const o = /* @__PURE__ */ new Map(), i = t.timeoutMs ?? 1e4;
  function a(d) {
    if (!J(d) || typeof d.request != "number") return;
    const l = o.get(d.request);
    if (!(!l || !ba(d.scope, l.scope))) {
      if (d.kind !== "failed" && d.kind !== "cancelled" && !l.matches(d)) {
        l.finish({ kind: "failed", reason: "invalid-reply" });
        return;
      }
      d.kind === "ready" && typeof d.transfer == "number" && Number.isSafeInteger(d.transfer) && d.transfer > 0 ? l.finish({ kind: "ready", transfer: d.transfer }) : d.kind === "written" || d.kind === "applied" || d.kind === "cancelled" ? l.finish({ kind: d.kind }) : l.finish({ kind: "failed", reason: d.kind === "failed" && typeof d.reason == "string" ? d.reason : "invalid-reply" });
    }
  }
  e.addEventListener("kit_data", a);
  function c(d) {
    e.sendMessageToServer({ type: "kit_data", message: d });
  }
  function s(d, l, p, g, y) {
    return r || g.aborted ? Promise.resolve({ kind: "cancelled" }) : new Promise((T) => {
      let k = () => {
      }, S;
      const E = (w) => {
        o.delete(d) && (clearTimeout(S), k(), T(w));
      };
      if (o.set(d, { scope: p, matches: y, finish: E }), k = g.onAbort(() => E({ kind: "cancelled" })), !!o.has(d)) {
        S = setTimeout(() => E({ kind: "failed", reason: "reply-timeout" }), i);
        try {
          c({ ...l, scope: p, request: d });
        } catch {
          E({ kind: "failed", reason: "connection-failed" });
        }
      }
    });
  }
  return {
    /** Takes exclusive read ownership until completion. The caller must not
     * mutate or reuse samples while pending; avoiding a second whole-value
     * copy depends on this same ownership rule as native resource adoption.
     */
    async replace(d, l, p, g) {
      if (r || g.aborted) return { kind: "cancelled" };
      if (!(l instanceof Float32Array) || !l.every(Number.isFinite))
        return { kind: "failed", error: { kind: "engine-rejected", message: "Shared data requires finite Float32 samples." } };
      const y = Object.freeze({ ...p.scope }), T = ++n;
      let k = !1;
      const S = (E) => E.kind === "cancelled" ? E : ya(E.kind === "failed" ? `Data delivery failed: ${E.reason}.` : "Unexpected data delivery reply.");
      try {
        const E = await s(
          T,
          { kind: "begin", input: d, generation: p.generation, sampleCount: l.length },
          y,
          g,
          (A) => A.kind === "ready"
        );
        if (E.kind !== "ready") return S(E);
        for (let A = 0; A < l.length; A += 8192) {
          const K = await s(
            ++n,
            {
              kind: "write",
              transfer: E.transfer,
              offset: A,
              samples: Array.from(l.subarray(A, A + 8192))
            },
            y,
            g,
            (j) => j.kind === "written" && j.transfer === E.transfer && j.offset === Math.min(A + 8192, l.length)
          );
          if (K.kind !== "written") return S(K);
        }
        const w = await s(
          ++n,
          { kind: "commit", transfer: E.transfer },
          y,
          g,
          (A) => A.kind === "applied" && A.transfer === E.transfer && A.input === d && A.generation === p.generation
        );
        return w.kind !== "applied" ? S(w) : (k = !0, { kind: "acknowledged", engineSession: `${y.owner}:${y.document}`, operation: String(T) });
      } finally {
        if (!k) try {
          c({ kind: "cancel", request: ++n, scope: y, beginRequest: T });
        } catch {
        }
      }
    },
    stop() {
      if (!r) {
        r = !0;
        for (const d of [...o.values()]) d.finish({ kind: "cancelled" });
        e.removeEventListener("kit_data", a);
      }
    }
  };
}
const Ia = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Ta(e) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(e) && !e.includes("__") && !Ia.has(e);
}
function ot(e) {
  return typeof e == "object" && e !== null && "kind" in e && e.kind === "preparation-error" && "error" in e && typeof e.error == "object" && e.error !== null && "kind" in e.error && e.error.kind === "resource" && "message" in e.error && typeof e.error.message == "string";
}
function Gt(e, t = {}) {
  return Object.freeze({ kind: "parameter", endpoint: e, ...t });
}
function ka(e) {
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
function Ea(e) {
  const t = ka({ codec: e.codec, initial: e.initial, lifetime: e.lifetime, history: e.history }), n = Object.freeze([...e.dependencies ?? []]);
  if ("kind" in e.engine && e.engine.kind === "shared-data") {
    const i = e.prepare, a = e.engine;
    return Object.freeze({ ...t, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: a.type, fixedLength: typeof a.length == "number" ? a.length : null }),
      measure(c, s) {
        return typeof a.length == "number" ? a.length : a.length(c, s);
      },
      prepare: i
    }) });
  }
  const r = e.prepare, o = e.engine;
  return Object.freeze({ ...t, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: r,
    delivery: o
  }) });
}
const bi = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Aa(e) {
  return e[bi] ?? {};
}
function Si(e) {
  return Object.keys(e).filter((t) => e[t]?.kind === "stored" && e[t].engine?.kind === "shared-prepared").sort().map((t, n) => ({ key: t, input: n }));
}
function Ra(e, t = {}) {
  if (t.historyLimit !== void 0 && (!Number.isSafeInteger(t.historyLimit) || t.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Si(e);
  if (n.length && (!Number.isSafeInteger(t.memoryBudgetBytes) || (t.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: r }) => !Ta(r) || r === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  return Object.freeze(Object.defineProperty({ ...e }, bi, { value: Object.freeze({ ...t }) }));
}
const pe = (e) => ({ kind: "failed", error: { kind: "resource", message: e } });
function lr(e, t = {}) {
  const n = /* @__PURE__ */ new Map();
  let r = !1;
  function o(i) {
    if (!J(i) || typeof i.id != "number" || !J(i.scope)) return;
    const a = n.get(i.id);
    if (!(!a || i.input !== a.input || i.scope.owner !== a.target.scope.owner || i.scope.document !== a.target.scope.document))
      if (i.kind === "applied") {
        if (i.generation !== i.id || typeof i.serial != "number" || !Number.isSafeInteger(i.serial) || i.serial <= 0) return;
        if (!a.submitted) {
          a.early = i;
          return;
        }
        if (i.serial !== a.submitted.serial || i.generation !== a.submitted.generation) return;
        a.finish({ kind: "acknowledged", engineSession: `${a.target.scope.owner}:${a.target.scope.document}`, operation: String(i.id) });
      } else i.kind === "failed" && a.finish(i.reason === "cancelled" || i.reason === "superseded" || i.reason === "stale-scope" ? { kind: "cancelled" } : pe("The shared resource could not be applied."));
  }
  return e.addEventListener("kit_data", o), {
    async prepare(i, a, c, s) {
      if (r || c.aborted) return { kind: "cancelled" };
      if (!Number.isSafeInteger(i.byteLength) || i.byteLength <= 0 || i.byteLength % 4 !== 0 || i.byteLength > 2147483647)
        return pe("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
      const d = e.sharedData;
      if (!d) return pe("This host does not support shared-data preparation.");
      let l;
      try {
        l = d.reserve(i.input, i.byteLength);
      } catch {
        return pe("Shared storage is unavailable or its memory budget is exhausted.");
      }
      let p = !1;
      try {
        if (l.byteLength !== i.byteLength) return pe("The host supplied a differently sized shared allocation.");
        const g = s(l);
        if (ot(g)) return { kind: "failed", error: g.error };
        if (c.aborted || r) return { kind: "cancelled" };
        const y = new Promise((T) => {
          let k = () => {
          }, S;
          const E = (w) => {
            if (n.delete(l.id)) {
              if (clearTimeout(S), k(), w.kind !== "acknowledged")
                try {
                  d.cancel(l.id);
                } catch {
                  w = pe("Cancellation of the shared resource could not be confirmed.");
                }
              T(w);
            }
          };
          n.set(l.id, { input: i.input, target: a, submitted: null, early: null, finish: E }), k = c.onAbort(() => E({ kind: "cancelled" })), n.has(l.id) && (S = setTimeout(() => E(pe("The audio engine did not confirm this resource.")), t.timeoutMs ?? 1e4));
        });
        if (!n.has(l.id)) return y;
        try {
          const T = await d.commit(l.id);
          p = !0;
          const k = n.get(l.id);
          k && (!J(T) || T.kind !== "submitted" || T.id !== l.id || T.input !== i.input || T.generation !== l.id || typeof T.serial != "number" || !Number.isSafeInteger(T.serial) || T.serial <= 0 ? k.finish(pe("The host returned an invalid shared-resource submission receipt.")) : (k.submitted = { generation: T.generation, serial: T.serial }, k.early && o(k.early)));
        } catch {
          n.get(l.id)?.finish(c.aborted ? { kind: "cancelled" } : pe("The shared resource could not be submitted."));
        }
        return y;
      } finally {
        if (!p)
          try {
            d.cancel(l.id);
          } catch {
          }
      }
    },
    stop() {
      if (!r) {
        r = !0;
        for (const i of [...n.values()]) i.finish({ kind: "cancelled" });
        e.removeEventListener("kit_data", o);
      }
    }
  };
}
class Nn {
  #t = Object.freeze([]);
  #e = Object.freeze([]);
  #i;
  #d;
  constructor(t = {}) {
    const n = t.limit ?? 100;
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("History limit must be a non-negative integer.");
    this.#i = n, this.#d = t.compare;
  }
  get undoEntry() {
    return this.#t[this.#t.length - 1];
  }
  get redoEntry() {
    return this.#e[this.#e.length - 1];
  }
  #a(t, n) {
    const r = new Nn({ limit: this.#i, compare: this.#d });
    return r.#t = Object.freeze(this.#i === 0 ? [] : t.slice(-this.#i)), r.#e = Object.freeze(this.#i === 0 ? [] : n.slice(-this.#i)), r;
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
function Oe(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function mt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function dr(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function be(e, t, n = 0, r, o, i, a) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...o ? { gesture: o } : {}, ...i ? { application: Object.freeze(i) } : {}, ...a === void 0 ? {} : { persistenceRequest: a } });
}
function xa(e, t) {
  const n = ma(), r = {};
  for (const h of Object.keys(e)) r[h] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const o = tr({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    history: new Nn({ limit: t.historyLimit, compare: (h, f) => h.order - f.order }),
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map()
  }), i = tr((h) => h(o).snapshot);
  let a = !1, c, s = 0, d = !1, l, p = [];
  const g = [], y = () => n.get(i), T = (h) => e[h]?.history !== !1, k = (h) => [...h.gestures.keys()].some(T), S = (h, f, m = h.history) => {
    const b = m.undoEntry, u = m.redoEntry;
    return {
      ...h,
      history: m,
      snapshot: Object.freeze({
        ...h.snapshot,
        revision: h.snapshot.revision + 1,
        fields: Object.freeze(f),
        history: Object.freeze({
          canUndo: !a && !k(h) && b !== void 0 && f[b.key]?.readiness.kind === "ready",
          canRedo: !a && !k(h) && u !== void 0 && f[u.key]?.readiness.kind === "ready",
          ...h.snapshot.scope && b ? { undoEntry: mt(h.snapshot.scope, b) } : {},
          ...h.snapshot.scope && u ? { redoEntry: mt(h.snapshot.scope, u) } : {}
        })
      })
    };
  }, E = (h, f) => {
    const m = n.get(o);
    if (h.snapshot === m.snapshot) {
      n.set(o, h);
      return;
    }
    const b = h.snapshot.scope;
    if (!b || !t.bindings?.length) {
      n.set(o, h);
      return;
    }
    const u = { ...h.snapshot.fields };
    for (const v of t.bindings) {
      const I = u[v.key];
      if (!I) continue;
      const R = m.snapshot.fields[v.key], D = !m.snapshot.scope || !Oe(b, m.snapshot.scope);
      if (!(D || v.key === f || !R || R.readiness.kind !== I.readiness.kind || "value" in I && (!("value" in R) || !Object.is(I.value, R.value)) || v.dependencies.some((N) => {
        const L = m.snapshot.fields[N], X = u[N];
        return L !== X && (!L || !X || !("value" in L) || !("value" in X) || !Object.is(L.value, X.value));
      }))) {
        const N = I.application ?? R?.application, L = R?.target ?? I.target;
        u[v.key] = I.application === N && I.target === L ? I : Object.freeze({ ...I, ...N ? { application: N } : {}, ...L ? { target: L } : {} });
        continue;
      }
      const _ = Object.freeze({ scope: b, key: v.key, generation: D ? 0 : (R?.target?.generation ?? -1) + 1 }), x = {};
      let P = "value" in I && I.readiness.kind === "ready";
      for (const N of v.dependencies) {
        const L = u[N];
        e[N]?.kind !== "parameter" || !L || !("value" in L) || L.readiness.kind !== "ready" || typeof L.value != "number" ? P = !1 : x[N] = L.value;
      }
      if (u[v.key] = Object.freeze({ ...I, target: _, application: Object.freeze({ kind: P ? "pending" : "waiting-for-inputs" }) }), P && "value" in I) {
        const N = Object.freeze({ value: I.value, parameters: Object.freeze(x) });
        p.push(() => v.replace(N, _));
      } else p.push(() => v.cancel());
    }
    n.set(o, { ...h, snapshot: Object.freeze({ ...h.snapshot, fields: Object.freeze(u) }) });
  }, w = (h, f, m) => {
    if (!T(f)) return h;
    const b = e[f];
    return (b?.kind === "stored" ? b.codec.equals(m.before, m.after) : Object.is(m.before, m.after)) ? h : h.record({ key: f, before: m.before, after: m.after, order: m.order });
  }, A = (h, f, m, b, u) => {
    const v = e[f], I = h.snapshot.fields[f];
    if (!v || !I || !h.snapshot.scope)
      return { kind: "rejected", reason: "not-ready" };
    const R = "value" in I ? I : void 0;
    if (!R && !(u === "recover")) return { kind: "rejected", reason: "not-ready" };
    let M;
    if (v.kind === "parameter") {
      if (typeof m != "number") return { kind: "rejected", reason: "invalid-value" };
      M = h.gestures.has(f) ? [{ kind: "parameter", endpoint: v.endpoint, value: m }] : [
        { kind: "gesture-start", endpoint: v.endpoint },
        { kind: "parameter", endpoint: v.endpoint, value: m },
        { kind: "gesture-end", endpoint: v.endpoint }
      ];
    } else M = v.lifetime === "instance" ? [] : [{ kind: "stored", key: f, value: v.codec.encode(m) }];
    const _ = (R?.version ?? 0) + 1, x = M.length ? ++s : 0, P = M.length ? new Map(h.publications).set(x, { key: f, version: _ }) : h.publications, N = S(h, { ...h.snapshot.fields, [f]: be(m, { kind: v.kind === "parameter" ? "host-managed" : v.lifetime === "instance" ? "not-written" : "pending" }, _, R?.metadata, R?.gesture, v.kind === "parameter" ? { kind: "pending" } : void 0) }, b), L = {
      kind: "accepted",
      revision: N.snapshot.revision,
      version: _,
      ...u !== "history" ? { changed: !0 } : {},
      ...u === "edit" && T(f) && !h.gestures.has(f) && b.undoEntry ? { historyEntry: mt(h.snapshot.scope, b.undoEntry) } : {}
    };
    return l = L, E({ ...N, publications: P }), a || !M.length || t.native.publish({ request: x, scope: h.snapshot.scope, operations: M }), L;
  }, K = (h) => {
    const f = n.get(o);
    if (h.kind === "opened" || h.kind === "replaced") {
      if (f.snapshot.scope && (h.kind === "opened" || h.scope.owner !== f.snapshot.scope.owner || h.scope.document <= f.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const m = {}, b = /* @__PURE__ */ new Map();
      for (const [v, I] of Object.entries(e))
        if (I.kind === "parameter") {
          const R = h.native.parameters.find((D) => D.endpoint === I.endpoint);
          if (R && dr(R)) {
            b.set(v, Object.freeze({ ...R }));
            const { min: D, max: M, step: _, defaultValue: x } = R;
            m[v] = be(R.value, { kind: "host-managed" }, 0, Object.freeze({ min: D, max: M, step: _, defaultValue: x }), void 0, { kind: "unconfirmed" });
          } else m[v] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: R ? "invalid-state" : "missing-parameter" }) });
        } else {
          const R = f.snapshot.fields[v];
          if (I.lifetime === "instance" && h.kind === "replaced" && R && "value" in R) {
            m[v] = be(R.value, { kind: "not-written" }, R.version);
            continue;
          }
          const D = I.lifetime !== "instance" && Object.hasOwn(h.native.values, v), M = D ? I.codec.parse(h.native.values[v]) : I.initial;
          if (M.kind === "ok") m[v] = be(M.value, { kind: D ? "observed-in-native-state" : "not-written" });
          else {
            const _ = f.snapshot.fields[v], x = h.kind === "replaced" && h.changedStoredKey !== void 0 && _ && "value" in _;
            m[v] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...x ? { value: _.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const u = S(f, m, f.history.clear());
      E({ ...u, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), editOrder: 0, parameters: b, snapshot: Object.freeze({ ...u.snapshot, scope: Object.freeze({ ...h.scope }) }) });
    } else if (h.kind === "command") {
      if (!f.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!Oe(h.address, f.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (f.detached.has(h.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (h.command.kind === "undo" || h.command.kind === "redo") {
        if (k(f)) return { kind: "rejected", reason: "busy" };
        const x = h.command.kind === "undo", P = x ? f.history.undoEntry : f.history.redoEntry, N = h.command.expectedEntry;
        return N && (!P || !Oe(N.scope, f.snapshot.scope) || N.id !== P.order) ? { kind: "rejected", reason: "stale-history" } : P ? A(
          f,
          P.key,
          x ? P.before : P.after,
          x ? f.history.undo() : f.history.redo(),
          "history"
        ) : { kind: "accepted", revision: f.snapshot.revision };
      }
      const { key: m } = h.command;
      if (!Object.hasOwn(e, m)) return { kind: "rejected", reason: "invalid-command" };
      const b = e[m], u = f.snapshot.fields[m];
      if (!b || !u) return { kind: "rejected", reason: "invalid-command" };
      if (h.command.kind === "retry") {
        if (!("value" in u) || u.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
        if (h.command.expectedVersion !== u.version || h.command.expectedGeneration !== (u.target?.generation ?? null)) return { kind: "rejected", reason: "stale-version" };
        const x = u.persistence.kind === "failed" && u.persistenceRequest !== void 0;
        if (h.command.expectedPersistenceRequest !== (x ? u.persistenceRequest : null))
          return { kind: "rejected", reason: "stale-version" };
        if (x) {
          const L = b.kind === "parameter" ? [{ kind: "parameter", endpoint: b.endpoint, value: Number(u.value) }] : [{ kind: "stored", key: m, value: b.codec.encode(u.value) }], X = ++s, ce = new Map(f.publications).set(X, { key: m, version: u.version }), Q = S(f, { ...f.snapshot.fields, [m]: Object.freeze({
            ...u,
            persistence: Object.freeze({ kind: "pending" }),
            ...b.kind === "parameter" ? { application: Object.freeze({ kind: "pending" }) } : {}
          }) }), H = { kind: "accepted", revision: Q.snapshot.revision, version: u.version, changed: !1 };
          return l = H, E({ ...Q, publications: ce }), a || t.native.publish({ request: X, scope: f.snapshot.scope, operations: L }), H;
        }
        if (u.application?.kind !== "failed" || !t.bindings?.some((L) => L.key === m))
          return { kind: "rejected", reason: "not-ready" };
        const P = S(f, f.snapshot.fields), N = { kind: "accepted", revision: P.snapshot.revision, version: u.version, changed: !1 };
        return l = N, E(P, m), N;
      }
      if (h.command.kind === "recover") {
        if (h.command.expectedVersion !== 0 || Object.hasOwn(h.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (b.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in u && u.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (u.readiness.kind !== "failed" || u.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const x = b.codec.parse(h.command.value);
        return x.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : A(f, m, x.value, f.history, "recover");
      }
      if (!("value" in u) || u.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const v = u, I = f.gestures.get(m);
      if (I && I.client !== h.address.client) return { kind: "rejected", reason: "busy" };
      if (h.command.kind === "begin" || h.command.kind === "end") {
        const { gesture: x } = h.command;
        if (!Number.isSafeInteger(x) || x <= 0) return { kind: "rejected", reason: "invalid-command" };
        if (I && I.gesture !== x) return { kind: "rejected", reason: "invalid-command" };
        const P = h.command.kind === "begin";
        if (P === !!I) return { kind: "accepted", revision: f.snapshot.revision, version: v.version };
        const N = new Map(f.gestures);
        let L = f.history, X, ce;
        if (P) {
          X = Object.freeze({ client: h.address.client, gesture: x });
          const je = v.value;
          N.set(m, { ...X, before: je, after: je, order: 0, guardFloorVersion: v.version });
        } else I && (N.delete(m), L = w(L, m, I), L !== f.history && L.undoEntry && (ce = mt(f.snapshot.scope, { ...I })));
        const Q = S({ ...f, gestures: N }, {
          ...f.snapshot.fields,
          [m]: be(v.value, v.persistence, v.version, v.metadata, X, v.application, v.persistenceRequest)
        }, L), H = {
          kind: "accepted",
          revision: Q.snapshot.revision,
          version: v.version,
          ...ce ? { historyEntry: ce } : {}
        };
        return l = H, E({ ...Q, gestures: N }), a || b.kind === "parameter" && t.native.publish({
          request: ++s,
          scope: f.snapshot.scope,
          operations: [{ kind: P ? "gesture-start" : "gesture-end", endpoint: b.endpoint }]
        }), H;
      }
      const { value: R, expectedVersion: D } = h.command;
      if (h.command.gesture !== void 0 && (!I || I.gesture !== h.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (I && h.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (D !== void 0 && D !== v.version && !(I && D >= I.guardFloorVersion && D <= v.version))
        return { kind: "rejected", reason: "stale-version" };
      let M;
      if (b.kind === "parameter") {
        const x = f.parameters.get(m);
        if (!x) return { kind: "rejected", reason: "not-ready" };
        if (typeof R != "number" || !Number.isFinite(R)) return { kind: "rejected", reason: "invalid-value" };
        const P = Math.min(x.max, Math.max(x.min, R));
        if (M = x.step > 0 ? Math.min(x.max, Math.max(x.min, x.min + Math.round((P - x.min) / x.step) * x.step)) : P, Object.is(v.value, M)) return { kind: "accepted", revision: f.snapshot.revision, version: v.version, changed: !1 };
      } else {
        const x = b.codec.parse(R);
        if (x.kind === "error") return { kind: "rejected", reason: "invalid-value" };
        if (M = x.value, b.codec.equals(v.value, M)) return { kind: "accepted", revision: f.snapshot.revision, version: v.version, changed: !1 };
      }
      const _ = f.editOrder + 1;
      if (I) {
        const x = new Map(f.gestures).set(m, { ...I, after: M, order: _ });
        return A({ ...f, gestures: x, editOrder: _ }, m, M, T(m) ? f.history.clearRedo() : f.history, "edit");
      }
      return A({ ...f, editOrder: _ }, m, M, T(m) ? f.history.record({ key: m, before: v.value, after: M, order: _ }) : f.history, "edit");
    } else if (h.kind === "engine") {
      const m = f.snapshot.fields[h.target.key];
      if (!m?.target || !Oe(m.target.scope, h.target.scope) || m.target.generation !== h.target.generation) return { kind: "accepted", revision: f.snapshot.revision };
      E(S(f, {
        ...f.snapshot.fields,
        [h.target.key]: Object.freeze({ ...m, application: Object.freeze({ ...h.status }) })
      }));
    } else if (h.kind === "detached") {
      if (!f.snapshot.scope || !Oe(h.scope, f.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (f.detached.has(h.client)) return { kind: "accepted", revision: f.snapshot.revision };
      const m = new Map(f.gestures), b = { ...f.snapshot.fields }, u = [];
      let v = f.history;
      for (const [R, D] of f.gestures) {
        if (D.client !== h.client) continue;
        m.delete(R), v = w(v, R, D);
        const M = b[R];
        M && "value" in M && (b[R] = be(M.value, M.persistence, M.version, M.metadata, void 0, M.application, M.persistenceRequest));
        const _ = e[R];
        _?.kind === "parameter" && u.push({ kind: "gesture-end", endpoint: _.endpoint });
      }
      const I = m.size === f.gestures.size ? f : S({ ...f, gestures: m }, b, v);
      return l = { kind: "accepted", revision: I.snapshot.revision }, E({ ...I, gestures: m, detached: new Set(f.detached).add(h.client) }), !a && u.length > 0 && t.native.publish({ request: ++s, scope: f.snapshot.scope, operations: u }), l;
    } else if (h.kind === "parameter") {
      if (!f.snapshot.scope || !Oe(h.scope, f.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [m, b] of f.parameters) {
        if (b.endpoint !== h.endpoint) continue;
        if (!dr({ ...b, value: h.value })) return { kind: "rejected", reason: "invalid-value" };
        const u = f.snapshot.fields[m];
        if (!u || !("value" in u)) continue;
        const v = Object.is(u.value, h.value) ? f : S(f, {
          ...f.snapshot.fields,
          [m]: be(h.value, { kind: "host-managed" }, u.version + 1, u.metadata, u.gesture, { kind: "unconfirmed" })
        }), I = f.gestures.get(m), R = I && v !== f ? new Map(f.gestures).set(m, { ...I, guardFloorVersion: u.version + 1 }) : f.gestures;
        E({ ...v, gestures: R });
      }
    } else {
      if (!f.snapshot.scope || !Oe(h.scope, f.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const m = f.publications.get(h.request);
      if (m) {
        const b = new Map(f.publications);
        b.delete(h.request);
        const u = f.snapshot.fields[m.key];
        if (u && "value" in u && u.version === m.version) {
          const v = h.result.kind === "observed" ? { kind: e[m.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: h.result.reason }, I = e[m.key]?.kind === "parameter" ? h.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: h.result.reason }) } : u.application, R = S(f, { ...f.snapshot.fields, [m.key]: Object.freeze({
            ...be(u.value, v, u.version, u.metadata, u.gesture, I),
            ...h.result.kind === "failed" ? { persistenceRequest: h.request } : {}
          }) });
          E({ ...R, publications: b });
        } else E({ ...f, publications: b });
      }
    }
    return { kind: "accepted", revision: n.get(o).snapshot.revision };
  }, j = (h) => {
    if (a) return;
    a = !0;
    let f = () => {
    };
    c = new Promise((v) => {
      f = v;
    });
    const m = [];
    for (const v of t.bindings ?? [])
      try {
        m.push(v.stop());
      } catch (I) {
        m.push(Promise.reject(I));
      }
    Promise.allSettled(m).then((v) => {
      for (const I of v) I.status === "rejected" && t.onDefect(I.reason);
      f();
    });
    const b = n.get(o), u = {};
    for (const [v, I] of Object.entries(b.snapshot.fields)) {
      const { gesture: R, ...D } = "value" in I ? I : { ...I, gesture: void 0 };
      u[v] = Object.freeze({ ...D, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(o, { ...S(b, u), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
    } catch (v) {
      t.onDefect(v);
    }
    if (h)
      try {
        t.native.update(y(), h);
      } catch (v) {
        t.onDefect(v);
      }
    t.native.close({ reason: "service-closed" });
  }, U = () => {
    if (!d) {
      d = !0;
      try {
        for (let h = g.shift(); h; h = g.shift()) {
          l = void 0, p = [];
          let f, m = !1;
          try {
            f = a ? { kind: "rejected", reason: "service-closed" } : K(h.event), l = f;
            for (const b of p)
              a || b();
            a || (m = !0, t.native.update(y(), h.event.kind === "command" ? { address: h.event.address, result: f } : void 0));
          } catch (b) {
            f = l ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(b), j(!m && h.event.kind === "command" ? { address: h.event.address, result: f } : void 0);
          }
          h.finish(f);
        }
      } finally {
        d = !1;
      }
    }
  };
  return {
    getSnapshot: y,
    subscribe: (h) => n.sub(i, () => h(y())),
    dispatch: (h) => new Promise((f) => {
      g.push({ event: h, finish: f }), U();
    }),
    stop: () => (j(), c ?? Promise.resolve())
  };
}
const wa = 5e3;
function ae(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function Ma(e, t) {
  const n = (o) => Array.isArray(o) && o.every((i) => {
    if (typeof i != "string" || i.length === 0) return !1;
    try {
      return encodeURIComponent(i).replace(/%[0-9A-F]{2}/g, "x").length <= 256;
    } catch {
      return !1;
    }
  });
  if (!Array.isArray(t)) throw new Error("Invalid custom engine binding declarations.");
  const r = /* @__PURE__ */ new Set();
  for (const o of t) {
    if (!o || typeof o != "object" || typeof o.create != "function" || !n([o.key]) || !Object.hasOwn(e, o.key))
      throw new Error("Invalid custom engine binding key or factory.");
    const i = e[o.key];
    if (i?.kind !== "stored" || i.engine?.kind === "event-value" || r.has(o.key))
      throw new Error("A stored field must have exactly one engine binding.");
    r.add(o.key);
    const a = o.dependencies ?? [];
    if (!n(a) || a.some((c) => !Object.hasOwn(e, c) || e[c]?.kind !== "parameter") || !n(o.eventEndpoints) || !n(o.hostEffects ?? []) || !n(o.outputEndpoints ?? []) || !n(o.storedKeys ?? []))
      throw new Error("Invalid custom engine binding dependency or effect declaration.");
  }
  return Object.freeze(t.map((o) => Object.freeze({
    key: o.key,
    dependencies: Object.freeze([...o.dependencies ?? []]),
    eventEndpoints: Object.freeze([...o.eventEndpoints]),
    hostEffects: Object.freeze([...o.hostEffects ?? []]),
    outputEndpoints: Object.freeze([...o.outputEndpoints ?? []]),
    storedKeys: Object.freeze([...o.storedKeys ?? []]),
    create: (i) => o.create(i)
  })));
}
function Oa(e, t, n) {
  let r = !1, o = !1, i, a, c = 0, s = 0, d, l, p, g = () => {
  }, y = () => {
  };
  const T = /* @__PURE__ */ new Map(), k = (f) => {
    if (!mn(f)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: f });
  }, S = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new WeakMap(), w = [];
  for (const { key: f, input: m } of Si(e)) {
    const b = e[f];
    if (b?.kind !== "stored" || b.engine?.kind !== "shared-prepared") continue;
    const u = b.engine, v = Wt({
      async prepare(I, R) {
        const D = { parameters: I.parameters, signal: R }, M = await u.measure(I.value, D);
        return ot(M) ? { kind: "error", error: M.error } : !Number.isSafeInteger(M) || M <= 0 ? { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size." } } : { kind: "ok", value: { value: I.value, context: D, target: I.target, length: M } };
      },
      transport: {
        apply(I, R) {
          if (R.signal.aborted || !ae(A.getSnapshot().scope, I.target.scope))
            return Promise.resolve({ kind: "cancelled" });
          a ??= lr(t);
          const D = u.storage.type === "float32" ? I.length * 4 : I.length;
          return a.prepare({ input: m, byteLength: D }, I.target, R.signal, (M) => {
            const _ = u.storage.type === "float32" ? new Float32Array(M.buffer, M.byteOffset, I.length) : new Uint8Array(M.buffer, M.byteOffset, I.length), x = u.prepare(I.value, _, I.context);
            if (ot(x)) return x;
            if (_ instanceof Float32Array && !_.every(Number.isFinite))
              return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
          });
        },
        stop() {
        }
      },
      onStatus(I, R) {
        A.dispatch({ kind: "engine", target: I, status: R });
      },
      onDefect(I) {
        n.onDefect(I), U();
      }
    });
    w.push({
      key: f,
      dependencies: u.dependencies,
      replace(I, R) {
        v.replace({ ...I, target: R }, R);
      },
      cancel: v.cancel,
      stop: v.stop
    });
  }
  for (const [f, m] of Object.entries(e)) {
    if (m.kind !== "stored" || m.engine?.kind !== "event-value") continue;
    const b = m.engine, u = Wt({
      async prepare(v, I) {
        const R = await b.prepare(v.value, { parameters: v.parameters, signal: I });
        if (ot(R)) return { kind: "error", error: R.error };
        const D = cr(R);
        return D.kind === "ok" ? { kind: "ok", value: { target: v.target, value: D.value } } : { kind: "error", error: { kind: "engine-rejected", message: D.message } };
      },
      transport: {
        apply(v, I) {
          return new Promise((R) => {
            let D = 0, M = () => {
            };
            const _ = (x) => {
              M(), S.delete(D), R(x);
            };
            M = I.signal.onAbort(() => _({ kind: "cancelled" }));
            try {
              const x = I.send(() => ae(A.getSnapshot().scope, v.target.scope) ? (D = ++c, S.set(D, { kind: "event-value", key: f, scope: v.target.scope, finish: _ }), k({
                kind: "publish",
                request: D,
                scope: v.target.scope,
                operations: [{ kind: "event", endpoint: b.endpoint, value: v.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              x.kind !== "sent" && _(x);
            } catch (x) {
              M(), S.delete(D), n.onDefect(x), U(), R({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const v of S.values()) v.key === f && v.finish({ kind: "cancelled" });
        }
      },
      onStatus(v, I) {
        A.dispatch({ kind: "engine", target: v, status: I });
      },
      onDefect: n.onDefect
    });
    w.push({
      key: f,
      dependencies: b.dependencies,
      replace(v, I) {
        u.replace({ ...v, target: I }, I);
      },
      cancel: u.cancel,
      stop: u.stop
    });
  }
  const A = xa(e, {
    historyLimit: Aa(e).historyLimit,
    bindings: w,
    onDefect: n.onDefect,
    native: {
      publish(f) {
        const m = ++c;
        T.set(m, { request: f.request, scope: f.scope }), k({ kind: "publish", ...f, request: m });
      },
      update(f, m) {
        f.scope && k({
          kind: "update",
          scope: f.scope,
          revision: f.revision,
          state: sr(e, f),
          ...m ? { receipt: m } : {}
        });
      },
      close(f) {
        o = !0, i?.stop(), a?.stop();
        for (const m of S.values()) m.finish({ kind: "cancelled" });
        y(new Error("State service closed before native initialization completed."));
        try {
          r && A.getSnapshot().scope && k({ kind: "close", ...f });
        } catch (m) {
          n.onDefect(m);
        }
        r && t.removeEventListener("kit_state", j), r = !1, T.clear();
      }
    }
  }), K = (f) => {
    if (o) return;
    const m = va(f);
    if (m.kind === "invalid") {
      const u = new Error(m.message);
      n.onDefect(u), y(u), U();
      return;
    }
    const b = m.value;
    if (b.kind === "closed")
      y(new Error(`Native state service closed: ${b.reason}`)), U();
    else if (b.kind === "open-failed") {
      if (b.request !== s || A.getSnapshot().scope) return;
      y(new Error(`Native state open failed: ${b.reason}`)), U();
    } else if (b.kind === "opened") {
      if (b.request !== s || A.getSnapshot().scope) return;
      A.dispatch(b).then((u) => {
        u.kind === "accepted" ? g() : y(new Error("Native state could not initialize the service."));
      });
    } else if (b.kind === "attached-client") {
      const u = A.getSnapshot();
      ae(u.scope, b.scope) && k({
        kind: "snapshot",
        scope: b.scope,
        to: b.client,
        attachRequest: b.request,
        revision: u.revision,
        state: sr(e, u)
      });
    } else if (b.kind === "detach")
      A.dispatch({ kind: "detached", scope: b.scope, client: b.client });
    else if (b.kind === "parameter")
      ae(A.getSnapshot().scope, b.scope) && A.dispatch(b);
    else if (b.kind === "replaced")
      A.dispatch(b).then((u) => {
        if (u.kind !== "accepted") return;
        const v = A.getSnapshot().scope;
        for (const I of S.values())
          ae(v, I.scope) || I.finish({ kind: "cancelled" });
        for (const [I, R] of T)
          ae(v, R.scope) || T.delete(I);
      });
    else if (b.kind === "command")
      A.dispatch(b);
    else if (b.kind === "invalid-command")
      ae(A.getSnapshot().scope, b.address) && k({
        kind: "receipt",
        address: b.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const u = S.get(b.request);
      if (u) {
        if (!ae(u.scope, b.scope) || !ae(A.getSnapshot().scope, b.scope)) return;
        if (u.kind === "custom" && b.result.kind === "failed" && (b.result.reason === "stale-scope" || b.result.reason === "closed")) {
          u.finish({ kind: "cancelled" });
          return;
        }
        u.finish(b.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: b.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: b.result.reason } });
        return;
      }
      const v = T.get(b.request);
      if (!v || !ae(v.scope, b.scope) || !ae(A.getSnapshot().scope, b.scope)) return;
      T.delete(b.request), A.dispatch({ ...b, request: v.request });
    }
  }, j = (f) => {
    if (!o)
      try {
        K(f);
      } catch (m) {
        n.onDefect(m), y(m), U();
      }
  }, U = () => p || (o = !0, y(new Error("State service stopped before native initialization completed.")), p = A.stop(), p), h = () => Object.entries(e).flatMap(([f, m]) => {
    if (m.kind !== "stored" || m.engine?.kind !== "prepared") return [];
    const b = m.engine, u = b.delivery;
    if (!u || typeof u.create != "function" || u.replacement !== void 0 && u.replacement !== "supersede" && u.replacement !== "finish")
      throw new Error("Invalid prepared delivery factory or replacement policy.");
    const v = u.create.bind(u), I = u.replacement, R = Object.freeze([...u.dataInputs ?? []]);
    if (R.some((_) => !Number.isSafeInteger(_) || _ < 0 || _ > 2147483647))
      throw new Error("Invalid shared-data input declaration.");
    const D = Array.isArray(u.outputEndpoints) ? Object.freeze([...u.outputEndpoints]) : u.outputEndpoints, M = Array.isArray(u.storedKeys) ? Object.freeze([...u.storedKeys]) : u.storedKeys;
    return [{
      key: f,
      storedKeys: M,
      dependencies: b.dependencies,
      eventEndpoints: u.eventEndpoints,
      hostEffects: u.hostEffects,
      outputEndpoints: D,
      create(_) {
        let x, P = !1;
        const N = /* @__PURE__ */ new Set();
        function L() {
          const ce = x;
          if (x = void 0, !ce) return;
          const Q = ce.close();
          N.add(Q), Q.then(() => N.delete(Q), (H) => {
            N.delete(Q), _.onDefect(H);
          });
        }
        function X(ce) {
          const Q = Object.freeze({ ...ce.scope });
          let H = !0, je = ce;
          const oe = /* @__PURE__ */ new Set(), Jn = {
            get aborted() {
              return !H;
            },
            onAbort(C) {
              return H ? oe.add(C) : C(), () => {
                oe.delete(C);
              };
            }
          }, No = {
            signal: Jn,
            send(C) {
              if (!H) return { kind: "cancelled" };
              const B = _.publish(Q, C);
              if (B.kind === "submitted") {
                const V = E.get(B.completion);
                V && (oe.add(V), B.completion.then(() => oe.delete(V)));
              }
              return B;
            },
            listen(C, B) {
              if (!D?.includes(C)) throw new Error("Undeclared engine output endpoint.");
              if (!H) return () => {
              };
              let V = !0;
              const W = (me) => {
                if (!(!H || !V))
                  try {
                    B(me);
                  } catch (ye) {
                    _.onDefect(ye);
                  }
              }, ie = () => {
                V && (V = !1, oe.delete(ie), t.removeEndpointListener?.(C, W));
              };
              return oe.add(ie), t.addEndpointListener?.(C, W), ie;
            },
            readStored(C) {
              if (!M?.includes(C)) throw new Error("Undeclared stored-state input.");
              return H ? new Promise((B) => {
                const V = () => B(void 0);
                oe.add(V), t.requestFullStoredState?.((W) => {
                  oe.delete(V);
                  const ie = J(W) && J(W.values) ? W.values : W;
                  B(H && J(ie) ? ie[C] : void 0);
                });
              }) : Promise.resolve(void 0);
            },
            subscribeStored(C, B) {
              if (!M?.includes(C)) throw new Error("Undeclared stored-state input.");
              if (!H) return () => {
              };
              let V = !0;
              const W = (me) => {
                if (!(!H || !V || !J(me) || me.key !== C))
                  try {
                    B(me.value);
                  } catch (ye) {
                    _.onDefect(ye);
                  }
              }, ie = () => {
                V && (V = !1, oe.delete(ie), t.removeStoredStateValueListener?.(W));
              };
              return oe.add(ie), t.addStoredStateValueListener?.(W), ie;
            },
            async prepareData(C, B, V, W) {
              if (!R.includes(C)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
              if (!H || W?.aborted) return { kind: "cancelled" };
              const ie = {
                get aborted() {
                  return !H || !!W?.aborted;
                },
                onAbort(me) {
                  const ye = Jn.onAbort(me), re = W?.onAbort(me);
                  return () => {
                    ye(), re?.();
                  };
                }
              };
              return a ??= lr(t), a.prepare({ input: C, byteLength: B }, { ...je, scope: Q }, ie, V);
            },
            report(C) {
              H && _.onStatus(je, C);
            },
            fail(C) {
              H && _.onDefect(C);
            }
          };
          let qt;
          try {
            qt = v(No);
          } catch (C) {
            H = !1;
            for (const B of [...oe]) B();
            throw oe.clear(), C;
          }
          let Qn = !1;
          const Xn = Wt({
            replacement: I,
            async prepare(C, B) {
              const V = await b.prepare(C.value, { parameters: C.parameters, signal: B });
              return ot(V) ? { kind: "error", error: V.error } : { kind: "ok", value: { value: V, target: C.target } };
            },
            transport: {
              async apply(C, B) {
                je = C.target;
                let V = !0;
                const W = /* @__PURE__ */ new Set(), ie = () => {
                  const re = [...W];
                  W.clear();
                  for (const he of re) he();
                }, me = B.signal.onAbort(ie), ye = {
                  get aborted() {
                    return !V || B.signal.aborted;
                  },
                  onAbort(re) {
                    return !V || B.signal.aborted ? re() : W.add(re), () => {
                      W.delete(re);
                    };
                  }
                };
                try {
                  return await qt.apply(C.value, {
                    signal: ye,
                    replaceData(re, he) {
                      return R.includes(re) ? !V || B.signal.aborted || !ae(A.getSnapshot().scope, C.target.scope) ? Promise.resolve({ kind: "cancelled" }) : (i ??= Sa(t), i.replace(re, he, C.target, ye)) : Promise.resolve({ kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } });
                    },
                    send(re) {
                      if (!V || B.signal.aborted) return { kind: "cancelled" };
                      const he = _.publish(C.target.scope, re);
                      if (he.kind === "submitted") {
                        const Me = E.get(he.completion);
                        Me && (W.add(Me), he.completion.then(() => W.delete(Me)));
                      }
                      return he;
                    },
                    listen(re, he) {
                      if (!D?.includes(re)) throw new Error("Undeclared engine output endpoint.");
                      if (!V || B.signal.aborted) return () => {
                      };
                      let Me = !0;
                      const Zn = (Co) => {
                        if (!(!Me || B.signal.aborted))
                          try {
                            he(Co);
                          } catch (Po) {
                            _.onDefect(Po);
                          }
                      }, Ht = () => {
                        Me && (Me = !1, W.delete(Ht), t.removeEndpointListener?.(re, Zn));
                      };
                      return W.add(Ht), t.addEndpointListener?.(re, Zn), Ht;
                    }
                  });
                } finally {
                  V = !1, me(), ie();
                }
              },
              stop() {
                Qn || (Qn = !0, qt.stop());
              }
            },
            onStatus: _.onStatus,
            onDefect: _.onDefect
          });
          return {
            scope: Q,
            binding: Xn,
            close() {
              H = !1;
              for (const C of [...oe]) C();
              return oe.clear(), Xn.stop();
            }
          };
        }
        return {
          replace(ce, Q) {
            if (!P) {
              if ((!x || !ae(x.scope, Q.scope)) && (L(), x = X(Q)), P) {
                L();
                return;
              }
              x.binding.replace({ ...ce, target: Q }, Q);
            }
          },
          cancel() {
            L();
          },
          async stop() {
            P = !0, L(), await Promise.all(N);
          }
        };
      }
    }];
  });
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (o) return Promise.reject(new Error("State service is closed."));
      if (d) return d;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return U(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      d = new Promise((f, m) => {
        g = () => {
          clearTimeout(l), f();
        }, y = (b) => {
          clearTimeout(l), m(b);
        };
      });
      try {
        const f = Ma(e, [...h(), ...n.bindings ?? []]);
        if (f.some((m) => m.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        if (f.some((m) => m.storedKeys?.length) && (typeof t.addStoredStateValueListener != "function" || typeof t.removeStoredStateValueListener != "function" || typeof t.requestFullStoredState != "function"))
          throw new Error("Declared stored-state inputs are unavailable.");
        for (const m of f) {
          const b = m.create({
            publish(u, v) {
              if (o || !ae(A.getSnapshot().scope, u)) return { kind: "cancelled" };
              const I = Object.freeze({ owner: u.owner, document: u.document });
              if (!v || typeof v != "object" || v.kind !== "event" && v.kind !== "host-effect")
                return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
              if (!(v.kind === "event" ? m.eventEndpoints.includes(v.endpoint) : m.hostEffects?.includes(v.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
              const D = cr(v.value);
              if (D.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: D.message } };
              const M = v.kind === "event" ? { kind: "event", endpoint: v.endpoint, value: D.value } : { kind: "host-effect", name: v.name, value: D.value }, _ = { kind: "publish", request: c + 1, scope: I, operations: [M] };
              if (!mn(_)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
              const x = ++c;
              let P = (L) => {
              };
              const N = new Promise((L) => {
                P = (X) => {
                  S.delete(x), E.delete(N), L(X);
                };
              });
              E.set(N, () => P({ kind: "cancelled" })), S.set(x, { kind: "custom", key: m.key, scope: I, finish: P });
              try {
                t.sendMessageToServer({ type: "kit_state", message: _ });
              } catch (L) {
                const X = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
                return P(X), n.onDefect(L), X;
              }
              return { kind: "submitted", completion: N };
            },
            onStatus(u, v) {
              A.dispatch({ kind: "engine", target: u, status: v });
            },
            onDefect(u) {
              n.onDefect(u), U();
            }
          });
          if (o) {
            const u = Promise.resolve().then(() => b.stop()).catch(n.onDefect);
            return p = Promise.all([p, u]).then(() => {
            }), d;
          }
          w.push({
            key: m.key,
            dependencies: m.dependencies ?? [],
            replace: (u, v) => b.replace(u, v),
            cancel: () => b.cancel(),
            stop: () => b.stop()
          });
        }
        r = !0, t.addEventListener("kit_state", j), s = ++c, l = setTimeout(() => {
          y(new Error("Cmajor state-channel is unavailable: native open timed out.")), U();
        }, wa), k({
          kind: "open",
          request: s,
          parameters: Object.values(e).filter((m) => m.kind === "parameter").map((m) => m.endpoint),
          storedKeys: Object.keys(e).filter((m) => e[m]?.kind === "stored" && e[m].lifetime !== "instance"),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((m) => m.kind === "stored" && m.engine?.kind === "event-value" ? [m.engine.endpoint] : []),
            ...f.flatMap((m) => m.eventEndpoints)
          ])],
          ...f.some((m) => m.hostEffects?.length) ? {
            hostEffects: [...new Set(f.flatMap((m) => m.hostEffects ?? []))]
          } : {}
        });
      } catch (f) {
        n.onDefect(f), y(f), U();
      }
      return d;
    },
    /** Release this owner and its channel resources. */
    stop: U
  };
}
const Ii = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), hn = Reflect.get(globalThis, Ii), ur = hn instanceof WeakMap ? hn : /* @__PURE__ */ new WeakMap();
hn !== ur && Object.defineProperty(globalThis, Ii, { value: ur });
const _a = 2e3;
function fr(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function mr(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Da(e, t) {
  if (!mr(e))
    return { found: !1 };
  const n = mr(e.values) ? e.values : void 0;
  return n && fr(n, t) ? {
    found: !0,
    value: n[t]
  } : fr(e, t) ? {
    found: !0,
    value: e[t]
  } : { found: !1 };
}
function hr(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class La {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
  stateKeys;
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
  lifetime = 0;
  lastAppliedToken = null;
  lastAppliedRuntimeEndpointsToken = null;
  lastAppliedSnapshot = null;
  pendingStateKeyIndex = null;
  activeStateKeyIndex = null;
  constructor(t, n) {
    this.connection = t, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Na(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (!this.started) {
      this.started = !0, this.lifetime += 1, this.deliveryInProgress = !1, this.deliveryRefreshPending = !1, this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.pendingStateKeyIndex = null, this.activeStateKeyIndex = null, this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
      for (const t of this.parameterEndpointIDs)
        this.connection.addParameterListener?.(t, this.getParameterListener(t)), this.connection.requestParameterValue?.(t);
      for (const t of this.runtimeEndpointDependencies)
        this.connection.addEndpointListener?.(t.endpointID, this.getRuntimeEndpointListener(t));
      this.requestStoredState();
    }
  }
  stop() {
    if (this.started) {
      this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
      for (const t of this.parameterEndpointIDs)
        this.connection.removeParameterListener?.(t, this.getParameterListener(t));
      for (const t of this.runtimeEndpointDependencies)
        this.connection.removeEndpointListener?.(t.endpointID, this.getRuntimeEndpointListener(t));
    }
  }
  /** Rebuild and resend the complete runtime image from the stored snapshot. */
  replayFullRuntimeState() {
    this.started && (this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.forceFullReplay = !0, this.applyRuntimeStateIfReady());
  }
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      const t = this.lifetime;
      this.connection.requestFullStoredState((n) => {
        if (!(!this.started || t !== this.lifetime)) {
          for (let r = 0; r < this.stateKeys.length; r += 1) {
            const o = Da(n, this.stateKeys[r]);
            if (o.found && o.value != null) {
              this.activeStateKeyIndex = r, this.applyStoredValue(o.value);
              return;
            }
          }
          this.options.applyDefaultRuntimeStateWhenMissing && (this.activeStateKeyIndex = null, this.applyStoredValue(void 0));
        }
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.requestStateKeyAtIndex(0);
      return;
    }
    this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
  }
  handleStoredStateValue(t) {
    if (!t || typeof t != "object")
      return;
    const n = t;
    if (typeof n.key != "string")
      return;
    const r = this.stateKeys.indexOf(n.key);
    if (r < 0)
      return;
    const o = this.pendingStateKeyIndex === r;
    if (o && (this.pendingStateKeyIndex = null), n.value == null && o && r + 1 < this.stateKeys.length) {
      this.activeStateKeyIndex = null, this.requestStateKeyAtIndex(r + 1);
      return;
    }
    n.value == null && !this.options.applyDefaultRuntimeStateWhenMissing || this.activeStateKeyIndex !== null && r > this.activeStateKeyIndex || (this.activeStateKeyIndex = n.value == null ? null : r, this.applyStoredValue(n.value));
  }
  requestStateKeyAtIndex(t) {
    if (t >= this.stateKeys.length) {
      this.options.applyDefaultRuntimeStateWhenMissing && (this.activeStateKeyIndex = null, this.applyStoredValue(void 0));
      return;
    }
    this.pendingStateKeyIndex = t, this.connection.requestStoredStateValue?.(this.stateKeys[t]);
  }
  getParameterListener(t) {
    const n = this.parameterListeners.get(t);
    if (n)
      return n;
    const r = (o) => {
      this.parameterValues.set(t, o), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(t, r), r;
  }
  getRuntimeEndpointListener(t) {
    const n = this.runtimeEndpointListeners.get(t.endpointID);
    if (n)
      return n;
    const r = (o) => {
      const i = t.mapValue ? t.mapValue(o) : o;
      this.runtimeEndpointValues.set(t.endpointID, i), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(t.endpointID, r), r;
  }
  applyStoredValue(t) {
    const n = this.options.deserializeStoredState(t);
    n !== null && (this.state = n, this.hasState = !0, this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState)
      return;
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    const t = {};
    for (const s of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(s))
        return;
      t[s] = this.parameterValues.get(s);
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
    const r = {
      state: this.state,
      parameters: t,
      runtimeEndpoints: n
    }, o = hr(n), i = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, i), c = hr({
      runtimeEndpoints: n,
      events: a
    });
    if (c === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = r;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = r, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      const s = this.lifetime;
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, r).then((d) => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, d ? (this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = r) : this.options.onDeliveryFailure?.(a);
        const l = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, l && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, this.options.onDeliveryFailure?.(a);
        const d = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, d && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of a)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? _a
      );
    this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = r;
  }
}
function Na(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e)
    t.has(n.endpointID) || t.set(n.endpointID, n);
  return [...t.values()];
}
function Ca(e, t) {
  return new La(e, t);
}
class Pa {
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
          } catch (o) {
            n.push(o);
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
function Fa(e, t) {
  return new Pa(e, t);
}
async function Ka(e, t) {
  const n = Fa(e, t);
  return await n.start(), n;
}
const De = 2048, ct = De + 3, pr = 20, Ti = "MSEG 1", Ua = 0, Le = 2;
function lt(e) {
  return e !== null && typeof e == "object" ? e : {};
}
function Cn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Qe(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function za(e) {
  return Cn(Number.isFinite(e) ? e : 0, -pr, pr);
}
function Pe(e) {
  return Cn(Number.isFinite(e) ? e : 0, 0, 1);
}
function ki(e = Ti) {
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
function Ei() {
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
function ja(e) {
  const t = Number(e);
  return Cn(
    Number.isFinite(t) ? t : 1,
    Ua,
    Le
  );
}
function Va(e) {
  if (!e || typeof e != "object")
    return null;
  const t = lt(e), n = Pe(Number(t.startX)), r = Pe(Number(t.endX));
  return Qe(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function $a(e = Ei()) {
  const t = lt(e), n = lt(t.rate), r = Number(n.seconds), o = t.noteOffPolicy, i = o === "finish_loop" || o === "immediate" || o === "ignore" ? o : "finish_loop";
  return {
    format: "mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: ja(Number.isFinite(r) ? r : 1)
    },
    loop: Va(t.loop),
    noteOffPolicy: i,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function Ba(e, t, n) {
  const r = lt(e);
  let o = Number(r.x);
  return Number.isFinite(o) || (o = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (o = Pe(o)), {
    x: o,
    y: Pe(Number(r.y)),
    curvePower: za(Number(r.curvePower))
  };
}
function jt(e = ki()) {
  const t = lt(e), n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((o, i) => Ba(o, i, n.length));
  if (!Qe(r[0].x, 0) || !Qe(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < r.length; o += 1)
    if (r[o].x < r[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : Ti,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function gr(e) {
  return JSON.stringify(jt(e));
}
function qa(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function Ha(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], o = e[n + 1];
    if (t < o.x)
      return { from: r, to: o, laterPointWins: !1 };
    if (Qe(t, o.x)) {
      let i = n + 1;
      for (; i + 1 < e.length && Qe(e[i + 1].x, t); )
        i += 1;
      return {
        from: e[i],
        to: e[i],
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
function Wa(e, t) {
  const n = Pe(Number(t)), r = Ha(e, n);
  if (r.laterPointWins || Qe(r.from.x, r.to.x))
    return r.to.y;
  const o = r.to.x - r.from.x, i = o <= 0 ? 1 : (n - r.from.x) / o, a = Pe(qa(i, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Ga(e, t) {
  return Wa(jt(e).points, t);
}
function Ya(e) {
  const t = new Float32Array(ct);
  return Ai(e, t), t;
}
function Ai(e, t) {
  if (t.length !== ct) throw new Error("Invalid MSEG destination length.");
  const n = jt(e);
  for (let r = 0; r < De; r += 1) {
    const o = r / (De - 1);
    t[r + 1] = Ga(n, o);
  }
  t[0] = t[1], t[De + 1] = t[De], t[De + 2] = t[De];
}
function vr(e, t) {
  return gr(e) === gr(t);
}
function de(e, t) {
  if (!e)
    throw new Error(t);
}
function Yt(e, t, n) {
  let r = "";
  for (let o = 0; o < n; o += 1)
    r += String.fromCharCode(e.getUint8(t + o));
  return r;
}
function Ja(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function pn(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Ri(e) {
  if (e === null)
    return "null";
  if (e === void 0)
    return "undefined";
  const t = typeof e, n = e?.constructor?.name;
  if (t !== "object")
    return n ? `${t}:${n}` : t;
  const r = Object.keys(e).slice(0, 6), o = r.length > 0 ? ` keys=${r.join(",")}` : "";
  return n ? `${t}:${n}${o}` : `${t}${o}`;
}
function Qa() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function Jt(e, t) {
  const n = Qa();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (Ja(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function yr(e) {
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
  throw new Error(`Unsupported text resource payload (${Ri(e)})`);
}
function Xa(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return pn(e);
  throw new Error(`Unsupported binary resource payload (${Ri(e)})`);
}
function Za(e) {
  const t = e?.frames;
  de(
    Array.isArray(t) || ArrayBuffer.isView(t),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(t), r = new Float32Array(n.length);
  for (let o = 0; o < n.length; o += 1) {
    const i = n[o];
    if (typeof i == "number") {
      r[o] = i;
      continue;
    }
    if (ArrayBuffer.isView(i) || Array.isArray(i)) {
      const a = i;
      de(a.length === 1, "Only mono wavetable source files are supported"), r[o] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function xi(e) {
  const t = new DataView(e);
  de(Yt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), de(Yt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, o = null, i = null, a = null, c = null, s = null, d = 12;
  for (; d + 8 <= t.byteLength; ) {
    const p = Yt(t, d, 4), g = t.getUint32(d + 4, !0), y = d + 8;
    p === "fmt " ? (n = t.getUint16(y, !0), r = t.getUint16(y + 2, !0), o = t.getUint32(y + 4, !0), a = t.getUint16(y + 12, !0), i = t.getUint16(y + 14, !0)) : p === "data" && (c = y, s = g), d = y + g + g % 2;
  }
  de(n !== null, "Wave file is missing a fmt chunk"), de(c !== null && s !== null, "Wave file is missing a data chunk"), de(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && i === 32)
    l = new Float32Array(e.slice(c, c + s));
  else if (n === 1 && i === 16) {
    const p = s / 2, g = new Int16Array(e.slice(c, c + s));
    l = new Float32Array(p);
    for (let y = 0; y < p; y += 1)
      l[y] = g[y] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${i}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: o ?? 0,
    bitsPerSample: i,
    blockAlign: a ?? 0,
    samples: l
  };
}
async function br(e) {
  de(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return de(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function gn(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function wi(e) {
  const t = new Uint8Array(e).buffer, n = xi(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function es(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (s) => (de(typeof e.readResource == "function", `Resource bridge cannot read ${s}`), e.readResource(s)), o = async (s) => {
    de(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const d = await e.readResourceAsAudioData(s);
    return Za(d);
  }, i = (s) => {
    const d = e.getResourceAddress?.(s);
    return d ?? null;
  }, a = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Jt(s, d), p = await br(l), g = xi(p);
    return {
      sampleRate: g.sampleRate,
      samples: g.samples
    };
  }, c = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Jt(s, d);
    return new Uint8Array(await br(l));
  };
  return {
    async readText(s) {
      if (t === "bridge" && typeof e.readResource == "function")
        return yr(await r(s));
      const d = i(s);
      return t === "url" && d !== null ? gn(await c(s, d)) : typeof e.readResource == "function" ? yr(await r(s)) : gn(await c(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof e.readResource == "function" ? Xa(await r(s)) : c(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return o(s);
      const d = i(s);
      return n === "url" && d !== null ? a(s, d) : typeof e.readResourceAsAudioData == "function" ? o(s) : wi(await this.readBytes(s));
    },
    getURL(s) {
      return Jt(s, e.getResourceAddress?.(s));
    }
  };
}
function ts(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return es(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function ns(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, o = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, i = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return gn(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return pn(await t(a));
      if (n)
        return pn(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : wi(await this.readBytes(a));
    },
    getURL(a) {
      return i ? i(a) : null;
    }
  };
}
function rs(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function is(e) {
  return rs(e) ? ns(e) : ts(e);
}
const Ge = -100, At = 35, os = 5, as = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Mi(e) {
  const t = as.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function le(e) {
  return Mi(e).laneEndpointID;
}
function ss(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > os)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${Mi(e).hostStem}${t}OutputTrimDb`;
}
function Oi(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function cs(e) {
  const t = (Oi(e, Ge, At) - Ge) / (At - Ge);
  return t * t;
}
function ls(e) {
  const t = Math.sqrt(Oi(e, 0, 1));
  return Ge + t * (At - Ge);
}
const se = (e, t) => ({ label: e, value: t });
function Se(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const Ie = Object.freeze({
  filter: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: Se(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), O = (e, t, n, r, o, i, a, c = {}) => ({
  id: `${e}.${t}`,
  effectId: e,
  endpointID: t,
  label: n,
  shortLabel: r,
  min: o,
  max: i,
  initial: a,
  step: c.step ?? (i - o) / 1e3,
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
function Te(e, t, n) {
  return O(
    e,
    t,
    "Output Trim",
    "Trim",
    Ge,
    At,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const ds = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], us = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], fs = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: Ie.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      O("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(se), quick: !0 }),
      O("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      O("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      O("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      Te("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: Ie.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      O("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [se("Classic", 0), se("Harmonics", 1)] }),
      O("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      O("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      O("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      O("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      O("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      O("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [se("Symmetric", 0), se("Asymmetric", 1), se("Wavefold", 2)] }),
      Te("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: Ie.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      O("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      O("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      O("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      O("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      O("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      Te("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: Ie.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      O("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(se) }),
      O("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(se) }),
      O("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      O("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      O("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      O("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      O("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      Te("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: Ie.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      O("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      O("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      O("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      O("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      O("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      Te("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: Ie.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      O("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [se("Free", 0), se("Sync", 1)] }),
      O("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      O("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: ds.map(se) }),
      O("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      O("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      O("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      O("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      O("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      Te("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: Ie.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      O("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [se("Free", 0), se("Sync", 1)] }),
      O("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      O("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: us.map(se) }),
      O("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      O("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      O("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      Te("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: Ie.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      O("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      O("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      O("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      O("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      Te("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Vt = fs, _i = Object.freeze(
  Vt.flatMap((e) => e.parameters)
);
new Map(
  _i.map((e) => [e.endpointID, e])
);
function Di(e) {
  const t = Vt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Li() {
  return _i;
}
function Pn(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const $ = ["A", "B", "C"], Ni = [
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
], ms = [
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
], Ue = Object.freeze([
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
]), hs = Object.freeze([
  ...$.flatMap((e) => Ni.map(
    (t) => `osc${e}.${t}`
  )),
  ...ms
]);
new Set(
  $.flatMap((e) => Ni.map(
    (t) => `osc${e}.${t}`
  ))
);
const Ci = Object.freeze(
  hs.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), ps = Li().filter(
  (e) => e.modulationTargetIndex !== null
), gs = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Fn(e) {
  const t = vs(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function vs(e) {
  const t = gs.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const ys = [
  ...ps.map((e) => ({
    kind: Fn(Pn(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Pi = Object.freeze(
  ys.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), Re = Object.freeze([
  ...Ci,
  ...Pi
]), St = Ue.length, Fi = Ci.length, $t = Pi.length, bs = St * Re.length, Ss = new Map(Ue.map((e) => [e.id, e])), Ki = new Map(Ue.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), et = new Map(Re.map((e) => [e.kind, e]));
function Is() {
  if (St !== 14 || Fi !== 59 || $t !== 47 || bs !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = Ue.filter((r) => r.group === e).sort((r, o) => r.runtimeIndex - o.runtimeIndex);
    if (n.length !== t || n.some((r, o) => r.runtimeIndex !== o))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = Re.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, o) => r.runtimeIndex !== o))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (Ss.size !== St || Ki.size !== St || et.size !== Re.length)
    throw new Error("Modulation identities must be unique");
}
Is();
function Ui(e, t) {
  const n = Ki.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function Kn(e) {
  return typeof e != "string" ? null : et.has(e) ? e : null;
}
function Ts(e) {
  const t = Kn(e);
  return t !== null && et.get(t)?.group === "voice" ? t : null;
}
function Un(e) {
  const t = Kn(e);
  return t !== null && et.get(t)?.group === "rack" ? t : null;
}
function ks(e) {
  const t = et.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function zi(e) {
  const t = et.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Es(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const ji = 4, As = ji * $t, Rs = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), xs = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ze(e) {
  if (typeof e != "string")
    return null;
  const t = xs.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Rs.get(n);
  if (r === void 0)
    return null;
  const o = t[3];
  return r.includes(o) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function zn(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function Vi(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function $i(e) {
  if (e === null)
    return null;
  const t = Vi(e) - 1;
  return t > ji ? null : t * $t + zi(zn(e));
}
function ws(...e) {
  return { ...ki(...e), format: "cosimo.mseg.shape" };
}
function Sr(...e) {
  return { ...jt(...e), format: "cosimo.mseg.shape" };
}
function Ir(...e) {
  return { ...Ei(...e), format: "cosimo.mseg.playback" };
}
function Ms(...e) {
  return { ...$a(...e), format: "cosimo.mseg.playback" };
}
const Qt = "modulationProgram", Os = "modulationAmount", Bi = Ue.filter((e) => e.group === "voice").length, qi = Ue.filter((e) => e.group === "macro").length, Rt = Fi, _s = $t, xt = _s + As, Ne = Bi * Rt, $e = qi * Rt, Ds = Bi * xt, Ls = qi * xt, _e = 512, Ve = 256, Hi = Ne + $e;
function Ns(e) {
  const t = Ui(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function Cs(e) {
  const t = Ts(e);
  return t === null ? null : ks(t);
}
function Wi(e) {
  const t = Cs(e.targetKind), n = Un(e.targetKind);
  let r = n === null ? void 0 : zi(n);
  if (r === void 0) {
    const a = $i(
      ze(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Ui(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const c = a.runtimeIndex;
    if (t !== null) {
      const d = c * Rt + t;
      return {
        path: "macroVoice",
        cellIndex: d,
        sourceIndex: c,
        targetIndex: t,
        articulationCellIndex: Ne + d
      };
    }
    const s = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: c * xt + s,
      sourceIndex: c,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const o = Ns(e);
  if (t !== null) {
    const a = o * Rt + t;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: o,
      targetIndex: t,
      articulationCellIndex: a
    };
  }
  const i = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: o * xt + i,
    sourceIndex: o,
    targetIndex: i,
    articulationCellIndex: null
  };
}
function Gi(e) {
  return ze(e.targetKind) !== null ? null : Wi(e).articulationCellIndex;
}
function Ps(e) {
  if (Un(e.targetKind) !== null)
    return !1;
  const t = ze(e.targetKind);
  return t !== null && $i(t) === null;
}
function Fs(e) {
  return {
    ...Wi(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function Yi(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Ps(n))
      continue;
    const r = Fs(n), o = t[r.path];
    if (o.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    o.set(r.cellIndex, r);
  }
  return t;
}
function Ks(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function Be(e) {
  return [...e.values()].filter(Ks).sort((t, n) => t.cellIndex - n.cellIndex);
}
function ht(e, t, n, r, o) {
  for (let i = 0; i < e.length; i += 1) {
    const a = e[i];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${i}`);
    t[i] = a.cellIndex, n[i] = a.sourceIndex, r[i] = a.targetIndex, o[i] = a.polarity;
  }
}
function Xt(e) {
  const t = Yi(e), n = Be(t.voice), r = Be(t.macroVoice), o = Be(t.voiceRack), i = Be(t.macroRack), a = Array.from({ length: Ne }, () => 0), c = Array.from({ length: Ne }, () => 0), s = Array.from({ length: Ne }, () => 0), d = Array.from({ length: Ne }, () => 0), l = Array.from({ length: Ne }, () => 0);
  ht(n, a, c, s, d);
  const p = Array.from({ length: $e }, () => 0), g = Array.from({ length: $e }, () => 0), y = Array.from({ length: $e }, () => 0), T = Array.from({ length: $e }, () => 0), k = Array.from({ length: $e }, () => 0);
  if (ht(
    r,
    p,
    g,
    y,
    T
  ), o.length > _e || i.length > Ve)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${_e}), ${i.length} macro-rack (max ${Ve})`
    );
  const S = Array.from({ length: _e }, () => 0), E = Array.from({ length: _e }, () => 0), w = Array.from({ length: _e }, () => 0), A = Array.from({ length: _e }, () => 0), K = Array.from({ length: _e }, () => 0), j = Array.from({ length: Ds }, () => 0);
  ht(
    o,
    S,
    E,
    w,
    A
  );
  const U = Array.from({ length: Ve }, () => 0), h = Array.from({ length: Ve }, () => 0), f = Array.from({ length: Ve }, () => 0), m = Array.from({ length: Ve }, () => 0), b = Array.from({ length: Ls }, () => 0);
  ht(
    i,
    U,
    h,
    f,
    m
  );
  for (const u of t.voice.values()) l[u.cellIndex] = u.amount;
  for (const u of t.macroVoice.values()) k[u.cellIndex] = u.amount;
  for (const u of t.voiceRack.values()) j[u.cellIndex] = u.amount;
  for (const u of t.macroRack.values()) b[u.cellIndex] = u.amount;
  for (let u = 0; u < o.length; u += 1) {
    const v = o[u];
    if (v === void 0) throw new Error(`Missing compiled voice-rack route at index ${u}`);
    K[u] = v.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: c,
    voiceRouteTargets: s,
    voiceRoutePolarities: d,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: p,
    macroVoiceRouteSources: g,
    macroVoiceRouteTargets: y,
    macroVoiceRoutePolarities: T,
    macroVoiceRouteAmounts: k,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: S,
    voiceRackRouteSources: E,
    voiceRackRouteTargets: w,
    voiceRackRoutePolarities: A,
    voiceRackRouteReducers: K,
    voiceRackRouteAmounts: j,
    macroRackRouteCount: i.length,
    macroRackRouteCells: U,
    macroRackRouteSources: h,
    macroRackRouteTargets: f,
    macroRackRoutePolarities: m,
    macroRackRouteAmounts: b
  };
}
const Us = ["voice", "macroVoice", "voiceRack", "macroRack"], zs = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Tr(e) {
  return Yi(e);
}
function js(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function Vs(e, t) {
  if (e === null)
    return [{ endpointID: Qt, value: Xt(t) }];
  const n = Tr(e), r = Tr(t), o = [];
  for (const i of Us) {
    const a = Be(n[i]), c = Be(r[i]);
    if (a.length !== c.length)
      return [{ endpointID: Qt, value: Xt(t) }];
    for (let s = 0; s < c.length; s += 1) {
      const d = a[s], l = c[s];
      if (d === void 0 || l === void 0 || !js(d, l))
        return [{ endpointID: Qt, value: Xt(t) }];
      d.amount !== l.amount && o.push({
        endpointID: Os,
        value: {
          pathKind: zs[i],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return o;
}
function tt(e) {
  return { _tag: "ok", value: e };
}
function st(e) {
  return { _tag: "err", error: e };
}
function $s(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Bs(e) {
  throw new Error(e ?? "Invariant violated");
}
const qs = "globalTune", Hs = "globalTuneSemitones", ke = -24, nt = 24, kr = 0, Ji = -48, Qi = 48, vn = -48, Xi = 6, jn = 0, Er = (jn - vn) / (Xi - vn), Ws = "voiceEnhancerFrequency", Gs = "voiceEnhancerQ", Ys = "voiceEnhancerAmount", Js = "voiceEnhancerFrequencyOctaves", Qs = "voiceEnhancerQ", Xs = "voiceEnhancerAmount", Zi = "voice.enhancerFrequency", Zs = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Ws,
    targetKind: Js,
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
    endpointID: Gs,
    targetKind: Qs,
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
    endpointID: Ys,
    targetKind: Xs,
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
function Ar(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function ec(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function pt(e, t, n, r, o = "percent", i = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: o, compound: i };
}
const tc = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      pt("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      pt("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      pt("mix", "Mix", 100, 100),
      pt("drive", "Drive", 15, 0)
    ]
  }
], Rr = 1e-6;
function fe(e, t) {
  if (!Number.isFinite(e) || e < -Rr || e > 1 + Rr)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function wt(e, t) {
  return fe(e / 100, `${t} catalog percentage`);
}
function dt(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function nc(e) {
  return 20 * 1e3 ** e;
}
function rc(e) {
  return fe(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ic(e) {
  return 0.1 * 200 ** e;
}
function oc(e) {
  return fe(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ac(e) {
  return e;
}
function sc(e) {
  return fe(e, "filterMix endpoint conversion");
}
function Ye(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function cc(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Ye("filterCutoff", nc, rc),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ye("filterQ", ic, oc),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ye("filterMix", ac, sc),
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
function eo(e) {
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
      return $s(e);
  }
}
function lc(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function dc(e, t) {
  const n = dt(e.moduleId, t.id), r = eo(t.format), o = cc(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: wt(t.defaultPercent, n),
    initialValue: wt(t.initialPercent, n),
    format: r,
    modAmount: lc(r),
    binding: o.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const uc = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Er * 100, defaultPercent: Er * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function fc(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function mc(e, t) {
  const n = `osc${e}`, r = dt(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: wt(t.defaultPercent, r),
    initialValue: wt(t.initialPercent, r),
    format: eo(t.format),
    modAmount: fc(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const hc = Object.freeze(
  $.flatMap((e) => uc.map((t) => mc(e, t)))
), pc = Object.freeze({
  targetId: dt("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: fe(
    (kr - ke) / (nt - ke),
    "Global Tune default"
  ),
  initialValue: fe(
    (kr - ke) / (nt - ke),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: nt },
  modAmount: {
    min: Ji,
    max: Qi,
    unit: "st",
    digits: 2
  },
  binding: Ye(
    qs,
    (e) => ke + (nt - ke) * e,
    (e) => fe(
      (e - ke) / (nt - ke),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Hs
});
function gc(e) {
  const t = dt("voice-enhancer", e.key), n = fe(
    Ar(e, e.initial),
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
      (r) => ec(e, r),
      (r) => fe(
        Ar(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const vc = Object.freeze(
  Object.values(Zs).map(gc)
), yc = Object.freeze([
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
function bc(e) {
  const t = dt(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (i) => e.min + n * i, o = (i) => fe(
    (i - e.min) / n,
    `${e.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: t,
    moduleId: e.moduleId,
    workspace: "voice",
    label: e.label,
    defaultValue: o(e.initial),
    initialValue: o(e.initial),
    format: e.format === "time" ? { kind: "time", minSeconds: e.min, maxSeconds: e.max } : { kind: "percent" },
    modAmount: e.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: Ye(e.endpointID, r, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const Sc = Object.freeze(
  yc.map(bc)
), Ic = Object.freeze([
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
function Tc(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function Zt(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? cs(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return fe(n, `${e.endpointID} endpoint conversion`);
}
function kc(e, t) {
  return e.valueKind === "effect-output-trim-db" ? ls(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function Ec(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Ac(e) {
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
function Rc(e) {
  const t = Tc(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: Zt(e, e.initial),
    initialValue: Zt(e, e.initial),
    format: Ec(e),
    modAmount: Ac(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => kc(e, n),
      fromEngine: (n) => Zt(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : Fn(Pn(e))
  });
}
const Vn = Object.freeze(
  [
    ...Vt.flatMap((e) => e.parameters.map(Rc)),
    ...Ic,
    pc,
    ...vc,
    ...hc,
    ...Sc,
    ...tc.flatMap(
      (e) => e.parameters.map(
        (t) => dc(e, t)
      )
    )
  ]
), xc = new Map(
  Vn.map((e) => [e.targetId, e])
), to = Vn.filter(
  (e) => e.modulationTargetKind !== null
), yn = new Map(
  to.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (xc.size !== Vn.length)
  throw new Error("Target descriptor IDs must be unique");
if (to.length !== Re.length || yn.size !== Re.length || Re.some((e) => yn.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function en(e) {
  const t = yn.get(e);
  return t === void 0 ? Bs(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  Vt.map((e) => [e.id, e.label])
);
function wc(e) {
  const t = Vi(e);
  return t === 1 ? "" : ` ${t}`;
}
function Mc(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = en(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = ze(e);
  if (n !== null) {
    const r = en(zn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${wc(n)} ${r.label.toUpperCase()}`;
  }
  return en(e).label.toUpperCase();
}
const qe = "modulation.v6", no = 6, ut = 3, He = 3, Oc = 4, xr = "modulationMsegBuffer", _c = "modulationMsegPlayback", ro = 4, Dc = ["MSEG 1", "MSEG 2", "MSEG 3"], io = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Lc = ["Env 1", "Env 2", "Env 3"], Nc = 1e-3, q = 10, Cc = 0.1, Pc = 20, wr = 10 - 0.1, Fc = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Pc - Cc },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Ji,
    max: Qi
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
  mseg1Rate: { min: -Le, max: Le },
  mseg2Rate: { min: -Le, max: Le },
  mseg3Rate: { min: -Le, max: Le },
  env1Attack: { min: -q, max: q },
  env1Decay: { min: -q, max: q },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -q, max: q },
  env2Attack: { min: -q, max: q },
  env2Decay: { min: -q, max: q },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -q, max: q },
  env3Attack: { min: -q, max: q },
  env3Decay: { min: -q, max: q },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -q, max: q },
  ampAttack: { min: -q, max: q },
  ampDecay: { min: -q, max: q },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -q, max: q },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -wr, max: wr },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Kc = Li().filter((e) => e.modulationTargetIndex !== null), Uc = new Map(
  Kc.map((e) => [
    Fn(Pn(e)),
    e
  ])
);
class tn extends Error {
  name = "ModulationStateParseError";
}
const zc = {
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
Ue.map((e) => ({
  value: e.id,
  label: zc[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const jc = Re.map((e) => ({
  value: e.kind,
  label: Mc(e.kind)
}));
jc.filter((e) => !$c(e.value));
function Vc(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function $n(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function nn(e, t) {
  const n = Number(e);
  return $n(Number.isFinite(n) ? n : t, Nc, q);
}
function $c(e) {
  return Un(e) !== null;
}
function Bc(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function qc(e) {
  const t = ze(e);
  return t !== null ? zn(t) : e;
}
function Hc(e) {
  const t = qc(e);
  if (ze(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Uc.get(t);
  return n !== void 0 ? Bc(n) : Fc[Es(t)];
}
function Wc(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Gc(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function Yc(e, t) {
  const n = Hc(e), r = Number(t);
  return $n(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Jc(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Qc(e) {
  return Jc(e) ?? "mseg";
}
function Xc(e) {
  const t = Kn(e);
  return t !== null ? t : ze(e) !== null ? e : null;
}
function Zc(e) {
  return Xc(e) ?? "oscA.wavetablePosition";
}
function el(e, t) {
  const n = io[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function tl(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? ut : e === "macro" ? ro : Oc;
  return $n(Number.isFinite(n) ? n : 1, 1, r);
}
function We(e) {
  return {
    name: Lc[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function oo(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = We(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: nn(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: nn(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Pe(n.sustain ?? r.sustain),
    releaseSeconds: nn(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function nl(e, t = 0) {
  return { name: oo(e, t).name };
}
function rl(e, t, n, r) {
  const o = Number(e.amount);
  return {
    id: Wc(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: tl(n, e.sourceSlot),
    polarity: Gc(e.polarity),
    targetKind: r,
    amount: Yc(r, o),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function il(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, o = Qc(r.sourceKind), i = Zc(r.targetKind);
  return rl(r, t, o, i);
}
function ol(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function al(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => il(n, r));
}
function sl(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const o = ol(r);
    if (t.has(r.id) || n.has(o))
      return !1;
    t.add(r.id), n.add(o);
  }
  return !0;
}
function bn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, c) => bn(a, t[c]));
  const n = e, r = t, o = Object.keys(n), i = Object.keys(r);
  return o.length === i.length && o.every((a) => Vc(r, a) && bn(n[a], r[a]));
}
function ao(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = ws(Dc[t] ?? `MSEG ${t + 1}`), o = Sr(n.shapeA ?? r), i = Ms({
    ...Ir(),
    ...n.playback ?? {},
    rate: Ir().rate
  }), { rate: a, ...c } = i;
  return {
    shapeA: o,
    shapeB: Sr(n.shapeB ?? o),
    playback: c
  };
}
function Mt() {
  return {
    format: "cosimo.modulation",
    version: no,
    msegSlots: Array.from({ length: ut }, (e, t) => ao({}, t)),
    envelopeSlots: Array.from({ length: He }, (e, t) => ({
      name: We(t).name
    })),
    routes: [],
    macroNames: io.slice()
  };
}
function cl(e = Mt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], o = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: no,
    msegSlots: Array.from({ length: ut }, (i, a) => ao(n[a], a)),
    envelopeSlots: Array.from({ length: He }, (i, a) => nl(r[a], a)),
    routes: al(t.routes),
    macroNames: Array.from(
      { length: ro },
      (i, a) => el(o[a], a)
    )
  };
}
function rn(e) {
  const t = Ot(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function Ot(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return st(new tn("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return st(new tn("Expected valid modulation JSON"));
    }
  }
  const n = cl(t);
  return !bn(t, n) || !sl(n.routes) ? st(new tn("Expected the current modulation schema")) : tt(n);
}
function ll(e, t) {
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
function Mr(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Ya(n))
  };
}
function dl(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function Or(e, t = null, n) {
  const r = [];
  for (let o = 0; o < ut; o += 1) {
    const i = e.msegSlots[o], a = t?.msegSlots[o];
    (a === void 0 || !vr(a.shapeA, i.shapeA)) && r.push(n ? n(o, 0, i.shapeA) : {
      endpointID: xr,
      value: Mr(o, 0, i.shapeA)
    }), (a === void 0 || !vr(a.shapeB, i.shapeB)) && r.push(n ? n(o, 1, i.shapeB) : {
      endpointID: xr,
      value: Mr(o, 1, i.shapeB)
    }), (a === void 0 || !dl(a.playback, i.playback)) && r.push({
      endpointID: _c,
      value: ll(o, i.playback)
    });
  }
  return r.push(...Vs(t?.routes ?? null, e.routes)), r;
}
function so(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) so(t);
    Object.freeze(e);
  }
}
const ul = {
  parse(e) {
    const t = Ot(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (so(t.value), { kind: "ok", value: t.value });
  },
  encode: rn,
  equals: (e, t) => rn(e) === rn(t)
}, on = "articulationSnapshot", G = 128, _r = 48, fl = 1e6, ee = -1, an = [
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
function Bn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function sn(e) {
  return Bn(Number.isFinite(e) ? e : 0, 0, 1);
}
function te(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const o = Number(e);
  return Bn(Number.isFinite(o) ? o : t, n, r);
}
function Z(e, t, n, r) {
  return Bn(Math.round(te(e, t)), n, r);
}
function co(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function cn() {
  return Array.from({ length: G }, () => ee);
}
function ml(e) {
  const t = Z(e, 0, 0, G - 1), n = an[t % an.length], r = Math.floor(t / an.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function hl() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: jn,
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
function pl(e) {
  const t = hl(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: te(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: te(n.pan, t.pan, -1, 1),
    octave: Z(n.octave, t.octave, -4, 4),
    semitone: Z(n.semitone, t.semitone, -12, 12),
    fineCents: te(n.fineCents, t.fineCents, -100, 100),
    volumeDb: te(
      n.volumeDb,
      t.volumeDb,
      vn,
      Xi
    ),
    mute: Z(n.mute, t.mute, 0, 1),
    solo: Z(n.solo, t.solo, 0, 1),
    warpMode: Z(n.warpMode, t.warpMode, 0, 4),
    warpAmount: te(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: Z(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: te(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: te(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: te(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: Z(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: te(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: te(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: te(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: te(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: te(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: Z(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: Z(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: Z(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: te(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: te(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      sn(Number(r[0])),
      sn(Number(r[1])),
      sn(Number(r[2]))
    ]
  };
}
function gl(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: te(t.amount, 0, -48, 48)
  } : null;
}
function vl(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(gl).filter((o) => o !== null) : [], r = /* @__PURE__ */ new Map();
  for (const o of n)
    r.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: pl(t.parameters),
    envelopes: [0, 1, 2].map((o) => oo(
      Array.isArray(t.envelopes) ? t.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...r.values()]
  };
}
function yl(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = Z(n.runtimeSlot, t, 0, G - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, i = typeof n.name == "string" && n.name.trim() ? n.name.trim() : ml(r);
  return {
    id: o,
    runtimeSlot: r,
    name: i,
    snapshot: vl(n.snapshot)
  };
}
function bl(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: Z(n.note, 0, 0, G - 1),
    articulationId: r
  } : null;
}
function Sl(e, t, n, r, o) {
  if (!e || typeof e != "object")
    return null;
  const i = e, a = typeof i.articulationId == "string" ? i.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let c = Z(i.min, o, o, G - 1), s = Z(i.max, c, o, G - 1);
  return s < c && ([c, s] = [s, c]), {
    id: typeof i.id == "string" && i.id.trim() ? i.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: c,
    max: s
  };
}
function Dr(e, t, n, r) {
  const o = Array.isArray(e) ? e : [], i = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < o.length; c += 1) {
    const s = Sl(
      o[c],
      t,
      c,
      n,
      r
    );
    !s || i.has(s.id) || (i.add(s.id), a.push(s));
  }
  return a;
}
function Il(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), o = [];
  for (const i of n) {
    const a = bl(i, t);
    !a || r.has(a.note) || (r.add(a.note), o.push(a));
  }
  return o;
}
function Tl(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = [];
  for (let s = 0; s < n.length && i.length < G; s += 1) {
    const d = yl(n[s], s);
    !d || r.has(d.runtimeSlot) || o.has(d.id) || (r.add(d.runtimeSlot), o.add(d.id), i.push(d));
  }
  const a = typeof t.selectedSlotId == "string" && i.some((s) => s.id === t.selectedSlotId) ? t.selectedSlotId : null, c = new Set(i.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: co(t.activeTriggerMode),
    slots: i,
    chainAssignments: Dr(t.chainAssignments, c, "chain", 0),
    keyAssignments: Il(t.keyAssignments, c),
    velocityAssignments: Dr(t.velocityAssignments, c, "velocity", 1)
  };
}
function Lr(e) {
  const t = (n) => $.map(() => n);
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
    volumeDbs: t(jn),
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
    msegMorphs: Array.from({ length: ut }, () => 0),
    routeAmounts: Array.from({ length: Hi }, () => 0),
    envelopeAttackSeconds: Array.from({ length: He }, (n, r) => We(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: He }, (n, r) => We(r).decaySeconds),
    envelopeSustain: Array.from({ length: He }, (n, r) => We(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: He }, (n, r) => We(r).releaseSeconds)
  };
}
function Nr(e, t, n) {
  for (const r of t) {
    const o = n.get(r.articulationId);
    if (o !== void 0)
      for (let i = r.min; i <= r.max; i += 1)
        e[i] === ee && (e[i] = o);
  }
}
function kl(e) {
  const t = Tl(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = cn(), o = cn(), i = cn();
  Nr(r, t.chainAssignments, n), Nr(i, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const c = n.get(a.articulationId);
    c === void 0 || o[a.note] !== ee || (o[a.note] = c);
  }
  return i[0] = ee, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: o,
    velocity: i
  };
}
function lo(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : kl(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: co(t.activeMode),
    chain: Array.from({ length: G }, (n, r) => Z(t.chain?.[r], ee, ee, G - 1)),
    key: Array.from({ length: G }, (n, r) => Z(t.key?.[r], ee, ee, G - 1)),
    velocity: Array.from({ length: G }, (n, r) => r === 0 ? ee : Z(t.velocity?.[r], ee, ee, G - 1))
  });
}
function El(e, t) {
  const n = lo(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const ue = "articulations.v4", qn = [
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
], Hn = [
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
], Al = [
  ...$.flatMap((e) => qn.map(
    (t) => `osc${e}.${t}`
  )),
  ...Hn
];
class uo extends Error {
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
function F(e) {
  return st(new uo("malformed", e));
}
function ft(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Wn(e, t, n) {
  const r = new Set(t);
  for (const o of t)
    if (!Object.hasOwn(e, o))
      return `${n} is missing field "${o}"`;
  for (const o of Reflect.ownKeys(e)) {
    if (typeof o != "string")
      return `${n} has a non-string field key`;
    if (!r.has(o))
      return `${n} has unexpected field "${o}"`;
  }
  return null;
}
function _t(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < G;
}
function Rl(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function xl(e) {
  return Al.some((t) => t === e);
}
function Cr(e, t) {
  if (!ft(e))
    return F(`${t} must be an object`);
  const n = Wn(e, ["min", "max"], t);
  return n !== null ? F(n) : _t(e.min) ? _t(e.max) ? e.min > e.max ? F(`${t}.min must be less than or equal to ${t}.max`) : tt({ min: e.min, max: e.max }) : F(`${t}.max must be an integer in 0..127`) : F(`${t}.min must be an integer in 0..127`);
}
function wl(e, t) {
  if (!ft(e))
    return F(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return F(`${t} has a non-string parameter id`);
    if (!xl(r))
      return F(`${t} has unknown parameter id "${r}"`);
    const o = e[r];
    if (typeof o != "number" || !Number.isFinite(o))
      return F(`${t}.${r} must be a finite number`);
    n[r] = o;
  }
  return tt(n);
}
function Ml(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Ol() {
  return {};
}
function _l(e, t, n) {
  if (!ft(e))
    return F(`${t} must be an object`);
  const r = Ol();
  for (const o of Reflect.ownKeys(e)) {
    if (typeof o != "string")
      return F(`${t} has a non-string route id`);
    const i = e[o];
    if (typeof i != "number" || !Number.isFinite(i) || Math.abs(i) > _r)
      return F(
        `${t}.${o} must be a finite route amount within ±${_r}`
      );
    if (!n.has(o))
      return F(`${t}.${o} does not name a current articulable mapping`);
    Ml(r, o, i);
  }
  return tt(r);
}
function Dl(e, t, n) {
  const r = `slots[${t}]`;
  if (!ft(e))
    return F(`${r} must be an object`);
  const o = Wn(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (o !== null)
    return F(o);
  if (typeof e.id != "string")
    return F(`${r}.id must be a string`);
  if (!_t(e.runtimeSlot))
    return F(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return F(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return F(`${r}.color must be a string`);
  if (!_t(e.key))
    return F(`${r}.key must be an integer in 0..127`);
  const i = Cr(e.velRange, `${r}.velRange`);
  if (i._tag === "err")
    return i;
  const a = Cr(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const c = wl(e.overrides, `${r}.overrides`);
  if (c._tag === "err")
    return c;
  const s = _l(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : tt({
    id: e.id,
    runtimeSlot: e.runtimeSlot,
    name: e.name,
    color: e.color,
    key: e.key,
    velRange: i.value,
    chainRange: a.value,
    overrides: c.value,
    routeAmounts: s.value
  });
}
const Ll = Object.fromEntries(
  qn.map((e, t) => [e, 2 ** t])
), Nl = Object.fromEntries(
  Hn.map((e, t) => [e, 2 ** t])
);
function Pr(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Cl(e, t) {
  return qn.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | Ll[r] : n, 0);
}
function Pl(e) {
  return Hn.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | Nl[n] : t, 0);
}
function Fl(e, t) {
  const n = (i, a) => Pr(e, `osc${i}.${a}`), r = (i) => Pr(e, i), o = Array.from(
    { length: Hi },
    () => fl
  );
  for (const [i, a] of Object.entries(e.routeAmounts)) {
    const c = t[i];
    c !== void 0 && (o[c] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: $.map((i) => Cl(e, i)),
    sharedOverrideMask: Pl(e),
    framePositions: $.map((i) => n(i, "framePosition")),
    pans: $.map((i) => n(i, "pan")),
    octaves: $.map((i) => n(i, "octave")),
    semitones: $.map((i) => n(i, "semitone")),
    fineCents: $.map((i) => n(i, "fineCents")),
    phases: $.map((i) => n(i, "phase")),
    phaseRandoms: $.map((i) => n(i, "phaseRandom")),
    retriggers: $.map((i) => n(i, "retrigger")),
    volumeDbs: $.map((i) => n(i, "volumeDb")),
    mutes: $.map((i) => n(i, "mute")),
    solos: $.map((i) => n(i, "solo")),
    warpModes: $.map((i) => n(i, "warpMode")),
    warpAmounts: $.map((i) => n(i, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: $.map((i) => n(i, "unisonVoices")),
    unisonDetunes: $.map((i) => n(i, "unisonDetune")),
    unisonBlends: $.map((i) => n(i, "unisonBlend")),
    unisonWidths: $.map((i) => n(i, "unisonWidth")),
    unisonDetuneModes: $.map((i) => n(i, "unisonDetuneMode")),
    unisonStackModes: $.map((i) => n(i, "unisonStackMode")),
    unisonWavetablePositionSpreads: $.map((i) => n(i, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: $.map((i) => n(i, "unisonWarpSpread")),
    msegMorphs: [
      r("msegMorph1"),
      r("msegMorph2"),
      r("msegMorph3")
    ],
    routeAmounts: o,
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
function Kl(e, t) {
  return e.slots.map((n) => Fl(n, t));
}
function Ul(e, t) {
  if (!ft(e))
    return F("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return F('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return st(new uo(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Wn(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return F(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return F("selectedSlotId must be null or a string");
  if (!Rl(e.activeTriggerMode))
    return F('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return F("slots must be an array");
  if (e.slots.length > G)
    return F(`slots must contain at most ${G} entries`);
  const r = [], o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const c = Dl(e.slots[a], a, t);
    if (c._tag === "err")
      return c;
    const s = c.value;
    if (o.has(s.id))
      return F(`slots[${a}].id duplicates "${s.id}"`);
    if (i.has(s.runtimeSlot))
      return F(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    o.add(s.id), i.add(s.runtimeSlot), r.push(s);
  }
  return e.selectedSlotId !== null && !o.has(e.selectedSlotId) ? F(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : tt({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function fo() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function zl(e) {
  const t = Array.from({ length: G }, () => ee), n = Array.from({ length: G }, () => ee), r = Array.from({ length: G }, () => ee);
  for (const o of e.slots) {
    n[o.key] === ee && (n[o.key] = o.runtimeSlot);
    for (let i = o.chainRange.min; i <= o.chainRange.max; i += 1)
      t[i] === ee && (t[i] = o.runtimeSlot);
    for (let i = o.velRange.min; i <= o.velRange.max; i += 1)
      r[i] === ee && (r[i] = o.runtimeSlot);
  }
  return r[0] = ee, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
async function jl(e, t, n, r = {}) {
  const o = e.sharedData;
  if (!o) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const i = o.reserve(t.input, t.byteLength), a = r.signal?.onAbort(() => o.cancel(i.id));
  try {
    if (n(i), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await o.commit(i.id), { cancel: () => o.cancel(i.id) };
  } catch (c) {
    throw o.cancel(i.id), c;
  } finally {
    a?.();
  }
}
const Vl = 3, $l = (4 + ct) * 4, Sn = "runtimeState";
function mo(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Bl = {
  endpointID: Sn,
  required: !0,
  mapValue: mo
}, Fr = "runtimeInstallAck", ho = "runtimeSyncRequest", In = 0, ql = 8e3, Dt = /* @__PURE__ */ new WeakMap(), po = 1e9;
let gt = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % po;
function Hl(e) {
  return gt = gt % po + 1, e === "modulation" ? -1e9 - gt : 1e9 + gt;
}
function Wl(e, t) {
  const n = e, r = Dt.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), Dt.set(n, r);
}
function Kr(e, t) {
  const n = e, r = Dt.get(n);
  r?.delete(t), r?.size === 0 && Dt.delete(n);
}
const Gl = [100, 250, 500, 1e3], vt = { _tag: "accepted" }, Yl = { _tag: "superseded" }, Jl = { _tag: "stopped" }, Ur = { _tag: "transport-timeout" };
function Ql(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, o = r.dspSessionId, i = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, c = r.rejectedSerial, s = r.rejectionReason, d = r.syncSerial;
  return ![
    o,
    i,
    a,
    c,
    s,
    d
  ].every((p) => typeof p == "number" && Number.isSafeInteger(p) && p >= -2147483648 && p <= 2147483647) || typeof o != "number" || typeof i != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number" || typeof d != "number" || o < 0 || i < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: i,
    acceptedArticulationSerial: a,
    rejectedSerial: c,
    rejectionReason: s,
    syncSerial: d
  };
}
function Xl(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class zr {
  #t;
  #e;
  #i;
  #d;
  #a = !1;
  #m = /* @__PURE__ */ new Set();
  #r = null;
  #c = null;
  #u = /* @__PURE__ */ new Set();
  #n = null;
  #h = 0;
  #s = /* @__PURE__ */ new Map();
  #p = 0;
  #o = !1;
  #l = 0;
  #g = /* @__PURE__ */ new Set();
  #T = this.#M.bind(this);
  constructor(t, n) {
    this.#t = t, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#i = r && r.length > 0 ? r : [...Gl], this.#d = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? ql)
    );
  }
  start() {
    if (!this.#o) {
      Wl(this.#t, this.#e);
      try {
        this.#p += 1, this.#o = !0, this.#c = null, this.#u.clear(), this.#t.addEndpointListener?.(Fr, this.#T);
      } catch (t) {
        throw this.#o = !1, Kr(this.#t, this.#e), t;
      }
    }
  }
  stop() {
    if (this.#o) {
      this.#o = !1;
      for (const t of this.#m) t();
      this.#t.removeEndpointListener?.(Fr, this.#T), Kr(this.#t, this.#e), this.#s.clear(), this.#c = null, this.#u.clear(), this.#I();
    }
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    if (n !== this.#r) {
      for (const r of this.#m) r();
      this.#r = n, this.#c = null, this.#u.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#s.clear(), this.#l += 1, this.#I();
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
    const t = this.#r, n = this.#p;
    return this.#o ? t === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#k(t, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(t) {
    if (!this.#o)
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
    const n = this.#r, r = this.#p;
    try {
      const o = await this.#k(
        n,
        r
      );
      if (o._tag !== "accepted")
        return o;
      let i = null;
      for (const a of t) {
        const c = await this.#x(
          a,
          n,
          r
        );
        if (c._tag === "rejected" && this.#e === "articulation") {
          i ??= c;
          continue;
        }
        if (c._tag !== "accepted")
          return c;
      }
      return i ?? vt;
    } finally {
      this.#a = !1;
    }
  }
  #E(t) {
    return this.#e === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #A(t, n) {
    const r = this.#E(t);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #R() {
    const t = this.getAcceptedFrontier();
    return this.#e === "modulation" ? t + 1 : t - 1;
  }
  async #k(t, n) {
    if (this.#c === t)
      return vt;
    const r = Hl(this.#e);
    this.#u.add(r);
    const o = Date.now() + this.#d;
    let i = 0;
    try {
      for (; ; ) {
        const a = this.#f(t, n);
        if (a)
          return a;
        if (this.#c === t)
          return vt;
        const c = o - Date.now();
        if (c <= 0)
          return Ur;
        const s = this.#l;
        this.#b(r), await this.#S(
          s,
          Math.min(this.#y(i), c)
        ), i += 1;
      }
    } finally {
      this.#u.delete(r);
    }
  }
  async #x(t, n, r) {
    const o = this.#R(), i = /* @__PURE__ */ new Set();
    let a = !1;
    const c = () => {
      a = !0;
      for (const l of i) l();
      i.clear();
    }, s = {
      get aborted() {
        return a;
      },
      onAbort(l) {
        return a ? l() : i.add(l), () => {
          i.delete(l);
        };
      }
    };
    this.#m.add(c);
    const d = async () => {
      this.#f(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: o, signal: s }) : this.#w(t.endpointID, Xl(t.value, n, o)));
    };
    try {
      let l = 0, p = 0, g = this.#h;
      for (await d(); ; ) {
        const y = this.#f(n, r);
        if (y)
          return y;
        const T = this.#v(n, o, g);
        if (T !== null)
          return T;
        const k = this.#l;
        await this.#S(
          k,
          this.#y(l)
        );
        const S = this.#v(
          n,
          o,
          g
        );
        if (S !== null)
          return S;
        let E = this.#l;
        for (this.#b(o); ; ) {
          const w = this.#f(n, r);
          if (w)
            return w;
          const A = await this.#S(
            E,
            this.#y(l)
          ), K = this.#v(
            n,
            o,
            g
          );
          if (K !== null)
            return K;
          if (A && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
            if (p >= 1)
              return Ur;
            g = this.#h, await d(), p += 1, l += 1;
            break;
          }
          if (A) {
            E = this.#l;
            continue;
          }
          A || (l += 1, E = this.#l, this.#b(o));
        }
      }
    } catch (l) {
      const p = this.#f(n, r);
      if (p) return p;
      throw l;
    } finally {
      c(), this.#m.delete(c);
    }
  }
  #v(t, n, r) {
    const o = this.#n;
    if (!o || o.dspSessionId !== t)
      return null;
    const i = this.#s.get(n);
    return i !== void 0 && i.version > r && i.acknowledgement.dspSessionId === t ? (this.#s.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...i.acknowledgement }
    }) : this.#A(o, n) ? (this.#s.delete(n), vt) : null;
  }
  #f(t, n) {
    return !this.#o || this.#p !== n ? Jl : this.#r !== t ? Yl : null;
  }
  #y(t) {
    return this.#i[Math.min(
      t,
      this.#i.length - 1
    )];
  }
  #w(t, n) {
    try {
      this.#t.sendEventOrValue?.(
        t,
        n,
        void 0,
        In
      );
    } catch {
    }
  }
  #b(t) {
    if (this.#o)
      try {
        this.#t.sendEventOrValue?.(
          ho,
          t,
          void 0,
          In
        );
      } catch {
      }
  }
  #M(t) {
    const n = Ql(t);
    if (!n || this.#r !== null && n.dspSessionId !== this.#r || this.#c === n.dspSessionId && this.#n?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#n.acceptedModulationSerial || n.acceptedArticulationSerial > this.#n.acceptedArticulationSerial))
      return;
    if (this.#u.has(n.syncSerial) && (this.#c = n.dspSessionId), this.#n = n, this.#h += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#s.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#h
      }); this.#s.size > 16; ) {
        const o = this.#s.keys().next().value;
        if (o === void 0) break;
        this.#s.delete(o);
      }
    this.#l += 1, this.#I();
  }
  #S(t, n) {
    return !this.#o || this.#l !== t ? Promise.resolve(!0) : new Promise((r) => {
      let o = !1;
      const i = {
        finish: (a) => {
          o || (o = !0, i.timeoutHandle !== null && clearTimeout(i.timeoutHandle), this.#g.delete(i), r(a));
        },
        timeoutHandle: null
      };
      i.timeoutHandle = setTimeout(() => i.finish(!1), n), this.#g.add(i);
    });
  }
  #I() {
    for (const t of [...this.#g])
      t.finish(!0);
  }
}
const Zl = 1e3, ed = [qe, ue];
function jr(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function ln(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (jr(r, t)) return r[t];
  if (jr(n, t)) return n[t];
}
function dn(e, t) {
  if (e === void 0) return fo();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = Ul(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Vr(e) {
  return new Set(e.routes.flatMap((t) => Gi(t) === null ? [] : [t.id]));
}
function $r(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Br(e, t) {
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
class td {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new zr(t, { laneKind: "modulation" }), this.articulationLane = new zr(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Mt();
  articulationBank = fo();
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
    { length: G },
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
    return this.frameworkInput ? [ue] : ed;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Sn, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Sn, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = ln(t, qe), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Mt() } : Ot(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${qe} is invalid; boot state was not installed.`);
      const a = ln(t, ue), c = dn(a, /* @__PURE__ */ new Set());
      c !== null && (this.articulationBank = c, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const o = ln(t, ue), i = dn(
      o,
      Vr(r.value)
    );
    if (i === null) {
      console.error(`[runtime-state-worker] ${ue} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0;
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
      const o = Ot(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${qe}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = dn(n, Vr(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ue}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = mo(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(ho, 0, void 0, In), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, o = this.articulationBank, i = this.deliveryObserver, c = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, s = this.frameworkInput?.curveCommand ? Or(r, c, this.frameworkInput.curveCommand) : Or(r, c), d = await this.modulationLane.sendBatch(s);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", d, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const S = Br("modulation", d);
      S && i?.(S), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, o)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, o), p = Array.from({ length: G }, (S, E) => {
      const w = l.get(E);
      return w ? $r(w) : null;
    }), g = this.lastAppliedArticulationGeneration !== n, y = g && this.articulationLane.getAcceptedFrontier() !== 0, T = [];
    for (let S = 0; S < G; S += 1) {
      const E = l.get(S), w = p[S] !== this.lastAppliedArticulationTokens[S];
      y ? T.push({
        endpointID: on,
        value: E ?? Lr(S)
      }) : g ? E && T.push({ endpointID: on, value: E }) : w && T.push({
        endpointID: on,
        value: E ?? Lr(S)
      });
    }
    const k = await this.articulationLane.sendBatch(T);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", k, p)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = p;
        const S = zl(o);
        if (this.frameworkInput) {
          const E = await this.frameworkInput.publishTriggerConfig(S);
          if (!this.started || t !== this.lifecycleEpoch) return;
          E.kind !== "cancelled" && i?.(E);
        } else
          El(S, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const E of T) this.lastAppliedArticulationTokens[E.value.selectorA] = void 0;
        const S = Br("articulation", k);
        S && i?.(S);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((o) => {
      const i = Gi(o);
      return i === null ? [] : [[o.id, i]];
    }));
    return new Map(
      Kl(n, r).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = $r(r), i = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, o), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), i && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Zl));
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
const nd = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [ue],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(e) {
    let t = qr(e);
    return {
      apply(n, r) {
        return t.closed && (t = qr(e)), t.apply(n, r);
      },
      stop() {
        t.stop();
      }
    };
  }
};
function qr(e) {
  let t = !1, n = 0, r;
  const o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function c(g) {
    const y = r;
    r = void 0, y ? y(g) : g.kind !== "cancelled" && e.report(g);
  }
  function s() {
    t || (t = !0, p.stop(), c({ kind: "cancelled" }), o.clear());
  }
  function d(g) {
    if (g.kind !== "submitted") {
      g.kind === "failed" && g.error.kind !== "transport" && (c(g), s());
      return;
    }
    o.add(g.completion), g.completion.then((y) => {
      o.delete(g.completion), !(t || y.kind === "sent") && (c(y), s());
    }, (y) => {
      t || (s(), e.fail(y));
    });
  }
  const l = {
    addEndpointListener(g, y) {
      const T = i.get(g) ?? /* @__PURE__ */ new Map();
      T.set(y, e.listen(g, y)), i.set(g, T);
    },
    removeEndpointListener(g, y) {
      i.get(g)?.get(y)?.(), i.get(g)?.delete(y);
    },
    addStoredStateValueListener(g) {
      a.set(g, e.subscribeStored(
        ue,
        (y) => g({ key: ue, value: y })
      ));
    },
    removeStoredStateValueListener(g) {
      a.get(g)?.(), a.delete(g);
    },
    requestFullStoredState(g) {
      e.readStored(ue).then((y) => {
        t || g({ values: { [ue]: y } });
      }, (y) => e.fail(y));
    },
    sendEventOrValue(g, y) {
      t || d(e.send({ kind: "event", endpoint: g, value: y }));
    }
  }, p = new td(l, {
    onDefect(g) {
      s(), e.fail(g);
    },
    curveCommand: (g, y, T) => ({
      async submit({ dspSessionId: k, deliverySerial: S, signal: E }) {
        const w = await e.prepareData(
          Vl + g * 2 + y,
          $l,
          (A) => {
            new Int32Array(A.buffer, A.byteOffset, 4).set([1297302855, k, S, ct]), Ai(T, new Float32Array(A.buffer, A.byteOffset + 16, ct));
          },
          E
        );
        w.kind === "failed" && (c(w), s());
      }
    }),
    async publishTriggerConfig(g) {
      const T = (await Promise.all(o)).find((S) => S.kind !== "sent");
      if (T) return T.kind === "failed" ? T : { kind: "cancelled" };
      if (t) return { kind: "cancelled" };
      const k = e.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: lo(g) });
      return k.kind === "submitted" ? k.completion : k;
    }
  });
  return {
    get closed() {
      return t;
    },
    apply(g, y) {
      if (t || y.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const T = ++n;
      return new Promise((k) => {
        const S = y.signal.onAbort(() => {
          c({ kind: "cancelled" }), s();
        });
        r = (E) => {
          S(), k(E);
        }, p.replaceModulation(g, (E) => {
          T === n && E.kind !== "preparing" && c(E);
        }), p.start();
      });
    },
    stop: s
  };
}
const rd = Ra({
  playMode: Gt("playMode"),
  glideTime: Gt("glideTime"),
  globalTune: Gt("globalTune"),
  [qe]: Ea({ initial: Mt(), codec: ul, prepare: (e) => e, engine: nd })
}), It = 2048;
function rt(e, t) {
  if (!e)
    throw new Error(t);
}
function id(e) {
  rt(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    rt(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), rt(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), rt(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), rt(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const od = 2048, Lt = 11, ad = 256;
function ge(e, t) {
  if (!e)
    throw new Error(t);
}
function sd(e) {
  return e > 0 && (e & e - 1) === 0;
}
const Hr = /* @__PURE__ */ new Map();
function cd(e) {
  const t = Hr.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let o = 0; o < e; o += 1) {
    let i = 0, a = o;
    for (let c = 0; c < n; c += 1)
      i = i << 1 | a & 1, a >>= 1;
    r[o] = i;
  }
  return Hr.set(e, r), r;
}
function go(e, t, n = !1) {
  const r = e.length;
  ge(r === t.length, "FFT real and imaginary buffers must have the same length"), ge(sd(r), "FFT input length must be a power of two");
  const o = cd(r);
  for (let i = 0; i < r; i += 1) {
    const a = o[i];
    if (a <= i)
      continue;
    const c = e[i];
    e[i] = e[a], e[a] = c;
    const s = t[i];
    t[i] = t[a], t[a] = s;
  }
  for (let i = 2; i <= r; i <<= 1) {
    const a = i >> 1, c = (n ? 2 : -2) * Math.PI / i, s = Math.cos(c), d = Math.sin(c);
    for (let l = 0; l < r; l += i) {
      let p = 1, g = 0;
      for (let y = 0; y < a; y += 1) {
        const T = l + y, k = T + a, S = e[k], E = t[k], w = p * S - g * E, A = p * E + g * S, K = e[T], j = t[T];
        e[T] = K + w, t[T] = j + A, e[k] = K - w, t[k] = j - A;
        const U = p * s - g * d;
        g = p * d + g * s, p = U;
      }
    }
  }
  if (n)
    for (let i = 0; i < r; i += 1)
      e[i] /= r, t[i] /= r;
}
function vo(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let i = 0; i < t.length; i += 1)
    n += Number(t[i]) || 0;
  const r = n / Math.max(1, t.length), o = new Float32Array(t.length);
  for (let i = 0; i < t.length; i += 1)
    o[i] = (Number(t[i]) || 0) - r;
  return o;
}
function ld(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = od,
  maxFramesPerTable: r = ad
} = {}) {
  const o = Float32Array.from(e);
  ge(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const i = o.length / n;
  ge(i > 0, "Source wavetable files must contain at least one frame"), ge(i <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && ge(i === t, `Source wavetable frame count mismatch: expected ${t}, got ${i}`);
  const a = [];
  for (let c = 0; c < i; c += 1) {
    const s = c * n, d = s + n;
    a.push(vo(o.slice(s, d)));
  }
  return {
    frameCount: i,
    frames: a
  };
}
function Wr(e) {
  const t = vo(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return go(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function yo(e, t, {
  mipLevelCount: n = Lt
} = {}) {
  const r = e?.real?.length ?? 0;
  ge(r > 0, "Spectrum must contain real samples"), ge(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), ge(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << t, r >> 1), i = new Float64Array(r), a = new Float64Array(r);
  for (let c = 1; c <= o; c += 1) {
    i[c] = e.real[c], a[c] = e.imaginary[c];
    const s = (r - c) % r;
    s !== c && (i[s] = e.real[s], a[s] = e.imaginary[s]);
  }
  return go(i, a, !0), Float32Array.from(i);
}
const bo = 13, Gn = 5, So = 8, dd = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Yn = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    le("globalFilter")
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
    le("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    le("ott")
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
    le("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    le("flanger")
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
    le("phaser")
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
    le("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    le("reverb")
  ]
}), Io = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), ud = Object.freeze([
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
]), fd = Object.freeze({
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
function md(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function To(e, t) {
  const n = {};
  for (const c of Yn[e]) {
    const s = t[c];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[c] = s;
      continue;
    }
    const d = fd[c];
    if (d === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${c}`);
    n[c] = d;
  }
  const o = [
    ...Io.chorus,
    le("chorus")
  ], i = Object.keys(t);
  return e === "chorus" && i.length === o.length && i.every((c) => o.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = md(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function ko(e) {
  return Yn[e];
}
function hd(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Gn)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * So + dd[e];
}
function pd(e, t) {
  const n = new Array(bo).fill(0), r = To(e, t);
  return Yn[e].forEach((o, i) => {
    n[i] = r[o];
  }), n;
}
const gd = "lane.v1", vd = "laneTopology", Gr = "laneSlotParams", yd = "laneOutputControl", Tn = 16, bd = 8, Eo = 4, Sd = 3, Ao = Gn * So, Ro = 4, Id = 4, Td = Ao, kd = Ao + Ro, Ed = 0, Ad = 1, Rd = 2, xd = 3, wd = 4, Md = 5;
function Od(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > Eo)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << bd;
}
const Nt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Ct = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), xo = new Map(
  Object.entries(Ct).map(([e, t]) => [t, e])
), _d = Object.freeze({
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
  Nt.map((e) => [_d[e], e])
);
const Dd = Object.freeze([
  "voice.filterCutoff",
  Zi,
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
]), Ld = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Zi]: "enhancer-frequency",
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
  Dd.map((e) => [e, Object.freeze({
    id: e,
    family: Ld[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const wo = 40, Mo = 18e3, kn = Nt.map((e) => Ct[e]), Nd = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Cd = /^(parallel|split)#([1-9][0-9]*)$/;
function Bt(e) {
  if (typeof e != "string")
    return null;
  const t = Nd.exec(e);
  if (t === null)
    return null;
  const n = kn.find((o) => o === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Gn ? null : { deviceType: n, instanceNumber: r };
}
function Oo(e) {
  if (typeof e != "string")
    return null;
  const t = Cd.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? Ro : Id) ? null : { groupKind: n, unitNumber: r };
}
function Ce(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Je(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function z(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function Pd(e, t) {
  const n = Bt(e);
  if (n === null)
    return { failure: z(`device id ${e} is not a pool instance`) };
  if (!Ce(t) || !Je(t, ["params"]) || !Ce(t.params))
    return { failure: z(`device ${e} must be { params }`) };
  const r = ko(n.deviceType), o = xo.get(n.deviceType);
  if (o === void 0)
    return { failure: z(`device ${e} has no effect descriptor`) };
  const i = Di(o).parameters.map((y) => y.endpointID), a = t.params, c = Object.keys(a), s = (y) => c.length === y.length && c.every((T) => y.includes(T)), d = le(n.deviceType), l = [
    ...Io[n.deviceType],
    d
  ], p = [
    ...ud,
    d
  ];
  if (!(c.includes(d) && (s(r) || s(i) || s(l) || n.deviceType === "chorus" && s(p))))
    return { failure: z(`device ${e} must carry every parameter once`) };
  for (const y of c) {
    const T = a[y];
    if (typeof T != "number" || !Number.isFinite(T))
      return { failure: z(`device ${e}.${y} must be a finite number`) };
  }
  return { record: { params: To(n.deviceType, a) } };
}
function Fd(e, t) {
  return !Ce(e) || e.kind !== "device" ? { failure: z("branches may hold device placements only") } : Je(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: z(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: z(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: z("a device placement is { kind, deviceId, enabled }") };
}
function Yr(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= wo && e <= Mo;
}
function _o() {
  return { mix: 1, bypassed: !1 };
}
function Kd(e) {
  return !Ce(e) || !Je(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function Ud(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (l) {
      const p = l instanceof Error ? l.message : String(l);
      return z(`is not valid JSON: ${p}`);
    }
  if (!Ce(t) || !Je(t, ["format", "version", "output", "devices", "chain"]))
    return z("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return z("must be cosimo.lane version 2");
  if (!Ce(t.devices))
    return z("devices must be an object");
  if (!Array.isArray(t.chain))
    return z("chain must be an array");
  const n = Kd(t.output);
  if (n === null)
    return z("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(t.devices)) {
    if (typeof l != "string")
      return z("device ids must be strings");
    const p = Pd(l, t.devices[l]);
    if ("failure" in p)
      return p.failure;
    r[l] = p.record;
  }
  const o = new Set(Object.keys(r)), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), c = [];
  let s = 0;
  const d = (l) => {
    const p = Fd(l, o);
    return "placement" in p && (i.set(
      p.placement.deviceId,
      (i.get(p.placement.deviceId) ?? 0) + 1
    ), s += 1), p;
  };
  for (const l of t.chain) {
    if (!Ce(l))
      return z("chain nodes must be objects");
    if (l.kind === "device") {
      const A = d(l);
      if ("failure" in A)
        return A.failure;
      c.push(A.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return z(`unknown chain node kind ${String(l.kind)}`);
    const p = l.kind === "split", g = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], T = p ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], k = p && Je(l, g);
    if (!Je(l, T) && !k)
      return z(`a ${l.kind} group is { ${T.join(", ")} }`);
    const S = Oo(l.groupId);
    if (S === null || S.groupKind !== l.kind)
      return z(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return z(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return z(`group ${String(l.groupId)} needs a boolean enable`);
    const E = p ? Sd : Eo;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > E)
      return z(`group ${String(l.groupId)} needs 2..${E} branches`);
    if (p && (!Yr(l.xoverLowHz) || !Yr(l.xoverHighHz)))
      return z(`group ${String(l.groupId)} crossovers must sit in ${wo}..${Mo} Hz`);
    if (p && !k && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return z(`group ${String(l.groupId)} Key Track state must be finite`);
    s += 1;
    const w = [];
    for (const A of l.branches) {
      if (!Array.isArray(A))
        return z(`group ${String(l.groupId)} branches must be arrays`);
      const K = [];
      for (const j of A) {
        const U = d(j);
        if ("failure" in U)
          return U.failure;
        K.push(U.placement);
      }
      w.push(K);
    }
    c.push(p ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: k ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: k ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: k ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: k ? 0 : l.xoverHighKeyTrackOffsetSemitones,
      branches: w
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: w
    });
  }
  for (const l of o)
    if ((i.get(l) ?? 0) !== 1)
      return z(`device ${l} must be placed exactly once`);
  return s > Tn ? z(`flattens to ${s} wire entries; the topology upload holds ${Tn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: c } };
}
function zd() {
  const e = {};
  for (const t of Nt) {
    const n = Ct[t];
    e[`${n}#1`] = {
      params: Wd(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: _o(),
    devices: e,
    chain: Nt.map((t) => ({
      kind: "device",
      deviceId: `${Ct[t]}#1`,
      enabled: !1
    }))
  };
}
const Jr = ["distortion#1", "delay#1", "reverb#1"];
function jd() {
  const e = zd(), t = {};
  for (const n of Jr) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: _o(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && Jr.includes(n.deviceId))
  };
}
function Vd(e) {
  if (e === void 0)
    return jd();
  const t = Ud(e);
  return t._tag === "ok" ? t.value : null;
}
function $d(e) {
  return Object.keys(e.devices).map((t) => {
    const n = Bt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => kn.indexOf(t.parsed.deviceType) - kn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function En(e) {
  const t = Bt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return hd(t.deviceType, t.instanceNumber - 1);
}
function Do(e) {
  const t = Oo(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Td : kd) + (t.unitNumber - 1);
}
function Bd(e) {
  const t = new Array(Tn).fill(0);
  let n = 0, r = 0;
  const o = (i, a, c) => {
    t[r] = Od(i, a), c && (n |= 1 << r), r += 1;
  };
  for (const i of e.chain) {
    if (i.kind === "device") {
      o(En(i.deviceId), 0, i.enabled);
      continue;
    }
    o(Do(i), i.branches.length, i.enabled), i.branches.forEach((a, c) => {
      for (const s of a)
        o(En(s.deviceId), c + 1, s.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function qd(e) {
  const t = new Array(bo).fill(0);
  return t[Ed] = e.xoverLowHz, t[Ad] = e.xoverHighHz, t[Rd] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[xd] = e.xoverLowKeyTrackOffsetSemitones, t[wd] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[Md] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function Hd(e) {
  const t = [{
    endpointID: yd,
    value: e.output
  }];
  let n = 0;
  for (const r of $d(e)) {
    const o = Bt(r.instanceId);
    if (o === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: ss(
        o.deviceType,
        o.instanceNumber
      ),
      value: e.devices[r.instanceId].params[le(o.deviceType)]
    }), n += 1, t.push({
      endpointID: Gr,
      value: {
        slotId: En(r.instanceId),
        deliverySerial: n,
        values: pd(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: Gr,
      value: {
        slotId: Do(r),
        deliverySerial: n,
        values: qd(r)
      }
    }));
  return t.push({
    endpointID: vd,
    value: Bd(e)
  }), t;
}
function Wd(e) {
  const t = xo.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = Di(t).parameters;
  return Object.fromEntries(ko(e).map((r) => [
    r,
    n.find((o) => o.endpointID === r)?.initial ?? 0
  ]));
}
function Gd(e) {
  return Ca(e, {
    stateKey: gd,
    runtimeEndpointDependencies: [Bl],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Vd,
    buildRuntimeEvents: ({ state: t }) => [...Hd(t)]
  });
}
const Tt = 256, it = 2048, Lo = 8, Yd = 12811, An = (Lo + Tt * Yd) * 4;
function Qr(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Jd(e, t, n) {
  if (e.byteLength !== An || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > Tt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    Lt,
    Tt
  ]);
  let o = Lo;
  const i = 131071, a = 8191, c = Math.fround(i / 1.5), s = Math.fround(a / 0.5);
  for (let d = 0; d < Lt; ++d) {
    const l = Math.min(it, Math.max(256, (1 << d) * 32)), p = it / l;
    for (let g = 0; g < t.frameCount; ++g) {
      const y = yo(n(g), d), T = o + g * (l + 1);
      for (let k = 0; k <= l; ++k) {
        const S = (k === l ? 0 : k) * p, E = (S + it - p) % it, w = (S + p) % it, A = y[S], K = y[E], j = y[w];
        if (A === void 0 || K === void 0 || j === void 0 || !Number.isFinite(A) || !Number.isFinite(K) || !Number.isFinite(j))
          throw new Error("Wavetable preparation produced invalid samples.");
        const U = Math.fround(0.5 * Math.fround(j - K));
        r[T + k] = Qr(A, c, i) & 262143 | Qr(U, s, a) << 18;
      }
    }
    o += (l + 1) * Tt;
  }
}
const Qd = "runtimeSyncRequest", Xd = 2147483647, Zd = "runtimeState", eu = "retryDesiredTableRequest", tu = "workerLoadFailure", nu = "serviceLoadAbort", ru = "wavetableLoadBegin", iu = "wavetableMipFrame", ou = "wavetableUploadAck", au = "wavetableMipRequest", su = "wavetablePrewarmRequest", cu = "wavetablePrewarmNotification", lu = "assets/factory-bank-catalog.json", Rn = 3, du = 1, uu = Rn * It, fu = 1, mu = 2, hu = 3, pu = 1, gu = 2, vu = 2e4, yt = fu, Xr = mu, Zr = hu, Ee = pu, ei = gu, yu = 48 * 1024 * 1024, un = 3;
function ti(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function Y(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function ni(e) {
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
function ri(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function ii(e, t) {
  if (!e)
    throw new Error(t);
}
function bu(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function Su(e, t) {
  return id(await e.readJSON(t));
}
function Iu(e) {
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
function Tu(e, t) {
  const n = Math.round(Number(e) || 0);
  return bu(n, 0, Math.max(0, t - 1));
}
function fn(e, t, n, r, o) {
  return `${e}:${t}:${n}:${r}:${o}`;
}
function ku(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function oi(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function ai(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function bt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Eu(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class Au {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = is(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? lu, this.maxBatchesInFlight = ti(
      n.maxFramesInFlight,
      du
    ), this.mipLevelCount = n.mipLevelCount ?? Lt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? yu) || 0)), this.serviceLoadTimeoutMs = ti(n.serviceLoadTimeoutMs, vu), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, Y("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Zd, this.handleRuntimeState), this.connection.addEndpointListener?.(ou, this.handleUploadAck), this.connection.addEndpointListener?.(au, this.handleMipRequest), this.connection.addEndpointListener?.(su, this.handlePrewarmRequest), this.connection.addEndpointListener?.(cu, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Qd,
      Xd
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Su(this.resourceClient, this.catalogPath), Y("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < un; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = oi(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      for (const [o, i] of this.tableCache)
        t.has(o) || (!r || i.lastUsedSerial < r.lastUsedSerial) && (n = o, r = i);
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
      byteCount: oi(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = fn(
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
          ...ai(this.serviceTable.frameCount),
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
    const { dspSessionId: t, oscillatorIndex: n, generation: r, tableIndex: o } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (Y("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: t,
        oscillatorIndex: n,
        generation: r,
        tableIndex: o,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: t,
          oscillatorIndex: n,
          generation: r,
          tableIndex: o
        },
        {
          failurePhase: Zr,
          failureReasonCode: ei
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== Zr || t.failureReasonCode !== ei ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: o = 0,
    candidateAttemptSerial: i = 0,
    failurePhase: a = yt,
    failureReasonCode: c = Ee
  }) {
    this.connection.sendEventOrValue?.(tu, {
      dspSessionId: t,
      oscillatorIndex: n,
      tableIndex: r,
      generation: o,
      candidateAttemptSerial: i,
      failurePhase: a,
      failureReasonCode: c
    });
  }
  emitServiceLoadAbort({
    dspSessionId: t,
    oscillatorIndex: n,
    generation: r,
    tableIndex: o,
    failureReasonCode: i = Ee
  }) {
    this.connection.sendEventOrValue?.(nu, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: o,
      failureReasonCode: i
    });
  }
  emitRetryDesiredTableRequest(t) {
    Y("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? ni(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(eu, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), o = Tu(t, r.tables.length), i = r.tables[o];
    ii(i, `Could not resolve table ${o}`);
    const a = ku(i, It, this.mipLevelCount), c = this.tableCache.get(a);
    if (c)
      return c.lastUsedSerial = this.cacheUseSerial++, Y("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: i.tableId,
        tableName: i.name,
        sourceWav: i.sourceWav,
        frameCount: c.frameCount,
        cacheBytes: this.tableCacheBytes
      }), c;
    const s = bt();
    Y("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(i.sourceWav), l = ld(d.samples, {
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n,
      samplesPerFrame: It
    });
    return Y("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(bt() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: i,
      frameCount: l.frameCount,
      frames: l.frames,
      spectra: new Array(l.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, r) {
    if (Y("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(ru, {
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
    const n = bt();
    try {
      if (await jl(this.connection, {
        input: t.oscillatorIndex,
        byteLength: An
      }, (r) => {
        Jd(r, t, (o) => this.getSpectrumForFrame(o));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      Y("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: An,
        preparationMs: bt() - n,
        sampleUploadBytes: 0
      });
    } catch (r) {
      if (this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      const o = this.candidateValidations[t.oscillatorIndex];
      o?.dspSessionId === t.dspSessionId && o.generation === t.generation && o.desiredIntentSerial === t.desiredIntentSerial && (this.candidateValidations[t.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: 0,
        tableIndex: t.tableIndex,
        candidateAttemptSerial: t.desiredIntentSerial,
        failurePhase: Xr,
        failureReasonCode: Ee
      }), this.serviceTable = null, this.clearMipTransferState(), Y("error", "Shared wavetable preparation failed", { detail: at(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    Y("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: yt,
      failureReasonCode: Ee
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: yt,
      failureReasonCode: Ee
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = yt,
    failureReasonCode: r = Ee
  } = {}) {
    Y("error", "Service wavetable load failed", {
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
      const i = this.candidateValidations[t.oscillatorIndex];
      return i && i.dspSessionId === t.dspSessionId && i.generation === t.generation && i.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(t.tableIndex);
    } catch (i) {
      return this.isCurrentRuntimeState(n) && (Y("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: at(i)
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
    const o = this.candidateValidations[t.oscillatorIndex];
    return o && o.dspSessionId === t.dspSessionId && o.generation === t.generation && o.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(t) {
    const n = t.desiredTableIndex, r = this.candidateValidations[t.oscillatorIndex];
    if (r && r.dspSessionId === t.dspSessionId && r.tableIndex === n && r.desiredIntentSerial === t.desiredIntentSerial)
      return;
    const o = Math.max(
      this.nextLoadGenerations[t.oscillatorIndex] ?? 1,
      t.generationFrontier + 1
    );
    let i = null;
    try {
      i = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(t) && (Y("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: at(a)
      }), this.handleCandidateLoadFailure(t));
      return;
    }
    !i || !this.isCurrentRuntimeState(t) || this.markCommittedDesiredLoad(t, o, i);
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
    for (let t = 0; t < un; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Eu(() => {
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
    const o = this.candidateValidations[n];
    if (o && o.dspSessionId === t.dspSessionId && o.generation > t.generationFrontier)
      return;
    const i = this.resolveServiceTarget(t);
    if (i) {
      if (!await this.prepareServiceTarget(i, t) || !this.isCurrentRuntimeState(t))
        return;
      if (i.kind === "loading" && t.desiredTableIndex !== i.tableIndex && !this.shouldStayIdleOnFailure(t)) {
        Y("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: i.dspSessionId,
          oscillatorIndex: n,
          generation: i.generation,
          staleTableIndex: i.tableIndex,
          desiredTableIndex: t.desiredTableIndex,
          desiredIntentSerial: t.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: i.dspSessionId,
          oscillatorIndex: n,
          generation: i.generation,
          tableIndex: i.tableIndex,
          failureReasonCode: Ee
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      i.kind === "active" && t.desiredTableIndex !== i.tableIndex && !this.shouldStayIdleOnFailure(t) && !r && await this.prepareDesiredCandidate(t);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(t)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(t), this.emitRetryDesiredTableRequest(n);
      return;
    }
    t.serviceState !== 0 || this.shouldStayIdleOnFailure(t) || await this.prepareDesiredLoad(t);
  }
  handleRuntimeState(t) {
    const n = Iu(t ?? {});
    if (Y("info", "Received runtime state", ni(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= un)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const o = n.oscillatorIndex, i = this.latestRuntimeStates[o], a = i ? this.getDesiredRetryKey(i) : null, c = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[o] = Math.max(
      this.nextLoadGenerations[o] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== c) && (this.autoRetryConsumedKeys[o] = null), this.latestRuntimeStates[o] = n, this.pendingRuntimeStateOscillators.add(o), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(t) {
    const n = t !== null && typeof t == "object" && !Array.isArray(t) ? t : null, r = Math.trunc(Number(n?.tableIndex ?? t));
    if (Number.isFinite(r))
      try {
        const o = await this.loadTableSource(r);
        for (let a = 0; a < o.frameCount; a += 1)
          o.spectra[a] || (o.spectra[a] = Wr(o.frames[a]));
        const i = this.tableCache.get(o.cacheKey);
        i && this.refreshCacheEntryByteCount(i), Y("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        Y("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: at(o)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), o = Math.trunc(Number(t?.generation)), i = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), c = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || i !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = fn(
      n,
      r,
      o,
      i,
      a
    );
    let d = this.mipJobs.get(s);
    return d ? (!d.completed && c > d.urgencyLevel && (d.urgencyLevel = c), d) : (d = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: o,
      tableIndex: i,
      mipIndex: a,
      urgencyLevel: c,
      ...ai(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, d), d);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (Y("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), i = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), c = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), l = fn(
      r,
      o,
      i,
      a,
      c
    ), p = this.mipJobs.get(l), g = this.serviceTable?.frameCount ?? 0, y = Math.min(
      Rn,
      g - s
    );
    if (!(!p || p.completed || !p.inFlightBatchBases.has(s) || d <= 0 || d !== y)) {
      p.inFlightBatchBases.delete(s);
      for (let T = 0; T < d; T += 1) {
        const k = s + T;
        p.ackedFrames[k] || (p.ackedFrames[k] = 1, p.ackedFrameCount += 1);
      }
      p.ackedFrameCount === g && p.nextFrameIndex >= g && p.inFlightBatchBases.size === 0 && (p.completed = !0, this.activeUploadKey === p.key && (this.activeUploadKey = null)), ri(s, d, g) && Y("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: o,
        generation: i,
        tableIndex: p.tableIndex,
        mipIndex: c,
        frameIndexBase: s,
        batchFrameCount: d,
        ackedFrameCount: p.ackedFrameCount,
        frameCount: g,
        inFlightBatches: p.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (ii(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = Wr(this.serviceTable.frames[t]);
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
        Rn,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(uu);
      try {
        for (let i = 0; i < r; i += 1) {
          const a = n + i, c = this.getSpectrumForFrame(a), s = yo(c, t.mipIndex);
          o.set(s, i * It);
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
            failurePhase: Xr,
            failureReasonCode: Ee
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(iu, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(o)
      }), ri(n, r, this.serviceTable.frameCount) && Y("info", "Sent wavetable mip batch", {
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
function at(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Ru(e, t = {}) {
  return new Au(e, t);
}
async function xu(e, t = {}) {
  return Ka(e, [
    Gd,
    () => Ru(e, { ...t, delivery: "shared" }),
    () => Oa(rd, e, {
      onDefect: (n) => console.error("Cosimo state failed", at(n))
    })
  ]);
}
export {
  du as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  mu as FAILURE_PHASE_BUILD_MIP,
  fu as FAILURE_PHASE_LOAD_SOURCE,
  hu as FAILURE_PHASE_TRANSFER_MIP,
  pu as FAILURE_REASON_GENERIC,
  gu as FAILURE_REASON_TIMEOUT,
  Rn as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Xd as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Au as WavetableWorkerController,
  Ru as createWavetableWorkerController,
  xu as default
};
