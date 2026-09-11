function co() {
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
function Cn(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function Pn(e) {
  let t = !1, n, r;
  const i = /* @__PURE__ */ new Set();
  async function o(c, s, d) {
    const { signal: l } = d;
    if (e.onStatus(s, { kind: "preparing" }), l.aborted) return;
    const m = await Cn(e.prepare(c, l), l);
    if (m.kind === "cancelled" || l.aborted) return;
    const I = m.value;
    if (I.kind === "error") {
      e.onStatus(s, { kind: "failed", error: I.error });
      return;
    }
    let T = !0;
    d.applying = !0;
    let E;
    try {
      E = await Cn(e.transport.apply(I.value, {
        signal: l,
        send: (S) => l.aborted || !T ? { kind: "cancelled" } : S()
      }), l);
    } catch (S) {
      l.aborted || (t = !0, n?.cancel(), e.transport.stop(), e.onDefect(S), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      T = !1, d.applying = !1;
    }
    E.kind === "value" && !l.aborted && E.value.kind !== "cancelled" && e.onStatus(s, E.value);
  }
  function a(c, s) {
    r = void 0;
    const d = n, l = { ...co(), applying: !1, target: s };
    if (n = l, d?.cancel(), t || l.signal.aborted) return;
    const m = o(c, s, l).catch((I) => {
      l.signal.aborted || (l.cancel(), e.onDefect(I), e.onStatus(s, {
        kind: "failed",
        error: { kind: "defect", message: "Engine update failed unexpectedly." }
      }));
    });
    i.add(m), m.then(() => {
      if (i.delete(m), n !== l) return;
      n = void 0;
      const I = r;
      r = void 0, !t && I && a(I.input, I.target);
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
let lo = 0;
function Fn(e, t) {
  const n = `atom${++lo}`, r = {
    toString() {
      return n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = uo, r.write = fo), r;
}
function uo(e) {
  return e(this);
}
function fo(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Kr = "a", me = "m", Et = "i", Ae = "c", fn = "q", mn = "Q", he = "h", Ur = "R", zr = "W", jr = "I", Vr = "M", re = "e", Ke = "f", ke = "C", Ue = "r", hn = "d", At = "w", kt = "D", Rt = "t", xt = "T", pn = "v", Kn = "g", Un = "s", zn = "b", mo = "B", gn = "p", $r = "H", Br = "A", vn = "E";
function Hr(e) {
  return "init" in e;
}
function ho(e) {
  return typeof e.write == "function";
}
function po(e) {
  return !!e.onMount;
}
function jn(e) {
  return "v" in e || "e" in e;
}
function ut(e) {
  if ("e" in e)
    throw e.e;
  return e.v;
}
function ft(e) {
  return typeof e?.then == "function";
}
function go(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function qr(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function Wr(e, t, n) {
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
function vo(e) {
  return !!e.INTERNAL_onInit;
}
const yo = (e, t, n, ...r) => n.read(...r), Io = (e, t, n, ...r) => n.write(...r), So = (e, t, n) => n.INTERNAL_onInit(t), bo = (e, t, n, r) => n.onMount?.(r), To = (e, t, n) => {
  const r = e[Kr];
  let i = r.get(n);
  if (!i) {
    const o = e[he], a = e[jr];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), vo(n) && a(e, t, n);
  }
  return i;
}, Eo = (e, t) => {
  const n = e[me], r = e[Ae], i = e[fn], o = e[mn], a = e[he], c = e[ke];
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
      const I = n.get(m)?.l;
      if (I)
        for (const T of I)
          l.add(T);
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
}, Ao = (e, t) => {
  const n = e[me], r = e[Et], i = e[Ae], o = e[re], a = e[Ue], c = e[kt];
  if (!i.size)
    return;
  const s = [], d = [], l = /* @__PURE__ */ new WeakSet(), m = /* @__PURE__ */ new WeakSet(), I = [], T = [];
  for (const E of i)
    I.push(E), T.push(o(e, t, E));
  for (; I.length; ) {
    const E = I.length - 1, S = I[E], b = T[E];
    if (m.has(S)) {
      I.pop(), T.pop();
      continue;
    }
    if (l.has(S)) {
      r.get(S) === b.n && (s.push(S), d.push(b)), m.add(S), I.pop(), T.pop();
      continue;
    }
    l.add(S);
    for (const A of Wr(S, b, n))
      l.has(A) || (I.push(A), T.push(o(e, t, A)));
  }
  for (let E = s.length - 1; E >= 0; --E) {
    const S = s[E], b = d[E];
    let A = !1;
    for (const k of b.d.keys())
      if (k !== S && i.has(k)) {
        A = !0;
        break;
      }
    A && (r.set(S, b.n), a(e, t, S), c(e, t, S)), r.delete(S);
  }
};
const ko = (e, t, n) => {
  const r = e[me], i = e[Et], o = e[Ae], a = e[he], c = e[Ur], s = e[re], d = e[Ke], l = e[ke], m = e[Ue], I = e[kt], T = e[pn], E = e[$r], S = e[vn], b = s(e, t, n), A = S[0];
  if (jn(b)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== b.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      b.m === A
    )
      return b.m = A, b;
    let f = !1;
    for (const [R, L] of b.d)
      if (m(e, t, R).n !== L) {
        f = !0;
        break;
      }
    if (!f)
      return b.m = A, b;
  }
  let k = !0;
  const x = new Set(b.d.keys()), F = () => {
    for (const f of x)
      b.d.delete(f);
  }, u = () => {
    if (r.has(n)) {
      const f = !o.size;
      I(e, t, n), f && (l(e, t), d(e, t));
    }
  }, h = (f) => {
    if (f === n) {
      const L = s(e, t, f);
      if (!jn(L))
        if (Hr(f))
          T(e, t, f, f.init);
        else
          throw new Error("no atom init");
      return ut(L);
    }
    const R = m(e, t, f);
    try {
      return ut(R);
    } finally {
      x.delete(f), b.d.set(f, R.n), ft(b.v) && qr(n, b.v, R), r.has(n) && r.get(f)?.t.add(n), k || u();
    }
  };
  let p;
  const v = {
    get signal() {
      return p || (p = new AbortController()), p.signal;
    }
  }, y = b.n, g = i.get(n) === y;
  try {
    const f = c(e, t, n, h, v);
    if (T(e, t, n, f), ft(f)) {
      E(e, t, f, () => p?.abort());
      const R = () => {
        F(), u();
      };
      f.then(R, R);
    } else
      F();
    return a.r?.(n), b.m = A, b;
  } catch (f) {
    if (go(f))
      throw f;
    return delete b.v, b.e = f, ++b.n, b.m = A, b;
  } finally {
    k = !1, b.n !== y && g && (i.set(n, b.n), o.add(n), a.c?.(n));
  }
}, Ro = (e, t, n) => {
  const r = e[me], i = e[Et], o = e[re], a = [n];
  for (; a.length; ) {
    const c = a.pop(), s = o(e, t, c);
    for (const d of Wr(c, s, r)) {
      const l = o(e, t, d);
      i.get(d) !== l.n && (i.set(d, l.n), a.push(d));
    }
  }
}, xo = (e, t, n, r) => {
  const i = e[Ae], o = e[he], a = e[zr], c = e[re], s = e[Ke], d = e[ke], l = e[Ue], m = e[hn], I = e[At], T = e[kt], E = e[pn], S = e[vn];
  let b = !0;
  const A = (x) => ut(l(e, t, x)), k = (x, ...F) => {
    const u = c(e, t, x);
    try {
      if (x === n) {
        if (!Hr(x))
          throw new Error("atom not writable");
        const h = u.n, p = F[0];
        E(e, t, x, p), T(e, t, x), h !== u.n && (++S[0], i.add(x), m(e, t, x), o.c?.(x));
        return;
      } else
        return I(e, t, x, F);
    } finally {
      b || (d(e, t), s(e, t));
    }
  };
  try {
    return a(e, t, n, A, k, ...r);
  } finally {
    b = !1;
  }
}, Mo = (e, t, n) => {
  const r = e[me], i = e[Ae], o = e[he], a = e[re], c = e[hn], s = e[Rt], d = e[xt], l = a(e, t, n), m = r.get(n);
  if (m && l.d.size > 0) {
    for (const [I, T] of l.d)
      if (!m.d.has(I)) {
        const E = a(e, t, I);
        s(e, t, I).t.add(n), m.d.add(I), T !== E.n && (i.add(I), c(e, t, I), o.c?.(I));
      }
    for (const I of m.d)
      l.d.has(I) || (m.d.delete(I), d(e, t, I)?.t.delete(n));
  }
}, Oo = (e, t, n) => {
  const r = e[me], i = e[fn], o = e[he], a = e[Vr], c = e[re], s = e[Ke], d = e[ke], l = e[Ue], m = e[At], I = e[Rt], T = c(e, t, n);
  let E = r.get(n);
  if (!E) {
    l(e, t, n);
    for (const S of T.d.keys())
      I(e, t, S).t.add(n);
    if (E = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(T.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, E), ho(n) && po(n)) {
      const S = () => {
        let b = !0;
        const A = (...k) => {
          try {
            return m(e, t, n, k);
          } finally {
            b || (d(e, t), s(e, t));
          }
        };
        try {
          const k = a(e, t, n, A);
          k && (E.u = () => {
            b = !0;
            try {
              k();
            } finally {
              b = !1;
            }
          });
        } finally {
          b = !1;
        }
      };
      i.add(S);
    }
    o.m?.(n);
  }
  return E;
}, wo = (e, t, n) => {
  const r = e[me], i = e[mn], o = e[he], a = e[re], c = e[xt], s = a(e, t, n);
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
}, _o = (e, t, n, r) => {
  const i = e[re], o = e[Br], a = i(e, t, n), c = "v" in a, s = a.v;
  if (ft(r))
    for (const d of a.d.keys())
      qr(n, r, i(e, t, d));
  a.v = r, delete a.e, (!c || !Object.is(s, a.v)) && (++a.n, ft(s) && o(e, t, s));
}, Do = (e, t, n) => {
  const r = e[Ue];
  return ut(r(e, t, n));
}, Lo = (e, t, n, ...r) => {
  const i = e[Ae], o = e[Ke], a = e[ke], c = e[At], s = i.size;
  try {
    return c(e, t, n, r);
  } finally {
    i.size !== s && (a(e, t), o(e, t));
  }
}, No = (e, t, n, r) => {
  const i = e[Ke], o = e[ke], a = e[Rt], c = e[xt], d = a(e, t, n).l;
  return d.add(r), o(e, t), i(e, t), () => {
    d.delete(r), c(e, t, n), o(e, t), i(e, t);
  };
}, Co = (e, t, n, r) => {
  const i = e[gn];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, Po = (e, t, n) => {
  e[gn].get(n)?.forEach((o) => o());
}, Fo = /* @__PURE__ */ new WeakMap();
function Ko(e) {
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
    [Kr]: /* @__PURE__ */ new WeakMap(),
    [me]: /* @__PURE__ */ new WeakMap(),
    [Et]: /* @__PURE__ */ new WeakMap(),
    [Ae]: /* @__PURE__ */ new Set(),
    [fn]: /* @__PURE__ */ new Set(),
    [mn]: /* @__PURE__ */ new Set(),
    [he]: {},
    // atom interceptors
    [Ur]: yo,
    [zr]: Io,
    [jr]: So,
    [Vr]: bo,
    // building-block functions
    [re]: To,
    [Ke]: Eo,
    [ke]: Ao,
    [Ue]: ko,
    [hn]: Ro,
    [At]: xo,
    [kt]: Mo,
    [Rt]: Oo,
    [xt]: wo,
    [pn]: _o,
    // store api
    [Kn]: Do,
    [Un]: Lo,
    [zn]: No,
    [mo]: void 0,
    // abortable promise support
    [gn]: /* @__PURE__ */ new WeakMap(),
    [$r]: Co,
    [Br]: Po,
    // store epoch
    [vn]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  Fo.set(t, r);
  const i = r[Kn], o = r[Un], a = r[zn];
  return t;
}
function Uo() {
  return Ko();
}
function Q(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function Gr(e, t = 1 / 0) {
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
function Yr() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= Gr(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function Jt(e) {
  const t = Yr(), n = (r, i) => {
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
function ue(e) {
  return typeof e == "string" && e.length > 0 && Gr(e) <= 256;
}
function yn(e) {
  return Q(e) && ue(e.owner) && J(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function zo(e) {
  if (!Q(e) || !J(e.id)) return;
  const t = yn(e.scope);
  return t ? Object.freeze({ scope: t, id: e.id }) : void 0;
}
function jo(e) {
  const t = yn(e);
  return t && Q(e) && J(e.client) && J(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function Vn(e) {
  if (!Q(e) || !Array.isArray(e.parameters) || !Q(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!Q(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s } = n;
    if (!ue(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function Vo(e) {
  if (Q(e)) {
    if (e.kind === "undo" || e.kind === "redo") {
      const t = zo(e.expectedEntry);
      return e.expectedEntry !== void 0 && !t ? void 0 : { kind: e.kind, ...t ? { expectedEntry: t } : {} };
    }
    if (ue(e.key)) {
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
function $o(e) {
  if (!Jt(e) || !Q(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && J(e.request) && ue(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && ue(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = yn(e.scope);
  if (e.kind === "opened" && t && J(e.request)) {
    const n = Vn(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = Vn(e.native);
    if (n && (e.changedStoredKey === void 0 || ue(e.changedStoredKey)))
      return { kind: "ok", value: {
        kind: "replaced",
        scope: t,
        native: n,
        ...e.changedStoredKey === void 0 ? {} : { changedStoredKey: e.changedStoredKey }
      } };
  }
  if (e.kind === "parameter" && t && ue(e.endpoint) && typeof e.value == "number")
    return { kind: "ok", value: { kind: "parameter", scope: t, endpoint: e.endpoint, value: e.value } };
  if (e.kind === "detach" && t && J(e.client) && J(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && J(e.request) && J(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = jo(e.address);
    if (n) {
      const r = Vo(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && J(e.request) && Q(e.result)) {
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && ue(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function $n(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, i]) => {
    const o = t.fields[r];
    return !o || !("value" in o) ? [r, o] : [r, { ...o, value: i.kind === "stored" ? i.codec.encode(o.value) : o.value }];
  }));
  return { ...t, fields: n };
}
function Bn(e) {
  const t = Yr(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
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
const Bo = (e) => ({ kind: "failed", error: { kind: "transport", message: e } }), Ho = (e, t) => Q(e) && e.owner === t.owner && e.document === t.document;
function qo(e, t = {}) {
  let n = 0, r = !1;
  const i = /* @__PURE__ */ new Map(), o = t.timeoutMs ?? 1e4;
  function a(d) {
    if (!Q(d) || typeof d.request != "number") return;
    const l = i.get(d.request);
    if (!(!l || !Ho(d.scope, l.scope))) {
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
  function s(d, l, m, I, T) {
    return r || I.aborted ? Promise.resolve({ kind: "cancelled" }) : new Promise((E) => {
      let S = () => {
      }, b;
      const A = (k) => {
        i.delete(d) && (clearTimeout(b), S(), E(k));
      };
      if (i.set(d, { scope: m, matches: T, finish: A }), S = I.onAbort(() => A({ kind: "cancelled" })), !!i.has(d)) {
        b = setTimeout(() => A({ kind: "failed", reason: "reply-timeout" }), o);
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
    async replace(d, l, m, I) {
      if (r || I.aborted) return { kind: "cancelled" };
      if (!(l instanceof Float32Array) || !l.every(Number.isFinite))
        return { kind: "failed", error: { kind: "engine-rejected", message: "Shared data requires finite Float32 samples." } };
      const T = Object.freeze({ ...m.scope }), E = ++n;
      let S = !1;
      const b = (A) => A.kind === "cancelled" ? A : Bo(A.kind === "failed" ? `Data delivery failed: ${A.reason}.` : "Unexpected data delivery reply.");
      try {
        const A = await s(
          E,
          { kind: "begin", input: d, generation: m.generation, sampleCount: l.length },
          T,
          I,
          (x) => x.kind === "ready"
        );
        if (A.kind !== "ready") return b(A);
        for (let x = 0; x < l.length; x += 8192) {
          const F = await s(
            ++n,
            {
              kind: "write",
              transfer: A.transfer,
              offset: x,
              samples: Array.from(l.subarray(x, x + 8192))
            },
            T,
            I,
            (u) => u.kind === "written" && u.transfer === A.transfer && u.offset === Math.min(x + 8192, l.length)
          );
          if (F.kind !== "written") return b(F);
        }
        const k = await s(
          ++n,
          { kind: "commit", transfer: A.transfer },
          T,
          I,
          (x) => x.kind === "applied" && x.transfer === A.transfer && x.input === d && x.generation === m.generation
        );
        return k.kind !== "applied" ? b(k) : (S = !0, { kind: "acknowledged", engineSession: `${T.owner}:${T.document}`, operation: String(E) });
      } finally {
        if (!S) try {
          c({ kind: "cancel", request: ++n, scope: T, beginRequest: E });
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
function ge(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function tt(e, t) {
  return Object.freeze({ scope: e, id: t.order });
}
function Hn(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function ve(e, t, n = 0, r, i, o) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {} });
}
function Wo(e, t) {
  const n = Uo(), r = {};
  for (const u of Object.keys(e)) r[u] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = Fn({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    past: [],
    future: [],
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map()
  }), o = Fn((u) => u(i).snapshot);
  let a = !1, c, s = 0, d = !1, l, m = [];
  const I = [], T = () => n.get(o), E = (u, h, p = u.past, v = u.future) => ({
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
        ...u.snapshot.scope && p.length > 0 ? { undoEntry: tt(u.snapshot.scope, p[p.length - 1]) } : {},
        ...u.snapshot.scope && v.length > 0 ? { redoEntry: tt(u.snapshot.scope, v[v.length - 1]) } : {}
      })
    })
  }), S = (u) => {
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
      const f = h.snapshot.fields[y.key], R = !h.snapshot.scope || !ge(p, h.snapshot.scope);
      if (!(R || !f || f.readiness.kind !== g.readiness.kind || "value" in g && (!("value" in f) || !Object.is(g.value, f.value)) || y.dependencies.some((D) => {
        const w = h.snapshot.fields[D], N = v[D];
        return w !== N && (!w || !N || !("value" in w) || !("value" in N) || !Object.is(w.value, N.value));
      }))) {
        const D = g.application ?? f?.application, w = f?.target ?? g.target;
        v[y.key] = g.application === D && g.target === w ? g : Object.freeze({ ...g, ...D ? { application: D } : {}, ...w ? { target: w } : {} });
        continue;
      }
      const _ = Object.freeze({ scope: p, key: y.key, generation: R ? 0 : (f?.target?.generation ?? -1) + 1 }), C = {};
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
  }, b = (u, h, p) => {
    const v = e[h];
    return (v?.kind === "stored" ? v.codec.equals(p.before, p.after) : Object.is(p.before, p.after)) ? u : [...u, { key: h, before: p.before, after: p.after, order: p.order }].sort((g, f) => g.order - f.order);
  }, A = (u, h, p, v, y, g) => {
    const f = e[h], R = u.snapshot.fields[h];
    if (!f || !R || !u.snapshot.scope)
      return { kind: "rejected", reason: "not-ready" };
    const L = "value" in R ? R : void 0;
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
    const M = (L?.version ?? 0) + 1, D = ++s, w = new Map(u.publications).set(D, { key: h, version: M }), N = E(u, { ...u.snapshot.fields, [h]: ve(p, { kind: f.kind === "parameter" ? "host-managed" : "pending" }, M, L?.metadata, L?.gesture, f.kind === "parameter" ? { kind: "pending" } : void 0) }, v, y), $ = {
      kind: "accepted",
      revision: N.snapshot.revision,
      version: M,
      ...g !== "history" ? { changed: !0 } : {},
      ...g === "edit" && !u.gestures.has(h) && v.length > 0 ? { historyEntry: tt(u.snapshot.scope, v[v.length - 1]) } : {}
    };
    return l = $, S({ ...N, publications: w }), a || t.native.publish({ request: D, scope: u.snapshot.scope, operations: C }), $;
  }, k = (u) => {
    const h = n.get(i);
    if (u.kind === "opened" || u.kind === "replaced") {
      if (h.snapshot.scope && (u.kind === "opened" || u.scope.owner !== h.snapshot.scope.owner || u.scope.document <= h.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const p = {}, v = /* @__PURE__ */ new Map();
      for (const [g, f] of Object.entries(e))
        if (f.kind === "parameter") {
          const R = u.native.parameters.find((L) => L.endpoint === f.endpoint);
          if (R && Hn(R)) {
            v.set(g, Object.freeze({ ...R }));
            const { min: L, max: _, step: C, defaultValue: M } = R;
            p[g] = ve(R.value, { kind: "host-managed" }, 0, Object.freeze({ min: L, max: _, step: C, defaultValue: M }), void 0, { kind: "unconfirmed" });
          } else p[g] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: R ? "invalid-state" : "missing-parameter" }) });
        } else {
          const R = Object.hasOwn(u.native.values, g), L = R ? f.codec.parse(u.native.values[g]) : f.initial;
          if (L.kind === "ok") p[g] = ve(L.value, { kind: R ? "observed-in-native-state" : "not-written" });
          else {
            const _ = h.snapshot.fields[g], C = u.kind === "replaced" && u.changedStoredKey !== void 0 && _ && "value" in _;
            p[g] = Object.freeze({
              readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }),
              version: 0,
              ...C ? { value: _.value, persistence: Object.freeze({ kind: "failed", reason: "invalid-state" }) } : {}
            });
          }
        }
      const y = E(h, p, [], []);
      S({ ...y, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), editOrder: 0, parameters: v, snapshot: Object.freeze({ ...y.snapshot, scope: Object.freeze({ ...u.scope }) }) });
    } else if (u.kind === "command") {
      if (!h.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!ge(u.address, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (h.detached.has(u.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (u.command.kind === "undo" || u.command.kind === "redo") {
        if (h.gestures.size > 0) return { kind: "rejected", reason: "busy" };
        const M = u.command.kind === "undo", D = M ? h.past : h.future, w = D[D.length - 1], N = u.command.expectedEntry;
        return N && (!w || !ge(N.scope, h.snapshot.scope) || N.id !== w.order) ? { kind: "rejected", reason: "stale-history" } : w ? A(
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
          const et = g.value;
          w.set(p, { ...$, before: et, after: et, order: 0 });
        } else f && (w.delete(p), N = b(N, p, f), N !== h.past && (W = tt(h.snapshot.scope, { ...f })));
        const Ve = E({ ...h, gestures: w }, {
          ...h.snapshot.fields,
          [p]: ve(g.value, g.persistence, g.version, g.metadata, $, g.application)
        }, N), $e = {
          kind: "accepted",
          revision: Ve.snapshot.revision,
          version: g.version,
          ...W ? { historyEntry: W } : {}
        };
        return l = $e, S({ ...Ve, gestures: w }), a || v.kind === "parameter" && t.native.publish({
          request: ++s,
          scope: h.snapshot.scope,
          operations: [{ kind: D ? "gesture-start" : "gesture-end", endpoint: v.endpoint }]
        }), $e;
      }
      const { value: R, expectedVersion: L } = u.command;
      if (u.command.gesture !== void 0 && (!f || f.gesture !== u.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (f && u.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (L !== void 0 && L !== g.version) return { kind: "rejected", reason: "stale-version" };
      let _;
      if (v.kind === "parameter") {
        const M = h.parameters.get(p);
        if (!M) return { kind: "rejected", reason: "not-ready" };
        if (typeof R != "number" || !Number.isFinite(R)) return { kind: "rejected", reason: "invalid-value" };
        const D = Math.min(M.max, Math.max(M.min, R));
        if (_ = M.step > 0 ? Math.min(M.max, Math.max(M.min, M.min + Math.round((D - M.min) / M.step) * M.step)) : D, Object.is(g.value, _)) return { kind: "accepted", revision: h.snapshot.revision, version: g.version, changed: !1 };
      } else {
        const M = v.codec.parse(R);
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
      if (!p?.target || !ge(p.target.scope, u.target.scope) || p.target.generation !== u.target.generation) return { kind: "accepted", revision: h.snapshot.revision };
      S(E(h, {
        ...h.snapshot.fields,
        [u.target.key]: Object.freeze({ ...p, application: Object.freeze({ ...u.status }) })
      }));
    } else if (u.kind === "detached") {
      if (!h.snapshot.scope || !ge(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (h.detached.has(u.client)) return { kind: "accepted", revision: h.snapshot.revision };
      const p = new Map(h.gestures), v = { ...h.snapshot.fields }, y = [];
      let g = h.past;
      for (const [R, L] of h.gestures) {
        if (L.client !== u.client) continue;
        p.delete(R), g = b(g, R, L);
        const _ = v[R];
        _ && "value" in _ && (v[R] = ve(_.value, _.persistence, _.version, _.metadata, void 0, _.application));
        const C = e[R];
        C?.kind === "parameter" && y.push({ kind: "gesture-end", endpoint: C.endpoint });
      }
      const f = p.size === h.gestures.size ? h : E({ ...h, gestures: p }, v, g);
      return l = { kind: "accepted", revision: f.snapshot.revision }, S({ ...f, gestures: p, detached: new Set(h.detached).add(u.client) }), !a && y.length > 0 && t.native.publish({ request: ++s, scope: h.snapshot.scope, operations: y }), l;
    } else if (u.kind === "parameter") {
      if (!h.snapshot.scope || !ge(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [p, v] of h.parameters) {
        if (v.endpoint !== u.endpoint) continue;
        if (!Hn({ ...v, value: u.value })) return { kind: "rejected", reason: "invalid-value" };
        const y = h.snapshot.fields[p];
        if (!y || !("value" in y)) continue;
        const g = Object.is(y.value, u.value) ? h : E(h, {
          ...h.snapshot.fields,
          [p]: ve(u.value, { kind: "host-managed" }, y.version + 1, y.metadata, y.gesture, { kind: "unconfirmed" })
        });
        S(g);
      }
    } else {
      if (!h.snapshot.scope || !ge(u.scope, h.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const p = h.publications.get(u.request);
      if (p) {
        const v = new Map(h.publications);
        v.delete(u.request);
        const y = h.snapshot.fields[p.key];
        if (y && "value" in y && y.version === p.version) {
          const g = u.result.kind === "observed" ? { kind: e[p.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: u.result.reason }, f = e[p.key]?.kind === "parameter" ? u.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: u.result.reason }) } : y.application, R = E(h, { ...h.snapshot.fields, [p.key]: ve(y.value, g, y.version, y.metadata, y.gesture, f) });
          S({ ...R, publications: v });
        } else S({ ...h, publications: v });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, x = (u) => {
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
      const { gesture: R, ...L } = "value" in f ? f : { ...f, gesture: void 0 };
      y[g] = Object.freeze({ ...L, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...E(v, y), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
    } catch (g) {
      t.onDefect(g);
    }
    if (u)
      try {
        t.native.update(T(), u);
      } catch (g) {
        t.onDefect(g);
      }
    t.native.close({ reason: "service-closed" });
  }, F = () => {
    if (!d) {
      d = !0;
      try {
        for (let u = I.shift(); u; u = I.shift()) {
          l = void 0, m = [];
          let h, p = !1;
          try {
            h = a ? { kind: "rejected", reason: "service-closed" } : k(u.event), l = h;
            for (const v of m)
              a || v();
            a || (p = !0, t.native.update(T(), u.event.kind === "command" ? { address: u.event.address, result: h } : void 0));
          } catch (v) {
            h = l ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(v), x(!p && u.event.kind === "command" ? { address: u.event.address, result: h } : void 0);
          }
          u.finish(h);
        }
      } finally {
        d = !1;
      }
    }
  };
  return {
    getSnapshot: T,
    subscribe: (u) => n.sub(o, () => u(T())),
    dispatch: (u) => new Promise((h) => {
      I.push({ event: u, finish: h }), F();
    }),
    stop: () => (x(), c ?? Promise.resolve())
  };
}
const Go = 5e3;
function X(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function Yo(e, t) {
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
function Jo(e, t, n) {
  let r = !1, i = !1, o, a = 0, c = 0, s, d, l, m = () => {
  }, I = () => {
  };
  const T = /* @__PURE__ */ new Map(), E = (p) => {
    if (!Jt(p)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: p });
  }, S = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new WeakMap(), A = [];
  for (const [p, v] of Object.entries(e)) {
    if (v.kind !== "stored" || v.engine?.kind !== "event-value") continue;
    const y = v.engine, g = Pn({
      async prepare(f, R) {
        const L = await y.prepare(f.value, { parameters: f.parameters, signal: R }), _ = Bn(L);
        return _.kind === "ok" ? { kind: "ok", value: { target: f.target, value: _.value } } : { kind: "error", error: { kind: "engine-rejected", message: _.message } };
      },
      transport: {
        apply(f, R) {
          return new Promise((L) => {
            let _ = 0, C = () => {
            };
            const M = (D) => {
              C(), S.delete(_), L(D);
            };
            C = R.signal.onAbort(() => M({ kind: "cancelled" }));
            try {
              const D = R.send(() => X(k.getSnapshot().scope, f.target.scope) ? (_ = ++a, S.set(_, { kind: "event-value", key: p, scope: f.target.scope, finish: M }), E({
                kind: "publish",
                request: _,
                scope: f.target.scope,
                operations: [{ kind: "event", endpoint: y.endpoint, value: f.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              D.kind !== "sent" && M(D);
            } catch (D) {
              C(), S.delete(_), n.onDefect(D), u(), L({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const f of S.values()) f.key === p && f.finish({ kind: "cancelled" });
        }
      },
      onStatus(f, R) {
        k.dispatch({ kind: "engine", target: f, status: R });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: p,
      dependencies: y.dependencies,
      replace(f, R) {
        g.replace({ ...f, target: R }, R);
      },
      cancel: g.cancel,
      stop: g.stop
    });
  }
  const k = Wo(e, {
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(p) {
        const v = ++a;
        T.set(v, { request: p.request, scope: p.scope }), E({ kind: "publish", ...p, request: v });
      },
      update(p, v) {
        p.scope && E({
          kind: "update",
          scope: p.scope,
          revision: p.revision,
          state: $n(e, p),
          ...v ? { receipt: v } : {}
        });
      },
      close(p) {
        i = !0, o?.stop();
        for (const v of S.values()) v.finish({ kind: "cancelled" });
        I(new Error("State service closed before native initialization completed."));
        try {
          r && k.getSnapshot().scope && E({ kind: "close", ...p });
        } catch (v) {
          n.onDefect(v);
        }
        r && t.removeEventListener("kit_state", F), r = !1, T.clear();
      }
    }
  }), x = (p) => {
    if (i) return;
    const v = $o(p);
    if (v.kind === "invalid") {
      const g = new Error(v.message);
      n.onDefect(g), I(g), u();
      return;
    }
    const y = v.value;
    if (y.kind === "closed")
      I(new Error(`Native state service closed: ${y.reason}`)), u();
    else if (y.kind === "open-failed") {
      if (y.request !== c || k.getSnapshot().scope) return;
      I(new Error(`Native state open failed: ${y.reason}`)), u();
    } else if (y.kind === "opened") {
      if (y.request !== c || k.getSnapshot().scope) return;
      k.dispatch(y).then((g) => {
        g.kind === "accepted" ? m() : I(new Error("Native state could not initialize the service."));
      });
    } else if (y.kind === "attached-client") {
      const g = k.getSnapshot();
      X(g.scope, y.scope) && E({
        kind: "snapshot",
        scope: y.scope,
        to: y.client,
        attachRequest: y.request,
        revision: g.revision,
        state: $n(e, g)
      });
    } else if (y.kind === "detach")
      k.dispatch({ kind: "detached", scope: y.scope, client: y.client });
    else if (y.kind === "parameter")
      X(k.getSnapshot().scope, y.scope) && k.dispatch(y);
    else if (y.kind === "replaced")
      k.dispatch(y).then((g) => {
        if (g.kind !== "accepted") return;
        const f = k.getSnapshot().scope;
        for (const R of S.values())
          X(f, R.scope) || R.finish({ kind: "cancelled" });
        for (const [R, L] of T)
          X(f, L.scope) || T.delete(R);
      });
    else if (y.kind === "command")
      k.dispatch(y);
    else if (y.kind === "invalid-command")
      X(k.getSnapshot().scope, y.address) && E({
        kind: "receipt",
        address: y.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const g = S.get(y.request);
      if (g) {
        if (!X(g.scope, y.scope) || !X(k.getSnapshot().scope, y.scope)) return;
        if (g.kind === "custom" && y.result.kind === "failed" && (y.result.reason === "stale-scope" || y.result.reason === "closed")) {
          g.finish({ kind: "cancelled" });
          return;
        }
        g.finish(y.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: y.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: y.result.reason } });
        return;
      }
      const f = T.get(y.request);
      if (!f || !X(f.scope, y.scope) || !X(k.getSnapshot().scope, y.scope)) return;
      T.delete(y.request), k.dispatch({ ...y, request: f.request });
    }
  }, F = (p) => {
    if (!i)
      try {
        x(p);
      } catch (v) {
        n.onDefect(v), I(v), u();
      }
  }, u = () => l || (i = !0, I(new Error("State service stopped before native initialization completed.")), l = k.stop(), l), h = () => Object.entries(e).flatMap(([p, v]) => {
    if (v.kind !== "stored" || v.engine?.kind !== "prepared") return [];
    const y = v.engine, g = y.delivery;
    if (!g || typeof g.create != "function" || g.replacement !== void 0 && g.replacement !== "supersede" && g.replacement !== "finish")
      throw new Error("Invalid prepared delivery factory or replacement policy.");
    const f = g.create.bind(g), R = g.replacement, L = Object.freeze([...g.dataInputs ?? []]);
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
        const M = f(), D = Pn({
          replacement: R,
          async prepare(w, N) {
            return { kind: "ok", value: { value: await y.prepare(w.value, { parameters: w.parameters, signal: N }), target: w.target } };
          },
          transport: {
            async apply(w, N) {
              let $ = !0;
              const W = /* @__PURE__ */ new Set(), Ve = () => {
                for (const G of W) G();
              }, $e = N.signal.onAbort(Ve), et = {
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
                    return L.includes(G) ? !$ || N.signal.aborted || !X(k.getSnapshot().scope, w.target.scope) ? Promise.resolve({ kind: "cancelled" }) : (o ??= qo(t), o.replace(G, ie, w.target, et)) : Promise.resolve({ kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } });
                  },
                  send(G) {
                    if (!$ || N.signal.aborted) return { kind: "cancelled" };
                    const ie = C.publish(w.target.scope, G);
                    if (ie.kind === "submitted") {
                      const pe = b.get(ie.completion);
                      pe && (W.add(pe), ie.completion.then(() => W.delete(pe)));
                    }
                    return ie;
                  },
                  listen(G, ie) {
                    if (!_?.includes(G)) throw new Error("Undeclared engine output endpoint.");
                    if (!$ || N.signal.aborted) return () => {
                    };
                    let pe = !0;
                    const Nn = (ao) => {
                      if (!(!pe || N.signal.aborted))
                        try {
                          ie(ao);
                        } catch (so) {
                          C.onDefect(so);
                        }
                    }, _t = () => {
                      pe && (pe = !1, W.delete(_t), t.removeEndpointListener?.(G, Nn));
                    };
                    return W.add(_t), t.addEndpointListener?.(G, Nn), _t;
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
        }, I = (y) => {
          clearTimeout(d), v(y);
        };
      });
      try {
        const p = Yo(e, [...h(), ...n.bindings ?? []]);
        if (p.some((v) => v.outputEndpoints?.length) && (typeof t.addEndpointListener != "function" || typeof t.removeEndpointListener != "function"))
          throw new Error("Declared engine output listeners are unavailable.");
        for (const v of p) {
          const y = v.create({
            publish(g, f) {
              if (i || !X(k.getSnapshot().scope, g)) return { kind: "cancelled" };
              const R = Object.freeze({ owner: g.owner, document: g.document });
              if (!f || typeof f != "object" || f.kind !== "event" && f.kind !== "host-effect")
                return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
              if (!(f.kind === "event" ? v.eventEndpoints.includes(f.endpoint) : v.hostEffects?.includes(f.name))) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
              const _ = Bn(f.value);
              if (_.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: _.message } };
              const C = f.kind === "event" ? { kind: "event", endpoint: f.endpoint, value: _.value } : { kind: "host-effect", name: f.name, value: _.value }, M = { kind: "publish", request: a + 1, scope: R, operations: [C] };
              if (!Jt(M)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
              const D = ++a;
              let w = ($) => {
              };
              const N = new Promise(($) => {
                w = (W) => {
                  S.delete(D), b.delete(N), $(W);
                };
              });
              b.set(N, () => w({ kind: "cancelled" })), S.set(D, { kind: "custom", key: v.key, scope: R, finish: w });
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
        r = !0, t.addEventListener("kit_state", F), c = ++a, d = setTimeout(() => {
          I(new Error("Cmajor state-channel is unavailable: native open timed out.")), u();
        }, Go), E({
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
        n.onDefect(p), I(p), u();
      }
      return s;
    },
    /** Release this owner and its channel resources. */
    stop: u
  };
}
const Jr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), Qt = Reflect.get(globalThis, Jr), qn = Qt instanceof WeakMap ? Qt : /* @__PURE__ */ new WeakMap();
Qt !== qn && Object.defineProperty(globalThis, Jr, { value: qn });
const Qo = 2e3;
function Wn(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Gn(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Xo(e, t) {
  if (!Gn(e))
    return { found: !1 };
  const n = Gn(e.values) ? e.values : void 0;
  return n && Wn(n, t) ? {
    found: !0,
    value: n[t]
  } : Wn(e, t) ? {
    found: !0,
    value: e[t]
  } : { found: !1 };
}
function Yn(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class Zo {
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
    this.connection = t, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = ea(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const i = Xo(n, this.stateKeys[r]);
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
    }, i = Yn(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), c = Yn({
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
        this.options.sendTimeoutMilliseconds ?? Qo
      );
    this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function ea(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e)
    t.has(n.endpointID) || t.set(n.endpointID, n);
  return [...t.values()];
}
function ta(e, t) {
  return new Zo(e, t);
}
class na {
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
function ra(e, t) {
  return new na(e, t);
}
async function ia(e, t) {
  const n = ra(e, t);
  return await n.start(), n;
}
function Dt(e) {
  return Object.freeze({ kind: "parameter", endpoint: e });
}
function oa(e) {
  const t = Object.freeze({ ...e.codec });
  return Object.freeze({ kind: "stored", initial: t.parse(e.initial), codec: t, ...e.engine ? { engine: e.engine } : {} });
}
function aa(e) {
  return Object.freeze({ ...e });
}
function ee(e, t) {
  if (!e)
    throw new Error(t);
}
function Lt(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function sa(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function Xt(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Qr(e) {
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
function ca() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function Nt(e, t) {
  const n = ca();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (sa(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function Jn(e) {
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
  throw new Error(`Unsupported text resource payload (${Qr(e)})`);
}
function la(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return Xt(e);
  throw new Error(`Unsupported binary resource payload (${Qr(e)})`);
}
function da(e) {
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
function Xr(e) {
  const t = new DataView(e);
  ee(Lt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), ee(Lt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, c = null, s = null, d = 12;
  for (; d + 8 <= t.byteLength; ) {
    const m = Lt(t, d, 4), I = t.getUint32(d + 4, !0), T = d + 8;
    m === "fmt " ? (n = t.getUint16(T, !0), r = t.getUint16(T + 2, !0), i = t.getUint32(T + 4, !0), a = t.getUint16(T + 12, !0), o = t.getUint16(T + 14, !0)) : m === "data" && (c = T, s = I), d = T + I + I % 2;
  }
  ee(n !== null, "Wave file is missing a fmt chunk"), ee(c !== null && s !== null, "Wave file is missing a data chunk"), ee(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && o === 32)
    l = new Float32Array(e.slice(c, c + s));
  else if (n === 1 && o === 16) {
    const m = s / 2, I = new Int16Array(e.slice(c, c + s));
    l = new Float32Array(m);
    for (let T = 0; T < m; T += 1)
      l[T] = I[T] / 32768;
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
async function Qn(e) {
  ee(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return ee(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function Zt(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Zr(e) {
  const t = new Uint8Array(e).buffer, n = Xr(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function ua(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (s) => (ee(typeof e.readResource == "function", `Resource bridge cannot read ${s}`), e.readResource(s)), i = async (s) => {
    ee(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const d = await e.readResourceAsAudioData(s);
    return da(d);
  }, o = (s) => {
    const d = e.getResourceAddress?.(s);
    return d ?? null;
  }, a = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Nt(s, d), m = await Qn(l), I = Xr(m);
    return {
      sampleRate: I.sampleRate,
      samples: I.samples
    };
  }, c = async (s, d = e.getResourceAddress?.(s)) => {
    const l = Nt(s, d);
    return new Uint8Array(await Qn(l));
  };
  return {
    async readText(s) {
      if (t === "bridge" && typeof e.readResource == "function")
        return Jn(await r(s));
      const d = o(s);
      return t === "url" && d !== null ? Zt(await c(s, d)) : typeof e.readResource == "function" ? Jn(await r(s)) : Zt(await c(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof e.readResource == "function" ? la(await r(s)) : c(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(s);
      const d = o(s);
      return n === "url" && d !== null ? a(s, d) : typeof e.readResourceAsAudioData == "function" ? i(s) : Zr(await this.readBytes(s));
    },
    getURL(s) {
      return Nt(s, e.getResourceAddress?.(s));
    }
  };
}
function fa(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return ua(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function ma(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Zt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return Xt(await t(a));
      if (n)
        return Xt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Zr(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function ha(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function pa(e) {
  return ha(e) ? ma(e) : fa(e);
}
const Ne = -100, mt = 35, ga = 5, va = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function ei(e) {
  const t = va.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function Z(e) {
  return ei(e).laneEndpointID;
}
function ya(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > ga)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${ei(e).hostStem}${t}OutputTrimDb`;
}
function ti(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Ia(e) {
  const t = (ti(e, Ne, mt) - Ne) / (mt - Ne);
  return t * t;
}
function Sa(e) {
  const t = Math.sqrt(ti(e, 0, 1));
  return Ne + t * (mt - Ne);
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
    mt,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const ba = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Ta = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Ea = [
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
      O("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: ba.map(Y) }),
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
      O("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Ta.map(Y) }),
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
], Mt = Ea, ni = Object.freeze(
  Mt.flatMap((e) => e.parameters)
);
new Map(
  ni.map((e) => [e.endpointID, e])
);
function ri(e) {
  const t = Mt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function ii() {
  return ni;
}
function In(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const U = ["A", "B", "C"], oi = [
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
], Aa = [
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
]), ka = Object.freeze([
  ...U.flatMap((e) => oi.map(
    (t) => `osc${e}.${t}`
  )),
  ...Aa
]);
new Set(
  U.flatMap((e) => oi.map(
    (t) => `osc${e}.${t}`
  ))
);
const ai = Object.freeze(
  ka.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), Ra = ii().filter(
  (e) => e.modulationTargetIndex !== null
), xa = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Sn(e) {
  const t = Ma(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function Ma(e) {
  const t = xa.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const Oa = [
  ...Ra.map((e) => ({
    kind: Sn(In(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], si = Object.freeze(
  Oa.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), fe = Object.freeze([
  ...ai,
  ...si
]), ct = Re.length, ci = ai.length, Ot = si.length, wa = ct * fe.length, _a = new Map(Re.map((e) => [e.id, e])), li = new Map(Re.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), ze = new Map(fe.map((e) => [e.kind, e]));
function Da() {
  if (ct !== 14 || ci !== 59 || Ot !== 47 || wa !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = Re.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = fe.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (_a.size !== ct || li.size !== ct || ze.size !== fe.length)
    throw new Error("Modulation identities must be unique");
}
Da();
function di(e, t) {
  const n = li.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function bn(e) {
  return typeof e != "string" ? null : ze.has(e) ? e : null;
}
function La(e) {
  const t = bn(e);
  return t !== null && ze.get(t)?.group === "voice" ? t : null;
}
function Tn(e) {
  const t = bn(e);
  return t !== null && ze.get(t)?.group === "rack" ? t : null;
}
function Na(e) {
  const t = ze.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function ui(e) {
  const t = ze.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function Ca(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const fi = 4, Pa = fi * Ot, Fa = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Ka = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function xe(e) {
  if (typeof e != "string")
    return null;
  const t = Ka.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Fa.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function En(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function mi(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function hi(e) {
  if (e === null)
    return null;
  const t = mi(e) - 1;
  return t > fi ? null : t * Ot + ui(En(e));
}
const de = 2048, Ua = de + 3, Xn = 20, pi = "MSEG 1", za = 0, Ie = 2, ja = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function An(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Fe(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Va(e) {
  return An(Number.isFinite(e) ? e : 0, -Xn, Xn);
}
function Ee(e) {
  return An(Number.isFinite(e) ? e : 0, 0, 1);
}
function gi(e = pi) {
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
function en() {
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
function $a(e) {
  const t = Number(e);
  return An(
    Number.isFinite(t) ? t : 1,
    za,
    Ie
  );
}
function Ba(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = Ee(Number(t.startX)), r = Ee(Number(t.endX));
  return Fe(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Ha(e = en()) {
  const t = e && typeof e == "object" ? e : {}, n = t.rate && typeof t.rate == "object" ? t.rate : {}, r = Number(n.seconds), i = t.noteOffPolicy, o = ja.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: $a(Number.isFinite(r) ? r : 1)
    },
    loop: Ba(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function qa(e, t, n) {
  const r = e && typeof e == "object" ? e : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = Ee(i)), {
    x: i,
    y: Ee(Number(r.y)),
    curvePower: Va(Number(r.curvePower))
  };
}
function Ye(e = gi()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => qa(i, o, n.length));
  if (!Fe(r[0].x, 0) || !Fe(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : pi,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Zn(e) {
  return JSON.stringify(Ye(e));
}
function Wa(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function Ga(e, t) {
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
function Ya(e, t) {
  const n = Ee(Number(t)), r = Ga(e, n);
  if (r.laterPointWins || Fe(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Ee(Wa(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function Ja(e, t) {
  return Ya(Ye(e).points, t);
}
function Qa(e) {
  const t = Ye(e), n = new Float32Array(de);
  for (let i = 0; i < de; i += 1) {
    const o = i / (de - 1);
    n[i] = Ja(t, o);
  }
  const r = new Float32Array(Ua);
  return r[0] = n[0], r.set(n, 1), r[de + 1] = n[de - 1], r[de + 2] = n[de - 1], r;
}
function er(e, t) {
  return Zn(e) === Zn(t);
}
const Ct = "modulationProgram", Xa = "modulationAmount", vi = Re.filter((e) => e.group === "voice").length, yi = Re.filter((e) => e.group === "macro").length, ht = ci, Za = Ot, pt = Za + Pa, Se = vi * ht, Oe = yi * ht, es = vi * pt, ts = yi * pt, ye = 512, Me = 256, Ii = Se + Oe;
function ns(e) {
  const t = di(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function rs(e) {
  const t = La(e);
  return t === null ? null : Na(t);
}
function Si(e) {
  const t = rs(e.targetKind), n = Tn(e.targetKind);
  let r = n === null ? void 0 : ui(n);
  if (r === void 0) {
    const a = hi(
      xe(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = di(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const c = a.runtimeIndex;
    if (t !== null) {
      const d = c * ht + t;
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
      cellIndex: c * pt + s,
      sourceIndex: c,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const i = ns(e);
  if (t !== null) {
    const a = i * ht + t;
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
    cellIndex: i * pt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function bi(e) {
  return xe(e.targetKind) !== null ? null : Si(e).articulationCellIndex;
}
function is(e) {
  if (Tn(e.targetKind) !== null)
    return !1;
  const t = xe(e.targetKind);
  return t !== null && hi(t) === null;
}
function os(e) {
  return {
    ...Si(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function Ti(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (is(n))
      continue;
    const r = os(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function as(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function _e(e) {
  return [...e.values()].filter(as).sort((t, n) => t.cellIndex - n.cellIndex);
}
function nt(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function Pt(e) {
  const t = Ti(e), n = _e(t.voice), r = _e(t.macroVoice), i = _e(t.voiceRack), o = _e(t.macroRack), a = Array.from({ length: Se }, () => 0), c = Array.from({ length: Se }, () => 0), s = Array.from({ length: Se }, () => 0), d = Array.from({ length: Se }, () => 0), l = Array.from({ length: Se }, () => 0);
  nt(n, a, c, s, d);
  const m = Array.from({ length: Oe }, () => 0), I = Array.from({ length: Oe }, () => 0), T = Array.from({ length: Oe }, () => 0), E = Array.from({ length: Oe }, () => 0), S = Array.from({ length: Oe }, () => 0);
  if (nt(
    r,
    m,
    I,
    T,
    E
  ), i.length > ye || o.length > Me)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${ye}), ${o.length} macro-rack (max ${Me})`
    );
  const b = Array.from({ length: ye }, () => 0), A = Array.from({ length: ye }, () => 0), k = Array.from({ length: ye }, () => 0), x = Array.from({ length: ye }, () => 0), F = Array.from({ length: ye }, () => 0), u = Array.from({ length: es }, () => 0);
  nt(
    i,
    b,
    A,
    k,
    x
  );
  const h = Array.from({ length: Me }, () => 0), p = Array.from({ length: Me }, () => 0), v = Array.from({ length: Me }, () => 0), y = Array.from({ length: Me }, () => 0), g = Array.from({ length: ts }, () => 0);
  nt(
    o,
    h,
    p,
    v,
    y
  );
  for (const f of t.voice.values()) l[f.cellIndex] = f.amount;
  for (const f of t.macroVoice.values()) S[f.cellIndex] = f.amount;
  for (const f of t.voiceRack.values()) u[f.cellIndex] = f.amount;
  for (const f of t.macroRack.values()) g[f.cellIndex] = f.amount;
  for (let f = 0; f < i.length; f += 1) {
    const R = i[f];
    if (R === void 0) throw new Error(`Missing compiled voice-rack route at index ${f}`);
    F[f] = R.reducer;
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
    macroVoiceRouteSources: I,
    macroVoiceRouteTargets: T,
    macroVoiceRoutePolarities: E,
    macroVoiceRouteAmounts: S,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: b,
    voiceRackRouteSources: A,
    voiceRackRouteTargets: k,
    voiceRackRoutePolarities: x,
    voiceRackRouteReducers: F,
    voiceRackRouteAmounts: u,
    macroRackRouteCount: o.length,
    macroRackRouteCells: h,
    macroRackRouteSources: p,
    macroRackRouteTargets: v,
    macroRackRoutePolarities: y,
    macroRackRouteAmounts: g
  };
}
const ss = ["voice", "macroVoice", "voiceRack", "macroRack"], cs = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function tr(e) {
  return Ti(e);
}
function ls(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function ds(e, t) {
  if (e === null)
    return [{ endpointID: Ct, value: Pt(t) }];
  const n = tr(e), r = tr(t), i = [];
  for (const o of ss) {
    const a = _e(n[o]), c = _e(r[o]);
    if (a.length !== c.length)
      return [{ endpointID: Ct, value: Pt(t) }];
    for (let s = 0; s < c.length; s += 1) {
      const d = a[s], l = c[s];
      if (d === void 0 || l === void 0 || !ls(d, l))
        return [{ endpointID: Ct, value: Pt(t) }];
      d.amount !== l.amount && i.push({
        endpointID: Xa,
        value: {
          pathKind: cs[o],
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
function us(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function fs(e) {
  throw new Error(e ?? "Invariant violated");
}
const ms = "globalTune", hs = "globalTuneSemitones", ce = -24, Be = 24, nr = 0, Ei = -48, Ai = 48, tn = -48, ki = 6, kn = 0, rr = (kn - tn) / (ki - tn), ps = "voiceEnhancerFrequency", gs = "voiceEnhancerQ", vs = "voiceEnhancerAmount", ys = "voiceEnhancerFrequencyOctaves", Is = "voiceEnhancerQ", Ss = "voiceEnhancerAmount", Ri = "voice.enhancerFrequency", bs = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: ps,
    targetKind: ys,
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
    endpointID: gs,
    targetKind: Is,
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
    endpointID: vs,
    targetKind: Ss,
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
function ir(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Ts(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function rt(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Es = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      rt("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      rt("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      rt("mix", "Mix", 100, 100),
      rt("drive", "Drive", 15, 0)
    ]
  }
], or = 1e-6;
function te(e, t) {
  if (!Number.isFinite(e) || e < -or || e > 1 + or)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function gt(e, t) {
  return te(e / 100, `${t} catalog percentage`);
}
function Qe(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function As(e) {
  return 20 * 1e3 ** e;
}
function ks(e) {
  return te(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Rs(e) {
  return 0.1 * 200 ** e;
}
function xs(e) {
  return te(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ms(e) {
  return e;
}
function Os(e) {
  return te(e, "filterMix endpoint conversion");
}
function Ce(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function ws(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Ce("filterCutoff", As, ks),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ce("filterQ", Rs, xs),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ce("filterMix", Ms, Os),
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
function xi(e) {
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
      return us(e);
  }
}
function _s(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ds(e, t) {
  const n = Qe(e.moduleId, t.id), r = xi(t.format), i = ws(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: gt(t.defaultPercent, n),
    initialValue: gt(t.initialPercent, n),
    format: r,
    modAmount: _s(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Ls = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: rr * 100, defaultPercent: rr * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ns(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Cs(e, t) {
  const n = `osc${e}`, r = Qe(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: gt(t.defaultPercent, r),
    initialValue: gt(t.initialPercent, r),
    format: xi(t.format),
    modAmount: Ns(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const Ps = Object.freeze(
  U.flatMap((e) => Ls.map((t) => Cs(e, t)))
), Fs = Object.freeze({
  targetId: Qe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: te(
    (nr - ce) / (Be - ce),
    "Global Tune default"
  ),
  initialValue: te(
    (nr - ce) / (Be - ce),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Be },
  modAmount: {
    min: Ei,
    max: Ai,
    unit: "st",
    digits: 2
  },
  binding: Ce(
    ms,
    (e) => ce + (Be - ce) * e,
    (e) => te(
      (e - ce) / (Be - ce),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: hs
});
function Ks(e) {
  const t = Qe("voice-enhancer", e.key), n = te(
    ir(e, e.initial),
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
      (r) => Ts(e, r),
      (r) => te(
        ir(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Us = Object.freeze(
  Object.values(bs).map(Ks)
), zs = Object.freeze([
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
function js(e) {
  const t = Qe(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => te(
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
const Vs = Object.freeze(
  zs.map(js)
), $s = Object.freeze([
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
function Bs(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function Ft(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? Ia(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return te(n, `${e.endpointID} endpoint conversion`);
}
function Hs(e, t) {
  return e.valueKind === "effect-output-trim-db" ? Sa(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function qs(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Ws(e) {
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
function Gs(e) {
  const t = Bs(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: Ft(e, e.initial),
    initialValue: Ft(e, e.initial),
    format: qs(e),
    modAmount: Ws(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => Hs(e, n),
      fromEngine: (n) => Ft(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : Sn(In(e))
  });
}
const Rn = Object.freeze(
  [
    ...Mt.flatMap((e) => e.parameters.map(Gs)),
    ...$s,
    Fs,
    ...Us,
    ...Ps,
    ...Vs,
    ...Es.flatMap(
      (e) => e.parameters.map(
        (t) => Ds(e, t)
      )
    )
  ]
), Ys = new Map(
  Rn.map((e) => [e.targetId, e])
), Mi = Rn.filter(
  (e) => e.modulationTargetKind !== null
), nn = new Map(
  Mi.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Ys.size !== Rn.length)
  throw new Error("Target descriptor IDs must be unique");
if (Mi.length !== fe.length || nn.size !== fe.length || fe.some((e) => nn.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Kt(e) {
  const t = nn.get(e);
  return t === void 0 ? fs(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  Mt.map((e) => [e.id, e.label])
);
function Js(e) {
  const t = mi(e);
  return t === 1 ? "" : ` ${t}`;
}
function Qs(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = Kt(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = xe(e);
  if (n !== null) {
    const r = Kt(En(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Js(n)} ${r.label.toUpperCase()}`;
  }
  return Kt(e).label.toUpperCase();
}
const be = "modulation.v6", Oi = 6, Xe = 3, De = 3, Xs = 4, ar = "modulationMsegBuffer", Zs = "modulationMsegPlayback", wi = 4, ec = ["MSEG 1", "MSEG 2", "MSEG 3"], _i = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], tc = ["Env 1", "Env 2", "Env 3"], nc = 1e-3, z = 10, rc = 0.1, ic = 20, sr = 10 - 0.1, oc = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: ic - rc },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Ei,
    max: Ai
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
  voiceEnhancerQ: { min: -sr, max: sr },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, ac = ii().filter((e) => e.modulationTargetIndex !== null), sc = new Map(
  ac.map((e) => [
    Sn(In(e)),
    e
  ])
);
class Ut extends Error {
  name = "ModulationStateParseError";
}
const cc = {
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
  label: cc[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const lc = fe.map((e) => ({
  value: e.kind,
  label: Qs(e.kind)
}));
lc.filter((e) => !uc(e.value));
function dc(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function xn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function zt(e, t) {
  const n = Number(e);
  return xn(Number.isFinite(n) ? n : t, nc, z);
}
function uc(e) {
  return Tn(e) !== null;
}
function fc(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function mc(e) {
  const t = xe(e);
  return t !== null ? En(t) : e;
}
function hc(e) {
  const t = mc(e);
  if (xe(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = sc.get(t);
  return n !== void 0 ? fc(n) : oc[Ca(t)];
}
function pc(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function gc(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function vc(e, t) {
  const n = hc(e), r = Number(t);
  return xn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function yc(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function Ic(e) {
  return yc(e) ?? "mseg";
}
function Sc(e) {
  const t = bn(e);
  return t !== null ? t : xe(e) !== null ? e : null;
}
function bc(e) {
  return Sc(e) ?? "oscA.wavetablePosition";
}
function Tc(e, t) {
  const n = _i[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function Ec(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? Xe : e === "macro" ? wi : Xs;
  return xn(Number.isFinite(n) ? n : 1, 1, r);
}
function Le(e) {
  return {
    name: tc[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Di(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = Le(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: zt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: zt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Ee(n.sustain ?? r.sustain),
    releaseSeconds: zt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function Ac(e, t = 0) {
  return { name: Di(e, t).name };
}
function kc(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: pc(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: Ec(n, e.sourceSlot),
    polarity: gc(e.polarity),
    targetKind: r,
    amount: vc(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function Rc(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = Ic(r.sourceKind), o = bc(r.targetKind);
  return kc(r, t, i, o);
}
function xc(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function Mc(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => Rc(n, r));
}
function Oc(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = xc(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function rn(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, c) => rn(a, t[c]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => dc(r, a) && rn(n[a], r[a]));
}
function Li(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = gi(ec[t] ?? `MSEG ${t + 1}`), i = Ye(n.shapeA ?? r), o = Ha({
    ...en(),
    ...n.playback ?? {},
    rate: en().rate
  }), { rate: a, ...c } = o;
  return {
    shapeA: i,
    shapeB: Ye(n.shapeB ?? i),
    playback: c
  };
}
function vt() {
  return {
    format: "cosimo.modulation",
    version: Oi,
    msegSlots: Array.from({ length: Xe }, (e, t) => Li({}, t)),
    envelopeSlots: Array.from({ length: De }, (e, t) => ({
      name: Le(t).name
    })),
    routes: [],
    macroNames: _i.slice()
  };
}
function wc(e = vt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Oi,
    msegSlots: Array.from({ length: Xe }, (o, a) => Li(n[a], a)),
    envelopeSlots: Array.from({ length: De }, (o, a) => Ac(r[a], a)),
    routes: Mc(t.routes),
    macroNames: Array.from(
      { length: wi },
      (o, a) => Tc(i[a], a)
    )
  };
}
function jt(e) {
  const t = Je(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function Je(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Ge(new Ut("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Ge(new Ut("Expected valid modulation JSON"));
    }
  }
  const n = wc(t);
  return !rn(t, n) || !Oc(n.routes) ? Ge(new Ut("Expected the current modulation schema")) : je(n);
}
function _c(e, t) {
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
function cr(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Qa(n))
  };
}
function Dc(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function Lc(e, t = null) {
  const n = [];
  for (let r = 0; r < Xe; r += 1) {
    const i = e.msegSlots[r], o = t?.msegSlots[r];
    (o === void 0 || !er(o.shapeA, i.shapeA)) && n.push({
      endpointID: ar,
      value: cr(r, 0, i.shapeA)
    }), (o === void 0 || !er(o.shapeB, i.shapeB)) && n.push({
      endpointID: ar,
      value: cr(r, 1, i.shapeB)
    }), (o === void 0 || !Dc(o.playback, i.playback)) && n.push({
      endpointID: Zs,
      value: _c(r, i.playback)
    });
  }
  return n.push(...ds(t?.routes ?? null, e.routes)), n;
}
function Ni(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) Ni(t);
    Object.freeze(e);
  }
}
const Nc = {
  parse(e) {
    const t = Je(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (Ni(t.value), { kind: "ok", value: t.value });
  },
  encode: jt,
  equals: (e, t) => jt(e) === jt(t)
}, Cc = aa({
  playMode: Dt("playMode"),
  glideTime: Dt("glideTime"),
  globalTune: Dt("globalTune"),
  [be]: oa({ initial: vt(), codec: Nc })
}), lt = 2048;
function He(e, t) {
  if (!e)
    throw new Error(t);
}
function Pc(e) {
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
const Fc = 2048, yt = 11, Kc = 256;
function ne(e, t) {
  if (!e)
    throw new Error(t);
}
function Uc(e) {
  return e > 0 && (e & e - 1) === 0;
}
const lr = /* @__PURE__ */ new Map();
function zc(e) {
  const t = lr.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let c = 0; c < n; c += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return lr.set(e, r), r;
}
function Ci(e, t, n = !1) {
  const r = e.length;
  ne(r === t.length, "FFT real and imaginary buffers must have the same length"), ne(Uc(r), "FFT input length must be a power of two");
  const i = zc(r);
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
      let m = 1, I = 0;
      for (let T = 0; T < a; T += 1) {
        const E = l + T, S = E + a, b = e[S], A = t[S], k = m * b - I * A, x = m * A + I * b, F = e[E], u = t[E];
        e[E] = F + k, t[E] = u + x, e[S] = F - k, t[S] = u - x;
        const h = m * s - I * d;
        I = m * d + I * s, m = h;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Pi(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function jc(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Fc,
  maxFramesPerTable: r = Kc
} = {}) {
  const i = Float32Array.from(e);
  ne(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  ne(o > 0, "Source wavetable files must contain at least one frame"), ne(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && ne(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let c = 0; c < o; c += 1) {
    const s = c * n, d = s + n;
    a.push(Pi(i.slice(s, d)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function dr(e) {
  const t = Pi(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Ci(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Fi(e, t, {
  mipLevelCount: n = yt
} = {}) {
  const r = e?.real?.length ?? 0;
  ne(r > 0, "Spectrum must contain real samples"), ne(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), ne(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let c = 1; c <= i; c += 1) {
    o[c] = e.real[c], a[c] = e.imaginary[c];
    const s = (r - c) % r;
    s !== c && (o[s] = e.real[s], a[s] = e.imaginary[s]);
  }
  return Ci(o, a, !0), Float32Array.from(o);
}
const Vt = "articulationSnapshot", j = 128, ur = 48, Vc = 1e6, H = -1, $t = [
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
function Mn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Bt(e) {
  return Mn(Number.isFinite(e) ? e : 0, 0, 1);
}
function q(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return Mn(Number.isFinite(i) ? i : t, n, r);
}
function B(e, t, n, r) {
  return Mn(Math.round(q(e, t)), n, r);
}
function Ki(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function Ht() {
  return Array.from({ length: j }, () => H);
}
function $c(e) {
  const t = B(e, 0, 0, j - 1), n = $t[t % $t.length], r = Math.floor(t / $t.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function Bc() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: kn,
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
function Hc(e) {
  const t = Bc(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: q(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: q(n.pan, t.pan, -1, 1),
    octave: B(n.octave, t.octave, -4, 4),
    semitone: B(n.semitone, t.semitone, -12, 12),
    fineCents: q(n.fineCents, t.fineCents, -100, 100),
    volumeDb: q(
      n.volumeDb,
      t.volumeDb,
      tn,
      ki
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
      Bt(Number(r[0])),
      Bt(Number(r[1])),
      Bt(Number(r[2]))
    ]
  };
}
function qc(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: q(t.amount, 0, -48, 48)
  } : null;
}
function Wc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(qc).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Hc(t.parameters),
    envelopes: [0, 1, 2].map((i) => Di(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Gc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = B(n.runtimeSlot, t, 0, j - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : $c(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Wc(n.snapshot)
  };
}
function Yc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: B(n.note, 0, 0, j - 1),
    articulationId: r
  } : null;
}
function Jc(e, t, n, r, i) {
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
function fr(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < i.length; c += 1) {
    const s = Jc(
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
function Qc(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Yc(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function Xc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let s = 0; s < n.length && o.length < j; s += 1) {
    const d = Gc(n[s], s);
    !d || r.has(d.runtimeSlot) || i.has(d.id) || (r.add(d.runtimeSlot), i.add(d.id), o.push(d));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((s) => s.id === t.selectedSlotId) ? t.selectedSlotId : null, c = new Set(o.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ki(t.activeTriggerMode),
    slots: o,
    chainAssignments: fr(t.chainAssignments, c, "chain", 0),
    keyAssignments: Qc(t.keyAssignments, c),
    velocityAssignments: fr(t.velocityAssignments, c, "velocity", 1)
  };
}
function mr(e) {
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
    volumeDbs: t(kn),
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
    msegMorphs: Array.from({ length: Xe }, () => 0),
    routeAmounts: Array.from({ length: Ii }, () => 0),
    envelopeAttackSeconds: Array.from({ length: De }, (n, r) => Le(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: De }, (n, r) => Le(r).decaySeconds),
    envelopeSustain: Array.from({ length: De }, (n, r) => Le(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: De }, (n, r) => Le(r).releaseSeconds)
  };
}
function hr(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === H && (e[o] = i);
  }
}
function Zc(e) {
  const t = Xc(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = Ht(), i = Ht(), o = Ht();
  hr(r, t.chainAssignments, n), hr(o, t.velocityAssignments, n);
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
function Ui(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : Zc(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ki(t.activeMode),
    chain: Array.from({ length: j }, (n, r) => B(t.chain?.[r], H, H, j - 1)),
    key: Array.from({ length: j }, (n, r) => B(t.key?.[r], H, H, j - 1)),
    velocity: Array.from({ length: j }, (n, r) => r === 0 ? H : B(t.velocity?.[r], H, H, j - 1))
  });
}
function el(e, t) {
  const n = Ui(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const we = "articulations.v4", On = [
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
], wn = [
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
], tl = [
  ...U.flatMap((e) => On.map(
    (t) => `osc${e}.${t}`
  )),
  ...wn
];
class zi extends Error {
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
function P(e) {
  return Ge(new zi("malformed", e));
}
function Ze(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function _n(e, t, n) {
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
function It(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < j;
}
function nl(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function rl(e) {
  return tl.some((t) => t === e);
}
function pr(e, t) {
  if (!Ze(e))
    return P(`${t} must be an object`);
  const n = _n(e, ["min", "max"], t);
  return n !== null ? P(n) : It(e.min) ? It(e.max) ? e.min > e.max ? P(`${t}.min must be less than or equal to ${t}.max`) : je({ min: e.min, max: e.max }) : P(`${t}.max must be an integer in 0..127`) : P(`${t}.min must be an integer in 0..127`);
}
function il(e, t) {
  if (!Ze(e))
    return P(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return P(`${t} has a non-string parameter id`);
    if (!rl(r))
      return P(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return P(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return je(n);
}
function ol(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function al() {
  return {};
}
function sl(e, t, n) {
  if (!Ze(e))
    return P(`${t} must be an object`);
  const r = al();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return P(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > ur)
      return P(
        `${t}.${i} must be a finite route amount within ±${ur}`
      );
    if (!n.has(i))
      return P(`${t}.${i} does not name a current articulable mapping`);
    ol(r, i, o);
  }
  return je(r);
}
function cl(e, t, n) {
  const r = `slots[${t}]`;
  if (!Ze(e))
    return P(`${r} must be an object`);
  const i = _n(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return P(i);
  if (typeof e.id != "string")
    return P(`${r}.id must be a string`);
  if (!It(e.runtimeSlot))
    return P(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return P(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return P(`${r}.color must be a string`);
  if (!It(e.key))
    return P(`${r}.key must be an integer in 0..127`);
  const o = pr(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = pr(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const c = il(e.overrides, `${r}.overrides`);
  if (c._tag === "err")
    return c;
  const s = sl(
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
const ll = Object.fromEntries(
  On.map((e, t) => [e, 2 ** t])
), dl = Object.fromEntries(
  wn.map((e, t) => [e, 2 ** t])
);
function gr(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function ul(e, t) {
  return On.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | ll[r] : n, 0);
}
function fl(e) {
  return wn.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | dl[n] : t, 0);
}
function ml(e, t) {
  const n = (o, a) => gr(e, `osc${o}.${a}`), r = (o) => gr(e, o), i = Array.from(
    { length: Ii },
    () => Vc
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const c = t[o];
    c !== void 0 && (i[c] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: U.map((o) => ul(e, o)),
    sharedOverrideMask: fl(e),
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
function hl(e, t) {
  return e.slots.map((n) => ml(n, t));
}
function pl(e, t) {
  if (!Ze(e))
    return P("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return P('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Ge(new zi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = _n(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return P(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return P("selectedSlotId must be null or a string");
  if (!nl(e.activeTriggerMode))
    return P('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return P("slots must be an array");
  if (e.slots.length > j)
    return P(`slots must contain at most ${j} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const c = cl(e.slots[a], a, t);
    if (c._tag === "err")
      return c;
    const s = c.value;
    if (i.has(s.id))
      return P(`slots[${a}].id duplicates "${s.id}"`);
    if (o.has(s.runtimeSlot))
      return P(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    i.add(s.id), o.add(s.runtimeSlot), r.push(s);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? P(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : je({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function ji() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function gl(e) {
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
const on = "runtimeState";
function Vi(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const vl = {
  endpointID: on,
  required: !0,
  mapValue: Vi
}, vr = "runtimeInstallAck", $i = "runtimeSyncRequest", an = 0, yl = 8e3, St = /* @__PURE__ */ new WeakMap(), Bi = 1e9;
let it = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Bi;
function Il(e) {
  return it = it % Bi + 1, e === "modulation" ? -1e9 - it : 1e9 + it;
}
function Sl(e, t) {
  const n = e, r = St.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), St.set(n, r);
}
function yr(e, t) {
  const n = e, r = St.get(n);
  r?.delete(t), r?.size === 0 && St.delete(n);
}
const bl = [100, 250, 500, 1e3], ot = { _tag: "accepted" }, Tl = { _tag: "superseded" }, El = { _tag: "stopped" }, Ir = { _tag: "transport-timeout" };
function Al(e) {
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
function kl(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class Sr {
  #o;
  #t;
  #u;
  #S;
  #f = !1;
  #n = null;
  #a = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #l = 0;
  #i = /* @__PURE__ */ new Map();
  #d = 0;
  #r = !1;
  #s = 0;
  #m = /* @__PURE__ */ new Set();
  #b = this.#M.bind(this);
  constructor(t, n) {
    this.#o = t, this.#t = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#u = r && r.length > 0 ? r : [...bl], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? yl)
    );
  }
  start() {
    if (!this.#r) {
      Sl(this.#o, this.#t);
      try {
        this.#d += 1, this.#r = !0, this.#a = null, this.#c.clear(), this.#o.addEndpointListener?.(vr, this.#b);
      } catch (t) {
        throw this.#r = !1, yr(this.#o, this.#t), t;
      }
    }
  }
  stop() {
    this.#r && (this.#r = !1, this.#o.removeEndpointListener?.(vr, this.#b), yr(this.#o, this.#t), this.#i.clear(), this.#a = null, this.#c.clear(), this.#I());
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    n !== this.#n && (this.#n = n, this.#a = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#i.clear(), this.#s += 1, this.#I());
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
    const t = this.#n, n = this.#d;
    return this.#r ? t === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(t, n) : {
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
    if (this.#f)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#n === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#f = !0;
    const n = this.#n, r = this.#d;
    try {
      const i = await this.#T(
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
      return o ?? ot;
    } finally {
      this.#f = !1;
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
  async #T(t, n) {
    if (this.#a === t)
      return ot;
    const r = Il(this.#t);
    this.#c.add(r);
    const i = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(t, n);
        if (a)
          return a;
        if (this.#a === t)
          return ot;
        const c = i - Date.now();
        if (c <= 0)
          return Ir;
        const s = this.#s;
        this.#v(r), await this.#y(
          s,
          Math.min(this.#g(o), c)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #x(t, n, r) {
    const i = this.#R(), o = kl(t.value, n, i);
    let a = 0, c = 0, s = this.#l;
    for (this.#E(t.endpointID, o); ; ) {
      const d = this.#p(n, r);
      if (d)
        return d;
      const l = this.#h(n, i, s);
      if (l !== null)
        return l;
      const m = this.#s;
      await this.#y(
        m,
        this.#g(a)
      );
      const I = this.#h(
        n,
        i,
        s
      );
      if (I !== null)
        return I;
      let T = this.#s;
      for (this.#v(i); ; ) {
        const E = this.#p(n, r);
        if (E)
          return E;
        const S = await this.#y(
          T,
          this.#g(a)
        ), b = this.#h(
          n,
          i,
          s
        );
        if (b !== null)
          return b;
        if (S && this.#e?.dspSessionId === n && this.#e.syncSerial === i) {
          if (c >= 1)
            return Ir;
          s = this.#l, this.#E(t.endpointID, o), c += 1, a += 1;
          break;
        }
        if (S) {
          T = this.#s;
          continue;
        }
        S || (a += 1, T = this.#s, this.#v(i));
      }
    }
  }
  #h(t, n, r) {
    const i = this.#e;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#i.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#i.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#k(i, n) ? (this.#i.delete(n), ot) : null;
  }
  #p(t, n) {
    return !this.#r || this.#d !== n ? El : this.#n !== t ? Tl : null;
  }
  #g(t) {
    return this.#u[Math.min(
      t,
      this.#u.length - 1
    )];
  }
  #E(t, n) {
    try {
      this.#o.sendEventOrValue?.(
        t,
        n,
        void 0,
        an
      );
    } catch {
    }
  }
  #v(t) {
    if (this.#r)
      try {
        this.#o.sendEventOrValue?.(
          $i,
          t,
          void 0,
          an
        );
      } catch {
      }
  }
  #M(t) {
    const n = Al(t);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#a === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#e = n, this.#l += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#i.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#l
      }); this.#i.size > 16; ) {
        const i = this.#i.keys().next().value;
        if (i === void 0) break;
        this.#i.delete(i);
      }
    this.#s += 1, this.#I();
  }
  #y(t, n) {
    return !this.#r || this.#s !== t ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#m.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#m.add(o);
    });
  }
  #I() {
    for (const t of [...this.#m])
      t.finish(!0);
  }
}
const Rl = 1e3, xl = [be, we];
function br(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function qt(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (br(r, t)) return r[t];
  if (br(n, t)) return n[t];
}
function Wt(e, t) {
  if (e === void 0) return ji();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = pl(n, t);
  return r._tag === "ok" ? r.value : null;
}
function Tr(e) {
  return new Set(e.routes.flatMap((t) => bi(t) === null ? [] : [t.id]));
}
function Er(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function Ar(e, t) {
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
class Ml {
  constructor(t, n) {
    this.connection = t, this.frameworkInput = n, this.modulationLane = new Sr(t, { laneKind: "modulation" }), this.articulationLane = new Sr(t, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = vt();
  articulationBank = ji();
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
    return this.frameworkInput ? [we] : xl;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(on, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(on, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = qt(t, be), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: vt() } : Je(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${be} is invalid; boot state was not installed.`);
      const a = qt(t, we), c = Wt(a, /* @__PURE__ */ new Set());
      c !== null && (this.articulationBank = c, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = qt(t, we), o = Wt(
      i,
      Tr(r.value)
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
      const i = Je(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${be}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Wt(n, Tr(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${we}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = Vi(t);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.($i, 0, void 0, an), this.hasRuntimeState || this.scheduleRecovery());
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
    const t = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, a = this.lastAppliedModulationGeneration !== n, c = Lc(
      r,
      a ? null : this.lastAppliedModulationState
    ), s = await this.modulationLane.sendBatch(c);
    if (!this.started || t !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", s, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const S = Ar("modulation", s);
      S && o?.(S), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const d = this.buildUploadsBySelector(r, i), l = Array.from({ length: j }, (S, b) => {
      const A = d.get(b);
      return A ? Er(A) : null;
    }), m = this.lastAppliedArticulationGeneration !== n, I = m && this.articulationLane.getAcceptedFrontier() !== 0, T = [];
    for (let S = 0; S < j; S += 1) {
      const b = d.get(S), A = l[S] !== this.lastAppliedArticulationTokens[S];
      I ? T.push({
        endpointID: Vt,
        value: b ?? mr(S)
      }) : m ? b && T.push({ endpointID: Vt, value: b }) : A && T.push({
        endpointID: Vt,
        value: b ?? mr(S)
      });
    }
    const E = await this.articulationLane.sendBatch(T);
    if (!(!this.started || t !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", E, l)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = l;
        const S = gl(i);
        if (this.frameworkInput) {
          const b = await this.frameworkInput.publishTriggerConfig(S);
          if (!this.started || t !== this.lifecycleEpoch) return;
          b.kind !== "cancelled" && o?.(b);
        } else
          el(S, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const b of T) this.lastAppliedArticulationTokens[b.value.selectorA] = void 0;
        const S = Ar("articulation", E);
        S && o?.(S);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = bi(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      hl(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = Er(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Rl));
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
function Ol(e) {
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
          s && (s = !1, l.clear(), S.stop());
        }
        function I(b) {
          s && (m(), t.onDefect(b));
        }
        const T = (b) => s ? t.publish(c, b) : { kind: "cancelled" }, E = {
          addEndpointListener: (b, A) => e.addEndpointListener?.(b, A),
          removeEndpointListener: (b, A) => e.removeEndpointListener?.(b, A),
          addStoredStateValueListener: (b) => e.addStoredStateValueListener?.(b),
          removeStoredStateValueListener: (b) => e.removeStoredStateValueListener?.(b),
          requestFullStoredState: e.requestFullStoredState?.bind(e),
          requestStoredStateValue: e.requestStoredStateValue?.bind(e),
          sendEventOrValue(b, A) {
            const k = T({ kind: "event", endpoint: b, value: A });
            k.kind === "submitted" && (l.add(k.completion), k.completion.then((x) => {
              l.delete(k.completion), !(!s || x.kind === "sent") && (m(), x.kind === "failed" && t.onStatus(d, x));
            }, (x) => {
              l.delete(k.completion), I(x);
            })), k.kind === "failed" && k.error.kind !== "transport" && (m(), t.onStatus(d, k));
          }
        }, S = new Ml(E, {
          onDefect: I,
          async publishTriggerConfig(b) {
            const A = await Promise.all(l);
            l.clear();
            const k = A.find((F) => F.kind !== "sent");
            if (k) return k;
            const x = T({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Ui(b) });
            return x.kind === "submitted" ? x.completion : x;
          }
        });
        return { scope: c, service: S, get closed() {
          return !s;
        }, setTarget(b) {
          d = b;
        }, close: m };
      }
      return {
        replace(a, c) {
          if (n) return;
          const s = ++r, d = Je(a.value);
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
const Hi = 13, Dn = 5, qi = 8, wl = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Ln = Object.freeze({
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
}), Wi = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), _l = Object.freeze([
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
]), Dl = Object.freeze({
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
function Ll(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function Gi(e, t) {
  const n = {};
  for (const c of Ln[e]) {
    const s = t[c];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[c] = s;
      continue;
    }
    const d = Dl[c];
    if (d === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${c}`);
    n[c] = d;
  }
  const i = [
    ...Wi.chorus,
    Z("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((c) => i.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Ll(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Yi(e) {
  return Ln[e];
}
function Nl(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Dn)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * qi + wl[e];
}
function Cl(e, t) {
  const n = new Array(Hi).fill(0), r = Gi(e, t);
  return Ln[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const Pl = "lane.v1", Fl = "laneTopology", kr = "laneSlotParams", Kl = "laneOutputControl", sn = 16, Ul = 8, Ji = 4, zl = 3, Qi = Dn * qi, Xi = 4, jl = 4, Vl = Qi, $l = Qi + Xi, Bl = 0, Hl = 1, ql = 2, Wl = 3, Gl = 4, Yl = 5;
function Jl(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > Ji)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << Ul;
}
const bt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Tt = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Zi = new Map(
  Object.entries(Tt).map(([e, t]) => [t, e])
), Ql = Object.freeze({
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
  bt.map((e) => [Ql[e], e])
);
const Xl = Object.freeze([
  "voice.filterCutoff",
  Ri,
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
]), Zl = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Ri]: "enhancer-frequency",
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
  Xl.map((e) => [e, Object.freeze({
    id: e,
    family: Zl[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const eo = 40, to = 18e3, cn = bt.map((e) => Tt[e]), ed = /^([a-zA-Z]+)#([1-9][0-9]*)$/, td = /^(parallel|split)#([1-9][0-9]*)$/;
function wt(e) {
  if (typeof e != "string")
    return null;
  const t = ed.exec(e);
  if (t === null)
    return null;
  const n = cn.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > Dn ? null : { deviceType: n, instanceNumber: r };
}
function no(e) {
  if (typeof e != "string")
    return null;
  const t = td.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? Xi : jl) ? null : { groupKind: n, unitNumber: r };
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
function nd(e, t) {
  const n = wt(e);
  if (n === null)
    return { failure: K(`device id ${e} is not a pool instance`) };
  if (!Te(t) || !Pe(t, ["params"]) || !Te(t.params))
    return { failure: K(`device ${e} must be { params }`) };
  const r = Yi(n.deviceType), i = Zi.get(n.deviceType);
  if (i === void 0)
    return { failure: K(`device ${e} has no effect descriptor`) };
  const o = ri(i).parameters.map((T) => T.endpointID), a = t.params, c = Object.keys(a), s = (T) => c.length === T.length && c.every((E) => T.includes(E)), d = Z(n.deviceType), l = [
    ...Wi[n.deviceType],
    d
  ], m = [
    ..._l,
    d
  ];
  if (!(c.includes(d) && (s(r) || s(o) || s(l) || n.deviceType === "chorus" && s(m))))
    return { failure: K(`device ${e} must carry every parameter once`) };
  for (const T of c) {
    const E = a[T];
    if (typeof E != "number" || !Number.isFinite(E))
      return { failure: K(`device ${e}.${T} must be a finite number`) };
  }
  return { record: { params: Gi(n.deviceType, a) } };
}
function rd(e, t) {
  return !Te(e) || e.kind !== "device" ? { failure: K("branches may hold device placements only") } : Pe(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: K(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: K(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: K("a device placement is { kind, deviceId, enabled }") };
}
function Rr(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= eo && e <= to;
}
function ro() {
  return { mix: 1, bypassed: !1 };
}
function id(e) {
  return !Te(e) || !Pe(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function od(e) {
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
  const n = id(t.output);
  if (n === null)
    return K("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(t.devices)) {
    if (typeof l != "string")
      return K("device ids must be strings");
    const m = nd(l, t.devices[l]);
    if ("failure" in m)
      return m.failure;
    r[l] = m.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), c = [];
  let s = 0;
  const d = (l) => {
    const m = rd(l, i);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), s += 1), m;
  };
  for (const l of t.chain) {
    if (!Te(l))
      return K("chain nodes must be objects");
    if (l.kind === "device") {
      const x = d(l);
      if ("failure" in x)
        return x.failure;
      c.push(x.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return K(`unknown chain node kind ${String(l.kind)}`);
    const m = l.kind === "split", I = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], E = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], S = m && Pe(l, I);
    if (!Pe(l, E) && !S)
      return K(`a ${l.kind} group is { ${E.join(", ")} }`);
    const b = no(l.groupId);
    if (b === null || b.groupKind !== l.kind)
      return K(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return K(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return K(`group ${String(l.groupId)} needs a boolean enable`);
    const A = m ? zl : Ji;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > A)
      return K(`group ${String(l.groupId)} needs 2..${A} branches`);
    if (m && (!Rr(l.xoverLowHz) || !Rr(l.xoverHighHz)))
      return K(`group ${String(l.groupId)} crossovers must sit in ${eo}..${to} Hz`);
    if (m && !S && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return K(`group ${String(l.groupId)} Key Track state must be finite`);
    s += 1;
    const k = [];
    for (const x of l.branches) {
      if (!Array.isArray(x))
        return K(`group ${String(l.groupId)} branches must be arrays`);
      const F = [];
      for (const u of x) {
        const h = d(u);
        if ("failure" in h)
          return h.failure;
        F.push(h.placement);
      }
      k.push(F);
    }
    c.push(m ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: S ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: S ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: S ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: S ? 0 : l.xoverHighKeyTrackOffsetSemitones,
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
  return s > sn ? K(`flattens to ${s} wire entries; the topology upload holds ${sn}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: c } };
}
function ad() {
  const e = {};
  for (const t of bt) {
    const n = Tt[t];
    e[`${n}#1`] = {
      params: md(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ro(),
    devices: e,
    chain: bt.map((t) => ({
      kind: "device",
      deviceId: `${Tt[t]}#1`,
      enabled: !1
    }))
  };
}
const xr = ["distortion#1", "delay#1", "reverb#1"];
function sd() {
  const e = ad(), t = {};
  for (const n of xr) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ro(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && xr.includes(n.deviceId))
  };
}
function cd(e) {
  if (e === void 0)
    return sd();
  const t = od(e);
  return t._tag === "ok" ? t.value : null;
}
function ld(e) {
  return Object.keys(e.devices).map((t) => {
    const n = wt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => cn.indexOf(t.parsed.deviceType) - cn.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function ln(e) {
  const t = wt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return Nl(t.deviceType, t.instanceNumber - 1);
}
function io(e) {
  const t = no(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? Vl : $l) + (t.unitNumber - 1);
}
function dd(e) {
  const t = new Array(sn).fill(0);
  let n = 0, r = 0;
  const i = (o, a, c) => {
    t[r] = Jl(o, a), c && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(ln(o.deviceId), 0, o.enabled);
      continue;
    }
    i(io(o), o.branches.length, o.enabled), o.branches.forEach((a, c) => {
      for (const s of a)
        i(ln(s.deviceId), c + 1, s.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function ud(e) {
  const t = new Array(Hi).fill(0);
  return t[Bl] = e.xoverLowHz, t[Hl] = e.xoverHighHz, t[ql] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Wl] = e.xoverLowKeyTrackOffsetSemitones, t[Gl] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[Yl] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function fd(e) {
  const t = [{
    endpointID: Kl,
    value: e.output
  }];
  let n = 0;
  for (const r of ld(e)) {
    const i = wt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: ya(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[Z(i.deviceType)]
    }), n += 1, t.push({
      endpointID: kr,
      value: {
        slotId: ln(r.instanceId),
        deliverySerial: n,
        values: Cl(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: kr,
      value: {
        slotId: io(r),
        deliverySerial: n,
        values: ud(r)
      }
    }));
  return t.push({
    endpointID: Fl,
    value: dd(e)
  }), t;
}
function md(e) {
  const t = Zi.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = ri(t).parameters;
  return Object.fromEntries(Yi(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function hd(e) {
  return ta(e, {
    stateKey: Pl,
    runtimeEndpointDependencies: [vl],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: cd,
    buildRuntimeEvents: ({ state: t }) => [...fd(t)]
  });
}
async function pd(e, t, n) {
  const r = e.sharedData;
  if (!r) throw new Error("This patch host does not support direct shared-data preparation.");
  const i = r.reserve(t.input, t.byteLength);
  try {
    n(i), await r.commit(i.id);
  } catch (o) {
    throw r.cancel(i.id), o;
  }
}
const dt = 256, qe = 2048, oo = 8, gd = 12811, dn = (oo + dt * gd) * 4;
function Mr(e, t, n) {
  const r = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function vd(e, t, n) {
  if (e.byteLength !== dn || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > dt)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  r.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    yt,
    dt
  ]);
  let i = oo;
  const o = 131071, a = 8191, c = Math.fround(o / 1.5), s = Math.fround(a / 0.5);
  for (let d = 0; d < yt; ++d) {
    const l = Math.min(qe, Math.max(256, (1 << d) * 32)), m = qe / l;
    for (let I = 0; I < t.frameCount; ++I) {
      const T = Fi(n(I), d), E = i + I * (l + 1);
      for (let S = 0; S <= l; ++S) {
        const b = (S === l ? 0 : S) * m, A = (b + qe - m) % qe, k = (b + m) % qe, x = T[b], F = T[A], u = T[k];
        if (x === void 0 || F === void 0 || u === void 0 || !Number.isFinite(x) || !Number.isFinite(F) || !Number.isFinite(u))
          throw new Error("Wavetable preparation produced invalid samples.");
        const h = Math.fround(0.5 * Math.fround(u - F));
        r[E + S] = Mr(x, c, o) & 262143 | Mr(h, s, a) << 18;
      }
    }
    i += (l + 1) * dt;
  }
}
const yd = "runtimeSyncRequest", Id = 2147483647, Sd = "runtimeState", bd = "retryDesiredTableRequest", Td = "workerLoadFailure", Ed = "serviceLoadAbort", Ad = "wavetableLoadBegin", kd = "wavetableMipFrame", Rd = "wavetableUploadAck", xd = "wavetableMipRequest", Md = "wavetablePrewarmRequest", Od = "wavetablePrewarmNotification", wd = "assets/factory-bank-catalog.json", un = 3, _d = 1, Dd = un * lt, Ld = 1, Nd = 2, Cd = 3, Pd = 1, Fd = 2, Kd = 2e4, at = Ld, Or = Nd, wr = Cd, le = Pd, _r = Fd, Ud = 48 * 1024 * 1024, Gt = 3;
function Dr(e, t) {
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
function Lr(e) {
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
function Nr(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function Cr(e, t) {
  if (!e)
    throw new Error(t);
}
function zd(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function jd(e, t) {
  return Pc(await e.readJSON(t));
}
function Vd(e) {
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
function $d(e, t) {
  const n = Math.round(Number(e) || 0);
  return zd(n, 0, Math.max(0, t - 1));
}
function Yt(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function Bd(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function Pr(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function Fr(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function st() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Hd(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class qd {
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
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = pa(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? wd, this.maxBatchesInFlight = Dr(
      n.maxFramesInFlight,
      _d
    ), this.mipLevelCount = n.mipLevelCount ?? yt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Ud) || 0)), this.serviceLoadTimeoutMs = Dr(n.serviceLoadTimeoutMs, Kd), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(Sd, this.handleRuntimeState), this.connection.addEndpointListener?.(Rd, this.handleUploadAck), this.connection.addEndpointListener?.(xd, this.handleMipRequest), this.connection.addEndpointListener?.(Md, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Od, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      yd,
      Id
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await jd(this.resourceClient, this.catalogPath), V("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Gt; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = Pr(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Pr(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Yt(
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
          ...Fr(this.serviceTable.frameCount),
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
          failurePhase: wr,
          failureReasonCode: _r
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== wr || t.failureReasonCode !== _r ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = at,
    failureReasonCode: c = le
  }) {
    this.connection.sendEventOrValue?.(Td, {
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
    this.connection.sendEventOrValue?.(Ed, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    V("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? Lr(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(bd, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = $d(t, r.tables.length), o = r.tables[i];
    Cr(o, `Could not resolve table ${i}`);
    const a = Bd(o, lt, this.mipLevelCount), c = this.tableCache.get(a);
    if (c)
      return c.lastUsedSerial = this.cacheUseSerial++, V("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: c.frameCount,
        cacheBytes: this.tableCacheBytes
      }), c;
    const s = st();
    V("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(o.sourceWav), l = jc(d.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: lt
    });
    return V("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(st() - s)
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
    this.connection.sendEventOrValue?.(Ad, {
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
    const n = st();
    try {
      if (await pd(this.connection, {
        input: t.oscillatorIndex,
        byteLength: dn
      }, (r) => {
        vd(r, t, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      V("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: dn,
        preparationMs: st() - n,
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
        failurePhase: Or,
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
      failurePhase: at,
      failureReasonCode: le
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: at,
      failureReasonCode: le
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = at,
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
    for (let t = 0; t < Gt; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Hd(() => {
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
    const n = Vd(t ?? {});
    if (V("info", "Received runtime state", Lr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Gt)
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
          i.spectra[a] || (i.spectra[a] = dr(i.frames[a]));
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
    const s = Yt(
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
      ...Fr(this.serviceTable.frameCount),
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), c = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), l = Yt(
      r,
      i,
      o,
      a,
      c
    ), m = this.mipJobs.get(l), I = this.serviceTable?.frameCount ?? 0, T = Math.min(
      un,
      I - s
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(s) || d <= 0 || d !== T)) {
      m.inFlightBatchBases.delete(s);
      for (let E = 0; E < d; E += 1) {
        const S = s + E;
        m.ackedFrames[S] || (m.ackedFrames[S] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === I && m.nextFrameIndex >= I && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Nr(s, d, I) && V("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: c,
        frameIndexBase: s,
        batchFrameCount: d,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: I,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (Cr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = dr(this.serviceTable.frames[t]);
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
        un,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(Dd);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, c = this.getSpectrumForFrame(a), s = Fi(c, t.mipIndex);
          i.set(s, o * lt);
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
            failurePhase: Or,
            failureReasonCode: le
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(kd, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Nr(n, r, this.serviceTable.frameCount) && V("info", "Sent wavetable mip batch", {
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
function Wd(e, t = {}) {
  return new qd(e, t);
}
async function Gd(e, t = {}) {
  return ia(e, [
    hd,
    () => Wd(e, { ...t, delivery: "shared" }),
    () => Jo(Cc, e, {
      bindings: [Ol(e)],
      onDefect: (n) => console.error("Cosimo state failed", We(n))
    })
  ]);
}
export {
  _d as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Nd as FAILURE_PHASE_BUILD_MIP,
  Ld as FAILURE_PHASE_LOAD_SOURCE,
  Cd as FAILURE_PHASE_TRANSFER_MIP,
  Pd as FAILURE_REASON_GENERIC,
  Fd as FAILURE_REASON_TIMEOUT,
  un as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Id as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  qd as WavetableWorkerController,
  Wd as createWavetableWorkerController,
  Gd as default
};
