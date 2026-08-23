function R(e) {
  const n = Number.isFinite(e) ? e : 0, r = Math.max(-1, Math.min(1, n));
  return Math.max(-32768, Math.min(32767, Math.round(r * 32768)));
}
const A = "cosimo.bounce-capture-snapshot", D = 1, y = "cosimo.bounce-capture-plan", M = 1, S = Object.freeze(
  Array.from({ length: 19 }, (e, n) => 24 + n * 4)
), O = 100, B = 3, C = 6, U = -80, L = 10 ** (U / 20), T = 0.05, $ = 0.1, v = 128;
function i(e, n) {
  if (!e) throw new Error(n);
}
function j(e) {
  if (typeof e != "object" || e === null || Array.isArray(e)) return !1;
  const n = Object.getPrototypeOf(e);
  return n === Object.prototype || n === null;
}
function I(e, n = "value") {
  return e === null || typeof e == "boolean" || typeof e == "string" ? e : typeof e == "number" ? (i(Number.isFinite(e), `${n} must be finite`), e) : ArrayBuffer.isView(e) ? (i(!(e instanceof DataView), `${n} cannot be a DataView`), e.slice()) : e instanceof ArrayBuffer ? e.slice(0) : Array.isArray(e) ? e.map((r, t) => I(r, `${n}[${t}]`)) : (i(j(e), `${n} must be structured-clone data`), Object.fromEntries(
    Object.keys(e).sort().map((r) => [r, I(e[r], `${n}.${r}`)])
  ));
}
function w(e, n) {
  return i(
    typeof e == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e),
    `${n} must be a Cmajor endpoint ID`
  ), e;
}
function z(e) {
  const r = (Array.isArray(e) ? e.map((t) => [t?.endpointID, t?.value]) : Object.entries(e ?? {})).map(([t, o], s) => ({
    endpointID: w(t, `parameters[${s}].endpointID`),
    value: I(o, `parameters.${t}`)
  }));
  r.sort((t, o) => t.endpointID.localeCompare(o.endpointID));
  for (let t = 1; t < r.length; t += 1)
    i(
      r[t - 1].endpointID !== r[t].endpointID,
      `Duplicate capture parameter ${r[t].endpointID}`
    );
  return r;
}
function P(e) {
  return i(Array.isArray(e), "setupEvents must be an array"), e.map((n, r) => {
    const t = n?.advanceFrames ?? 1, o = n?.sessionScoped ?? !1;
    return i(
      Number.isInteger(t) && t >= 0,
      `setupEvents[${r}].advanceFrames must be a non-negative integer`
    ), i(
      typeof o == "boolean",
      `setupEvents[${r}].sessionScoped must be boolean`
    ), {
      endpointID: w(n?.endpointID, `setupEvents[${r}].endpointID`),
      value: I(n?.value, `setupEvents[${r}].value`),
      advanceFrames: t,
      sessionScoped: o
    };
  });
}
function x({
  sampleRate: e,
  tempoBpm: n = 120,
  parameters: r = {},
  setupEvents: t = [],
  settleFrames: o = v,
  sourceGeneration: s = 0,
  sourceBankDigest: a = null
} = {}) {
  return i(
    Number.isInteger(e) && e >= 8e3 && e <= 384e3,
    "Capture sampleRate must be an integer from 8000 to 384000 Hz"
  ), i(
    typeof n == "number" && Number.isFinite(n) && n > 0,
    "Capture tempoBpm must be positive and finite"
  ), i(
    Number.isInteger(o) && o >= 1,
    "Capture settleFrames must be a positive integer"
  ), i(
    Number.isInteger(s) && s >= 0,
    "Capture sourceGeneration must be a non-negative integer"
  ), i(
    a === null || typeof a == "string",
    "Capture sourceBankDigest must be null or a string"
  ), Object.freeze({
    format: A,
    version: D,
    sampleRate: e,
    tempoBpm: n,
    parameters: Object.freeze(z(r).map(Object.freeze)),
    setupEvents: Object.freeze(P(t).map(Object.freeze)),
    settleFrames: o,
    sourceGeneration: s,
    sourceBankDigest: a
  });
}
function k(e) {
  return i(
    e?.format === A && e?.version === D,
    "Unsupported Bounce capture snapshot"
  ), x(e);
}
function V(e) {
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
function W(e, {
  roots: n = S,
  holdSeconds: r = B,
  tailCapSeconds: t = C,
  captureVelocity: o = O,
  blockFrames: s = v
} = {}) {
  const a = k(e), m = V(n);
  i(
    typeof r == "number" && Number.isFinite(r) && r > 0,
    "Capture holdSeconds must be positive and finite"
  ), i(
    typeof t == "number" && Number.isFinite(t) && t > 0 && t <= C,
    `Capture tailCapSeconds must be in (0, ${C}]`
  ), i(
    Number.isInteger(o) && o === O,
    `Bounce V1 captures at velocity ${O}`
  ), i(
    Number.isInteger(s) && s >= 1 && s <= 128,
    "Offline blockFrames must be from 1 to 128"
  );
  const c = Math.max(1, Math.round(r * a.sampleRate)), u = Math.max(1, Math.round(t * a.sampleRate)), p = Math.max(
    1,
    Math.round(T * a.sampleRate)
  ), d = Math.max(
    p,
    Math.round($ * a.sampleRate)
  ), h = m.map((f, N) => Object.freeze({
    rootIndex: N,
    rootNote: f,
    // Stable across identical bounces, while remaining distinct per root.
    sessionID: 4341760 + N
  }));
  return Object.freeze({
    format: y,
    version: M,
    snapshot: a,
    roots: Object.freeze(m),
    captureVelocity: o,
    holdFrames: c,
    tailCapFrames: u,
    silenceThresholdLinear: L,
    silenceWindowFrames: p,
    tailPaddingFrames: d,
    blockFrames: s,
    jobs: Object.freeze(h)
  });
}
function q(e) {
  return i(
    e?.format === y && e?.version === M,
    "Unsupported Bounce capture plan"
  ), W(e.snapshot, {
    roots: e.roots,
    holdSeconds: e.holdFrames / e.snapshot.sampleRate,
    tailCapSeconds: e.tailCapFrames / e.snapshot.sampleRate,
    captureVelocity: e.captureVelocity,
    blockFrames: e.blockFrames
  });
}
function l(e, n) {
  if (!e) throw new Error(n);
}
function g(e, n, r) {
  return (e & 255) << 16 | (n & 127) << 8 | r & 127;
}
function b(e, n, r) {
  const t = `${n}_${r}`, o = e[t];
  return l(typeof o == "function", `Offline performer is missing ${t}()`), o.bind(e);
}
function F(e, n, r) {
  let t = n;
  for (; t > 0; ) {
    const o = Math.min(r, t);
    e.advance(o), t -= o;
  }
}
function _(e, n, r, t, o) {
  const s = new Float32Array(o), a = new Float32Array(o);
  let m = 0;
  for (; m < t; ) {
    const c = Math.min(o, t - m);
    e.advance(c), e.getOutputFrames_audioOut([s, a], c, 0);
    for (let u = 0; u < c; u += 1) {
      const p = (r + m + u) * 2;
      n[p] = s[u], n[p + 1] = a[u];
    }
    m += c;
  }
}
function H(e, n, r) {
  let t = 0;
  const o = Math.min(e.length / 2, n + r), s = Math.max(0, o - n);
  if (s === 0) return 0;
  for (let a = n; a < o; a += 1) {
    const m = a * 2, c = e[m], u = e[m + 1];
    t += (c * c + u * u) * 0.5;
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
  l(typeof e == "function", "Offline engine module has no performer class");
  const t = new e();
  l(typeof t.initialise == "function", "Offline performer has no initialise() method"), await t.initialise(r.sessionID, n.snapshot.sampleRate);
  for (const o of n.snapshot.parameters)
    l(
      typeof o.value == "number",
      `Cmajor value endpoint ${o.endpointID} must receive a number`
    ), b(t, "setInputValue", o.endpointID)(o.value, 0);
  b(t, "sendInputEvent", "tempo")({ bpm: n.snapshot.tempoBpm }), F(t, 1, n.blockFrames);
  for (const o of n.snapshot.setupEvents) {
    const s = o.sessionScoped ? { ...o.value, dspSessionId: r.sessionID } : o.value;
    b(t, "sendInputEvent", o.endpointID)(s), F(t, o.advanceFrames, n.blockFrames);
  }
  return F(t, n.snapshot.settleFrames, n.blockFrames), t;
}
async function G(e, n, r) {
  const t = q(n), o = t.jobs.find((f) => f.rootIndex === r?.rootIndex);
  l(
    o !== void 0 && o.rootNote === r?.rootNote,
    "Bounce worker received a job outside its plan"
  );
  const s = globalThis.performance?.now?.() ?? Date.now(), a = await Y(e, t, o), m = t.holdFrames + t.tailCapFrames, c = new Float32Array(m * 2);
  b(a, "sendInputEvent", "midiIn")({
    message: g(144, o.rootNote, t.captureVelocity)
  }), _(a, c, 0, t.holdFrames, t.blockFrames), b(a, "sendInputEvent", "midiIn")({
    message: g(128, o.rootNote, 0)
  }), _(
    a,
    c,
    t.holdFrames,
    t.tailCapFrames,
    t.blockFrames
  );
  const u = Z(c, t.holdFrames, t), p = K(c, u);
  l(
    p >= t.silenceThresholdLinear,
    `Bounce root ${o.rootNote} captured silence`
  );
  const d = new Int16Array(u * 2);
  for (let f = 0; f < d.length; f += 1)
    d[f] = R(c[f]);
  const h = (globalThis.performance?.now?.() ?? Date.now()) - s;
  return {
    rootIndex: o.rootIndex,
    rootNote: o.rootNote,
    noteOffFrameOffset: t.holdFrames,
    frameCount: u,
    tailFrameCount: u - t.holdFrames,
    peak: p,
    samples: d,
    metrics: {
      renderedFrameCount: m,
      elapsedMilliseconds: h,
      realtimeMultiplier: h > 0 ? m / (h * t.snapshot.sampleRate / 1e3) : null
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
const E = self;
E.addEventListener("message", (e) => {
  const n = e.data;
  J(n, E.location.href).then((r) => {
    E.postMessage(r, [r.result.samples.buffer]);
  }).catch((r) => {
    E.postMessage({
      type: "render-root-failed",
      requestID: n?.requestID,
      error: Q(r)
    }, []);
  });
});
