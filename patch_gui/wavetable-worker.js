function v(t, e) {
  if (!t)
    throw new Error(e);
}
function se(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function qt(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function be(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function ct(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const r = Object.keys(t).slice(0, 6), i = r.length > 0 ? ` keys=${r.join(",")}` : "";
  return n ? `${e}:${n}${i}` : `${e}${i}`;
}
function Gt() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function le(t, e) {
  const n = Gt();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (qt(e))
      return new URL(e);
    const r = e.startsWith("/") ? e.slice(1) : e;
    return new URL(r, n);
  }
  return new URL(t, n);
}
async function Oe(t) {
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
  throw new Error(`Unsupported text resource payload (${ct(t)})`);
}
function Ht(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return be(t);
  throw new Error(`Unsupported binary resource payload (${ct(t)})`);
}
function Jt(t) {
  const e = t?.frames;
  v(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), r = new Float32Array(n.length);
  for (let i = 0; i < n.length; i += 1) {
    const o = n[i];
    if (typeof o == "number") {
      r[i] = o;
      continue;
    }
    if (ArrayBuffer.isView(o) || Array.isArray(o)) {
      const a = o;
      v(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: r
  };
}
function dt(t) {
  const e = new DataView(t);
  v(se(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), v(se(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = se(e, c, 4), f = e.getUint32(c + 4, !0), m = c + 8;
    u === "fmt " ? (n = e.getUint16(m, !0), r = e.getUint16(m + 2, !0), i = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), o = e.getUint16(m + 14, !0)) : u === "data" && (l = m, s = f), c = m + f + f % 2;
  }
  v(n !== null, "Wave file is missing a fmt chunk"), v(l !== null && s !== null, "Wave file is missing a data chunk"), v(r === 1, "Only mono wavetable bank files are supported");
  let h;
  if (n === 3 && o === 32)
    h = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && o === 16) {
    const u = s / 2, f = new Int16Array(t.slice(l, l + s));
    h = new Float32Array(u);
    for (let m = 0; m < u; m += 1)
      h[m] = f[m] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: h
  };
}
async function _e(t) {
  v(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return v(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function ye(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ut(t) {
  const e = new Uint8Array(t).buffer, n = dt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Qt(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (s) => (v(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), i = async (s) => {
    v(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return Jt(c);
  }, o = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const h = le(s, c), u = await _e(h), f = dt(u);
    return {
      sampleRate: f.sampleRate,
      samples: f.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const h = le(s, c);
    return new Uint8Array(await _e(h));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Oe(await r(s));
      const c = o(s);
      return e === "url" && c !== null ? ye(await l(s, c)) : typeof t.readResource == "function" ? Oe(await r(s)) : ye(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Ht(await r(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return i(s);
      const c = o(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? i(s) : ut(await this.readBytes(s));
    },
    getURL(s) {
      return le(s, t.getResourceAddress?.(s));
    }
  };
}
function Xt(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Qt(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Yt(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, r = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, i = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return ye(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (e)
        return be(await e(a));
      if (n)
        return be(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : ut(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Zt(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function en(t) {
  return Zt(t) ? Yt(t) : Xt(t);
}
const Ce = 2048;
function $(t, e) {
  if (!t)
    throw new Error(e);
}
function tn(t) {
  $(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    $(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), $(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), $(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), $(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const nn = 2048, ft = 11, rn = 256;
function T(t, e) {
  if (!t)
    throw new Error(e);
}
function on(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Le = /* @__PURE__ */ new Map();
function an(t) {
  const e = Le.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let o = 0, a = i;
    for (let l = 0; l < n; l += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return Le.set(t, r), r;
}
function ht(t, e, n = !1) {
  const r = t.length;
  T(r === e.length, "FFT real and imaginary buffers must have the same length"), T(on(r), "FFT input length must be a power of two");
  const i = an(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const l = t[o];
    t[o] = t[a], t[a] = l;
    const s = e[o];
    e[o] = e[a], e[a] = s;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, l = (n ? 2 : -2) * Math.PI / o, s = Math.cos(l), c = Math.sin(l);
    for (let h = 0; h < r; h += o) {
      let u = 1, f = 0;
      for (let m = 0; m < a; m += 1) {
        const I = h + m, y = I + a, R = t[y], P = e[y], U = u * R - f * P, V = u * P + f * R, B = t[I], K = e[I];
        t[I] = B + U, e[I] = K + V, t[y] = B - U, e[y] = K - V;
        const q = u * s - f * c;
        f = u * c + f * s, u = q;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      t[o] /= r, e[o] /= r;
}
function mt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const r = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    i[o] = (Number(e[o]) || 0) - r;
  return i;
}
function sn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = nn,
  maxFramesPerTable: r = rn
} = {}) {
  const i = Float32Array.from(t);
  T(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  T(o > 0, "Source wavetable files must contain at least one frame"), T(o <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && T(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let l = 0; l < o; l += 1) {
    const s = l * n, c = s + n;
    a.push(mt(i.slice(s, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Fe(t) {
  const e = mt(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return ht(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function ln(t, e, {
  mipLevelCount: n = ft
} = {}) {
  const r = t?.real?.length ?? 0;
  T(r > 0, "Spectrum must contain real samples"), T(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), T(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let l = 1; l <= i; l += 1) {
    o[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (r - l) % r;
    s !== l && (o[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return ht(o, a, !0), Float32Array.from(o);
}
class cn {
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
        for (const r of [...this.services].reverse())
          try {
            await r.stop?.();
          } catch (i) {
            n.push(i);
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
function dn(t, e) {
  return new cn(t, e);
}
async function un(t, e) {
  const n = dn(t, e);
  return await n.start(), n;
}
const b = (t, e) => ({ label: t, value: e });
function x(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const E = Object.freeze({
  filter: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: x(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), d = (t, e, n, r, i, o, a, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: r,
  min: i,
  max: o,
  initial: a,
  step: l.step ?? (o - i) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), fn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], hn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], mn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: E.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(b), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: E.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Classic", 0), b("Harmonics", 1)] }),
      d("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      d("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      d("drive", "distortionWet", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 5 }),
      d("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      d("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: E.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      d("ott", "ottMix", "Mix", "Mix", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      d("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      d("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      d("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      d("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: E.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(b) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(b) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(b) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: E.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      d("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      d("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      d("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      d("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: E.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: fn.map(b) }),
      d("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      d("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      d("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      d("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      d("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: E.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: hn.map(b) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: E.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      d("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      d("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      d("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      d("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], pt = mn, gt = Object.freeze(
  pt.flatMap((t) => t.parameters)
);
new Map(
  gt.map((t) => [t.endpointID, t])
);
function It() {
  return gt;
}
const A = 2048, pn = A + 3, Ne = 20, bt = "MSEG 1", gn = 0, In = 2, bn = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Te(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function F(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function yn(t) {
  return Te(Number.isFinite(t) ? t : 0, -Ne, Ne);
}
function M(t) {
  return Te(Number.isFinite(t) ? t : 0, 0, 1);
}
function yt(t = bt) {
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
function St() {
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
function vt(t) {
  const e = Number(t);
  return Te(
    Number.isFinite(e) ? e : 1,
    gn,
    In
  );
}
function Sn(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = M(Number(e.startX)), r = M(Number(e.endX));
  return F(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Tt(t = St()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, r = Number(n.seconds), i = e.noteOffPolicy, o = bn.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: vt(Number.isFinite(r) ? r : 1)
    },
    loop: Sn(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function vn(t, e, n) {
  const r = t && typeof t == "object" ? t : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = M(i)), {
    x: i,
    y: M(Number(r.y)),
    curvePower: yn(Number(r.curvePower))
  };
}
function j(t = yt()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => vn(i, o, n.length));
  if (!F(r[0].x, 0) || !F(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : bt,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Pe(t) {
  return JSON.stringify(j(t));
}
function Ue(t) {
  return JSON.stringify(Tt(t));
}
function Tn(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function Rn(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (F(e, i.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && F(t[o + 1].x, e); )
        o += 1;
      return {
        from: t[o],
        to: t[o],
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
function xn(t, e) {
  const n = M(Number(e)), r = Rn(t, n);
  if (r.laterPointWins || F(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = M(Tn(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function En(t, e) {
  return xn(j(t).points, e);
}
function An(t) {
  const e = j(t), n = new Float32Array(A);
  for (let i = 0; i < A; i += 1) {
    const o = i / (A - 1);
    n[i] = En(e, o);
  }
  const r = new Float32Array(pn);
  return r[0] = n[0], r.set(n, 1), r[A + 1] = n[A - 1], r[A + 2] = n[A - 1], r;
}
function Ve(t, e) {
  return Pe(t) === Pe(e);
}
function wn(t, e) {
  return Ue(t) === Ue(e);
}
const Rt = ["A", "B", "C"], Mn = [
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
], kn = [
  "filterCutoffOctaves",
  "filterQ"
], O = Object.freeze([
  { id: "mseg-1", sourceKind: "mseg", sourceSlot: 1, group: "voice", runtimeIndex: 0 },
  { id: "mseg-2", sourceKind: "mseg", sourceSlot: 2, group: "voice", runtimeIndex: 1 },
  { id: "mseg-3", sourceKind: "mseg", sourceSlot: 3, group: "voice", runtimeIndex: 2 },
  { id: "env-1", sourceKind: "env", sourceSlot: 1, group: "voice", runtimeIndex: 3 },
  { id: "env-2", sourceKind: "env", sourceSlot: 2, group: "voice", runtimeIndex: 4 },
  { id: "env-3", sourceKind: "env", sourceSlot: 3, group: "voice", runtimeIndex: 5 },
  { id: "macro-1", sourceKind: "macro", sourceSlot: 1, group: "macro", runtimeIndex: 0 },
  { id: "macro-2", sourceKind: "macro", sourceSlot: 2, group: "macro", runtimeIndex: 1 },
  { id: "macro-3", sourceKind: "macro", sourceSlot: 3, group: "macro", runtimeIndex: 2 },
  { id: "macro-4", sourceKind: "macro", sourceSlot: 4, group: "macro", runtimeIndex: 3 },
  { id: "velocity", sourceKind: "velocity", sourceSlot: null, group: "voice", runtimeIndex: 6 },
  { id: "pressure", sourceKind: "pressure", sourceSlot: null, group: "voice", runtimeIndex: 7 },
  { id: "slide", sourceKind: "slide", sourceSlot: null, group: "voice", runtimeIndex: 8 }
]), Dn = Object.freeze([
  ...Rt.flatMap((t) => Mn.map(
    (e) => `osc${t}.${e}`
  )),
  ...kn
]), xt = Object.freeze(
  Dn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), On = It().filter((t) => t.modulationTargetIndex !== null), Et = Object.freeze(
  On.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), w = Object.freeze([
  ...xt,
  ...Et
]), X = O.length, At = xt.length, wt = Et.length, _n = X * w.length, Cn = new Map(O.map((t) => [t.id, t])), Mt = new Map(O.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), N = new Map(w.map((t) => [t.kind, t]));
function Ln() {
  if (X !== 13 || At !== 32 || wt !== 36 || _n !== 884)
    throw new Error("Modulation identity catalog has an unexpected domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = O.filter((i) => i.group === t), r = n.map((i) => i.runtimeIndex).sort((i, o) => i - o);
    if (n.length !== e || r.some((i, o) => i !== o))
      throw new Error(`Modulation ${t} source indexes must be unique and contiguous`);
  }
  for (const [t, e] of [["voice", 32], ["rack", 36]]) {
    const n = w.filter((i) => i.group === t), r = n.map((i) => i.runtimeIndex).sort((i, o) => i - o);
    if (n.length !== e || r.some((i, o) => i !== o))
      throw new Error(`Modulation ${t} target indexes must be unique and contiguous`);
  }
  if (Cn.size !== X || Mt.size !== X || N.size !== w.length)
    throw new Error("Modulation identities must be unique");
}
Ln();
function kt(t, e) {
  const n = Mt.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Re(t) {
  return typeof t != "string" ? null : N.has(t) ? t : null;
}
function Fn(t) {
  const e = Re(t);
  return e !== null && N.get(e)?.group === "voice" ? e : null;
}
function Nn(t) {
  const e = Re(t);
  return e !== null && N.get(e)?.group === "rack" ? e : null;
}
function Pn(t) {
  const e = N.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Un(t) {
  const e = N.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Vn(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const ce = "modulationProgram", Bn = "modulationAmount", Dt = O.filter((t) => t.group === "voice").length, Ot = O.filter((t) => t.group === "macro").length, Z = At, ee = wt, C = Dt * Z, z = Ot * Z, _ = Dt * ee, W = Ot * ee;
function Kn(t) {
  const e = kt(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function $n(t) {
  const e = Fn(t);
  return e === null ? null : Pn(e);
}
function zn(t) {
  const e = $n(t.targetKind), n = Nn(t.targetKind), r = n === null ? void 0 : Un(n);
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = kt(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = a.runtimeIndex;
    if (e !== null) {
      const c = l * Z + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: l,
        targetIndex: e,
        articulationCellIndex: C + c
      };
    }
    const s = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * ee + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const i = Kn(t);
  if (e !== null) {
    const a = i * Z + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: i,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const o = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: i * ee + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Wn(t) {
  return {
    ...zn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function _t(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    const r = Wn(n), i = e[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return e;
}
function jn(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function L(t) {
  return [...t.values()].filter(jn).sort((e, n) => e.cellIndex - n.cellIndex);
}
function G(t, e, n, r, i) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function de(t) {
  const e = _t(t), n = L(e.voice), r = L(e.macroVoice), i = L(e.voiceRack), o = L(e.macroRack), a = Array.from({ length: C }, () => 0), l = Array.from({ length: C }, () => 0), s = Array.from({ length: C }, () => 0), c = Array.from({ length: C }, () => 0), h = Array.from({ length: C }, () => 0);
  G(n, a, l, s, c);
  const u = Array.from({ length: z }, () => 0), f = Array.from({ length: z }, () => 0), m = Array.from({ length: z }, () => 0), I = Array.from({ length: z }, () => 0), y = Array.from({ length: z }, () => 0);
  G(
    r,
    u,
    f,
    m,
    I
  );
  const R = Array.from({ length: _ }, () => 0), P = Array.from({ length: _ }, () => 0), U = Array.from({ length: _ }, () => 0), V = Array.from({ length: _ }, () => 0), B = Array.from({ length: _ }, () => 0), K = Array.from({ length: _ }, () => 0);
  G(
    i,
    R,
    P,
    U,
    V
  );
  const q = Array.from({ length: W }, () => 0), Ae = Array.from({ length: W }, () => 0), we = Array.from({ length: W }, () => 0), Me = Array.from({ length: W }, () => 0), ke = Array.from({ length: W }, () => 0);
  G(
    o,
    q,
    Ae,
    we,
    Me
  );
  for (const g of e.voice.values()) h[g.cellIndex] = g.amount;
  for (const g of e.macroVoice.values()) y[g.cellIndex] = g.amount;
  for (const g of e.voiceRack.values()) K[g.cellIndex] = g.amount;
  for (const g of e.macroRack.values()) ke[g.cellIndex] = g.amount;
  for (let g = 0; g < i.length; g += 1) {
    const De = i[g];
    if (De === void 0) throw new Error(`Missing compiled voice-rack route at index ${g}`);
    B[g] = De.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: h,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: u,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: m,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: R,
    voiceRackRouteSources: P,
    voiceRackRouteTargets: U,
    voiceRackRoutePolarities: V,
    voiceRackRouteReducers: B,
    voiceRackRouteAmounts: K,
    macroRackRouteCount: o.length,
    macroRackRouteCells: q,
    macroRackRouteSources: Ae,
    macroRackRouteTargets: we,
    macroRackRoutePolarities: Me,
    macroRackRouteAmounts: ke
  };
}
const qn = ["voice", "macroVoice", "voiceRack", "macroRack"], Gn = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Be(t) {
  return _t(t);
}
function Hn(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Jn(t, e) {
  if (t === null)
    return [{ endpointID: ce, value: de(e) }];
  const n = Be(t), r = Be(e), i = [];
  for (const o of qn) {
    const a = L(n[o]), l = L(r[o]);
    if (a.length !== l.length)
      return [{ endpointID: ce, value: de(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], h = l[s];
      if (c === void 0 || h === void 0 || !Hn(c, h))
        return [{ endpointID: ce, value: de(e) }];
      c.amount !== h.amount && i.push({
        endpointID: Bn,
        value: {
          pathKind: Gn[o],
          cellIndex: h.cellIndex,
          amount: h.amount
        }
      });
    }
  }
  return i;
}
function Qn(t) {
  return { _tag: "ok", value: t };
}
function ue(t) {
  return { _tag: "err", error: t };
}
function Xn(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Ke(t) {
  throw new Error(t ?? "Invariant violated");
}
function fe(t, e, n, r, i = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Yn = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      fe("cutoff", "Cutoff", 67, 70, "frequency"),
      fe("resonance", "Resonance", 25, 0),
      fe("drive", "Drive", 15, 0)
    ]
  }
], $e = 1e-6;
function ie(t, e) {
  if (!Number.isFinite(t) || t < -$e || t > 1 + $e)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function te(t, e) {
  return ie(t / 100, `${e} catalog percentage`);
}
function Ct(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Zn(t) {
  return 20 * 1e3 ** t;
}
function er(t) {
  return ie(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function tr(t) {
  return 0.1 * 200 ** t;
}
function nr(t) {
  return ie(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ze(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function rr(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: ze("filterCutoff", Zn, er),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ze("filterQ", tr, nr),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
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
function Lt(t) {
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
      return Xn(t);
  }
}
function ir(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function or(t, e) {
  const n = Ct(t.moduleId, e.id), r = Lt(e.format), i = rr(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: te(e.defaultPercent, n),
    initialValue: te(e.initialPercent, n),
    format: r,
    modAmount: ir(r),
    binding: i.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const ar = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: 80, defaultPercent: 80, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function sr(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function lr(t, e) {
  const n = `osc${t}`, r = Ct(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: te(e.defaultPercent, r),
    initialValue: te(e.initialPercent, r),
    format: Lt(e.format),
    modAmount: sr(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const cr = Object.freeze(
  Rt.flatMap((t) => ar.map((e) => lr(t, e)))
);
function dr(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function he(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return ie(n, `${t.endpointID} endpoint conversion`);
}
function ur(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function fr(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function hr(t) {
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
function mr(t) {
  const e = dr(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: he(t, t.initial),
    initialValue: he(t, t.initial),
    format: fr(t),
    modAmount: hr(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => ur(t, n),
      fromEngine: (n) => he(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const xe = Object.freeze(
  [
    ...pt.flatMap((t) => t.parameters.map(mr)),
    ...cr,
    ...Yn.flatMap(
      (t) => t.parameters.map(
        (e) => or(t, e)
      )
    )
  ]
), pr = new Map(
  xe.map((t) => [t.targetId, t])
), Ft = xe.filter(
  (t) => t.modulationTargetKind !== null
), ne = new Map(
  Ft.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (pr.size !== xe.length)
  throw new Error("Target descriptor IDs must be unique");
if (Ft.length !== w.length || ne.size !== w.length || w.some((t) => ne.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function gr(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = ne.get(t);
    return r === void 0 ? Ke(`Modulation target "${t}" has no display descriptor`) : `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = ne.get(t);
  return n === void 0 ? Ke(`Modulation target "${t}" has no display descriptor`) : n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const Ir = "modulation.v4", Nt = 4, oe = 3, ae = 3, We = "modulationMsegBuffer", br = "modulationMsegPlayback", yr = "modulationEnvelope", Pt = 4, Sr = ["MSEG 1", "MSEG 2", "MSEG 3"], Ut = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], vr = ["Env 1", "Env 2", "Env 3"], Tr = 1e-3, Rr = 10, xr = 0.1, Er = 20, Ar = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Er - xr },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, wr = It().filter((t) => t.modulationTargetIndex !== null), Mr = new Map(
  wr.map((t) => [`rack.${t.endpointID}`, t])
);
class me extends Error {
  name = "ModulationStateParseError";
}
const kr = {
  "mseg-1": "MSEG 1",
  "mseg-2": "MSEG 2",
  "mseg-3": "MSEG 3",
  "env-1": "ENV 1",
  "env-2": "ENV 2",
  "env-3": "ENV 3",
  velocity: "VEL",
  pressure: "AT",
  slide: "SLIDE",
  "macro-1": "MACRO 1",
  "macro-2": "MACRO 2",
  "macro-3": "MACRO 3",
  "macro-4": "MACRO 4"
};
O.map((t) => ({
  value: t.id,
  label: kr[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
w.map((t) => ({
  value: t.kind,
  label: gr(t.kind)
}));
function Dr(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ee(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function pe(t, e) {
  const n = Number(t);
  return Ee(Number.isFinite(n) ? n : e, Tr, Rr);
}
function Or(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function _r(t) {
  const e = Mr.get(t);
  return e !== void 0 ? Or(e) : Ar[Vn(t)];
}
function Cr(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Lr(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Fr(t, e) {
  const n = _r(t), r = Number(e);
  return Ee(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Nr(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Pr(t) {
  return Nr(t) ?? "mseg";
}
function Ur(t) {
  return Re(t);
}
function Vr(t) {
  return Ur(t) ?? "oscA.wavetablePosition";
}
function Br(t, e) {
  const n = Ut[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Kr(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? oe : t === "macro" ? Pt : ae;
  return Ee(Number.isFinite(n) ? n : 1, 1, r);
}
function Vt(t) {
  return {
    name: vr[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function $r(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = Vt(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: pe(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: pe(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: M(n.sustain ?? r.sustain),
    releaseSeconds: pe(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function zr(t, e, n, r) {
  const i = Number(t.amount);
  return {
    id: Cr(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Kr(n, t.sourceSlot),
    polarity: Lr(t.polarity),
    targetKind: r,
    amount: Fr(r, i),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Wr(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, i = Pr(r.sourceKind), o = Vr(r.targetKind);
  return zr(r, e, i, o);
}
function jr(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function qr(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => Wr(n, r));
}
function Gr(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const i = jr(r);
    if (e.has(r.id) || n.has(i))
      return !1;
    e.add(r.id), n.add(i);
  }
  return !0;
}
function Se(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => Se(a, e[l]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => Dr(r, a) && Se(n[a], r[a]));
}
function Bt(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = yt(Sr[e] ?? `MSEG ${e + 1}`), i = j(n.shapeA ?? r);
  return {
    shapeA: i,
    shapeB: j(n.shapeB ?? i),
    morph: M(n.morph ?? 0),
    playback: Tt(n.playback ?? St())
  };
}
function Kt() {
  return {
    format: "cosimo.modulation",
    version: Nt,
    msegSlots: Array.from({ length: oe }, (t, e) => Bt({}, e)),
    envelopeSlots: Array.from({ length: ae }, (t, e) => Vt(e)),
    routes: [],
    macroNames: Ut.slice()
  };
}
function Hr(t = Kt()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Nt,
    msegSlots: Array.from({ length: oe }, (o, a) => Bt(n[a], a)),
    envelopeSlots: Array.from({ length: ae }, (o, a) => $r(r[a], a)),
    routes: qr(e.routes),
    macroNames: Array.from(
      { length: Pt },
      (o, a) => Br(i[a], a)
    )
  };
}
function Jr(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ue(new me("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ue(new me("Expected valid modulation JSON"));
    }
  }
  const n = Hr(e);
  return !Se(e, n) || !Gr(n.routes) ? ue(new me("Expected the current modulation schema")) : Qn(n);
}
function Qr(t, e) {
  return {
    slot: t + 1,
    seconds: vt(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function je(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(An(n))
  };
}
function Xr(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function Yr(t, e = null) {
  const n = [];
  for (let r = 0; r < oe; r += 1) {
    const i = t.msegSlots[r], o = e?.msegSlots[r];
    (o === void 0 || !Ve(o.shapeA, i.shapeA)) && n.push({
      endpointID: We,
      value: je(r, 0, i.shapeA)
    }), (o === void 0 || !Ve(o.shapeB, i.shapeB)) && n.push({
      endpointID: We,
      value: je(r, 1, i.shapeB)
    }), (o === void 0 || !wn(o.playback, i.playback)) && n.push({
      endpointID: br,
      value: Qr(r, i.playback)
    });
  }
  for (let r = 0; r < ae; r += 1) {
    const i = t.envelopeSlots[r], o = e?.envelopeSlots[r];
    (o === void 0 || JSON.stringify(o) !== JSON.stringify(i)) && n.push({
      endpointID: yr,
      value: Xr(r, i)
    });
  }
  return n.push(...Jn(e?.routes ?? null, t.routes)), n;
}
const Y = "runtimeState";
function ve(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Zr = {
  endpointID: Y,
  required: !0,
  mapValue: ve
}, qe = "runtimeInstallAck", ei = "runtimeSyncRequest", Ge = 0, ti = 8e3, re = /* @__PURE__ */ new WeakMap(), $t = 1e9;
let H = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % $t;
function ni(t) {
  return H = H % $t + 1, t === "modulation" ? -1e9 - H : 1e9 + H;
}
function ri(t, e) {
  const n = t, r = re.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), re.set(n, r);
}
function He(t, e) {
  const n = t, r = re.get(n);
  r?.delete(e), r?.size === 0 && re.delete(n);
}
const ii = [100, 250, 500, 1e3], J = { _tag: "accepted" }, oi = { _tag: "superseded" }, ai = { _tag: "stopped" }, Je = { _tag: "transport-timeout" };
function si(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, l = r.rejectedSerial, s = r.rejectionReason, c = r.syncSerial;
  return ![
    i,
    o,
    a,
    l,
    s,
    c
  ].every((u) => typeof u == "number" && Number.isSafeInteger(u) && u >= -2147483648 && u <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || i < 0 || o < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function li(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class ci {
  #o;
  #e;
  #u;
  #S;
  #f = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #i = /* @__PURE__ */ new Map();
  #d = 0;
  #r = !1;
  #a = 0;
  #h = /* @__PURE__ */ new Set();
  #v = this.#M.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#u = r && r.length > 0 ? r : [...ii], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? ti)
    );
  }
  start() {
    if (!this.#r) {
      ri(this.#o, this.#e);
      try {
        this.#d += 1, this.#r = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(qe, this.#v);
      } catch (e) {
        throw this.#r = !1, He(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#r && (this.#r = !1, this.#o.removeEndpointListener?.(qe, this.#v), He(this.#o, this.#e), this.#i.clear(), this.#s = null, this.#l.clear(), this.#y());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#i.clear(), this.#a += 1, this.#y());
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
    const e = this.#t, n = this.#d;
    return this.#r ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
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
      for (const a of e) {
        const l = await this.#w(
          a,
          n,
          r
        );
        if (l._tag === "rejected" && this.#e === "articulation") {
          o ??= l;
          continue;
        }
        if (l._tag !== "accepted")
          return l;
      }
      return o ?? J;
    } finally {
      this.#f = !1;
    }
  }
  #x(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #E(e, n) {
    const r = this.#x(e);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #A() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#s === e)
      return J;
    const r = ni(this.#e);
    this.#l.add(r);
    const i = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return J;
        const l = i - Date.now();
        if (l <= 0)
          return Je;
        const s = this.#a;
        this.#I(r), await this.#b(
          s,
          Math.min(this.#g(o), l)
        ), o += 1;
      }
    } finally {
      this.#l.delete(r);
    }
  }
  async #w(e, n, r) {
    const i = this.#A(), o = li(e.value, n, i);
    let a = 0, l = 0, s = this.#c;
    for (this.#R(e.endpointID, o); ; ) {
      const c = this.#p(n, r);
      if (c)
        return c;
      const h = this.#m(n, i, s);
      if (h !== null)
        return h;
      const u = this.#a;
      await this.#b(
        u,
        this.#g(a)
      );
      const f = this.#m(
        n,
        i,
        s
      );
      if (f !== null)
        return f;
      let m = this.#a;
      for (this.#I(i); ; ) {
        const I = this.#p(n, r);
        if (I)
          return I;
        const y = await this.#b(
          m,
          this.#g(a)
        ), R = this.#m(
          n,
          i,
          s
        );
        if (R !== null)
          return R;
        if (y && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
          if (l >= 1)
            return Je;
          s = this.#c, this.#R(e.endpointID, o), l += 1, a += 1;
          break;
        }
        if (y) {
          m = this.#a;
          continue;
        }
        y || (a += 1, m = this.#a, this.#I(i));
      }
    }
  }
  #m(e, n, r) {
    const i = this.#n;
    if (!i || i.dspSessionId !== e)
      return null;
    const o = this.#i.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === e ? (this.#i.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#E(i, n) ? (this.#i.delete(n), J) : null;
  }
  #p(e, n) {
    return !this.#r || this.#d !== n ? ai : this.#t !== e ? oi : null;
  }
  #g(e) {
    return this.#u[Math.min(
      e,
      this.#u.length - 1
    )];
  }
  #R(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        Ge
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#r)
      try {
        this.#o.sendEventOrValue?.(
          ei,
          e,
          void 0,
          Ge
        );
      } catch {
      }
  }
  #M(e) {
    const n = si(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#s = n.dspSessionId), this.#n = n, this.#c += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#i.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#c
      }); this.#i.size > 16; ) {
        const i = this.#i.keys().next().value;
        if (i === void 0) break;
        this.#i.delete(i);
      }
    this.#a += 1, this.#y();
  }
  #b(e, n) {
    return !this.#r || this.#a !== e ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#h.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#h.add(o);
    });
  }
  #y() {
    for (const e of [...this.#h])
      e.finish(!0);
  }
}
const di = 2e3;
function Qe(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function ui(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  return Qe(r, e) ? {
    found: !0,
    value: r[e]
  } : Qe(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Xe(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class fi {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = hi(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = ui(e, this.options.stateKey);
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
    const r = (i) => {
      this.parameterValues.set(e, i), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, r), r;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const r = (i) => {
      const o = e.mapValue ? e.mapValue(i) : i;
      this.runtimeEndpointValues.set(e.endpointID, o), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(e.endpointID, r), r;
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
    const r = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, i = Xe(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), l = Xe({
      runtimeEndpoints: n,
      events: a
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, r).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r) : this.options.onDeliveryFailure?.(a);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
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
        this.options.sendTimeoutMilliseconds ?? di
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function hi(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function zt(t, e) {
  return new fi(t, e);
}
const mi = 1e3;
function pi(t) {
  const e = new ci(t, { laneKind: "modulation" });
  let n = !1, r = null, i = null, o = null;
  const a = zt(t, {
    stateKey: Ir,
    applyDefaultRuntimeStateWhenMissing: !0,
    runtimeEndpointDependencies: [{
      endpointID: Y,
      required: !0,
      mapValue: ve
    }],
    deserializeStoredState: (u) => {
      if (u === void 0)
        return Kt();
      const f = Jr(u);
      return f._tag === "ok" ? f.value : null;
    },
    buildRuntimeEvents: ({ state: u }, f) => Yr(
      u,
      f?.state ?? null
    ),
    sendRuntimeEvents: async (u, f) => c(
      await e.sendBatch(u),
      f
    )
  });
  function l() {
    i !== null && (clearTimeout(i), i = null);
  }
  function s() {
    !n || i !== null || (i = setTimeout(() => {
      i = null, n && a.replayFullRuntimeState();
    }, mi));
  }
  function c(u, f) {
    switch (u._tag) {
      case "accepted":
        return l(), o = null, !0;
      case "superseded":
      case "stopped":
        return !1;
      case "transport-timeout":
        return console.error("[modulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
          dspSessionId: r
        }), s(), !1;
      case "rejected":
        const m = JSON.stringify(f) ?? String(f), I = m !== o;
        return console.error("[modulation-worker] DSP rejected the acknowledged runtime batch.", {
          dspSessionId: r,
          rejectedSerial: u.acknowledgement.rejectedSerial,
          rejectionReason: u.acknowledgement.rejectionReason,
          fullReplayScheduled: I
        }), I && (o = m, s()), !1;
      case "unavailable":
        return n && (console.error("[modulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
          dspSessionId: r,
          reason: u.reason
        }), s()), !1;
    }
  }
  const h = (u) => {
    const f = ve(u);
    if (e.observeRuntime(f), r === null) {
      r = f;
      return;
    }
    f !== r && (r = f, l(), o = null);
  };
  return {
    start() {
      n || (n = !0, e.start(), t.addEndpointListener?.(Y, h), a.start());
    },
    stop() {
      n && (n = !1, l(), o = null, a.stop(), t.removeEndpointListener?.(Y, h), e.stop());
    }
  };
}
const S = "rack.v1", gi = "rackOrder", Ii = "rackEnable", D = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Wt = Object.freeze({
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
  D.map((t) => [Wt[t], t])
);
function jt() {
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
function Ye() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...D],
    enabled: jt()
  };
}
function bi(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${S} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${S} is not valid JSON: ${n}` };
  }
}
function Ze(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function yi(t) {
  return typeof t != "string" ? null : D.find((e) => e === t) ?? null;
}
function Si(t) {
  const e = bi(t);
  if (e._tag === "err")
    return e;
  if (!Ze(e.value))
    return { _tag: "err", message: `${S} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const a of Reflect.ownKeys(e.value))
    if (typeof a != "string" || !n.has(a))
      return { _tag: "err", message: `${S} has unexpected field ${String(a)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${S} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== D.length)
    return { _tag: "err", message: `${S}.order must contain every effect once` };
  const r = [], i = /* @__PURE__ */ new Set();
  for (const a of e.value.order) {
    const l = yi(a);
    if (l === null || i.has(l))
      return { _tag: "err", message: `${S}.order is not a complete permutation` };
    i.add(l), r.push(l);
  }
  if (!Ze(e.value.enabled))
    return { _tag: "err", message: `${S}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== D.length)
    return { _tag: "err", message: `${S}.enabled must contain every effect once` };
  const o = jt();
  for (const a of D) {
    const l = e.value.enabled[a];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${S}.enabled.${a} must be boolean` };
    o[a] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: r, enabled: o }
  };
}
function vi(t) {
  if (t === void 0)
    return Ye();
  const e = Si(t);
  return e._tag === "ok" ? e.value : Ye();
}
function Ti(t) {
  return [
    {
      endpointID: gi,
      value: { moduleIds: t.order.map((e) => Wt[e]) }
    },
    {
      endpointID: Ii,
      value: { enabledFlags: D.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
function Ri(t) {
  return zt(t, {
    stateKey: S,
    runtimeEndpointDependencies: [Zr],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: vi,
    buildRuntimeEvents: ({ state: e }) => [...Ti(e)]
  });
}
const xi = "runtimeSyncRequest", Ei = 2147483647, Ai = "runtimeState", wi = "retryDesiredTableRequest", Mi = "workerLoadFailure", ki = "serviceLoadAbort", Di = "wavetableLoadBegin", Oi = "wavetableMipFrame", _i = "wavetableUploadAck", Ci = "wavetableMipRequest", Li = "wavetablePrewarmRequest", Fi = "wavetablePrewarmNotification", Ni = "assets/factory-bank-catalog.json", Pi = 1, Ui = 2, Vi = 3, Bi = 1, Ki = 2, $i = 2e4, Q = Pi, zi = Ui, et = Vi, k = Bi, tt = Ki, Wi = 48 * 1024 * 1024;
function nt(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function p(t, e, n = null) {
  const r = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${e}`, n);
      return;
    }
    r(`[wavetable-worker] ${e}`);
  }
}
function rt(t) {
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
function it(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function ot(t, e) {
  if (!t)
    throw new Error(e);
}
function ji(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function qi(t, e) {
  return tn(await t.readJSON(e));
}
function Gi(t) {
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
function Hi(t, e) {
  const n = Math.round(Number(t) || 0);
  return ji(n, 0, Math.max(0, e - 1));
}
function ge(t, e, n) {
  return `${t}:${e}:${n}`;
}
function Ji(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function at(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function st(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function lt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class Qi {
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
    this.connection = e, this.resourceClient = en(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ni, this.maxFramesInFlight = nt(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? ft, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Wi) || 0)), this.serviceLoadTimeoutMs = nt(n.serviceLoadTimeoutMs, $i), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, p("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Ai, this.handleRuntimeState), this.connection.addEndpointListener?.(_i, this.handleUploadAck), this.connection.addEndpointListener?.(Ci, this.handleMipRequest), this.connection.addEndpointListener?.(Li, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Fi, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      xi,
      Ei
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await qi(this.resourceClient, this.catalogPath), p("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = at(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      let n = null, r = null;
      for (const [i, o] of this.tableCache)
        e.has(i) || (!r || o.lastUsedSerial < r.lastUsedSerial) && (n = i, r = o);
      if (!n || !r)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= r.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const r = {
      ...e,
      byteCount: at(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = ge(
          this.serviceTable.dspSessionId,
          this.serviceTable.generation,
          n
        );
        this.mipJobs.has(r) || this.mipJobs.set(r, {
          key: r,
          dspSessionId: this.serviceTable.dspSessionId,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...st(this.serviceTable.frameCount),
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
    const { dspSessionId: e, generation: n, tableIndex: r } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.generation !== n || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (p("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        generation: n,
        tableIndex: r,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          generation: n,
          tableIndex: r
        },
        {
          failurePhase: et,
          failureReasonCode: tt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== et || e.failureReasonCode !== tt ? !1 : this.autoRetryConsumedKey !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    tableIndex: n,
    generation: r = 0,
    candidateAttemptSerial: i = 0,
    failurePhase: o = Q,
    failureReasonCode: a = k
  }) {
    this.connection.sendEventOrValue?.(Mi, {
      dspSessionId: e,
      tableIndex: n,
      generation: r,
      candidateAttemptSerial: i,
      failurePhase: o,
      failureReasonCode: a
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    generation: n,
    tableIndex: r,
    failureReasonCode: i = k
  }) {
    this.connection.sendEventOrValue?.(ki, {
      dspSessionId: e,
      generation: n,
      tableIndex: r,
      failureReasonCode: i
    });
  }
  emitRetryDesiredTableRequest() {
    p("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? rt(this.latestRuntimeState) : null
    }), this.connection.sendEventOrValue?.(wi, 1);
  }
  async loadTableSource(e, n, r) {
    const i = await this.ensureCatalogLoaded();
    if (r !== this.asyncStateToken)
      return null;
    const o = Hi(e, i.tables.length), a = i.tables[o];
    ot(a, `Could not resolve table ${o}`);
    const l = Ji(a, Ce, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, p("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = lt();
    p("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const h = await this.resourceClient.readAudio(a.sourceWav), u = sn(h.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: Ce
    });
    return !u || r !== this.asyncStateToken ? null : (p("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(lt() - c)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: o,
      tableMeta: a,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    }));
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, r) {
    p("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: r.tableMeta?.name ?? null,
      frameCount: r.frameCount
    }), this.serviceTable = {
      ...r,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidation = {
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGeneration = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Di, {
      dspSessionId: e.dspSessionId,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    p("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Q,
      failureReasonCode: k
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Q,
      failureReasonCode: k
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Q,
    failureReasonCode: r = k
  } = {}) {
    p("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: r
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: r
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: r
    });
  }
  async prepareServiceTarget(e, n, r) {
    if (this.isMatchingServiceTable(e))
      return this.serviceTable && (this.serviceTable.mode = e.kind), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0;
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex, void 0, r);
    } catch (o) {
      return r === this.asyncStateToken && (p("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Ie(o)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    return !i || r !== this.asyncStateToken ? !1 : (this.serviceTable = {
      ...i,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads()), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0);
  }
  async prepareDesiredLoad(e, n) {
    const r = e.desiredTableIndex;
    if (this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.tableIndex === r && this.candidateValidation.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const i = Math.max(
      this.nextLoadGeneration,
      e.generationFrontier + 1
    );
    let o = null;
    try {
      o = await this.loadTableSource(r, void 0, n);
    } catch (a) {
      n === this.asyncStateToken && (p("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: r,
        detail: Ie(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !o || n !== this.asyncStateToken || this.markCommittedDesiredLoad(e, i, o);
  }
  async prepareDesiredCandidate(e, n) {
    await this.prepareDesiredLoad(e, n);
  }
  async handleRuntimeState(e) {
    try {
      const n = Gi(e ?? {});
      if (p("info", "Received runtime state", rt(n)), n.dspSessionId <= 0)
        return;
      const r = n.dspSessionId !== this.knownSessionId, i = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null, o = this.getDesiredRetryKey(n);
      r ? this.resetSessionState(n) : this.nextLoadGeneration = Math.max(
        this.nextLoadGeneration,
        n.generationFrontier + 1
      ), (r || i !== o) && (this.autoRetryConsumedKey = null), this.latestRuntimeState = n;
      const a = this.asyncStateToken + 1;
      if (this.asyncStateToken = a, this.candidateValidation && this.candidateValidation.dspSessionId === n.dspSessionId && this.candidateValidation.generation > n.generationFrontier)
        return;
      const l = this.resolveServiceTarget(n), s = r && l?.kind === "active";
      if (l) {
        if (!await this.prepareServiceTarget(l, n, a))
          return;
        if (l.kind === "loading" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n)) {
          p("warn", "Aborting obsolete wavetable load because the desired table changed", {
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            staleTableIndex: l.tableIndex,
            desiredTableIndex: n.desiredTableIndex,
            desiredIntentSerial: n.desiredIntentSerial
          }), this.emitServiceLoadAbort({
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            tableIndex: l.tableIndex,
            failureReasonCode: k
          }), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        l.kind === "active" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n) && !s && await this.prepareDesiredCandidate(n, a);
        return;
      }
      if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(n)) {
        this.autoRetryConsumedKey = o, this.emitRetryDesiredTableRequest();
        return;
      }
      if (n.serviceState !== 0 || this.shouldStayIdleOnFailure(n))
        return;
      await this.prepareDesiredLoad(n, a);
    } catch (n) {
      console.error(n);
    }
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, r = Math.trunc(Number(n?.tableIndex ?? e));
    if (!Number.isFinite(r))
      return;
    const i = this.asyncStateToken;
    try {
      const o = await this.loadTableSource(r, void 0, i);
      if (!o || i !== this.asyncStateToken)
        return;
      for (let l = 0; l < o.frameCount; l += 1)
        o.spectra[l] || (o.spectra[l] = Fe(o.frames[l]));
      const a = this.tableCache.get(o.cacheKey);
      a && this.refreshCacheEntryByteCount(a), p("info", "Prewarmed wavetable source table", {
        tableIndex: o.tableIndex,
        tableId: o.tableMeta.tableId,
        tableName: o.tableMeta.name,
        reason: typeof n?.reason == "string" ? n.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (o) {
      p("warn", "Ignoring wavetable prewarm failure", {
        tableIndex: r,
        reason: typeof n?.reason == "string" ? n.reason : null,
        detail: Ie(o)
      });
    }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.generation)), i = Math.trunc(Number(e?.tableIndex)), o = Math.trunc(Number(e?.mipIndex)), a = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.generation || i !== this.serviceTable.tableIndex || o < 0 || o >= this.mipLevelCount)
      return null;
    const l = ge(n, r, o);
    let s = this.mipJobs.get(l);
    return s ? (!s.completed && a > s.urgencyLevel && (s.urgencyLevel = a), s) : (s = {
      key: l,
      dspSessionId: n,
      generation: r,
      tableIndex: i,
      mipIndex: o,
      urgencyLevel: a,
      ...st(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, s), s);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (p("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.generation)), o = Math.trunc(Number(n.mipIndex)), a = Math.trunc(Number(n.frameIndex)), l = ge(r, i, o), s = this.mipJobs.get(l);
    !s || s.completed || !s.inFlightFrames.has(a) || (s.inFlightFrames.delete(a), s.ackedFrames[a] || (s.ackedFrames[a] = 1, s.ackedFrameCount += 1), s.ackedFrameCount === this.serviceTable?.frameCount && s.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && s.inFlightFrames.size === 0 && (s.completed = !0, this.activeUploadKey === s.key && (this.activeUploadKey = null)), it(a, this.serviceTable?.frameCount ?? 0) && p("info", "Acknowledged wavetable mip frame", {
      dspSessionId: r,
      generation: i,
      tableIndex: s.tableIndex,
      mipIndex: o,
      frameIndex: a,
      ackedFrameCount: s.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (ot(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Fe(this.serviceTable.frames[e]);
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
        let r;
        try {
          const i = this.getSpectrumForFrame(n);
          r = ln(i, e.mipIndex);
        } catch {
          this.handleServiceTargetFailure(
            {
              kind: this.serviceTable.mode ?? "loading",
              dspSessionId: e.dspSessionId,
              generation: e.generation,
              tableIndex: e.tableIndex
            },
            {
              failurePhase: zi,
              failureReasonCode: k
            }
          ), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        this.connection.sendEventOrValue?.(Oi, {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          samples: Array.from(r)
        }), it(n, this.serviceTable.frameCount) && p("info", "Sent wavetable mip frame", {
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
function Ie(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Xi(t, e = {}) {
  return new Qi(t, e);
}
async function Yi(t, e = {}) {
  return un(t, [
    pi,
    Ri,
    // RT-01 will compose the v4 articulation service after the production
    // Cmajor endpoint consumes A/B/C arrays and all 416 sparse route cells.
    () => Xi(t, e)
  ]);
}
export {
  Ui as FAILURE_PHASE_BUILD_MIP,
  Pi as FAILURE_PHASE_LOAD_SOURCE,
  Vi as FAILURE_PHASE_TRANSFER_MIP,
  Bi as FAILURE_REASON_GENERIC,
  Ki as FAILURE_REASON_TIMEOUT,
  Ei as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Qi as WavetableWorkerController,
  Xi as createWavetableWorkerController,
  Yi as default
};
