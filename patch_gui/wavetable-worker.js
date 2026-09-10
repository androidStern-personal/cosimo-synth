function zo() {
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
function vn(e, t) {
  return new Promise((n, r) => {
    const i = t.onAbort(() => n({ kind: "cancelled" }));
    Promise.resolve(e).then((o) => {
      i(), n(t.aborted ? { kind: "cancelled" } : { kind: "value", value: o });
    }, (o) => {
      i(), t.aborted ? n({ kind: "cancelled" }) : r(o);
    });
  });
}
function Vo(e) {
  let t = !1, n;
  const r = /* @__PURE__ */ new Set();
  async function i(o, a, c) {
    if (e.onStatus(a, { kind: "preparing" }), c.aborted) return;
    const s = await vn(e.prepare(o, c), c);
    if (s.kind === "cancelled" || c.aborted) return;
    const u = s.value;
    if (u.kind === "error") {
      e.onStatus(a, { kind: "failed", error: u.error });
      return;
    }
    let d = !0, m;
    try {
      m = await vn(e.transport.apply(u.value, {
        signal: c,
        send: (g) => c.aborted || !d ? { kind: "cancelled" } : g()
      }), c);
    } catch (g) {
      c.aborted || (t = !0, n?.cancel(), e.transport.stop(), e.onDefect(g), e.onStatus(a, {
        kind: "failed",
        error: { kind: "defect", message: "Engine transport failed unexpectedly." }
      }));
      return;
    } finally {
      d = !1;
    }
    m.kind === "value" && !c.aborted && m.value.kind !== "cancelled" && e.onStatus(a, m.value);
  }
  return {
    /** Supersede previous work immediately; ignored after stop or a transport defect. */
    replace(o, a) {
      if (t) return;
      const c = n, s = zo();
      if (n = s, c?.cancel(), t || s.signal.aborted) return;
      const u = i(o, a, s.signal).catch((d) => {
        s.signal.aborted || (s.cancel(), e.onDefect(d), e.onStatus(a, {
          kind: "failed",
          error: { kind: "defect", message: "Engine update failed unexpectedly." }
        }));
      });
      r.add(u), u.then(() => {
        r.delete(u);
      });
    },
    /** Revoke the current request, retaining the transport for a later replacement. */
    cancel() {
      n?.cancel();
    },
    /** Close permanently and settle owned work without waiting for uncooperative external promises. */
    async stop() {
      t || (t = !0, n?.cancel(), e.transport.stop()), await Promise.all(r);
    }
  };
}
let jo = 0;
function In(e, t) {
  const n = `atom${++jo}`, r = {
    toString() {
      return process.env.NODE_ENV !== "production" && this.debugLabel ? n + ":" + this.debugLabel : n;
    }
  };
  return typeof e == "function" ? r.read = e : (r.init = e, r.read = $o, r.write = Bo), r;
}
function $o(e) {
  return e(this);
}
function Bo(e, t, n) {
  return t(this, typeof n == "function" ? n(e(this)) : n);
}
const Ir = "a", se = "m", ct = "i", ye = "c", Yt = "q", Jt = "Q", ce = "h", Sr = "R", br = "W", Tr = "I", Ar = "M", Z = "e", we = "f", ve = "C", De = "r", Qt = "d", lt = "w", dt = "D", ut = "t", ft = "T", Xt = "v", Sn = "g", bn = "s", Tn = "b", Ho = "B", Zt = "p", Er = "H", Rr = "A", en = "E";
function xr(e) {
  return "init" in e;
}
function qo(e) {
  return typeof e.write == "function";
}
function Wo(e) {
  return !!e.onMount;
}
function An(e) {
  return "v" in e || "e" in e;
}
function Xe(e) {
  if ("e" in e)
    throw e.e;
  if (process.env.NODE_ENV !== "production" && !("v" in e))
    throw new Error("[Bug] atom state is not initialized");
  return e.v;
}
function Ze(e) {
  return typeof e?.then == "function";
}
function Go(e) {
  if (!(e instanceof Error))
    return !1;
  const t = e.name, n = e.message.toLowerCase();
  return (t === "RangeError" || t === "InternalError") && (n.includes("call stack") || n.includes("too much recursion") || n.includes("stack overflow"));
}
function Mr(e, t, n) {
  if (!n.p.has(e)) {
    n.p.add(e);
    const r = () => n.p.delete(e);
    t.then(r, r);
  }
}
function Or(e, t, n) {
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
function Yo(e) {
  return !!e.INTERNAL_onInit;
}
const Jo = (e, t, n, ...r) => n.read(...r), Qo = (e, t, n, ...r) => n.write(...r), Xo = (e, t, n) => n.INTERNAL_onInit(t), Zo = (e, t, n, r) => n.onMount?.(r), ei = (e, t, n) => {
  const r = e[Ir];
  let i = r.get(n);
  if (!i) {
    const o = e[ce], a = e[Tr];
    i = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 }, r.set(n, i), o.i?.(n), Yo(n) && a(e, t, n);
  }
  return i;
}, ti = (e, t) => {
  const n = e[se], r = e[ye], i = e[Yt], o = e[Jt], a = e[ce], c = e[ve];
  if (!a.f && !r.size && !i.size && !o.size)
    return;
  const s = [], u = (d) => {
    try {
      d();
    } catch (m) {
      s.push(m);
    }
  };
  do {
    a.f && u(a.f);
    const d = /* @__PURE__ */ new Set();
    for (const m of r) {
      const g = n.get(m)?.l;
      if (g)
        for (const y of g)
          d.add(y);
    }
    r.clear();
    for (const m of o)
      d.add(m);
    o.clear();
    for (const m of i)
      d.add(m);
    i.clear();
    for (const m of d)
      u(m);
    r.size && c(e, t);
  } while (r.size || o.size || i.size);
  if (s.length)
    throw typeof AggregateError == "function" ? new AggregateError(s) : Object.assign(new Error(), { errors: s });
}, ni = (e, t) => {
  const n = e[se], r = e[ct], i = e[ye], o = e[Z], a = e[De], c = e[dt];
  if (!i.size)
    return;
  const s = [], u = [], d = /* @__PURE__ */ new WeakSet(), m = /* @__PURE__ */ new WeakSet(), g = [], y = [];
  for (const b of i)
    g.push(b), y.push(o(e, t, b));
  for (; g.length; ) {
    const b = g.length - 1, A = g[b], I = y[b];
    if (m.has(A)) {
      g.pop(), y.pop();
      continue;
    }
    if (d.has(A)) {
      if (r.get(A) === I.n)
        s.push(A), u.push(I);
      else if (process.env.NODE_ENV !== "production" && r.has(A))
        throw new Error("[Bug] invalidated atom exists");
      m.add(A), g.pop(), y.pop();
      continue;
    }
    d.add(A);
    for (const _ of Or(A, I, n))
      d.has(_) || (g.push(_), y.push(o(e, t, _)));
  }
  for (let b = s.length - 1; b >= 0; --b) {
    const A = s[b], I = u[b];
    let _ = !1;
    for (const N of I.d.keys())
      if (N !== A && i.has(N)) {
        _ = !0;
        break;
      }
    _ && (r.set(A, I.n), a(e, t, A), c(e, t, A)), r.delete(A);
  }
}, Ct = /* @__PURE__ */ new WeakSet(), ri = (e, t, n) => {
  const r = e[se], i = e[ct], o = e[ye], a = e[ce], c = e[Sr], s = e[Z], u = e[we], d = e[ve], m = e[De], g = e[dt], y = e[Xt], b = e[Er], A = e[en], I = s(e, t, n), _ = A[0];
  if (An(I)) {
    if (
      // If the atom is mounted, we can use cached atom state,
      // because it should have been updated by dependencies.
      // We can't use the cache if the atom is invalidated.
      r.has(n) && i.get(n) !== I.n || // If atom is not mounted, we can use cached atom state,
      // only if store hasn't been mutated.
      I.m === _
    )
      return I.m = _, I;
    let p = !1;
    for (const [x, k] of I.d)
      if (m(e, t, x).n !== k) {
        p = !0;
        break;
      }
    if (!p)
      return I.m = _, I;
  }
  let N = !0;
  const M = new Set(I.d.keys()), E = () => {
    for (const p of M)
      I.d.delete(p);
  }, f = () => {
    if (r.has(n)) {
      const p = !o.size;
      g(e, t, n), p && (d(e, t), u(e, t));
    }
  }, l = (p) => {
    if (p === n) {
      const k = s(e, t, p);
      if (!An(k))
        if (xr(p))
          y(e, t, p, p.init);
        else
          throw new Error("no atom init");
      return Xe(k);
    }
    const x = m(e, t, p);
    try {
      return Xe(x);
    } finally {
      M.delete(p), I.d.set(p, x.n), Ze(I.v) && Mr(n, I.v, x), r.has(n) && r.get(p)?.t.add(n), N || f();
    }
  };
  let h;
  const S = {
    get signal() {
      return h || (h = new AbortController()), h.signal;
    }
  }, v = I.n, T = i.get(n) === v;
  try {
    process.env.NODE_ENV !== "production" && Ct.delete(t);
    const p = c(e, t, n, l, S);
    if (process.env.NODE_ENV !== "production" && Ct.has(t) && console.warn("Detected store mutation during atom read. This is not supported."), y(e, t, n, p), Ze(p)) {
      b(e, t, p, () => h?.abort());
      const x = () => {
        E(), f();
      };
      p.then(x, x);
    } else
      E();
    return a.r?.(n), I.m = _, I;
  } catch (p) {
    if (Go(p))
      throw p;
    return delete I.v, I.e = p, ++I.n, I.m = _, I;
  } finally {
    N = !1, I.n !== v && T && (i.set(n, I.n), o.add(n), a.c?.(n));
  }
}, oi = (e, t, n) => {
  const r = e[se], i = e[ct], o = e[Z], a = [n];
  for (; a.length; ) {
    const c = a.pop(), s = o(e, t, c);
    for (const u of Or(c, s, r)) {
      const d = o(e, t, u);
      i.get(u) !== d.n && (i.set(u, d.n), a.push(u));
    }
  }
}, ii = (e, t, n, r) => {
  const i = e[ye], o = e[ce], a = e[br], c = e[Z], s = e[we], u = e[ve], d = e[De], m = e[Qt], g = e[lt], y = e[dt], b = e[Xt], A = e[en];
  let I = !0;
  const _ = (M) => Xe(d(e, t, M)), N = (M, ...E) => {
    const f = c(e, t, M);
    try {
      if (M === n) {
        if (!xr(M))
          throw new Error("atom not writable");
        process.env.NODE_ENV !== "production" && Ct.add(t);
        const l = f.n, h = E[0];
        b(e, t, M, h), y(e, t, M), l !== f.n && (++A[0], i.add(M), m(e, t, M), o.c?.(M));
        return;
      } else
        return g(e, t, M, E);
    } finally {
      I || (u(e, t), s(e, t));
    }
  };
  try {
    return a(e, t, n, _, N, ...r);
  } finally {
    I = !1;
  }
}, ai = (e, t, n) => {
  const r = e[se], i = e[ye], o = e[ce], a = e[Z], c = e[Qt], s = e[ut], u = e[ft], d = a(e, t, n), m = r.get(n);
  if (m && d.d.size > 0) {
    for (const [g, y] of d.d)
      if (!m.d.has(g)) {
        const b = a(e, t, g);
        s(e, t, g).t.add(n), m.d.add(g), y !== b.n && (i.add(g), c(e, t, g), o.c?.(g));
      }
    for (const g of m.d)
      d.d.has(g) || (m.d.delete(g), u(e, t, g)?.t.delete(n));
  }
}, si = (e, t, n) => {
  const r = e[se], i = e[Yt], o = e[ce], a = e[Ar], c = e[Z], s = e[we], u = e[ve], d = e[De], m = e[lt], g = e[ut], y = c(e, t, n);
  let b = r.get(n);
  if (!b) {
    d(e, t, n);
    for (const A of y.d.keys())
      g(e, t, A).t.add(n);
    if (b = {
      l: /* @__PURE__ */ new Set(),
      d: new Set(y.d.keys()),
      t: /* @__PURE__ */ new Set()
    }, r.set(n, b), qo(n) && Wo(n)) {
      const A = () => {
        let I = !0;
        const _ = (...N) => {
          try {
            return m(e, t, n, N);
          } finally {
            I || (u(e, t), s(e, t));
          }
        };
        try {
          const N = a(e, t, n, _);
          N && (b.u = () => {
            I = !0;
            try {
              N();
            } finally {
              I = !1;
            }
          });
        } finally {
          I = !1;
        }
      };
      i.add(A);
    }
    o.m?.(n);
  }
  return b;
}, ci = (e, t, n) => {
  const r = e[se], i = e[Jt], o = e[ce], a = e[Z], c = e[ft], s = a(e, t, n);
  let u = r.get(n);
  if (!u || u.l.size)
    return u;
  let d = !1;
  for (const m of u.t)
    if (r.get(m)?.d.has(n)) {
      d = !0;
      break;
    }
  if (!d) {
    u.u && i.add(u.u), u = void 0, r.delete(n);
    for (const m of s.d.keys())
      c(e, t, m)?.t.delete(n);
    o.u?.(n);
    return;
  }
  return u;
}, li = (e, t, n, r) => {
  const i = e[Z], o = e[Rr], a = i(e, t, n), c = "v" in a, s = a.v;
  if (Ze(r))
    for (const u of a.d.keys())
      Mr(n, r, i(e, t, u));
  a.v = r, delete a.e, (!c || !Object.is(s, a.v)) && (++a.n, Ze(s) && o(e, t, s));
}, di = (e, t, n) => {
  const r = e[De];
  return Xe(r(e, t, n));
}, ui = (e, t, n, ...r) => {
  const i = e[ye], o = e[we], a = e[ve], c = e[lt], s = i.size;
  try {
    return c(e, t, n, r);
  } finally {
    i.size !== s && (a(e, t), o(e, t));
  }
}, fi = (e, t, n, r) => {
  const i = e[we], o = e[ve], a = e[ut], c = e[ft], u = a(e, t, n).l;
  return u.add(r), o(e, t), i(e, t), () => {
    u.delete(r), c(e, t, n), o(e, t), i(e, t);
  };
}, mi = (e, t, n, r) => {
  const i = e[Zt];
  let o = i.get(n);
  if (!o) {
    o = /* @__PURE__ */ new Set(), i.set(n, o);
    const a = () => i.delete(n);
    n.then(a, a);
  }
  o.add(r);
}, hi = (e, t, n) => {
  e[Zt].get(n)?.forEach((o) => o());
}, pi = /* @__PURE__ */ new WeakMap();
function gi(e) {
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
    [Ir]: /* @__PURE__ */ new WeakMap(),
    [se]: /* @__PURE__ */ new WeakMap(),
    [ct]: /* @__PURE__ */ new WeakMap(),
    [ye]: /* @__PURE__ */ new Set(),
    [Yt]: /* @__PURE__ */ new Set(),
    [Jt]: /* @__PURE__ */ new Set(),
    [ce]: {},
    // atom interceptors
    [Sr]: Jo,
    [br]: Qo,
    [Tr]: Xo,
    [Ar]: Zo,
    // building-block functions
    [Z]: ei,
    [we]: ti,
    [ve]: ni,
    [De]: ri,
    [Qt]: oi,
    [lt]: ii,
    [dt]: ai,
    [ut]: si,
    [ft]: ci,
    [Xt]: li,
    // store api
    [Sn]: di,
    [bn]: ui,
    [Tn]: fi,
    [Ho]: void 0,
    // abortable promise support
    [Zt]: /* @__PURE__ */ new WeakMap(),
    [Er]: mi,
    [Rr]: hi,
    // store epoch
    [en]: [0]
  }, r = Object.freeze({
    ...n,
    ...e
  });
  pi.set(t, r);
  const i = r[Sn], o = r[bn], a = r[Tn];
  return t;
}
function yi() {
  return gi();
}
function J(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && (Object.getPrototypeOf(e) === Object.prototype || Object.getPrototypeOf(e) === null);
}
function kr(e, t = 1 / 0) {
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
function _r() {
  let e = 16777216;
  return {
    node(t) {
      return t > 64 || e < 32 ? !1 : (e -= 32, !0);
    },
    text(t) {
      return e -= kr(t, e), e >= 0;
    },
    elements(t) {
      return t <= Math.floor(e / 32);
    }
  };
}
function wr(e) {
  const t = _r(), n = (r, i) => {
    if (!t.node(i)) return !1;
    if (r === null || typeof r == "boolean") return !0;
    if (typeof r == "number") return Number.isFinite(r);
    if (typeof r == "string") return t.text(r);
    if (Array.isArray(r)) {
      if (!t.elements(r.length)) return !1;
      for (const o of r) if (!n(o, i + 1)) return !1;
      return !0;
    }
    if (!J(r)) return !1;
    for (const o in r)
      if (Object.hasOwn(r, o) && (!t.text(o) || !n(r[o], i + 1))) return !1;
    return !0;
  };
  return n(e, 0);
}
function q(e, t = !0) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= (t ? 1 : 0);
}
function he(e) {
  return typeof e == "string" && e.length > 0 && kr(e) <= 256;
}
function Dr(e) {
  return J(e) && he(e.owner) && q(e.document, !1) ? Object.freeze({ owner: e.owner, document: e.document }) : void 0;
}
function vi(e) {
  const t = Dr(e);
  return t && J(e) && q(e.client) && q(e.sequence) ? Object.freeze({ ...t, client: e.client, sequence: e.sequence }) : void 0;
}
function En(e) {
  if (!J(e) || !Array.isArray(e.parameters) || !J(e.values)) return;
  const t = [];
  for (const n of e.parameters) {
    if (!J(n)) return;
    const { endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s } = n;
    if (!he(r) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number") return;
    t.push(Object.freeze({ endpoint: r, value: i, min: o, max: a, step: c, defaultValue: s }));
  }
  return { parameters: Object.freeze(t), values: e.values };
}
function Ii(e) {
  if (J(e)) {
    if (e.kind === "undo" || e.kind === "redo") return { kind: e.kind };
    if (he(e.key)) {
      if (e.kind === "begin" || e.kind === "end")
        return !q(e.gesture) || e.label !== void 0 && typeof e.label != "string" ? void 0 : e.kind === "end" ? { kind: "end", key: e.key, gesture: e.gesture } : { kind: "begin", key: e.key, gesture: e.gesture, ...e.label !== void 0 ? { label: e.label } : {} };
      if (!(e.kind !== "edit" || !Object.hasOwn(e, "value")) && !(e.expectedVersion !== void 0 && !q(e.expectedVersion, !1)) && !(e.gesture !== void 0 && !q(e.gesture)))
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
function Si(e) {
  if (!wr(e) || !J(e)) return { kind: "invalid", message: "Invalid state-channel body." };
  if (e.kind === "open-failed" && q(e.request) && he(e.reason))
    return { kind: "ok", value: { kind: "open-failed", request: e.request, reason: e.reason } };
  if (e.kind === "closed" && he(e.reason)) return { kind: "ok", value: { kind: "closed", reason: e.reason } };
  const t = Dr(e.scope);
  if (e.kind === "opened" && t && q(e.request)) {
    const n = En(e.native);
    if (n) return { kind: "ok", value: { kind: "opened", request: e.request, scope: t, native: n } };
  }
  if (e.kind === "replaced" && t) {
    const n = En(e.native);
    if (n) return { kind: "ok", value: { kind: "replaced", scope: t, native: n } };
  }
  if (e.kind === "parameter" && t && he(e.endpoint) && typeof e.value == "number")
    return { kind: "ok", value: { kind: "parameter", scope: t, endpoint: e.endpoint, value: e.value } };
  if (e.kind === "detach" && t && q(e.client) && q(e.routedThrough, !1))
    return { kind: "ok", value: { kind: "detach", scope: t, client: e.client, routedThrough: e.routedThrough } };
  if (e.kind === "attached-client" && t && q(e.request) && q(e.client))
    return { kind: "ok", value: { kind: "attached-client", scope: t, request: e.request, client: e.client } };
  if (e.kind === "command") {
    const n = vi(e.address);
    if (n) {
      const r = Ii(e.command);
      return { kind: "ok", value: r ? { kind: "command", address: n, command: r } : { kind: "invalid-command", address: n } };
    }
  }
  if (e.kind === "published" && t && q(e.request) && J(e.result)) {
    if (e.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: t, request: e.request, result: { kind: "observed" } } };
    if (e.result.kind === "failed" && he(e.result.reason)) return { kind: "ok", value: {
      kind: "published",
      scope: t,
      request: e.request,
      result: { kind: "failed", reason: e.result.reason }
    } };
  }
  return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}
function Rn(e, t) {
  const n = Object.fromEntries(Object.entries(e).map(([r, i]) => {
    const o = t.fields[r];
    return !o || !("value" in o) ? [r, o] : [r, { ...o, value: i.kind === "stored" ? i.codec.encode(o.value) : o.value }];
  }));
  return { ...t, fields: n };
}
function bi(e) {
  const t = _r(), n = /* @__PURE__ */ new Set(), r = (o, a) => {
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
            for (const u of o) {
              const d = r(u, a + 1);
              if (d === void 0) return;
              s.push(d);
            }
            return s;
          }
          if (!J(o)) return;
          const c = /* @__PURE__ */ Object.create(null);
          for (const s in o) {
            if (!Object.hasOwn(o, s)) continue;
            if (!t.text(s)) return;
            const u = r(o[s], a + 1);
            if (u === void 0) return;
            c[s] = u;
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
function be(e, t) {
  return e.owner === t.owner && e.document === t.document;
}
function xn(e) {
  return [e.value, e.min, e.max, e.step, e.defaultValue].every(Number.isFinite) && e.min <= e.max && e.step >= 0 && e.value >= e.min && e.value <= e.max && e.defaultValue >= e.min && e.defaultValue <= e.max;
}
function le(e, t, n = 0, r, i, o) {
  return Object.freeze({ readiness: Object.freeze({ kind: "ready" }), value: e, version: n, persistence: Object.freeze(t), ...r ? { metadata: r } : {}, ...i ? { gesture: i } : {}, ...o ? { application: Object.freeze(o) } : {} });
}
function Ti(e, t) {
  const n = yi(), r = {};
  for (const f of Object.keys(e)) r[f] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
  const i = In({
    snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(r), history: Object.freeze({ canUndo: !1, canRedo: !1 }) }),
    past: [],
    future: [],
    gestures: /* @__PURE__ */ new Map(),
    editOrder: 0,
    detached: /* @__PURE__ */ new Set(),
    parameters: /* @__PURE__ */ new Map(),
    publications: /* @__PURE__ */ new Map()
  }), o = In((f) => f(i).snapshot);
  let a = !1, c, s = 0, u = !1, d, m = [];
  const g = [], y = () => n.get(o), b = (f, l, h = f.past, S = f.future) => ({
    ...f,
    past: h.slice(-100),
    future: S,
    snapshot: Object.freeze({
      ...f.snapshot,
      revision: f.snapshot.revision + 1,
      fields: Object.freeze(l),
      history: Object.freeze({
        canUndo: !a && f.gestures.size === 0 && h.length > 0 && l[h[h.length - 1]?.key ?? ""]?.readiness.kind === "ready",
        canRedo: !a && f.gestures.size === 0 && S.length > 0 && l[S[S.length - 1]?.key ?? ""]?.readiness.kind === "ready"
      })
    })
  }), A = (f) => {
    const l = n.get(i);
    if (f.snapshot === l.snapshot) {
      n.set(i, f);
      return;
    }
    const h = f.snapshot.scope;
    if (!h || !t.bindings?.length) {
      n.set(i, f);
      return;
    }
    const S = { ...f.snapshot.fields };
    for (const v of t.bindings) {
      const T = S[v.key];
      if (!T) continue;
      const p = l.snapshot.fields[v.key], x = !l.snapshot.scope || !be(h, l.snapshot.scope);
      if (!(x || !p || "value" in T && (!("value" in p) || !Object.is(T.value, p.value)) || v.dependencies.some((C) => {
        const K = l.snapshot.fields[C], ee = S[C];
        return K !== ee && (!K || !ee || !("value" in K) || !("value" in ee) || !Object.is(K.value, ee.value));
      }))) {
        const C = T.application ?? p?.application, K = p?.target ?? T.target;
        S[v.key] = T.application === C && T.target === K ? T : Object.freeze({ ...T, ...C ? { application: C } : {}, ...K ? { target: K } : {} });
        continue;
      }
      const D = Object.freeze({ scope: h, key: v.key, generation: x ? 0 : (p?.target?.generation ?? -1) + 1 }), O = {};
      let $ = "value" in T && T.readiness.kind === "ready";
      for (const C of v.dependencies) {
        const K = S[C];
        e[C]?.kind !== "parameter" || !K || !("value" in K) || K.readiness.kind !== "ready" || typeof K.value != "number" ? $ = !1 : O[C] = K.value;
      }
      if (S[v.key] = Object.freeze({ ...T, target: D, application: Object.freeze({ kind: $ ? "pending" : "waiting-for-inputs" }) }), $ && "value" in T) {
        const C = Object.freeze({ value: T.value, parameters: Object.freeze(O) });
        m.push(() => v.replace(C, D));
      } else m.push(() => v.cancel());
    }
    n.set(i, { ...f, snapshot: Object.freeze({ ...f.snapshot, fields: Object.freeze(S) }) });
  }, I = (f, l, h) => {
    const S = e[l];
    return (S?.kind === "stored" ? S.codec.equals(h.before, h.after) : Object.is(h.before, h.after)) ? f : [...f, { key: l, before: h.before, after: h.after, order: h.order }].sort((T, p) => T.order - p.order);
  }, _ = (f, l, h, S, v, T) => {
    const p = e[l], x = f.snapshot.fields[l];
    if (!p || !x || !("value" in x) || !f.snapshot.scope)
      return { kind: "rejected", reason: "not-ready" };
    let k;
    if (p.kind === "parameter") {
      if (typeof h != "number") return { kind: "rejected", reason: "invalid-value" };
      k = f.gestures.has(l) ? [{ kind: "parameter", endpoint: p.endpoint, value: h }] : [
        { kind: "gesture-start", endpoint: p.endpoint },
        { kind: "parameter", endpoint: p.endpoint, value: h },
        { kind: "gesture-end", endpoint: p.endpoint }
      ];
    } else k = [{ kind: "stored", key: l, value: p.codec.encode(h) }];
    const D = x.version + 1, O = ++s, $ = new Map(f.publications).set(O, { key: l, version: D }), C = b(f, { ...f.snapshot.fields, [l]: le(h, { kind: p.kind === "parameter" ? "host-managed" : "pending" }, D, x.metadata, x.gesture, p.kind === "parameter" ? { kind: "pending" } : void 0) }, S, v), K = {
      kind: "accepted",
      revision: C.snapshot.revision,
      version: D,
      ...T === "edit" ? { changed: !0 } : {}
    };
    return d = K, A({ ...C, publications: $ }), a || t.native.publish({ request: O, scope: f.snapshot.scope, operations: k }), K;
  }, N = (f) => {
    const l = n.get(i);
    if (f.kind === "opened" || f.kind === "replaced") {
      if (l.snapshot.scope && (f.kind === "opened" || f.scope.owner !== l.snapshot.scope.owner || f.scope.document <= l.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
      const h = {}, S = /* @__PURE__ */ new Map();
      for (const [T, p] of Object.entries(e))
        if (p.kind === "parameter") {
          const x = f.native.parameters.find((k) => k.endpoint === p.endpoint);
          if (x && xn(x)) {
            S.set(T, Object.freeze({ ...x }));
            const { min: k, max: D, step: O, defaultValue: $ } = x;
            h[T] = le(x.value, { kind: "host-managed" }, 0, Object.freeze({ min: k, max: D, step: O, defaultValue: $ }), void 0, { kind: "unconfirmed" });
          } else h[T] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: x ? "invalid-state" : "missing-parameter" }) });
        } else {
          const x = Object.hasOwn(f.native.values, T), k = x ? p.codec.parse(f.native.values[T]) : p.initial;
          h[T] = k.kind === "ok" ? le(k.value, { kind: x ? "observed-in-native-state" : "not-written" }) : Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }) });
        }
      const v = b(l, h, [], []);
      A({ ...v, gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map(), editOrder: 0, parameters: S, snapshot: Object.freeze({ ...v.snapshot, scope: Object.freeze({ ...f.scope }) }) });
    } else if (f.kind === "command") {
      if (!l.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
      if (!be(f.address, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(f.address.client)) return { kind: "rejected", reason: "service-closed" };
      if (f.command.kind === "undo" || f.command.kind === "redo") {
        if (l.gestures.size > 0) return { kind: "rejected", reason: "busy" };
        const O = f.command.kind === "undo", $ = O ? l.past : l.future, C = $[$.length - 1];
        return C ? _(
          l,
          C.key,
          O ? C.before : C.after,
          O ? l.past.slice(0, -1) : [...l.past, C],
          O ? [...l.future, C] : l.future.slice(0, -1),
          "history"
        ) : { kind: "accepted", revision: l.snapshot.revision };
      }
      const { key: h } = f.command;
      if (!Object.hasOwn(e, h)) return { kind: "rejected", reason: "invalid-command" };
      const S = e[h], v = l.snapshot.fields[h];
      if (!S || !v) return { kind: "rejected", reason: "invalid-command" };
      if (!("value" in v)) return { kind: "rejected", reason: "not-ready" };
      const T = l.gestures.get(h);
      if (T && T.client !== f.address.client) return { kind: "rejected", reason: "busy" };
      if (f.command.kind === "begin" || f.command.kind === "end") {
        const { gesture: O } = f.command;
        if (!Number.isSafeInteger(O) || O <= 0) return { kind: "rejected", reason: "invalid-command" };
        if (T && T.gesture !== O) return { kind: "rejected", reason: "invalid-command" };
        const $ = f.command.kind === "begin";
        if ($ === !!T) return { kind: "accepted", revision: l.snapshot.revision, version: v.version };
        const C = new Map(l.gestures);
        let K = l.past, ee;
        if ($) {
          ee = Object.freeze({ client: f.address.client, gesture: O });
          const yn = v.value;
          C.set(h, { ...ee, before: yn, after: yn, order: 0 });
        } else T && (C.delete(h), K = I(K, h, T));
        const gt = b({ ...l, gestures: C }, {
          ...l.snapshot.fields,
          [h]: le(v.value, v.persistence, v.version, v.metadata, ee, v.application)
        }, K);
        return d = { kind: "accepted", revision: gt.snapshot.revision, version: v.version }, A({ ...gt, gestures: C }), a ? d : (S.kind === "parameter" && t.native.publish({
          request: ++s,
          scope: l.snapshot.scope,
          operations: [{ kind: $ ? "gesture-start" : "gesture-end", endpoint: S.endpoint }]
        }), { kind: "accepted", revision: gt.snapshot.revision, version: v.version });
      }
      const { value: p, expectedVersion: x } = f.command;
      if (f.command.gesture !== void 0 && (!T || T.gesture !== f.command.gesture))
        return { kind: "rejected", reason: "invalid-command" };
      if (T && f.command.gesture === void 0) return { kind: "rejected", reason: "invalid-command" };
      if (x !== void 0 && x !== v.version) return { kind: "rejected", reason: "stale-version" };
      let k;
      if (S.kind === "parameter") {
        const O = l.parameters.get(h);
        if (!O) return { kind: "rejected", reason: "not-ready" };
        if (typeof p != "number" || !Number.isFinite(p)) return { kind: "rejected", reason: "invalid-value" };
        const $ = Math.min(O.max, Math.max(O.min, p));
        if (k = O.step > 0 ? Math.min(O.max, Math.max(O.min, O.min + Math.round(($ - O.min) / O.step) * O.step)) : $, Object.is(v.value, k)) return { kind: "accepted", revision: l.snapshot.revision, version: v.version, changed: !1 };
      } else {
        const O = S.codec.parse(p);
        if (O.kind === "error") return { kind: "rejected", reason: "invalid-value" };
        if (k = O.value, S.codec.equals(v.value, k)) return { kind: "accepted", revision: l.snapshot.revision, version: v.version, changed: !1 };
      }
      const D = l.editOrder + 1;
      if (T) {
        const O = new Map(l.gestures).set(h, { ...T, after: k, order: D });
        return _({ ...l, gestures: O, editOrder: D }, h, k, l.past, [], "edit");
      }
      return _({ ...l, editOrder: D }, h, k, [
        ...l.past,
        { key: h, before: v.value, after: k, order: D }
      ], [], "edit");
    } else if (f.kind === "engine") {
      const h = l.snapshot.fields[f.target.key];
      if (!h?.target || !be(h.target.scope, f.target.scope) || h.target.generation !== f.target.generation) return { kind: "accepted", revision: l.snapshot.revision };
      A(b(l, {
        ...l.snapshot.fields,
        [f.target.key]: Object.freeze({ ...h, application: Object.freeze({ ...f.status }) })
      }));
    } else if (f.kind === "detached") {
      if (!l.snapshot.scope || !be(f.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      if (l.detached.has(f.client)) return { kind: "accepted", revision: l.snapshot.revision };
      const h = new Map(l.gestures), S = { ...l.snapshot.fields }, v = [];
      let T = l.past;
      for (const [x, k] of l.gestures) {
        if (k.client !== f.client) continue;
        h.delete(x), T = I(T, x, k);
        const D = S[x];
        D && "value" in D && (S[x] = le(D.value, D.persistence, D.version, D.metadata, void 0, D.application));
        const O = e[x];
        O?.kind === "parameter" && v.push({ kind: "gesture-end", endpoint: O.endpoint });
      }
      const p = h.size === l.gestures.size ? l : b({ ...l, gestures: h }, S, T);
      return d = { kind: "accepted", revision: p.snapshot.revision }, A({ ...p, gestures: h, detached: new Set(l.detached).add(f.client) }), !a && v.length > 0 && t.native.publish({ request: ++s, scope: l.snapshot.scope, operations: v }), d;
    } else if (f.kind === "parameter") {
      if (!l.snapshot.scope || !be(f.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      for (const [h, S] of l.parameters) {
        if (S.endpoint !== f.endpoint) continue;
        if (!xn({ ...S, value: f.value })) return { kind: "rejected", reason: "invalid-value" };
        const v = l.snapshot.fields[h];
        if (!v || !("value" in v)) continue;
        const T = Object.is(v.value, f.value) ? l : b(l, {
          ...l.snapshot.fields,
          [h]: le(f.value, { kind: "host-managed" }, v.version + 1, v.metadata, v.gesture, { kind: "unconfirmed" })
        });
        A(T);
      }
    } else {
      if (!l.snapshot.scope || !be(f.scope, l.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
      const h = l.publications.get(f.request);
      if (h) {
        const S = new Map(l.publications);
        S.delete(f.request);
        const v = l.snapshot.fields[h.key];
        if (v && "value" in v && v.version === h.version) {
          const T = f.result.kind === "observed" ? { kind: e[h.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" } : { kind: "failed", reason: f.result.reason }, p = e[h.key]?.kind === "parameter" ? f.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: Object.freeze({ kind: "transport", message: f.result.reason }) } : v.application, x = b(l, { ...l.snapshot.fields, [h.key]: le(v.value, T, v.version, v.metadata, v.gesture, p) });
          A({ ...x, publications: S });
        } else A({ ...l, publications: S });
      }
    }
    return { kind: "accepted", revision: n.get(i).snapshot.revision };
  }, M = (f) => {
    if (a) return;
    a = !0;
    let l = () => {
    };
    c = new Promise((T) => {
      l = T;
    });
    const h = [];
    for (const T of t.bindings ?? [])
      try {
        h.push(T.stop());
      } catch (p) {
        h.push(Promise.reject(p));
      }
    Promise.allSettled(h).then((T) => {
      for (const p of T) p.status === "rejected" && t.onDefect(p.reason);
      l();
    });
    const S = n.get(i), v = {};
    for (const [T, p] of Object.entries(S.snapshot.fields)) {
      const { gesture: x, ...k } = "value" in p ? p : { ...p, gesture: void 0 };
      v[T] = Object.freeze({ ...k, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
    }
    try {
      n.set(i, { ...b(S, v), gestures: /* @__PURE__ */ new Map(), publications: /* @__PURE__ */ new Map() });
    } catch (T) {
      t.onDefect(T);
    }
    if (f)
      try {
        t.native.update(y(), f);
      } catch (T) {
        t.onDefect(T);
      }
    t.native.close({ reason: "service-closed" });
  }, E = () => {
    if (!u) {
      u = !0;
      try {
        for (let f = g.shift(); f; f = g.shift()) {
          d = void 0, m = [];
          let l, h = !1;
          try {
            l = a ? { kind: "rejected", reason: "service-closed" } : N(f.event), d = l;
            for (const S of m)
              a || S();
            a || (h = !0, t.native.update(y(), f.event.kind === "command" ? { address: f.event.address, result: l } : void 0));
          } catch (S) {
            l = d ?? { kind: "rejected", reason: "service-closed" }, t.onDefect(S), M(!h && f.event.kind === "command" ? { address: f.event.address, result: l } : void 0);
          }
          f.finish(l);
        }
      } finally {
        u = !1;
      }
    }
  };
  return {
    getSnapshot: y,
    subscribe: (f) => n.sub(o, () => f(y())),
    dispatch: (f) => new Promise((l) => {
      g.push({ event: f, finish: l }), E();
    }),
    stop: () => (M(), c ?? Promise.resolve())
  };
}
const Ai = 5e3;
function Q(e, t) {
  return e !== null && e.owner === t.owner && e.document === t.document;
}
function Ei(e, t, n) {
  let r = !1, i = !1, o = 0, a = 0, c, s, u, d = () => {
  }, m = () => {
  };
  const g = /* @__PURE__ */ new Map(), y = (E) => {
    if (!wr(E)) throw new Error("State-channel message exceeds the native JSON contract.");
    t.sendMessageToServer({ type: "kit_state", message: E });
  }, b = /* @__PURE__ */ new Map(), A = [];
  for (const [E, f] of Object.entries(e)) {
    if (f.kind !== "stored" || !f.engine) continue;
    const l = f.engine, h = Vo({
      async prepare(S, v) {
        const T = await l.prepare(S.value, { parameters: S.parameters, signal: v }), p = bi(T);
        return p.kind === "ok" ? { kind: "ok", value: { target: S.target, value: p.value } } : { kind: "error", error: { kind: "engine-rejected", message: p.message } };
      },
      transport: {
        apply(S, v) {
          return new Promise((T) => {
            let p = 0, x = () => {
            };
            const k = (D) => {
              x(), b.delete(p), T(D);
            };
            x = v.signal.onAbort(() => k({ kind: "cancelled" }));
            try {
              const D = v.send(() => Q(I.getSnapshot().scope, S.target.scope) ? (p = ++o, b.set(p, { key: E, target: S.target, finish: k }), y({
                kind: "publish",
                request: p,
                scope: S.target.scope,
                operations: [{ kind: "event", endpoint: l.endpoint, value: S.value }]
              }), { kind: "sent", proof: "connection-call-returned" }) : { kind: "cancelled" });
              D.kind !== "sent" && k(D);
            } catch (D) {
              x(), b.delete(p), n.onDefect(D), M(), T({ kind: "cancelled" });
            }
          });
        },
        stop() {
          for (const S of b.values()) S.key === E && S.finish({ kind: "cancelled" });
        }
      },
      onStatus(S, v) {
        I.dispatch({ kind: "engine", target: S, status: v });
      },
      onDefect: n.onDefect
    });
    A.push({
      key: E,
      dependencies: l.dependencies,
      replace(S, v) {
        h.replace({ ...S, target: v }, v);
      },
      cancel: h.cancel,
      stop: h.stop
    });
  }
  const I = Ti(e, {
    bindings: A,
    onDefect: n.onDefect,
    native: {
      publish(E) {
        const f = ++o;
        g.set(f, { request: E.request, scope: E.scope }), y({ kind: "publish", ...E, request: f });
      },
      update(E, f) {
        E.scope && y({
          kind: "update",
          scope: E.scope,
          revision: E.revision,
          state: Rn(e, E),
          ...f ? { receipt: f } : {}
        });
      },
      close(E) {
        i = !0, m(new Error("State service closed before native initialization completed."));
        try {
          r && I.getSnapshot().scope && y({ kind: "close", ...E });
        } catch (f) {
          n.onDefect(f);
        }
        r && t.removeEventListener("kit_state", N), r = !1, g.clear();
      }
    }
  }), _ = (E) => {
    if (i) return;
    const f = Si(E);
    if (f.kind === "invalid") {
      const h = new Error(f.message);
      n.onDefect(h), m(h), M();
      return;
    }
    const l = f.value;
    if (l.kind === "closed")
      m(new Error(`Native state service closed: ${l.reason}`)), M();
    else if (l.kind === "open-failed") {
      if (l.request !== a || I.getSnapshot().scope) return;
      m(new Error(`Native state open failed: ${l.reason}`)), M();
    } else if (l.kind === "opened") {
      if (l.request !== a || I.getSnapshot().scope) return;
      I.dispatch(l).then((h) => {
        h.kind === "accepted" ? d() : m(new Error("Native state could not initialize the service."));
      });
    } else if (l.kind === "attached-client") {
      const h = I.getSnapshot();
      Q(h.scope, l.scope) && y({
        kind: "snapshot",
        scope: l.scope,
        to: l.client,
        attachRequest: l.request,
        revision: h.revision,
        state: Rn(e, h)
      });
    } else if (l.kind === "detach")
      I.dispatch({ kind: "detached", scope: l.scope, client: l.client });
    else if (l.kind === "parameter")
      Q(I.getSnapshot().scope, l.scope) && I.dispatch(l);
    else if (l.kind === "replaced")
      I.dispatch(l).then((h) => {
        if (h.kind === "accepted")
          for (const [S, v] of g)
            Q(I.getSnapshot().scope, v.scope) || g.delete(S);
      });
    else if (l.kind === "command")
      I.dispatch(l);
    else if (l.kind === "invalid-command")
      Q(I.getSnapshot().scope, l.address) && y({
        kind: "receipt",
        address: l.address,
        result: { kind: "rejected", reason: "invalid-command" }
      });
    else {
      const h = b.get(l.request);
      if (h) {
        if (!Q(h.target.scope, l.scope) || !Q(I.getSnapshot().scope, l.scope)) return;
        h.finish(l.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" } : { kind: "failed", error: { kind: "transport", message: l.result.reason } });
        return;
      }
      const S = g.get(l.request);
      if (!S || !Q(S.scope, l.scope) || !Q(I.getSnapshot().scope, l.scope)) return;
      g.delete(l.request), I.dispatch({ ...l, request: S.request });
    }
  }, N = (E) => {
    if (!i)
      try {
        _(E);
      } catch (f) {
        n.onDefect(f), m(f), M();
      }
  }, M = () => u || (i = !0, m(new Error("State service stopped before native initialization completed.")), u = I.stop(), u);
  return {
    /** Open declared native state before making the worker service ready. */
    start() {
      if (i) return Promise.reject(new Error("State service is closed."));
      if (c) return c;
      if (typeof t.addEventListener != "function" || typeof t.removeEventListener != "function" || typeof t.sendMessageToServer != "function")
        return M(), Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
      c = new Promise((E, f) => {
        d = () => {
          clearTimeout(s), E();
        }, m = (l) => {
          clearTimeout(s), f(l);
        };
      });
      try {
        r = !0, t.addEventListener("kit_state", N), a = ++o, s = setTimeout(() => {
          m(new Error("Cmajor state-channel is unavailable: native open timed out.")), M();
        }, Ai), y({
          kind: "open",
          request: a,
          parameters: Object.values(e).filter((E) => E.kind === "parameter").map((E) => E.endpoint),
          storedKeys: Object.keys(e).filter((E) => e[E]?.kind === "stored"),
          eventEndpoints: Object.values(e).flatMap((E) => E.kind === "stored" && E.engine ? [E.engine.endpoint] : [])
        });
      } catch (E) {
        n.onDefect(E), m(E), M();
      }
      return c;
    },
    /** Release this owner and its channel resources. */
    stop: M
  };
}
const Lr = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.attach-requests.v1"), Pt = Reflect.get(globalThis, Lr), Mn = Pt instanceof WeakMap ? Pt : /* @__PURE__ */ new WeakMap();
Pt !== Mn && Object.defineProperty(globalThis, Lr, { value: Mn });
const Ri = 2e3;
function On(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function kn(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function xi(e, t) {
  if (!kn(e))
    return { found: !1 };
  const n = kn(e.values) ? e.values : void 0;
  return n && On(n, t) ? {
    found: !0,
    value: n[t]
  } : On(e, t) ? {
    found: !0,
    value: e[t]
  } : { found: !1 };
}
function _n(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class Mi {
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
    this.connection = t, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Oi(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const i = xi(n, this.stateKeys[r]);
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
    }, i = _n(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), c = _n({
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
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, r).then((u) => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, u ? (this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r) : this.options.onDeliveryFailure?.(a);
        const d = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, d && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, this.options.onDeliveryFailure?.(a);
        const u = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, u && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of a)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Ri
      );
    this.lastAppliedToken = c, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function Oi(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e)
    t.has(n.endpointID) || t.set(n.endpointID, n);
  return [...t.values()];
}
function ki(e, t) {
  return new Mi(e, t);
}
class _i {
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
function wi(e, t) {
  return new _i(e, t);
}
async function Di(e, t) {
  const n = wi(e, t);
  return await n.start(), n;
}
function yt(e) {
  return Object.freeze({ kind: "parameter", endpoint: e });
}
function Li(e) {
  return Object.freeze({ ...e });
}
function G(e, t) {
  if (!e)
    throw new Error(t);
}
function vt(e, t, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(e.getUint8(t + i));
  return r;
}
function Ni(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function Ft(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Nr(e) {
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
function Ci() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function It(e, t) {
  const n = Ci();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (Ni(t))
      return new URL(t);
    const r = t.startsWith("/") ? t.slice(1) : t;
    return new URL(r, n);
  }
  return new URL(e, n);
}
async function wn(e) {
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
  throw new Error(`Unsupported text resource payload (${Nr(e)})`);
}
function Pi(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return Ft(e);
  throw new Error(`Unsupported binary resource payload (${Nr(e)})`);
}
function Fi(e) {
  const t = e?.frames;
  G(
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
      G(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: r
  };
}
function Cr(e) {
  const t = new DataView(e);
  G(vt(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), G(vt(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, c = null, s = null, u = 12;
  for (; u + 8 <= t.byteLength; ) {
    const m = vt(t, u, 4), g = t.getUint32(u + 4, !0), y = u + 8;
    m === "fmt " ? (n = t.getUint16(y, !0), r = t.getUint16(y + 2, !0), i = t.getUint32(y + 4, !0), a = t.getUint16(y + 12, !0), o = t.getUint16(y + 14, !0)) : m === "data" && (c = y, s = g), u = y + g + g % 2;
  }
  G(n !== null, "Wave file is missing a fmt chunk"), G(c !== null && s !== null, "Wave file is missing a data chunk"), G(r === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && o === 32)
    d = new Float32Array(e.slice(c, c + s));
  else if (n === 1 && o === 16) {
    const m = s / 2, g = new Int16Array(e.slice(c, c + s));
    d = new Float32Array(m);
    for (let y = 0; y < m; y += 1)
      d[y] = g[y] / 32768;
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
async function Dn(e) {
  G(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return G(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function Kt(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Pr(e) {
  const t = new Uint8Array(e).buffer, n = Cr(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Ki(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (s) => (G(typeof e.readResource == "function", `Resource bridge cannot read ${s}`), e.readResource(s)), i = async (s) => {
    G(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const u = await e.readResourceAsAudioData(s);
    return Fi(u);
  }, o = (s) => {
    const u = e.getResourceAddress?.(s);
    return u ?? null;
  }, a = async (s, u = e.getResourceAddress?.(s)) => {
    const d = It(s, u), m = await Dn(d), g = Cr(m);
    return {
      sampleRate: g.sampleRate,
      samples: g.samples
    };
  }, c = async (s, u = e.getResourceAddress?.(s)) => {
    const d = It(s, u);
    return new Uint8Array(await Dn(d));
  };
  return {
    async readText(s) {
      if (t === "bridge" && typeof e.readResource == "function")
        return wn(await r(s));
      const u = o(s);
      return t === "url" && u !== null ? Kt(await c(s, u)) : typeof e.readResource == "function" ? wn(await r(s)) : Kt(await c(s, u));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof e.readResource == "function" ? Pi(await r(s)) : c(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return i(s);
      const u = o(s);
      return n === "url" && u !== null ? a(s, u) : typeof e.readResourceAsAudioData == "function" ? i(s) : Pr(await this.readBytes(s));
    },
    getURL(s) {
      return It(s, e.getResourceAddress?.(s));
    }
  };
}
function Ui(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return Ki(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function zi(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, r = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, i = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, o = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(a) {
      if (t)
        return t(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Kt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (t)
        return Ft(await t(a));
      if (n)
        return Ft(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Pr(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Vi(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function ji(e) {
  return Vi(e) ? zi(e) : Ui(e);
}
const $i = Li({
  playMode: yt("playMode"),
  glideTime: yt("glideTime"),
  globalTune: yt("globalTune")
}), Ye = 2048;
function Ce(e, t) {
  if (!e)
    throw new Error(t);
}
function Bi(e) {
  Ce(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, r) => {
    Ce(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), Ce(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), Ce(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), Ce(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), t;
}
const Hi = 2048, Fr = 11, qi = 256;
function X(e, t) {
  if (!e)
    throw new Error(t);
}
function Wi(e) {
  return e > 0 && (e & e - 1) === 0;
}
const Ln = /* @__PURE__ */ new Map();
function Gi(e) {
  const t = Ln.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), r = new Uint32Array(e);
  for (let i = 0; i < e; i += 1) {
    let o = 0, a = i;
    for (let c = 0; c < n; c += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return Ln.set(e, r), r;
}
function Kr(e, t, n = !1) {
  const r = e.length;
  X(r === t.length, "FFT real and imaginary buffers must have the same length"), X(Wi(r), "FFT input length must be a power of two");
  const i = Gi(r);
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
    const a = o >> 1, c = (n ? 2 : -2) * Math.PI / o, s = Math.cos(c), u = Math.sin(c);
    for (let d = 0; d < r; d += o) {
      let m = 1, g = 0;
      for (let y = 0; y < a; y += 1) {
        const b = d + y, A = b + a, I = e[A], _ = t[A], N = m * I - g * _, M = m * _ + g * I, E = e[b], f = t[b];
        e[b] = E + N, t[b] = f + M, e[A] = E - N, t[A] = f - M;
        const l = m * s - g * u;
        g = m * u + g * s, m = l;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      e[o] /= r, t[o] /= r;
}
function Ur(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let o = 0; o < t.length; o += 1)
    n += Number(t[o]) || 0;
  const r = n / Math.max(1, t.length), i = new Float32Array(t.length);
  for (let o = 0; o < t.length; o += 1)
    i[o] = (Number(t[o]) || 0) - r;
  return i;
}
function Yi(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Hi,
  maxFramesPerTable: r = qi
} = {}) {
  const i = Float32Array.from(e);
  X(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  X(o > 0, "Source wavetable files must contain at least one frame"), X(o <= r, `Source wavetable files must contain at most ${r} frames`), t !== void 0 && X(o === t, `Source wavetable frame count mismatch: expected ${t}, got ${o}`);
  const a = [];
  for (let c = 0; c < o; c += 1) {
    const s = c * n, u = s + n;
    a.push(Ur(i.slice(s, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Nn(e) {
  const t = Ur(e), n = Float64Array.from(t), r = new Float64Array(n.length);
  return Kr(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Ji(e, t, {
  mipLevelCount: n = Fr
} = {}) {
  const r = e?.real?.length ?? 0;
  X(r > 0, "Spectrum must contain real samples"), X(r === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), X(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << t, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let c = 1; c <= i; c += 1) {
    o[c] = e.real[c], a[c] = e.imaginary[c];
    const s = (r - c) % r;
    s !== c && (o[s] = e.real[s], a[s] = e.imaginary[s]);
  }
  return Kr(o, a, !0), Float32Array.from(o);
}
const Me = -100, et = 35, Qi = 5, Xi = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function zr(e) {
  const t = Xi.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function W(e) {
  return zr(e).laneEndpointID;
}
function Zi(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > Qi)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${zr(e).hostStem}${t}OutputTrimDb`;
}
function Vr(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function ea(e) {
  const t = (Vr(e, Me, et) - Me) / (et - Me);
  return t * t;
}
function ta(e) {
  const t = Math.sqrt(Vr(e, 0, 1));
  return Me + t * (et - Me);
}
const H = (e, t) => ({ label: e, value: t });
function te(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const ne = Object.freeze({
  filter: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: te(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), R = (e, t, n, r, i, o, a, c = {}) => ({
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
function re(e, t, n) {
  return R(
    e,
    t,
    "Output Trim",
    "Trim",
    Me,
    et,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const na = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ra = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], oa = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: ne.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      R("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(H), quick: !0 }),
      R("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      R("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      R("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      re("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: ne.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      R("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [H("Classic", 0), H("Harmonics", 1)] }),
      R("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      R("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      R("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      R("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      R("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      R("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [H("Symmetric", 0), H("Asymmetric", 1), H("Wavefold", 2)] }),
      re("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: ne.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      R("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      R("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      R("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      R("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      R("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      re("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: ne.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      R("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(H) }),
      R("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(H) }),
      R("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      R("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      R("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      R("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      R("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      re("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: ne.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      R("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      R("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      R("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      R("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      R("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      re("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: ne.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      R("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [H("Free", 0), H("Sync", 1)] }),
      R("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      R("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: na.map(H) }),
      R("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      R("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      R("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      R("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      R("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      re("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: ne.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      R("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [H("Free", 0), H("Sync", 1)] }),
      R("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      R("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ra.map(H) }),
      R("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      R("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      R("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      re("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: ne.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      R("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      R("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      R("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      R("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      re("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], mt = oa, jr = Object.freeze(
  mt.flatMap((e) => e.parameters)
);
new Map(
  jr.map((e) => [e.endpointID, e])
);
function $r(e) {
  const t = mt.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Br() {
  return jr;
}
function tn(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const P = ["A", "B", "C"], Hr = [
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
], ia = [
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
], Ie = Object.freeze([
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
]), aa = Object.freeze([
  ...P.flatMap((e) => Hr.map(
    (t) => `osc${e}.${t}`
  )),
  ...ia
]);
new Set(
  P.flatMap((e) => Hr.map(
    (t) => `osc${e}.${t}`
  ))
);
const qr = Object.freeze(
  aa.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), sa = Br().filter(
  (e) => e.modulationTargetIndex !== null
), ca = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function nn(e) {
  const t = la(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function la(e) {
  const t = ca.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const da = [
  ...sa.map((e) => ({
    kind: nn(tn(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Wr = Object.freeze(
  da.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), ae = Object.freeze([
  ...qr,
  ...Wr
]), Je = Ie.length, Gr = qr.length, ht = Wr.length, ua = Je * ae.length, fa = new Map(Ie.map((e) => [e.id, e])), Yr = new Map(Ie.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), Le = new Map(ae.map((e) => [e.kind, e]));
function ma() {
  if (Je !== 14 || Gr !== 59 || ht !== 47 || ua !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = Ie.filter((r) => r.group === e).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = ae.filter((r) => r.group === e);
    if (n.length !== t || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (fa.size !== Je || Yr.size !== Je || Le.size !== ae.length)
    throw new Error("Modulation identities must be unique");
}
ma();
function Jr(e, t) {
  const n = Yr.get(`${e}:${t ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${e}:${t ?? 0}`);
  return n;
}
function rn(e) {
  return typeof e != "string" ? null : Le.has(e) ? e : null;
}
function ha(e) {
  const t = rn(e);
  return t !== null && Le.get(t)?.group === "voice" ? t : null;
}
function on(e) {
  const t = rn(e);
  return t !== null && Le.get(t)?.group === "rack" ? t : null;
}
function pa(e) {
  const t = Le.get(e);
  if (t?.group !== "voice") throw new Error(`Unknown voice modulation target: ${e}`);
  return t.runtimeIndex;
}
function Qr(e) {
  const t = Le.get(e);
  if (t?.group !== "rack") throw new Error(`Unknown rack modulation target: ${e}`);
  return t.runtimeIndex;
}
function ga(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Xr = 4, ya = Xr * ht, va = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Ia = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Se(e) {
  if (typeof e != "string")
    return null;
  const t = Ia.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = va.get(n);
  if (r === void 0)
    return null;
  const i = t[3];
  return r.includes(i) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function an(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function Zr(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
function eo(e) {
  if (e === null)
    return null;
  const t = Zr(e) - 1;
  return t > Xr ? null : t * ht + Qr(an(e));
}
const ie = 2048, Sa = ie + 3, Cn = 20, to = "MSEG 1", ba = 0, fe = 2, Ta = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function sn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function _e(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Aa(e) {
  return sn(Number.isFinite(e) ? e : 0, -Cn, Cn);
}
function ge(e) {
  return sn(Number.isFinite(e) ? e : 0, 0, 1);
}
function no(e = to) {
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
function Ut() {
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
function Ea(e) {
  const t = Number(e);
  return sn(
    Number.isFinite(t) ? t : 1,
    ba,
    fe
  );
}
function Ra(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = ge(Number(t.startX)), r = ge(Number(t.endX));
  return _e(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function xa(e = Ut()) {
  const t = e && typeof e == "object" ? e : {}, n = t.rate && typeof t.rate == "object" ? t.rate : {}, r = Number(n.seconds), i = t.noteOffPolicy, o = Ta.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Ea(Number.isFinite(r) ? r : 1)
    },
    loop: Ra(t.loop),
    noteOffPolicy: o,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function Ma(e, t, n) {
  const r = e && typeof e == "object" ? e : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (i = ge(i)), {
    x: i,
    y: ge(Number(r.y)),
    curvePower: Aa(Number(r.curvePower))
  };
}
function ze(e = no()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => Ma(i, o, n.length));
  if (!_e(r[0].x, 0) || !_e(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : to,
    globalSmooth: !!t.globalSmooth,
    points: r
  };
}
function Pn(e) {
  return JSON.stringify(ze(e));
}
function Oa(e, t) {
  if (Math.abs(t) < 0.01)
    return e;
  const n = Math.exp(t * e) - 1, r = Math.exp(t) - 1;
  return n / r;
}
function ka(e, t) {
  if (t <= e[0].x)
    return { from: e[0], to: e[0], laterPointWins: !1 };
  for (let n = 0; n < e.length - 1; n += 1) {
    const r = e[n], i = e[n + 1];
    if (t < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (_e(t, i.x)) {
      let o = n + 1;
      for (; o + 1 < e.length && _e(e[o + 1].x, t); )
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
function _a(e, t) {
  const n = ge(Number(t)), r = ka(e, n);
  if (r.laterPointWins || _e(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = ge(Oa(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function wa(e, t) {
  return _a(ze(e).points, t);
}
function Da(e) {
  const t = ze(e), n = new Float32Array(ie);
  for (let i = 0; i < ie; i += 1) {
    const o = i / (ie - 1);
    n[i] = wa(t, o);
  }
  const r = new Float32Array(Sa);
  return r[0] = n[0], r.set(n, 1), r[ie + 1] = n[ie - 1], r[ie + 2] = n[ie - 1], r;
}
function Fn(e, t) {
  return Pn(e) === Pn(t);
}
const St = "modulationProgram", La = "modulationAmount", ro = Ie.filter((e) => e.group === "voice").length, oo = Ie.filter((e) => e.group === "macro").length, tt = Gr, Na = ht, nt = Na + ya, me = ro * tt, Ae = oo * tt, Ca = ro * nt, Pa = oo * nt, de = 512, Te = 256, io = me + Ae;
function Fa(e) {
  const t = Jr(e.sourceKind, e.sourceSlot);
  if (t.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return t.runtimeIndex;
}
function Ka(e) {
  const t = ha(e);
  return t === null ? null : pa(t);
}
function ao(e) {
  const t = Ka(e.targetKind), n = on(e.targetKind);
  let r = n === null ? void 0 : Qr(n);
  if (r === void 0) {
    const a = eo(
      Se(e.targetKind)
    );
    a !== null && (r = a);
  }
  if (t === null && r === void 0)
    throw new Error(`Unknown modulation target: ${e.targetKind}`);
  if (e.sourceKind === "macro") {
    const a = Jr(e.sourceKind, e.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${e.sourceKind}:${String(e.sourceSlot)}`);
    const c = a.runtimeIndex;
    if (t !== null) {
      const u = c * tt + t;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: c,
        targetIndex: t,
        articulationCellIndex: me + u
      };
    }
    const s = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: c * nt + s,
      sourceIndex: c,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const i = Fa(e);
  if (t !== null) {
    const a = i * tt + t;
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
    cellIndex: i * nt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function so(e) {
  return Se(e.targetKind) !== null ? null : ao(e).articulationCellIndex;
}
function Ua(e) {
  if (on(e.targetKind) !== null)
    return !1;
  const t = Se(e.targetKind);
  return t !== null && eo(t) === null;
}
function za(e) {
  return {
    ...ao(e),
    enabled: e.enabled,
    polarity: e.polarity === "bipolar" ? 1 : 0,
    reducer: e.reducer === "mean" ? 2 : 1,
    amount: e.amount
  };
}
function co(e) {
  const t = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of e) {
    if (Ua(n))
      continue;
    const r = za(n), i = t[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return t;
}
function Va(e) {
  return e.enabled ? e.path === "voiceRack" || e.path === "macroRack" ? e.amount !== 0 : !0 : !1;
}
function Ee(e) {
  return [...e.values()].filter(Va).sort((t, n) => t.cellIndex - n.cellIndex);
}
function Be(e, t, n, r, i) {
  for (let o = 0; o < e.length; o += 1) {
    const a = e[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    t[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function bt(e) {
  const t = co(e), n = Ee(t.voice), r = Ee(t.macroVoice), i = Ee(t.voiceRack), o = Ee(t.macroRack), a = Array.from({ length: me }, () => 0), c = Array.from({ length: me }, () => 0), s = Array.from({ length: me }, () => 0), u = Array.from({ length: me }, () => 0), d = Array.from({ length: me }, () => 0);
  Be(n, a, c, s, u);
  const m = Array.from({ length: Ae }, () => 0), g = Array.from({ length: Ae }, () => 0), y = Array.from({ length: Ae }, () => 0), b = Array.from({ length: Ae }, () => 0), A = Array.from({ length: Ae }, () => 0);
  if (Be(
    r,
    m,
    g,
    y,
    b
  ), i.length > de || o.length > Te)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${de}), ${o.length} macro-rack (max ${Te})`
    );
  const I = Array.from({ length: de }, () => 0), _ = Array.from({ length: de }, () => 0), N = Array.from({ length: de }, () => 0), M = Array.from({ length: de }, () => 0), E = Array.from({ length: de }, () => 0), f = Array.from({ length: Ca }, () => 0);
  Be(
    i,
    I,
    _,
    N,
    M
  );
  const l = Array.from({ length: Te }, () => 0), h = Array.from({ length: Te }, () => 0), S = Array.from({ length: Te }, () => 0), v = Array.from({ length: Te }, () => 0), T = Array.from({ length: Pa }, () => 0);
  Be(
    o,
    l,
    h,
    S,
    v
  );
  for (const p of t.voice.values()) d[p.cellIndex] = p.amount;
  for (const p of t.macroVoice.values()) A[p.cellIndex] = p.amount;
  for (const p of t.voiceRack.values()) f[p.cellIndex] = p.amount;
  for (const p of t.macroRack.values()) T[p.cellIndex] = p.amount;
  for (let p = 0; p < i.length; p += 1) {
    const x = i[p];
    if (x === void 0) throw new Error(`Missing compiled voice-rack route at index ${p}`);
    E[p] = x.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: c,
    voiceRouteTargets: s,
    voiceRoutePolarities: u,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: g,
    macroVoiceRouteTargets: y,
    macroVoiceRoutePolarities: b,
    macroVoiceRouteAmounts: A,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: I,
    voiceRackRouteSources: _,
    voiceRackRouteTargets: N,
    voiceRackRoutePolarities: M,
    voiceRackRouteReducers: E,
    voiceRackRouteAmounts: f,
    macroRackRouteCount: o.length,
    macroRackRouteCells: l,
    macroRackRouteSources: h,
    macroRackRouteTargets: S,
    macroRackRoutePolarities: v,
    macroRackRouteAmounts: T
  };
}
const ja = ["voice", "macroVoice", "voiceRack", "macroRack"], $a = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Kn(e) {
  return co(e);
}
function Ba(e, t) {
  return e.cellIndex === t.cellIndex && e.sourceIndex === t.sourceIndex && e.targetIndex === t.targetIndex && e.polarity === t.polarity && e.reducer === t.reducer;
}
function Ha(e, t) {
  if (e === null)
    return [{ endpointID: St, value: bt(t) }];
  const n = Kn(e), r = Kn(t), i = [];
  for (const o of ja) {
    const a = Ee(n[o]), c = Ee(r[o]);
    if (a.length !== c.length)
      return [{ endpointID: St, value: bt(t) }];
    for (let s = 0; s < c.length; s += 1) {
      const u = a[s], d = c[s];
      if (u === void 0 || d === void 0 || !Ba(u, d))
        return [{ endpointID: St, value: bt(t) }];
      u.amount !== d.amount && i.push({
        endpointID: La,
        value: {
          pathKind: $a[o],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return i;
}
function Ne(e) {
  return { _tag: "ok", value: e };
}
function Ue(e) {
  return { _tag: "err", error: e };
}
function qa(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function Wa(e) {
  throw new Error(e ?? "Invariant violated");
}
const Ga = "globalTune", Ya = "globalTuneSemitones", oe = -24, Pe = 24, Un = 0, lo = -48, uo = 48, zt = -48, fo = 6, cn = 0, zn = (cn - zt) / (fo - zt), Ja = "voiceEnhancerFrequency", Qa = "voiceEnhancerQ", Xa = "voiceEnhancerAmount", Za = "voiceEnhancerFrequencyOctaves", es = "voiceEnhancerQ", ts = "voiceEnhancerAmount", mo = "voice.enhancerFrequency", ns = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Ja,
    targetKind: Za,
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
    endpointID: Qa,
    targetKind: es,
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
    endpointID: Xa,
    targetKind: ts,
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
function Vn(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function rs(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
function He(e, t, n, r, i = "percent", o = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const os = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      He("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      He("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      He("mix", "Mix", 100, 100),
      He("drive", "Drive", 15, 0)
    ]
  }
], jn = 1e-6;
function Y(e, t) {
  if (!Number.isFinite(e) || e < -jn || e > 1 + jn)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function rt(e, t) {
  return Y(e / 100, `${t} catalog percentage`);
}
function Ve(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function is(e) {
  return 20 * 1e3 ** e;
}
function as(e) {
  return Y(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ss(e) {
  return 0.1 * 200 ** e;
}
function cs(e) {
  return Y(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ls(e) {
  return e;
}
function ds(e) {
  return Y(e, "filterMix endpoint conversion");
}
function Oe(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function us(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: Oe("filterCutoff", is, as),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Oe("filterQ", ss, cs),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Oe("filterMix", ls, ds),
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
function ho(e) {
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
      return qa(e);
  }
}
function fs(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ms(e, t) {
  const n = Ve(e.moduleId, t.id), r = ho(t.format), i = us(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: rt(t.defaultPercent, n),
    initialValue: rt(t.initialPercent, n),
    format: r,
    modAmount: fs(r),
    binding: i.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const hs = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: zn * 100, defaultPercent: zn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function ps(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function gs(e, t) {
  const n = `osc${e}`, r = Ve(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: rt(t.defaultPercent, r),
    initialValue: rt(t.initialPercent, r),
    format: ho(t.format),
    modAmount: ps(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const ys = Object.freeze(
  P.flatMap((e) => hs.map((t) => gs(e, t)))
), vs = Object.freeze({
  targetId: Ve("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: Y(
    (Un - oe) / (Pe - oe),
    "Global Tune default"
  ),
  initialValue: Y(
    (Un - oe) / (Pe - oe),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Pe },
  modAmount: {
    min: lo,
    max: uo,
    unit: "st",
    digits: 2
  },
  binding: Oe(
    Ga,
    (e) => oe + (Pe - oe) * e,
    (e) => Y(
      (e - oe) / (Pe - oe),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Ya
});
function Is(e) {
  const t = Ve("voice-enhancer", e.key), n = Y(
    Vn(e, e.initial),
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
    binding: Oe(
      e.endpointID,
      (r) => rs(e, r),
      (r) => Y(
        Vn(e, r),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Ss = Object.freeze(
  Object.values(ns).map(Is)
), bs = Object.freeze([
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
function Ts(e) {
  const t = Ve(e.moduleId, e.targetIdSuffix), n = e.max - e.min, r = (o) => e.min + n * o, i = (o) => Y(
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
    binding: Oe(e.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const As = Object.freeze(
  bs.map(Ts)
), Es = Object.freeze([
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
function Rs(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function Tt(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? ea(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return Y(n, `${e.endpointID} endpoint conversion`);
}
function xs(e, t) {
  return e.valueKind === "effect-output-trim-db" ? ta(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function Ms(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Os(e) {
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
function ks(e) {
  const t = Rs(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: Tt(e, e.initial),
    initialValue: Tt(e, e.initial),
    format: Ms(e),
    modAmount: Os(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => xs(e, n),
      fromEngine: (n) => Tt(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : nn(tn(e))
  });
}
const ln = Object.freeze(
  [
    ...mt.flatMap((e) => e.parameters.map(ks)),
    ...Es,
    vs,
    ...Ss,
    ...ys,
    ...As,
    ...os.flatMap(
      (e) => e.parameters.map(
        (t) => ms(e, t)
      )
    )
  ]
), _s = new Map(
  ln.map((e) => [e.targetId, e])
), po = ln.filter(
  (e) => e.modulationTargetKind !== null
), Vt = new Map(
  po.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (_s.size !== ln.length)
  throw new Error("Target descriptor IDs must be unique");
if (po.length !== ae.length || Vt.size !== ae.length || ae.some((e) => Vt.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function At(e) {
  const t = Vt.get(e);
  return t === void 0 ? Wa(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  mt.map((e) => [e.id, e.label])
);
function ws(e) {
  const t = Zr(e);
  return t === 1 ? "" : ` ${t}`;
}
function Ds(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const r = At(e);
    return `${t[1]} ${r.label.toUpperCase()}`;
  }
  const n = Se(e);
  if (n !== null) {
    const r = At(an(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${ws(n)} ${r.label.toUpperCase()}`;
  }
  return At(e).label.toUpperCase();
}
const Fe = "modulation.v6", go = 6, je = 3, Re = 3, Ls = 4, $n = "modulationMsegBuffer", Ns = "modulationMsegPlayback", yo = 4, Cs = ["MSEG 1", "MSEG 2", "MSEG 3"], vo = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Ps = ["Env 1", "Env 2", "Env 3"], Fs = 1e-3, F = 10, Ks = 0.1, Us = 20, Bn = 10 - 0.1, zs = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Us - Ks },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: lo,
    max: uo
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
  mseg1Rate: { min: -fe, max: fe },
  mseg2Rate: { min: -fe, max: fe },
  mseg3Rate: { min: -fe, max: fe },
  env1Attack: { min: -F, max: F },
  env1Decay: { min: -F, max: F },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -F, max: F },
  env2Attack: { min: -F, max: F },
  env2Decay: { min: -F, max: F },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -F, max: F },
  env3Attack: { min: -F, max: F },
  env3Decay: { min: -F, max: F },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -F, max: F },
  ampAttack: { min: -F, max: F },
  ampDecay: { min: -F, max: F },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -F, max: F },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -Bn, max: Bn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Vs = Br().filter((e) => e.modulationTargetIndex !== null), js = new Map(
  Vs.map((e) => [
    nn(tn(e)),
    e
  ])
);
class Et extends Error {
  name = "ModulationStateParseError";
}
const $s = {
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
Ie.map((e) => ({
  value: e.id,
  label: $s[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Bs = ae.map((e) => ({
  value: e.kind,
  label: Ds(e.kind)
}));
Bs.filter((e) => !qs(e.value));
function Hs(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function dn(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Rt(e, t) {
  const n = Number(e);
  return dn(Number.isFinite(n) ? n : t, Fs, F);
}
function qs(e) {
  return on(e) !== null;
}
function Ws(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function Gs(e) {
  const t = Se(e);
  return t !== null ? an(t) : e;
}
function Ys(e) {
  const t = Gs(e);
  if (Se(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = js.get(t);
  return n !== void 0 ? Ws(n) : zs[ga(t)];
}
function Js(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function Qs(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function Xs(e, t) {
  const n = Ys(e), r = Number(t);
  return dn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Zs(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function ec(e) {
  return Zs(e) ?? "mseg";
}
function tc(e) {
  const t = rn(e);
  return t !== null ? t : Se(e) !== null ? e : null;
}
function nc(e) {
  return tc(e) ?? "oscA.wavetablePosition";
}
function rc(e, t) {
  const n = vo[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function oc(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const r = e === "mseg" ? je : e === "macro" ? yo : Ls;
  return dn(Number.isFinite(n) ? n : 1, 1, r);
}
function xe(e) {
  return {
    name: Ps[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Io(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, r = xe(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: Rt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: Rt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: ge(n.sustain ?? r.sustain),
    releaseSeconds: Rt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function ic(e, t = 0) {
  return { name: Io(e, t).name };
}
function ac(e, t, n, r) {
  const i = Number(e.amount);
  return {
    id: Js(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: oc(n, e.sourceSlot),
    polarity: Qs(e.polarity),
    targetKind: r,
    amount: Xs(r, i),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function sc(e, t = 0) {
  const r = e !== null && typeof e == "object" ? e : {}, i = ec(r.sourceKind), o = nc(r.targetKind);
  return ac(r, t, i, o);
}
function cc(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function lc(e) {
  return (Array.isArray(e) ? e : []).map((n, r) => sc(n, r));
}
function dc(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = cc(r);
    if (t.has(r.id) || n.has(i))
      return !1;
    t.add(r.id), n.add(i);
  }
  return !0;
}
function jt(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((a, c) => jt(a, t[c]));
  const n = e, r = t, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Hs(r, a) && jt(n[a], r[a]));
}
function So(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = no(Cs[t] ?? `MSEG ${t + 1}`), i = ze(n.shapeA ?? r), o = xa({
    ...Ut(),
    ...n.playback ?? {},
    rate: Ut().rate
  }), { rate: a, ...c } = o;
  return {
    shapeA: i,
    shapeB: ze(n.shapeB ?? i),
    playback: c
  };
}
function $t() {
  return {
    format: "cosimo.modulation",
    version: go,
    msegSlots: Array.from({ length: je }, (e, t) => So({}, t)),
    envelopeSlots: Array.from({ length: Re }, (e, t) => ({
      name: xe(t).name
    })),
    routes: [],
    macroNames: vo.slice()
  };
}
function uc(e = $t()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], r = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], i = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: go,
    msegSlots: Array.from({ length: je }, (o, a) => So(n[a], a)),
    envelopeSlots: Array.from({ length: Re }, (o, a) => ic(r[a], a)),
    routes: lc(t.routes),
    macroNames: Array.from(
      { length: yo },
      (o, a) => rc(i[a], a)
    )
  };
}
function Hn(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return Ue(new Et("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return Ue(new Et("Expected valid modulation JSON"));
    }
  }
  const n = uc(t);
  return !jt(t, n) || !dc(n.routes) ? Ue(new Et("Expected the current modulation schema")) : Ne(n);
}
function fc(e, t) {
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
function qn(e, t, n) {
  return {
    slot: e + 1,
    shapeIndex: t,
    buffer: Array.from(Da(n))
  };
}
function mc(e, t) {
  return e.holdFinalValue === t.holdFinalValue && e.noteOffPolicy === t.noteOffPolicy && e.legatoRestarts === t.legatoRestarts && JSON.stringify(e.loop) === JSON.stringify(t.loop);
}
function hc(e, t = null) {
  const n = [];
  for (let r = 0; r < je; r += 1) {
    const i = e.msegSlots[r], o = t?.msegSlots[r];
    (o === void 0 || !Fn(o.shapeA, i.shapeA)) && n.push({
      endpointID: $n,
      value: qn(r, 0, i.shapeA)
    }), (o === void 0 || !Fn(o.shapeB, i.shapeB)) && n.push({
      endpointID: $n,
      value: qn(r, 1, i.shapeB)
    }), (o === void 0 || !mc(o.playback, i.playback)) && n.push({
      endpointID: Ns,
      value: fc(r, i.playback)
    });
  }
  return n.push(...Ha(t?.routes ?? null, e.routes)), n;
}
const xt = "articulationSnapshot", U = 128, Wn = 48, pc = 1e6, j = -1, Mt = [
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
function un(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Ot(e) {
  return un(Number.isFinite(e) ? e : 0, 0, 1);
}
function B(e, t, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(e);
  return un(Number.isFinite(i) ? i : t, n, r);
}
function V(e, t, n, r) {
  return un(Math.round(B(e, t)), n, r);
}
function bo(e) {
  return e === "key" || e === "vel" || e === "chain" ? e : "chain";
}
function kt() {
  return Array.from({ length: U }, () => j);
}
function gc(e) {
  const t = V(e, 0, 0, U - 1), n = Mt[t % Mt.length], r = Math.floor(t / Mt.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function yc() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: cn,
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
function vc(e) {
  const t = yc(), n = e && typeof e == "object" ? e : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: B(n.wavetablePosition, t.wavetablePosition, 0, 1),
    pan: B(n.pan, t.pan, -1, 1),
    octave: V(n.octave, t.octave, -4, 4),
    semitone: V(n.semitone, t.semitone, -12, 12),
    fineCents: B(n.fineCents, t.fineCents, -100, 100),
    volumeDb: B(
      n.volumeDb,
      t.volumeDb,
      zt,
      fo
    ),
    mute: V(n.mute, t.mute, 0, 1),
    solo: V(n.solo, t.solo, 0, 1),
    warpMode: V(n.warpMode, t.warpMode, 0, 4),
    warpAmount: B(n.warpAmount, t.warpAmount, 0, 1),
    filterMode: V(n.filterMode, t.filterMode, 0, 5),
    filterCutoff: B(n.filterCutoff, t.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: B(
      n.filterKeyTrackOffsetSemitones,
      t.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: B(n.filterQ, t.filterQ, 0.1, 20),
    unisonVoices: V(n.unisonVoices, t.unisonVoices, 1, 8),
    unisonDetune: B(n.unisonDetune, t.unisonDetune, 0, 1),
    unisonBlend: B(n.unisonBlend, t.unisonBlend, 0, 1),
    unisonWidth: B(n.unisonWidth, t.unisonWidth, 0, 1),
    unisonPhase: B(n.unisonPhase, t.unisonPhase, 0, 1),
    unisonRandom: B(n.unisonRandom, t.unisonRandom, 0, 1),
    unisonPhaseMode: V(n.unisonPhaseMode, t.unisonPhaseMode, 0, 1),
    unisonDetuneMode: V(n.unisonDetuneMode, t.unisonDetuneMode, 0, 4),
    unisonStackMode: V(n.unisonStackMode, t.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: B(
      n.unisonWavetablePositionSpread,
      t.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: B(n.unisonWarpSpread, t.unisonWarpSpread, 0, 1),
    msegMorphs: [
      Ot(Number(r[0])),
      Ot(Number(r[1])),
      Ot(Number(r[2]))
    ]
  };
}
function Ic(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = typeof t.routeId == "string" ? t.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: B(t.amount, 0, -48, 48)
  } : null;
}
function Sc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.modRouteAmounts) ? t.modRouteAmounts.map(Ic).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: vc(t.parameters),
    envelopes: [0, 1, 2].map((i) => Io(
      Array.isArray(t.envelopes) ? t.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function bc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = V(n.runtimeSlot, t, 0, U - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : gc(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Sc(n.snapshot)
  };
}
function Tc(e, t) {
  if (!e || typeof e != "object")
    return null;
  const n = e, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return t.has(r) ? {
    note: V(n.note, 0, 0, U - 1),
    articulationId: r
  } : null;
}
function Ac(e, t, n, r, i) {
  if (!e || typeof e != "object")
    return null;
  const o = e, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!t.has(a))
    return null;
  let c = V(o.min, i, i, U - 1), s = V(o.max, c, i, U - 1);
  return s < c && ([c, s] = [s, c]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: c,
    max: s
  };
}
function Gn(e, t, n, r) {
  const i = Array.isArray(e) ? e : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < i.length; c += 1) {
    const s = Ac(
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
function Ec(e, t) {
  const n = Array.isArray(e) ? e : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Tc(o, t);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function Rc(e) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.slots) ? t.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let s = 0; s < n.length && o.length < U; s += 1) {
    const u = bc(n[s], s);
    !u || r.has(u.runtimeSlot) || i.has(u.id) || (r.add(u.runtimeSlot), i.add(u.id), o.push(u));
  }
  const a = typeof t.selectedSlotId == "string" && o.some((s) => s.id === t.selectedSlotId) ? t.selectedSlotId : null, c = new Set(o.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: bo(t.activeTriggerMode),
    slots: o,
    chainAssignments: Gn(t.chainAssignments, c, "chain", 0),
    keyAssignments: Ec(t.keyAssignments, c),
    velocityAssignments: Gn(t.velocityAssignments, c, "velocity", 1)
  };
}
function Yn(e) {
  const t = (n) => P.map(() => n);
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
    volumeDbs: t(cn),
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
    msegMorphs: Array.from({ length: je }, () => 0),
    routeAmounts: Array.from({ length: io }, () => 0),
    envelopeAttackSeconds: Array.from({ length: Re }, (n, r) => xe(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: Re }, (n, r) => xe(r).decaySeconds),
    envelopeSustain: Array.from({ length: Re }, (n, r) => xe(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: Re }, (n, r) => xe(r).releaseSeconds)
  };
}
function Jn(e, t, n) {
  for (const r of t) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        e[o] === j && (e[o] = i);
  }
}
function xc(e) {
  const t = Rc(e), n = new Map(t.slots.map((a) => [a.id, a.runtimeSlot])), r = kt(), i = kt(), o = kt();
  Jn(r, t.chainAssignments, n), Jn(o, t.velocityAssignments, n);
  for (const a of t.keyAssignments) {
    const c = n.get(a.articulationId);
    c === void 0 || i[a.note] !== j || (i[a.note] = c);
  }
  return o[0] = j, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Mc(e) {
  const t = e && typeof e == "object" && e.format === "cosimo.articulation.triggerConfig" ? e : xc(e);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: bo(t.activeMode),
    chain: Array.from({ length: U }, (n, r) => V(t.chain?.[r], j, j, U - 1)),
    key: Array.from({ length: U }, (n, r) => V(t.key?.[r], j, j, U - 1)),
    velocity: Array.from({ length: U }, (n, r) => r === 0 ? j : V(t.velocity?.[r], j, j, U - 1))
  });
}
function Oc(e, t) {
  const n = Mc(e);
  t?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const Ke = "articulations.v4", fn = [
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
], mn = [
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
], kc = [
  ...P.flatMap((e) => fn.map(
    (t) => `osc${e}.${t}`
  )),
  ...mn
];
class To extends Error {
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
function w(e) {
  return Ue(new To("malformed", e));
}
function $e(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function hn(e, t, n) {
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
function ot(e) {
  return typeof e == "number" && Number.isInteger(e) && e >= 0 && e < U;
}
function _c(e) {
  return e === "chain" || e === "key" || e === "vel";
}
function wc(e) {
  return kc.some((t) => t === e);
}
function Qn(e, t) {
  if (!$e(e))
    return w(`${t} must be an object`);
  const n = hn(e, ["min", "max"], t);
  return n !== null ? w(n) : ot(e.min) ? ot(e.max) ? e.min > e.max ? w(`${t}.min must be less than or equal to ${t}.max`) : Ne({ min: e.min, max: e.max }) : w(`${t}.max must be an integer in 0..127`) : w(`${t}.min must be an integer in 0..127`);
}
function Dc(e, t) {
  if (!$e(e))
    return w(`${t} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(e)) {
    if (typeof r != "string")
      return w(`${t} has a non-string parameter id`);
    if (!wc(r))
      return w(`${t} has unknown parameter id "${r}"`);
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return w(`${t}.${r} must be a finite number`);
    n[r] = i;
  }
  return Ne(n);
}
function Lc(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Nc() {
  return {};
}
function Cc(e, t, n) {
  if (!$e(e))
    return w(`${t} must be an object`);
  const r = Nc();
  for (const i of Reflect.ownKeys(e)) {
    if (typeof i != "string")
      return w(`${t} has a non-string route id`);
    const o = e[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Wn)
      return w(
        `${t}.${i} must be a finite route amount within ±${Wn}`
      );
    if (!n.has(i))
      return w(`${t}.${i} does not name a current articulable mapping`);
    Lc(r, i, o);
  }
  return Ne(r);
}
function Pc(e, t, n) {
  const r = `slots[${t}]`;
  if (!$e(e))
    return w(`${r} must be an object`);
  const i = hn(
    e,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return w(i);
  if (typeof e.id != "string")
    return w(`${r}.id must be a string`);
  if (!ot(e.runtimeSlot))
    return w(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof e.name != "string")
    return w(`${r}.name must be a string`);
  if (typeof e.color != "string")
    return w(`${r}.color must be a string`);
  if (!ot(e.key))
    return w(`${r}.key must be an integer in 0..127`);
  const o = Qn(e.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Qn(e.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const c = Dc(e.overrides, `${r}.overrides`);
  if (c._tag === "err")
    return c;
  const s = Cc(
    e.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : Ne({
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
const Fc = Object.fromEntries(
  fn.map((e, t) => [e, 2 ** t])
), Kc = Object.fromEntries(
  mn.map((e, t) => [e, 2 ** t])
);
function Xn(e, t) {
  return Object.hasOwn(e.overrides, t) ? e.overrides[t] ?? 0 : 0;
}
function Uc(e, t) {
  return fn.reduce((n, r) => Object.hasOwn(e.overrides, `osc${t}.${r}`) ? n | Fc[r] : n, 0);
}
function zc(e) {
  return mn.reduce((t, n) => Object.hasOwn(e.overrides, n) ? t | Kc[n] : t, 0);
}
function Vc(e, t) {
  const n = (o, a) => Xn(e, `osc${o}.${a}`), r = (o) => Xn(e, o), i = Array.from(
    { length: io },
    () => pc
  );
  for (const [o, a] of Object.entries(e.routeAmounts)) {
    const c = t[o];
    c !== void 0 && (i[c] = a);
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: P.map((o) => Uc(e, o)),
    sharedOverrideMask: zc(e),
    framePositions: P.map((o) => n(o, "framePosition")),
    pans: P.map((o) => n(o, "pan")),
    octaves: P.map((o) => n(o, "octave")),
    semitones: P.map((o) => n(o, "semitone")),
    fineCents: P.map((o) => n(o, "fineCents")),
    phases: P.map((o) => n(o, "phase")),
    phaseRandoms: P.map((o) => n(o, "phaseRandom")),
    retriggers: P.map((o) => n(o, "retrigger")),
    volumeDbs: P.map((o) => n(o, "volumeDb")),
    mutes: P.map((o) => n(o, "mute")),
    solos: P.map((o) => n(o, "solo")),
    warpModes: P.map((o) => n(o, "warpMode")),
    warpAmounts: P.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: P.map((o) => n(o, "unisonVoices")),
    unisonDetunes: P.map((o) => n(o, "unisonDetune")),
    unisonBlends: P.map((o) => n(o, "unisonBlend")),
    unisonWidths: P.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: P.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: P.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: P.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: P.map((o) => n(o, "unisonWarpSpread")),
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
function jc(e, t) {
  return e.slots.map((n) => Vc(n, t));
}
function $c(e, t) {
  if (!$e(e))
    return w("payload must be an object");
  if (e.format !== "cosimo.articulations")
    return w('format must be exactly "cosimo.articulations"');
  if (e.version !== 4)
    return Ue(new To(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = hn(
    e,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return w(n);
  if (e.selectedSlotId !== null && typeof e.selectedSlotId != "string")
    return w("selectedSlotId must be null or a string");
  if (!_c(e.activeTriggerMode))
    return w('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(e.slots))
    return w("slots must be an array");
  if (e.slots.length > U)
    return w(`slots must contain at most ${U} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < e.slots.length; a += 1) {
    const c = Pc(e.slots[a], a, t);
    if (c._tag === "err")
      return c;
    const s = c.value;
    if (i.has(s.id))
      return w(`slots[${a}].id duplicates "${s.id}"`);
    if (o.has(s.runtimeSlot))
      return w(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    i.add(s.id), o.add(s.runtimeSlot), r.push(s);
  }
  return e.selectedSlotId !== null && !i.has(e.selectedSlotId) ? w(`selectedSlotId "${e.selectedSlotId}" does not identify an existing slot`) : Ne({
    format: e.format,
    version: e.version,
    selectedSlotId: e.selectedSlotId,
    activeTriggerMode: e.activeTriggerMode,
    slots: r
  });
}
function Ao() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Bc(e) {
  const t = Array.from({ length: U }, () => j), n = Array.from({ length: U }, () => j), r = Array.from({ length: U }, () => j);
  for (const i of e.slots) {
    n[i.key] === j && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      t[o] === j && (t[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === j && (r[o] = i.runtimeSlot);
  }
  return r[0] = j, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: t,
    key: n,
    velocity: r
  };
}
const Bt = "runtimeState";
function Eo(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const Hc = {
  endpointID: Bt,
  required: !0,
  mapValue: Eo
}, Zn = "runtimeInstallAck", qc = "runtimeSyncRequest", er = 0, Wc = 8e3, it = /* @__PURE__ */ new WeakMap(), Ro = 1e9;
let qe = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Ro;
function Gc(e) {
  return qe = qe % Ro + 1, e === "modulation" ? -1e9 - qe : 1e9 + qe;
}
function Yc(e, t) {
  const n = e, r = it.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(t))
    throw new Error(`A ${t} runtime install lane is already active for this connection.`);
  r.add(t), it.set(n, r);
}
function tr(e, t) {
  const n = e, r = it.get(n);
  r?.delete(t), r?.size === 0 && it.delete(n);
}
const Jc = [100, 250, 500, 1e3], We = { _tag: "accepted" }, Qc = { _tag: "superseded" }, Xc = { _tag: "stopped" }, nr = { _tag: "transport-timeout" };
function Zc(e) {
  const t = e && typeof e == "object" && "event" in e ? e.event : e, n = t && typeof t == "object" && "value" in t ? t.value : t;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, c = r.rejectedSerial, s = r.rejectionReason, u = r.syncSerial;
  return ![
    i,
    o,
    a,
    c,
    s,
    u
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof c != "number" || typeof s != "number" || typeof u != "number" || i < 0 || o < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: c,
    rejectionReason: s,
    syncSerial: u
  };
}
function el(e, t, n) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...e,
    dspSessionId: t,
    deliverySerial: n
  };
}
class rr {
  #i;
  #e;
  #u;
  #S;
  #f = !1;
  #t = null;
  #s = null;
  #c = /* @__PURE__ */ new Set();
  #n = null;
  #l = 0;
  #o = /* @__PURE__ */ new Map();
  #d = 0;
  #r = !1;
  #a = 0;
  #m = /* @__PURE__ */ new Set();
  #b = this.#O.bind(this);
  constructor(t, n) {
    this.#i = t, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#u = r && r.length > 0 ? r : [...Jc], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Wc)
    );
  }
  start() {
    if (!this.#r) {
      Yc(this.#i, this.#e);
      try {
        this.#d += 1, this.#r = !0, this.#s = null, this.#c.clear(), this.#i.addEndpointListener?.(Zn, this.#b);
      } catch (t) {
        throw this.#r = !1, tr(this.#i, this.#e), t;
      }
    }
  }
  stop() {
    this.#r && (this.#r = !1, this.#i.removeEndpointListener?.(Zn, this.#b), tr(this.#i, this.#e), this.#o.clear(), this.#s = null, this.#c.clear(), this.#I());
  }
  observeRuntime(t) {
    const n = Math.trunc(Number(t) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#c.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#o.clear(), this.#a += 1, this.#I());
  }
  getAcceptedFrontier() {
    return this.#n?.dspSessionId !== this.#t ? 0 : this.#e === "modulation" ? this.#n.acceptedModulationSerial : this.#n.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#n ? { ...this.#n } : null;
  }
  hasSessionBaseline() {
    return this.#t !== null && this.#s === this.#t;
  }
  async waitForSessionBaseline() {
    const t = this.#t, n = this.#d;
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
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#f = !0;
    const n = this.#t, r = this.#d;
    try {
      const i = await this.#T(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of t) {
        const c = await this.#M(
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
      return o ?? We;
    } finally {
      this.#f = !1;
    }
  }
  #E(t) {
    return this.#e === "modulation" ? t.acceptedModulationSerial : t.acceptedArticulationSerial;
  }
  #R(t, n) {
    const r = this.#E(t);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const t = this.getAcceptedFrontier();
    return this.#e === "modulation" ? t + 1 : t - 1;
  }
  async #T(t, n) {
    if (this.#s === t)
      return We;
    const r = Gc(this.#e);
    this.#c.add(r);
    const i = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(t, n);
        if (a)
          return a;
        if (this.#s === t)
          return We;
        const c = i - Date.now();
        if (c <= 0)
          return nr;
        const s = this.#a;
        this.#y(r), await this.#v(
          s,
          Math.min(this.#g(o), c)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #M(t, n, r) {
    const i = this.#x(), o = el(t.value, n, i);
    let a = 0, c = 0, s = this.#l;
    for (this.#A(t.endpointID, o); ; ) {
      const u = this.#p(n, r);
      if (u)
        return u;
      const d = this.#h(n, i, s);
      if (d !== null)
        return d;
      const m = this.#a;
      await this.#v(
        m,
        this.#g(a)
      );
      const g = this.#h(
        n,
        i,
        s
      );
      if (g !== null)
        return g;
      let y = this.#a;
      for (this.#y(i); ; ) {
        const b = this.#p(n, r);
        if (b)
          return b;
        const A = await this.#v(
          y,
          this.#g(a)
        ), I = this.#h(
          n,
          i,
          s
        );
        if (I !== null)
          return I;
        if (A && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
          if (c >= 1)
            return nr;
          s = this.#l, this.#A(t.endpointID, o), c += 1, a += 1;
          break;
        }
        if (A) {
          y = this.#a;
          continue;
        }
        A || (a += 1, y = this.#a, this.#y(i));
      }
    }
  }
  #h(t, n, r) {
    const i = this.#n;
    if (!i || i.dspSessionId !== t)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === t ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(i, n) ? (this.#o.delete(n), We) : null;
  }
  #p(t, n) {
    return !this.#r || this.#d !== n ? Xc : this.#t !== t ? Qc : null;
  }
  #g(t) {
    return this.#u[Math.min(
      t,
      this.#u.length - 1
    )];
  }
  #A(t, n) {
    try {
      this.#i.sendEventOrValue?.(
        t,
        n,
        void 0,
        er
      );
    } catch {
    }
  }
  #y(t) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          qc,
          t,
          void 0,
          er
        );
      } catch {
      }
  }
  #O(t) {
    const n = Zc(t);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#c.has(n.syncSerial) && (this.#s = n.dspSessionId), this.#n = n, this.#l += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#l
      }); this.#o.size > 16; ) {
        const i = this.#o.keys().next().value;
        if (i === void 0) break;
        this.#o.delete(i);
      }
    this.#a += 1, this.#I();
  }
  #v(t, n) {
    return !this.#r || this.#a !== t ? Promise.resolve(!0) : new Promise((r) => {
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
const tl = 1e3, _t = [Fe, Ke];
function or(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function wt(e, t) {
  const n = e && typeof e == "object" ? e : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (or(r, t)) return r[t];
  if (or(n, t)) return n[t];
}
function Dt(e, t) {
  if (e === void 0) return Ao();
  let n = e;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = $c(n, t);
  return r._tag === "ok" ? r.value : null;
}
function ir(e) {
  return new Set(e.routes.flatMap((t) => so(t) === null ? [] : [t.id]));
}
function ar(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class nl {
  constructor(t) {
    this.connection = t, this.modulationLane = new rr(t, { laneKind: "modulation" }), this.articulationLane = new rr(t, { laneKind: "articulation" });
  }
  connection;
  modulationState = $t();
  articulationBank = Ao();
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
    { length: U },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Bt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Bt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of _t) this.connection.requestStoredStateValue(n);
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
    const n = wt(t, Fe), r = n === void 0 ? { _tag: "ok", value: $t() } : Hn(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${Fe} is invalid; boot state was not installed.`);
      const a = wt(t, Ke), c = Dt(a, /* @__PURE__ */ new Set());
      c !== null && (this.articulationBank = c, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = wt(t, Ke), o = Dt(
      i,
      ir(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${Ke} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(t) {
    if (!this.started || !t || typeof t != "object") return;
    const n = t;
    if (!(typeof n.key != "string" || !_t.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === _t.length) {
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
    if (t === Fe) {
      const i = Hn(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${Fe}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Dt(n, ir(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${Ke}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(t) {
    if (!this.started) return;
    const n = Eo(t);
    if (this.modulationLane.observeRuntime(n), this.articulationLane.observeRuntime(n), !this.hasRuntimeState) {
      this.hasRuntimeState = !0, this.dspSessionId = n, this.applyRuntimeStateIfReady();
      return;
    }
    n !== this.dspSessionId && (this.dspSessionId = n, this.runtimeGeneration += 1, this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!(!this.started || this.bootPending || !this.hasModulationState || !this.hasArticulationState || !this.hasRuntimeState)) {
      if (this.deliveryInProgress) {
        this.deliveryRefreshPending = !0;
        return;
      }
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.deliverRuntimeState().catch((t) => {
        console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", t), this.scheduleRecovery(), this.finishDelivery();
      });
    }
  }
  async deliverRuntimeState() {
    const t = this.runtimeGeneration, n = this.modulationState, r = this.articulationBank, i = this.lastAppliedModulationGeneration !== t, o = hc(
      n,
      i ? null : this.lastAppliedModulationState
    ), a = await this.modulationLane.sendBatch(o);
    if (!this.acceptOutcome("modulation", a, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = t, this.desiredStateChanged(t, n, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const c = this.buildUploadsBySelector(n, r), s = Array.from({ length: U }, (y, b) => {
      const A = c.get(b);
      return A ? ar(A) : null;
    }), u = this.lastAppliedArticulationGeneration !== t, d = u && this.articulationLane.getAcceptedFrontier() !== 0, m = [];
    for (let y = 0; y < U; y += 1) {
      const b = c.get(y), A = s[y] !== this.lastAppliedArticulationTokens[y];
      d ? m.push({
        endpointID: xt,
        value: b ?? Yn(y)
      }) : u ? b && m.push({ endpointID: xt, value: b }) : A && m.push({
        endpointID: xt,
        value: b ?? Yn(y)
      });
    }
    const g = await this.articulationLane.sendBatch(m);
    this.acceptOutcome("articulation", g, s) && (this.lastAppliedArticulationGeneration = t, this.lastAppliedArticulationTokens = s, Oc(
      Bc(r),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(t, n, r) {
    return t !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(t, n) {
    const r = Object.fromEntries(t.routes.flatMap((i) => {
      const o = so(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      jc(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(t, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = ar(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(t) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(t, i), console.error(`[runtime-state-worker] ${t} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, tl));
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
function rl(e) {
  return new nl(e);
}
const xo = 13, pn = 5, Mo = 8, ol = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), gn = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    W("globalFilter")
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
    W("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    W("ott")
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
    W("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    W("flanger")
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
    W("phaser")
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
    W("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    W("reverb")
  ]
}), Oo = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), il = Object.freeze([
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
]), al = Object.freeze({
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
function sl(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function ko(e, t) {
  const n = {};
  for (const c of gn[e]) {
    const s = t[c];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[c] = s;
      continue;
    }
    const u = al[c];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${c}`);
    n[c] = u;
  }
  const i = [
    ...Oo.chorus,
    W("chorus")
  ], o = Object.keys(t);
  return e === "chorus" && o.length === i.length && o.every((c) => i.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = sl(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function _o(e) {
  return gn[e];
}
function cl(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= pn)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * Mo + ol[e];
}
function ll(e, t) {
  const n = new Array(xo).fill(0), r = ko(e, t);
  return gn[e].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const dl = "lane.v1", ul = "laneTopology", sr = "laneSlotParams", fl = "laneOutputControl", Ht = 16, ml = 8, wo = 4, hl = 3, Do = pn * Mo, Lo = 4, pl = 4, gl = Do, yl = Do + Lo, vl = 0, Il = 1, Sl = 2, bl = 3, Tl = 4, Al = 5;
function El(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > wo)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << ml;
}
const at = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), st = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), No = new Map(
  Object.entries(st).map(([e, t]) => [t, e])
), Rl = Object.freeze({
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
  at.map((e) => [Rl[e], e])
);
const xl = Object.freeze([
  "voice.filterCutoff",
  mo,
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
]), Ml = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [mo]: "enhancer-frequency",
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
  xl.map((e) => [e, Object.freeze({
    id: e,
    family: Ml[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Co = 40, Po = 18e3, qt = at.map((e) => st[e]), Ol = /^([a-zA-Z]+)#([1-9][0-9]*)$/, kl = /^(parallel|split)#([1-9][0-9]*)$/;
function pt(e) {
  if (typeof e != "string")
    return null;
  const t = Ol.exec(e);
  if (t === null)
    return null;
  const n = qt.find((i) => i === t[1]);
  if (n === void 0)
    return null;
  const r = Number(t[2]);
  return r > pn ? null : { deviceType: n, instanceNumber: r };
}
function Fo(e) {
  if (typeof e != "string")
    return null;
  const t = kl.exec(e);
  if (t === null)
    return null;
  const n = t[1], r = Number(t[2]);
  return r > (n === "parallel" ? Lo : pl) ? null : { groupKind: n, unitNumber: r };
}
function pe(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function ke(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((r) => typeof r == "string" && t.includes(r));
}
function L(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function _l(e, t) {
  const n = pt(e);
  if (n === null)
    return { failure: L(`device id ${e} is not a pool instance`) };
  if (!pe(t) || !ke(t, ["params"]) || !pe(t.params))
    return { failure: L(`device ${e} must be { params }`) };
  const r = _o(n.deviceType), i = No.get(n.deviceType);
  if (i === void 0)
    return { failure: L(`device ${e} has no effect descriptor`) };
  const o = $r(i).parameters.map((y) => y.endpointID), a = t.params, c = Object.keys(a), s = (y) => c.length === y.length && c.every((b) => y.includes(b)), u = W(n.deviceType), d = [
    ...Oo[n.deviceType],
    u
  ], m = [
    ...il,
    u
  ];
  if (!(c.includes(u) && (s(r) || s(o) || s(d) || n.deviceType === "chorus" && s(m))))
    return { failure: L(`device ${e} must carry every parameter once`) };
  for (const y of c) {
    const b = a[y];
    if (typeof b != "number" || !Number.isFinite(b))
      return { failure: L(`device ${e}.${y} must be a finite number`) };
  }
  return { record: { params: ko(n.deviceType, a) } };
}
function wl(e, t) {
  return !pe(e) || e.kind !== "device" ? { failure: L("branches may hold device placements only") } : ke(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: L(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: L(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: L("a device placement is { kind, deviceId, enabled }") };
}
function cr(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= Co && e <= Po;
}
function Ko() {
  return { mix: 1, bypassed: !1 };
}
function Dl(e) {
  return !pe(e) || !ke(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function Ll(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (d) {
      const m = d instanceof Error ? d.message : String(d);
      return L(`is not valid JSON: ${m}`);
    }
  if (!pe(t) || !ke(t, ["format", "version", "output", "devices", "chain"]))
    return L("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return L("must be cosimo.lane version 2");
  if (!pe(t.devices))
    return L("devices must be an object");
  if (!Array.isArray(t.chain))
    return L("chain must be an array");
  const n = Dl(t.output);
  if (n === null)
    return L("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const d of Reflect.ownKeys(t.devices)) {
    if (typeof d != "string")
      return L("device ids must be strings");
    const m = _l(d, t.devices[d]);
    if ("failure" in m)
      return m.failure;
    r[d] = m.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), c = [];
  let s = 0;
  const u = (d) => {
    const m = wl(d, i);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), s += 1), m;
  };
  for (const d of t.chain) {
    if (!pe(d))
      return L("chain nodes must be objects");
    if (d.kind === "device") {
      const M = u(d);
      if ("failure" in M)
        return M.failure;
      c.push(M.placement);
      continue;
    }
    if (d.kind !== "parallel" && d.kind !== "split")
      return L(`unknown chain node kind ${String(d.kind)}`);
    const m = d.kind === "split", g = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], b = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], A = m && ke(d, g);
    if (!ke(d, b) && !A)
      return L(`a ${d.kind} group is { ${b.join(", ")} }`);
    const I = Fo(d.groupId);
    if (I === null || I.groupKind !== d.kind)
      return L(`group id ${String(d.groupId)} does not name a ${d.kind} unit`);
    if (a.has(String(d.groupId)))
      return L(`group ${String(d.groupId)} is used twice`);
    if (a.add(String(d.groupId)), typeof d.enabled != "boolean")
      return L(`group ${String(d.groupId)} needs a boolean enable`);
    const _ = m ? hl : wo;
    if (!Array.isArray(d.branches) || d.branches.length < 2 || d.branches.length > _)
      return L(`group ${String(d.groupId)} needs 2..${_} branches`);
    if (m && (!cr(d.xoverLowHz) || !cr(d.xoverHighHz)))
      return L(`group ${String(d.groupId)} crossovers must sit in ${Co}..${Po} Hz`);
    if (m && !A && (typeof d.xoverLowKeyTrackEnabled != "boolean" || typeof d.xoverHighKeyTrackEnabled != "boolean" || typeof d.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverLowKeyTrackOffsetSemitones) || typeof d.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(d.xoverHighKeyTrackOffsetSemitones)))
      return L(`group ${String(d.groupId)} Key Track state must be finite`);
    s += 1;
    const N = [];
    for (const M of d.branches) {
      if (!Array.isArray(M))
        return L(`group ${String(d.groupId)} branches must be arrays`);
      const E = [];
      for (const f of M) {
        const l = u(f);
        if ("failure" in l)
          return l.failure;
        E.push(l.placement);
      }
      N.push(E);
    }
    c.push(m ? {
      kind: "split",
      groupId: String(d.groupId),
      enabled: d.enabled,
      xoverLowHz: d.xoverLowHz,
      xoverHighHz: d.xoverHighHz,
      xoverLowKeyTrackEnabled: A ? !1 : d.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: A ? 0 : d.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: A ? !1 : d.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: A ? 0 : d.xoverHighKeyTrackOffsetSemitones,
      branches: N
    } : {
      kind: "parallel",
      groupId: String(d.groupId),
      enabled: d.enabled,
      branches: N
    });
  }
  for (const d of i)
    if ((o.get(d) ?? 0) !== 1)
      return L(`device ${d} must be placed exactly once`);
  return s > Ht ? L(`flattens to ${s} wire entries; the topology upload holds ${Ht}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: c } };
}
function Nl() {
  const e = {};
  for (const t of at) {
    const n = st[t];
    e[`${n}#1`] = {
      params: Vl(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Ko(),
    devices: e,
    chain: at.map((t) => ({
      kind: "device",
      deviceId: `${st[t]}#1`,
      enabled: !1
    }))
  };
}
const lr = ["distortion#1", "delay#1", "reverb#1"];
function Cl() {
  const e = Nl(), t = {};
  for (const n of lr) {
    const r = e.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Ko(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && lr.includes(n.deviceId))
  };
}
function Pl(e) {
  if (e === void 0)
    return Cl();
  const t = Ll(e);
  return t._tag === "ok" ? t.value : null;
}
function Fl(e) {
  return Object.keys(e.devices).map((t) => {
    const n = pt(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => qt.indexOf(t.parsed.deviceType) - qt.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Wt(e) {
  const t = pt(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return cl(t.deviceType, t.instanceNumber - 1);
}
function Uo(e) {
  const t = Fo(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? gl : yl) + (t.unitNumber - 1);
}
function Kl(e) {
  const t = new Array(Ht).fill(0);
  let n = 0, r = 0;
  const i = (o, a, c) => {
    t[r] = El(o, a), c && (n |= 1 << r), r += 1;
  };
  for (const o of e.chain) {
    if (o.kind === "device") {
      i(Wt(o.deviceId), 0, o.enabled);
      continue;
    }
    i(Uo(o), o.branches.length, o.enabled), o.branches.forEach((a, c) => {
      for (const s of a)
        i(Wt(s.deviceId), c + 1, s.enabled);
    });
  }
  return { chainLength: r, slotIds: t, enabledMask: n };
}
function Ul(e) {
  const t = new Array(xo).fill(0);
  return t[vl] = e.xoverLowHz, t[Il] = e.xoverHighHz, t[Sl] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[bl] = e.xoverLowKeyTrackOffsetSemitones, t[Tl] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[Al] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function zl(e) {
  const t = [{
    endpointID: fl,
    value: e.output
  }];
  let n = 0;
  for (const r of Fl(e)) {
    const i = pt(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    t.push({
      endpointID: Zi(
        i.deviceType,
        i.instanceNumber
      ),
      value: e.devices[r.instanceId].params[W(i.deviceType)]
    }), n += 1, t.push({
      endpointID: sr,
      value: {
        slotId: Wt(r.instanceId),
        deliverySerial: n,
        values: ll(
          r.deviceType,
          e.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of e.chain)
    r.kind === "split" && (n += 1, t.push({
      endpointID: sr,
      value: {
        slotId: Uo(r),
        deliverySerial: n,
        values: Ul(r)
      }
    }));
  return t.push({
    endpointID: ul,
    value: Kl(e)
  }), t;
}
function Vl(e) {
  const t = No.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = $r(t).parameters;
  return Object.fromEntries(_o(e).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
function jl(e) {
  return ki(e, {
    stateKey: dl,
    runtimeEndpointDependencies: [Hc],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Pl,
    buildRuntimeEvents: ({ state: t }) => [...zl(t)]
  });
}
const $l = "runtimeSyncRequest", Bl = 2147483647, Hl = "runtimeState", ql = "retryDesiredTableRequest", Wl = "workerLoadFailure", Gl = "serviceLoadAbort", Yl = "wavetableLoadBegin", Jl = "wavetableMipFrame", Ql = "wavetableUploadAck", Xl = "wavetableMipRequest", Zl = "wavetablePrewarmRequest", ed = "wavetablePrewarmNotification", td = "assets/factory-bank-catalog.json", Gt = 3, nd = 1, rd = Gt * Ye, od = 1, id = 2, ad = 3, sd = 1, cd = 2, ld = 2e4, Ge = od, dd = id, dr = ad, ue = sd, ur = cd, ud = 48 * 1024 * 1024, Lt = 3;
function fr(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function z(e, t, n = null) {
  const r = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${t}`, n);
      return;
    }
    r(`[wavetable-worker] ${t}`);
  }
}
function mr(e) {
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
function hr(e, t, n) {
  const r = e + t;
  return e === 0 || r === n || r % 16 === 0;
}
function pr(e, t) {
  if (!e)
    throw new Error(t);
}
function fd(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function md(e, t) {
  return Bi(await e.readJSON(t));
}
function hd(e) {
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
function pd(e, t) {
  const n = Math.round(Number(e) || 0);
  return fd(n, 0, Math.max(0, t - 1));
}
function Nt(e, t, n, r, i) {
  return `${e}:${t}:${n}:${r}:${i}`;
}
function gd(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function gr(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function yr(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function vr() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function yd(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class vd {
  connection;
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
    this.connection = t, this.resourceClient = ji(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? td, this.maxBatchesInFlight = fr(
      n.maxFramesInFlight,
      nd
    ), this.mipLevelCount = n.mipLevelCount ?? Fr, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ud) || 0)), this.serviceLoadTimeoutMs = fr(n.serviceLoadTimeoutMs, ld), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, z("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Hl, this.handleRuntimeState), this.connection.addEndpointListener?.(Ql, this.handleUploadAck), this.connection.addEndpointListener?.(Xl, this.handleMipRequest), this.connection.addEndpointListener?.(Zl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ed, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      $l,
      Bl
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await md(this.resourceClient, this.catalogPath), z("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Lt; n += 1)
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
    this.tableCacheBytes -= t.byteCount, t.byteCount = gr(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
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
      byteCount: gr(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Nt(
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
          ...yr(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (z("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: dr,
          failureReasonCode: ur
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
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== dr || t.failureReasonCode !== ur ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Ge,
    failureReasonCode: c = ue
  }) {
    this.connection.sendEventOrValue?.(Wl, {
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
    failureReasonCode: o = ue
  }) {
    this.connection.sendEventOrValue?.(Gl, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(t) {
    z("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? mr(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(ql, t);
  }
  async loadTableSource(t, n) {
    const r = await this.ensureCatalogLoaded(), i = pd(t, r.tables.length), o = r.tables[i];
    pr(o, `Could not resolve table ${i}`);
    const a = gd(o, Ye, this.mipLevelCount), c = this.tableCache.get(a);
    if (c)
      return c.lastUsedSerial = this.cacheUseSerial++, z("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: c.frameCount,
        cacheBytes: this.tableCacheBytes
      }), c;
    const s = vr();
    z("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), d = Yi(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Ye
    });
    return z("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(vr() - s)
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
    z("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[t.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Yl, {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: n,
      tableIndex: t.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(t) {
    z("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: Ge,
      failureReasonCode: ue
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: Ge,
      failureReasonCode: ue
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = Ge,
    failureReasonCode: r = ue
  } = {}) {
    z("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (z("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: Qe(o)
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
    }, this.clearMipTransferState(), t.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads());
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
      this.isCurrentRuntimeState(t) && (z("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: Qe(a)
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
    for (let t = 0; t < Lt; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, yd(() => {
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
        z("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: ue
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
    const n = hd(t ?? {});
    if (z("info", "Received runtime state", mr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Lt)
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
          i.spectra[a] || (i.spectra[a] = Nn(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), z("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        z("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Qe(i)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), r = Math.trunc(Number(t?.oscillatorIndex)), i = Math.trunc(Number(t?.generation)), o = Math.trunc(Number(t?.tableIndex)), a = Math.trunc(Number(t?.mipIndex)), c = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Nt(
      n,
      r,
      i,
      o,
      a
    );
    let u = this.mipJobs.get(s);
    return u ? (!u.completed && c > u.urgencyLevel && (u.urgencyLevel = c), u) : (u = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: c,
      ...yr(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, u), u);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (z("info", "Received wavetable mip request", {
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
    const n = t ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), c = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), d = Nt(
      r,
      i,
      o,
      a,
      c
    ), m = this.mipJobs.get(d), g = this.serviceTable?.frameCount ?? 0, y = Math.min(
      Gt,
      g - s
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(s) || u <= 0 || u !== y)) {
      m.inFlightBatchBases.delete(s);
      for (let b = 0; b < u; b += 1) {
        const A = s + b;
        m.ackedFrames[A] || (m.ackedFrames[A] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === g && m.nextFrameIndex >= g && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), hr(s, u, g) && z("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: c,
        frameIndexBase: s,
        batchFrameCount: u,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: g,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (pr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = Nn(this.serviceTable.frames[t]);
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
    if (!this.serviceTable)
      return;
    let t = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!t || t.completed) && (t = this.selectNextMipJob(), this.activeUploadKey = t?.key ?? null), !t) {
      this.completeServiceTransferIfReady();
      return;
    }
    for (; t.inFlightBatchBases.size < this.maxBatchesInFlight && t.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = t.nextFrameIndex, r = Math.min(
        Gt,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(rd);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, c = this.getSpectrumForFrame(a), s = Ji(c, t.mipIndex);
          i.set(s, o * Ye);
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
            failurePhase: dd,
            failureReasonCode: ue
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Jl, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), hr(n, r, this.serviceTable.frameCount) && z("info", "Sent wavetable mip batch", {
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
function Qe(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function Id(e, t = {}) {
  return new vd(e, t);
}
async function Sd(e, t = {}) {
  return Di(e, [
    rl,
    jl,
    () => Id(e, t),
    () => Ei($i, e, {
      onDefect: (n) => console.error("Cosimo Voice state failed", Qe(n))
    })
  ]);
}
export {
  nd as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  id as FAILURE_PHASE_BUILD_MIP,
  od as FAILURE_PHASE_LOAD_SOURCE,
  ad as FAILURE_PHASE_TRANSFER_MIP,
  sd as FAILURE_REASON_GENERIC,
  cd as FAILURE_REASON_TIMEOUT,
  Gt as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Bl as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  vd as WavetableWorkerController,
  Id as createWavetableWorkerController,
  Sd as default
};
