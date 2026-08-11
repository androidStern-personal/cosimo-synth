function w(t, e) {
  if (!t)
    throw new Error(e);
}
function Se(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function un(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function De(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ct(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const i = Object.keys(t).slice(0, 6), r = i.length > 0 ? ` keys=${i.join(",")}` : "";
  return n ? `${e}:${n}${r}` : `${e}${r}`;
}
function dn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function be(t, e) {
  const n = dn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (un(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function qe(t) {
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
  throw new Error(`Unsupported text resource payload (${Ct(t)})`);
}
function hn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return De(t);
  throw new Error(`Unsupported binary resource payload (${Ct(t)})`);
}
function fn(t) {
  const e = t?.frames;
  w(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let r = 0; r < n.length; r += 1) {
    const a = n[r];
    if (typeof a == "number") {
      i[r] = a;
      continue;
    }
    if (ArrayBuffer.isView(a) || Array.isArray(a)) {
      const o = a;
      w(o.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(o[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Pt(t) {
  const e = new DataView(t);
  w(Se(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), w(Se(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, o = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const d = Se(e, c, 4), f = e.getUint32(c + 4, !0), g = c + 8;
    d === "fmt " ? (n = e.getUint16(g, !0), i = e.getUint16(g + 2, !0), r = e.getUint32(g + 4, !0), o = e.getUint16(g + 12, !0), a = e.getUint16(g + 14, !0)) : d === "data" && (l = g, s = f), c = g + f + f % 2;
  }
  w(n !== null, "Wave file is missing a fmt chunk"), w(l !== null && s !== null, "Wave file is missing a data chunk"), w(i === 1, "Only mono wavetable bank files are supported");
  let h;
  if (n === 3 && a === 32)
    h = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && a === 16) {
    const d = s / 2, f = new Int16Array(t.slice(l, l + s));
    h = new Float32Array(d);
    for (let g = 0; g < d; g += 1)
      h[g] = f[g] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: o ?? 0,
    samples: h
  };
}
async function He(t) {
  w(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return w(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Ce(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function _t(t) {
  const e = new Uint8Array(t).buffer, n = Pt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function mn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (w(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), r = async (s) => {
    w(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return fn(c);
  }, a = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, o = async (s, c = t.getResourceAddress?.(s)) => {
    const h = be(s, c), d = await He(h), f = Pt(d);
    return {
      sampleRate: f.sampleRate,
      samples: f.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const h = be(s, c);
    return new Uint8Array(await He(h));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return qe(await i(s));
      const c = a(s);
      return e === "url" && c !== null ? Ce(await l(s, c)) : typeof t.readResource == "function" ? qe(await i(s)) : Ce(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? hn(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(s);
      const c = a(s);
      return n === "url" && c !== null ? o(s, c) : typeof t.readResourceAsAudioData == "function" ? r(s) : _t(await this.readBytes(s));
    },
    getURL(s) {
      return be(s, t.getResourceAddress?.(s));
    }
  };
}
function pn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return mn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function gn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(o) {
      if (e)
        return e(o);
      if (n)
        return JSON.stringify(await n(o));
      if (i)
        return Ce(await i(o));
      throw new Error(`Resource client cannot read text ${o}`);
    },
    async readJSON(o) {
      return n ? n(o) : JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      if (i)
        return i(o);
      if (e)
        return De(await e(o));
      if (n)
        return De(JSON.stringify(await n(o)));
      throw new Error(`Resource client cannot read bytes ${o}`);
    },
    async readAudio(o) {
      return r ? r(o) : _t(await this.readBytes(o));
    },
    getURL(o) {
      return a ? a(o) : null;
    }
  };
}
function yn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Sn(t) {
  return yn(t) ? gn(t) : pn(t);
}
const Je = 2048;
function Y(t, e) {
  if (!t)
    throw new Error(e);
}
function bn(t) {
  Y(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    Y(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), Y(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), Y(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), Y(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const vn = 2048, Ot = 11, In = 256;
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function Rn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Ge = /* @__PURE__ */ new Map();
function Tn(t) {
  const e = Ge.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, o = r;
    for (let l = 0; l < n; l += 1)
      a = a << 1 | o & 1, o >>= 1;
    i[r] = a;
  }
  return Ge.set(t, i), i;
}
function Ft(t, e, n = !1) {
  const i = t.length;
  x(i === e.length, "FFT real and imaginary buffers must have the same length"), x(Rn(i), "FFT input length must be a power of two");
  const r = Tn(i);
  for (let a = 0; a < i; a += 1) {
    const o = r[a];
    if (o <= a)
      continue;
    const l = t[a];
    t[a] = t[o], t[o] = l;
    const s = e[a];
    e[a] = e[o], e[o] = s;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const o = a >> 1, l = (n ? 2 : -2) * Math.PI / a, s = Math.cos(l), c = Math.sin(l);
    for (let h = 0; h < i; h += a) {
      let d = 1, f = 0;
      for (let g = 0; g < o; g += 1) {
        const v = h + g, R = v + o, M = t[R], H = e[R], J = d * M - f * H, G = d * H + f * M, Q = t[v], X = e[v];
        t[v] = Q + J, e[v] = X + G, t[R] = Q - J, e[R] = X - G;
        const oe = d * s - f * c;
        f = d * c + f * s, d = oe;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function Lt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function wn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = vn,
  maxFramesPerTable: i = In
} = {}) {
  const r = Float32Array.from(t);
  x(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  x(a > 0, "Source wavetable files must contain at least one frame"), x(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && x(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const o = [];
  for (let l = 0; l < a; l += 1) {
    const s = l * n, c = s + n;
    o.push(Lt(r.slice(s, c)));
  }
  return {
    frameCount: a,
    frames: o
  };
}
function Qe(t) {
  const e = Lt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Ft(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function An(t, e, {
  mipLevelCount: n = Ot
} = {}) {
  const i = t?.real?.length ?? 0;
  x(i > 0, "Spectrum must contain real samples"), x(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), x(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), o = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    a[l] = t.real[l], o[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (a[s] = t.real[s], o[s] = t.imaginary[s]);
  }
  return Ft(a, o, !0), Float32Array.from(a);
}
class xn {
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
          } catch (r) {
            n.push(r);
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
function Mn(t, e) {
  return new xn(t, e);
}
async function En(t, e) {
  const n = Mn(t, e);
  return await n.start(), n;
}
const I = (t, e) => ({ label: t, value: e });
function E(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const k = Object.freeze({
  filter: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: E(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), u = (t, e, n, i, r, a, o, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: o,
  step: l.step ?? (a - r) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), kn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Dn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Cn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: k.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    parameters: [
      u("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(I), quick: !0 }),
      u("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      u("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      u("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: k.drive,
    initialQuickEndpointID: "distortionDriveDb",
    parameters: [
      u("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [I("Classic", 0), I("Harmonics", 1)] }),
      u("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      u("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      u("drive", "distortionWet", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 5 }),
      u("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      u("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: k.ott,
    initialQuickEndpointID: "ottAmount",
    parameters: [
      u("ott", "ottMix", "Mix", "Mix", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      u("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      u("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      u("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      u("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: k.chorus,
    initialQuickEndpointID: "chorusMix",
    parameters: [
      u("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(I) }),
      u("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(I) }),
      u("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      u("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      u("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      u("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      u("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(I) }),
      u("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: k.flanger,
    initialQuickEndpointID: "flangerRate",
    parameters: [
      u("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      u("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      u("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      u("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: k.phaser,
    initialQuickEndpointID: "phaserRate",
    parameters: [
      u("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [I("Free", 0), I("Sync", 1)] }),
      u("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      u("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: kn.map(I) }),
      u("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      u("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      u("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      u("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      u("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: k.delay,
    initialQuickEndpointID: "delayTime",
    parameters: [
      u("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [I("Free", 0), I("Sync", 1)] }),
      u("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      u("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Dn.map(I) }),
      u("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      u("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      u("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: k.reverb,
    initialQuickEndpointID: "reverbSize",
    parameters: [
      u("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      u("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      u("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      u("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], Nt = Cn, Ut = Object.freeze(
  Nt.flatMap((t) => t.parameters)
);
new Map(
  Ut.map((t) => [t.endpointID, t])
);
function Vt() {
  return Ut;
}
const D = 2048, Pn = D + 3, Xe = 20, Bt = "MSEG 1", _n = 0, On = 2, Fn = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Le(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function j(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Ln(t) {
  return Le(Number.isFinite(t) ? t : 0, -Xe, Xe);
}
function P(t) {
  return Le(Number.isFinite(t) ? t : 0, 0, 1);
}
function $t(t = Bt) {
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
function Wt() {
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
function Kt(t) {
  const e = Number(t);
  return Le(
    Number.isFinite(e) ? e : 1,
    _n,
    On
  );
}
function Nn(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = P(Number(e.startX)), i = P(Number(e.endX));
  return j(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function jt(t = Wt()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, a = Fn.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Kt(Number.isFinite(i) ? i : 1)
    },
    loop: Nn(e.loop),
    noteOffPolicy: a,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Un(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = P(r)), {
    x: r,
    y: P(Number(i.y)),
    curvePower: Ln(Number(i.curvePower))
  };
}
function ne(t = $t()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, a) => Un(r, a, n.length));
  if (!j(i[0].x, 0) || !j(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Bt,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Ye(t) {
  return JSON.stringify(ne(t));
}
function Ze(t) {
  return JSON.stringify(jt(t));
}
function Vn(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function Bn(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (j(e, r.x)) {
      let a = n + 1;
      for (; a + 1 < t.length && j(t[a + 1].x, e); )
        a += 1;
      return {
        from: t[a],
        to: t[a],
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
function $n(t, e) {
  const n = P(Number(e)), i = Bn(t, n);
  if (i.laterPointWins || j(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, a = r <= 0 ? 1 : (n - i.from.x) / r, o = P(Vn(a, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * o;
}
function Wn(t, e) {
  return $n(ne(t).points, e);
}
function Kn(t) {
  const e = ne(t), n = new Float32Array(D);
  for (let r = 0; r < D; r += 1) {
    const a = r / (D - 1);
    n[r] = Wn(e, a);
  }
  const i = new Float32Array(Pn);
  return i[0] = n[0], i.set(n, 1), i[D + 1] = n[D - 1], i[D + 2] = n[D - 1], i;
}
function et(t, e) {
  return Ye(t) === Ye(e);
}
function jn(t, e) {
  return Ze(t) === Ze(e);
}
const ve = "modulationProgram", zn = "modulationAmount", zt = 9, Ne = 4, fe = 12, ie = 36, L = zt * fe, $ = Ne * fe, B = zt * ie, Z = Ne * ie, qt = L + $;
function qn(t) {
  const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = i.modulationTargetIndex;
    if (r === null)
      continue;
    if (!Number.isInteger(r) || r < 0 || r >= ie)
      throw new Error(
        `Invalid rack modulation target index ${String(r)} for ${i.endpointID}`
      );
    const a = n.get(r);
    if (a !== void 0)
      throw new Error(
        `Duplicate rack modulation target index ${r}: ${a} and ${i.endpointID}`
      );
    n.set(r, i.endpointID), e.set(`rack.${i.endpointID}`, r);
  }
  return e;
}
const Hn = qn(Vt());
function Pe(t, e, n) {
  if (t === null || !Number.isInteger(t) || t < 1 || t > e)
    throw new Error(`Invalid ${n} modulation source slot: ${String(t)}`);
  return t - 1;
}
function Jn(t) {
  switch (t.sourceKind) {
    case "mseg":
      return Pe(t.sourceSlot, 3, t.sourceKind);
    case "env":
      return 3 + Pe(t.sourceSlot, 3, t.sourceKind);
    case "velocity":
      return 6;
    case "pressure":
      return 7;
    case "slide":
      return 8;
    case "macro":
      throw new Error("Macro is not a per-voice modulation source");
  }
}
function Gn(t) {
  switch (t) {
    case "wavetablePosition":
      return 0;
    case "warpAmount":
      return 1;
    case "filterCutoffOctaves":
      return 2;
    case "filterQ":
      return 3;
    case "pitchSemitones":
      return 4;
    case "ampGainDb":
      return 5;
    case "pan":
      return 6;
    case "unisonDetune":
      return 7;
    case "unisonBlend":
      return 8;
    case "unisonWidth":
      return 9;
    case "unisonWavetablePositionSpread":
      return 10;
    case "unisonWarpSpread":
      return 11;
    default:
      return null;
  }
}
function Ht(t) {
  const e = Gn(t.targetKind), n = Hn.get(t.targetKind);
  if (e === null && n === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Pe(t.sourceSlot, Ne, t.sourceKind);
    if (e !== null) {
      const l = a * fe + e;
      return {
        path: "macroVoice",
        cellIndex: l,
        sourceIndex: a,
        targetIndex: e,
        articulationCellIndex: L + l
      };
    }
    const o = n ?? 0;
    return {
      path: "macroRack",
      cellIndex: a * ie + o,
      sourceIndex: a,
      targetIndex: o,
      articulationCellIndex: null
    };
  }
  const i = Jn(t);
  if (e !== null) {
    const a = i * fe + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: i,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const r = n ?? 0;
  return {
    path: "voiceRack",
    cellIndex: i * ie + r,
    sourceIndex: i,
    targetIndex: r,
    articulationCellIndex: null
  };
}
function Ue(t) {
  return Ht(t).articulationCellIndex;
}
function Qn(t) {
  return {
    ...Ht(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Jt(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    const i = Qn(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function Xn(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function W(t) {
  return [...t.values()].filter(Xn).sort((e, n) => e.cellIndex - n.cellIndex);
}
function se(t, e, n, i, r) {
  for (let a = 0; a < t.length; a += 1) {
    const o = t[a];
    if (o === void 0)
      throw new Error(`Missing compiled modulation route at index ${a}`);
    e[a] = o.cellIndex, n[a] = o.sourceIndex, i[a] = o.targetIndex, r[a] = o.polarity;
  }
}
function Ie(t) {
  const e = Jt(t), n = W(e.voice), i = W(e.macroVoice), r = W(e.voiceRack), a = W(e.macroRack), o = Array.from({ length: L }, () => 0), l = Array.from({ length: L }, () => 0), s = Array.from({ length: L }, () => 0), c = Array.from({ length: L }, () => 0), h = Array.from({ length: L }, () => 0);
  se(n, o, l, s, c);
  const d = Array.from({ length: $ }, () => 0), f = Array.from({ length: $ }, () => 0), g = Array.from({ length: $ }, () => 0), v = Array.from({ length: $ }, () => 0), R = Array.from({ length: $ }, () => 0);
  se(
    i,
    d,
    f,
    g,
    v
  );
  const M = Array.from({ length: B }, () => 0), H = Array.from({ length: B }, () => 0), J = Array.from({ length: B }, () => 0), G = Array.from({ length: B }, () => 0), Q = Array.from({ length: B }, () => 0), X = Array.from({ length: B }, () => 0);
  se(
    r,
    M,
    H,
    J,
    G
  );
  const oe = Array.from({ length: Z }, () => 0), $e = Array.from({ length: Z }, () => 0), We = Array.from({ length: Z }, () => 0), Ke = Array.from({ length: Z }, () => 0), je = Array.from({ length: Z }, () => 0);
  se(
    a,
    oe,
    $e,
    We,
    Ke
  );
  for (const S of e.voice.values()) h[S.cellIndex] = S.amount;
  for (const S of e.macroVoice.values()) R[S.cellIndex] = S.amount;
  for (const S of e.voiceRack.values()) X[S.cellIndex] = S.amount;
  for (const S of e.macroRack.values()) je[S.cellIndex] = S.amount;
  for (let S = 0; S < r.length; S += 1) {
    const ze = r[S];
    if (ze === void 0) throw new Error(`Missing compiled voice-rack route at index ${S}`);
    Q[S] = ze.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: o,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: h,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: g,
    macroVoiceRoutePolarities: v,
    macroVoiceRouteAmounts: R,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: M,
    voiceRackRouteSources: H,
    voiceRackRouteTargets: J,
    voiceRackRoutePolarities: G,
    voiceRackRouteReducers: Q,
    voiceRackRouteAmounts: X,
    macroRackRouteCount: a.length,
    macroRackRouteCells: oe,
    macroRackRouteSources: $e,
    macroRackRouteTargets: We,
    macroRackRoutePolarities: Ke,
    macroRackRouteAmounts: je
  };
}
const Yn = ["voice", "macroVoice", "voiceRack", "macroRack"], Zn = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function tt(t) {
  return Jt(t);
}
function ei(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function ti(t, e) {
  if (t === null)
    return [{ endpointID: ve, value: Ie(e) }];
  const n = tt(t), i = tt(e), r = [];
  for (const a of Yn) {
    const o = W(n[a]), l = W(i[a]);
    if (o.length !== l.length)
      return [{ endpointID: ve, value: Ie(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = o[s], h = l[s];
      if (c === void 0 || h === void 0 || !ei(c, h))
        return [{ endpointID: ve, value: Ie(e) }];
      c.amount !== h.amount && r.push({
        endpointID: zn,
        value: {
          pathKind: Zn[a],
          cellIndex: h.cellIndex,
          amount: h.amount
        }
      });
    }
  }
  return r;
}
function z(t) {
  return { _tag: "ok", value: t };
}
function de(t) {
  return { _tag: "err", error: t };
}
function ni(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
const ee = "modulation.v2", re = 3, C = 3, nt = "modulationMsegBuffer", ii = "modulationMsegPlayback", ri = "modulationEnvelope", Gt = 4, ai = ["MSEG 1", "MSEG 2", "MSEG 3"], Qt = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], oi = ["Env 1", "Env 2", "Env 3"], si = 1e-3, li = 10, ci = 0.1, ui = 20, di = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: ui - ci },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, Xt = Vt().filter((t) => t.modulationTargetIndex !== null), Yt = new Map(
  Xt.map((t) => [`rack.${t.endpointID}`, t])
);
class Re extends Error {
  name = "ModulationStateParseError";
}
[
  ...Xt.map((t) => ({
    value: `rack.${t.endpointID}`,
    label: `${t.effectId.toUpperCase()} ${t.shortLabel.toUpperCase()}`
  }))
];
let it = 1;
function hi(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ve(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Te(t, e) {
  const n = Number(t);
  return Ve(Number.isFinite(n) ? n : e, si, li);
}
function fi(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function mi(t) {
  const e = Yt.get(t);
  return e !== void 0 ? fi(e) : di[t];
}
function pi() {
  const t = `mod-route-auto-${it}`;
  return it += 1, t;
}
function gi(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function yi(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Si(t, e) {
  const n = mi(t), i = Number(e);
  return Ve(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function bi(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function vi(t) {
  return bi(t) ?? "mseg";
}
function Ii(t) {
  if (typeof t == "string") {
    const e = t;
    if (Yt.has(e))
      return e;
  }
  return t === "wavetablePosition" || t === "warpAmount" || t === "filterCutoffOctaves" || t === "filterQ" || t === "pitchSemitones" || t === "ampGainDb" || t === "pan" || t === "unisonDetune" || t === "unisonBlend" || t === "unisonWidth" || t === "unisonWavetablePositionSpread" || t === "unisonWarpSpread" ? t : null;
}
function Ri(t) {
  return Ii(t) ?? "wavetablePosition";
}
function Ti(t, e) {
  const n = Qt[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function wi(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? re : t === "macro" ? Gt : C;
  return Ve(Number.isFinite(n) ? n : 1, 1, i);
}
function N(t) {
  return {
    name: oi[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ai(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = N(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Te(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Te(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: P(n.sustain ?? i.sustain),
    releaseSeconds: Te(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function rt(t = {}) {
  return {
    id: t.id ?? pi(),
    enabled: !0,
    sourceKind: "mseg",
    sourceSlot: 1,
    polarity: "unipolar",
    targetKind: "wavetablePosition",
    amount: 0,
    reducer: "max",
    ...t
  };
}
function xi(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: gi(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: wi(n, t.sourceSlot),
    polarity: yi(t.polarity),
    targetKind: i,
    amount: Si(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Mi(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = vi(i.sourceKind), a = Ri(i.targetKind);
  return xi(i, e, r, a);
}
function Ei(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function ki(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Mi(n, i));
}
function Di(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = Ei(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function _e(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((o, l) => _e(o, e[l]));
  const n = t, i = e, r = Object.keys(n), a = Object.keys(i);
  return r.length === a.length && r.every((o) => hi(i, o) && _e(n[o], i[o]));
}
function Zt(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = $t(ai[e] ?? `MSEG ${e + 1}`), r = ne(n.shapeA ?? i);
  return {
    shapeA: r,
    shapeB: ne(n.shapeB ?? r),
    morph: P(n.morph ?? 0),
    playback: jt(n.playback ?? Wt())
  };
}
function me() {
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: re }, (t, e) => Zt({}, e)),
    envelopeSlots: Array.from({ length: C }, (t, e) => N(e)),
    routes: [
      rt({ id: "mod-route-1", amount: 1 }),
      rt({
        id: "mod-route-2",
        targetKind: "filterCutoffOctaves",
        amount: 4
      })
    ],
    macroNames: Qt.slice()
  };
}
function Ci(t = me()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: re }, (a, o) => Zt(n[o], o)),
    envelopeSlots: Array.from({ length: C }, (a, o) => Ai(i[o], o)),
    routes: ki(e.routes),
    macroNames: Array.from(
      { length: Gt },
      (a, o) => Ti(r[o], o)
    )
  };
}
function en(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return de(new Re("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return de(new Re("Expected valid modulation JSON"));
    }
  }
  const n = Ci(e);
  return !_e(e, n) || !Di(n.routes) ? de(new Re("Expected the current modulation schema")) : z(n);
}
function Pi(t, e) {
  return {
    slot: t + 1,
    seconds: Kt(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function at(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Kn(n))
  };
}
function _i(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function Oi(t, e = null) {
  const n = [];
  for (let i = 0; i < re; i += 1) {
    const r = t.msegSlots[i], a = e?.msegSlots[i];
    (a === void 0 || !et(a.shapeA, r.shapeA)) && n.push({
      endpointID: nt,
      value: at(i, 0, r.shapeA)
    }), (a === void 0 || !et(a.shapeB, r.shapeB)) && n.push({
      endpointID: nt,
      value: at(i, 1, r.shapeB)
    }), (a === void 0 || !jn(a.playback, r.playback)) && n.push({
      endpointID: ii,
      value: Pi(i, r.playback)
    });
  }
  for (let i = 0; i < C; i += 1) {
    const r = t.envelopeSlots[i], a = e?.envelopeSlots[i];
    (a === void 0 || JSON.stringify(a) !== JSON.stringify(r)) && n.push({
      endpointID: ri,
      value: _i(i, r)
    });
  }
  return n.push(...ti(e?.routes ?? null, t.routes)), n;
}
const we = "articulationSnapshot", K = 128, ot = 48, Fi = 1e6;
function st(t) {
  return {
    selectorA: t,
    enabled: !1,
    framePosition: 0,
    pan: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoffHz: 1e3,
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
    msegMorphs: Array.from({ length: re }, () => 0),
    routeAmounts: Array.from({ length: qt }, () => 0),
    envelopeAttackSeconds: Array.from({ length: C }, (e, n) => N(n).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: C }, (e, n) => N(n).decaySeconds),
    envelopeSustain: Array.from({ length: C }, (e, n) => N(n).sustain),
    envelopeReleaseSeconds: Array.from({ length: C }, (e, n) => N(n).releaseSeconds)
  };
}
const te = "articulations.v3", Li = [
  "framePosition",
  "pan",
  "warpMode",
  "warpAmount",
  "filterMode",
  "filterCutoffHz",
  "filterQ",
  "unisonVoices",
  "unisonDetune",
  "unisonBlend",
  "unisonWidth",
  "unisonPhase",
  "unisonRandom",
  "unisonPhaseMode",
  "unisonDetuneMode",
  "unisonStackMode",
  "unisonWavetablePositionSpread",
  "unisonWarpSpread",
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
  "env3.releaseSeconds"
];
class Ni extends Error {
  /** @param detail Human-readable detail naming the offending field or slot. */
  constructor(e, n) {
    super(`articulations.v3 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function p(t) {
  return de(new Ni("malformed", t));
}
function ae(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Be(t, e, n) {
  const i = new Set(e);
  for (const r of e)
    if (!Object.hasOwn(t, r))
      return `${n} is missing field "${r}"`;
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return `${n} has a non-string field key`;
    if (!i.has(r))
      return `${n} has unexpected field "${r}"`;
  }
  return null;
}
function pe(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < K;
}
function Ui(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Vi(t) {
  return Li.some((e) => e === t);
}
function lt(t, e) {
  if (!ae(t))
    return p(`${e} must be an object`);
  const n = Be(t, ["min", "max"], e);
  return n !== null ? p(n) : pe(t.min) ? pe(t.max) ? t.min > t.max ? p(`${e}.min must be less than or equal to ${e}.max`) : z({ min: t.min, max: t.max }) : p(`${e}.max must be an integer in 0..127`) : p(`${e}.min must be an integer in 0..127`);
}
function Bi(t, e) {
  if (!ae(t))
    return p(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return p(`${e} has a non-string parameter id`);
    if (!Vi(i))
      return p(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return p(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return z(n);
}
function $i(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Wi() {
  return {};
}
function Ki(t, e, n) {
  if (!ae(t))
    return p(`${e} must be an object`);
  const i = Wi();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return p(`${e} has a non-string route id`);
    const a = t[r];
    if (typeof a != "number" || !Number.isFinite(a) || Math.abs(a) > ot)
      return p(
        `${e}.${r} must be a finite route amount within ±${ot}`
      );
    if (!n.has(r))
      return p(`${e}.${r} does not name a current articulable mapping`);
    $i(i, r, a);
  }
  return z(i);
}
function ji(t, e, n) {
  const i = `slots[${e}]`;
  if (!ae(t))
    return p(`${i} must be an object`);
  const r = Be(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return p(r);
  if (typeof t.id != "string")
    return p(`${i}.id must be a string`);
  if (!pe(t.runtimeSlot))
    return p(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return p(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return p(`${i}.color must be a string`);
  if (!pe(t.key))
    return p(`${i}.key must be an integer in 0..127`);
  const a = lt(t.velRange, `${i}.velRange`);
  if (a._tag === "err")
    return a;
  const o = lt(t.chainRange, `${i}.chainRange`);
  if (o._tag === "err")
    return o;
  const l = Bi(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = Ki(t.routeAmounts, `${i}.routeAmounts`, n);
  return s._tag === "err" ? s : z({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: a.value,
    chainRange: o.value,
    overrides: l.value,
    routeAmounts: s.value
  });
}
function m(t, e, n) {
  if (Object.hasOwn(e.overrides, n)) {
    const i = e.overrides[n];
    if (i !== void 0)
      return i;
  }
  return t.parameters[n];
}
function zi(t, e) {
  if (!ae(t))
    return p("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return p('format must be exactly "cosimo.articulations"');
  if (t.version !== 3)
    return p("version must be exactly 3");
  const n = Be(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return p(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return p("selectedSlotId must be null or a string");
  if (!Ui(t.activeTriggerMode))
    return p('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return p("slots must be an array");
  if (t.slots.length > K)
    return p(`slots must contain at most ${K} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
  for (let o = 0; o < t.slots.length; o += 1) {
    const l = ji(t.slots[o], o, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (r.has(s.id))
      return p(`slots[${o}].id duplicates "${s.id}"`);
    if (a.has(s.runtimeSlot))
      return p(`slots[${o}].runtimeSlot duplicates ${s.runtimeSlot}`);
    r.add(s.id), a.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? p(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : z({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function tn() {
  return {
    format: "cosimo.articulations",
    version: 3,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function qi(t, e) {
  const n = Array.from(
    { length: qt },
    () => Fi
  );
  for (const i of t.routeOrder) {
    const r = t.routeCells[i];
    if (r !== void 0 && Object.hasOwn(e.routeAmounts, i)) {
      const a = e.routeAmounts[i];
      a !== void 0 && (n[r] = a);
    }
  }
  return {
    selectorA: e.runtimeSlot,
    enabled: !0,
    framePosition: m(t, e, "framePosition"),
    pan: m(t, e, "pan"),
    warpMode: m(t, e, "warpMode"),
    warpAmount: m(t, e, "warpAmount"),
    filterMode: m(t, e, "filterMode"),
    filterCutoffHz: m(t, e, "filterCutoffHz"),
    filterQ: m(t, e, "filterQ"),
    unisonVoices: m(t, e, "unisonVoices"),
    unisonDetune: m(t, e, "unisonDetune"),
    unisonBlend: m(t, e, "unisonBlend"),
    unisonWidth: m(t, e, "unisonWidth"),
    unisonPhase: m(t, e, "unisonPhase"),
    unisonRandom: m(t, e, "unisonRandom"),
    unisonPhaseMode: m(t, e, "unisonPhaseMode"),
    unisonDetuneMode: m(t, e, "unisonDetuneMode"),
    unisonStackMode: m(t, e, "unisonStackMode"),
    unisonWavetablePositionSpread: m(t, e, "unisonWavetablePositionSpread"),
    unisonWarpSpread: m(t, e, "unisonWarpSpread"),
    msegMorphs: [
      m(t, e, "msegMorph1"),
      m(t, e, "msegMorph2"),
      m(t, e, "msegMorph3")
    ],
    routeAmounts: n,
    envelopeAttackSeconds: [
      m(t, e, "env1.attackSeconds"),
      m(t, e, "env2.attackSeconds"),
      m(t, e, "env3.attackSeconds")
    ],
    envelopeDecaySeconds: [
      m(t, e, "env1.decaySeconds"),
      m(t, e, "env2.decaySeconds"),
      m(t, e, "env3.decaySeconds")
    ],
    envelopeSustain: [
      m(t, e, "env1.sustain"),
      m(t, e, "env2.sustain"),
      m(t, e, "env3.sustain")
    ],
    envelopeReleaseSeconds: [
      m(t, e, "env1.releaseSeconds"),
      m(t, e, "env2.releaseSeconds"),
      m(t, e, "env3.releaseSeconds")
    ]
  };
}
function Hi(t, e) {
  return e.slots.map((n) => qi(t, n));
}
function nn(t) {
  const e = Number.isFinite(t) ? t : 0;
  return Math.min(1, Math.max(0, e));
}
function b(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const Ji = [
  {
    moduleId: "wavetable",
    workspace: "voice",
    quickParameterId: "index",
    parameters: [
      b("index", "Index", 44, 0),
      b("warp", "Warp", 58, 50),
      b("unison", "Unison", 35, 0),
      b("unison-blend", "Uni Blend", 75, 75),
      b("unison-width", "Uni Width", 100, 100),
      b("unison-wt-spread", "Uni WT Spread", 0, 0),
      b("unison-warp-spread", "Uni Warp Spread", 0, 0),
      b("tune", "Tune", 50, 50, "semitone")
    ]
  },
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      b("cutoff", "Cutoff", 67, 70, "frequency"),
      b("resonance", "Resonance", 25, 0),
      b("drive", "Drive", 15, 0)
    ]
  },
  {
    moduleId: "amp-pan",
    workspace: "voice",
    quickParameterId: "level",
    parameters: [
      b("level", "Level", 80, 80),
      b("pan", "Pan", 50, 50, "signed"),
      b("attack", "Attack", 10, 0),
      b("release", "Release", 35, 25)
    ]
  }
], ct = 1e-6;
function q(t, e) {
  if (!Number.isFinite(t) || t < -ct || t > 1 + ct)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function ut(t, e) {
  return q(t / 100, `${e} catalog percentage`);
}
function Gi(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function _(t) {
  return t;
}
function O(t) {
  return q(t, "identity endpoint conversion");
}
function Qi(t) {
  return 20 * 1e3 ** t;
}
function Xi(t) {
  return q(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Yi(t) {
  return 0.1 * 200 ** t;
}
function Zi(t) {
  return q(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function er(t) {
  return t * 2 - 1;
}
function tr(t) {
  return q((t + 1) / 2, "pan endpoint conversion");
}
function A(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function nr(t, e) {
  switch (t) {
    case "wavetable.index":
      return {
        binding: A("wavetablePosition", _, O),
        articulationParameterId: "framePosition",
        modulationTargetKind: "wavetablePosition"
      };
    case "wavetable.warp":
      return {
        binding: A("warpAmount", _, O),
        articulationParameterId: "warpAmount",
        modulationTargetKind: "warpAmount"
      };
    case "wavetable.unison":
      return {
        binding: A("unisonDetune", _, O),
        articulationParameterId: "unisonDetune",
        modulationTargetKind: "unisonDetune"
      };
    case "wavetable.unison-blend":
      return {
        binding: A("unisonBlend", _, O),
        articulationParameterId: "unisonBlend",
        modulationTargetKind: "unisonBlend"
      };
    case "wavetable.unison-width":
      return {
        binding: A("unisonWidth", _, O),
        articulationParameterId: "unisonWidth",
        modulationTargetKind: "unisonWidth"
      };
    case "wavetable.unison-wt-spread":
      return {
        binding: A("unisonWavetablePositionSpread", _, O),
        articulationParameterId: "unisonWavetablePositionSpread",
        modulationTargetKind: "unisonWavetablePositionSpread"
      };
    case "wavetable.unison-warp-spread":
      return {
        binding: A("unisonWarpSpread", _, O),
        articulationParameterId: "unisonWarpSpread",
        modulationTargetKind: "unisonWarpSpread"
      };
    case "voice-filter.cutoff":
      return {
        binding: A("filterCutoff", Qi, Xi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: A("filterQ", Yi, Zi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "amp-pan.pan":
      return {
        binding: A("pan", er, tr),
        articulationParameterId: "pan",
        modulationTargetKind: "pan"
      };
    case "wavetable.tune":
      return {
        binding: { _tag: "unbacked", reason: "no-endpoint" },
        articulationParameterId: null,
        modulationTargetKind: "pitchSemitones"
      };
    case "amp-pan.level":
      return {
        binding: { _tag: "unbacked", reason: "no-endpoint" },
        articulationParameterId: null,
        modulationTargetKind: "ampGainDb"
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
function ir(t) {
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
      return ni(t);
  }
}
function rr(t, e) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "amp-pan.level" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "amp-pan.pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ar(t, e) {
  const n = Gi(t.moduleId, e.id), i = ir(e.format), r = nr(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: ut(e.defaultPercent, n),
    initialValue: ut(e.initialPercent, n),
    format: i,
    modAmount: rr(i, n),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
function or(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ae(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return q(n, `${t.endpointID} endpoint conversion`);
}
function sr(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function lr(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function cr(t) {
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
function ur(t) {
  const e = or(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ae(t, t.initial),
    initialValue: Ae(t, t.initial),
    format: lr(t),
    modAmount: cr(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => sr(t, n),
      fromEngine: (n) => Ae(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const rn = Object.freeze(
  [
    ...Nt.flatMap((t) => t.parameters.map(ur)),
    ...Ji.flatMap(
      (t) => t.parameters.map(
        (e) => ar(t, e)
      )
    )
  ]
);
new Map(
  rn.map((t) => [t.targetId, t])
);
function ye() {
  return rn;
}
const U = "uiPatchValues.v1";
function dr(t) {
  const e = t.routes.flatMap((n) => {
    const i = Ue(n);
    return i === null ? [] : [[n.id, i]];
  }).sort(([n, i], [r, a]) => n.localeCompare(r) || i - a);
  return JSON.stringify({
    envelopeSlots: t.envelopeSlots.map((n) => [
      n.attackSeconds,
      n.decaySeconds,
      n.sustain,
      n.releaseSeconds
    ]),
    msegMorphs: t.msegSlots.map((n) => n.morph),
    routeCells: e
  });
}
function hr(t) {
  return JSON.stringify(ye().flatMap((e) => {
    const n = e.articulationParameterId;
    if (n === null)
      return [];
    if (e.binding._tag !== "endpoint")
      throw new Error(`Articulation-capable target ${e.targetId} has no endpoint binding.`);
    return [[
      n,
      e.binding.toEngine(
        nn(t[e.targetId] ?? e.initialValue)
      )
    ]];
  }));
}
function Oe() {
  return Object.fromEntries(
    ye().map((t) => [t.targetId, t.initialValue])
  );
}
function fr(t) {
  let e = t;
  if (typeof e == "string")
    try {
      e = JSON.parse(e);
    } catch {
      throw new Error(`${U} is not valid JSON.`);
    }
  if (e === void 0)
    return Oe();
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error(`${U} must be a flat object.`);
  const n = e, i = {}, r = ye();
  for (const a of r) {
    const o = n[a.targetId];
    if (o === void 0) {
      i[a.targetId] = a.initialValue;
      continue;
    }
    if (typeof o != "number" || !Number.isFinite(o) || o < 0 || o > 1)
      throw new Error(`${U}.${a.targetId} must be within 0..1.`);
    i[a.targetId] = o;
  }
  return i;
}
function mr(t, e) {
  const n = (o) => t.envelopeSlots[o] ?? N(o), i = {
    framePosition: 0,
    pan: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoffHz: 1e3,
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
    msegMorph1: t.msegSlots[0]?.morph ?? 0,
    msegMorph2: t.msegSlots[1]?.morph ?? 0,
    msegMorph3: t.msegSlots[2]?.morph ?? 0,
    "env1.attackSeconds": n(0).attackSeconds,
    "env1.decaySeconds": n(0).decaySeconds,
    "env1.sustain": n(0).sustain,
    "env1.releaseSeconds": n(0).releaseSeconds,
    "env2.attackSeconds": n(1).attackSeconds,
    "env2.decaySeconds": n(1).decaySeconds,
    "env2.sustain": n(1).sustain,
    "env2.releaseSeconds": n(1).releaseSeconds,
    "env3.attackSeconds": n(2).attackSeconds,
    "env3.decaySeconds": n(2).decaySeconds,
    "env3.sustain": n(2).sustain,
    "env3.releaseSeconds": n(2).releaseSeconds
  };
  for (const o of ye()) {
    const l = o.articulationParameterId;
    if (l !== null) {
      if (o.binding._tag !== "endpoint")
        throw new Error(`Articulation-capable target ${o.targetId} has no endpoint binding.`);
      i[l] = o.binding.toEngine(
        nn(e[o.targetId] ?? o.initialValue)
      );
    }
  }
  const r = t.routes.flatMap((o) => {
    const l = Ue(o);
    return l === null ? [] : [{ route: o, cellIndex: l }];
  }), a = /* @__PURE__ */ Object.create(null);
  for (const { route: o, cellIndex: l } of r)
    a[o.id] = l;
  return {
    parameters: i,
    routeAmounts: Object.fromEntries(r.map(({ route: o }) => [o.id, o.amount])),
    routeOrder: r.map(({ route: o }) => o.id),
    routeCells: a
  };
}
const dt = "runtimeInstallAck", pr = "runtimeSyncRequest", ht = 0, gr = 8e3, ge = /* @__PURE__ */ new WeakMap(), an = 1e9;
let le = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % an;
function yr(t) {
  return le = le % an + 1, t === "modulation" ? -1e9 - le : 1e9 + le;
}
function Sr(t, e) {
  const n = t, i = ge.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), ge.set(n, i);
}
function ft(t, e) {
  const n = t, i = ge.get(n);
  i?.delete(e), i?.size === 0 && ge.delete(n);
}
const br = [100, 250, 500, 1e3], ce = { _tag: "accepted" }, vr = { _tag: "superseded" }, Ir = { _tag: "stopped" }, mt = { _tag: "transport-timeout" };
function Rr(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, r = i.dspSessionId, a = i.acceptedModulationSerial, o = i.acceptedArticulationSerial, l = i.rejectedSerial, s = i.rejectionReason, c = i.syncSerial;
  return ![
    r,
    a,
    o,
    l,
    s,
    c
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof r != "number" || typeof a != "number" || typeof o != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || r < 0 || a < 0 || o > 0 || s < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: a,
    acceptedArticulationSerial: o,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function Tr(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class on {
  #a;
  #e;
  #d;
  #v;
  #h = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #r = /* @__PURE__ */ new Map();
  #u = 0;
  #i = !1;
  #o = 0;
  #f = /* @__PURE__ */ new Set();
  #I = this.#E.bind(this);
  constructor(e, n) {
    this.#a = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#d = i && i.length > 0 ? i : [...br], this.#v = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? gr)
    );
  }
  start() {
    if (!this.#i) {
      Sr(this.#a, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#a.addEndpointListener?.(dt, this.#I);
      } catch (e) {
        throw this.#i = !1, ft(this.#a, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#a.removeEndpointListener?.(dt, this.#I), ft(this.#a, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#b());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#r.clear(), this.#o += 1, this.#b());
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
    } : this.#R(e, n) : {
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
    if (this.#h)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#h = !0;
    const n = this.#t, i = this.#u;
    try {
      const r = await this.#R(
        n,
        i
      );
      if (r._tag !== "accepted")
        return r;
      let a = null;
      for (const o of e) {
        const l = await this.#M(
          o,
          n,
          i
        );
        if (l._tag === "rejected" && this.#e === "articulation") {
          a ??= l;
          continue;
        }
        if (l._tag !== "accepted")
          return l;
      }
      return a ?? ce;
    } finally {
      this.#h = !1;
    }
  }
  #w(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #A(e, n) {
    const i = this.#w(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #R(e, n) {
    if (this.#s === e)
      return ce;
    const i = yr(this.#e);
    this.#l.add(i);
    const r = Date.now() + this.#v;
    let a = 0;
    try {
      for (; ; ) {
        const o = this.#p(e, n);
        if (o)
          return o;
        if (this.#s === e)
          return ce;
        const l = r - Date.now();
        if (l <= 0)
          return mt;
        const s = this.#o;
        this.#y(i), await this.#S(
          s,
          Math.min(this.#g(a), l)
        ), a += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const r = this.#x(), a = Tr(e.value, n, r);
    let o = 0, l = 0, s = this.#c;
    for (this.#T(e.endpointID, a); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const h = this.#m(n, r, s);
      if (h !== null)
        return h;
      const d = this.#o;
      await this.#S(
        d,
        this.#g(o)
      );
      const f = this.#m(
        n,
        r,
        s
      );
      if (f !== null)
        return f;
      let g = this.#o;
      for (this.#y(r); ; ) {
        const v = this.#p(n, i);
        if (v)
          return v;
        const R = await this.#S(
          g,
          this.#g(o)
        ), M = this.#m(
          n,
          r,
          s
        );
        if (M !== null)
          return M;
        if (R && this.#n?.dspSessionId === n && this.#n.syncSerial === r) {
          if (l >= 1)
            return mt;
          s = this.#c, this.#T(e.endpointID, a), l += 1, o += 1;
          break;
        }
        if (R) {
          g = this.#o;
          continue;
        }
        R || (o += 1, g = this.#o, this.#y(r));
      }
    }
  }
  #m(e, n, i) {
    const r = this.#n;
    if (!r || r.dspSessionId !== e)
      return null;
    const a = this.#r.get(n);
    return a !== void 0 && a.version > i && a.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...a.acknowledgement }
    }) : this.#A(r, n) ? (this.#r.delete(n), ce) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Ir : this.#t !== e ? vr : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #T(e, n) {
    try {
      this.#a.sendEventOrValue?.(
        e,
        n,
        void 0,
        ht
      );
    } catch {
    }
  }
  #y(e) {
    if (this.#i)
      try {
        this.#a.sendEventOrValue?.(
          pr,
          e,
          void 0,
          ht
        );
      } catch {
      }
  }
  #E(e) {
    const n = Rr(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#s = n.dspSessionId), this.#n = n, this.#c += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#r.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#c
      }); this.#r.size > 16; ) {
        const r = this.#r.keys().next().value;
        if (r === void 0) break;
        this.#r.delete(r);
      }
    this.#o += 1, this.#b();
  }
  #S(e, n) {
    return !this.#i || this.#o !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const a = {
        finish: (o) => {
          r || (r = !0, a.timeoutHandle !== null && clearTimeout(a.timeoutHandle), this.#f.delete(a), i(o));
        },
        timeoutHandle: null
      };
      a.timeoutHandle = setTimeout(() => a.finish(!1), n), this.#f.add(a);
    });
  }
  #b() {
    for (const e of [...this.#f])
      e.finish(!0);
  }
}
const pt = "runtimeState", wr = 1e3, xe = [
  te,
  U,
  ee
];
function gt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Me(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (gt(i, e))
    return i[e];
  if (gt(n, e))
    return n[e];
}
function Ar(t) {
  return !t || typeof t != "object" ? 0 : Math.trunc(Number(t.dspSessionId) || 0);
}
function xr(t, e) {
  if (t === void 0)
    return tn();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      throw new Error(`${te} is not valid JSON.`);
    }
  const i = zi(n, e);
  if (i._tag === "err")
    throw i.error;
  return i.value;
}
function yt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Mr {
  constructor(e) {
    this.connection = e, this.installLane = new on(e, {
      laneKind: "articulation"
    });
  }
  articulationBank = tn();
  modulationState = me();
  uiPatchValues = Oe();
  hasArticulationState = !1;
  hasModulationState = !1;
  hasPatchValues = !1;
  hasRuntimeState = !1;
  modulationDependencyToken = null;
  patchValuesDependencyToken = null;
  pendingBootStoredValues = null;
  runtimeDspSessionId = 0;
  runtimeGeneration = 0;
  started = !1;
  deliveryInProgress = !1;
  deliveryRefreshPending = !1;
  lastAppliedRuntimeGeneration = -1;
  lastAppliedUploadTokens = Array.from(
    { length: K },
    () => null
  );
  recoveryTimer = null;
  lastRejectedReplayToken = null;
  installLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.installLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(pt, this.handleRuntimeStateBound), this.requestBootState());
  }
  stop() {
    this.started && (this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(pt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedReplayToken = null, this.installLane.stop());
  }
  requestBootState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((e) => {
        this.applyModulationState(Me(e, ee)), this.applyPatchValues(Me(e, U)), this.applyArticulationState(Me(e, te));
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue != "function") {
      this.applyModulationState(void 0), this.applyPatchValues(void 0), this.applyArticulationState(void 0);
      return;
    }
    this.pendingBootStoredValues = /* @__PURE__ */ new Map();
    for (const e of xe)
      this.connection.requestStoredStateValue(e);
  }
  handleStoredStateValue(e) {
    if (!e || typeof e != "object")
      return;
    const n = e;
    if (typeof n.key == "string" && this.pendingBootStoredValues !== null && xe.some((i) => i === n.key)) {
      if (this.pendingBootStoredValues.set(n.key, n.value), this.pendingBootStoredValues.size === xe.length) {
        const i = this.pendingBootStoredValues;
        this.pendingBootStoredValues = null, this.applyModulationState(i.get(ee)), this.applyPatchValues(i.get(U)), this.applyArticulationState(i.get(te));
      }
      return;
    }
    n.key === te ? this.applyArticulationState(n.value) : n.key === U ? this.applyPatchValues(n.value) : n.key === ee && this.applyModulationState(n.value);
  }
  handleRuntimeState(e) {
    const n = Ar(e);
    if (this.installLane.observeRuntime(n), !this.hasRuntimeState) {
      this.hasRuntimeState = !0, this.runtimeDspSessionId = n, this.applyRuntimeStateIfReady();
      return;
    }
    n !== this.runtimeDspSessionId && (this.runtimeDspSessionId = n, this.runtimeGeneration += 1, this.clearRecoveryTimer(), this.lastRejectedReplayToken = null, this.applyRuntimeStateIfReady());
  }
  applyArticulationState(e) {
    let n;
    try {
      n = xr(e, this.currentArticulationRouteIds());
    } catch (i) {
      return console.error("[articulation-worker] Stored v3 articulation state is invalid.", i), this.hasArticulationState || (this.hasArticulationState = !0, this.applyRuntimeStateIfReady()), !1;
    }
    return this.articulationBank = n, this.hasArticulationState = !0, this.applyRuntimeStateIfReady(), !0;
  }
  applyPatchValues(e) {
    let n;
    try {
      n = fr(e);
    } catch (o) {
      if (console.error("[articulation-worker] Stored patch-base state is invalid.", o), this.hasPatchValues)
        return;
      n = Oe();
    }
    const i = hr(n), r = i !== this.patchValuesDependencyToken;
    this.uiPatchValues = n, this.patchValuesDependencyToken = i;
    const a = this.hasPatchValues;
    this.hasPatchValues = !0, (!a || r) && this.applyRuntimeStateIfReady();
  }
  applyModulationState(e) {
    let n = me();
    if (e !== void 0) {
      const o = en(e);
      if (o._tag === "err") {
        console.error("[articulation-worker] Stored modulation state is invalid.", o.error);
        return;
      } else
        n = o.value;
    }
    const i = dr(n), r = i !== this.modulationDependencyToken;
    this.modulationState = n, this.modulationDependencyToken = i;
    const a = this.hasModulationState;
    this.hasModulationState = !0, (!a || r) && this.applyRuntimeStateIfReady();
  }
  buildUploadsBySelector() {
    const e = Hi(
      mr(this.modulationState, this.uiPatchValues),
      this.articulationBank
    );
    return new Map(
      e.map((n) => [n.selectorA, n])
    );
  }
  currentArticulationRouteIds() {
    return new Set(this.modulationState.routes.flatMap((e) => Ue(e) === null ? [] : [e.id]));
  }
  applyRuntimeStateIfReady() {
    if (!(!this.hasArticulationState || !this.hasModulationState || !this.hasPatchValues || !this.hasRuntimeState)) {
      if (this.deliveryInProgress) {
        this.deliveryRefreshPending = !0;
        return;
      }
      this.clearRecoveryTimer(), this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.deliverRuntimeState().catch((e) => {
        console.error("[articulation-worker] Acknowledged snapshot delivery failed unexpectedly.", {
          errorType: e instanceof Error ? e.name : typeof e
        }), this.scheduleRecovery(), this.finishDelivery(!1, this.runtimeGeneration, this.lastAppliedUploadTokens);
      });
    }
  }
  async deliverRuntimeState() {
    const e = this.runtimeGeneration, n = await this.installLane.waitForSessionBaseline();
    if (n._tag !== "accepted") {
      this.handleInstallOutcome(
        n,
        e,
        this.lastAppliedUploadTokens
      );
      return;
    }
    const i = this.buildUploadsBySelector(), r = Array.from(
      { length: K },
      (s, c) => {
        const h = i.get(c);
        return h ? yt(h) : null;
      }
    ), a = this.lastAppliedRuntimeGeneration !== e, o = a && this.installLane.getAcceptedFrontier() !== 0, l = [];
    for (let s = 0; s < K; s += 1) {
      const c = i.get(s), h = r[s] !== this.lastAppliedUploadTokens[s];
      o ? l.push({
        endpointID: we,
        value: c ?? st(s)
      }) : a ? c && l.push({ endpointID: we, value: c }) : h && l.push({
        endpointID: we,
        value: c ?? st(s)
      });
    }
    if (l.length === 0) {
      this.finishDelivery(!0, e, r);
      return;
    }
    this.handleInstallOutcome(
      await this.installLane.sendBatch(l),
      e,
      r
    );
  }
  handleInstallOutcome(e, n, i) {
    switch (e._tag) {
      case "accepted":
        this.clearRecoveryTimer(), this.lastRejectedReplayToken = null, this.finishDelivery(!0, n, i);
        return;
      case "superseded":
      case "stopped":
        this.finishDelivery(!1, n, i);
        return;
      case "transport-timeout":
        console.error("[articulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
          dspSessionId: this.runtimeDspSessionId
        }), this.scheduleRecovery(), this.finishDelivery(!1, n, i);
        return;
      case "rejected":
        const r = yt(i), a = r !== this.lastRejectedReplayToken;
        console.error("[articulation-worker] DSP rejected an acknowledged snapshot.", {
          dspSessionId: this.runtimeDspSessionId,
          rejectedSerial: e.acknowledgement.rejectedSerial,
          rejectionReason: e.acknowledgement.rejectionReason,
          fullReplayScheduled: a
        }), a && (this.lastRejectedReplayToken = r, this.scheduleRecovery()), this.finishDelivery(!1, n, i);
        return;
      case "unavailable":
        this.started && (console.error("[articulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
          dspSessionId: this.runtimeDspSessionId,
          reason: e.reason
        }), this.scheduleRecovery()), this.finishDelivery(!1, n, i);
    }
  }
  clearRecoveryTimer() {
    this.recoveryTimer !== null && (clearTimeout(this.recoveryTimer), this.recoveryTimer = null);
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, wr));
  }
  finishDelivery(e, n, i) {
    if (this.deliveryInProgress = !1, !this.started)
      return;
    e && (this.lastAppliedRuntimeGeneration = n, this.lastAppliedUploadTokens = i);
    const r = this.deliveryRefreshPending || n !== this.runtimeGeneration;
    this.deliveryRefreshPending = !1, r && this.applyRuntimeStateIfReady();
  }
}
function Er(t) {
  return new Mr(t);
}
const he = "runtimeState";
function Fe(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const kr = {
  endpointID: he,
  required: !0,
  mapValue: Fe
}, Dr = 2e3;
function St(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Cr(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return St(i, e) ? {
    found: !0,
    value: i[e]
  } : St(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function bt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Pr {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = _r(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Cr(e, this.options.stateKey);
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
    const i = (r) => {
      this.parameterValues.set(e, r), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, i), i;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const i = (r) => {
      const a = e.mapValue ? e.mapValue(r) : r;
      this.runtimeEndpointValues.set(e.endpointID, a), this.applyRuntimeStateIfReady();
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
    }, r = bt(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, o = this.options.buildRuntimeEvents(i, a), l = bt({
      runtimeEndpoints: n,
      events: o
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (o.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(o, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(o);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(o);
        const s = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, s && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of o)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Dr
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function _r(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function sn(t, e) {
  return new Pr(t, e);
}
const Or = 1e3;
function Fr(t) {
  const e = new on(t, { laneKind: "modulation" });
  let n = !1, i = null, r = null, a = null;
  const o = sn(t, {
    stateKey: ee,
    applyDefaultRuntimeStateWhenMissing: !0,
    runtimeEndpointDependencies: [{
      endpointID: he,
      required: !0,
      mapValue: Fe
    }],
    deserializeStoredState: (d) => {
      if (d === void 0)
        return me();
      const f = en(d);
      return f._tag === "ok" ? f.value : null;
    },
    buildRuntimeEvents: ({ state: d }, f) => Oi(
      d,
      f?.state ?? null
    ),
    sendRuntimeEvents: async (d, f) => c(
      await e.sendBatch(d),
      f
    )
  });
  function l() {
    r !== null && (clearTimeout(r), r = null);
  }
  function s() {
    !n || r !== null || (r = setTimeout(() => {
      r = null, n && o.replayFullRuntimeState();
    }, Or));
  }
  function c(d, f) {
    switch (d._tag) {
      case "accepted":
        return l(), a = null, !0;
      case "superseded":
      case "stopped":
        return !1;
      case "transport-timeout":
        return console.error("[modulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
          dspSessionId: i
        }), s(), !1;
      case "rejected":
        const g = JSON.stringify(f) ?? String(f), v = g !== a;
        return console.error("[modulation-worker] DSP rejected the acknowledged runtime batch.", {
          dspSessionId: i,
          rejectedSerial: d.acknowledgement.rejectedSerial,
          rejectionReason: d.acknowledgement.rejectionReason,
          fullReplayScheduled: v
        }), v && (a = g, s()), !1;
      case "unavailable":
        return n && (console.error("[modulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
          dspSessionId: i,
          reason: d.reason
        }), s()), !1;
    }
  }
  const h = (d) => {
    const f = Fe(d);
    if (e.observeRuntime(f), i === null) {
      i = f;
      return;
    }
    f !== i && (i = f, l(), a = null);
  };
  return {
    start() {
      n || (n = !0, e.start(), t.addEndpointListener?.(he, h), o.start());
    },
    stop() {
      n && (n = !1, l(), a = null, o.stop(), t.removeEndpointListener?.(he, h), e.stop());
    }
  };
}
const T = "rack.v1", Lr = "rackOrder", Nr = "rackEnable", V = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), ln = Object.freeze({
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
  V.map((t) => [ln[t], t])
);
function cn() {
  return {
    filter: !1,
    drive: !1,
    ott: !1,
    chorus: !1,
    flanger: !1,
    phaser: !1,
    delay: !1,
    reverb: !1
  };
}
function vt() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...V],
    enabled: cn()
  };
}
function Ur(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${T} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${T} is not valid JSON: ${n}` };
  }
}
function It(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Vr(t) {
  return typeof t != "string" ? null : V.find((e) => e === t) ?? null;
}
function Br(t) {
  const e = Ur(t);
  if (e._tag === "err")
    return e;
  if (!It(e.value))
    return { _tag: "err", message: `${T} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const o of Reflect.ownKeys(e.value))
    if (typeof o != "string" || !n.has(o))
      return { _tag: "err", message: `${T} has unexpected field ${String(o)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${T} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== V.length)
    return { _tag: "err", message: `${T}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const o of e.value.order) {
    const l = Vr(o);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${T}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!It(e.value.enabled))
    return { _tag: "err", message: `${T}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== V.length)
    return { _tag: "err", message: `${T}.enabled must contain every effect once` };
  const a = cn();
  for (const o of V) {
    const l = e.value.enabled[o];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${T}.enabled.${o} must be boolean` };
    a[o] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: a }
  };
}
function $r(t) {
  if (t === void 0)
    return vt();
  const e = Br(t);
  return e._tag === "ok" ? e.value : vt();
}
function Wr(t) {
  return [
    {
      endpointID: Lr,
      value: { moduleIds: t.order.map((e) => ln[e]) }
    },
    {
      endpointID: Nr,
      value: { enabledFlags: V.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
function Kr(t) {
  return sn(t, {
    stateKey: T,
    runtimeEndpointDependencies: [kr],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: $r,
    buildRuntimeEvents: ({ state: e }) => [...Wr(e)]
  });
}
const jr = "runtimeSyncRequest", zr = 2147483647, qr = "runtimeState", Hr = "retryDesiredTableRequest", Jr = "workerLoadFailure", Gr = "serviceLoadAbort", Qr = "wavetableLoadBegin", Xr = "wavetableMipFrame", Yr = "wavetableUploadAck", Zr = "wavetableMipRequest", ea = "wavetablePrewarmRequest", ta = "wavetablePrewarmNotification", na = "assets/factory-bank-catalog.json", ia = 1, ra = 2, aa = 3, oa = 1, sa = 2, la = 2e4, ue = ia, ca = ra, Rt = aa, F = oa, Tt = sa, ua = 48 * 1024 * 1024;
function wt(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function y(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function At(t) {
  return {
    dspSessionId: t.dspSessionId,
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
function xt(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function Mt(t, e) {
  if (!t)
    throw new Error(e);
}
function da(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function ha(t, e) {
  return bn(await t.readJSON(e));
}
function fa(t) {
  return {
    dspSessionId: Math.trunc(Number(t?.dspSessionId) || 0),
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
function ma(t, e) {
  const n = Math.round(Number(t) || 0);
  return da(n, 0, Math.max(0, e - 1));
}
function Ee(t, e, n) {
  return `${t}:${e}:${n}`;
}
function pa(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Et(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function kt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function Dt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class ga {
  connection;
  resourceClient;
  catalogPath;
  maxFramesInFlight;
  mipLevelCount;
  cacheBudgetBytes;
  serviceLoadTimeoutMs;
  setTimeoutFn;
  clearTimeoutFn;
  catalog = null;
  started = !1;
  knownSessionId = 0;
  nextLoadGeneration = 1;
  latestRuntimeState = null;
  asyncStateToken = 0;
  serviceTable = null;
  candidateValidation = null;
  mipJobs = /* @__PURE__ */ new Map();
  activeUploadKey = null;
  serviceLoadWatchdogHandle = null;
  autoRetryConsumedKey = null;
  tableCache = /* @__PURE__ */ new Map();
  tableCacheBytes = 0;
  cacheUseSerial = 1;
  constructor(e, n = {}) {
    this.connection = e, this.resourceClient = Sn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? na, this.maxFramesInFlight = wt(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? Ot, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ua) || 0)), this.serviceLoadTimeoutMs = wt(n.serviceLoadTimeoutMs, la), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, y("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(qr, this.handleRuntimeState), this.connection.addEndpointListener?.(Yr, this.handleUploadAck), this.connection.addEndpointListener?.(Zr, this.handleMipRequest), this.connection.addEndpointListener?.(ea, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ta, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      jr,
      zr
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await ha(this.resourceClient, this.catalogPath), y("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.nextLoadGeneration = Math.max(1, e.generationFrontier + 1), this.serviceTable = null, this.candidateValidation = null, this.mipJobs.clear(), this.activeUploadKey = null, this.autoRetryConsumedKey = null;
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog(), this.mipJobs.clear(), this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(e) {
    this.tableCacheBytes -= e.byteCount, e.byteCount = Et(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      for (const [r, a] of this.tableCache)
        e.has(r) || (!i || a.lastUsedSerial < i.lastUsedSerial) && (n = r, i = a);
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
      byteCount: Et(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ee(
          this.serviceTable.dspSessionId,
          this.serviceTable.generation,
          n
        );
        this.mipJobs.has(i) || this.mipJobs.set(i, {
          key: i,
          dspSessionId: this.serviceTable.dspSessionId,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...kt(this.serviceTable.frameCount),
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
      if (e.dspSessionId === this.serviceTable.dspSessionId && e.generation === this.serviceTable.generation && e.tableIndex === this.serviceTable.tableIndex && !e.completed && (e.inFlightFrames.size > 0 || e.nextFrameIndex > 0))
        return !0;
    return !1;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId: e, generation: n, tableIndex: i } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.generation !== n || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (y("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        generation: n,
        tableIndex: i,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          generation: n,
          tableIndex: i
        },
        {
          failurePhase: Rt,
          failureReasonCode: Tt
        }
      ), this.serviceTable = null, this.clearMipTransferState());
    }, this.serviceLoadTimeoutMs), this.serviceLoadWatchdogHandle?.unref?.();
  }
  resolveServiceTarget(e) {
    return e.hasLoading ? {
      kind: "loading",
      dspSessionId: e.dspSessionId,
      generation: e.loadingGeneration,
      tableIndex: e.loadingTableIndex
    } : e.hasActive ? {
      kind: "active",
      dspSessionId: e.dspSessionId,
      generation: e.activeGeneration,
      tableIndex: e.activeTableIndex
    } : null;
  }
  shouldStayIdleOnFailure(e) {
    return e.hasFailure && e.failedTableIndex === e.desiredTableIndex && e.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(e) {
    return `${e.dspSessionId}:${e.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(e) {
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Rt || e.failureReasonCode !== Tt ? !1 : this.autoRetryConsumedKey !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    tableIndex: n,
    generation: i = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = ue,
    failureReasonCode: o = F
  }) {
    this.connection.sendEventOrValue?.(Jr, {
      dspSessionId: e,
      tableIndex: n,
      generation: i,
      candidateAttemptSerial: r,
      failurePhase: a,
      failureReasonCode: o
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    generation: n,
    tableIndex: i,
    failureReasonCode: r = F
  }) {
    this.connection.sendEventOrValue?.(Gr, {
      dspSessionId: e,
      generation: n,
      tableIndex: i,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest() {
    y("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? At(this.latestRuntimeState) : null
    }), this.connection.sendEventOrValue?.(Hr, 1);
  }
  async loadTableSource(e, n, i) {
    const r = await this.ensureCatalogLoaded();
    if (i !== this.asyncStateToken)
      return null;
    const a = ma(e, r.tables.length), o = r.tables[a];
    Mt(o, `Could not resolve table ${a}`);
    const l = pa(o, Je, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, y("info", "Using cached wavetable source table", {
        tableIndex: a,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = Dt();
    y("info", "Reading wavetable source", {
      tableIndex: a,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const h = await this.resourceClient.readAudio(o.sourceWav), d = wn(h.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Je
    });
    return !d || i !== this.asyncStateToken ? null : (y("info", "Prepared wavetable source table", {
      tableIndex: a,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(Dt() - c)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: a,
      tableMeta: o,
      frameCount: d.frameCount,
      frames: d.frames,
      spectra: new Array(d.frameCount)
    }));
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    y("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: i.tableMeta?.name ?? null,
      frameCount: i.frameCount
    }), this.serviceTable = {
      ...i,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidation = {
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGeneration = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Qr, {
      dspSessionId: e.dspSessionId,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    y("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: ue,
      failureReasonCode: F
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: ue,
      failureReasonCode: F
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = ue,
    failureReasonCode: i = F
  } = {}) {
    y("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: i
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: i
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: i
    });
  }
  async prepareServiceTarget(e, n, i) {
    if (this.isMatchingServiceTable(e))
      return this.serviceTable && (this.serviceTable.mode = e.kind), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0;
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex, void 0, i);
    } catch (a) {
      return i === this.asyncStateToken && (y("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: ke(a)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    return !r || i !== this.asyncStateToken ? !1 : (this.serviceTable = {
      ...r,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads()), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0);
  }
  async prepareDesiredLoad(e, n) {
    const i = e.desiredTableIndex;
    if (this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.tableIndex === i && this.candidateValidation.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const r = Math.max(
      this.nextLoadGeneration,
      e.generationFrontier + 1
    );
    let a = null;
    try {
      a = await this.loadTableSource(i, void 0, n);
    } catch (o) {
      n === this.asyncStateToken && (y("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: i,
        detail: ke(o)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !a || n !== this.asyncStateToken || this.markCommittedDesiredLoad(e, r, a);
  }
  async prepareDesiredCandidate(e, n) {
    await this.prepareDesiredLoad(e, n);
  }
  async handleRuntimeState(e) {
    try {
      const n = fa(e ?? {});
      if (y("info", "Received runtime state", At(n)), n.dspSessionId <= 0)
        return;
      const i = n.dspSessionId !== this.knownSessionId, r = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null, a = this.getDesiredRetryKey(n);
      i ? this.resetSessionState(n) : this.nextLoadGeneration = Math.max(
        this.nextLoadGeneration,
        n.generationFrontier + 1
      ), (i || r !== a) && (this.autoRetryConsumedKey = null), this.latestRuntimeState = n;
      const o = this.asyncStateToken + 1;
      if (this.asyncStateToken = o, this.candidateValidation && this.candidateValidation.dspSessionId === n.dspSessionId && this.candidateValidation.generation > n.generationFrontier)
        return;
      const l = this.resolveServiceTarget(n), s = i && l?.kind === "active";
      if (l) {
        if (!await this.prepareServiceTarget(l, n, o))
          return;
        if (l.kind === "loading" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n)) {
          y("warn", "Aborting obsolete wavetable load because the desired table changed", {
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            staleTableIndex: l.tableIndex,
            desiredTableIndex: n.desiredTableIndex,
            desiredIntentSerial: n.desiredIntentSerial
          }), this.emitServiceLoadAbort({
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            tableIndex: l.tableIndex,
            failureReasonCode: F
          }), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        l.kind === "active" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n) && !s && await this.prepareDesiredCandidate(n, o);
        return;
      }
      if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(n)) {
        this.autoRetryConsumedKey = a, this.emitRetryDesiredTableRequest();
        return;
      }
      if (n.serviceState !== 0 || this.shouldStayIdleOnFailure(n))
        return;
      await this.prepareDesiredLoad(n, o);
    } catch (n) {
      console.error(n);
    }
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (!Number.isFinite(i))
      return;
    const r = this.asyncStateToken;
    try {
      const a = await this.loadTableSource(i, void 0, r);
      if (!a || r !== this.asyncStateToken)
        return;
      for (let l = 0; l < a.frameCount; l += 1)
        a.spectra[l] || (a.spectra[l] = Qe(a.frames[l]));
      const o = this.tableCache.get(a.cacheKey);
      o && this.refreshCacheEntryByteCount(o), y("info", "Prewarmed wavetable source table", {
        tableIndex: a.tableIndex,
        tableId: a.tableMeta.tableId,
        tableName: a.tableMeta.name,
        reason: typeof n?.reason == "string" ? n.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (a) {
      y("warn", "Ignoring wavetable prewarm failure", {
        tableIndex: i,
        reason: typeof n?.reason == "string" ? n.reason : null,
        detail: ke(a)
      });
    }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), o = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = Ee(n, i, a);
    let s = this.mipJobs.get(l);
    return s ? (!s.completed && o > s.urgencyLevel && (s.urgencyLevel = o), s) : (s = {
      key: l,
      dspSessionId: n,
      generation: i,
      tableIndex: r,
      mipIndex: a,
      urgencyLevel: o,
      ...kt(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, s), s);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (y("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndex)), l = Ee(i, r, a), s = this.mipJobs.get(l);
    !s || s.completed || !s.inFlightFrames.has(o) || (s.inFlightFrames.delete(o), s.ackedFrames[o] || (s.ackedFrames[o] = 1, s.ackedFrameCount += 1), s.ackedFrameCount === this.serviceTable?.frameCount && s.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && s.inFlightFrames.size === 0 && (s.completed = !0, this.activeUploadKey === s.key && (this.activeUploadKey = null)), xt(o, this.serviceTable?.frameCount ?? 0) && y("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      generation: r,
      tableIndex: s.tableIndex,
      mipIndex: a,
      frameIndex: o,
      ackedFrameCount: s.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (Mt(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Qe(this.serviceTable.frames[e]);
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
  pumpUploads() {
    if (!this.serviceTable)
      return;
    let e = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!e || e.completed) && (e = this.selectNextMipJob(), this.activeUploadKey = e?.key ?? null), !!e) {
      for (; e.inFlightFrames.size < this.maxFramesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
        const n = e.nextFrameIndex;
        let i;
        try {
          const r = this.getSpectrumForFrame(n);
          i = An(r, e.mipIndex);
        } catch {
          this.handleServiceTargetFailure(
            {
              kind: this.serviceTable.mode ?? "loading",
              dspSessionId: e.dspSessionId,
              generation: e.generation,
              tableIndex: e.tableIndex
            },
            {
              failurePhase: ca,
              failureReasonCode: F
            }
          ), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        this.connection.sendEventOrValue?.(Xr, {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          samples: Array.from(i)
        }), xt(n, this.serviceTable.frameCount) && y("info", "Sent wavetable mip frame", {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          frameCount: this.serviceTable.frameCount,
          inFlightFrames: e.inFlightFrames.size + 1
        }), e.inFlightFrames.add(n), e.nextFrameIndex += 1, this.armServiceLoadWatchdog();
      }
      e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightFrames.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
    }
  }
}
function ke(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function ya(t, e = {}) {
  return new ga(t, e);
}
async function Sa(t, e = {}) {
  return En(t, [
    Fr,
    Kr,
    Er,
    () => ya(t, e)
  ]);
}
export {
  ra as FAILURE_PHASE_BUILD_MIP,
  ia as FAILURE_PHASE_LOAD_SOURCE,
  aa as FAILURE_PHASE_TRANSFER_MIP,
  oa as FAILURE_REASON_GENERIC,
  sa as FAILURE_REASON_TIMEOUT,
  zr as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  ga as WavetableWorkerController,
  ya as createWavetableWorkerController,
  Sa as default
};
