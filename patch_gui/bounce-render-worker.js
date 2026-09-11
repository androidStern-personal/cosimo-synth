function z(e) {
  const n = Number.isFinite(e) ? e : 0, o = Math.max(-1, Math.min(1, n));
  return Math.max(-32768, Math.min(32767, Math.round(o * 32768)));
}
const _ = "cosimo.bounce-capture-snapshot", A = 1, D = "cosimo.bounce-capture-plan", M = 1, B = Object.freeze(
  Array.from({ length: 19 }, (e, n) => 24 + n * 4)
), F = 100, L = 3, y = 6, U = -80, P = 10 ** (U / 20), T = 0.05, j = 0.1, S = 128;
function i(e, n) {
  if (!e) throw new Error(n);
}
function C(e) {
  if (typeof e != "object" || e === null || Array.isArray(e)) return !1;
  const n = Object.getPrototypeOf(e);
  return n === Object.prototype || n === null;
}
function E(e, n = "value", o = /* @__PURE__ */ new WeakMap()) {
  if (e === null || typeof e == "boolean" || typeof e == "string") return e;
  if (typeof e == "number")
    return i(Number.isFinite(e), `${n} must be finite`), e;
  if (ArrayBuffer.isView(e)) {
    i(!(e instanceof DataView), `${n} cannot be a DataView`);
    const t = o.get(e);
    if (t !== void 0) return t;
    const r = e.slice();
    return o.set(e, r), r;
  }
  if (e instanceof ArrayBuffer) {
    const t = o.get(e);
    if (t !== void 0) return t;
    const r = e.slice(0);
    return o.set(e, r), r;
  }
  return Array.isArray(e) ? e.map((t, r) => E(t, `${n}[${r}]`, o)) : (i(C(e), `${n} must be structured-clone data`), Object.fromEntries(
    Object.keys(e).sort().map((t) => [
      t,
      E(e[t], `${n}.${t}`, o)
    ])
  ));
}
function $(e, n) {
  return i(
    typeof e == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e),
    `${n} must be a Cmajor endpoint ID`
  ), e;
}
function x(e) {
  const o = (Array.isArray(e) ? e.map((t) => [t?.endpointID, t?.value]) : Object.entries(e ?? {})).map(([t, r], a) => ({
    endpointID: $(t, `parameters[${a}].endpointID`),
    value: E(r, `parameters.${t}`)
  }));
  o.sort((t, r) => t.endpointID.localeCompare(r.endpointID));
  for (let t = 1; t < o.length; t += 1)
    i(
      o[t - 1].endpointID !== o[t].endpointID,
      `Duplicate capture parameter ${o[t].endpointID}`
    );
  return o;
}
function v(e, {
  fieldName: n = "setupEvents",
  rootScoped: o = !1
} = {}) {
  i(Array.isArray(e), `${n} must be an array`);
  const t = /* @__PURE__ */ new WeakMap();
  return e.map((r, a) => {
    const s = r?.advanceFrames ?? 1, c = r?.sessionScoped ?? !1;
    i(
      Number.isInteger(s) && s >= 0,
      `${n}[${a}].advanceFrames must be a non-negative integer`
    ), i(
      typeof c == "boolean",
      `${n}[${a}].sessionScoped must be boolean`
    );
    const u = {
      endpointID: $(r?.endpointID, `${n}[${a}].endpointID`),
      value: E(r?.value, `${n}[${a}].value`, t),
      advanceFrames: s,
      sessionScoped: c
    };
    return o ? (i(
      typeof r?.rootNoteField == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(r.rootNoteField),
      `${n}[${a}].rootNoteField must be a field name`
    ), i(
      C(u.value),
      `${n}[${a}].value must be an object`
    ), { ...u, rootNoteField: r.rootNoteField }) : u;
  });
}
function k(e) {
  i(Array.isArray(e) && e.length <= 3, "Invalid wavetable source list");
  const n = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new WeakMap();
  return e.map((t) => {
    i(Number.isInteger(t.input) && t.input >= 0 && t.input < 3 && !n.has(t.input), "Invalid wavetable source input"), n.add(t.input), i(Number.isInteger(t.tableIndex) && t.tableIndex >= 0 && Number.isInteger(t.generation) && t.generation > 0, "Invalid wavetable source identity"), i(Array.isArray(t.frames) && t.frames.length >= 1 && t.frames.length <= 256, "Invalid wavetable source frames");
    const r = t.frames.map((a) => {
      i(a instanceof Float32Array && a.length === 2048 && a.every(Number.isFinite), "Invalid wavetable source frame");
      let s = o.get(a);
      return s || (s = a.slice(), o.set(a, s)), s;
    });
    return Object.freeze({ input: t.input, tableIndex: t.tableIndex, generation: t.generation, frames: Object.freeze(r) });
  });
}
function W({
  sampleRate: e,
  tempoBpm: n = 120,
  parameters: o = {},
  setupEvents: t = [],
  wavetableSources: r = [],
  rootSetupEvents: a = [],
  settleFrames: s = S,
  sourceGeneration: c = 0,
  sourceBankDigest: u = null
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
    Number.isInteger(c) && c >= 0,
    "Capture sourceGeneration must be a non-negative integer"
  ), i(
    u === null || typeof u == "string",
    "Capture sourceBankDigest must be null or a string"
  ), Object.freeze({
    format: _,
    version: A,
    sampleRate: e,
    tempoBpm: n,
    parameters: Object.freeze(x(o).map(Object.freeze)),
    setupEvents: Object.freeze(v(t).map(Object.freeze)),
    wavetableSources: Object.freeze(k(r)),
    // Root-scoped events receive the worker job's note immediately before
    // MIDI note-on. They remain part of the immutable press-time recipe.
    rootSetupEvents: Object.freeze(v(a, {
      fieldName: "rootSetupEvents",
      rootScoped: !0
    }).map(Object.freeze)),
    settleFrames: s,
    sourceGeneration: c,
    sourceBankDigest: u
  });
}
function V(e) {
  return i(
    e?.format === _ && e?.version === A,
    "Unsupported Bounce capture snapshot"
  ), W(e);
}
function q(e) {
  i(
    Array.isArray(e) && e.length > 0 && e.length <= 19,
    "Capture roots must contain 1 to 19 MIDI notes"
  );
  let n = -1;
  return e.map((o, t) => (i(
    Number.isInteger(o) && o >= 0 && o <= 127,
    `Capture root ${t} is not a MIDI note`
  ), i(o > n, "Capture roots must be strictly ascending"), n = o, o));
}
function H(e, {
  roots: n = B,
  holdSeconds: o = L,
  tailCapSeconds: t = y,
  captureVelocity: r = F,
  blockFrames: a = S
} = {}) {
  const s = V(e), c = q(n);
  i(
    typeof o == "number" && Number.isFinite(o) && o > 0,
    "Capture holdSeconds must be positive and finite"
  ), i(
    typeof t == "number" && Number.isFinite(t) && t > 0 && t <= y,
    `Capture tailCapSeconds must be in (0, ${y}]`
  ), i(
    Number.isInteger(r) && r === F,
    `Bounce V1 captures at velocity ${F}`
  ), i(
    Number.isInteger(a) && a >= 1 && a <= 128,
    "Offline blockFrames must be from 1 to 128"
  );
  const u = Math.max(1, Math.round(o * s.sampleRate)), m = Math.max(1, Math.round(t * s.sampleRate)), p = Math.max(
    1,
    Math.round(T * s.sampleRate)
  ), g = Math.max(
    p,
    Math.round(j * s.sampleRate)
  ), b = c.map((h, f) => Object.freeze({
    rootIndex: f,
    rootNote: h,
    // Stable across identical bounces, while remaining distinct per root.
    sessionID: 4341760 + f
  }));
  return Object.freeze({
    format: D,
    version: M,
    snapshot: s,
    roots: Object.freeze(c),
    captureVelocity: r,
    holdFrames: u,
    tailCapFrames: m,
    silenceThresholdLinear: P,
    silenceWindowFrames: p,
    tailPaddingFrames: g,
    blockFrames: a,
    jobs: Object.freeze(b)
  });
}
function Z(e) {
  return i(
    e?.format === D && e?.version === M,
    "Unsupported Bounce capture plan"
  ), H(e.snapshot, {
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
function N(e, n, o) {
  return (e & 255) << 16 | (n & 127) << 8 | o & 127;
}
function d(e, n, o) {
  const t = `${n}_${o}`, r = e[t];
  return l(typeof r == "function", `Offline performer is missing ${t}()`), r.bind(e);
}
function I(e, n, o) {
  let t = n;
  for (; t > 0; ) {
    const r = Math.min(o, t);
    e.advance(r), t -= r;
  }
}
function w(e, n, o, t, r) {
  const a = new Float32Array(r), s = new Float32Array(r);
  let c = 0;
  for (; c < t; ) {
    const u = Math.min(r, t - c);
    e.advance(u), e.getOutputFrames_audioOut([a, s], u, 0);
    for (let m = 0; m < u; m += 1) {
      const p = (o + c + m) * 2;
      n[p] = a[m], n[p + 1] = s[m];
    }
    c += u;
  }
}
function K(e, n, o) {
  let t = 0;
  const r = Math.min(e.length / 2, n + o), a = Math.max(0, r - n);
  if (a === 0) return 0;
  for (let s = n; s < r; s += 1) {
    const c = s * 2, u = e[c], m = e[c + 1];
    t += (u * u + m * m) * 0.5;
  }
  return Math.sqrt(t / a);
}
function Y(e, n, o) {
  const t = e.length / 2;
  let r = n;
  for (let a = n; a < t; a += o.silenceWindowFrames) {
    const s = Math.min(o.silenceWindowFrames, t - a);
    K(e, a, s) >= o.silenceThresholdLinear && (r = a + s);
  }
  return Math.min(t, Math.max(
    n + 4,
    r + o.tailPaddingFrames
  ));
}
function G(e, n = e.length / 2) {
  let o = 0;
  for (let t = 0; t < n * 2; t += 1)
    o = Math.max(o, Math.abs(e[t]));
  return o;
}
function J(e) {
  const n = e?.memoryDataView?.buffer?.byteLength ?? e?.byteMemory?.byteLength ?? null;
  return Number.isInteger(n) && n > 0 ? n / 65536 : null;
}
async function Q(e, n, o) {
  l(typeof e == "function", "Offline engine module has no performer class");
  const t = e.createOfflinePerformer ? await e.createOfflinePerformer(o.sessionID, n.snapshot.sampleRate) : { performer: new e(), dispose() {
  } }, r = t.performer;
  l(
    !r.getMemoryRequirements?.().shared || e.createOfflinePerformer,
    "Shared offline engine must supply its resource lifecycle factory"
  ), l(typeof r.initialise == "function", "Offline performer has no initialise() method"), e.createOfflinePerformer || await r.initialise(o.sessionID, n.snapshot.sampleRate);
  try {
    for (const a of n.snapshot.parameters)
      l(
        typeof a.value == "number",
        `Cmajor value endpoint ${a.endpointID} must receive a number`
      ), d(r, "setInputValue", a.endpointID)(a.value, 0);
    d(r, "sendInputEvent", "tempo")({ bpm: n.snapshot.tempoBpm }), I(r, 1, n.blockFrames), n.snapshot.wavetableSources.length > 0 && (l(typeof t.prepareWavetables == "function", "Offline engine does not support direct wavetable preparation"), await t.prepareWavetables(n.snapshot.wavetableSources), I(r, 1, n.blockFrames));
    for (const a of n.snapshot.setupEvents) {
      l(
        !e.createOfflinePerformer || a.endpointID !== "wavetableLoadBegin" && a.endpointID !== "wavetableMipFrame",
        "Shared offline engine requires source-frame capture recipes"
      );
      const s = a.sessionScoped ? { ...a.value, dspSessionId: o.sessionID } : a.value;
      d(r, "sendInputEvent", a.endpointID)(s), I(r, a.advanceFrames, n.blockFrames);
    }
    return I(r, n.snapshot.settleFrames, n.blockFrames), t;
  } catch (a) {
    throw t.dispose(), a;
  }
}
async function X(e, n, o) {
  const t = Z(n), r = t.jobs.find((u) => u.rootIndex === o?.rootIndex);
  l(
    r !== void 0 && r.rootNote === o?.rootNote,
    "Bounce worker received a job outside its plan"
  );
  const a = globalThis.performance?.now?.() ?? Date.now(), s = await Q(e, t, r), c = s.performer;
  try {
    const u = t.holdFrames + t.tailCapFrames, m = new Float32Array(u * 2);
    for (const f of t.snapshot.rootSetupEvents) {
      const R = {
        ...f.value,
        [f.rootNoteField]: r.rootNote,
        ...f.sessionScoped ? { dspSessionId: r.sessionID } : {}
      };
      d(c, "sendInputEvent", f.endpointID)(R), I(c, f.advanceFrames, t.blockFrames);
    }
    d(c, "sendInputEvent", "midiIn")({
      message: N(144, r.rootNote, t.captureVelocity)
    }), w(c, m, 0, t.holdFrames, t.blockFrames), d(c, "sendInputEvent", "midiIn")({
      message: N(128, r.rootNote, 0)
    }), w(
      c,
      m,
      t.holdFrames,
      t.tailCapFrames,
      t.blockFrames
    );
    const p = Y(m, t.holdFrames, t), g = G(m, p);
    l(
      g >= t.silenceThresholdLinear,
      `Bounce root ${r.rootNote} captured silence`
    );
    const b = new Int16Array(p * 2);
    for (let f = 0; f < b.length; f += 1)
      b[f] = z(m[f]);
    const h = (globalThis.performance?.now?.() ?? Date.now()) - a;
    return {
      rootIndex: r.rootIndex,
      rootNote: r.rootNote,
      noteOffFrameOffset: t.holdFrames,
      frameCount: p,
      tailFrameCount: p - t.holdFrames,
      peak: g,
      samples: b,
      metrics: {
        renderedFrameCount: u,
        elapsedMilliseconds: h,
        realtimeMultiplier: h > 0 ? u / (h * t.snapshot.sampleRate / 1e3) : null,
        // Generated Cmajor performers have fixed-size wasm memory. The
        // page count is reported before the short-lived worker exits so
        // browser soak tests can prove recursion does not grow an engine.
        wasmMemoryPages: J(c)
      }
    };
  } finally {
    s.dispose();
  }
}
async function ee(e, n) {
  if (e?.type !== "render-root")
    throw new Error("Bounce worker received an unsupported message");
  const t = await import(new URL(e.engineModuleURL, n).href), r = t.default ?? t.WavetableSynth, a = await X(r, e.plan, e.job);
  return {
    type: "render-root-complete",
    requestID: e.requestID,
    result: a
  };
}
function te(e) {
  return {
    name: e instanceof Error ? e.name : "Error",
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : void 0
  };
}
const O = self;
O.addEventListener("message", (e) => {
  const n = e.data;
  ee(n, O.location.href).then((o) => {
    O.postMessage(o, [o.result.samples.buffer]);
  }).catch((o) => {
    O.postMessage({
      type: "render-root-failed",
      requestID: n?.requestID,
      error: te(o)
    }, []);
  });
});
