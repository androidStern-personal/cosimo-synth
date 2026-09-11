function mo() {
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
function Pn(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function Fn(e) {
  let t = !1, n, r;
  const i = /* @__PURE__ */ new Set();
  async function o(c, s, d) {
    const { signal: l } = d;
    if (e.onStatus(s, { kind: "preparing" }), l.aborted) return;
    const m = await Pn(e.prepare(c, l), l);
    if (m.kind === "cancelled" || l.aborted) return;
    const S = m.value;
    if (S.kind === "error") {
      e.onStatus(s, { kind: "failed", error: S.error });
      return;
    }
    let b = !0;
    d.applying = !0;
    let T;
    try {
      T = await Pn(e.transport.apply(S.value, {
        signal: l,
        send: (E) => l.aborted || !b ? { kind: "cancelled" } : E()
      }), l);
    } catch (E) {
      l.aborted || (t = !0, n?.cancel(), e.transport.stop(), e.onDefect(E), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      b = !1, d.applying = !1;
    }
    T.kind === "value" && !l.aborted && T.value.kind !== "cancelled" && e.onStatus(s, T.value);
  }
  function a(c, s) {
    r = void 0;
    const d = n, l = { ...mo(), applying: !1, target: s };
    if (n = l, d?.cancel(), t || l.signal.aborted) return;
    const m = o(c, s, l).catch((S) => {
      l.signal.aborted || (l.cancel(), e.onDefect(S), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    i.add(m), m.then(() => {
      if (i.delete(m), n !== l) return;
      n = void 0;
      const S = r;
      r = void 0, !t && S && a(S.input, S.target);
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
      t || (t = !0, r = void 0, n?.cancel(), e.transport.stop()), await Promise.all(i);
    }
  };
}
let ho = 0;
function Kn(e, t) {
  const n = `atom${++ho}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = po, r.write = go), r;
}
function po(e) {
  return e(this);
}
function go(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const zr = "a", fe = "m", At = "i", Ae = "c", mn = "q", hn = "Q", me = "h", jr = "R", Vr = "W", $r = "I", Br = "M", re = "e", Ke = "f", ke = "C", Ue = "r", pn = "d", kt = "w", Rt = "D", xt = "t", Mt = "T", gn = "v", Un = "g", zn = "s", jn = "b", vo = "B", vn = "p", Hr = "H", qr = "A", yn = "E";
function Wr(e) {
  return "init" in e;
}
function yo(e) {
  return typeof e.write == "function";
}
function Io(e) {
  return !!e.onMount;
}
function Vn(e) {
  return "v" in e || "e" in e;
}
function ft(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function mt(e) {
  return typeof e?.then == "function";
}
function So(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function Gr(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function Yr(e, t, n) {
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
function bo(e) {
  return !!e.INTERNAL_onInit;
}
const To = (e, t, n, ...r) => n.read(...r), Eo = (e, t, n, ...r) => n.write(...r), Ao = (e, t, n) => n.INTERNAL_onInit(t), ko = (e, t, n, r) => n.onMount?.(r), Ro = (e, t, n) => {
  const r = e[zr];
  let i = r.get(n);
  if (!i) {
    const o = e[me], a = e[$r];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), bo(n) && a(e, t, n);
  }
  return i;
}, xo = (e, t) => {
  const n = e[fe], r = e[Ae], i = e[mn], o = e[hn], a = e[me], c = e[ke];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const s = [], d = (l) => {
    try {
      l();
    } catch (m) {
      s.push(m);
    }
  };
  do {
    a.f && d(a.f);
    const l = /* @__PURE__ */ new Set();
    for (const m of r) {
      const S = n.get(m)?.l;
      if (S)
        for (const b of S)
          l.add(b);
    }
    r.clear();
    for (const m of o)
      l.add(m);
    o.clear();
    for (const m of i)
      l.add(m);
    i.clear();
    for (const m of l)
      d(m);
    r.size && c(e, t);
  } while (r.size || o.size || i.size);
  if (s.length)
    throw typeof AggregateError == "function" ? new AggregateError(s) : Object.assign(new Error(), { errors: s });
}, Mo = (e, t) => {
  const n = e[fe], r = e[At], i = e[Ae], o = e[re], a = e[Ue], c = e[Rt];
  if (!i.size)
    return;
  const s = [], d = [], l = /* @__PURE__ */ new WeakSet(), m = /* @__PURE__ */ new WeakSet(), S = [], b = [];
  for (const T of i)
    S.push(T), b.push(o(e, t, T));
  for (; S.length; ) {
    const T = S.length - 1, E = S[T], I = b[T];
    if (m.has(E)) {
      S.pop(), b.pop();
      continue;
    }
    if (l.has(E)) {
      r.get(E) === I.n && (s.push(E), d.push(I)), m.add(E), S.pop(), b.pop();
      continue;
    }
    l.add(E);
    for (const A of Yr(E, I, n))
      l.has(A) || (S.push(A), b.push(o(e, t, A)));
  }
  for (let T = s.length - 1; T >= 0; --T) {
    const E = s[T], I = d[T];
    let A = !1;
    for (const k of I.d.keys())
      if (k !== E && i.has(k)) {
        A = !0;
        break;
      }
    A && (r.set(E, I.n), a(e, t, E), c(e, t, E)), r.delete(E);
  }
};
const Oo = (e, t, n) => {
  const r = e[fe], i = e[At], o = e[Ae], a = e[me], c = e[jr], s = e[re], d = e[Ke], l = e[ke], m = e[Ue], S = e[Rt], b = e[gn], T = e[Hr], E = e[yn], I = s(e, t, n), A = E[0];
  if (Vn(I)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== I.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      I.m === A
    )
      return I.m = A, I;
    let f = !1;
    for (const [x, L] of I.d)
      if (m(e, t, x).n !== L) {
        f = !0;
        break;
      }
    if (!f)
      return I.m = A, I;
  }
  let k = !0;
  const R = new Set(I.d.keys()), P = () => {
    for (const f of R)
      I.d.delete(f);
  }, u = () => {
    if (r.has(n)) {
      const f = !o.size;
      S(e, t, n), f && (l(e, t), d(e, t));
    }
  }, h = (f) => {
    if (f === n) {
      const L = s(e, t, f);
      if (!Vn(L))
        if (Wr(f))
          b(e, t, f, f.init);
        else
          throw new Error("no atom init");
      return ft(L);
    }
    const x = m(e, t, f);
    try {
      return ft(x);
    } finally {
      R.delete(f), I.d.set(f, x.n), mt(I.v) && Gr(n, I.v, x), r.has(n) && r.get(f)?.t.add(n), k || u();
    }
  };
  let p;
  const v = {
    get signal() {
      return p || (p = new AbortController()), p.signal;
    }
  }, y = I.n, g = i.get(n) === y;
  try {
    const f = c(e, t, n, h, v);
    if (b(e, t, n, f), mt(f)) {
      T(e, t, f, () => p?.abort());
      const x = () => {
        P(), u();
      };
      f.then(x, x);
    } else
      P();
    return a.r?.(n), I.m = A, I;
  } catch (f) {
    if (So(f))
      throw f;
    return delete I.v, I.e = f, ++I.n, I.m = A, I;
  } finally {
    k = !1, I.n !== y && g && (i.set(n, I.n), o.add(n), a.c?.(n));
  }
}, wo = (e, t, n) => {
  const r = e[fe], i = e[At], o = e[re], a = [n];
  for (; a.length; ) {
    const c = a.pop(), s = o(e, t, c);
    for (const d of Yr(c, s, r)) {
      const l = o(e, t, d);
      i.get(d) !== l.n && (i.set(d, l.n), a.push(d));
    }
  }
}, _o = (e, t, n, r) => {
  const i = e[Ae], o = e[me], a = e[Vr], c = e[re], s = e[Ke], d = e[ke], l = e[Ue], m = e[pn], S = e[kt], b = e[Rt], T = e[gn], E = e[yn];
  let I = !0;
  const A = (R) => ft(l(e, t, R)), k = (R, ...P) => {
    const u = c(e, t, R);
    try {
      if (R === n) {
        if (!Wr(R))
          throw new Error("atom not writable");
        const h = u.n, p = P[0];
        T(e, t, R, p), b(e, t, R), h !== u.n && (++E[0], i.add(R), m(e, t, R), o.c?.(R));
        return;
      } else
        return S(e, t, R, P);
    } finally {
      I || (d(e, t), s(e, t));
    }
  };
  try {
    return a(e, t, n, A, k, ...r);
  } finally {
    I = !1;
  }
}, Do = (e, t, n) => {
  const r = e[fe], i = e[Ae], o = e[me], a = e[re], c = e[pn], s = e[xt], d = e[Mt], l = a(e, t, n), m = r.get(n);
  if (m && l.d.size > 0) {
    for (const [S, b] of l.d)
      if (!m.d.has(S)) {
        const T = a(e, t, S);
        s(e, t, S).t.add(n), m.d.add(S), b !== T.n && (i.add(S), c(e, t, S), o.c?.(S));
      }
    for (const S of m.d)
      l.d.has(S) || (m.d.delete(S), d(e, t, S)?.t.delete(n));
  }
}, Lo = (e, t, n) => {
  const r = e[fe], i = e[mn], o = e[me], a = e[Br], c = e[re], s = e[Ke], d = e[ke], l = e[Ue], m = e[kt], S = e[xt], b = c(e, t, n);
  let T = r.get(n);
  if (!T) {
    l(e, t, n);
    for (const E of b.d.keys())
      S(e, t, E).t.add(n);
    if (T = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(b.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, T), yo(n) && Io(n)) {
      const E = () => {
        let I = !0;
        const A = (...k) => {
          try {
            return m(e, t, n, k);
          } finally {
            I || (d(e, t), s(e, t));
          }
        };
        try {
          const k = a(e, t, n, A);
          k && (T.u = () => {
            I = !0;
            try {
              k();
            } finally {
              I = !1;
            }
          });
        } finally {
          I = !1;
        }
      };
      i.add(E);
    }
    o.m?.(n);
  }
  return T;
}, No = (e, t, n) => {
  const r = e[fe], i = e[hn], o = e[me], a = e[re], c = e[Mt], s = a(e, t, n);
  let d = r.get(n);
  if (!d || d.l.size)
    return d;
  let l = !1;
  for (const m of d.t)
    if (r.get(m)?.d.has(n)) {
      l = !0;
      break;
    }
  if (!l) {
    d.u && i.add(d.u), d = void 0, r.delete(n);
    for (const m of s.d.keys())
      c(e, t, m)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return d;
}, Co = (e, t, n, r) => {
  const i = e[re], o = e[qr], a = i(e, t, n), c = "v" in a, s = a.v;
  if (mt(r))
    for (const d of a.d.keys())
      Gr(n, r, i(e, t, d));
  a.v = r, delete a.e, (!c || !Object.is(s, a.v)) && (++a.n, mt(s) && o(e, t, s));
}, Po = (e, t, n) => {
  const r = e[Ue];
  return ft(r(e, t, n));
}, Fo = (e, t, n, ...r) => {
  const i = e[Ae], o = e[Ke], a = e[ke], c = e[kt], s = i.size;
  try {
    return c(e, t, n, r);
  } finally {
    i.size !== s && (a(e, t), o(e, t));
  }
}, Ko = (e, t, n, r) => {
  const i = e[Ke], o = e[ke], a = e[xt], c = e[Mt], d = a(e, t, n).l;
  return d.add(r), o(e, t), i(e, t), () => {
    d.delete(r), c(e, t, n), o(e, t), i(e, t);
  };
}, Uo = (e, t, n, r) => {
  const i = e[vn];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, zo = (e, t, n) => {
  e[vn].get(n)?.forEach((o) => o());
}, jo = /* @__PURE__ */ new WeakMap();
function Vo(e) {
  const t = {
    get(c) {
      return i(r, t, c);
    },
    set(c, ...s) {
      return o(r, t, c, ...s);
    },
    sub(c, s) {
      return a(r, t, c, s);
    }
  }, n = {
    // store state
    [zr]: /* @__PURE__ */ new WeakMap(),
    [fe]: /* @__PURE__ */ new WeakMap(),
    [At]: /* @__PURE__ */ new WeakMap(),
    [Ae]: /* @__PURE__ */ new Set(),
    [mn]: /* @__PURE__ */ new Set(),
    [hn]: /* @__PURE__ */ new Set(),
    [me]: {},
    // atom interceptors
    [jr]: To,
    [Vr]: Eo,
    [$r]: Ao,
    [Br]: ko,
    // building-block functions
    [re]: Ro,
    [Ke]: xo,
    [ke]: Mo,
    [Ue]: Oo,
    [pn]: wo,
    [kt]: _o,
    [Rt]: Do,
    [xt]: Lo,
    [Mt]: No,
    [gn]: Co,
    // store api
    [Un]: Po,
    [zn]: Fo,
    [jn]: Ko,
    [vo]: void 0,
    // abortable promise support
    [vn]: /* @__PURE__ */ new WeakMap(),
    [Hr]: Uo,
    [qr]: zo,
    // store epoch
    [yn]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  jo.set(t, r);
  const i = r[Un], o = r[zn], a = r[jn];
  return t;
}
function $o() {
  return Vo();
}
function Q(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function Jr(e, t = 1 / 0) {
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
function Qr() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= Jr(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Qt(e) {
  const t = Qr(), n = (r, i) => {
    if (!t.node(i)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const o of r) if (!n(o, i + 1)) return !1;
      return !0;
    }
    if (!Q(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function J(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function de(e) {
  return typeof e == "string" && e.length > 0 && Jr(e) <= 256;
}
function In(e) {
  return Q(e) && de(e.owner) && J(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function Bo(e) {
  if (!Q(e) || !J(e.id)) return;
  const t = In(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function Ho(e) {
  const t = In(e);
  return t && Q(e) && J(e.client) && J(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function $n(e) {
  if (!Q(e) || !Array.isArray(e.parameters) || !Q(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!Q(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s } = n;
    if (!de(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function qo(e) {
  if (Q(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = Bo(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (de(e.key)) {
      if (e.kind === "recover")
        return Object.hasOwn(e, "value") && e.expectedVersion === 0 && !Object.hasOwn(e, "gesture") ? { kind: "recover", key: e.key, value: e.value, expectedVersion: 0 } : void 0;
      if (e.kind === "begin" || e.kind === "end")
        return !J(e.gesture) || e.label !== void 0 && typeof e.label != "string" ? void 0 : e.kind === "end" ? { kind: "end", key: e.key, gesture: e.gesture } : { kind: "begin", key: e.key, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
      if (!(e.kind !== "edit" || !Object.hasOwn(e, "value")) && !(e.expectedVersion !== void 0 && !J(e.expectedVersion, !1)) && !(e.gesture !== void 0 && !J(e.gesture)))
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
function Wo(e) {
  if (!Qt(e) || !Q(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && J(e.request) && de(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && de(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = In(e.scope);
  if (e.kind === "opened" && t && J(e.request)) {
    const n = $n(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = $n(e.native);
    if (n && (e.changedStoredKey === void 0 || de(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && de(e.endpoint) && typeof e.value == "number")
    return { kind: "ok", value: { kind: "parameter", scope: t, endpoint: e.endpoint, value: e.value } };
  if (e.kind === "detach" && t && J(e.client) && J(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && J(e.request) && J(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = Ho(e.address);
    if (n) {
      const r = qo(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && J(e.request) && Q(e.result)) {
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && de(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function Bn(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, i]) => {
    const o = t.fields[r];
    return !o || !("value" in o) ? [r, o] : [r, { ...o, value: i.kind === "stored" ? i.codec.encode(o.value) : o.value }];
  }));
  return { ...t, fields: n };
}
function Hn(e) {
  const t = Qr(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
    if (t.node(a)) {
      if (o === null || typeof o == "boolean") return o;
      if (typeof o == "number") return Number.isFinite(o) ? o : void 0;
      if (typeof o == "string") return t.text(o) ? o : void 0;
      if (!(typeof o != "object" || n.has(o))) {
        n.add(o);
        try {
          if (Array.isArray(o) || o instanceof Float32Array || o instanceof Float64Array || o instanceof Int8Array || o instanceof Int16Array || o instanceof Int32Array || o instanceof Uint8Array || o instanceof Uint8ClampedArray || o instanceof Uint16Array || o instanceof Uint32Array) {
            if (!t.elements(o.length)) return;
            const s = [];
            for (const d of o) {
              const l = r(d, a + 1);
              if (l === void 0) return;
              s.push(l);
            }
            return s;
          }
          if (!Q(o)) return;
          const c = /* @__PURE__ */ Object.create(null);
          for (const s in o) {
            if (!Object.hasOwn(o, s)) continue;
            if (!t.text(s)) return;
            const d = r(o[s], a + 1);
            if (d === void 0) return;
            c[s] = d;
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
const Go = (e) => ({ kind: "failed", error: { kind: "transport", message: e } }), Yo = (e, t) => Q(e) && e.owner === t.owner && e.document === t.document;
function Jo(e, t = {}) {
  let n = 0, r = !1;
  const i = /* @__PURE__ */ new Map(), o = t.timeoutMs ?? 1e4;
  function a(d) {
    if (!Q(d) || typeof d.request != "number") return;
    const l = i.get(d.request);
    if (!(!l || !Yo(d.scope, l.scope))) {
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
  function s(d, l, m, S, b) {
    return r || S.aborted ? Promise.resolve({ kind: "cancelled" }) : new Promise((T) => {
      let E = () => {
      }, I;
      const A = (k) => {
        i.delete(d) && (clearTimeout(I), E(), T(k));
      };
      if (i.set(d, { scope: m, matches: b, finish: A }), E = S.onAbort(() => A({ kind: "cancelled" })), !!i.has(d)) {
        I = setTimeout(() => A({ kind: "failed", reason: "reply-timeout" }), o);
        try {
          c({ ...l, scope: m, request: d });
        } catch {
          A({ kind: "failed", reason: "connection-failed" });
        }
      }
    });
  }
  return {
    /** Takes exclusive read ownership until completion. The caller must not
     * mutate or reuse samples while pending; avoiding a second whole-value
     * copy depends on this same ownership rule as native resource adoption.
     */
    async replace(d, l, m, S) {
      if (r || S.aborted) return { kind: "cancelled" };
      if (!(l instanceof Float32Array) || !l.every(Number.isFinite))
        return { kind: "failed", error: { kind: "engine-rejected", message: "Shared data requires finite Float32 samples." } };
      const b = Object.freeze({ ...m.scope }), T = ++n;
      let E = !1;
      const I = (A) => A.kind === "cancelled" ? A : Go(A.kind === "failed" ? `Data delivery failed: ${A.reason}.` : "Unexpected data delivery reply.");
      try {
        const A = await s(
          T,
          { kind: "begin", input: d, generation: m.generation, sampleCount: l.length },
          b,
          S,
          (R) => R.kind === "ready"
        );
        if (A.kind !== "ready") return I(A);
        for (let R = 0; R < l.length; R += 8192) {
          const P = await s(
            ++n,
            {
              kind: "write",
              transfer: A.transfer,
              offset: R,
              samples: Array.from(l.subarray(R, R + 8192))
            },
            b,
            S,
            (u) => u.kind === "written" && u.transfer === A.transfer && u.offset === Math.min(R + 8192, l.length)
          );
          if (P.kind !== "written") return I(P);
        }
        const k = await s(
          ++n,
          { kind: "commit", transfer: A.transfer },
          b,
          S,
          (R) => R.kind === "applied" && R.transfer === A.transfer && R.input === d && R.generation === m.generation
        );
        return k.kind !== "applied" ? I(k) : (E = !0, { kind: "acknowledged", engineSession: `${b.owner}:${b.document}`, operation: String(T) });
      } finally {
        if (!E) try {
          c({ kind: "cancel", request: ++n, scope: b, beginRequest: T });
        } catch {
        }
      }
    },
    stop() {
      if (!r) {
        r = !0;
        for (const d of [...i.values()]) d.finish({ kind: "cancelled" });
        e.removeEventListener("kit_data", a);
      }
    }
  };
}
function pe(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function nt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function qn(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function ge(e, t, n = 0, r, i, o) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {} });
}
function Qo(e, t) {
  const n = $o(), r = {};
  for (const u of Object.keys(e)) r[u] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = Kn({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    past: [],
    future: [],
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map()
  }), o = Kn((u) => u(i).snapshot);
  let a = !1, c, s = 0, d = !1, l, m = [];
  const S = [], b = () => n.get(o), T = (u, h, p = u.past, v = u.future) => ({
    ...u,
    past: p.slice(-100),
    future: v,
    snapshot: Object.freeze({
      ...u.snapshot,
      revision: u.snapshot.revision + 1,
      fields: Object.freeze(h),
      history: Object.freeze({
        canUndo: !a && u.gestures.size === 0 && p.length > 0 && h[p[p.length - 1]?.key ?? ""]?.readiness.kind === "ready",
        canRedo: !a && u.gestures.size === 0 && v.length > 0 && h[v[v.length - 1]?.key ?? ""]?.readiness.kind === "ready",
        ...u.snapshot.scope && p.length > 0 ? { undoEntry: nt(u.snapshot.scope, p[p.length - 1]) } : {},
        ...u.snapshot.scope && v.length > 0 ? { redoEntry: nt(u.snapshot.scope, v[v.length - 1]) } : {}
      })
    })
  }), E = (u) => {
    const h = n.get(i);
    if (u.snapshot === h.snapshot) {
      n.set(i, u);
      return;
    }
    const p = u.snapshot.scope;
    if (!p || !t.bindings?.length) {
      n.set(i, u);
      return;
    }
    const v = { ...u.snapshot.fields };
    for (const y of t.bindings) {
      const g = v[y.key];
      if (!g) continue;
      const f = h.snapshot.fields[y.key], x = !h.snapshot.scope || !pe(p, h.snapshot.scope);
      if (!(x || !f || f.readiness.kind !== g.readiness.kind || "value" in g && (!("value" in f) || !Object.is(g.value, f.value)) || y.dependencies.some((D) => {
        const w = h.snapshot.fields[D], N = v[D];
        return w !== N && (!w || !N || !("value" in w) || !("value" in N) || !Object.is(w.value, N.value));
      }))) {
        const D = g.application ?? f?.application, w = f?.target ?? g.target;
        v[y.key] = g.application === D && g.target === w ? g : Object.freeze({ ...g, ...D ? { application: D } : {}, ...w ? { target: w } : {} });
        continue;
      }
      const _ = Object.freeze({ scope: p, key: y.key, generation: x ? 0 : (f?.target?.generation ?? -1) + 1 }), C = {};
      let M = "value" in g && g.readiness.kind === "ready";
      for (const D of y.dependencies) {
        const w = v[D];
        e[D]?.kind !== "parameter" || !w || !("value" in w) || w.readiness.kind !== "ready" || typeof w.value != "number" ? M = !1 : C[D] = w.value;
      }
      if (v[y.key] = Object.freeze({ ...g, target: _, application: Object.freeze({ kind: M ? "pending" : "waiting-for-inputs" }) }), M && "value" in g) {
        const D = Object.freeze({ value: g.value, parameters: Object.freeze(C) });
        m.push(() => y.replace(D, _));
      } else m.push(() => y.cancel());
    }
    n.set(i, { ...u, snapshot: Object.freeze({ ...u.snapshot, fields: Object.freeze(v) }) });
  }, I = (u, h, p) => {
    const v = e[h];
    return (v?.kind === "stored" ? v.codec.equals(p.before, p.after) : Object.is(p.before, p.after)) ? u : [...u, { key: h, before: p.before, after: p.after, order: p.order }].sort((g, f) => g.order - f.order);
  }, A = (u, h, p, v, y, g) => {
    const f = e[h], x = u.snapshot.fields[h];
    if (!f || !x || !u.snapshot.scope)
      return { kind: "rejected", reason: "not-ready" };
    const L = "value" in x ? x : void 0;
    if (!L && !(g === "recover")) return { kind: "rejected", reason: "not-ready" };
    let C;
    if (f.kind === "parameter") {
      if (typeof p != "number") return { kind: "rejected", reason: "invalid-value" };
      C = u.gestures.has(h) ? [{ kind: "parameter", endpoint: f.endpoint, value: p }] : [
        { kind: "gesture-start", endpoint: f.endpoint },
        { kind: "parameter", endpoint: f.endpoint, value: p },
        { kind: "gesture-end", endpoint: f.endpoint }
      ];
    } else C = [{ kind: "stored", key: h, value: f.codec.encode(p) }];
    const M = (L?.version ?? 0) + 1, D = ++s, w = new Map(u.publications).set(D, { key: h, version: M }), N = T(u, { ...u.snapshot.fields, [h]: ge(p, { kind: f.kind === "parameter" ? "host-managed" : "pending" }, M, L?.metadata, L?.gesture, f.kind === "parameter" ? { kind: "pending" } : void 0) }, v, y), $ = {
      kind: "accepted",
      revision: N.snapshot.revision,
      version: M,
      ...g !== "history" ? { changed: !0 } : {},
      ...g === "edit" && !u.gestures.has(h) && v.length > 0 ? { historyEntry: nt(u.snapshot.scope, v[v.length - 1]) } : {}
    };
    return l = $, E({ ...N, publications: w }), a || t.native.publish({ request: D, scope: u.snapshot.scope, operations: C }), $;
  }, k = (u) => {
    const h = n.get(i);
    if (u.kind === "opened" || u.kind === "replaced") {
      if (h.snapshot.scope && (u.kind === "opened" || u.scope.owner !== h.snapshot.scope.owner || u.scope.document <= h.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const p = {}, v = /* @__PURE__ */ new Map();
      for (const [g, f] of Object.entries(e))
        if (f.kind === "parameter") {
          const x = u.native.parameters.find((L) => L.endpoint === f.endpoint);
          if (x && qn(x)) {
            v.set(g, Object.freeze({ ...x }));
            const { min: L, max: _, step: C, defaultValue: M } = x;
            p[g] = ge(x.value, { kind: "host-managed" }, 0, Object.freeze({ min: L, max: _, step: C, defaultValue: M }), void 0, { kind: "unconfirmed" });
          } else p[g] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: x ? "invalid-state" : "missing-parameter" }) });
        } else {
          const x = Object.hasOwn(u.native.values, g), L = x ? f.codec.parse(u.native.values[g]) : f.initial;
          if (L.kind === "ok") p[g] = ge(L.value, { kind: x ? "observed-in-native-state" : "not-written" });
          else {
            const _ = h.snapshot.fields[g], C = u.kind === "replaced" && u.changedStoredKey !== void 0 && _ && "value" in _;
            p[g] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...C ? { value: _.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const y = T(h, p, [], []);
      E({ ...y, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), editOrder: 0, parameters: v, snapshot: Object.freeze({ ...y.snapshot, scope: Object.freeze({ ...u.scope }) }) });
    } else if (u.kind === "command") {
      if (!h.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!pe(u.address, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (h.detached.has(u.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (u.command.kind === "undo" || u.command.kind === "redo") {
        if (h.gestures.size > 0) return { kind: "rejected", reason: "busy" };
        const M = u.command.kind === "undo", D = M ? h.past : h.future, w = D[D.length - 1], N = u.command.expectedEntry;
        return N && (!w || !pe(N.scope, h.snapshot.scope) || N.id !== w.order) ? { kind: "rejected", reason: "stale-history" } : w ? A(
          h,
          w.key,
          M ? w.before : w.after,
          M ? h.past.slice(0, -1) : [...h.past, w],
          M ? [...h.future, w] : h.future.slice(0, -1),
          "history"
        ) : { kind: "accepted", revision: h.snapshot.revision };
      }
      const { key: p } = u.command;
      if (!Object.hasOwn(e, p)) return { kind: "rejected", reason: "invalid-command" };
      const v = e[p], y = h.snapshot.fields[p];
      if (!v || !y) return { kind: "rejected", reason: "invalid-command" };
      if (u.command.kind === "recover") {
        if (u.command.expectedVersion !== 0 || Object.hasOwn(u.command, "gesture")) return { kind: "rejected", reason: "invalid-command" };
        if (v.kind !== "stored") return { kind: "rejected", reason: "not-ready" };
        if ("version" in y && y.version !== 0) return { kind: "rejected", reason: "stale-version" };
        if (y.readiness.kind !== "failed" || y.readiness.reason !== "invalid-state") return { kind: "rejected", reason: "not-ready" };
        const M = v.codec.parse(u.command.value);
        return M.kind === "error" ? { kind: "rejected", reason: "invalid-value" } : A(h, p, M.value, h.past, h.future, "recover");
      }
      if (!("value" in y) || y.readiness.kind !== "ready") return { kind: "rejected", reason: "not-ready" };
      const g = y, f = h.gestures.get(p);
      if (f && f.client !== u.address.client) return { kind: "rejected", reason: "busy" };
      if (u.command.kind === "begin" || u.command.kind === "end") {
        const { gesture: M } = u.command;
        if (!Number.isSafeInteger(M) || M <= 0) return { kind: "rejected", reason: "invalid-command" };
        if (f && f.gesture !== M) return { kind: "rejected", reason: "invalid-command" };
        const D = u.command.kind === "begin";
        if (D === !!f) return { kind: "accepted", revision: h.snapshot.revision, version: g.version };
        const w = new Map(h.gestures);
        let N = h.past, $, W;
        if (D) {
          $ = Object.freeze({ client: u.address.client, gesture: M });
          const tt = g.value;
          w.set(p, { ...$, before: tt, after: tt, order: 0 });
        } else f && (w.delete(p), N = I(N, p, f), N !== h.past && (W = nt(h.snapshot.scope, { ...f })));
        const Ve = T({ ...h, gestures: w }, {
          ...h.snapshot.fields,
          [p]: ge(g.value, g.persistence, g.version, g.metadata, $, g.application)
        }, N), $e = {
          kind: "accepted",
          revision: Ve.snapshot.revision,
          version: g.version,
          ...W ? { historyEntry: W } : {}
        };
        return l = $e, E({ ...Ve, gestures: w }), a || v.kind === "parameter" && t.native.publish({
          request: ++s,
          scope: h.snapshot.scope,
          operations: [{ kind: D ? "gesture-start" : "gesture-end", endpoint: v.endpoint }]
        }), $e;
      }
      const { value: x, expectedVersion: L } = u.command;
      if (u.command.gesture !== void 0 && (!f || f.gesture !== u.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (f && u.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (L !== void 0 && L !== g.version) return { kind: "rejected", reason: "stale-version" };
      let _;
      if (v.kind === "parameter") {
        const M = h.parameters.get(p);
        if (!M) return { kind: "rejected", reason: "not-ready" };
        if (typeof x != "number" || !Number.isFinite(x)) return { kind: "rejected", reason: "invalid-value" };
        const D = Math.min(M.max, Math.max(M.min, x));
        if (_ = M.step > 0 ? Math.min(M.max, Math.max(M.min, M.min + Math.round((D - M.min) / M.step) * M.step)) : D, Object.is(g.value, _)) return { kind: "accepted", revision: h.snapshot.revision, version: g.version, changed: !1 };
      } else {
        const M = v.codec.parse(x);
        if (M.kind === "error") return { kind: "rejected", reason: "invalid-value" };
        if (_ = M.value, v.codec.equals(g.value, _)) return { kind: "accepted", revision: h.snapshot.revision, version: g.version, changed: !1 };
      }
      const C = h.editOrder + 1;
      if (f) {
        const M = new Map(h.gestures).set(p, { ...f, after: _, order: C });
        return A({ ...h, gestures: M, editOrder: C }, p, _, h.past, [], "edit");
      }
      return A({ ...h, editOrder: C }, p, _, [
        ...h.past,
        { key: p, before: g.value, after: _, order: C }
      ], [], "edit");
    } else if (u.kind === "engine") {
      const p = h.snapshot.fields[u.target.key];
      if (!p?.target || !pe(p.target.scope, u.target.scope) || p.target.generation !== u.target.generation) return { kind: "accepted", revision: h.snapshot.revision };
      E(T(h, {
        ...h.snapshot.fields,
        [u.target.key]: Object.freeze({ ...p, application: Object.freeze({ ...u.status }) })
      }));
    } else if (u.kind === "detached") {
      if (!h.snapshot.scope || !pe(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (h.detached.has(u.client)) return { kind: "accepted", revision: h.snapshot.revision };
      const p = new Map(h.gestures), v = { ...h.snapshot.fields }, y = [];
      let g = h.past;
      for (const [x, L] of h.gestures) {
        if (L.client !== u.client) continue;
        p.delete(x), g = I(g, x, L);
        const _ = v[x];
        _ && "value" in _ && (v[x] = ge(_.value, _.persistence, _.version, _.metadata, void 0, _.application));
        const C = e[x];
        C?.kind === "parameter" && y.push({ kind: "gesture-end", endpoint: C.endpoint });
      }
      const f = p.size === h.gestures.size ? h : T({ ...h, gestures: p }, v, g);
      return l = { kind: "accepted", revision: f.snapshot.revision }, E({ ...f, gestures: p, detached: new Set(h.detached).add(u.client) }), !a && y.length > 0 && t.native.publish({ request: ++s, scope: h.snapshot.scope, operations: y }), l;
    } else if (u.kind === "parameter") {
      if (!h.snapshot.scope || !pe(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [p, v] of h.parameters) {
        if (v.endpoint !== u.endpoint) continue;
        if (!qn({ ...v, value: u.value })) return { kind: "rejected", reason: "invalid-value" };
        const y = h.snapshot.fields[p];
        if (!y || !("value" in y)) continue;
        const g = Object.is(y.value, u.value) ? h : T(h, {
          ...h.snapshot.fields,
          [p]: ge(u.value, { kind: "host-managed" }, y.version + 1, y.metadata, y.gesture, { kind: "unconfirmed" })
        });
        E(g);
      }
    } else {
      if (!h.snapshot.scope || !pe(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const p = h.publications.get(u.request);
      if (p) {
        const v = new Map(h.publications);
        v.delete(u.request);
        const y = h.snapshot.fields[p.key];
        if (y && "value" in y && y.version === p.version) {
          const g = u.result.kind === "observed" ? { kind: e[p.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: u.result.reason }, f = e[p.key]?.kind === "parameter" ? u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: u.result.reason }) } : y.application, x = T(h, { ...h.snapshot.fields, [p.key]: ge(y.value, g, y.version, y.metadata, y.gesture, f) });
          E({ ...x, publications: v });
        } else E({ ...h, publications: v });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, R = (u) => {
    if (a) return;
    a = !0;
    let h = () => {
    };
    c = new Promise((g) => {
      h = g;
    });
    const p = [];
    for (const g of t.bindings ?? [])
      try {
        p.push(g.stop());
      } catch (f) {
        p.push(Promise.reject(f));
      }
    Promise.allSettled(p).then((g) => {
      for (const f of g) f.status === "rejected" && t.onDefect(f.reason);
      h();
    });
    const v = n.get(i), y = {};
    for (const [g, f] of Object.entries(v.snapshot.fields)) {
      const { gesture: x, ...L } = "value" in f ? f : { ...f, gesture: void 0 };
      y[g] = Object.freeze({ ...L, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...T(v, y), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
    } catch (g) {
      t.onDefect(g);
    }
    if (u)
      try {
        t.native.update(b(), u);
      } catch (g) {
        t.onDefect(g);
      }
    t.native.close({ reason: "service-closed" });
  }, P = () => {
    if (!d) {
      d = !0;
      try {
        for (let u = S.shift(); u; u = S.shift()) {
          l = void 0, m = [];
          let h, p = !1;
          try {
            h = a ? { kind: "rejected", reason: "service-closed" } : k(u.event), l = h;
            for (const v of m)
              a || v();
            a || (p = !0, t.native.update(b(), u.event.kind === "command" ? { address: u.event.address, result: h } : void 0));
          } catch (v) {
            h = l ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(v), R(!p && u.event.kind === "command" ? { address: u.event.address, result: h } : void 0);
          }
          u.finish(h);
        }
      } finally {
        d = !1;
      }
    }
  };
  return {
    getSnapshot: b,
    subscribe: (u) => n.sub(o, () => u(b())),
    dispatch: (u) => new Promise((h) => {
      S.push({ event: u, finish: h }), P();
    }),
    stop: () => (R(), c ?? Promise.resolve())
  };
}
const Xo = 5e3;
function X(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function Zo(e, t) {
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
    if (!n(a) || a.some((c) => !Object.hasOwn(e, c) || e[c]?.kind !== "parameter") || !n(i.eventEndpoints) || !n(i.hostEffects ?? []) || !n(i.outputEndpoints ?? []))
      throw new Error("Invalid custom engine binding dependency or effect declaration.");
  }
  return Object.freeze(t.map((i) => Object.freeze({
    key: i.key,
    dependencies: Object.freeze([...i.dependencies ?? []]),
    eventEndpoints: Object.freeze([...i.eventEndpoints]),
    hostEffects: Object.freeze([...i.hostEffects ?? []]),
    outputEndpoints: Object.freeze([...i.outputEndpoints ?? []]),
    create: (o) => i.create(o)
  })));
}
function ea(e, t, n) {
  let r = !1, i = !1, o, a = 0, c = 0, s, d, l, m = () => {
  }, S = () => {
  };
  const b = /* @__PURE__ */ new Map(), T = (p) => {
    if (!Qt(p)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: p });
  }, E = /* @__PURE__ */ new Map(), I = /* @__PURE__ */ new WeakMap(), A = [];
  for (const [p, v] of Object.entries(e)) {
    if (v.kind !== "stored" || v.engine?.kind !== "event-value") continue;
    const y = v.engine, g = Fn({
      async prepare(f, x) {
        const L = await y.prepare(f.value, { parameters: f.parameters, signal: x }), _ = Hn(L);
        return _.kind === "ok" ? { kind: "ok", value: { target: f.target, value: _.value } } : { kind: "error", error: { kind: "engine-rejected", message: _.message } };
      },
      transport: {
        apply(f, x) {
          return new Promise((L) => {
            let _ = 0, C = () => {
            };
            const M = (D) => {
              C(), E.delete(_), L(D);
            };
            C = x.signal.onAbort(() => M({ kind: "cancelled" }));
            try {
              const D = x.send(() => X(k.getSnapshot().scope, f.target.scope) ? (_ = ++a, E.set(_, { kind: "event-value", key: p, scope: f.target.scope, finish: M }), T({
                kind: "publish",
                request: _,
                scope: f.target.scope,
                operations: [{ kind: "event", endpoint: y.endpoint, value: f.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              D.kind !== "sent" && M(D);
            } catch (D) {
              C(), E.delete(_), n.onDefect(D), u(), L({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const f of E.values()) f.key === p && f.finish({ kind: "cancelled" });
        }
      },
      onStatus(f, x) {
        k.dispatch({ kind: "engine", target: f, status: x });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: p,
      dependencies: y.dependencies,
      replace(f, x) {
        g.replace({ ...f, target: x }, x);
      },
      cancel: g.cancel,
      stop: g.stop
    });
  }
  const k = Qo(e, {
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(p) {
        const v = ++a;
        b.set(v, { request: p.request, scope: p.scope }), T({ kind: "publish", ...p, request: v });
      },
      update(p, v) {
        p.scope && T({
          kind: "update",
          scope: p.scope,
          revision: p.revision,
          state: Bn(e, p),
          ...v ? { receipt: v } : {}
        });
      },
      close(p) {
        i = !0, o?.stop();
        for (const v of E.values()) v.finish({ kind: "cancelled" });
        S(new Error("State service closed before native initialization completed."));
        try {
          r && k.getSnapshot().scope && T({ kind: "close", ...p });
        } catch (v) {
          n.onDefect(v);
        }
        r && t.removeEventListener("kit_state", P), r = !1, b.clear();
      }
    }
  }), R = (p) => {
    if (i) return;
    const v = Wo(p);
    if (v.kind === "invalid") {
      const g = new Error(v.message);
      n.onDefect(g), S(g), u();
      return;
    }
    const y = v.value;
    if (y.kind === "closed")
      S(new Error(`Native state service closed: ${y.reason}`)), u();
    else if (y.kind === "open-failed") {
      if (y.request !== c || k.getSnapshot().scope) return;
      S(new Error(`Native state open failed: ${y.reason}`)), u();
    } else if (y.kind === "opened") {
      if (y.request !== c || k.getSnapshot().scope) return;
      k.dispatch(y).then((g) => {
        g.kind === "accepted" ? m() : S(new Error("Native state could not initialize the service."));
      });
    } else if (y.kind === "attached-client") {
      const g = k.getSnapshot();
      X(g.scope, y.scope) && T({
        kind: "snapshot",
        scope: y.scope,
        to: y.client,
        attachRequest: y.request,
        revision: g.revision,
        state: Bn(e, g)
      });
    } else if (y.kind === "detach")
      k.dispatch({ kind: "detached", scope: y.scope, client: y.client });
    else if (y.kind === "parameter")
      X(k.getSnapshot().scope, y.scope) && k.dispatch(y);
    else if (y.kind === "replaced")
      k.dispatch(y).then((g) => {
        if (g.kind !== "accepted") return;
        const f = k.getSnapshot().scope;
        for (const x of E.values())
          X(f, x.scope) || x.finish({ kind: "cancelled" });
        for (const [x, L] of b)
          X(f, L.scope) || b.delete(x);
      });
    else if (y.kind === "command")
      k.dispatch(y);
    else if (y.kind === "invalid-command")
      X(k.getSnapshot().scope, y.address) && T({
        kind: "receipt",
        address: y.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const g = E.get(y.request);
      if (g) {
        if (!X(g.scope, y.scope) || !X(k.getSnapshot().scope, y.scope)) return;
        if (g.kind === "custom" && y.result.kind === "failed" && (y.result.reason === "stale-scope" || y.result.reason === "closed")) {
          g.finish({ kind: "cancelled" });
          return;
        }
        g.finish(y.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: y.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: y.result.reason } });
        return;
      }
      const f = b.get(y.request);
      if (!f || !X(f.scope, y.scope) || !X(k.getSnapshot().scope, y.scope)) return;
      b.delete(y.request), k.dispatch({ ...y, request: f.request });
    }
  }, P = (p) => {
    if (!i)
      try {
        R(p);
      } catch (v) {
        n.onDefect(v), S(v), u();
      }
  }, u = () => l || (i = !0, S(new Error("State service stopped before native initialization completed.")), l = k.stop(), l), h = () => Object.entries(e).flatMap(([p, v]) => {
    if (v.kind !== "stored" || v.engine?.kind !== "prepared") return [];
    const y = v.engine, g = y.delivery;
    if (!g || typeof g.create != "function" || g.replacement !== void 0 && g.replacement !== "supersede" && g.replacement !== "finish")
      throw new Error("Invalid prepared delivery factory or replacement policy.");
    const f = g.create.bind(g), x = g.replacement, L = Object.freeze([...g.dataInputs ?? []]);
    if (L.some((C) => !Number.isSafeInteger(C) || C < 0 || C > 2147483647))
      throw new Error("Invalid shared-data input declaration.");
    const _ = Array.isArray(g.outputEndpoints) ? Object.freeze([...g.outputEndpoints]) : g.outputEndpoints;
    return [{
      key: p,
      dependencies: y.dependencies,
      eventEndpoints: g.eventEndpoints,
      hostEffects: g.hostEffects,
      outputEndpoints: _,
      create(C) {
        const M = f(), D = Fn({
          replacement: x,
          async prepare(w, N) {
            return { kind: "ok", value: { value: await y.prepare(w.value, { parameters: w.parameters, signal: N }), target: w.target } };
          },
          transport: {
            async apply(w, N) {
              let $ = !0;
              const W = /* @__PURE__ */ new Set(), Ve = () => {
                for (const G of W) G();
              }, $e = N.signal.onAbort(Ve), tt = {
                get aborted() {
                  return !$ || N.signal.aborted;
                },
                onAbort(G) {
                  return !$ || N.signal.aborted ? G() : W.add(G), () => {
                    W.delete(G);
                  };
                }
              };
              try {
                return await M.apply(w.value, {
                  signal: N.signal,
                  replaceData(G, ie) {
                    return L.includes(G) ? !$ || N.signal.aborted || !X(k.getSnapshot().scope, w.target.scope) ? Promise.resolve({ kind: "cancelled" }) : (o ??= Jo(t), o.replace(G, ie, w.target, tt)) : Promise.resolve({ kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } });
                  },
                  send(G) {
                    if (!$ || N.signal.aborted) return { kind: "cancelled" };
                    const ie = C.publish(w.target.scope, G);
                    if (ie.kind === "submitted") {
                      const he = I.get(ie.completion);
                      he && (W.add(he), ie.completion.then(() => W.delete(he)));
                    }
                    return ie;
                  },
                  listen(G, ie) {
                    if (!_?.includes(G)) throw new Error("Undeclared engine output endpoint.");
                    if (!$ || N.signal.aborted) return () => {
                    };
                    let he = !0;
                    const Cn = (uo) => {
                      if (!(!he || N.signal.aborted))
                        try {
                          ie(uo);
                        } catch (fo) {
                          C.onDefect(fo);
                        }
                    }, Dt = () => {
                      he && (he = !1, W.delete(Dt), t.removeEndpointListener?.(G, Cn));
                    };
                    return W.add(Dt), t.addEndpointListener?.(G, Cn), Dt;
                  }
                });
              } finally {
                $ = !1, $e(), Ve();
              }
            },
            stop() {
              M.stop();
            }
          },
          onStatus: C.onStatus,
          onDefect: C.onDefect
        });
        return {
          replace(w, N) {
            D.replace({ ...w, target: N }, N);
          },
          cancel: D.cancel,
          stop: D.stop
        };
      }
    }];
  });
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (s) return s;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return u(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      s = new Promise((p, v) => {
        m = () => {
          clearTimeout(d), p();
        }, S = (y) => {
          clearTimeout(d), v(y);
        };
      });
      try {
        const p = Zo(e, [...h(), ...n.bindings ?? []]);
        if (p.some((v) => v.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        for (const v of p) {
          const y = v.create({
            publish(g, f) {
              if (i || !X(k.getSnapshot().scope, g)) return { kind: "cancelled" };
              const x = Object.freeze({ owner: g.owner, document: g.document });
              if (!f || typeof f != "object" || f.kind !== "event" && f.kind !== "host-effect")
                return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
              if (!(f.kind === "event" ? v.eventEndpoints.includes(f.endpoint) : v.hostEffects?.includes(f.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
              const _ = Hn(f.value);
              if (_.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: _.message } };
              const C = f.kind === "event" ? { kind: "event", endpoint: f.endpoint, value: _.value } : { kind: "host-effect", name: f.name, value: _.value }, M = { kind: "publish", request: a + 1, scope: x, operations: [C] };
              if (!Qt(M)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
              const D = ++a;
              let w = ($) => {
              };
              const N = new Promise(($) => {
                w = (W) => {
                  E.delete(D), I.delete(N), $(W);
                };
              });
              I.set(N, () => w({ kind: "cancelled" })), E.set(D, { kind: "custom", key: v.key, scope: x, finish: w });
              try {
                t.sendMessageToServer({ type: "kit_state", message: M });
              } catch ($) {
                const W = { kind: "failed", error: { kind: "transport", message: "Engine effect handoff is uncertain." } };
                return w(W), n.onDefect($), W;
              }
              return { kind: "submitted", completion: N };
            },
            onStatus(g, f) {
              k.dispatch({ kind: "engine", target: g, status: f });
            },
            onDefect(g) {
              n.onDefect(g), u();
            }
          });
          if (i) {
            const g = Promise.resolve().then(() => y.stop()).catch(n.onDefect);
            return l = Promise.all([l, g]).then(() => {
            }), s;
          }
          A.push({
            key: v.key,
            dependencies: v.dependencies ?? [],
            replace: (g, f) => y.replace(g, f),
            cancel: () => y.cancel(),
            stop: () => y.stop()
          });
        }
        r = !0, t.addEventListener("kit_state", P), c = ++a, d = setTimeout(() => {
          S(new Error("Cmajor state-channel is unavailable: native open timed out.")), u();
        }, Xo), T({
          kind: "open",
          request: c,
          parameters: Object.values(e).filter((v) => v.kind === "parameter").map((v) => v.endpoint),
          storedKeys: Object.keys(e).filter((v) => e[v]?.kind === "stored"),
          eventEndpoints: [.../* @__PURE__ */ new Set([
            ...Object.values(e).flatMap((v) => v.kind === "stored" && v.engine?.kind === "event-value" ? [v.engine.endpoint] : []),
            ...p.flatMap((v) => v.eventEndpoints)
          ])],
          ...p.some((v) => v.hostEffects?.length) ? {
            hostEffects: [...new Set(p.flatMap((v) => v.hostEffects ?? []))]
          } : {}
        });
      } catch (p) {
        n.onDefect(p), S(p), u();
      }
      return s;
    },
    /** Release this owner and its channel resources. */
    stop: u
  };
}
const Xr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), Xt = Reflect.get(globalThis, Xr), Wn = Xt instanceof WeakMap ? Xt : /* @__PURE__ */ new WeakMap();
Xt !== Wn && Object.defineProperty(globalThis, Xr, { value: Wn });
const ta = 2e3;
function Gn(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Yn(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function na(e, t) {
  if (!Yn(e))
    return { found: !1 };
  const n = Yn(e.values) ? e.values : void 0;
  return n && Gn(n, t) ? {
    found: !0,
    value: n[t]
  } : Gn(e, t) ? {
    found: !0,
    value: e[t]
  } : { found: !1 };
}
function Jn(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class ra {
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
    this.connection = t, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = ia(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const i = na(n, this.stateKeys[r]);
            if (i.found && i.value != null) {
              this.activeStateKeyIndex = r, this.applyStoredValue(i.value);
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
    const i = this.pendingStateKeyIndex === r;
    if (i && (this.pendingStateKeyIndex = null), n.value == null && i && r + 1 < this.stateKeys.length) {
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
    const r = (i) => {
      this.parameterValues.set(t, i), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(t, r), r;
  }
  getRuntimeEndpointListener(t) {
    const n = this.runtimeEndpointListeners.get(t.endpointID);
    if (n)
      return n;
    const r = (i) => {
      const o = t.mapValue ? t.mapValue(i) : i;
      this.runtimeEndpointValues.set(t.endpointID, o), this.applyRuntimeStateIfReady();
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
    }, i = Jn(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), c = Jn({
      runtimeEndpoints: n,
      events: a
    });
    if (c === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      const s = this.lifetime;
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, r).then((d) => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, d ? (this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r) : this.options.onDeliveryFailure?.(a);
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
        this.options.sendTimeoutMilliseconds ?? ta
      );
    this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function ia(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e)
    t.has(n.endpointID) || t.set(n.endpointID, n);
  return [...t.values()];
}
function oa(e, t) {
  return new ra(e, t);
}
class aa {
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
function sa(e, t) {
  return new aa(e, t);
}
async function ca(e, t) {
  const n = sa(e, t);
  return await n.start(), n;
}
function Lt(e) {
  return Object.freeze({ kind: "parameter", endpoint: e });
}
function la(e) {
  const t = Object.freeze({ ...e.codec });
  return Object.freeze({ kind: "stored", initial: t.parse(e.initial), codec: t, ...e.engine ? { engine: e.engine } : {} });
}
function da(e) {
  return Object.freeze({ ...e });
}
function ee(e, t) {
  if (!e)
    throw new Error(t);
}
function Nt(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function ua(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function Zt(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Zr(e) {
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
function fa() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function Ct(e, t) {
  const n = fa();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (ua(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function Qn(e) {
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
  throw new Error(`Unsupported text resource payload (${Zr(e)})`);
}
function ma(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return Zt(e);
  throw new Error(`Unsupported binary resource payload (${Zr(e)})`);
}
function ha(e) {
  const t = e?.frames;
  ee(
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
      ee(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function ei(e) {
  const t = new DataView(e);
  ee(Nt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), ee(Nt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, c = null, s = null, d = 12;
  for (; d + 8 <= t.byteLength; ) {
    const m = Nt(t, d, 4), S = t.getUint32(d + 4, !0), b = d + 8;
    m === "fmt " ? (n = t.getUint16(b, !0), r = t.getUint16(b + 2, !0), i = t.getUint32(b + 4, !0), a = t.getUint16(b + 12, !0), o = t.getUint16(b + 14, !0)) : m === "data" && (c = b, s = S), d = b + S + S % 2;
  }
  ee(n !== null, "Wave file is missing a fmt chunk"), ee(c !== null && s !== null, "Wave file is missing a data chunk"), ee(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && o === 32)
    l = new Float32Array(e.slice(c, c + s));
  else if (n === 1 && o === 16) {
    const m = s / 2, S = new Int16Array(e.slice(c, c + s));
    l = new Float32Array(m);
    for (let b = 0; b < m; b += 1)
      l[b] = S[b] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: l
  };
}
async function Xn(e) {
  ee(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return ee(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function en(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function ti(e) {
  const t = new Uint8Array(e).buffer, n = ei(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function pa(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (s) => (ee(typeof e.readResource == "function", `Resource bridge cannot read ${s}`), e.readResource(s)), i = async (s) => {
    ee(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const d = await e.readResourceAsAudioData(s);
    return ha(d);
  }, o = (s) => {
    const d = e.getResourceAddress?.(s);
    return d ?? null;
  }, a = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Ct(s, d), m = await Xn(l), S = ei(m);
    return {
      sampleRate: S.sampleRate,
      samples: S.samples
    };
  }, c = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Ct(s, d);
    return new Uint8Array(await Xn(l));
  };
  return {
    async readText(s) {
      if (t === "bridge" && typeof e.readResource == "function")
        return Qn(await r(s));
      const d = o(s);
      return t === "url" && d !== null ? en(await c(s, d)) : typeof e.readResource == "function" ? Qn(await r(s)) : en(await c(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof e.readResource == "function" ? ma(await r(s)) : c(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(s);
      const d = o(s);
      return n === "url" && d !== null ? a(s, d) : typeof e.readResourceAsAudioData == "function" ? i(s) : ti(await this.readBytes(s));
    },
    getURL(s) {
      return Ct(s, e.getResourceAddress?.(s));
    }
  };
}
function ga(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return pa(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function va(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return en(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return Zt(await t(a));
      if (n)
        return Zt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : ti(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function ya(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function Ia(e) {
  return ya(e) ? va(e) : ga(e);
}
const Ne = -100, ht = 35, Sa = 5, ba = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function ni(e) {
  const t = ba.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function Z(e) {
  return ni(e).laneEndpointID;
}
function Ta(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > Sa)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${ni(e).hostStem}${t}OutputTrimDb`;
}
function ri(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Ea(e) {
  const t = (ri(e, Ne, ht) - Ne) / (ht - Ne);
  return t * t;
}
function Aa(e) {
  const t = Math.sqrt(ri(e, 0, 1));
  return Ne + t * (ht - Ne);
}
const Y = (e, t) => ({ label: e, value: t });
function oe(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const ae = Object.freeze({
  filter: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: oe(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), O = (e, t, n, r, i, o, a, c = {}) => ({
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
function se(e, t, n) {
  return O(
    e,
    t,
    "Output Trim",
    "Trim",
    Ne,
    ht,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const ka = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Ra = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], xa = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: ae.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      O("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(Y), quick: !0 }),
      O("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      O("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      O("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      se("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: ae.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      O("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [Y("Classic", 0), Y("Harmonics", 1)] }),
      O("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      O("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      O("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      O("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      O("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      O("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [Y("Symmetric", 0), Y("Asymmetric", 1), Y("Wavefold", 2)] }),
      se("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: ae.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      O("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      O("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      O("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      O("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      O("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      se("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: ae.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      O("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(Y) }),
      O("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(Y) }),
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
      se("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: ae.flanger,
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
      se("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: ae.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      O("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [Y("Free", 0), Y("Sync", 1)] }),
      O("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      O("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: ka.map(Y) }),
      O("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      O("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      O("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      O("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      O("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      se("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: ae.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      O("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [Y("Free", 0), Y("Sync", 1)] }),
      O("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      O("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Ra.map(Y) }),
      O("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      O("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      O("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      se("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: ae.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      O("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      O("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      O("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      O("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      se("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Ot = xa, ii = Object.freeze(
  Ot.flatMap((e) => e.parameters)
);
new Map(
  ii.map((e) => [e.endpointID, e])
);
function oi(e) {
  const t = Ot.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function ai() {
  return ii;
}
function Sn(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const U = ["A", "B", "C"], si = [
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
], Ma = [
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
], Re = Object.freeze([
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
]), Oa = Object.freeze([
  ...U.flatMap((e) => si.map(
    (t) => `osc${e}.${t}`
  )),
  ...Ma
]);
new Set(
  U.flatMap((e) => si.map(
    (t) => `osc${e}.${t}`
  ))
);
const ci = Object.freeze(
  Oa.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), wa = ai().filter(
  (e) => e.modulationTargetIndex !== null
), _a = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function bn(e) {
  const t = Da(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function Da(e) {
  const t = _a.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const La = [
  ...wa.map((e) => ({
    kind: bn(Sn(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], li = Object.freeze(
  La.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), ue = Object.freeze([
  ...ci,
  ...li
]), lt = Re.length, di = ci.length, wt = li.length, Na = lt * ue.length, Ca = new Map(Re.map((e) => [e.id, e])), ui = new Map(Re.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), ze = new Map(ue.map((e) => [e.kind, e]));
function Pa() {
  if (lt !== 14 || di !== 59 || wt !== 47 || Na !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = Re.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = ue.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (Ca.size !== lt || ui.size !== lt || ze.size !== ue.length)
    throw new Error("Modulation identities must be unique");
}
Pa();
function fi(e, t) {
  const n = ui.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function Tn(e) {
  return typeof e != "string" ? null : ze.has(e) ? e : null;
}
function Fa(e) {
  const t = Tn(e);
  return t !== null && ze.get(t)?.group === "voice" ? t : null;
}
function En(e) {
  const t = Tn(e);
  return t !== null && ze.get(t)?.group === "rack" ? t : null;
}
function Ka(e) {
  const t = ze.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function mi(e) {
  const t = ze.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Ua(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const hi = 4, za = hi * wt, ja = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Va = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function xe(e) {
  if (typeof e != "string")
    return null;
  const t = Va.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = ja.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function An(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function pi(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function gi(e) {
  if (e === null)
    return null;
  const t = pi(e) - 1;
  return t > hi ? null : t * wt + mi(An(e));
}
const ye = 2048, Ye = ye + 3, Zn = 20, vi = "MSEG 1", $a = 0, Ie = 2, Ba = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function kn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Fe(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Ha(e) {
  return kn(Number.isFinite(e) ? e : 0, -Zn, Zn);
}
function Ee(e) {
  return kn(Number.isFinite(e) ? e : 0, 0, 1);
}
function yi(e = vi) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: e,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function tn() {
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
function qa(e) {
  const t = Number(e);
  return kn(
    Number.isFinite(t) ? t : 1,
    $a,
    Ie
  );
}
function Wa(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = Ee(Number(t.startX)), r = Ee(Number(t.endX));
  return Fe(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Ga(e = tn()) {
  const t = e && typeof e == "object" ? e : {}, n = t.rate && typeof t.rate == "object" ? t.rate : {}, r = Number(n.seconds), i = t.noteOffPolicy, o = Ba.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: qa(Number.isFinite(r) ? r : 1)
    },
    loop: Wa(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function Ya(e, t, n) {
  const r = e && typeof e == "object" ? e : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Ee(i)), {
    x: i,
    y: Ee(Number(r.y)),
    curvePower: Ha(Number(r.curvePower))
  };
}
function Je(e = yi()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Ya(i, o, n.length));
  if (!Fe(r[0].x, 0) || !Fe(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : vi,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function er(e) {
  return JSON.stringify(Je(e));
}
function Ja(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function Qa(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Fe(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && Fe(e[o + 1].x, t); )
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
function Xa(e, t) {
  const n = Ee(Number(t)), r = Qa(e, n);
  if (r.laterPointWins || Fe(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Ee(Ja(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Za(e, t) {
  return Xa(Je(e).points, t);
}
function es(e) {
  const t = new Float32Array(Ye);
  return Ii(e, t), t;
}
function Ii(e, t) {
  if (t.length !== Ye) throw new Error("Invalid MSEG destination length.");
  const n = Je(e);
  for (let r = 0; r < ye; r += 1) {
    const i = r / (ye - 1);
    t[r + 1] = Za(n, i);
  }
  t[0] = t[1], t[ye + 1] = t[ye], t[ye + 2] = t[ye];
}
function tr(e, t) {
  return er(e) === er(t);
}
const Pt = "modulationProgram", ts = "modulationAmount", Si = Re.filter((e) => e.group === "voice").length, bi = Re.filter((e) => e.group === "macro").length, pt = di, ns = wt, gt = ns + za, Se = Si * pt, Oe = bi * pt, rs = Si * gt, is = bi * gt, ve = 512, Me = 256, Ti = Se + Oe;
function os(e) {
  const t = fi(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function as(e) {
  const t = Fa(e);
  return t === null ? null : Ka(t);
}
function Ei(e) {
  const t = as(e.targetKind), n = En(e.targetKind);
  let r = n === null ? void 0 : mi(n);
  if (r === void 0) {
    const a = gi(
      xe(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = fi(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const c = a.runtimeIndex;
    if (t !== null) {
      const d = c * pt + t;
      return {
        path: "macroVoice",
        cellIndex: d,
        sourceIndex: c,
        targetIndex: t,
        articulationCellIndex: Se + d
      };
    }
    const s = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: c * gt + s,
      sourceIndex: c,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const i = os(e);
  if (t !== null) {
    const a = i * pt + t;
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
    cellIndex: i * gt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Ai(e) {
  return xe(e.targetKind) !== null ? null : Ei(e).articulationCellIndex;
}
function ss(e) {
  if (En(e.targetKind) !== null)
    return !1;
  const t = xe(e.targetKind);
  return t !== null && gi(t) === null;
}
function cs(e) {
  return {
    ...Ei(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function ki(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (ss(n))
      continue;
    const r = cs(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function ls(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function _e(e) {
  return [...e.values()].filter(ls).sort((t, n) => t.cellIndex - n.cellIndex);
}
function rt(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function Ft(e) {
  const t = ki(e), n = _e(t.voice), r = _e(t.macroVoice), i = _e(t.voiceRack), o = _e(t.macroRack), a = Array.from({ length: Se }, () => 0), c = Array.from({ length: Se }, () => 0), s = Array.from({ length: Se }, () => 0), d = Array.from({ length: Se }, () => 0), l = Array.from({ length: Se }, () => 0);
  rt(n, a, c, s, d);
  const m = Array.from({ length: Oe }, () => 0), S = Array.from({ length: Oe }, () => 0), b = Array.from({ length: Oe }, () => 0), T = Array.from({ length: Oe }, () => 0), E = Array.from({ length: Oe }, () => 0);
  if (rt(
    r,
    m,
    S,
    b,
    T
  ), i.length > ve || o.length > Me)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${ve}), ${o.length} macro-rack (max ${Me})`
    );
  const I = Array.from({ length: ve }, () => 0), A = Array.from({ length: ve }, () => 0), k = Array.from({ length: ve }, () => 0), R = Array.from({ length: ve }, () => 0), P = Array.from({ length: ve }, () => 0), u = Array.from({ length: rs }, () => 0);
  rt(
    i,
    I,
    A,
    k,
    R
  );
  const h = Array.from({ length: Me }, () => 0), p = Array.from({ length: Me }, () => 0), v = Array.from({ length: Me }, () => 0), y = Array.from({ length: Me }, () => 0), g = Array.from({ length: is }, () => 0);
  rt(
    o,
    h,
    p,
    v,
    y
  );
  for (const f of t.voice.values()) l[f.cellIndex] = f.amount;
  for (const f of t.macroVoice.values()) E[f.cellIndex] = f.amount;
  for (const f of t.voiceRack.values()) u[f.cellIndex] = f.amount;
  for (const f of t.macroRack.values()) g[f.cellIndex] = f.amount;
  for (let f = 0; f < i.length; f += 1) {
    const x = i[f];
    if (x === void 0) throw new Error(`Missing compiled voice-rack route at index ${f}`);
    P[f] = x.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: c,
    voiceRouteTargets: s,
    voiceRoutePolarities: d,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: S,
    macroVoiceRouteTargets: b,
    macroVoiceRoutePolarities: T,
    macroVoiceRouteAmounts: E,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: I,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: k,
    voiceRackRoutePolarities: R,
    voiceRackRouteReducers: P,
    voiceRackRouteAmounts: u,
    macroRackRouteCount: o.length,
    macroRackRouteCells: h,
    macroRackRouteSources: p,
    macroRackRouteTargets: v,
    macroRackRoutePolarities: y,
    macroRackRouteAmounts: g
  };
}
const ds = ["voice", "macroVoice", "voiceRack", "macroRack"], us = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function nr(e) {
  return ki(e);
}
function fs(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function ms(e, t) {
  if (e === null)
    return [{ endpointID: Pt, value: Ft(t) }];
  const n = nr(e), r = nr(t), i = [];
  for (const o of ds) {
    const a = _e(n[o]), c = _e(r[o]);
    if (a.length !== c.length)
      return [{ endpointID: Pt, value: Ft(t) }];
    for (let s = 0; s < c.length; s += 1) {
      const d = a[s], l = c[s];
      if (d === void 0 || l === void 0 || !fs(d, l))
        return [{ endpointID: Pt, value: Ft(t) }];
      d.amount !== l.amount && i.push({
        endpointID: ts,
        value: {
          pathKind: us[o],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return i;
}
function je(e) {
  return { _tag: "ok", value: e };
}
function Ge(e) {
  return { _tag: "err", error: e };
}
function hs(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function ps(e) {
  throw new Error(e ?? "Invariant violated");
}
const gs = "globalTune", vs = "globalTuneSemitones", ce = -24, Be = 24, rr = 0, Ri = -48, xi = 48, nn = -48, Mi = 6, Rn = 0, ir = (Rn - nn) / (Mi - nn), ys = "voiceEnhancerFrequency", Is = "voiceEnhancerQ", Ss = "voiceEnhancerAmount", bs = "voiceEnhancerFrequencyOctaves", Ts = "voiceEnhancerQ", Es = "voiceEnhancerAmount", Oi = "voice.enhancerFrequency", As = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: ys,
    targetKind: bs,
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
    endpointID: Is,
    targetKind: Ts,
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
    endpointID: Ss,
    targetKind: Es,
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
function or(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function ks(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function it(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Rs = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      it("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      it("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      it("mix", "Mix", 100, 100),
      it("drive", "Drive", 15, 0)
    ]
  }
], ar = 1e-6;
function te(e, t) {
  if (!Number.isFinite(e) || e < -ar || e > 1 + ar)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function vt(e, t) {
  return te(e / 100, `${t} catalog percentage`);
}
function Xe(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function xs(e) {
  return 20 * 1e3 ** e;
}
function Ms(e) {
  return te(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Os(e) {
  return 0.1 * 200 ** e;
}
function ws(e) {
  return te(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function _s(e) {
  return e;
}
function Ds(e) {
  return te(e, "filterMix endpoint conversion");
}
function Ce(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function Ls(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Ce("filterCutoff", xs, Ms),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ce("filterQ", Os, ws),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ce("filterMix", _s, Ds),
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
function wi(e) {
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
      return hs(e);
  }
}
function Ns(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Cs(e, t) {
  const n = Xe(e.moduleId, t.id), r = wi(t.format), i = Ls(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: vt(t.defaultPercent, n),
    initialValue: vt(t.initialPercent, n),
    format: r,
    modAmount: Ns(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Ps = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: ir * 100, defaultPercent: ir * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Fs(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ks(e, t) {
  const n = `osc${e}`, r = Xe(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: vt(t.defaultPercent, r),
    initialValue: vt(t.initialPercent, r),
    format: wi(t.format),
    modAmount: Fs(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const Us = Object.freeze(
  U.flatMap((e) => Ps.map((t) => Ks(e, t)))
), zs = Object.freeze({
  targetId: Xe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: te(
    (rr - ce) / (Be - ce),
    "Global Tune default"
  ),
  initialValue: te(
    (rr - ce) / (Be - ce),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Be },
  modAmount: {
    min: Ri,
    max: xi,
    unit: "st",
    digits: 2
  },
  binding: Ce(
    gs,
    (e) => ce + (Be - ce) * e,
    (e) => te(
      (e - ce) / (Be - ce),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: vs
});
function js(e) {
  const t = Xe("voice-enhancer", e.key), n = te(
    or(e, e.initial),
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
    binding: Ce(
      e.endpointID,
      (r) => ks(e, r),
      (r) => te(
        or(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Vs = Object.freeze(
  Object.values(As).map(js)
), $s = Object.freeze([
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
function Bs(e) {
  const t = Xe(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => te(
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
    binding: Ce(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const Hs = Object.freeze(
  $s.map(Bs)
), qs = Object.freeze([
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
function Ws(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function Kt(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? Ea(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return te(n, `${e.endpointID} endpoint conversion`);
}
function Gs(e, t) {
  return e.valueKind === "effect-output-trim-db" ? Aa(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function Ys(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Js(e) {
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
function Qs(e) {
  const t = Ws(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: Kt(e, e.initial),
    initialValue: Kt(e, e.initial),
    format: Ys(e),
    modAmount: Js(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => Gs(e, n),
      fromEngine: (n) => Kt(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : bn(Sn(e))
  });
}
const xn = Object.freeze(
  [
    ...Ot.flatMap((e) => e.parameters.map(Qs)),
    ...qs,
    zs,
    ...Vs,
    ...Us,
    ...Hs,
    ...Rs.flatMap(
      (e) => e.parameters.map(
        (t) => Cs(e, t)
      )
    )
  ]
), Xs = new Map(
  xn.map((e) => [e.targetId, e])
), _i = xn.filter(
  (e) => e.modulationTargetKind !== null
), rn = new Map(
  _i.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Xs.size !== xn.length)
  throw new Error("Target descriptor IDs must be unique");
if (_i.length !== ue.length || rn.size !== ue.length || ue.some((e) => rn.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ut(e) {
  const t = rn.get(e);
  return t === void 0 ? ps(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  Ot.map((e) => [e.id, e.label])
);
function Zs(e) {
  const t = pi(e);
  return t === 1 ? "" : ` ${t}`;
}
function ec(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = Ut(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = xe(e);
  if (n !== null) {
    const r = Ut(An(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Zs(n)} ${r.label.toUpperCase()}`;
  }
  return Ut(e).label.toUpperCase();
}
const be = "modulation.v6", Di = 6, Ze = 3, De = 3, tc = 4, sr = "modulationMsegBuffer", nc = "modulationMsegPlayback", Li = 4, rc = ["MSEG 1", "MSEG 2", "MSEG 3"], Ni = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], ic = ["Env 1", "Env 2", "Env 3"], oc = 1e-3, z = 10, ac = 0.1, sc = 20, cr = 10 - 0.1, cc = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: sc - ac },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Ri,
    max: xi
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
  mseg1Rate: { min: -Ie, max: Ie },
  mseg2Rate: { min: -Ie, max: Ie },
  mseg3Rate: { min: -Ie, max: Ie },
  env1Attack: { min: -z, max: z },
  env1Decay: { min: -z, max: z },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -z, max: z },
  env2Attack: { min: -z, max: z },
  env2Decay: { min: -z, max: z },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -z, max: z },
  env3Attack: { min: -z, max: z },
  env3Decay: { min: -z, max: z },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -z, max: z },
  ampAttack: { min: -z, max: z },
  ampDecay: { min: -z, max: z },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -z, max: z },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -cr, max: cr },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, lc = ai().filter((e) => e.modulationTargetIndex !== null), dc = new Map(
  lc.map((e) => [
    bn(Sn(e)),
    e
  ])
);
class zt extends Error {
  name = "ModulationStateParseError";
}
const uc = {
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
Re.map((e) => ({
  value: e.id,
  label: uc[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const fc = ue.map((e) => ({
  value: e.kind,
  label: ec(e.kind)
}));
fc.filter((e) => !hc(e.value));
function mc(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Mn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function jt(e, t) {
  const n = Number(e);
  return Mn(Number.isFinite(n) ? n : t, oc, z);
}
function hc(e) {
  return En(e) !== null;
}
function pc(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function gc(e) {
  const t = xe(e);
  return t !== null ? An(t) : e;
}
function vc(e) {
  const t = gc(e);
  if (xe(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = dc.get(t);
  return n !== void 0 ? pc(n) : cc[Ua(t)];
}
function yc(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Ic(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function Sc(e, t) {
  const n = vc(e), r = Number(t);
  return Mn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function bc(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Tc(e) {
  return bc(e) ?? "mseg";
}
function Ec(e) {
  const t = Tn(e);
  return t !== null ? t : xe(e) !== null ? e : null;
}
function Ac(e) {
  return Ec(e) ?? "oscA.wavetablePosition";
}
function kc(e, t) {
  const n = Ni[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Rc(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Ze : e === "macro" ? Li : tc;
  return Mn(Number.isFinite(n) ? n : 1, 1, r);
}
function Le(e) {
  return {
    name: ic[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ci(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = Le(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: jt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: jt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Ee(n.sustain ?? r.sustain),
    releaseSeconds: jt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function xc(e, t = 0) {
  return { name: Ci(e, t).name };
}
function Mc(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: yc(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Rc(n, e.sourceSlot),
    polarity: Ic(e.polarity),
    targetKind: r,
    amount: Sc(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function Oc(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Tc(r.sourceKind), o = Ac(r.targetKind);
  return Mc(r, t, i, o);
}
function wc(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function _c(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => Oc(n, r));
}
function Dc(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = wc(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function on(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, c) => on(a, t[c]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => mc(r, a) && on(n[a], r[a]));
}
function Pi(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = yi(rc[t] ?? `MSEG ${t + 1}`), i = Je(n.shapeA ?? r), o = Ga({
    ...tn(),
    ...n.playback ?? {},
    rate: tn().rate
  }), { rate: a, ...c } = o;
  return {
    shapeA: i,
    shapeB: Je(n.shapeB ?? i),
    playback: c
  };
}
function yt() {
  return {
    format: "cosimo.modulation",
    version: Di,
    msegSlots: Array.from({ length: Ze }, (e, t) => Pi({}, t)),
    envelopeSlots: Array.from({ length: De }, (e, t) => ({
      name: Le(t).name
    })),
    routes: [],
    macroNames: Ni.slice()
  };
}
function Lc(e = yt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Di,
    msegSlots: Array.from({ length: Ze }, (o, a) => Pi(n[a], a)),
    envelopeSlots: Array.from({ length: De }, (o, a) => xc(r[a], a)),
    routes: _c(t.routes),
    macroNames: Array.from(
      { length: Li },
      (o, a) => kc(i[a], a)
    )
  };
}
function Vt(e) {
  const t = Qe(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function Qe(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Ge(new zt("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Ge(new zt("Expected valid modulation JSON"));
    }
  }
  const n = Lc(t);
  return !on(t, n) || !Dc(n.routes) ? Ge(new zt("Expected the current modulation schema")) : je(n);
}
function Nc(e, t) {
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
function lr(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(es(n))
  };
}
function Cc(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function dr(e, t = null, n) {
  const r = [];
  for (let i = 0; i < Ze; i += 1) {
    const o = e.msegSlots[i], a = t?.msegSlots[i];
    (a === void 0 || !tr(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: sr,
      value: lr(i, 0, o.shapeA)
    }), (a === void 0 || !tr(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: sr,
      value: lr(i, 1, o.shapeB)
    }), (a === void 0 || !Cc(a.playback, o.playback)) && r.push({
      endpointID: nc,
      value: Nc(i, o.playback)
    });
  }
  return r.push(...ms(t?.routes ?? null, e.routes)), r;
}
function Fi(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Fi(t);
    Object.freeze(e);
  }
}
const Pc = {
  parse(e) {
    const t = Qe(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (Fi(t.value), { kind: "ok", value: t.value });
  },
  encode: Vt,
  equals: (e, t) => Vt(e) === Vt(t)
}, Fc = da({
  playMode: Lt("playMode"),
  glideTime: Lt("glideTime"),
  globalTune: Lt("globalTune"),
  [be]: la({ initial: yt(), codec: Pc })
}), dt = 2048;
function He(e, t) {
  if (!e)
    throw new Error(t);
}
function Kc(e) {
  He(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    He(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), He(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), He(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), He(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const Uc = 2048, It = 11, zc = 256;
function ne(e, t) {
  if (!e)
    throw new Error(t);
}
function jc(e) {
  return e > 0 && (e & e - 1) === 0;
}
const ur = /* @__PURE__ */ new Map();
function Vc(e) {
  const t = ur.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let c = 0; c < n; c += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return ur.set(e, r), r;
}
function Ki(e, t, n = !1) {
  const r = e.length;
  ne(r === t.length, "FFT real and imaginary buffers must have the same length"), ne(jc(r), "FFT input length must be a power of two");
  const i = Vc(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const c = e[o];
    e[o] = e[a], e[a] = c;
    const s = t[o];
    t[o] = t[a], t[a] = s;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, c = (n ? 2 : -2) * Math.PI / o, s = Math.cos(c), d = Math.sin(c);
    for (let l = 0; l < r; l += o) {
      let m = 1, S = 0;
      for (let b = 0; b < a; b += 1) {
        const T = l + b, E = T + a, I = e[E], A = t[E], k = m * I - S * A, R = m * A + S * I, P = e[T], u = t[T];
        e[T] = P + k, t[T] = u + R, e[E] = P - k, t[E] = u - R;
        const h = m * s - S * d;
        S = m * d + S * s, m = h;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Ui(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function $c(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Uc,
  maxFramesPerTable: r = zc
} = {}) {
  const i = Float32Array.from(e);
  ne(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  ne(o > 0, "Source wavetable files must contain at least one frame"), ne(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && ne(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let c = 0; c < o; c += 1) {
    const s = c * n, d = s + n;
    a.push(Ui(i.slice(s, d)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function fr(e) {
  const t = Ui(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Ki(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function zi(e, t, {
  mipLevelCount: n = It
} = {}) {
  const r = e?.real?.length ?? 0;
  ne(r > 0, "Spectrum must contain real samples"), ne(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), ne(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let c = 1; c <= i; c += 1) {
    o[c] = e.real[c], a[c] = e.imaginary[c];
    const s = (r - c) % r;
    s !== c && (o[s] = e.real[s], a[s] = e.imaginary[s]);
  }
  return Ki(o, a, !0), Float32Array.from(o);
}
const $t = "articulationSnapshot", j = 128, mr = 48, Bc = 1e6, H = -1, Bt = [
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
function On(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Ht(e) {
  return On(Number.isFinite(e) ? e : 0, 0, 1);
}
function q(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return On(Number.isFinite(i) ? i : t, n, r);
}
function B(e, t, n, r) {
  return On(Math.round(q(e, t)), n, r);
}
function ji(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function qt() {
  return Array.from({ length: j }, () => H);
}
function Hc(e) {
  const t = B(e, 0, 0, j - 1), n = Bt[t % Bt.length], r = Math.floor(t / Bt.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function qc() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Rn,
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
function Wc(e) {
  const t = qc(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: q(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: q(n.pan, t.pan, -1, 1),
    octave: B(n.octave, t.octave, -4, 4),
    semitone: B(n.semitone, t.semitone, -12, 12),
    fineCents: q(n.fineCents, t.fineCents, -100, 100),
    volumeDb: q(
      n.volumeDb,
      t.volumeDb,
      nn,
      Mi
    ),
    mute: B(n.mute, t.mute, 0, 1),
    solo: B(n.solo, t.solo, 0, 1),
    warpMode: B(n.warpMode, t.warpMode, 0, 4),
    warpAmount: q(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: B(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: q(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: q(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: q(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: B(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: q(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: q(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: q(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: q(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: q(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: B(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: B(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: B(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: q(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: q(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      Ht(Number(r[0])),
      Ht(Number(r[1])),
      Ht(Number(r[2]))
    ]
  };
}
function Gc(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: q(t.amount, 0, -48, 48)
  } : null;
}
function Yc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(Gc).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Wc(t.parameters),
    envelopes: [0, 1, 2].map((i) => Ci(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Jc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = B(n.runtimeSlot, t, 0, j - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Hc(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Yc(n.snapshot)
  };
}
function Qc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: B(n.note, 0, 0, j - 1),
    articulationId: r
  } : null;
}
function Xc(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let c = B(o.min, i, i, j - 1), s = B(o.max, c, i, j - 1);
  return s < c && ([c, s] = [s, c]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: c,
    max: s
  };
}
function hr(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < i.length; c += 1) {
    const s = Xc(
      i[c],
      t,
      c,
      n,
      r
    );
    !s || o.has(s.id) || (o.add(s.id), a.push(s));
  }
  return a;
}
function Zc(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Qc(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function el(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let s = 0; s < n.length && o.length < j; s += 1) {
    const d = Jc(n[s], s);
    !d || r.has(d.runtimeSlot) || i.has(d.id) || (r.add(d.runtimeSlot), i.add(d.id), o.push(d));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((s) => s.id === t.selectedSlotId) ? t.selectedSlotId : null, c = new Set(o.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ji(t.activeTriggerMode),
    slots: o,
    chainAssignments: hr(t.chainAssignments, c, "chain", 0),
    keyAssignments: Zc(t.keyAssignments, c),
    velocityAssignments: hr(t.velocityAssignments, c, "velocity", 1)
  };
}
function pr(e) {
  const t = (n) => U.map(() => n);
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
    volumeDbs: t(Rn),
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
    msegMorphs: Array.from({ length: Ze }, () => 0),
    routeAmounts: Array.from({ length: Ti }, () => 0),
    envelopeAttackSeconds: Array.from({ length: De }, (n, r) => Le(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: De }, (n, r) => Le(r).decaySeconds),
    envelopeSustain: Array.from({ length: De }, (n, r) => Le(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: De }, (n, r) => Le(r).releaseSeconds)
  };
}
function gr(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === H && (e[o] = i);
  }
}
function tl(e) {
  const t = el(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = qt(), i = qt(), o = qt();
  gr(r, t.chainAssignments, n), gr(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const c = n.get(a.articulationId);
    c === void 0 || i[a.note] !== H || (i[a.note] = c);
  }
  return o[0] = H, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Vi(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : tl(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ji(t.activeMode),
    chain: Array.from({ length: j }, (n, r) => B(t.chain?.[r], H, H, j - 1)),
    key: Array.from({ length: j }, (n, r) => B(t.key?.[r], H, H, j - 1)),
    velocity: Array.from({ length: j }, (n, r) => r === 0 ? H : B(t.velocity?.[r], H, H, j - 1))
  });
}
function nl(e, t) {
  const n = Vi(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const we = "articulations.v4", wn = [
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
], _n = [
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
], rl = [
  ...U.flatMap((e) => wn.map(
    (t) => `osc${e}.${t}`
  )),
  ..._n
];
class $i extends Error {
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
  return Ge(new $i("malformed", e));
}
function et(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Dn(e, t, n) {
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
function St(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < j;
}
function il(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function ol(e) {
  return rl.some((t) => t === e);
}
function vr(e, t) {
  if (!et(e))
    return F(`${t} must be an object`);
  const n = Dn(e, ["min", "max"], t);
  return n !== null ? F(n) : St(e.min) ? St(e.max) ? e.min > e.max ? F(`${t}.min must be less than or equal to ${t}.max`) : je({ min: e.min, max: e.max }) : F(`${t}.max must be an integer in 0..127`) : F(`${t}.min must be an integer in 0..127`);
}
function al(e, t) {
  if (!et(e))
    return F(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return F(`${t} has a non-string parameter id`);
    if (!ol(r))
      return F(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return F(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return je(n);
}
function sl(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function cl() {
  return {};
}
function ll(e, t, n) {
  if (!et(e))
    return F(`${t} must be an object`);
  const r = cl();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return F(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > mr)
      return F(
        `${t}.${i} must be a finite route amount within ±${mr}`
      );
    if (!n.has(i))
      return F(`${t}.${i} does not name a current articulable mapping`);
    sl(r, i, o);
  }
  return je(r);
}
function dl(e, t, n) {
  const r = `slots[${t}]`;
  if (!et(e))
    return F(`${r} must be an object`);
  const i = Dn(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return F(i);
  if (typeof e.id != "string")
    return F(`${r}.id must be a string`);
  if (!St(e.runtimeSlot))
    return F(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return F(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return F(`${r}.color must be a string`);
  if (!St(e.key))
    return F(`${r}.key must be an integer in 0..127`);
  const o = vr(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = vr(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const c = al(e.overrides, `${r}.overrides`);
  if (c._tag === "err")
    return c;
  const s = ll(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : je({
    id: e.id,
    runtimeSlot: e.runtimeSlot,
    name: e.name,
    color: e.color,
    key: e.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: c.value,
    routeAmounts: s.value
  });
}
const ul = Object.fromEntries(
  wn.map((e, t) => [e, 2 ** t])
), fl = Object.fromEntries(
  _n.map((e, t) => [e, 2 ** t])
);
function yr(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function ml(e, t) {
  return wn.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | ul[r] : n, 0);
}
function hl(e) {
  return _n.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | fl[n] : t, 0);
}
function pl(e, t) {
  const n = (o, a) => yr(e, `osc${o}.${a}`), r = (o) => yr(e, o), i = Array.from(
    { length: Ti },
    () => Bc
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const c = t[o];
    c !== void 0 && (i[c] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: U.map((o) => ml(e, o)),
    sharedOverrideMask: hl(e),
    framePositions: U.map((o) => n(o, "framePosition")),
    pans: U.map((o) => n(o, "pan")),
    octaves: U.map((o) => n(o, "octave")),
    semitones: U.map((o) => n(o, "semitone")),
    fineCents: U.map((o) => n(o, "fineCents")),
    phases: U.map((o) => n(o, "phase")),
    phaseRandoms: U.map((o) => n(o, "phaseRandom")),
    retriggers: U.map((o) => n(o, "retrigger")),
    volumeDbs: U.map((o) => n(o, "volumeDb")),
    mutes: U.map((o) => n(o, "mute")),
    solos: U.map((o) => n(o, "solo")),
    warpModes: U.map((o) => n(o, "warpMode")),
    warpAmounts: U.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: U.map((o) => n(o, "unisonVoices")),
    unisonDetunes: U.map((o) => n(o, "unisonDetune")),
    unisonBlends: U.map((o) => n(o, "unisonBlend")),
    unisonWidths: U.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: U.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: U.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: U.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: U.map((o) => n(o, "unisonWarpSpread")),
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
function gl(e, t) {
  return e.slots.map((n) => pl(n, t));
}
function vl(e, t) {
  if (!et(e))
    return F("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return F('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Ge(new $i(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Dn(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return F(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return F("selectedSlotId must be null or a string");
  if (!il(e.activeTriggerMode))
    return F('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return F("slots must be an array");
  if (e.slots.length > j)
    return F(`slots must contain at most ${j} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const c = dl(e.slots[a], a, t);
    if (c._tag === "err")
      return c;
    const s = c.value;
    if (i.has(s.id))
      return F(`slots[${a}].id duplicates "${s.id}"`);
    if (o.has(s.runtimeSlot))
      return F(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    i.add(s.id), o.add(s.runtimeSlot), r.push(s);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? F(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : je({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function Bi() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function yl(e) {
  const t = Array.from({ length: j }, () => H), n = Array.from({ length: j }, () => H), r = Array.from({ length: j }, () => H);
  for (const i of e.slots) {
    n[i.key] === H && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === H && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === H && (r[o] = i.runtimeSlot);
  }
  return r[0] = H, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
const an = "runtimeState";
function Hi(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Il = {
  endpointID: an,
  required: !0,
  mapValue: Hi
}, Ir = "runtimeInstallAck", qi = "runtimeSyncRequest", sn = 0, Sl = 8e3, bt = /* @__PURE__ */ new WeakMap(), Wi = 1e9;
let ot = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Wi;
function bl(e) {
  return ot = ot % Wi + 1, e === "modulation" ? -1e9 - ot : 1e9 + ot;
}
function Tl(e, t) {
  const n = e, r = bt.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), bt.set(n, r);
}
function Sr(e, t) {
  const n = e, r = bt.get(n);
  r?.delete(t), r?.size === 0 && bt.delete(n);
}
const El = [100, 250, 500, 1e3], at = { _tag: "accepted" }, Al = { _tag: "superseded" }, kl = { _tag: "stopped" }, br = { _tag: "transport-timeout" };
function Rl(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, c = r.rejectedSerial, s = r.rejectionReason, d = r.syncSerial;
  return ![
    i,
    o,
    a,
    c,
    s,
    d
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number" || typeof d != "number" || i < 0 || o < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: c,
    rejectionReason: s,
    syncSerial: d
  };
}
function xl(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Tr {
  #o;
  #t;
  #m;
  #b;
  #h = !1;
  #d = /* @__PURE__ */ new Set();
  #n = null;
  #a = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #u = 0;
  #i = /* @__PURE__ */ new Map();
  #f = 0;
  #r = !1;
  #s = 0;
  #p = /* @__PURE__ */ new Set();
  #T = this.#O.bind(this);
  constructor(t, n) {
    this.#o = t, this.#t = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#m = r && r.length > 0 ? r : [...El], this.#b = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Sl)
    );
  }
  start() {
    if (!this.#r) {
      Tl(this.#o, this.#t);
      try {
        this.#f += 1, this.#r = !0, this.#a = null, this.#c.clear(), this.#o.addEndpointListener?.(Ir, this.#T);
      } catch (t) {
        throw this.#r = !1, Sr(this.#o, this.#t), t;
      }
    }
  }
  stop() {
    if (this.#r) {
      this.#r = !1;
      for (const t of this.#d) t();
      this.#o.removeEndpointListener?.(Ir, this.#T), Sr(this.#o, this.#t), this.#i.clear(), this.#a = null, this.#c.clear(), this.#S();
    }
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    if (n !== this.#n) {
      for (const r of this.#d) r();
      this.#n = n, this.#a = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#i.clear(), this.#s += 1, this.#S();
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
    const t = this.#n, n = this.#f;
    return this.#r ? t === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#E(t, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(t) {
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
      const i = await this.#E(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of t) {
        const c = await this.#x(
          a,
          n,
          r
        );
        if (c._tag === "rejected" && this.#t === "articulation") {
          o ??= c;
          continue;
        }
        if (c._tag !== "accepted")
          return c;
      }
      return o ?? at;
    } finally {
      this.#h = !1;
    }
  }
  #A(t) {
    return this.#t === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #k(t, n) {
    const r = this.#A(t);
    return this.#t === "modulation" ? r >= n : r <= n;
  }
  #R() {
    const t = this.getAcceptedFrontier();
    return this.#t === "modulation" ? t + 1 : t - 1;
  }
  async #E(t, n) {
    if (this.#a === t)
      return at;
    const r = bl(this.#t);
    this.#c.add(r);
    const i = Date.now() + this.#b;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#l(t, n);
        if (a)
          return a;
        if (this.#a === t)
          return at;
        const c = i - Date.now();
        if (c <= 0)
          return br;
        const s = this.#s;
        this.#y(r), await this.#I(
          s,
          Math.min(this.#v(o), c)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #x(t, n, r) {
    const i = this.#R(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const c = () => {
      a = !0;
      for (const l of o) l();
      o.clear();
    }, s = {
      get aborted() {
        return a;
      },
      onAbort(l) {
        return a ? l() : o.add(l), () => {
          o.delete(l);
        };
      }
    };
    this.#d.add(c);
    const d = async () => {
      this.#l(n, r) || ("submit" in t ? await t.submit({ dspSessionId: n, deliverySerial: i, signal: s }) : this.#M(t.endpointID, xl(t.value, n, i)));
    };
    try {
      let l = 0, m = 0, S = this.#u;
      for (await d(); ; ) {
        const b = this.#l(n, r);
        if (b)
          return b;
        const T = this.#g(n, i, S);
        if (T !== null)
          return T;
        const E = this.#s;
        await this.#I(
          E,
          this.#v(l)
        );
        const I = this.#g(
          n,
          i,
          S
        );
        if (I !== null)
          return I;
        let A = this.#s;
        for (this.#y(i); ; ) {
          const k = this.#l(n, r);
          if (k)
            return k;
          const R = await this.#I(
            A,
            this.#v(l)
          ), P = this.#g(
            n,
            i,
            S
          );
          if (P !== null)
            return P;
          if (R && this.#e?.dspSessionId === n && this.#e.syncSerial === i) {
            if (m >= 1)
              return br;
            S = this.#u, await d(), m += 1, l += 1;
            break;
          }
          if (R) {
            A = this.#s;
            continue;
          }
          R || (l += 1, A = this.#s, this.#y(i));
        }
      }
    } catch (l) {
      const m = this.#l(n, r);
      if (m) return m;
      throw l;
    } finally {
      c(), this.#d.delete(c);
    }
  }
  #g(t, n, r) {
    const i = this.#e;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#i.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#i.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#k(i, n) ? (this.#i.delete(n), at) : null;
  }
  #l(t, n) {
    return !this.#r || this.#f !== n ? kl : this.#n !== t ? Al : null;
  }
  #v(t) {
    return this.#m[Math.min(
      t,
      this.#m.length - 1
    )];
  }
  #M(t, n) {
    try {
      this.#o.sendEventOrValue?.(
        t,
        n,
        void 0,
        sn
      );
    } catch {
    }
  }
  #y(t) {
    if (this.#r)
      try {
        this.#o.sendEventOrValue?.(
          qi,
          t,
          void 0,
          sn
        );
      } catch {
      }
  }
  #O(t) {
    const n = Rl(t);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#a === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#e = n, this.#u += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#i.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#u
      }); this.#i.size > 16; ) {
        const i = this.#i.keys().next().value;
        if (i === void 0) break;
        this.#i.delete(i);
      }
    this.#s += 1, this.#S();
  }
  #I(t, n) {
    return !this.#r || this.#s !== t ? Promise.resolve(!0) : new Promise((r) => {
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
  #S() {
    for (const t of [...this.#p])
      t.finish(!0);
  }
}
const Ml = 1e3, Ol = [be, we];
function Er(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Wt(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (Er(r, t)) return r[t];
  if (Er(n, t)) return n[t];
}
function Gt(e, t) {
  if (e === void 0) return Bi();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = vl(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Ar(e) {
  return new Set(e.routes.flatMap((t) => Ai(t) === null ? [] : [t.id]));
}
function kr(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Rr(e, t) {
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
class wl {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Tr(t, { laneKind: "modulation" }), this.articulationLane = new Tr(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = yt();
  articulationBank = Bi();
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
    { length: j },
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
    return this.frameworkInput ? [we] : Ol;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(an, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(an, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = Wt(t, be), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: yt() } : Qe(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${be} is invalid; boot state was not installed.`);
      const a = Wt(t, we), c = Gt(a, /* @__PURE__ */ new Set());
      c !== null && (this.articulationBank = c, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = Wt(t, we), o = Gt(
      i,
      Ar(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${we} is invalid; boot state was not installed.`);
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
    if (t === be) {
      const i = Qe(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${be}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Gt(n, Ar(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${we}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = Hi(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(qi, 0, void 0, sn), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, c = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, s = this.frameworkInput?.curveCommand ? dr(r, c, this.frameworkInput.curveCommand) : dr(r, c), d = await this.modulationLane.sendBatch(s);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", d, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const I = Rr("modulation", d);
      I && o?.(I), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, i), m = Array.from({ length: j }, (I, A) => {
      const k = l.get(A);
      return k ? kr(k) : null;
    }), S = this.lastAppliedArticulationGeneration !== n, b = S && this.articulationLane.getAcceptedFrontier() !== 0, T = [];
    for (let I = 0; I < j; I += 1) {
      const A = l.get(I), k = m[I] !== this.lastAppliedArticulationTokens[I];
      b ? T.push({
        endpointID: $t,
        value: A ?? pr(I)
      }) : S ? A && T.push({ endpointID: $t, value: A }) : k && T.push({
        endpointID: $t,
        value: A ?? pr(I)
      });
    }
    const E = await this.articulationLane.sendBatch(T);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", E, m)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = m;
        const I = yl(i);
        if (this.frameworkInput) {
          const A = await this.frameworkInput.publishTriggerConfig(I);
          if (!this.started || t !== this.lifecycleEpoch) return;
          A.kind !== "cancelled" && o?.(A);
        } else
          nl(I, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const A of T) this.lastAppliedArticulationTokens[A.value.selectorA] = void 0;
        const I = Rr("articulation", E);
        I && o?.(I);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = Ai(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      gl(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = kr(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ml));
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
async function Gi(e, t, n, r = {}) {
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
const _l = 3, Dl = (4 + Ye) * 4;
function Ll(e, t, n) {
  return Gi(e, {
    input: _l + t.slotIndex * 2 + t.shapeIndex,
    byteLength: Dl
  }, (r) => {
    new Int32Array(r.buffer, r.byteOffset, 4).set([1297302855, t.dspSessionId, t.deliverySerial, Ye]), Ii(t.shape, new Float32Array(
      r.buffer,
      r.byteOffset + 16,
      Ye
    ));
  }, { signal: n });
}
function Nl(e, t, n, r) {
  return {
    submit: async ({ dspSessionId: i, deliverySerial: o, signal: a }) => {
      const c = await Ll(
        e,
        { slotIndex: t, shapeIndex: n, shape: r, dspSessionId: i, deliverySerial: o },
        a
      );
      a.onAbort(c.cancel);
    }
  };
}
function Cl(e) {
  return {
    key: be,
    eventEndpoints: ["modulationMsegBuffer", "modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
    hostEffects: ["cosimo.articulation-trigger-config"],
    create(t) {
      let n = !1, r = 0, i;
      function o(a) {
        const c = Object.freeze({ ...a.scope });
        let s = !0, d = a;
        const l = /* @__PURE__ */ new Set();
        function m() {
          s && (s = !1, l.clear(), E.stop());
        }
        function S(I) {
          s && (m(), t.onDefect(I));
        }
        const b = (I) => s ? t.publish(c, I) : { kind: "cancelled" }, T = {
          addEndpointListener: (I, A) => e.addEndpointListener?.(I, A),
          removeEndpointListener: (I, A) => e.removeEndpointListener?.(I, A),
          addStoredStateValueListener: (I) => e.addStoredStateValueListener?.(I),
          removeStoredStateValueListener: (I) => e.removeStoredStateValueListener?.(I),
          requestFullStoredState: e.requestFullStoredState?.bind(e),
          requestStoredStateValue: e.requestStoredStateValue?.bind(e),
          sendEventOrValue(I, A) {
            const k = b({ kind: "event", endpoint: I, value: A });
            k.kind === "submitted" && (l.add(k.completion), k.completion.then((R) => {
              l.delete(k.completion), !(!s || R.kind === "sent") && (m(), R.kind === "failed" && t.onStatus(d, R));
            }, (R) => {
              l.delete(k.completion), S(R);
            })), k.kind === "failed" && k.error.kind !== "transport" && (m(), t.onStatus(d, k));
          }
        }, E = new wl(T, {
          onDefect: S,
          curveCommand: (I, A, k) => Nl(e, I, A, k),
          async publishTriggerConfig(I) {
            const A = await Promise.all(l);
            l.clear();
            const k = A.find((P) => P.kind !== "sent");
            if (k) return k;
            const R = b({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Vi(I) });
            return R.kind === "submitted" ? R.completion : R;
          }
        });
        return { scope: c, service: E, get closed() {
          return !s;
        }, setTarget(I) {
          d = I;
        }, close: m };
      }
      return {
        replace(a, c) {
          if (n) return;
          const s = ++r, d = Qe(a.value);
          if (d._tag === "err") {
            t.onStatus(c, { kind: "failed", error: { kind: "engine-rejected", message: "Invalid modulation engine value." } });
            return;
          }
          (!i || i.closed || i.scope.owner !== c.scope.owner || i.scope.document !== c.scope.document) && (i?.close(), i = o(c));
          const l = i;
          l.setTarget(c), t.onStatus(c, { kind: "preparing" }), !(n || s !== r || l.closed) && (l.service.replaceModulation(d.value, (m) => t.onStatus(c, m)), !(n || s !== r || l.closed) && l.service.start());
        },
        cancel() {
          r += 1, i?.close(), i = void 0;
        },
        async stop() {
          n || (n = !0, r += 1, i?.close(), i = void 0);
        }
      };
    }
  };
}
const Yi = 13, Ln = 5, Ji = 8, Pl = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Nn = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    Z("globalFilter")
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
    Z("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    Z("ott")
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
    Z("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    Z("flanger")
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
    Z("phaser")
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
    Z("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    Z("reverb")
  ]
}), Qi = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Fl = Object.freeze([
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
]), Kl = Object.freeze({
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
function Ul(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function Xi(e, t) {
  const n = {};
  for (const c of Nn[e]) {
    const s = t[c];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[c] = s;
      continue;
    }
    const d = Kl[c];
    if (d === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${c}`);
    n[c] = d;
  }
  const i = [
    ...Qi.chorus,
    Z("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((c) => i.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Ul(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Zi(e) {
  return Nn[e];
}
function zl(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Ln)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * Ji + Pl[e];
}
function jl(e, t) {
  const n = new Array(Yi).fill(0), r = Xi(e, t);
  return Nn[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const Vl = "lane.v1", $l = "laneTopology", xr = "laneSlotParams", Bl = "laneOutputControl", cn = 16, Hl = 8, eo = 4, ql = 3, to = Ln * Ji, no = 4, Wl = 4, Gl = to, Yl = to + no, Jl = 0, Ql = 1, Xl = 2, Zl = 3, ed = 4, td = 5;
function nd(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > eo)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << Hl;
}
const Tt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Et = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), ro = new Map(
  Object.entries(Et).map(([e, t]) => [t, e])
), rd = Object.freeze({
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
  Tt.map((e) => [rd[e], e])
);
const id = Object.freeze([
  "voice.filterCutoff",
  Oi,
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
]), od = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Oi]: "enhancer-frequency",
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
  id.map((e) => [e, Object.freeze({
    id: e,
    family: od[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const io = 40, oo = 18e3, ln = Tt.map((e) => Et[e]), ad = /^([a-zA-Z]+)#([1-9][0-9]*)$/, sd = /^(parallel|split)#([1-9][0-9]*)$/;
function _t(e) {
  if (typeof e != "string")
    return null;
  const t = ad.exec(e);
  if (t === null)
    return null;
  const n = ln.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Ln ? null : { deviceType: n, instanceNumber: r };
}
function ao(e) {
  if (typeof e != "string")
    return null;
  const t = sd.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? no : Wl) ? null : { groupKind: n, unitNumber: r };
}
function Te(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Pe(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function K(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function cd(e, t) {
  const n = _t(e);
  if (n === null)
    return { failure: K(`device id ${e} is not a pool instance`) };
  if (!Te(t) || !Pe(t, ["params"]) || !Te(t.params))
    return { failure: K(`device ${e} must be { params }`) };
  const r = Zi(n.deviceType), i = ro.get(n.deviceType);
  if (i === void 0)
    return { failure: K(`device ${e} has no effect descriptor`) };
  const o = oi(i).parameters.map((b) => b.endpointID), a = t.params, c = Object.keys(a), s = (b) => c.length === b.length && c.every((T) => b.includes(T)), d = Z(n.deviceType), l = [
    ...Qi[n.deviceType],
    d
  ], m = [
    ...Fl,
    d
  ];
  if (!(c.includes(d) && (s(r) || s(o) || s(l) || n.deviceType === "chorus" && s(m))))
    return { failure: K(`device ${e} must carry every parameter once`) };
  for (const b of c) {
    const T = a[b];
    if (typeof T != "number" || !Number.isFinite(T))
      return { failure: K(`device ${e}.${b} must be a finite number`) };
  }
  return { record: { params: Xi(n.deviceType, a) } };
}
function ld(e, t) {
  return !Te(e) || e.kind !== "device" ? { failure: K("branches may hold device placements only") } : Pe(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: K(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: K(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: K("a device placement is { kind, deviceId, enabled }") };
}
function Mr(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= io && e <= oo;
}
function so() {
  return { mix: 1, bypassed: !1 };
}
function dd(e) {
  return !Te(e) || !Pe(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function ud(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (l) {
      const m = l instanceof Error ? l.message : String(l);
      return K(`is not valid JSON: ${m}`);
    }
  if (!Te(t) || !Pe(t, ["format", "version", "output", "devices", "chain"]))
    return K("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return K("must be cosimo.lane version 2");
  if (!Te(t.devices))
    return K("devices must be an object");
  if (!Array.isArray(t.chain))
    return K("chain must be an array");
  const n = dd(t.output);
  if (n === null)
    return K("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(t.devices)) {
    if (typeof l != "string")
      return K("device ids must be strings");
    const m = cd(l, t.devices[l]);
    if ("failure" in m)
      return m.failure;
    r[l] = m.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), c = [];
  let s = 0;
  const d = (l) => {
    const m = ld(l, i);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), s += 1), m;
  };
  for (const l of t.chain) {
    if (!Te(l))
      return K("chain nodes must be objects");
    if (l.kind === "device") {
      const R = d(l);
      if ("failure" in R)
        return R.failure;
      c.push(R.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return K(`unknown chain node kind ${String(l.kind)}`);
    const m = l.kind === "split", S = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], T = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], E = m && Pe(l, S);
    if (!Pe(l, T) && !E)
      return K(`a ${l.kind} group is { ${T.join(", ")} }`);
    const I = ao(l.groupId);
    if (I === null || I.groupKind !== l.kind)
      return K(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return K(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return K(`group ${String(l.groupId)} needs a boolean enable`);
    const A = m ? ql : eo;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > A)
      return K(`group ${String(l.groupId)} needs 2..${A} branches`);
    if (m && (!Mr(l.xoverLowHz) || !Mr(l.xoverHighHz)))
      return K(`group ${String(l.groupId)} crossovers must sit in ${io}..${oo} Hz`);
    if (m && !E && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return K(`group ${String(l.groupId)} Key Track state must be finite`);
    s += 1;
    const k = [];
    for (const R of l.branches) {
      if (!Array.isArray(R))
        return K(`group ${String(l.groupId)} branches must be arrays`);
      const P = [];
      for (const u of R) {
        const h = d(u);
        if ("failure" in h)
          return h.failure;
        P.push(h.placement);
      }
      k.push(P);
    }
    c.push(m ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: E ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: E ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: E ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: E ? 0 : l.xoverHighKeyTrackOffsetSemitones,
      branches: k
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: k
    });
  }
  for (const l of i)
    if ((o.get(l) ?? 0) !== 1)
      return K(`device ${l} must be placed exactly once`);
  return s > cn ? K(`flattens to ${s} wire entries; the topology upload holds ${cn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: c } };
}
function fd() {
  const e = {};
  for (const t of Tt) {
    const n = Et[t];
    e[`${n}#1`] = {
      params: Id(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: so(),
    devices: e,
    chain: Tt.map((t) => ({
      kind: "device",
      deviceId: `${Et[t]}#1`,
      enabled: !1
    }))
  };
}
const Or = ["distortion#1", "delay#1", "reverb#1"];
function md() {
  const e = fd(), t = {};
  for (const n of Or) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: so(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && Or.includes(n.deviceId))
  };
}
function hd(e) {
  if (e === void 0)
    return md();
  const t = ud(e);
  return t._tag === "ok" ? t.value : null;
}
function pd(e) {
  return Object.keys(e.devices).map((t) => {
    const n = _t(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => ln.indexOf(t.parsed.deviceType) - ln.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function dn(e) {
  const t = _t(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return zl(t.deviceType, t.instanceNumber - 1);
}
function co(e) {
  const t = ao(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Gl : Yl) + (t.unitNumber - 1);
}
function gd(e) {
  const t = new Array(cn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, c) => {
    t[r] = nd(o, a), c && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(dn(o.deviceId), 0, o.enabled);
      continue;
    }
    i(co(o), o.branches.length, o.enabled), o.branches.forEach((a, c) => {
      for (const s of a)
        i(dn(s.deviceId), c + 1, s.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function vd(e) {
  const t = new Array(Yi).fill(0);
  return t[Jl] = e.xoverLowHz, t[Ql] = e.xoverHighHz, t[Xl] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Zl] = e.xoverLowKeyTrackOffsetSemitones, t[ed] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[td] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function yd(e) {
  const t = [{
    endpointID: Bl,
    value: e.output
  }];
  let n = 0;
  for (const r of pd(e)) {
    const i = _t(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: Ta(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[Z(i.deviceType)]
    }), n += 1, t.push({
      endpointID: xr,
      value: {
        slotId: dn(r.instanceId),
        deliverySerial: n,
        values: jl(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: xr,
      value: {
        slotId: co(r),
        deliverySerial: n,
        values: vd(r)
      }
    }));
  return t.push({
    endpointID: $l,
    value: gd(e)
  }), t;
}
function Id(e) {
  const t = ro.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = oi(t).parameters;
  return Object.fromEntries(Zi(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function Sd(e) {
  return oa(e, {
    stateKey: Vl,
    runtimeEndpointDependencies: [Il],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: hd,
    buildRuntimeEvents: ({ state: t }) => [...yd(t)]
  });
}
const ut = 256, qe = 2048, lo = 8, bd = 12811, un = (lo + ut * bd) * 4;
function wr(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Td(e, t, n) {
  if (e.byteLength !== un || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > ut)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    It,
    ut
  ]);
  let i = lo;
  const o = 131071, a = 8191, c = Math.fround(o / 1.5), s = Math.fround(a / 0.5);
  for (let d = 0; d < It; ++d) {
    const l = Math.min(qe, Math.max(256, (1 << d) * 32)), m = qe / l;
    for (let S = 0; S < t.frameCount; ++S) {
      const b = zi(n(S), d), T = i + S * (l + 1);
      for (let E = 0; E <= l; ++E) {
        const I = (E === l ? 0 : E) * m, A = (I + qe - m) % qe, k = (I + m) % qe, R = b[I], P = b[A], u = b[k];
        if (R === void 0 || P === void 0 || u === void 0 || !Number.isFinite(R) || !Number.isFinite(P) || !Number.isFinite(u))
          throw new Error("Wavetable preparation produced invalid samples.");
        const h = Math.fround(0.5 * Math.fround(u - P));
        r[T + E] = wr(R, c, o) & 262143 | wr(h, s, a) << 18;
      }
    }
    i += (l + 1) * ut;
  }
}
const Ed = "runtimeSyncRequest", Ad = 2147483647, kd = "runtimeState", Rd = "retryDesiredTableRequest", xd = "workerLoadFailure", Md = "serviceLoadAbort", Od = "wavetableLoadBegin", wd = "wavetableMipFrame", _d = "wavetableUploadAck", Dd = "wavetableMipRequest", Ld = "wavetablePrewarmRequest", Nd = "wavetablePrewarmNotification", Cd = "assets/factory-bank-catalog.json", fn = 3, Pd = 1, Fd = fn * dt, Kd = 1, Ud = 2, zd = 3, jd = 1, Vd = 2, $d = 2e4, st = Kd, _r = Ud, Dr = zd, le = jd, Lr = Vd, Bd = 48 * 1024 * 1024, Yt = 3;
function Nr(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function V(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function Cr(e) {
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
function Pr(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function Fr(e, t) {
  if (!e)
    throw new Error(t);
}
function Hd(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function qd(e, t) {
  return Kc(await e.readJSON(t));
}
function Wd(e) {
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
function Gd(e, t) {
  const n = Math.round(Number(e) || 0);
  return Hd(n, 0, Math.max(0, t - 1));
}
function Jt(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Yd(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Kr(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function Ur(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function ct() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Jd(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class Qd {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = Ia(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? Cd, this.maxBatchesInFlight = Nr(
      n.maxFramesInFlight,
      Pd
    ), this.mipLevelCount = n.mipLevelCount ?? It, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Bd) || 0)), this.serviceLoadTimeoutMs = Nr(n.serviceLoadTimeoutMs, $d), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, V("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(kd, this.handleRuntimeState), this.connection.addEndpointListener?.(_d, this.handleUploadAck), this.connection.addEndpointListener?.(Dd, this.handleMipRequest), this.connection.addEndpointListener?.(Ld, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Nd, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Ed,
      Ad
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await qd(this.resourceClient, this.catalogPath), V("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Yt; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Kr(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Kr(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Jt(
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
          ...Ur(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (V("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Dr,
          failureReasonCode: Lr
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== Dr || t.failureReasonCode !== Lr ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = st,
    failureReasonCode: c = le
  }) {
    this.connection.sendEventOrValue?.(xd, {
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
    failureReasonCode: o = le
  }) {
    this.connection.sendEventOrValue?.(Md, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    V("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? Cr(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(Rd, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = Gd(t, r.tables.length), o = r.tables[i];
    Fr(o, `Could not resolve table ${i}`);
    const a = Yd(o, dt, this.mipLevelCount), c = this.tableCache.get(a);
    if (c)
      return c.lastUsedSerial = this.cacheUseSerial++, V("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: c.frameCount,
        cacheBytes: this.tableCacheBytes
      }), c;
    const s = ct();
    V("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(o.sourceWav), l = $c(d.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: dt
    });
    return V("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(ct() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: l.frameCount,
      frames: l.frames,
      spectra: new Array(l.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, r) {
    if (V("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(Od, {
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
    const n = ct();
    try {
      if (await Gi(this.connection, {
        input: t.oscillatorIndex,
        byteLength: un
      }, (r) => {
        Td(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      V("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: un,
        preparationMs: ct() - n,
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
        failurePhase: _r,
        failureReasonCode: le
      }), this.serviceTable = null, this.clearMipTransferState(), V("error", "Shared wavetable preparation failed", { detail: We(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    V("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: st,
      failureReasonCode: le
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: st,
      failureReasonCode: le
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = st,
    failureReasonCode: r = le
  } = {}) {
    V("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (V("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: We(o)
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
      this.isCurrentRuntimeState(t) && (V("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: We(a)
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
    for (let t = 0; t < Yt; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Jd(() => {
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
        V("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: le
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
    const n = Wd(t ?? {});
    if (V("info", "Received runtime state", Cr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Yt)
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
          i.spectra[a] || (i.spectra[a] = fr(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), V("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        V("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: We(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), c = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Jt(
      n,
      r,
      i,
      o,
      a
    );
    let d = this.mipJobs.get(s);
    return d ? (!d.completed && c > d.urgencyLevel && (d.urgencyLevel = c), d) : (d = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: c,
      ...Ur(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, d), d);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (V("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), c = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), l = Jt(
      r,
      i,
      o,
      a,
      c
    ), m = this.mipJobs.get(l), S = this.serviceTable?.frameCount ?? 0, b = Math.min(
      fn,
      S - s
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(s) || d <= 0 || d !== b)) {
      m.inFlightBatchBases.delete(s);
      for (let T = 0; T < d; T += 1) {
        const E = s + T;
        m.ackedFrames[E] || (m.ackedFrames[E] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === S && m.nextFrameIndex >= S && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Pr(s, d, S) && V("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: c,
        frameIndexBase: s,
        batchFrameCount: d,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: S,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (Fr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = fr(this.serviceTable.frames[t]);
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
        fn,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Fd);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, c = this.getSpectrumForFrame(a), s = zi(c, t.mipIndex);
          i.set(s, o * dt);
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
            failurePhase: _r,
            failureReasonCode: le
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(wd, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Pr(n, r, this.serviceTable.frameCount) && V("info", "Sent wavetable mip batch", {
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
function We(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Xd(e, t = {}) {
  return new Qd(e, t);
}
async function Zd(e, t = {}) {
  return ca(e, [
    Sd,
    () => Xd(e, { ...t, delivery: "shared" }),
    () => ea(Fc, e, {
      bindings: [Cl(e)],
      onDefect: (n) => console.error("Cosimo state failed", We(n))
    })
  ]);
}
export {
  Pd as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Ud as FAILURE_PHASE_BUILD_MIP,
  Kd as FAILURE_PHASE_LOAD_SOURCE,
  zd as FAILURE_PHASE_TRANSFER_MIP,
  jd as FAILURE_REASON_GENERIC,
  Vd as FAILURE_REASON_TIMEOUT,
  fn as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Ad as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Qd as WavetableWorkerController,
  Xd as createWavetableWorkerController,
  Zd as default
};
