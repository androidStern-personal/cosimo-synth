function R(e) {
  const n = Number.isFinite(e) ? e : 0, r = Math.max(-1, Math.min(1, n));
  return Math.max(-32768, Math.min(32767, Math.round(r * 32768)));
}
const D = "cosimo.bounce-capture-snapshot", M = 1, S = "cosimo.bounce-capture-plan", v = 1, B = Object.freeze(
  Array.from({ length: 19 }, (e, n) => 24 + n * 4)
), N = 100, U = 3, g = 6, j = -80, z = 10 ** (j / 20), L = 0.05, T = 0.1, $ = 128;
function i(e, n) {
  if (!e) throw new Error(n);
}
function w(e) {
  if (typeof e != "object" || e === null || Array.isArray(e)) return !1;
  const n = Object.getPrototypeOf(e);
  return n === Object.prototype || n === null;
}
function O(e, n = "value", r = /* @__PURE__ */ new WeakMap()) {
  if (e === null || typeof e == "boolean" || typeof e == "string") return e;
  if (typeof e == "number")
    return i(Number.isFinite(e), `${n} must be finite`), e;
  if (ArrayBuffer.isView(e)) {
    i(!(e instanceof DataView), `${n} cannot be a DataView`);
    const t = r.get(e);
    if (t !== void 0) return t;
    const o = e.slice();
    return r.set(e, o), o;
  }
  if (e instanceof ArrayBuffer) {
    const t = r.get(e);
    if (t !== void 0) return t;
    const o = e.slice(0);
    return r.set(e, o), o;
  }
  return Array.isArray(e) ? e.map((t, o) => O(t, `${n}[${o}]`, r)) : (i(w(e), `${n} must be structured-clone data`), Object.fromEntries(
    Object.keys(e).sort().map((t) => [
      t,
      O(e[t], `${n}.${t}`, r)
    ])
  ));
}
function y(e, n) {
  return i(
    typeof e == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e),
    `${n} must be a Cmajor endpoint ID`
  ), e;
}
function P(e) {
  const r = (Array.isArray(e) ? e.map((t) => [t?.endpointID, t?.value]) : Object.entries(e ?? {})).map(([t, o], s) => ({
    endpointID: y(t, `parameters[${s}].endpointID`),
    value: O(o, `parameters.${t}`)
  }));
  r.sort((t, o) => t.endpointID.localeCompare(o.endpointID));
  for (let t = 1; t < r.length; t += 1)
    i(
      r[t - 1].endpointID !== r[t].endpointID,
      `Duplicate capture parameter ${r[t].endpointID}`
    );
  return r;
}
function _(e, {
  fieldName: n = "setupEvents",
  rootScoped: r = !1
} = {}) {
  i(Array.isArray(e), `${n} must be an array`);
  const t = /* @__PURE__ */ new WeakMap();
  return e.map((o, s) => {
    const a = o?.advanceFrames ?? 1, c = o?.sessionScoped ?? !1;
    i(
      Number.isInteger(a) && a >= 0,
      `${n}[${s}].advanceFrames must be a non-negative integer`
    ), i(
      typeof c == "boolean",
      `${n}[${s}].sessionScoped must be boolean`
    );
    const u = {
      endpointID: y(o?.endpointID, `${n}[${s}].endpointID`),
      value: O(o?.value, `${n}[${s}].value`, t),
      advanceFrames: a,
      sessionScoped: c
    };
    return r ? (i(
      typeof o?.rootNoteField == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(o.rootNoteField),
      `${n}[${s}].rootNoteField must be a field name`
    ), i(
      w(u.value),
      `${n}[${s}].value must be an object`
    ), { ...u, rootNoteField: o.rootNoteField }) : u;
  });
}
function x({
  sampleRate: e,
  tempoBpm: n = 120,
  parameters: r = {},
  setupEvents: t = [],
  rootSetupEvents: o = [],
  settleFrames: s = $,
  sourceGeneration: a = 0,
  sourceBankDigest: c = null
} = {}) {
  return i(
    Number.isInteger(e) && e >= 8e3 && e <= 384e3,
    "Capture sampleRate must be an integer from 8000 to 384000 Hz"
  ), i(
    typeof n == "number" && Number.isFinite(n) && n > 0,
    "Capture tempoBpm must be positive and finite"
  ), i(
    Number.isInteger(s) && s >= 1,
    "Capture settleFrames must be a positive integer"
  ), i(
    Number.isInteger(a) && a >= 0,
    "Capture sourceGeneration must be a non-negative integer"
  ), i(
    c === null || typeof c == "string",
    "Capture sourceBankDigest must be null or a string"
  ), Object.freeze({
    format: D,
    version: M,
    sampleRate: e,
    tempoBpm: n,
    parameters: Object.freeze(P(r).map(Object.freeze)),
    setupEvents: Object.freeze(_(t).map(Object.freeze)),
    // Root-scoped events receive the worker job's note immediately before
    // MIDI note-on. They remain part of the immutable press-time recipe.
    rootSetupEvents: Object.freeze(_(o, {
      fieldName: "rootSetupEvents",
      rootScoped: !0
    }).map(Object.freeze)),
    settleFrames: s,
    sourceGeneration: a,
    sourceBankDigest: c
  });
}
function k(e) {
  return i(
    e?.format === D && e?.version === M,
    "Unsupported Bounce capture snapshot"
  ), x(e);
}
function W(e) {
  i(
    Array.isArray(e) && e.length > 0 && e.length <= 19,
    "Capture roots must contain 1 to 19 MIDI notes"
  );
  let n = -1;
  return e.map((r, t) => (i(
    Number.isInteger(r) && r >= 0 && r <= 127,
    `Capture root ${t} is not a MIDI note`
  ), i(r > n, "Capture roots must be strictly ascending"), n = r, r));
}
function V(e, {
  roots: n = B,
  holdSeconds: r = U,
  tailCapSeconds: t = g,
  captureVelocity: o = N,
  blockFrames: s = $
} = {}) {
  const a = k(e), c = W(n);
  i(
    typeof r == "number" && Number.isFinite(r) && r > 0,
    "Capture holdSeconds must be positive and finite"
  ), i(
    typeof t == "number" && Number.isFinite(t) && t > 0 && t <= g,
    `Capture tailCapSeconds must be in (0, ${g}]`
  ), i(
    Number.isInteger(o) && o === N,
    `Bounce V1 captures at velocity ${N}`
  ), i(
    Number.isInteger(s) && s >= 1 && s <= 128,
    "Offline blockFrames must be from 1 to 128"
  );
  const u = Math.max(1, Math.round(r * a.sampleRate)), m = Math.max(1, Math.round(t * a.sampleRate)), f = Math.max(
    1,
    Math.round(L * a.sampleRate)
  ), h = Math.max(
    f,
    Math.round(T * a.sampleRate)
  ), b = c.map((p, E) => Object.freeze({
    rootIndex: E,
    rootNote: p,
    // Stable across identical bounces, while remaining distinct per root.
    sessionID: 4341760 + E
  }));
  return Object.freeze({
    format: S,
    version: v,
    snapshot: a,
    roots: Object.freeze(c),
    captureVelocity: o,
    holdFrames: u,
    tailCapFrames: m,
    silenceThresholdLinear: z,
    silenceWindowFrames: f,
    tailPaddingFrames: h,
    blockFrames: s,
    jobs: Object.freeze(b)
  });
}
function q(e) {
  return i(
    e?.format === S && e?.version === v,
    "Unsupported Bounce capture plan"
  ), V(e.snapshot, {
    roots: e.roots,
    holdSeconds: e.holdFrames / e.snapshot.sampleRate,
    tailCapSeconds: e.tailCapFrames / e.snapshot.sampleRate,
    captureVelocity: e.captureVelocity,
    blockFrames: e.blockFrames
  });
}
function d(e, n) {
  if (!e) throw new Error(n);
}
function C(e, n, r) {
  return (e & 255) << 16 | (n & 127) << 8 | r & 127;
}
function l(e, n, r) {
  const t = `${n}_${r}`, o = e[t];
  return d(typeof o == "function", `Offline performer is missing ${t}()`), o.bind(e);
}
function F(e, n, r) {
  let t = n;
  for (; t > 0; ) {
    const o = Math.min(r, t);
    e.advance(o), t -= o;
  }
}
function A(e, n, r, t, o) {
  const s = new Float32Array(o), a = new Float32Array(o);
  let c = 0;
  for (; c < t; ) {
    const u = Math.min(o, t - c);
    e.advance(u), e.getOutputFrames_audioOut([s, a], u, 0);
    for (let m = 0; m < u; m += 1) {
      const f = (r + c + m) * 2;
      n[f] = s[m], n[f + 1] = a[m];
    }
    c += u;
  }
}
function H(e, n, r) {
  let t = 0;
  const o = Math.min(e.length / 2, n + r), s = Math.max(0, o - n);
  if (s === 0) return 0;
  for (let a = n; a < o; a += 1) {
    const c = a * 2, u = e[c], m = e[c + 1];
    t += (u * u + m * m) * 0.5;
  }
  return Math.sqrt(t / s);
}
function Z(e, n, r) {
  const t = e.length / 2;
  let o = n;
  for (let s = n; s < t; s += r.silenceWindowFrames) {
    const a = Math.min(r.silenceWindowFrames, t - s);
    H(e, s, a) >= r.silenceThresholdLinear && (o = s + a);
  }
  return Math.min(t, Math.max(
    n + 4,
    o + r.tailPaddingFrames
  ));
}
function K(e, n = e.length / 2) {
  let r = 0;
  for (let t = 0; t < n * 2; t += 1)
    r = Math.max(r, Math.abs(e[t]));
  return r;
}
async function Y(e, n, r) {
  d(typeof e == "function", "Offline engine module has no performer class");
  const t = new e();
  d(typeof t.initialise == "function", "Offline performer has no initialise() method"), await t.initialise(r.sessionID, n.snapshot.sampleRate);
  for (const o of n.snapshot.parameters)
    d(
      typeof o.value == "number",
      `Cmajor value endpoint ${o.endpointID} must receive a number`
    ), l(t, "setInputValue", o.endpointID)(o.value, 0);
  l(t, "sendInputEvent", "tempo")({ bpm: n.snapshot.tempoBpm }), F(t, 1, n.blockFrames);
  for (const o of n.snapshot.setupEvents) {
    const s = o.sessionScoped ? { ...o.value, dspSessionId: r.sessionID } : o.value;
    l(t, "sendInputEvent", o.endpointID)(s), F(t, o.advanceFrames, n.blockFrames);
  }
  return F(t, n.snapshot.settleFrames, n.blockFrames), t;
}
async function G(e, n, r) {
  const t = q(n), o = t.jobs.find((p) => p.rootIndex === r?.rootIndex);
  d(
    o !== void 0 && o.rootNote === r?.rootNote,
    "Bounce worker received a job outside its plan"
  );
  const s = globalThis.performance?.now?.() ?? Date.now(), a = await Y(e, t, o), c = t.holdFrames + t.tailCapFrames, u = new Float32Array(c * 2);
  for (const p of t.snapshot.rootSetupEvents) {
    const E = {
      ...p.value,
      [p.rootNoteField]: o.rootNote,
      ...p.sessionScoped ? { dspSessionId: o.sessionID } : {}
    };
    l(a, "sendInputEvent", p.endpointID)(E), F(a, p.advanceFrames, t.blockFrames);
  }
  l(a, "sendInputEvent", "midiIn")({
    message: C(144, o.rootNote, t.captureVelocity)
  }), A(a, u, 0, t.holdFrames, t.blockFrames), l(a, "sendInputEvent", "midiIn")({
    message: C(128, o.rootNote, 0)
  }), A(
    a,
    u,
    t.holdFrames,
    t.tailCapFrames,
    t.blockFrames
  );
  const m = Z(u, t.holdFrames, t), f = K(u, m);
  d(
    f >= t.silenceThresholdLinear,
    `Bounce root ${o.rootNote} captured silence`
  );
  const h = new Int16Array(m * 2);
  for (let p = 0; p < h.length; p += 1)
    h[p] = R(u[p]);
  const b = (globalThis.performance?.now?.() ?? Date.now()) - s;
  return {
    rootIndex: o.rootIndex,
    rootNote: o.rootNote,
    noteOffFrameOffset: t.holdFrames,
    frameCount: m,
    tailFrameCount: m - t.holdFrames,
    peak: f,
    samples: h,
    metrics: {
      renderedFrameCount: c,
      elapsedMilliseconds: b,
      realtimeMultiplier: b > 0 ? c / (b * t.snapshot.sampleRate / 1e3) : null
    }
  };
}
async function J(e, n) {
  if (e?.type !== "render-root")
    throw new Error("Bounce worker received an unsupported message");
  const t = await import(new URL(e.engineModuleURL, n).href), o = t.default ?? t.WavetableSynth, s = await G(o, e.plan, e.job);
  return {
    type: "render-root-complete",
    requestID: e.requestID,
    result: s
  };
}
function Q(e) {
  return {
    name: e instanceof Error ? e.name : "Error",
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : void 0
  };
}
const I = self;
I.addEventListener("message", (e) => {
  const n = e.data;
  J(n, I.location.href).then((r) => {
    I.postMessage(r, [r.result.samples.buffer]);
  }).catch((r) => {
    I.postMessage({
      type: "render-root-failed",
      requestID: n?.requestID,
      error: Q(r)
    }, []);
  });
});
