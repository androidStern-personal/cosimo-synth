function k(t, e) {
  if (!t)
    throw new Error(e);
}
function Fe(t, e, n) {
  let i = "";
  for (let o = 0; o < n; o += 1)
    i += String.fromCharCode(t.getUint8(e + o));
  return i;
}
function _i(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function tt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Rn(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const i = Object.keys(t).slice(0, 6), o = i.length > 0 ? ` keys=${i.join(",")}` : "";
  return n ? `${e}:${n}${o}` : `${e}${o}`;
}
function Di() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ue(t, e) {
  const n = Di();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (_i(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Lt(t) {
  if (typeof t == "string")
    return t;
  if (t && typeof t.text == "function")
    return t.text();
  if (t instanceof ArrayBuffer)
    return typeof TextDecoder == "function" ? new TextDecoder().decode(new Uint8Array(t)) : String.fromCharCode(...new Uint8Array(t));
  if (ArrayBuffer.isView(t)) {
    const e = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
  }
  if (Array.isArray(t)) {
    const e = Uint8Array.from(t);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
  }
  throw new Error(`Unsupported text resource payload (${Rn(t)})`);
}
function ki(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return tt(t);
  throw new Error(`Unsupported binary resource payload (${Rn(t)})`);
}
function wi(t) {
  const e = t?.frames;
  k(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let o = 0; o < n.length; o += 1) {
    const r = n[o];
    if (typeof r == "number") {
      i[o] = r;
      continue;
    }
    if (ArrayBuffer.isView(r) || Array.isArray(r)) {
      const a = r;
      k(a.length === 1, "Only mono wavetable source files are supported"), i[o] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function An(t) {
  const e = new DataView(t);
  k(Fe(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), k(Fe(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, o = null, r = null, a = null, l = null, s = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const d = Fe(e, u, 4), h = e.getUint32(u + 4, !0), f = u + 8;
    d === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), o = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), r = e.getUint16(f + 14, !0)) : d === "data" && (l = f, s = h), u = f + h + h % 2;
  }
  k(n !== null, "Wave file is missing a fmt chunk"), k(l !== null && s !== null, "Wave file is missing a data chunk"), k(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && r === 32)
    c = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const d = s / 2, h = new Int16Array(t.slice(l, l + s));
    c = new Float32Array(d);
    for (let f = 0; f < d; f += 1)
      c[f] = h[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: o ?? 0,
    bitsPerSample: r,
    blockAlign: a ?? 0,
    samples: c
  };
}
async function Nt(t) {
  k(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return k(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function nt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function xn(t) {
  const e = new Uint8Array(t).buffer, n = An(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Li(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (k(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), o = async (s) => {
    k(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const u = await t.readResourceAsAudioData(s);
    return wi(u);
  }, r = (s) => {
    const u = t.getResourceAddress?.(s);
    return u ?? null;
  }, a = async (s, u = t.getResourceAddress?.(s)) => {
    const c = Ue(s, u), d = await Nt(c), h = An(d);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, l = async (s, u = t.getResourceAddress?.(s)) => {
    const c = Ue(s, u);
    return new Uint8Array(await Nt(c));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Lt(await i(s));
      const u = r(s);
      return e === "url" && u !== null ? nt(await l(s, u)) : typeof t.readResource == "function" ? Lt(await i(s)) : nt(await l(s, u));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? ki(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(s);
      const u = r(s);
      return n === "url" && u !== null ? a(s, u) : typeof t.readResourceAsAudioData == "function" ? o(s) : xn(await this.readBytes(s));
    },
    getURL(s) {
      return Ue(s, t.getResourceAddress?.(s));
    }
  };
}
function Ni(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Li(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Ci(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, o = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return nt(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return tt(await e(a));
      if (n)
        return tt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : xn(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function Pi(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Fi(t) {
  return Pi(t) ? Ci(t) : Ni(t);
}
const Re = 2048;
function ue(t, e) {
  if (!t)
    throw new Error(e);
}
function Ui(t) {
  ue(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    ue(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), ue(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), ue(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), ue(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Ki = 2048, Mn = 11, Bi = 256;
function N(t, e) {
  if (!t)
    throw new Error(e);
}
function Vi(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Ct = /* @__PURE__ */ new Map();
function $i(t) {
  const e = Ct.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let r = 0, a = o;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | a & 1, a >>= 1;
    i[o] = r;
  }
  return Ct.set(t, i), i;
}
function On(t, e, n = !1) {
  const i = t.length;
  N(i === e.length, "FFT real and imaginary buffers must have the same length"), N(Vi(i), "FFT input length must be a power of two");
  const o = $i(i);
  for (let r = 0; r < i; r += 1) {
    const a = o[r];
    if (a <= r)
      continue;
    const l = t[r];
    t[r] = t[a], t[a] = l;
    const s = e[r];
    e[r] = e[a], e[a] = s;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const a = r >> 1, l = (n ? 2 : -2) * Math.PI / r, s = Math.cos(l), u = Math.sin(l);
    for (let c = 0; c < i; c += r) {
      let d = 1, h = 0;
      for (let f = 0; f < a; f += 1) {
        const p = c + f, b = p + a, _ = t[b], C = e[b], L = d * _ - h * C, O = d * C + h * _, P = t[p], H = e[p];
        t[p] = P + L, e[p] = H + O, t[b] = P - L, e[b] = H - O;
        const F = d * s - h * u;
        h = d * u + h * s, d = F;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function _n(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    o[r] = (Number(e[r]) || 0) - i;
  return o;
}
function zi(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Ki,
  maxFramesPerTable: i = Bi
} = {}) {
  const o = Float32Array.from(t);
  N(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = o.length / n;
  N(r > 0, "Source wavetable files must contain at least one frame"), N(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && N(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, u = s + n;
    a.push(_n(o.slice(s, u)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function Pt(t) {
  const e = _n(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return On(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Hi(t, e, {
  mipLevelCount: n = Mn
} = {}) {
  const i = t?.real?.length ?? 0;
  N(i > 0, "Spectrum must contain real samples"), N(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), N(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, i >> 1), r = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= o; l += 1) {
    r[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return On(r, a, !0), Float32Array.from(r);
}
class Wi {
  connection;
  serviceFactories;
  services = [];
  started = !1;
  constructor(e, n) {
    this.connection = e, this.serviceFactories = n;
  }
  async start() {
    if (!this.started) {
      this.started = !0;
      try {
        for (const e of this.serviceFactories) {
          const n = typeof e == "function" ? await e(this.connection) : e;
          this.services.push(n), await n.start();
        }
      } catch (e) {
        const n = [];
        for (const i of [...this.services].reverse())
          try {
            await i.stop?.();
          } catch (o) {
            n.push(o);
          }
        throw this.services.length = 0, this.started = !1, n.length > 0 ? new AggregateError(
          [e, ...n],
          "Patch worker service startup failed and cleanup also failed"
        ) : e;
      }
    }
  }
  async stop() {
    if (this.started) {
      this.started = !1;
      for (const e of [...this.services].reverse())
        await e.stop?.();
      this.services.length = 0;
    }
  }
  getServices() {
    return [...this.services];
  }
}
function ji(t, e) {
  return new Wi(t, e);
}
async function qi(t, e) {
  const n = ji(t, e);
  return await n.start(), n;
}
const re = -100, xe = 35, Gi = 5, Qi = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Dn(t) {
  const e = Qi.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function D(t) {
  return Dn(t).laneEndpointID;
}
function Ji(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > Gi)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Dn(t).hostStem}${e}OutputTrimDb`;
}
function kn(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Xi(t) {
  const e = (kn(t, re, xe) - re) / (xe - re);
  return e * e;
}
function Yi(t) {
  const e = Math.sqrt(kn(t, 0, 1));
  return re + e * (xe - re);
}
const M = (t, e) => ({ label: t, value: e });
function U(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const K = Object.freeze({
  filter: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: U(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), m = (t, e, n, i, o, r, a, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: o,
  max: r,
  initial: a,
  step: l.step ?? (r - o) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear"),
  valueKind: l.valueKind,
  modulationIdentityEndpointID: l.modulationIdentityEndpointID,
  modulationDragStyle: l.modulationDragStyle
});
function B(t, e, n) {
  return m(
    t,
    e,
    "Output Trim",
    "Trim",
    re,
    xe,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const Zi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], er = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], tr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: K.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(M), quick: !0 }),
      m("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      m("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      m("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      B("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: K.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [M("Classic", 0), M("Harmonics", 1)] }),
      m("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      m("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      m("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      m("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      m("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      m("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [M("Symmetric", 0), M("Asymmetric", 1), M("Wavefold", 2)] }),
      B("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: K.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      m("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      m("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      m("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      m("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      m("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      B("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: K.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      m("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(M) }),
      m("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(M) }),
      m("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      m("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      m("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      m("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      m("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      B("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: K.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      m("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      m("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      m("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      m("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      m("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      B("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: K.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      m("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [M("Free", 0), M("Sync", 1)] }),
      m("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      m("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Zi.map(M) }),
      m("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      m("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      m("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      m("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      m("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      B("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: K.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      m("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [M("Free", 0), M("Sync", 1)] }),
      m("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      m("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: er.map(M) }),
      m("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      m("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      m("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      B("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: K.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      m("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      m("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      m("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      m("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      B("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Ne = tr, wn = Object.freeze(
  Ne.flatMap((t) => t.parameters)
);
new Map(
  wn.map((t) => [t.endpointID, t])
);
function Ln(t) {
  const e = Ne.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Nn() {
  return wn;
}
function ft(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const y = ["A", "B", "C"], Cn = [
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
], nr = [
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
], X = Object.freeze([
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
]), ir = Object.freeze([
  ...y.flatMap((t) => Cn.map(
    (e) => `osc${t}.${e}`
  )),
  ...nr
]);
new Set(
  y.flatMap((t) => Cn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Pn = Object.freeze(
  ir.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), rr = Nn().filter(
  (t) => t.modulationTargetIndex !== null
), or = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ht(t) {
  const e = ar(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function ar(t) {
  const e = or.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const sr = [
  ...rr.map((t) => ({
    kind: ht(ft(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Fn = Object.freeze(
  sr.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), z = Object.freeze([
  ...Pn,
  ...Fn
]), Ae = X.length, Un = Pn.length, Ce = Fn.length, lr = Ae * z.length, cr = new Map(X.map((t) => [t.id, t])), Kn = new Map(X.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), le = new Map(z.map((t) => [t.kind, t]));
function ur() {
  if (Ae !== 14 || Un !== 59 || Ce !== 47 || lr !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = X.filter((i) => i.group === t).sort((i, o) => i.runtimeIndex - o.runtimeIndex);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = z.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (cr.size !== Ae || Kn.size !== Ae || le.size !== z.length)
    throw new Error("Modulation identities must be unique");
}
ur();
function Bn(t, e) {
  const n = Kn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function pt(t) {
  return typeof t != "string" ? null : le.has(t) ? t : null;
}
function dr(t) {
  const e = pt(t);
  return e !== null && le.get(e)?.group === "voice" ? e : null;
}
function gt(t) {
  const e = pt(t);
  return e !== null && le.get(e)?.group === "rack" ? e : null;
}
function mr(t) {
  const e = le.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Vn(t) {
  const e = le.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function fr(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const $n = 4, hr = $n * Ce, pr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), gr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Y(t) {
  if (typeof t != "string")
    return null;
  const e = gr.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = pr.get(n);
  if (i === void 0)
    return null;
  const o = e[3];
  return i.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function It(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function zn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Hn(t) {
  if (t === null)
    return null;
  const e = zn(t) - 1;
  return e > $n ? null : e * Ce + Vn(It(t));
}
const $ = 2048, Ir = $ + 3, Ft = 20, Wn = "MSEG 1", yr = 0, q = 2, br = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function yt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function se(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Sr(t) {
  return yt(Number.isFinite(t) ? t : 0, -Ft, Ft);
}
function J(t) {
  return yt(Number.isFinite(t) ? t : 0, 0, 1);
}
function jn(t = Wn) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: t,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function it() {
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
function vr(t) {
  const e = Number(t);
  return yt(
    Number.isFinite(e) ? e : 1,
    yr,
    q
  );
}
function Tr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = J(Number(e.startX)), i = J(Number(e.endX));
  return se(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Er(t = it()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), o = e.noteOffPolicy, r = br.has(o) ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: vr(Number.isFinite(i) ? i : 1)
    },
    loop: Tr(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Rr(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let o = Number(i.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = J(o)), {
    x: o,
    y: J(Number(i.y)),
    curvePower: Sr(Number(i.curvePower))
  };
}
function pe(t = jn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((o, r) => Rr(o, r, n.length));
  if (!se(i[0].x, 0) || !se(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < i.length; o += 1)
    if (i[o].x < i[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Wn,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Ut(t) {
  return JSON.stringify(pe(t));
}
function Ar(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function xr(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: i, to: o, laterPointWins: !1 };
    if (se(e, o.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && se(t[r + 1].x, e); )
        r += 1;
      return {
        from: t[r],
        to: t[r],
        laterPointWins: !0
      };
    }
  }
  return {
    from: t[t.length - 1],
    to: t[t.length - 1],
    laterPointWins: !1
  };
}
function Mr(t, e) {
  const n = J(Number(e)), i = xr(t, n);
  if (i.laterPointWins || se(i.from.x, i.to.x))
    return i.to.y;
  const o = i.to.x - i.from.x, r = o <= 0 ? 1 : (n - i.from.x) / o, a = J(Ar(r, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Or(t, e) {
  return Mr(pe(t).points, e);
}
function _r(t) {
  const e = pe(t), n = new Float32Array($);
  for (let o = 0; o < $; o += 1) {
    const r = o / ($ - 1);
    n[o] = Or(e, r);
  }
  const i = new Float32Array(Ir);
  return i[0] = n[0], i.set(n, 1), i[$ + 1] = n[$ - 1], i[$ + 2] = n[$ - 1], i;
}
function Kt(t, e) {
  return Ut(t) === Ut(e);
}
const Ke = "modulationProgram", Dr = "modulationAmount", qn = X.filter((t) => t.group === "voice").length, Gn = X.filter((t) => t.group === "macro").length, Me = Un, kr = Ce, Oe = kr + hr, G = qn * Me, ee = Gn * Me, wr = qn * Oe, Lr = Gn * Oe, W = 512, Z = 256, Qn = G + ee;
function Nr(t) {
  const e = Bn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Cr(t) {
  const e = dr(t);
  return e === null ? null : mr(e);
}
function Jn(t) {
  const e = Cr(t.targetKind), n = gt(t.targetKind);
  let i = n === null ? void 0 : Vn(n);
  if (i === void 0) {
    const a = Hn(
      Y(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Bn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = a.runtimeIndex;
    if (e !== null) {
      const u = l * Me + e;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: l,
        targetIndex: e,
        articulationCellIndex: G + u
      };
    }
    const s = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * Oe + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const o = Nr(t);
  if (e !== null) {
    const a = o * Me + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: o,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const r = i ?? 0;
  return {
    path: "voiceRack",
    cellIndex: o * Oe + r,
    sourceIndex: o,
    targetIndex: r,
    articulationCellIndex: null
  };
}
function Xn(t) {
  return Y(t.targetKind) !== null ? null : Jn(t).articulationCellIndex;
}
function Pr(t) {
  if (gt(t.targetKind) !== null)
    return !1;
  const e = Y(t.targetKind);
  return e !== null && Hn(e) === null;
}
function Fr(t) {
  return {
    ...Jn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Yn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Pr(n))
      continue;
    const i = Fr(n), o = e[i.path];
    if (o.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    o.set(i.cellIndex, i);
  }
  return e;
}
function Ur(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function te(t) {
  return [...t.values()].filter(Ur).sort((e, n) => e.cellIndex - n.cellIndex);
}
function be(t, e, n, i, o) {
  for (let r = 0; r < t.length; r += 1) {
    const a = t[r];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${r}`);
    e[r] = a.cellIndex, n[r] = a.sourceIndex, i[r] = a.targetIndex, o[r] = a.polarity;
  }
}
function Be(t) {
  const e = Yn(t), n = te(e.voice), i = te(e.macroVoice), o = te(e.voiceRack), r = te(e.macroRack), a = Array.from({ length: G }, () => 0), l = Array.from({ length: G }, () => 0), s = Array.from({ length: G }, () => 0), u = Array.from({ length: G }, () => 0), c = Array.from({ length: G }, () => 0);
  be(n, a, l, s, u);
  const d = Array.from({ length: ee }, () => 0), h = Array.from({ length: ee }, () => 0), f = Array.from({ length: ee }, () => 0), p = Array.from({ length: ee }, () => 0), b = Array.from({ length: ee }, () => 0);
  if (be(
    i,
    d,
    h,
    f,
    p
  ), o.length > W || r.length > Z)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${W}), ${r.length} macro-rack (max ${Z})`
    );
  const _ = Array.from({ length: W }, () => 0), C = Array.from({ length: W }, () => 0), L = Array.from({ length: W }, () => 0), O = Array.from({ length: W }, () => 0), P = Array.from({ length: W }, () => 0), H = Array.from({ length: wr }, () => 0);
  be(
    o,
    _,
    C,
    L,
    O
  );
  const F = Array.from({ length: Z }, () => 0), Ot = Array.from({ length: Z }, () => 0), _t = Array.from({ length: Z }, () => 0), Dt = Array.from({ length: Z }, () => 0), kt = Array.from({ length: Lr }, () => 0);
  be(
    r,
    F,
    Ot,
    _t,
    Dt
  );
  for (const A of e.voice.values()) c[A.cellIndex] = A.amount;
  for (const A of e.macroVoice.values()) b[A.cellIndex] = A.amount;
  for (const A of e.voiceRack.values()) H[A.cellIndex] = A.amount;
  for (const A of e.macroRack.values()) kt[A.cellIndex] = A.amount;
  for (let A = 0; A < o.length; A += 1) {
    const wt = o[A];
    if (wt === void 0) throw new Error(`Missing compiled voice-rack route at index ${A}`);
    P[A] = wt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: u,
    voiceRouteAmounts: c,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: h,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: b,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: _,
    voiceRackRouteSources: C,
    voiceRackRouteTargets: L,
    voiceRackRoutePolarities: O,
    voiceRackRouteReducers: P,
    voiceRackRouteAmounts: H,
    macroRackRouteCount: r.length,
    macroRackRouteCells: F,
    macroRackRouteSources: Ot,
    macroRackRouteTargets: _t,
    macroRackRoutePolarities: Dt,
    macroRackRouteAmounts: kt
  };
}
const Kr = ["voice", "macroVoice", "voiceRack", "macroRack"], Br = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Bt(t) {
  return Yn(t);
}
function Vr(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function $r(t, e) {
  if (t === null)
    return [{ endpointID: Ke, value: Be(e) }];
  const n = Bt(t), i = Bt(e), o = [];
  for (const r of Kr) {
    const a = te(n[r]), l = te(i[r]);
    if (a.length !== l.length)
      return [{ endpointID: Ke, value: Be(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const u = a[s], c = l[s];
      if (u === void 0 || c === void 0 || !Vr(u, c))
        return [{ endpointID: Ke, value: Be(e) }];
      u.amount !== c.amount && o.push({
        endpointID: Dr,
        value: {
          pathKind: Br[r],
          cellIndex: c.cellIndex,
          amount: c.amount
        }
      });
    }
  }
  return o;
}
function ce(t) {
  return { _tag: "ok", value: t };
}
function he(t) {
  return { _tag: "err", error: t };
}
function zr(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Hr(t) {
  throw new Error(t ?? "Invariant violated");
}
const Wr = "globalTune", jr = "globalTuneSemitones", V = -24, de = 24, Vt = 0, Zn = -48, ei = 48, rt = -48, ti = 6, bt = 0, $t = (bt - rt) / (ti - rt), qr = "voiceEnhancerFrequency", Gr = "voiceEnhancerQ", Qr = "voiceEnhancerAmount", Jr = "voiceEnhancerFrequencyOctaves", Xr = "voiceEnhancerQ", Yr = "voiceEnhancerAmount", ni = "voice.enhancerFrequency", Zr = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: qr,
    targetKind: Jr,
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
    endpointID: Gr,
    targetKind: Xr,
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
    endpointID: Qr,
    targetKind: Yr,
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
function zt(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function eo(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Se(t, e, n, i, o = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: o, compound: r };
}
const to = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Se("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Se("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Se("mix", "Mix", 100, 100),
      Se("drive", "Drive", 15, 0)
    ]
  }
], Ht = 1e-6;
function w(t, e) {
  if (!Number.isFinite(t) || t < -Ht || t > 1 + Ht)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function _e(t, e) {
  return w(t / 100, `${e} catalog percentage`);
}
function ge(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function no(t) {
  return 20 * 1e3 ** t;
}
function io(t) {
  return w(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ro(t) {
  return 0.1 * 200 ** t;
}
function oo(t) {
  return w(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ao(t) {
  return t;
}
function so(t) {
  return w(t, "filterMix endpoint conversion");
}
function oe(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function lo(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: oe("filterCutoff", no, io),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: oe("filterQ", ro, oo),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: oe("filterMix", ao, so),
        // T05 scope: articulations do not own Mix yet — capturing it
        // would extend the persisted articulation schema.
        articulationParameterId: null,
        modulationTargetKind: "filterMix"
      };
    default:
      return {
        binding: {
          _tag: "unbacked",
          reason: e === "effects" ? "rack-dsp" : "no-endpoint"
        },
        articulationParameterId: null,
        modulationTargetKind: null
      };
  }
}
function ii(t) {
  switch (t) {
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
      return zr(t);
  }
}
function co(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function uo(t, e) {
  const n = ge(t.moduleId, e.id), i = ii(e.format), o = lo(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: _e(e.defaultPercent, n),
    initialValue: _e(e.initialPercent, n),
    format: i,
    modAmount: co(i),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const mo = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: $t * 100, defaultPercent: $t * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function fo(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ho(t, e) {
  const n = `osc${t}`, i = ge(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: _e(e.defaultPercent, i),
    initialValue: _e(e.initialPercent, i),
    format: ii(e.format),
    modAmount: fo(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const po = Object.freeze(
  y.flatMap((t) => mo.map((e) => ho(t, e)))
), go = Object.freeze({
  targetId: ge("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: w(
    (Vt - V) / (de - V),
    "Global Tune default"
  ),
  initialValue: w(
    (Vt - V) / (de - V),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: de },
  modAmount: {
    min: Zn,
    max: ei,
    unit: "st",
    digits: 2
  },
  binding: oe(
    Wr,
    (t) => V + (de - V) * t,
    (t) => w(
      (t - V) / (de - V),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: jr
});
function Io(t) {
  const e = ge("voice-enhancer", t.key), n = w(
    zt(t, t.initial),
    `${t.endpointID} initial value`
  );
  return Object.freeze({
    targetId: e,
    moduleId: "voice-enhancer",
    workspace: "voice",
    label: t.label,
    defaultValue: n,
    initialValue: n,
    format: t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : { kind: "percent" },
    modAmount: t.modulationApplication === "octaves" ? { min: -6, max: 6, unit: "oct", digits: 2 } : t.unit === "Q" ? { min: -9.9, max: 9.9, unit: "Q", digits: 2 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: oe(
      t.endpointID,
      (i) => eo(t, i),
      (i) => w(
        zt(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const yo = Object.freeze(
  Object.values(Zr).map(Io)
), bo = Object.freeze([
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
function So(t) {
  const e = ge(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, o = (r) => w(
    (r - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: o(t.initial),
    initialValue: o(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: oe(t.endpointID, i, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const vo = Object.freeze(
  bo.map(So)
), To = Object.freeze([
  { suffix: "low", label: "Low Crossover", kind: "lane.frequencySplit#1.xoverLowHz" },
  { suffix: "high", label: "High Crossover", kind: "lane.frequencySplit#1.xoverHighHz" }
].map(({ suffix: t, label: e, kind: n }) => Object.freeze({
  targetId: `frequency-split.${t}`,
  moduleId: "frequency-split",
  workspace: "effects",
  label: e,
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
function Eo(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ve(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? Xi(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return w(n, `${t.endpointID} endpoint conversion`);
}
function Ro(t, e) {
  return t.valueKind === "effect-output-trim-db" ? Yi(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ao(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function xo(t) {
  if (t.scale === "log")
    return { min: -6, max: 6, unit: "oct", digits: 2 };
  if (t.unit === "st") {
    const n = t.max - t.min;
    return { min: -n, max: n, unit: "st", digits: 2 };
  }
  if (t.unit === "dB") {
    const n = t.max - t.min;
    return { min: -n, max: n, unit: "dB", digits: 1 };
  }
  const e = t.max - t.min;
  return { min: -e, max: e, unit: "%", digits: e <= 2 ? 3 : 1 };
}
function Mo(t) {
  const e = Eo(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ve(t, t.initial),
    initialValue: Ve(t, t.initial),
    format: Ao(t),
    modAmount: xo(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ro(t, n),
      fromEngine: (n) => Ve(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ht(ft(t))
  });
}
const St = Object.freeze(
  [
    ...Ne.flatMap((t) => t.parameters.map(Mo)),
    ...To,
    go,
    ...yo,
    ...po,
    ...vo,
    ...to.flatMap(
      (t) => t.parameters.map(
        (e) => uo(t, e)
      )
    )
  ]
), Oo = new Map(
  St.map((t) => [t.targetId, t])
), ri = St.filter(
  (t) => t.modulationTargetKind !== null
), ot = new Map(
  ri.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Oo.size !== St.length)
  throw new Error("Target descriptor IDs must be unique");
if (ri.length !== z.length || ot.size !== z.length || z.some((t) => ot.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function $e(t) {
  const e = ot.get(t);
  return e === void 0 ? Hr(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Ne.map((t) => [t.id, t.label])
);
function _o(t) {
  const e = zn(t);
  return e === 1 ? "" : ` ${e}`;
}
function Do(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = $e(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Y(t);
  if (n !== null) {
    const i = $e(It(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${_o(n)} ${i.label.toUpperCase()}`;
  }
  return $e(t).label.toUpperCase();
}
const me = "modulation.v6", oi = 6, Ie = 3, ne = 3, ko = 4, Wt = "modulationMsegBuffer", wo = "modulationMsegPlayback", ai = 4, Lo = ["MSEG 1", "MSEG 2", "MSEG 3"], si = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], No = ["Env 1", "Env 2", "Env 3"], Co = 1e-3, S = 10, Po = 0.1, Fo = 20, jt = 10 - 0.1, Uo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Fo - Po },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Zn,
    max: ei
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
  mseg1Rate: { min: -q, max: q },
  mseg2Rate: { min: -q, max: q },
  mseg3Rate: { min: -q, max: q },
  env1Attack: { min: -S, max: S },
  env1Decay: { min: -S, max: S },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -S, max: S },
  env2Attack: { min: -S, max: S },
  env2Decay: { min: -S, max: S },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -S, max: S },
  env3Attack: { min: -S, max: S },
  env3Decay: { min: -S, max: S },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -S, max: S },
  ampAttack: { min: -S, max: S },
  ampDecay: { min: -S, max: S },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -S, max: S },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -jt, max: jt },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Ko = Nn().filter((t) => t.modulationTargetIndex !== null), Bo = new Map(
  Ko.map((t) => [
    ht(ft(t)),
    t
  ])
);
class ze extends Error {
  name = "ModulationStateParseError";
}
const Vo = {
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
X.map((t) => ({
  value: t.id,
  label: Vo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const $o = z.map((t) => ({
  value: t.kind,
  label: Do(t.kind)
}));
$o.filter((t) => !Ho(t.value));
function zo(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function vt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function He(t, e) {
  const n = Number(t);
  return vt(Number.isFinite(n) ? n : e, Co, S);
}
function Ho(t) {
  return gt(t) !== null;
}
function Wo(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function jo(t) {
  const e = Y(t);
  return e !== null ? It(e) : t;
}
function qo(t) {
  const e = jo(t);
  if (Y(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Bo.get(e);
  return n !== void 0 ? Wo(n) : Uo[fr(e)];
}
function Go(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Qo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Jo(t, e) {
  const n = qo(t), i = Number(e);
  return vt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function Xo(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Yo(t) {
  return Xo(t) ?? "mseg";
}
function Zo(t) {
  const e = pt(t);
  return e !== null ? e : Y(t) !== null ? t : null;
}
function ea(t) {
  return Zo(t) ?? "oscA.wavetablePosition";
}
function ta(t, e) {
  const n = si[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function na(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? Ie : t === "macro" ? ai : ko;
  return vt(Number.isFinite(n) ? n : 1, 1, i);
}
function ie(t) {
  return {
    name: No[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function li(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = ie(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: He(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: He(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: J(n.sustain ?? i.sustain),
    releaseSeconds: He(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function ia(t, e = 0) {
  return { name: li(t, e).name };
}
function ra(t, e, n, i) {
  const o = Number(t.amount);
  return {
    id: Go(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: na(n, t.sourceSlot),
    polarity: Qo(t.polarity),
    targetKind: i,
    amount: Jo(i, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function oa(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, o = Yo(i.sourceKind), r = ea(i.targetKind);
  return ra(i, e, o, r);
}
function aa(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function sa(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => oa(n, i));
}
function la(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const o = aa(i);
    if (e.has(i.id) || n.has(o))
      return !1;
    e.add(i.id), n.add(o);
  }
  return !0;
}
function at(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => at(a, e[l]));
  const n = t, i = e, o = Object.keys(n), r = Object.keys(i);
  return o.length === r.length && o.every((a) => zo(i, a) && at(n[a], i[a]));
}
function ci(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = jn(Lo[e] ?? `MSEG ${e + 1}`), o = pe(n.shapeA ?? i), r = Er({
    ...it(),
    ...n.playback ?? {},
    rate: it().rate
  }), { rate: a, ...l } = r;
  return {
    shapeA: o,
    shapeB: pe(n.shapeB ?? o),
    playback: l
  };
}
function st() {
  return {
    format: "cosimo.modulation",
    version: oi,
    msegSlots: Array.from({ length: Ie }, (t, e) => ci({}, e)),
    envelopeSlots: Array.from({ length: ne }, (t, e) => ({
      name: ie(e).name
    })),
    routes: [],
    macroNames: si.slice()
  };
}
function ca(t = st()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: oi,
    msegSlots: Array.from({ length: Ie }, (r, a) => ci(n[a], a)),
    envelopeSlots: Array.from({ length: ne }, (r, a) => ia(i[a], a)),
    routes: sa(e.routes),
    macroNames: Array.from(
      { length: ai },
      (r, a) => ta(o[a], a)
    )
  };
}
function qt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return he(new ze("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return he(new ze("Expected valid modulation JSON"));
    }
  }
  const n = ca(e);
  return !at(e, n) || !la(n.routes) ? he(new ze("Expected the current modulation schema")) : ce(n);
}
function ua(t, e) {
  return {
    slot: t + 1,
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function Gt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(_r(n))
  };
}
function da(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function ma(t, e = null) {
  const n = [];
  for (let i = 0; i < Ie; i += 1) {
    const o = t.msegSlots[i], r = e?.msegSlots[i];
    (r === void 0 || !Kt(r.shapeA, o.shapeA)) && n.push({
      endpointID: Wt,
      value: Gt(i, 0, o.shapeA)
    }), (r === void 0 || !Kt(r.shapeB, o.shapeB)) && n.push({
      endpointID: Wt,
      value: Gt(i, 1, o.shapeB)
    }), (r === void 0 || !da(r.playback, o.playback)) && n.push({
      endpointID: wo,
      value: ua(i, o.playback)
    });
  }
  return n.push(...$r(e?.routes ?? null, t.routes)), n;
}
const We = "articulationSnapshot", v = 128, Qt = 48, fa = 1e6, R = -1, je = [
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
function Tt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function qe(t) {
  return Tt(Number.isFinite(t) ? t : 0, 0, 1);
}
function x(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const o = Number(t);
  return Tt(Number.isFinite(o) ? o : e, n, i);
}
function E(t, e, n, i) {
  return Tt(Math.round(x(t, e)), n, i);
}
function ui(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Ge() {
  return Array.from({ length: v }, () => R);
}
function ha(t) {
  const e = E(t, 0, 0, v - 1), n = je[e % je.length], i = Math.floor(e / je.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function pa() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: bt,
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
function ga(t) {
  const e = pa(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: x(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: x(n.pan, e.pan, -1, 1),
    octave: E(n.octave, e.octave, -4, 4),
    semitone: E(n.semitone, e.semitone, -12, 12),
    fineCents: x(n.fineCents, e.fineCents, -100, 100),
    volumeDb: x(
      n.volumeDb,
      e.volumeDb,
      rt,
      ti
    ),
    mute: E(n.mute, e.mute, 0, 1),
    solo: E(n.solo, e.solo, 0, 1),
    warpMode: E(n.warpMode, e.warpMode, 0, 4),
    warpAmount: x(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: E(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: x(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: x(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: x(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: E(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: x(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: x(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: x(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: x(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: x(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: E(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: E(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: E(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: x(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: x(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      qe(Number(i[0])),
      qe(Number(i[1])),
      qe(Number(i[2]))
    ]
  };
}
function Ia(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: x(e.amount, 0, -48, 48)
  } : null;
}
function ya(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Ia).filter((o) => o !== null) : [], i = /* @__PURE__ */ new Map();
  for (const o of n)
    i.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: ga(e.parameters),
    envelopes: [0, 1, 2].map((o) => li(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...i.values()]
  };
}
function ba(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = E(n.runtimeSlot, e, 0, v - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, r = typeof n.name == "string" && n.name.trim() ? n.name.trim() : ha(i);
  return {
    id: o,
    runtimeSlot: i,
    name: r,
    snapshot: ya(n.snapshot)
  };
}
function Sa(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: E(n.note, 0, 0, v - 1),
    articulationId: i
  } : null;
}
function va(t, e, n, i, o) {
  if (!t || typeof t != "object")
    return null;
  const r = t, a = typeof r.articulationId == "string" ? r.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let l = E(r.min, o, o, v - 1), s = E(r.max, l, o, v - 1);
  return s < l && ([l, s] = [s, l]), {
    id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: l,
    max: s
  };
}
function Jt(t, e, n, i) {
  const o = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < o.length; l += 1) {
    const s = va(
      o[l],
      e,
      l,
      n,
      i
    );
    !s || r.has(s.id) || (r.add(s.id), a.push(s));
  }
  return a;
}
function Ta(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), o = [];
  for (const r of n) {
    const a = Sa(r, e);
    !a || i.has(a.note) || (i.add(a.note), o.push(a));
  }
  return o;
}
function Ea(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), r = [];
  for (let s = 0; s < n.length && r.length < v; s += 1) {
    const u = ba(n[s], s);
    !u || i.has(u.runtimeSlot) || o.has(u.id) || (i.add(u.runtimeSlot), o.add(u.id), r.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && r.some((s) => s.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(r.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ui(e.activeTriggerMode),
    slots: r,
    chainAssignments: Jt(e.chainAssignments, l, "chain", 0),
    keyAssignments: Ta(e.keyAssignments, l),
    velocityAssignments: Jt(e.velocityAssignments, l, "velocity", 1)
  };
}
function Xt(t) {
  const e = (n) => y.map(() => n);
  return {
    selectorA: t,
    enabled: !1,
    oscillatorOverrideMasks: e(0),
    sharedOverrideMask: 0,
    framePositions: e(0),
    pans: e(0),
    octaves: e(0),
    semitones: e(0),
    fineCents: e(0),
    phases: e(0),
    phaseRandoms: e(0),
    retriggers: e(1),
    volumeDbs: e(bt),
    mutes: e(0),
    solos: e(0),
    warpModes: e(0),
    warpAmounts: e(0),
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterKeyTrackOffsetSemitones: 0,
    filterQ: 0.707107,
    unisonVoices: e(1),
    unisonDetunes: e(0.1),
    unisonBlends: e(0.75),
    unisonWidths: e(1),
    unisonDetuneModes: e(0),
    unisonStackModes: e(0),
    unisonWavetablePositionSpreads: e(0),
    unisonWarpSpreads: e(0),
    msegMorphs: Array.from({ length: Ie }, () => 0),
    routeAmounts: Array.from({ length: Qn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: ne }, (n, i) => ie(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: ne }, (n, i) => ie(i).decaySeconds),
    envelopeSustain: Array.from({ length: ne }, (n, i) => ie(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: ne }, (n, i) => ie(i).releaseSeconds)
  };
}
function Yt(t, e, n) {
  for (const i of e) {
    const o = n.get(i.articulationId);
    if (o !== void 0)
      for (let r = i.min; r <= i.max; r += 1)
        t[r] === R && (t[r] = o);
  }
}
function Ra(t) {
  const e = Ea(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = Ge(), o = Ge(), r = Ge();
  Yt(i, e.chainAssignments, n), Yt(r, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const l = n.get(a.articulationId);
    l === void 0 || o[a.note] !== R || (o[a.note] = l);
  }
  return r[0] = R, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: o,
    velocity: r
  };
}
function Aa(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Ra(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ui(e.activeMode),
    chain: Array.from({ length: v }, (n, i) => E(e.chain?.[i], R, R, v - 1)),
    key: Array.from({ length: v }, (n, i) => E(e.key?.[i], R, R, v - 1)),
    velocity: Array.from({ length: v }, (n, i) => i === 0 ? R : E(e.velocity?.[i], R, R, v - 1))
  });
}
function xa(t, e) {
  const n = Aa(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const fe = "articulations.v4", Et = [
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
], Rt = [
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
], Ma = [
  ...y.flatMap((t) => Et.map(
    (e) => `osc${t}.${e}`
  )),
  ...Rt
];
class di extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function g(t) {
  return he(new di("malformed", t));
}
function ye(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function At(t, e, n) {
  const i = new Set(e);
  for (const o of e)
    if (!Object.hasOwn(t, o))
      return `${n} is missing field "${o}"`;
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return `${n} has a non-string field key`;
    if (!i.has(o))
      return `${n} has unexpected field "${o}"`;
  }
  return null;
}
function De(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < v;
}
function Oa(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function _a(t) {
  return Ma.some((e) => e === t);
}
function Zt(t, e) {
  if (!ye(t))
    return g(`${e} must be an object`);
  const n = At(t, ["min", "max"], e);
  return n !== null ? g(n) : De(t.min) ? De(t.max) ? t.min > t.max ? g(`${e}.min must be less than or equal to ${e}.max`) : ce({ min: t.min, max: t.max }) : g(`${e}.max must be an integer in 0..127`) : g(`${e}.min must be an integer in 0..127`);
}
function Da(t, e) {
  if (!ye(t))
    return g(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return g(`${e} has a non-string parameter id`);
    if (!_a(i))
      return g(`${e} has unknown parameter id "${i}"`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o))
      return g(`${e}.${i} must be a finite number`);
    n[i] = o;
  }
  return ce(n);
}
function ka(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function wa() {
  return {};
}
function La(t, e, n) {
  if (!ye(t))
    return g(`${e} must be an object`);
  const i = wa();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return g(`${e} has a non-string route id`);
    const r = t[o];
    if (typeof r != "number" || !Number.isFinite(r) || Math.abs(r) > Qt)
      return g(
        `${e}.${o} must be a finite route amount within ±${Qt}`
      );
    if (!n.has(o))
      return g(`${e}.${o} does not name a current articulable mapping`);
    ka(i, o, r);
  }
  return ce(i);
}
function Na(t, e, n) {
  const i = `slots[${e}]`;
  if (!ye(t))
    return g(`${i} must be an object`);
  const o = At(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (o !== null)
    return g(o);
  if (typeof t.id != "string")
    return g(`${i}.id must be a string`);
  if (!De(t.runtimeSlot))
    return g(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return g(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return g(`${i}.color must be a string`);
  if (!De(t.key))
    return g(`${i}.key must be an integer in 0..127`);
  const r = Zt(t.velRange, `${i}.velRange`);
  if (r._tag === "err")
    return r;
  const a = Zt(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = Da(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = La(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : ce({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: r.value,
    chainRange: a.value,
    overrides: l.value,
    routeAmounts: s.value
  });
}
const Ca = Object.fromEntries(
  Et.map((t, e) => [t, 2 ** e])
), Pa = Object.fromEntries(
  Rt.map((t, e) => [t, 2 ** e])
);
function en(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Fa(t, e) {
  return Et.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | Ca[i] : n, 0);
}
function Ua(t) {
  return Rt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Pa[n] : e, 0);
}
function Ka(t, e) {
  const n = (r, a) => en(t, `osc${r}.${a}`), i = (r) => en(t, r), o = Array.from(
    { length: Qn },
    () => fa
  );
  for (const [r, a] of Object.entries(t.routeAmounts)) {
    const l = e[r];
    l !== void 0 && (o[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: y.map((r) => Fa(t, r)),
    sharedOverrideMask: Ua(t),
    framePositions: y.map((r) => n(r, "framePosition")),
    pans: y.map((r) => n(r, "pan")),
    octaves: y.map((r) => n(r, "octave")),
    semitones: y.map((r) => n(r, "semitone")),
    fineCents: y.map((r) => n(r, "fineCents")),
    phases: y.map((r) => n(r, "phase")),
    phaseRandoms: y.map((r) => n(r, "phaseRandom")),
    retriggers: y.map((r) => n(r, "retrigger")),
    volumeDbs: y.map((r) => n(r, "volumeDb")),
    mutes: y.map((r) => n(r, "mute")),
    solos: y.map((r) => n(r, "solo")),
    warpModes: y.map((r) => n(r, "warpMode")),
    warpAmounts: y.map((r) => n(r, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: i("filterKeyTrackOffsetSemitones"),
    filterQ: i("filterQ"),
    unisonVoices: y.map((r) => n(r, "unisonVoices")),
    unisonDetunes: y.map((r) => n(r, "unisonDetune")),
    unisonBlends: y.map((r) => n(r, "unisonBlend")),
    unisonWidths: y.map((r) => n(r, "unisonWidth")),
    unisonDetuneModes: y.map((r) => n(r, "unisonDetuneMode")),
    unisonStackModes: y.map((r) => n(r, "unisonStackMode")),
    unisonWavetablePositionSpreads: y.map((r) => n(r, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: y.map((r) => n(r, "unisonWarpSpread")),
    msegMorphs: [
      i("msegMorph1"),
      i("msegMorph2"),
      i("msegMorph3")
    ],
    routeAmounts: o,
    envelopeAttackSeconds: [
      i("env1.attackSeconds"),
      i("env2.attackSeconds"),
      i("env3.attackSeconds")
    ],
    envelopeDecaySeconds: [
      i("env1.decaySeconds"),
      i("env2.decaySeconds"),
      i("env3.decaySeconds")
    ],
    envelopeSustain: [
      i("env1.sustain"),
      i("env2.sustain"),
      i("env3.sustain")
    ],
    envelopeReleaseSeconds: [
      i("env1.releaseSeconds"),
      i("env2.releaseSeconds"),
      i("env3.releaseSeconds")
    ]
  };
}
function Ba(t, e) {
  return t.slots.map((n) => Ka(n, e));
}
function Va(t, e) {
  if (!ye(t))
    return g("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return g('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return he(new di(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = At(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return g(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return g("selectedSlotId must be null or a string");
  if (!Oa(t.activeTriggerMode))
    return g('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return g("slots must be an array");
  if (t.slots.length > v)
    return g(`slots must contain at most ${v} entries`);
  const i = [], o = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = Na(t.slots[a], a, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (o.has(s.id))
      return g(`slots[${a}].id duplicates "${s.id}"`);
    if (r.has(s.runtimeSlot))
      return g(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    o.add(s.id), r.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? g(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : ce({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function mi() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function $a(t) {
  const e = Array.from({ length: v }, () => R), n = Array.from({ length: v }, () => R), i = Array.from({ length: v }, () => R);
  for (const o of t.slots) {
    n[o.key] === R && (n[o.key] = o.runtimeSlot);
    for (let r = o.chainRange.min; r <= o.chainRange.max; r += 1)
      e[r] === R && (e[r] = o.runtimeSlot);
    for (let r = o.velRange.min; r <= o.velRange.max; r += 1)
      i[r] === R && (i[r] = o.runtimeSlot);
  }
  return i[0] = R, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const lt = "runtimeState";
function fi(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const za = {
  endpointID: lt,
  required: !0,
  mapValue: fi
}, tn = "runtimeInstallAck", Ha = "runtimeSyncRequest", nn = 0, Wa = 8e3, ke = /* @__PURE__ */ new WeakMap(), hi = 1e9;
let ve = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % hi;
function ja(t) {
  return ve = ve % hi + 1, t === "modulation" ? -1e9 - ve : 1e9 + ve;
}
function qa(t, e) {
  const n = t, i = ke.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), ke.set(n, i);
}
function rn(t, e) {
  const n = t, i = ke.get(n);
  i?.delete(e), i?.size === 0 && ke.delete(n);
}
const Ga = [100, 250, 500, 1e3], Te = { _tag: "accepted" }, Qa = { _tag: "superseded" }, Ja = { _tag: "stopped" }, on = { _tag: "transport-timeout" };
function Xa(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, o = i.dspSessionId, r = i.acceptedModulationSerial, a = i.acceptedArticulationSerial, l = i.rejectedSerial, s = i.rejectionReason, u = i.syncSerial;
  return ![
    o,
    r,
    a,
    l,
    s,
    u
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof o != "number" || typeof r != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof u != "number" || o < 0 || r < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: r,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: u
  };
}
function Ya(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class an {
  #o;
  #e;
  #d;
  #S;
  #m = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #r = /* @__PURE__ */ new Map();
  #u = 0;
  #i = !1;
  #a = 0;
  #f = /* @__PURE__ */ new Set();
  #v = this.#O.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#d = i && i.length > 0 ? i : [...Ga], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Wa)
    );
  }
  start() {
    if (!this.#i) {
      qa(this.#o, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(tn, this.#v);
      } catch (e) {
        throw this.#i = !1, rn(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(tn, this.#v), rn(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#b());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#r.clear(), this.#a += 1, this.#b());
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
    const e = this.#t, n = this.#u;
    return this.#i ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
    if (!this.#i)
      return {
        _tag: "unavailable",
        reason: "not-started"
      };
    if (this.#m)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#m = !0;
    const n = this.#t, i = this.#u;
    try {
      const o = await this.#T(
        n,
        i
      );
      if (o._tag !== "accepted")
        return o;
      let r = null;
      for (const a of e) {
        const l = await this.#M(
          a,
          n,
          i
        );
        if (l._tag === "rejected" && this.#e === "articulation") {
          r ??= l;
          continue;
        }
        if (l._tag !== "accepted")
          return l;
      }
      return r ?? Te;
    } finally {
      this.#m = !1;
    }
  }
  #R(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #A(e, n) {
    const i = this.#R(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#s === e)
      return Te;
    const i = ja(this.#e);
    this.#l.add(i);
    const o = Date.now() + this.#S;
    let r = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return Te;
        const l = o - Date.now();
        if (l <= 0)
          return on;
        const s = this.#a;
        this.#I(i), await this.#y(
          s,
          Math.min(this.#g(r), l)
        ), r += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const o = this.#x(), r = Ya(e.value, n, o);
    let a = 0, l = 0, s = this.#c;
    for (this.#E(e.endpointID, r); ; ) {
      const u = this.#p(n, i);
      if (u)
        return u;
      const c = this.#h(n, o, s);
      if (c !== null)
        return c;
      const d = this.#a;
      await this.#y(
        d,
        this.#g(a)
      );
      const h = this.#h(
        n,
        o,
        s
      );
      if (h !== null)
        return h;
      let f = this.#a;
      for (this.#I(o); ; ) {
        const p = this.#p(n, i);
        if (p)
          return p;
        const b = await this.#y(
          f,
          this.#g(a)
        ), _ = this.#h(
          n,
          o,
          s
        );
        if (_ !== null)
          return _;
        if (b && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
          if (l >= 1)
            return on;
          s = this.#c, this.#E(e.endpointID, r), l += 1, a += 1;
          break;
        }
        if (b) {
          f = this.#a;
          continue;
        }
        b || (a += 1, f = this.#a, this.#I(o));
      }
    }
  }
  #h(e, n, i) {
    const o = this.#n;
    if (!o || o.dspSessionId !== e)
      return null;
    const r = this.#r.get(n);
    return r !== void 0 && r.version > i && r.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...r.acknowledgement }
    }) : this.#A(o, n) ? (this.#r.delete(n), Te) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Ja : this.#t !== e ? Qa : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #E(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        nn
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          Ha,
          e,
          void 0,
          nn
        );
      } catch {
      }
  }
  #O(e) {
    const n = Xa(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#s = n.dspSessionId), this.#n = n, this.#c += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#r.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#c
      }); this.#r.size > 16; ) {
        const o = this.#r.keys().next().value;
        if (o === void 0) break;
        this.#r.delete(o);
      }
    this.#a += 1, this.#b();
  }
  #y(e, n) {
    return !this.#i || this.#a !== e ? Promise.resolve(!0) : new Promise((i) => {
      let o = !1;
      const r = {
        finish: (a) => {
          o || (o = !0, r.timeoutHandle !== null && clearTimeout(r.timeoutHandle), this.#f.delete(r), i(a));
        },
        timeoutHandle: null
      };
      r.timeoutHandle = setTimeout(() => r.finish(!1), n), this.#f.add(r);
    });
  }
  #b() {
    for (const e of [...this.#f])
      e.finish(!0);
  }
}
const Za = 1e3, Qe = [me, fe];
function sn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Je(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (sn(i, e)) return i[e];
  if (sn(n, e)) return n[e];
}
function Xe(t, e) {
  if (t === void 0) return mi();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Va(n, e);
  return i._tag === "ok" ? i.value : null;
}
function ln(t) {
  return new Set(t.routes.flatMap((e) => Xn(e) === null ? [] : [e.id]));
}
function cn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class es {
  constructor(e) {
    this.connection = e, this.modulationLane = new an(e, { laneKind: "modulation" }), this.articulationLane = new an(e, { laneKind: "articulation" });
  }
  modulationState = st();
  articulationBank = mi();
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
    { length: v },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(lt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(lt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(e) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || e !== this.lifecycleEpoch || (this.applyBootState(n), this.finishBoot());
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.pendingBootKeys = /* @__PURE__ */ new Map();
      for (const n of Qe) this.connection.requestStoredStateValue(n);
      return;
    }
    this.applyBootState({}), this.finishBoot();
  }
  finishBoot() {
    const e = this.bootEvents.splice(0);
    this.bootPending = !1, this.pendingBootKeys = null;
    for (const n of e) this.applyLiveStoredState(n.key, n.value);
    this.applyRuntimeStateIfReady();
  }
  applyBootState(e) {
    const n = Je(e, me), i = n === void 0 ? { _tag: "ok", value: st() } : qt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${me} is invalid; boot state was not installed.`);
      const a = Je(e, fe), l = Xe(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const o = Je(e, fe), r = Xe(
      o,
      ln(i.value)
    );
    if (r === null) {
      console.error(`[runtime-state-worker] ${fe} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Qe.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Qe.length) {
            const i = Object.fromEntries(this.pendingBootKeys);
            this.applyBootState(i), this.finishBoot();
          }
          return;
        }
        this.bootEvents.push({ key: n.key, value: n.value });
        return;
      }
      this.applyLiveStoredState(n.key, n.value);
    }
  }
  applyLiveStoredState(e, n) {
    if (e === me) {
      const o = qt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${me}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Xe(n, ln(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${fe}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = fi(e);
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
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.deliverRuntimeState().catch((e) => {
        console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", e), this.scheduleRecovery(), this.finishDelivery();
      });
    }
  }
  async deliverRuntimeState() {
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, o = this.lastAppliedModulationGeneration !== e, r = ma(
      n,
      o ? null : this.lastAppliedModulationState
    ), a = await this.modulationLane.sendBatch(r);
    if (!this.acceptOutcome("modulation", a, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = e, this.desiredStateChanged(e, n, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(n, i), s = Array.from({ length: v }, (f, p) => {
      const b = l.get(p);
      return b ? cn(b) : null;
    }), u = this.lastAppliedArticulationGeneration !== e, c = u && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let f = 0; f < v; f += 1) {
      const p = l.get(f), b = s[f] !== this.lastAppliedArticulationTokens[f];
      c ? d.push({
        endpointID: We,
        value: p ?? Xt(f)
      }) : u ? p && d.push({ endpointID: We, value: p }) : b && d.push({
        endpointID: We,
        value: p ?? Xt(f)
      });
    }
    const h = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", h, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, xa(
      $a(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((o) => {
      const r = Xn(o);
      return r === null ? [] : [[o.id, r]];
    }));
    return new Map(
      Ba(n, i).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = cn(i), r = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), r && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Za));
  }
  clearRecoveryTimer() {
    this.recoveryTimer !== null && (clearTimeout(this.recoveryTimer), this.recoveryTimer = null);
  }
  finishDelivery() {
    if (this.deliveryInProgress = !1, !this.started) return;
    const e = this.deliveryRefreshPending;
    this.deliveryRefreshPending = !1, e && this.applyRuntimeStateIfReady();
  }
}
function ts(t) {
  return new es(t);
}
const pi = 13, xt = 5, gi = 8, ns = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Mt = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    D("globalFilter")
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
    D("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    D("ott")
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
    D("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    D("flanger")
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
    D("phaser")
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
    D("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    D("reverb")
  ]
}), Ii = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), is = Object.freeze([
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
]), rs = Object.freeze({
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
function os(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function yi(t, e) {
  const n = {};
  for (const l of Mt[t]) {
    const s = e[l];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[l] = s;
      continue;
    }
    const u = rs[l];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${l}`);
    n[l] = u;
  }
  const o = [
    ...Ii.chorus,
    D("chorus")
  ], r = Object.keys(e);
  return t === "chorus" && r.length === o.length && r.every((l) => o.includes(l)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = os(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function bi(t) {
  return Mt[t];
}
function as(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= xt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * gi + ns[t];
}
function ss(t, e) {
  const n = new Array(pi).fill(0), i = yi(t, e);
  return Mt[t].forEach((o, r) => {
    n[r] = i[o];
  }), n;
}
const ls = "lane.v1", cs = "laneTopology", un = "laneSlotParams", us = "laneOutputControl", ct = 16, ds = 8, Si = 4, ms = 3, vi = xt * gi, Ti = 4, fs = 4, hs = vi, ps = vi + Ti, gs = 0, Is = 1, ys = 2, bs = 3, Ss = 4, vs = 5;
function Ts(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Si)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << ds;
}
const we = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Le = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Ei = new Map(
  Object.entries(Le).map(([t, e]) => [e, t])
), Es = Object.freeze({
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
  we.map((t) => [Es[t], t])
);
const Rs = Object.freeze([
  "voice.filterCutoff",
  ni,
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
]), As = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ni]: "enhancer-frequency",
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
  Rs.map((t) => [t, Object.freeze({
    id: t,
    family: As[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ri = 40, Ai = 18e3, ut = we.map((t) => Le[t]), xs = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ms = /^(parallel|split)#([1-9][0-9]*)$/;
function Pe(t) {
  if (typeof t != "string")
    return null;
  const e = xs.exec(t);
  if (e === null)
    return null;
  const n = ut.find((o) => o === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > xt ? null : { deviceType: n, instanceNumber: i };
}
function xi(t) {
  if (typeof t != "string")
    return null;
  const e = Ms.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Ti : fs) ? null : { groupKind: n, unitNumber: i };
}
function Q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function ae(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function I(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Os(t, e) {
  const n = Pe(t);
  if (n === null)
    return { failure: I(`device id ${t} is not a pool instance`) };
  if (!Q(e) || !ae(e, ["params"]) || !Q(e.params))
    return { failure: I(`device ${t} must be { params }`) };
  const i = bi(n.deviceType), o = Ei.get(n.deviceType);
  if (o === void 0)
    return { failure: I(`device ${t} has no effect descriptor`) };
  const r = Ln(o).parameters.map((f) => f.endpointID), a = e.params, l = Object.keys(a), s = (f) => l.length === f.length && l.every((p) => f.includes(p)), u = D(n.deviceType), c = [
    ...Ii[n.deviceType],
    u
  ], d = [
    ...is,
    u
  ];
  if (!(l.includes(u) && (s(i) || s(r) || s(c) || n.deviceType === "chorus" && s(d))))
    return { failure: I(`device ${t} must carry every parameter once`) };
  for (const f of l) {
    const p = a[f];
    if (typeof p != "number" || !Number.isFinite(p))
      return { failure: I(`device ${t}.${f} must be a finite number`) };
  }
  return { record: { params: yi(n.deviceType, a) } };
}
function _s(t, e) {
  return !Q(t) || t.kind !== "device" ? { failure: I("branches may hold device placements only") } : ae(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: I(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: I(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: I("a device placement is { kind, deviceId, enabled }") };
}
function dn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Ri && t <= Ai;
}
function Mi() {
  return { mix: 1, bypassed: !1 };
}
function Ds(t) {
  return !Q(t) || !ae(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function ks(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return I(`is not valid JSON: ${d}`);
    }
  if (!Q(e) || !ae(e, ["format", "version", "output", "devices", "chain"]))
    return I("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return I("must be cosimo.lane version 2");
  if (!Q(e.devices))
    return I("devices must be an object");
  if (!Array.isArray(e.chain))
    return I("chain must be an array");
  const n = Ds(e.output);
  if (n === null)
    return I("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return I("device ids must be strings");
    const d = Os(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    i[c] = d.record;
  }
  const o = new Set(Object.keys(i)), r = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), l = [];
  let s = 0;
  const u = (c) => {
    const d = _s(c, o);
    return "placement" in d && (r.set(
      d.placement.deviceId,
      (r.get(d.placement.deviceId) ?? 0) + 1
    ), s += 1), d;
  };
  for (const c of e.chain) {
    if (!Q(c))
      return I("chain nodes must be objects");
    if (c.kind === "device") {
      const O = u(c);
      if ("failure" in O)
        return O.failure;
      l.push(O.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return I(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", h = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], b = d && ae(c, h);
    if (!ae(c, p) && !b)
      return I(`a ${c.kind} group is { ${p.join(", ")} }`);
    const _ = xi(c.groupId);
    if (_ === null || _.groupKind !== c.kind)
      return I(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return I(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return I(`group ${String(c.groupId)} needs a boolean enable`);
    const C = d ? ms : Si;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > C)
      return I(`group ${String(c.groupId)} needs 2..${C} branches`);
    if (d && (!dn(c.xoverLowHz) || !dn(c.xoverHighHz)))
      return I(`group ${String(c.groupId)} crossovers must sit in ${Ri}..${Ai} Hz`);
    if (d && !b && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return I(`group ${String(c.groupId)} Key Track state must be finite`);
    s += 1;
    const L = [];
    for (const O of c.branches) {
      if (!Array.isArray(O))
        return I(`group ${String(c.groupId)} branches must be arrays`);
      const P = [];
      for (const H of O) {
        const F = u(H);
        if ("failure" in F)
          return F.failure;
        P.push(F.placement);
      }
      L.push(P);
    }
    l.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: b ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: b ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: b ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: b ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: L
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: L
    });
  }
  for (const c of o)
    if ((r.get(c) ?? 0) !== 1)
      return I(`device ${c} must be placed exactly once`);
  return s > ct ? I(`flattens to ${s} wire entries; the topology upload holds ${ct}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: l } };
}
function ws() {
  const t = {};
  for (const e of we) {
    const n = Le[e];
    t[`${n}#1`] = {
      params: Ks(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Mi(),
    devices: t,
    chain: we.map((e) => ({
      kind: "device",
      deviceId: `${Le[e]}#1`,
      enabled: !1
    }))
  };
}
const mn = ["distortion#1", "delay#1", "reverb#1"];
function Ls() {
  const t = ws(), e = {};
  for (const n of mn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Mi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && mn.includes(n.deviceId))
  };
}
function Ns(t) {
  if (t === void 0)
    return Ls();
  const e = ks(t);
  return e._tag === "ok" ? e.value : null;
}
function Cs(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Pe(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => ut.indexOf(e.parsed.deviceType) - ut.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function dt(t) {
  const e = Pe(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return as(e.deviceType, e.instanceNumber - 1);
}
function Oi(t) {
  const e = xi(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? hs : ps) + (e.unitNumber - 1);
}
function Ps(t) {
  const e = new Array(ct).fill(0);
  let n = 0, i = 0;
  const o = (r, a, l) => {
    e[i] = Ts(r, a), l && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      o(dt(r.deviceId), 0, r.enabled);
      continue;
    }
    o(Oi(r), r.branches.length, r.enabled), r.branches.forEach((a, l) => {
      for (const s of a)
        o(dt(s.deviceId), l + 1, s.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function Fs(t) {
  const e = new Array(pi).fill(0);
  return e[gs] = t.xoverLowHz, e[Is] = t.xoverHighHz, e[ys] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[bs] = t.xoverLowKeyTrackOffsetSemitones, e[Ss] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[vs] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Us(t) {
  const e = [{
    endpointID: us,
    value: t.output
  }];
  let n = 0;
  for (const i of Cs(t)) {
    const o = Pe(i.instanceId);
    if (o === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: Ji(
        o.deviceType,
        o.instanceNumber
      ),
      value: t.devices[i.instanceId].params[D(o.deviceType)]
    }), n += 1, e.push({
      endpointID: un,
      value: {
        slotId: dt(i.instanceId),
        deliverySerial: n,
        values: ss(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: un,
      value: {
        slotId: Oi(i),
        deliverySerial: n,
        values: Fs(i)
      }
    }));
  return e.push({
    endpointID: cs,
    value: Ps(t)
  }), e;
}
function Ks(t) {
  const e = Ei.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = Ln(e).parameters;
  return Object.fromEntries(bi(t).map((i) => [
    i,
    n.find((o) => o.endpointID === i)?.initial ?? 0
  ]));
}
const Bs = 2e3;
function fn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Vs(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return fn(i, e) ? {
    found: !0,
    value: i[e]
  } : fn(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function hn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class $s {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
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
  lastAppliedToken = null;
  lastAppliedRuntimeEndpointsToken = null;
  lastAppliedSnapshot = null;
  constructor(e, n) {
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = zs(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (!this.started) {
      this.started = !0, this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
      for (const e of this.parameterEndpointIDs)
        this.connection.addParameterListener?.(e, this.getParameterListener(e)), this.connection.requestParameterValue?.(e);
      for (const e of this.runtimeEndpointDependencies)
        this.connection.addEndpointListener?.(e.endpointID, this.getRuntimeEndpointListener(e));
      this.requestStoredState();
    }
  }
  stop() {
    if (this.started) {
      this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
      for (const e of this.parameterEndpointIDs)
        this.connection.removeParameterListener?.(e, this.getParameterListener(e));
      for (const e of this.runtimeEndpointDependencies)
        this.connection.removeEndpointListener?.(e.endpointID, this.getRuntimeEndpointListener(e));
    }
  }
  /** Rebuild and resend the complete runtime image from the stored snapshot. */
  replayFullRuntimeState() {
    this.started && (this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.forceFullReplay = !0, this.applyRuntimeStateIfReady());
  }
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((e) => {
        const n = Vs(e, this.options.stateKey);
        if (n.found) {
          this.applyStoredValue(n.value);
          return;
        }
        this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.connection.requestStoredStateValue(this.options.stateKey);
      return;
    }
    this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
  }
  handleStoredStateValue(e) {
    if (!e || typeof e != "object")
      return;
    const n = e;
    n.key === this.options.stateKey && (n.value === void 0 && !this.options.applyDefaultRuntimeStateWhenMissing || this.applyStoredValue(n.value));
  }
  getParameterListener(e) {
    const n = this.parameterListeners.get(e);
    if (n)
      return n;
    const i = (o) => {
      this.parameterValues.set(e, o), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, i), i;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const i = (o) => {
      const r = e.mapValue ? e.mapValue(o) : o;
      this.runtimeEndpointValues.set(e.endpointID, r), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(e.endpointID, i), i;
  }
  applyStoredValue(e) {
    const n = this.options.deserializeStoredState(e);
    n !== null && (this.state = n, this.hasState = !0, this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState)
      return;
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    const e = {};
    for (const s of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(s))
        return;
      e[s] = this.parameterValues.get(s);
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
    const i = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, o = hn(n), r = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, r), l = hn({
      runtimeEndpoints: n,
      events: a
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(a);
        const u = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, u && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(a);
        const s = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, s && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of a)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Bs
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
  }
}
function zs(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Hs(t, e) {
  return new $s(t, e);
}
function Ws(t) {
  return Hs(t, {
    stateKey: ls,
    runtimeEndpointDependencies: [za],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Ns,
    buildRuntimeEvents: ({ state: e }) => [...Us(e)]
  });
}
const js = "runtimeSyncRequest", qs = 2147483647, Gs = "runtimeState", Qs = "retryDesiredTableRequest", Js = "workerLoadFailure", Xs = "serviceLoadAbort", Ys = "wavetableLoadBegin", Zs = "wavetableMipFrame", el = "wavetableUploadAck", tl = "wavetableMipRequest", nl = "wavetablePrewarmRequest", il = "wavetablePrewarmNotification", rl = "assets/factory-bank-catalog.json", mt = 3, ol = 1, al = mt * Re, sl = 1, ll = 2, cl = 3, ul = 1, dl = 2, ml = 2e4, Ee = sl, fl = ll, pn = cl, j = ul, gn = dl, hl = 48 * 1024 * 1024, Ye = 3;
function In(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function T(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function yn(t) {
  return {
    dspSessionId: t.dspSessionId,
    oscillatorIndex: t.oscillatorIndex,
    desiredIntentSerial: t.desiredIntentSerial,
    desiredTableIndex: t.desiredTableIndex,
    generationFrontier: t.generationFrontier,
    serviceState: t.serviceState,
    active: t.hasActive ? {
      tableIndex: t.activeTableIndex,
      generation: t.activeGeneration
    } : null,
    loading: t.hasLoading ? {
      tableIndex: t.loadingTableIndex,
      generation: t.loadingGeneration
    } : null,
    failure: t.hasFailure ? {
      tableIndex: t.failedTableIndex,
      generation: t.failedGeneration,
      scope: t.failureScope,
      phase: t.failurePhase,
      reason: t.failureReasonCode
    } : null
  };
}
function bn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Sn(t, e) {
  if (!t)
    throw new Error(e);
}
function pl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function gl(t, e) {
  return Ui(await t.readJSON(e));
}
function Il(t) {
  return {
    dspSessionId: Math.trunc(Number(t?.dspSessionId) || 0),
    oscillatorIndex: Math.trunc(Number(t?.oscillatorIndex) || 0),
    desiredIntentSerial: Math.trunc(Number(t?.desiredIntentSerial) || 0),
    desiredTableIndex: Math.trunc(Number(t?.desiredTableIndex) || 0),
    generationFrontier: Math.trunc(Number(t?.generationFrontier) || 0),
    serviceState: Math.trunc(Number(t?.serviceState) || 0),
    hasActive: !!t?.hasActive,
    activeTableIndex: Math.trunc(Number(t?.activeTableIndex) || 0),
    activeGeneration: Math.trunc(Number(t?.activeGeneration) || 0),
    hasLoading: !!t?.hasLoading,
    loadingTableIndex: Math.trunc(Number(t?.loadingTableIndex) || 0),
    loadingGeneration: Math.trunc(Number(t?.loadingGeneration) || 0),
    hasFailure: !!t?.hasFailure,
    failedTableIndex: Math.trunc(Number(t?.failedTableIndex) || 0),
    failedGeneration: Math.trunc(Number(t?.failedGeneration) || 0),
    failureScope: Math.trunc(Number(t?.failureScope) || 0),
    failurePhase: Math.trunc(Number(t?.failurePhase) || 0),
    failureReasonCode: Math.trunc(Number(t?.failureReasonCode) || 0)
  };
}
function yl(t, e) {
  const n = Math.round(Number(t) || 0);
  return pl(n, 0, Math.max(0, e - 1));
}
function Ze(t, e, n, i, o) {
  return `${t}:${e}:${n}:${i}:${o}`;
}
function bl(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function vn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Tn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function En() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Sl(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class vl {
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
  constructor(e, n = {}) {
    this.connection = e, this.resourceClient = Fi(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? rl, this.maxBatchesInFlight = In(
      n.maxFramesInFlight,
      ol
    ), this.mipLevelCount = n.mipLevelCount ?? Mn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? hl) || 0)), this.serviceLoadTimeoutMs = In(n.serviceLoadTimeoutMs, ml), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, T("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Gs, this.handleRuntimeState), this.connection.addEndpointListener?.(el, this.handleUploadAck), this.connection.addEndpointListener?.(tl, this.handleMipRequest), this.connection.addEndpointListener?.(nl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(il, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      js,
      qs
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await gl(this.resourceClient, this.catalogPath), T("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Ye; n += 1)
      this.nextLoadGenerations[n] = 1, this.latestRuntimeStates[n] = null, this.firstRuntimeStateInSession[n] = !0, this.candidateValidations[n] = null, this.autoRetryConsumedKeys[n] = null;
    this.nextLoadGenerations[e.oscillatorIndex] = Math.max(
      1,
      e.generationFrontier + 1
    ), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.cancelServiceLoadWatchdog();
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog(), this.mipJobs.clear(), this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(e) {
    this.tableCacheBytes -= e.byteCount, e.byteCount = vn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
  }
  getPinnedCacheKeys() {
    const e = /* @__PURE__ */ new Set();
    return this.serviceTable?.cacheKey && e.add(this.serviceTable.cacheKey), e;
  }
  evictCacheIfNeeded() {
    if (this.cacheBudgetBytes <= 0)
      return;
    const e = this.getPinnedCacheKeys();
    for (; this.tableCacheBytes > this.cacheBudgetBytes; ) {
      let n = null, i = null;
      for (const [o, r] of this.tableCache)
        e.has(o) || (!i || r.lastUsedSerial < i.lastUsedSerial) && (n = o, i = r);
      if (!n || !i)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= i.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const i = {
      ...e,
      byteCount: vn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ze(
          this.serviceTable.dspSessionId,
          this.serviceTable.oscillatorIndex,
          this.serviceTable.generation,
          this.serviceTable.tableIndex,
          n
        );
        this.mipJobs.has(i) || this.mipJobs.set(i, {
          key: i,
          dspSessionId: this.serviceTable.dspSessionId,
          oscillatorIndex: this.serviceTable.oscillatorIndex,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...Tn(this.serviceTable.frameCount),
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
    for (const e of this.mipJobs.values())
      if (e.dspSessionId === this.serviceTable.dspSessionId && e.generation === this.serviceTable.generation && e.tableIndex === this.serviceTable.tableIndex && !e.completed && (e.inFlightBatchBases.size > 0 || e.nextFrameIndex > 0))
        return !0;
    return !1;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: o } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (T("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: i,
        tableIndex: o,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: i,
          tableIndex: o
        },
        {
          failurePhase: pn,
          failureReasonCode: gn
        }
      ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain());
    }, this.serviceLoadTimeoutMs), this.serviceLoadWatchdogHandle?.unref?.();
  }
  resolveServiceTarget(e) {
    return e.hasLoading ? {
      kind: "loading",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.loadingGeneration,
      tableIndex: e.loadingTableIndex
    } : e.hasActive ? {
      kind: "active",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.activeGeneration,
      tableIndex: e.activeTableIndex
    } : null;
  }
  shouldStayIdleOnFailure(e) {
    return e.hasFailure && e.failedTableIndex === e.desiredTableIndex && e.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(e) {
    return `${e.dspSessionId}:${e.oscillatorIndex}:${e.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(e) {
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== pn || e.failureReasonCode !== gn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: o = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = Ee,
    failureReasonCode: l = j
  }) {
    this.connection.sendEventOrValue?.(Js, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: o,
      candidateAttemptSerial: r,
      failurePhase: a,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: o,
    failureReasonCode: r = j
  }) {
    this.connection.sendEventOrValue?.(Xs, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: o,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    T("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? yn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Qs, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), o = yl(e, i.tables.length), r = i.tables[o];
    Sn(r, `Could not resolve table ${o}`);
    const a = bl(r, Re, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, T("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = En();
    T("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(r.sourceWav), c = zi(u.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: Re
    });
    return T("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(En() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: r,
      frameCount: c.frameCount,
      frames: c.frames,
      spectra: new Array(c.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    T("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: i.tableMeta?.name ?? null,
      frameCount: i.frameCount
    }), this.serviceTable = {
      ...i,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidations[e.oscillatorIndex] = {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Ys, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    T("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Ee,
      failureReasonCode: j
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Ee,
      failureReasonCode: j
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Ee,
    failureReasonCode: i = j
  } = {}) {
    T("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: i
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: i
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: i
    });
  }
  async prepareServiceTarget(e, n) {
    if (this.isMatchingServiceTable(e)) {
      this.serviceTable && (this.serviceTable.mode = e.kind);
      const r = this.candidateValidations[e.oscillatorIndex];
      return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (r) {
      return this.isCurrentRuntimeState(n) && (T("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: et(r)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    if (!i || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...i,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads());
    const o = this.candidateValidations[e.oscillatorIndex];
    return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, i = this.candidateValidations[e.oscillatorIndex];
    if (i && i.dspSessionId === e.dspSessionId && i.tableIndex === n && i.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const o = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let r = null;
    try {
      r = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(e) && (T("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: et(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !r || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, o, r);
  }
  async prepareDesiredCandidate(e) {
    await this.prepareDesiredLoad(e);
  }
  isCurrentRuntimeState(e) {
    return this.started && e.dspSessionId === this.knownSessionId && this.latestRuntimeStates[e.oscillatorIndex] === e;
  }
  selectPendingRuntimeStateOscillator() {
    if (this.serviceTable?.mode === "loading")
      return this.pendingRuntimeStateOscillators.has(this.serviceTable.oscillatorIndex) ? this.serviceTable.oscillatorIndex : null;
    for (let e = 0; e < Ye; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Sl(() => {
      this.runtimeStateDrainScheduled = !1, this.drainRuntimeStates().catch((e) => {
        console.error(e);
      });
    }));
  }
  async drainRuntimeStates() {
    if (!this.runtimeStateDrainRunning) {
      this.runtimeStateDrainRunning = !0;
      try {
        for (; this.started; ) {
          const e = this.selectPendingRuntimeStateOscillator();
          if (e === null)
            break;
          this.pendingRuntimeStateOscillators.delete(e);
          const n = this.latestRuntimeStates[e];
          if (n && (await this.reconcileRuntimeState(n), this.serviceTable?.mode === "loading"))
            break;
        }
      } finally {
        this.runtimeStateDrainRunning = !1, this.scheduleRuntimeStateDrain();
      }
    }
  }
  async reconcileRuntimeState(e) {
    if (!this.isCurrentRuntimeState(e))
      return;
    const n = e.oscillatorIndex, i = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const o = this.candidateValidations[n];
    if (o && o.dspSessionId === e.dspSessionId && o.generation > e.generationFrontier)
      return;
    const r = this.resolveServiceTarget(e);
    if (r) {
      if (!await this.prepareServiceTarget(r, e) || !this.isCurrentRuntimeState(e))
        return;
      if (r.kind === "loading" && e.desiredTableIndex !== r.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        T("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: r.dspSessionId,
          oscillatorIndex: n,
          generation: r.generation,
          staleTableIndex: r.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: r.dspSessionId,
          oscillatorIndex: n,
          generation: r.generation,
          tableIndex: r.tableIndex,
          failureReasonCode: j
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      r.kind === "active" && e.desiredTableIndex !== r.tableIndex && !this.shouldStayIdleOnFailure(e) && !i && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Il(e ?? {});
    if (T("info", "Received runtime state", yn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Ye)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const o = n.oscillatorIndex, r = this.latestRuntimeStates[o], a = r ? this.getDesiredRetryKey(r) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[o] = Math.max(
      this.nextLoadGenerations[o] ?? 1,
      n.generationFrontier + 1
    ), (i || a !== l) && (this.autoRetryConsumedKeys[o] = null), this.latestRuntimeStates[o] = n, this.pendingRuntimeStateOscillators.add(o), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const o = await this.loadTableSource(i);
        for (let a = 0; a < o.frameCount; a += 1)
          o.spectra[a] || (o.spectra[a] = Pt(o.frames[a]));
        const r = this.tableCache.get(o.cacheKey);
        r && this.refreshCacheEntryByteCount(r), T("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        T("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: et(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Ze(
      n,
      i,
      o,
      r,
      a
    );
    let u = this.mipJobs.get(s);
    return u ? (!u.completed && l > u.urgencyLevel && (u.urgencyLevel = l), u) : (u = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: o,
      tableIndex: r,
      mipIndex: a,
      urgencyLevel: l,
      ...Tn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, u), u);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (T("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      oscillatorIndex: n.oscillatorIndex,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = Ze(
      i,
      o,
      r,
      a,
      l
    ), d = this.mipJobs.get(c), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      mt,
      h - s
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(s) || u <= 0 || u !== f)) {
      d.inFlightBatchBases.delete(s);
      for (let p = 0; p < u; p += 1) {
        const b = s + p;
        d.ackedFrames[b] || (d.ackedFrames[b] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === h && d.nextFrameIndex >= h && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), bn(s, u, h) && T("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: o,
        generation: r,
        tableIndex: d.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: u,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: h,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Sn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Pt(this.serviceTable.frames[e]);
      const n = this.tableCache.get(this.serviceTable.cacheKey);
      n && this.refreshCacheEntryByteCount(n);
    }
    return this.serviceTable.spectra[e];
  }
  selectNextMipJob() {
    let e = null;
    for (const n of this.mipJobs.values())
      n.completed || (e === null || n.urgencyLevel > e.urgencyLevel) && (e = n);
    return e;
  }
  completeServiceTransferIfReady() {
    if (!this.serviceTable || this.serviceTable.mode !== "loading")
      return !1;
    for (const e of this.mipJobs.values())
      if (!e.completed)
        return !1;
    return this.cancelServiceLoadWatchdog(), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.scheduleRuntimeStateDrain(), !0;
  }
  pumpUploads() {
    if (!this.serviceTable)
      return;
    let e = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!e || e.completed) && (e = this.selectNextMipJob(), this.activeUploadKey = e?.key ?? null), !e) {
      this.completeServiceTransferIfReady();
      return;
    }
    for (; e.inFlightBatchBases.size < this.maxBatchesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = e.nextFrameIndex, i = Math.min(
        mt,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(al);
      try {
        for (let r = 0; r < i; r += 1) {
          const a = n + r, l = this.getSpectrumForFrame(a), s = Hi(l, e.mipIndex);
          o.set(s, r * Re);
        }
      } catch {
        this.handleServiceTargetFailure(
          {
            kind: this.serviceTable.mode ?? "loading",
            dspSessionId: e.dspSessionId,
            oscillatorIndex: e.oscillatorIndex,
            generation: e.generation,
            tableIndex: e.tableIndex
          },
          {
            failurePhase: fl,
            failureReasonCode: j
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Zs, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(o)
      }), bn(n, i, this.serviceTable.frameCount) && T("info", "Sent wavetable mip batch", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        batchFrameCount: i,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: e.inFlightBatchBases.size + 1
      }), e.inFlightBatchBases.add(n), e.nextFrameIndex += i, this.armServiceLoadWatchdog();
    }
    e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightBatchBases.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function et(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Tl(t, e = {}) {
  return new vl(t, e);
}
async function El(t, e = {}) {
  return qi(t, [
    ts,
    Ws,
    () => Tl(t, e)
  ]);
}
export {
  ol as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  ll as FAILURE_PHASE_BUILD_MIP,
  sl as FAILURE_PHASE_LOAD_SOURCE,
  cl as FAILURE_PHASE_TRANSFER_MIP,
  ul as FAILURE_REASON_GENERIC,
  dl as FAILURE_REASON_TIMEOUT,
  mt as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  qs as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  vl as WavetableWorkerController,
  Tl as createWavetableWorkerController,
  El as default
};
