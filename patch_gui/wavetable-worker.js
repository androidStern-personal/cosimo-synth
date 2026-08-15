function v(t, e) {
  if (!t)
    throw new Error(e);
}
function se(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Gt(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function ye(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function dt(t) {
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
function Ht() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function le(t, e) {
  const n = Ht();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Gt(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Ce(t) {
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
  throw new Error(`Unsupported text resource payload (${dt(t)})`);
}
function Jt(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return ye(t);
  throw new Error(`Unsupported binary resource payload (${dt(t)})`);
}
function Qt(t) {
  const e = t?.frames;
  v(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let r = 0; r < n.length; r += 1) {
    const o = n[r];
    if (typeof o == "number") {
      i[r] = o;
      continue;
    }
    if (ArrayBuffer.isView(o) || Array.isArray(o)) {
      const a = o;
      v(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function ut(t) {
  const e = new DataView(t);
  v(se(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), v(se(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const h = se(e, c, 4), f = e.getUint32(c + 4, !0), m = c + 8;
    h === "fmt " ? (n = e.getUint16(m, !0), i = e.getUint16(m + 2, !0), r = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), o = e.getUint16(m + 14, !0)) : h === "data" && (l = m, s = f), c = m + f + f % 2;
  }
  v(n !== null, "Wave file is missing a fmt chunk"), v(l !== null && s !== null, "Wave file is missing a data chunk"), v(i === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && o === 32)
    d = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && o === 16) {
    const h = s / 2, f = new Int16Array(t.slice(l, l + s));
    d = new Float32Array(h);
    for (let m = 0; m < h; m += 1)
      d[m] = f[m] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: d
  };
}
async function _e(t) {
  v(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return v(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Se(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ht(t) {
  const e = new Uint8Array(t).buffer, n = ut(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Xt(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (v(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), r = async (s) => {
    v(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return Qt(c);
  }, o = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const d = le(s, c), h = await _e(d), f = ut(h);
    return {
      sampleRate: f.sampleRate,
      samples: f.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const d = le(s, c);
    return new Uint8Array(await _e(d));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Ce(await i(s));
      const c = o(s);
      return e === "url" && c !== null ? Se(await l(s, c)) : typeof t.readResource == "function" ? Ce(await i(s)) : Se(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Jt(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(s);
      const c = o(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? r(s) : ht(await this.readBytes(s));
    },
    getURL(s) {
      return le(s, t.getResourceAddress?.(s));
    }
  };
}
function Yt(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Xt(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Zt(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return Se(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return ye(await e(a));
      if (n)
        return ye(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : ht(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function en(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function tn(t) {
  return en(t) ? Zt(t) : Yt(t);
}
const Le = 2048;
function $(t, e) {
  if (!t)
    throw new Error(e);
}
function nn(t) {
  $(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    $(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), $(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), $(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), $(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const rn = 2048, ft = 11, on = 256;
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function an(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Fe = /* @__PURE__ */ new Map();
function sn(t) {
  const e = Fe.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let l = 0; l < n; l += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return Fe.set(t, i), i;
}
function mt(t, e, n = !1) {
  const i = t.length;
  x(i === e.length, "FFT real and imaginary buffers must have the same length"), x(an(i), "FFT input length must be a power of two");
  const r = sn(i);
  for (let o = 0; o < i; o += 1) {
    const a = r[o];
    if (a <= o)
      continue;
    const l = t[o];
    t[o] = t[a], t[a] = l;
    const s = e[o];
    e[o] = e[a], e[a] = s;
  }
  for (let o = 2; o <= i; o <<= 1) {
    const a = o >> 1, l = (n ? 2 : -2) * Math.PI / o, s = Math.cos(l), c = Math.sin(l);
    for (let d = 0; d < i; d += o) {
      let h = 1, f = 0;
      for (let m = 0; m < a; m += 1) {
        const I = d + m, y = I + a, R = t[y], P = e[y], U = h * R - f * P, B = h * P + f * R, K = t[I], V = e[I];
        t[I] = K + U, e[I] = V + B, t[y] = K - U, e[y] = V - B;
        const q = h * s - f * c;
        f = h * c + f * s, h = q;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function pt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function ln(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = rn,
  maxFramesPerTable: i = on
} = {}) {
  const r = Float32Array.from(t);
  x(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  x(o > 0, "Source wavetable files must contain at least one frame"), x(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && x(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let l = 0; l < o; l += 1) {
    const s = l * n, c = s + n;
    a.push(pt(r.slice(s, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Ne(t) {
  const e = pt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return mt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function cn(t, e, {
  mipLevelCount: n = ft
} = {}) {
  const i = t?.real?.length ?? 0;
  x(i > 0, "Spectrum must contain real samples"), x(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), x(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    o[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (o[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return mt(o, a, !0), Float32Array.from(o);
}
class dn {
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
function un(t, e) {
  return new dn(t, e);
}
async function hn(t, e) {
  const n = un(t, e);
  return await n.start(), n;
}
const b = (t, e) => ({ label: t, value: e });
function T(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const E = Object.freeze({
  filter: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: T(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), u = (t, e, n, i, r, o, a, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: o,
  initial: a,
  step: l.step ?? (o - r) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), fn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], mn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], pn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: E.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      u("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(b), quick: !0 }),
      u("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      u("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      u("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
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
      u("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Classic", 0), b("Harmonics", 1)] }),
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
    iconUrl: E.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
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
    iconUrl: E.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      u("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(b) }),
      u("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(b) }),
      u("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      u("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      u("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      u("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      u("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(b) }),
      u("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
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
    iconUrl: E.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      u("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      u("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      u("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: fn.map(b) }),
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
    iconUrl: E.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      u("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [b("Free", 0), b("Sync", 1)] }),
      u("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      u("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: mn.map(b) }),
      u("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      u("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      u("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
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
      u("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      u("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      u("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      u("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], gt = pn, It = Object.freeze(
  gt.flatMap((t) => t.parameters)
);
new Map(
  It.map((t) => [t.endpointID, t])
);
function bt() {
  return It;
}
const w = 2048, gn = w + 3, Pe = 20, yt = "MSEG 1", In = 0, bn = 2, yn = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Re(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function F(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Sn(t) {
  return Re(Number.isFinite(t) ? t : 0, -Pe, Pe);
}
function M(t) {
  return Re(Number.isFinite(t) ? t : 0, 0, 1);
}
function St(t = yt) {
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
function vt() {
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
function xt(t) {
  const e = Number(t);
  return Re(
    Number.isFinite(e) ? e : 1,
    In,
    bn
  );
}
function vn(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = M(Number(e.startX)), i = M(Number(e.endX));
  return F(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Rt(t = vt()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = yn.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: xt(Number.isFinite(i) ? i : 1)
    },
    loop: vn(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function xn(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = M(r)), {
    x: r,
    y: M(Number(i.y)),
    curvePower: Sn(Number(i.curvePower))
  };
}
function j(t = St()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => xn(r, o, n.length));
  if (!F(i[0].x, 0) || !F(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : yt,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Ue(t) {
  return JSON.stringify(j(t));
}
function Be(t) {
  return JSON.stringify(Rt(t));
}
function Rn(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function Tn(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (F(e, r.x)) {
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
function En(t, e) {
  const n = M(Number(e)), i = Tn(t, n);
  if (i.laterPointWins || F(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = M(Rn(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function wn(t, e) {
  return En(j(t).points, e);
}
function An(t) {
  const e = j(t), n = new Float32Array(w);
  for (let r = 0; r < w; r += 1) {
    const o = r / (w - 1);
    n[r] = wn(e, o);
  }
  const i = new Float32Array(gn);
  return i[0] = n[0], i.set(n, 1), i[w + 1] = n[w - 1], i[w + 2] = n[w - 1], i;
}
function Ke(t, e) {
  return Ue(t) === Ue(e);
}
function Mn(t, e) {
  return Be(t) === Be(e);
}
const Tt = ["A", "B", "C"], Dn = [
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
]), On = Object.freeze([
  ...Tt.flatMap((t) => Dn.map(
    (e) => `osc${t}.${e}`
  )),
  ...kn
]), Et = Object.freeze(
  On.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Cn = bt().filter((t) => t.modulationTargetIndex !== null), wt = Object.freeze(
  Cn.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), A = Object.freeze([
  ...Et,
  ...wt
]), X = O.length, At = Et.length, Mt = wt.length, _n = X * A.length, Ln = new Map(O.map((t) => [t.id, t])), Dt = new Map(O.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), N = new Map(A.map((t) => [t.kind, t]));
function Fn() {
  if (X !== 13 || At !== 32 || Mt !== 36 || _n !== 884)
    throw new Error("Modulation identity catalog has an unexpected domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = O.filter((r) => r.group === t), i = n.map((r) => r.runtimeIndex).sort((r, o) => r - o);
    if (n.length !== e || i.some((r, o) => r !== o))
      throw new Error(`Modulation ${t} source indexes must be unique and contiguous`);
  }
  for (const [t, e] of [["voice", 32], ["rack", 36]]) {
    const n = A.filter((r) => r.group === t), i = n.map((r) => r.runtimeIndex).sort((r, o) => r - o);
    if (n.length !== e || i.some((r, o) => r !== o))
      throw new Error(`Modulation ${t} target indexes must be unique and contiguous`);
  }
  if (Ln.size !== X || Dt.size !== X || N.size !== A.length)
    throw new Error("Modulation identities must be unique");
}
Fn();
function kt(t, e) {
  const n = Dt.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Te(t) {
  return typeof t != "string" ? null : N.has(t) ? t : null;
}
function Nn(t) {
  const e = Te(t);
  return e !== null && N.get(e)?.group === "voice" ? e : null;
}
function Pn(t) {
  const e = Te(t);
  return e !== null && N.get(e)?.group === "rack" ? e : null;
}
function Un(t) {
  const e = N.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Bn(t) {
  const e = N.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Kn(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const ce = "modulationProgram", Vn = "modulationAmount", Ot = O.filter((t) => t.group === "voice").length, Ct = O.filter((t) => t.group === "macro").length, Z = At, ee = Mt, _ = Ot * Z, z = Ct * Z, C = Ot * ee, W = Ct * ee;
function $n(t) {
  const e = kt(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function zn(t) {
  const e = Nn(t);
  return e === null ? null : Un(e);
}
function Wn(t) {
  const e = zn(t.targetKind), n = Pn(t.targetKind), i = n === null ? void 0 : Bn(n);
  if (e === null && i === void 0)
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
        articulationCellIndex: _ + c
      };
    }
    const s = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * ee + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const r = $n(t);
  if (e !== null) {
    const a = r * Z + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: r,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const o = i ?? 0;
  return {
    path: "voiceRack",
    cellIndex: r * ee + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function jn(t) {
  return {
    ...Wn(t),
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
    const i = jn(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function qn(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function L(t) {
  return [...t.values()].filter(qn).sort((e, n) => e.cellIndex - n.cellIndex);
}
function G(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function de(t) {
  const e = _t(t), n = L(e.voice), i = L(e.macroVoice), r = L(e.voiceRack), o = L(e.macroRack), a = Array.from({ length: _ }, () => 0), l = Array.from({ length: _ }, () => 0), s = Array.from({ length: _ }, () => 0), c = Array.from({ length: _ }, () => 0), d = Array.from({ length: _ }, () => 0);
  G(n, a, l, s, c);
  const h = Array.from({ length: z }, () => 0), f = Array.from({ length: z }, () => 0), m = Array.from({ length: z }, () => 0), I = Array.from({ length: z }, () => 0), y = Array.from({ length: z }, () => 0);
  G(
    i,
    h,
    f,
    m,
    I
  );
  const R = Array.from({ length: C }, () => 0), P = Array.from({ length: C }, () => 0), U = Array.from({ length: C }, () => 0), B = Array.from({ length: C }, () => 0), K = Array.from({ length: C }, () => 0), V = Array.from({ length: C }, () => 0);
  G(
    r,
    R,
    P,
    U,
    B
  );
  const q = Array.from({ length: W }, () => 0), Ae = Array.from({ length: W }, () => 0), Me = Array.from({ length: W }, () => 0), De = Array.from({ length: W }, () => 0), ke = Array.from({ length: W }, () => 0);
  G(
    o,
    q,
    Ae,
    Me,
    De
  );
  for (const g of e.voice.values()) d[g.cellIndex] = g.amount;
  for (const g of e.macroVoice.values()) y[g.cellIndex] = g.amount;
  for (const g of e.voiceRack.values()) V[g.cellIndex] = g.amount;
  for (const g of e.macroRack.values()) ke[g.cellIndex] = g.amount;
  for (let g = 0; g < r.length; g += 1) {
    const Oe = r[g];
    if (Oe === void 0) throw new Error(`Missing compiled voice-rack route at index ${g}`);
    K[g] = Oe.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: h,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: m,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: R,
    voiceRackRouteSources: P,
    voiceRackRouteTargets: U,
    voiceRackRoutePolarities: B,
    voiceRackRouteReducers: K,
    voiceRackRouteAmounts: V,
    macroRackRouteCount: o.length,
    macroRackRouteCells: q,
    macroRackRouteSources: Ae,
    macroRackRouteTargets: Me,
    macroRackRoutePolarities: De,
    macroRackRouteAmounts: ke
  };
}
const Gn = ["voice", "macroVoice", "voiceRack", "macroRack"], Hn = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Ve(t) {
  return _t(t);
}
function Jn(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Qn(t, e) {
  if (t === null)
    return [{ endpointID: ce, value: de(e) }];
  const n = Ve(t), i = Ve(e), r = [];
  for (const o of Gn) {
    const a = L(n[o]), l = L(i[o]);
    if (a.length !== l.length)
      return [{ endpointID: ce, value: de(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], d = l[s];
      if (c === void 0 || d === void 0 || !Jn(c, d))
        return [{ endpointID: ce, value: de(e) }];
      c.amount !== d.amount && r.push({
        endpointID: Vn,
        value: {
          pathKind: Hn[o],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return r;
}
function Xn(t) {
  return { _tag: "ok", value: t };
}
function ue(t) {
  return { _tag: "err", error: t };
}
function Yn(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function $e(t) {
  throw new Error(t ?? "Invariant violated");
}
function he(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const Zn = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      he("cutoff", "Cutoff", 67, 70, "frequency"),
      he("resonance", "Resonance", 25, 0),
      he("drive", "Drive", 15, 0)
    ]
  }
], ze = 1e-6;
function re(t, e) {
  if (!Number.isFinite(t) || t < -ze || t > 1 + ze)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function te(t, e) {
  return re(t / 100, `${e} catalog percentage`);
}
function Lt(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function ei(t) {
  return 20 * 1e3 ** t;
}
function ti(t) {
  return re(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ni(t) {
  return 0.1 * 200 ** t;
}
function ii(t) {
  return re(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function We(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ri(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: We("filterCutoff", ei, ti),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: We("filterQ", ni, ii),
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
function Ft(t) {
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
      return Yn(t);
  }
}
function oi(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ai(t, e) {
  const n = Lt(t.moduleId, e.id), i = Ft(e.format), r = ri(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: te(e.defaultPercent, n),
    initialValue: te(e.initialPercent, n),
    format: i,
    modAmount: oi(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const si = [
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
function li(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ci(t, e) {
  const n = `osc${t}`, i = Lt(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: te(e.defaultPercent, i),
    initialValue: te(e.initialPercent, i),
    format: Ft(e.format),
    modAmount: li(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const di = Object.freeze(
  Tt.flatMap((t) => si.map((e) => ci(t, e)))
);
function ui(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function fe(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return re(n, `${t.endpointID} endpoint conversion`);
}
function hi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function fi(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function mi(t) {
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
function pi(t) {
  const e = ui(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: fe(t, t.initial),
    initialValue: fe(t, t.initial),
    format: fi(t),
    modAmount: mi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => hi(t, n),
      fromEngine: (n) => fe(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const Ee = Object.freeze(
  [
    ...gt.flatMap((t) => t.parameters.map(pi)),
    ...di,
    ...Zn.flatMap(
      (t) => t.parameters.map(
        (e) => ai(t, e)
      )
    )
  ]
), gi = new Map(
  Ee.map((t) => [t.targetId, t])
), Nt = Ee.filter(
  (t) => t.modulationTargetKind !== null
), ne = new Map(
  Nt.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (gi.size !== Ee.length)
  throw new Error("Target descriptor IDs must be unique");
if (Nt.length !== A.length || ne.size !== A.length || A.some((t) => ne.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ii(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = ne.get(t);
    return i === void 0 ? $e(`Modulation target "${t}" has no display descriptor`) : `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = ne.get(t);
  return n === void 0 ? $e(`Modulation target "${t}" has no display descriptor`) : n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const bi = "modulation.v4", Pt = 4, oe = 3, ae = 3, je = "modulationMsegBuffer", yi = "modulationMsegPlayback", Si = "modulationEnvelope", Ut = 4, vi = ["MSEG 1", "MSEG 2", "MSEG 3"], Bt = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], xi = ["Env 1", "Env 2", "Env 3"], Ri = 1e-3, Ti = 10, Ei = 0.1, wi = 20, Ai = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: wi - Ei },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, Mi = bt().filter((t) => t.modulationTargetIndex !== null), Di = new Map(
  Mi.map((t) => [`rack.${t.endpointID}`, t])
);
class me extends Error {
  name = "ModulationStateParseError";
}
const ki = {
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
  label: ki[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
A.map((t) => ({
  value: t.kind,
  label: Ii(t.kind)
}));
function Oi(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function we(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function pe(t, e) {
  const n = Number(t);
  return we(Number.isFinite(n) ? n : e, Ri, Ti);
}
function Ci(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function _i(t) {
  const e = Di.get(t);
  return e !== void 0 ? Ci(e) : Ai[Kn(t)];
}
function Li(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Fi(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Ni(t, e) {
  const n = _i(t), i = Number(e);
  return we(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function Pi(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Ui(t) {
  return Pi(t) ?? "mseg";
}
function Bi(t) {
  return Te(t);
}
function Ki(t) {
  return Bi(t) ?? "oscA.wavetablePosition";
}
function Vi(t, e) {
  const n = Bt[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function $i(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? oe : t === "macro" ? Ut : ae;
  return we(Number.isFinite(n) ? n : 1, 1, i);
}
function Kt(t) {
  return {
    name: xi[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function zi(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = Kt(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: pe(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: pe(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: M(n.sustain ?? i.sustain),
    releaseSeconds: pe(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function Wi(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: Li(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: $i(n, t.sourceSlot),
    polarity: Fi(t.polarity),
    targetKind: i,
    amount: Ni(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ji(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = Ui(i.sourceKind), o = Ki(i.targetKind);
  return Wi(i, e, r, o);
}
function qi(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Gi(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => ji(n, i));
}
function Hi(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = qi(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function ve(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => ve(a, e[l]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => Oi(i, a) && ve(n[a], i[a]));
}
function Vt(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = St(vi[e] ?? `MSEG ${e + 1}`), r = j(n.shapeA ?? i);
  return {
    shapeA: r,
    shapeB: j(n.shapeB ?? r),
    morph: M(n.morph ?? 0),
    playback: Rt(n.playback ?? vt())
  };
}
function $t() {
  return {
    format: "cosimo.modulation",
    version: Pt,
    msegSlots: Array.from({ length: oe }, (t, e) => Vt({}, e)),
    envelopeSlots: Array.from({ length: ae }, (t, e) => Kt(e)),
    routes: [],
    macroNames: Bt.slice()
  };
}
function Ji(t = $t()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Pt,
    msegSlots: Array.from({ length: oe }, (o, a) => Vt(n[a], a)),
    envelopeSlots: Array.from({ length: ae }, (o, a) => zi(i[a], a)),
    routes: Gi(e.routes),
    macroNames: Array.from(
      { length: Ut },
      (o, a) => Vi(r[a], a)
    )
  };
}
function Qi(t) {
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
  const n = Ji(e);
  return !ve(e, n) || !Hi(n.routes) ? ue(new me("Expected the current modulation schema")) : Xn(n);
}
function Xi(t, e) {
  return {
    slot: t + 1,
    seconds: xt(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function qe(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(An(n))
  };
}
function Yi(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function Zi(t, e = null) {
  const n = [];
  for (let i = 0; i < oe; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !Ke(o.shapeA, r.shapeA)) && n.push({
      endpointID: je,
      value: qe(i, 0, r.shapeA)
    }), (o === void 0 || !Ke(o.shapeB, r.shapeB)) && n.push({
      endpointID: je,
      value: qe(i, 1, r.shapeB)
    }), (o === void 0 || !Mn(o.playback, r.playback)) && n.push({
      endpointID: yi,
      value: Xi(i, r.playback)
    });
  }
  for (let i = 0; i < ae; i += 1) {
    const r = t.envelopeSlots[i], o = e?.envelopeSlots[i];
    (o === void 0 || JSON.stringify(o) !== JSON.stringify(r)) && n.push({
      endpointID: Si,
      value: Yi(i, r)
    });
  }
  return n.push(...Qn(e?.routes ?? null, t.routes)), n;
}
const Y = "runtimeState";
function xe(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const er = {
  endpointID: Y,
  required: !0,
  mapValue: xe
}, Ge = "runtimeInstallAck", tr = "runtimeSyncRequest", He = 0, nr = 8e3, ie = /* @__PURE__ */ new WeakMap(), zt = 1e9;
let H = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % zt;
function ir(t) {
  return H = H % zt + 1, t === "modulation" ? -1e9 - H : 1e9 + H;
}
function rr(t, e) {
  const n = t, i = ie.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), ie.set(n, i);
}
function Je(t, e) {
  const n = t, i = ie.get(n);
  i?.delete(e), i?.size === 0 && ie.delete(n);
}
const or = [100, 250, 500, 1e3], J = { _tag: "accepted" }, ar = { _tag: "superseded" }, sr = { _tag: "stopped" }, Qe = { _tag: "transport-timeout" };
function lr(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, r = i.dspSessionId, o = i.acceptedModulationSerial, a = i.acceptedArticulationSerial, l = i.rejectedSerial, s = i.rejectionReason, c = i.syncSerial;
  return ![
    r,
    o,
    a,
    l,
    s,
    c
  ].every((h) => typeof h == "number" && Number.isSafeInteger(h) && h >= -2147483648 && h <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || r < 0 || o < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function cr(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class dr {
  #o;
  #e;
  #u;
  #S;
  #h = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #r = /* @__PURE__ */ new Map();
  #d = 0;
  #i = !1;
  #a = 0;
  #f = /* @__PURE__ */ new Set();
  #v = this.#M.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#u = i && i.length > 0 ? i : [...or], this.#S = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? nr)
    );
  }
  start() {
    if (!this.#i) {
      rr(this.#o, this.#e);
      try {
        this.#d += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(Ge, this.#v);
      } catch (e) {
        throw this.#i = !1, Je(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(Ge, this.#v), Je(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#y());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#r.clear(), this.#a += 1, this.#y());
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
    return this.#i ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#x(e, n) : {
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
    const n = this.#t, i = this.#d;
    try {
      const r = await this.#x(
        n,
        i
      );
      if (r._tag !== "accepted")
        return r;
      let o = null;
      for (const a of e) {
        const l = await this.#A(
          a,
          n,
          i
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
      this.#h = !1;
    }
  }
  #T(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #E(e, n) {
    const i = this.#T(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #w() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #x(e, n) {
    if (this.#s === e)
      return J;
    const i = ir(this.#e);
    this.#l.add(i);
    const r = Date.now() + this.#S;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return J;
        const l = r - Date.now();
        if (l <= 0)
          return Qe;
        const s = this.#a;
        this.#I(i), await this.#b(
          s,
          Math.min(this.#g(o), l)
        ), o += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #A(e, n, i) {
    const r = this.#w(), o = cr(e.value, n, r);
    let a = 0, l = 0, s = this.#c;
    for (this.#R(e.endpointID, o); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const d = this.#m(n, r, s);
      if (d !== null)
        return d;
      const h = this.#a;
      await this.#b(
        h,
        this.#g(a)
      );
      const f = this.#m(
        n,
        r,
        s
      );
      if (f !== null)
        return f;
      let m = this.#a;
      for (this.#I(r); ; ) {
        const I = this.#p(n, i);
        if (I)
          return I;
        const y = await this.#b(
          m,
          this.#g(a)
        ), R = this.#m(
          n,
          r,
          s
        );
        if (R !== null)
          return R;
        if (y && this.#n?.dspSessionId === n && this.#n.syncSerial === r) {
          if (l >= 1)
            return Qe;
          s = this.#c, this.#R(e.endpointID, o), l += 1, a += 1;
          break;
        }
        if (y) {
          m = this.#a;
          continue;
        }
        y || (a += 1, m = this.#a, this.#I(r));
      }
    }
  }
  #m(e, n, i) {
    const r = this.#n;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#r.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#E(r, n) ? (this.#r.delete(n), J) : null;
  }
  #p(e, n) {
    return !this.#i || this.#d !== n ? sr : this.#t !== e ? ar : null;
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
        He
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          tr,
          e,
          void 0,
          He
        );
      } catch {
      }
  }
  #M(e) {
    const n = lr(e);
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
    this.#a += 1, this.#y();
  }
  #b(e, n) {
    return !this.#i || this.#a !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const o = {
        finish: (a) => {
          r || (r = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#f.delete(o), i(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#f.add(o);
    });
  }
  #y() {
    for (const e of [...this.#f])
      e.finish(!0);
  }
}
const ur = 2e3;
function Xe(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function hr(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Xe(i, e) ? {
    found: !0,
    value: i[e]
  } : Xe(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Ye(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class fr {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = mr(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = hr(e, this.options.stateKey);
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
      const o = e.mapValue ? e.mapValue(r) : r;
      this.runtimeEndpointValues.set(e.endpointID, o), this.applyRuntimeStateIfReady();
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
    }, r = Ye(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), l = Ye({
      runtimeEndpoints: n,
      events: a
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(a);
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
        this.options.sendTimeoutMilliseconds ?? ur
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function mr(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Wt(t, e) {
  return new fr(t, e);
}
const pr = 1e3;
function gr(t) {
  const e = new dr(t, { laneKind: "modulation" });
  let n = !1, i = null, r = null, o = null;
  const a = Wt(t, {
    stateKey: bi,
    applyDefaultRuntimeStateWhenMissing: !0,
    runtimeEndpointDependencies: [{
      endpointID: Y,
      required: !0,
      mapValue: xe
    }],
    deserializeStoredState: (h) => {
      if (h === void 0)
        return $t();
      const f = Qi(h);
      return f._tag === "ok" ? f.value : null;
    },
    buildRuntimeEvents: ({ state: h }, f) => Zi(
      h,
      f?.state ?? null
    ),
    sendRuntimeEvents: async (h, f) => c(
      await e.sendBatch(h),
      f
    )
  });
  function l() {
    r !== null && (clearTimeout(r), r = null);
  }
  function s() {
    !n || r !== null || (r = setTimeout(() => {
      r = null, n && a.replayFullRuntimeState();
    }, pr));
  }
  function c(h, f) {
    switch (h._tag) {
      case "accepted":
        return l(), o = null, !0;
      case "superseded":
      case "stopped":
        return !1;
      case "transport-timeout":
        return console.error("[modulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
          dspSessionId: i
        }), s(), !1;
      case "rejected":
        const m = JSON.stringify(f) ?? String(f), I = m !== o;
        return console.error("[modulation-worker] DSP rejected the acknowledged runtime batch.", {
          dspSessionId: i,
          rejectedSerial: h.acknowledgement.rejectedSerial,
          rejectionReason: h.acknowledgement.rejectionReason,
          fullReplayScheduled: I
        }), I && (o = m, s()), !1;
      case "unavailable":
        return n && (console.error("[modulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
          dspSessionId: i,
          reason: h.reason
        }), s()), !1;
    }
  }
  const d = (h) => {
    const f = xe(h);
    if (e.observeRuntime(f), i === null) {
      i = f;
      return;
    }
    f !== i && (i = f, l(), o = null);
  };
  return {
    start() {
      n || (n = !0, e.start(), t.addEndpointListener?.(Y, d), a.start());
    },
    stop() {
      n && (n = !1, l(), o = null, a.stop(), t.removeEndpointListener?.(Y, d), e.stop());
    }
  };
}
const S = "rack.v1", Ir = "rackOrder", br = "rackEnable", k = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), jt = Object.freeze({
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
  k.map((t) => [jt[t], t])
);
function qt() {
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
function Ze() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...k],
    enabled: qt()
  };
}
function yr(t) {
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
function et(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Sr(t) {
  return typeof t != "string" ? null : k.find((e) => e === t) ?? null;
}
function vr(t) {
  const e = yr(t);
  if (e._tag === "err")
    return e;
  if (!et(e.value))
    return { _tag: "err", message: `${S} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const a of Reflect.ownKeys(e.value))
    if (typeof a != "string" || !n.has(a))
      return { _tag: "err", message: `${S} has unexpected field ${String(a)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${S} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== k.length)
    return { _tag: "err", message: `${S}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const a of e.value.order) {
    const l = Sr(a);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${S}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!et(e.value.enabled))
    return { _tag: "err", message: `${S}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== k.length)
    return { _tag: "err", message: `${S}.enabled must contain every effect once` };
  const o = qt();
  for (const a of k) {
    const l = e.value.enabled[a];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${S}.enabled.${a} must be boolean` };
    o[a] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: o }
  };
}
function xr(t) {
  if (t === void 0)
    return Ze();
  const e = vr(t);
  return e._tag === "ok" ? e.value : Ze();
}
function Rr(t) {
  return [
    {
      endpointID: Ir,
      value: { moduleIds: t.order.map((e) => jt[e]) }
    },
    {
      endpointID: br,
      value: { enabledFlags: k.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
function Tr(t) {
  return Wt(t, {
    stateKey: S,
    runtimeEndpointDependencies: [er],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: xr,
    buildRuntimeEvents: ({ state: e }) => [...Rr(e)]
  });
}
const Er = "runtimeSyncRequest", wr = 2147483647, Ar = "runtimeState", Mr = "retryDesiredTableRequest", Dr = "workerLoadFailure", kr = "serviceLoadAbort", Or = "wavetableLoadBegin", Cr = "wavetableMipFrame", _r = "wavetableUploadAck", Lr = "wavetableMipRequest", Fr = "wavetablePrewarmRequest", Nr = "wavetablePrewarmNotification", Pr = "assets/factory-bank-catalog.json", Ur = 1, Br = 2, Kr = 3, Vr = 1, $r = 2, zr = 2e4, Q = Ur, Wr = Br, tt = Kr, D = Vr, nt = $r, jr = 48 * 1024 * 1024, ge = 3;
function it(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function p(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function rt(t) {
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
function ot(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function at(t, e) {
  if (!t)
    throw new Error(e);
}
function qr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Gr(t, e) {
  return nn(await t.readJSON(e));
}
function Hr(t) {
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
function Jr(t, e) {
  const n = Math.round(Number(t) || 0);
  return qr(n, 0, Math.max(0, e - 1));
}
function Ie(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Qr(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function st(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function lt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function ct() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class Xr {
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
    this.connection = e, this.resourceClient = tn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Pr, this.maxFramesInFlight = it(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? ft, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? jr) || 0)), this.serviceLoadTimeoutMs = it(n.serviceLoadTimeoutMs, zr), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, p("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Ar, this.handleRuntimeState), this.connection.addEndpointListener?.(_r, this.handleUploadAck), this.connection.addEndpointListener?.(Lr, this.handleMipRequest), this.connection.addEndpointListener?.(Fr, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Nr, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Er,
      wr
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Gr(this.resourceClient, this.catalogPath), p("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < ge; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = st(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      for (const [r, o] of this.tableCache)
        e.has(r) || (!i || o.lastUsedSerial < i.lastUsedSerial) && (n = r, i = o);
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
      byteCount: st(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ie(
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
          ...lt(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: r } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (p("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: i,
        tableIndex: r,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: i,
          tableIndex: r
        },
        {
          failurePhase: tt,
          failureReasonCode: nt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== tt || e.failureReasonCode !== nt ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Q,
    failureReasonCode: l = D
  }) {
    this.connection.sendEventOrValue?.(Dr, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: o = D
  }) {
    this.connection.sendEventOrValue?.(kr, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    p("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? rt(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Mr, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Jr(e, i.tables.length), o = i.tables[r];
    at(o, `Could not resolve table ${r}`);
    const a = Qr(o, Le, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, p("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = ct();
    p("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), d = ln(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Le
    });
    return p("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(ct() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: r,
      tableMeta: o,
      frameCount: d.frameCount,
      frames: d.frames,
      spectra: new Array(d.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    p("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Or, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    p("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Q,
      failureReasonCode: D
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Q,
      failureReasonCode: D
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Q,
    failureReasonCode: i = D
  } = {}) {
    p("error", "Service wavetable load failed", {
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
      const o = this.candidateValidations[e.oscillatorIndex];
      return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (p("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: be(o)
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
    const r = this.candidateValidations[e.oscillatorIndex];
    return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, i = this.candidateValidations[e.oscillatorIndex];
    if (i && i.dspSessionId === e.dspSessionId && i.tableIndex === n && i.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const r = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let o = null;
    try {
      o = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(e) && (p("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: be(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !o || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, r, o);
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
    for (let e = 0; e < ge; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, queueMicrotask(() => {
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
    const r = this.candidateValidations[n];
    if (r && r.dspSessionId === e.dspSessionId && r.generation > e.generationFrontier)
      return;
    const o = this.resolveServiceTarget(e);
    if (o) {
      if (!await this.prepareServiceTarget(o, e) || !this.isCurrentRuntimeState(e))
        return;
      if (o.kind === "loading" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        p("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          staleTableIndex: o.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          tableIndex: o.tableIndex,
          failureReasonCode: D
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      o.kind === "active" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e) && !i && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Hr(e ?? {});
    if (p("info", "Received runtime state", rt(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= ge)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, o = this.latestRuntimeStates[r], a = o ? this.getDesiredRetryKey(o) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || a !== l) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let a = 0; a < r.frameCount; a += 1)
          r.spectra[a] || (r.spectra[a] = Ne(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), p("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        p("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: be(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Ie(
      n,
      i,
      r,
      o,
      a
    );
    let c = this.mipJobs.get(s);
    return c ? (!c.completed && l > c.urgencyLevel && (c.urgencyLevel = l), c) : (c = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: l,
      ...lt(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (p("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndex)), c = Ie(
      i,
      r,
      o,
      a,
      l
    ), d = this.mipJobs.get(c);
    !d || d.completed || !d.inFlightFrames.has(s) || (d.inFlightFrames.delete(s), d.ackedFrames[s] || (d.ackedFrames[s] = 1, d.ackedFrameCount += 1), d.ackedFrameCount === this.serviceTable?.frameCount && d.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && d.inFlightFrames.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), ot(s, this.serviceTable?.frameCount ?? 0) && p("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      oscillatorIndex: r,
      generation: o,
      tableIndex: d.tableIndex,
      mipIndex: l,
      frameIndex: s,
      ackedFrameCount: d.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (at(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Ne(this.serviceTable.frames[e]);
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
    for (; e.inFlightFrames.size < this.maxFramesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = e.nextFrameIndex;
      let i;
      try {
        const r = this.getSpectrumForFrame(n);
        i = cn(r, e.mipIndex);
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
            failurePhase: Wr,
            failureReasonCode: D
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Cr, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndex: n,
        samples: Array.from(i)
      }), ot(n, this.serviceTable.frameCount) && p("info", "Sent wavetable mip frame", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
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
function be(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Yr(t, e = {}) {
  return new Xr(t, e);
}
async function Zr(t, e = {}) {
  return hn(t, [
    gr,
    Tr,
    // RT-01 will compose the v4 articulation service after the production
    // Cmajor endpoint consumes A/B/C arrays and all 416 sparse route cells.
    () => Yr(t, e)
  ]);
}
export {
  Br as FAILURE_PHASE_BUILD_MIP,
  Ur as FAILURE_PHASE_LOAD_SOURCE,
  Kr as FAILURE_PHASE_TRANSFER_MIP,
  Vr as FAILURE_REASON_GENERIC,
  $r as FAILURE_REASON_TIMEOUT,
  wr as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Xr as WavetableWorkerController,
  Yr as createWavetableWorkerController,
  Zr as default
};
