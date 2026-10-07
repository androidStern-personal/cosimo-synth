function B(e) {
  const n = Number.isFinite(e) ? e : 0, o = Math.max(-1, Math.min(1, n));
  return Math.max(-32768, Math.min(32767, Math.round(o * 32768)));
}
const A = "cosimo.bounce-capture-snapshot", M = 1, D = "cosimo.bounce-capture-plan", S = 1, z = Object.freeze(
  Array.from({ length: 19 }, (e, n) => 24 + n * 4)
), y = 100, U = 3, N = 6, T = -80, P = 10 ** (T / 20), j = 0.05, x = 0.1, C = 128, k = 156;
function i(e, n) {
  if (!e) throw new Error(n);
}
function $(e) {
  if (typeof e != "object" || e === null || Array.isArray(e)) return !1;
  const n = Object.getPrototypeOf(e);
  return n === Object.prototype || n === null;
}
function O(e, n = "value", o = /* @__PURE__ */ new WeakMap()) {
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
  return Array.isArray(e) ? e.map((t, r) => O(t, `${n}[${r}]`, o)) : (i($(e), `${n} must be structured-clone data`), Object.fromEntries(
    Object.keys(e).sort().map((t) => [
      t,
      O(e[t], `${n}.${t}`, o)
    ])
  ));
}
function L(e, n) {
  return i(
    typeof e == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e),
    `${n} must be a Cmajor endpoint ID`
  ), e;
}
function W(e) {
  const o = (Array.isArray(e) ? e.map((t) => [t?.endpointID, t?.value]) : Object.entries(e ?? {})).map(([t, r], a) => ({
    endpointID: L(t, `parameters[${a}].endpointID`),
    value: O(r, `parameters.${t}`)
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
      endpointID: L(r?.endpointID, `${n}[${a}].endpointID`),
      value: O(r?.value, `${n}[${a}].value`, t),
      advanceFrames: s,
      sessionScoped: c
    };
    return r.preparation !== void 0 && (i(
      r.preparation === "mseg" && r.endpointID === "modulationMsegBuffer",
      `${n}[${a}] has unsupported preparation`
    ), u.preparation = "mseg"), o ? (i(
      typeof r?.rootNoteField == "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(r.rootNoteField),
      `${n}[${a}].rootNoteField must be a field name`
    ), i(
      $(u.value),
      `${n}[${a}].value must be an object`
    ), { ...u, rootNoteField: r.rootNoteField }) : u;
  });
}
function V(e) {
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
function q({
  sampleRate: e,
  tempoBpm: n = 120,
  parameters: o = {},
  setupEvents: t = [],
  wavetableSources: r = [],
  rootSetupEvents: a = [],
  settleFrames: s = C,
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
    format: A,
    version: M,
    sampleRate: e,
    tempoBpm: n,
    parameters: Object.freeze(W(o).map(Object.freeze)),
    setupEvents: Object.freeze(v(t).map(Object.freeze)),
    wavetableSources: Object.freeze(V(r)),
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
function H(e) {
  return i(
    e?.format === A && e?.version === M,
    "Unsupported Bounce capture snapshot"
  ), q(e);
}
function Z(e) {
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
function Y(e, {
  roots: n = z,
  holdSeconds: o = U,
  tailCapSeconds: t = N,
  captureVelocity: r = y,
  blockFrames: a = C
} = {}) {
  const s = H(e), c = Z(n);
  i(
    typeof o == "number" && Number.isFinite(o) && o > 0,
    "Capture holdSeconds must be positive and finite"
  ), i(
    typeof t == "number" && Number.isFinite(t) && t > 0 && t <= N,
    `Capture tailCapSeconds must be in (0, ${N}]`
  ), i(
    Number.isInteger(r) && r === y,
    `Bounce V1 captures at velocity ${y}`
  ), i(
    Number.isInteger(a) && a >= 1 && a <= 128,
    "Offline blockFrames must be from 1 to 128"
  );
  const u = Math.max(1, Math.round(o * s.sampleRate)), p = Math.max(1, Math.round(t * s.sampleRate)), l = Math.max(
    1,
    Math.round(j * s.sampleRate)
  ), d = Math.max(
    l,
    Math.round(x * s.sampleRate)
  ), E = c.map((g, b) => Object.freeze({
    rootIndex: b,
    rootNote: g,
    // Stable across identical bounces, while remaining distinct per root.
    sessionID: 4341760 + b
  }));
  return Object.freeze({
    format: D,
    version: S,
    snapshot: s,
    roots: Object.freeze(c),
    captureVelocity: r,
    holdFrames: u,
    tailCapFrames: p,
    silenceThresholdLinear: P,
    silenceWindowFrames: l,
    tailPaddingFrames: d,
    blockFrames: a,
    outputLatencyFrames: k,
    jobs: Object.freeze(E)
  });
}
function G(e) {
  return i(
    e?.format === D && e?.version === S,
    "Unsupported Bounce capture plan"
  ), Y(e.snapshot, {
    roots: e.roots,
    holdSeconds: e.holdFrames / e.snapshot.sampleRate,
    tailCapSeconds: e.tailCapFrames / e.snapshot.sampleRate,
    captureVelocity: e.captureVelocity,
    blockFrames: e.blockFrames
  });
}
function f(e, n) {
  if (!e) throw new Error(n);
}
function w(e, n, o) {
  return (e & 255) << 16 | (n & 127) << 8 | o & 127;
}
function h(e, n, o) {
  const t = `${n}_${o}`, r = e[t];
  return f(typeof r == "function", `Offline performer is missing ${t}()`), r.bind(e);
}
function I(e, n, o) {
  let t = n;
  for (; t > 0; ) {
    const r = Math.min(o, t);
    e.advance(r), t -= r;
  }
}
function _(e, n, o, t, r) {
  const a = new Float32Array(r), s = new Float32Array(r);
  let c = 0;
  for (; c < t; ) {
    const u = Math.min(r, t - c);
    e.advance(u), e.getOutputFrames_audioOut([a, s], u, 0);
    for (let p = 0; p < u; p += 1) {
      const l = (o + c + p) * 2;
      n[l] = a[p], n[l + 1] = s[p];
    }
    c += u;
  }
}
function K(e, n, o) {
  let t = 0;
  const r = Math.min(e.length / 2, n + o), a = Math.max(0, r - n);
  if (a === 0) return 0;
  for (let s = n; s < r; s += 1) {
    const c = s * 2, u = e[c], p = e[c + 1];
    t += (u * u + p * p) * 0.5;
  }
  return Math.sqrt(t / a);
}
function J(e, n, o) {
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
function Q(e, n = e.length / 2) {
  let o = 0;
  for (let t = 0; t < n * 2; t += 1)
    o = Math.max(o, Math.abs(e[t]));
  return o;
}
function X(e) {
  const n = e?.memoryDataView?.buffer?.byteLength ?? e?.byteMemory?.byteLength ?? null;
  return Number.isInteger(n) && n > 0 ? n / 65536 : null;
}
async function ee(e, n, o) {
  f(typeof e == "function", "Offline engine module has no performer class");
  const t = e.createOfflinePerformer ? await e.createOfflinePerformer(o.sessionID, n.snapshot.sampleRate) : { performer: new e(), dispose() {
  } }, r = t.performer;
  f(
    !r.getMemoryRequirements?.().shared || e.createOfflinePerformer,
    "Shared offline engine must supply its resource lifecycle factory"
  ), f(typeof r.initialise == "function", "Offline performer has no initialise() method"), e.createOfflinePerformer || await r.initialise(o.sessionID, n.snapshot.sampleRate);
  try {
    for (const a of n.snapshot.parameters)
      f(
        typeof a.value == "number",
        `Cmajor value endpoint ${a.endpointID} must receive a number`
      ), h(r, "setInputValue", a.endpointID)(a.value, 0);
    h(r, "sendInputEvent", "tempo")({ bpm: n.snapshot.tempoBpm }), I(r, 1, n.blockFrames), n.snapshot.wavetableSources.length > 0 && (f(typeof t.prepareWavetables == "function", "Offline engine does not support direct wavetable preparation"), await t.prepareWavetables(n.snapshot.wavetableSources), I(r, 1, n.blockFrames));
    for (const a of n.snapshot.setupEvents) {
      f(
        !e.createOfflinePerformer || a.endpointID !== "wavetableLoadBegin" && a.endpointID !== "wavetableMipFrame",
        "Shared offline engine requires source-frame capture recipes"
      );
      const s = a.sessionScoped ? { ...a.value, dspSessionId: o.sessionID } : a.value;
      a.preparation === "mseg" ? (f(typeof t.prepareMseg == "function", "Offline engine does not support direct MSEG preparation"), await t.prepareMseg(s)) : h(r, "sendInputEvent", a.endpointID)(s), I(r, a.advanceFrames, n.blockFrames);
    }
    return I(r, n.snapshot.settleFrames, n.blockFrames), t;
  } catch (a) {
    throw t.dispose(), a;
  }
}
async function te(e, n, o) {
  const t = G(n), r = t.jobs.find((u) => u.rootIndex === o?.rootIndex);
  f(
    r !== void 0 && r.rootNote === o?.rootNote,
    "Bounce worker received a job outside its plan"
  );
  const a = globalThis.performance?.now?.() ?? Date.now(), s = await ee(e, t, r), c = s.performer;
  try {
    const u = t.outputLatencyFrames + t.holdFrames + t.tailCapFrames, p = new Float32Array(u * 2);
    for (const m of t.snapshot.rootSetupEvents) {
      const R = {
        ...m.value,
        [m.rootNoteField]: r.rootNote,
        ...m.sessionScoped ? { dspSessionId: r.sessionID } : {}
      };
      h(c, "sendInputEvent", m.endpointID)(R), I(c, m.advanceFrames, t.blockFrames);
    }
    h(c, "sendInputEvent", "midiIn")({
      message: w(144, r.rootNote, t.captureVelocity)
    }), _(c, p, 0, t.holdFrames, t.blockFrames), h(c, "sendInputEvent", "midiIn")({
      message: w(128, r.rootNote, 0)
    }), _(
      c,
      p,
      t.holdFrames,
      t.outputLatencyFrames + t.tailCapFrames,
      t.blockFrames
    );
    const l = p.subarray(t.outputLatencyFrames * 2), d = J(l, t.holdFrames, t), E = Q(l, d);
    f(
      E >= t.silenceThresholdLinear,
      `Bounce root ${r.rootNote} captured silence`
    );
    const g = new Int16Array(d * 2);
    for (let m = 0; m < g.length; m += 1)
      g[m] = B(l[m]);
    const b = (globalThis.performance?.now?.() ?? Date.now()) - a;
    return {
      rootIndex: r.rootIndex,
      rootNote: r.rootNote,
      noteOffFrameOffset: t.holdFrames,
      frameCount: d,
      tailFrameCount: d - t.holdFrames,
      peak: E,
      samples: g,
      metrics: {
        renderedFrameCount: u,
        elapsedMilliseconds: b,
        realtimeMultiplier: b > 0 ? u / (b * t.snapshot.sampleRate / 1e3) : null,
        // Generated Cmajor performers have fixed-size wasm memory. The
        // page count is reported before the short-lived worker exits so
        // browser soak tests can prove recursion does not grow an engine.
        wasmMemoryPages: X(c)
      }
    };
  } finally {
    s.dispose();
  }
}
async function ne(e, n) {
  if (e?.type !== "render-root")
    throw new Error("Bounce worker received an unsupported message");
  const t = await import(new URL(e.engineModuleURL, n).href), r = t.default ?? t.WavetableSynth, a = await te(r, e.plan, e.job);
  return {
    type: "render-root-complete",
    requestID: e.requestID,
    result: a
  };
}
function re(e) {
  return {
    name: e instanceof Error ? e.name : "Error",
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : void 0
  };
}
const F = self;
F.addEventListener("message", (e) => {
  const n = e.data;
  ne(n, F.location.href).then((o) => {
    F.postMessage(o, [o.result.samples.buffer]);
  }).catch((o) => {
    F.postMessage({
      type: "render-root-failed",
      requestID: n?.requestID,
      error: re(o)
    }, []);
  });
});
