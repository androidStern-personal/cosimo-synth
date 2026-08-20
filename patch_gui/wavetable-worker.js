function w(t, e) {
  if (!t)
    throw new Error(e);
}
function xe(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function _n(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Ve(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ht(t) {
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
function Cn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ae(t, e) {
  const n = Cn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (_n(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function lt(t) {
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
  throw new Error(`Unsupported text resource payload (${Ht(t)})`);
}
function Ln(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Ve(t);
  throw new Error(`Unsupported binary resource payload (${Ht(t)})`);
}
function Pn(t) {
  const e = t?.frames;
  w(
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
      w(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Jt(t) {
  const e = new DataView(t);
  w(xe(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), w(xe(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const d = xe(e, c, 4), p = e.getUint32(c + 4, !0), f = c + 8;
    d === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), r = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : d === "data" && (l = f, s = p), c = f + p + p % 2;
  }
  w(n !== null, "Wave file is missing a fmt chunk"), w(l !== null && s !== null, "Wave file is missing a data chunk"), w(i === 1, "Only mono wavetable bank files are supported");
  let m;
  if (n === 3 && o === 32)
    m = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && o === 16) {
    const d = s / 2, p = new Int16Array(t.slice(l, l + s));
    m = new Float32Array(d);
    for (let f = 0; f < d; f += 1)
      m[f] = p[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: m
  };
}
async function ct(t) {
  w(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return w(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function $e(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Qt(t) {
  const e = new Uint8Array(t).buffer, n = Jt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Nn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (w(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), r = async (s) => {
    w(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return Pn(c);
  }, o = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Ae(s, c), d = await ct(m), p = Jt(d);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Ae(s, c);
    return new Uint8Array(await ct(m));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return lt(await i(s));
      const c = o(s);
      return e === "url" && c !== null ? $e(await l(s, c)) : typeof t.readResource == "function" ? lt(await i(s)) : $e(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Ln(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(s);
      const c = o(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? r(s) : Qt(await this.readBytes(s));
    },
    getURL(s) {
      return Ae(s, t.getResourceAddress?.(s));
    }
  };
}
function Fn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Nn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Un(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return $e(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return Ve(await e(a));
      if (n)
        return Ve(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : Qt(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Bn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Vn(t) {
  return Bn(t) ? Un(t) : Fn(t);
}
const pe = 2048;
function te(t, e) {
  if (!t)
    throw new Error(e);
}
function $n(t) {
  te(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    te(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), te(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), te(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), te(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Kn = 2048, Xt = 11, zn = 256;
function D(t, e) {
  if (!t)
    throw new Error(e);
}
function jn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ut = /* @__PURE__ */ new Map();
function Wn(t) {
  const e = ut.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let l = 0; l < n; l += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return ut.set(t, i), i;
}
function Yt(t, e, n = !1) {
  const i = t.length;
  D(i === e.length, "FFT real and imaginary buffers must have the same length"), D(jn(i), "FFT input length must be a power of two");
  const r = Wn(i);
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
    for (let m = 0; m < i; m += o) {
      let d = 1, p = 0;
      for (let f = 0; f < a; f += 1) {
        const I = m + f, y = I + a, k = t[y], Q = e[y], X = d * k - p * Q, Y = d * Q + p * k, Z = t[I], ee = e[I];
        t[I] = Z + X, e[I] = ee + Y, t[y] = Z - X, e[y] = ee - Y;
        const ce = d * s - p * c;
        p = d * c + p * s, d = ce;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function Zt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function Gn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Kn,
  maxFramesPerTable: i = zn
} = {}) {
  const r = Float32Array.from(t);
  D(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  D(o > 0, "Source wavetable files must contain at least one frame"), D(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && D(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let l = 0; l < o; l += 1) {
    const s = l * n, c = s + n;
    a.push(Zt(r.slice(s, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function dt(t) {
  const e = Zt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Yt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function qn(t, e, {
  mipLevelCount: n = Xt
} = {}) {
  const i = t?.real?.length ?? 0;
  D(i > 0, "Spectrum must contain real samples"), D(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), D(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    o[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (o[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return Yt(o, a, !0), Float32Array.from(o);
}
class Hn {
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
function Jn(t, e) {
  return new Hn(t, e);
}
async function Qn(t, e) {
  const n = Jn(t, e);
  return await n.start(), n;
}
const M = (t, e) => ({ label: t, value: e });
function O(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const _ = Object.freeze({
  filter: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: O(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: O(
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
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear"),
  modulationDragStyle: l.modulationDragStyle
}), Xn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Yn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Zn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: _.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      u("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(M), quick: !0 }),
      u("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      u("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      u("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: _.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      u("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [M("Classic", 0), M("Harmonics", 1)] }),
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
    iconUrl: _.ott,
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
    iconUrl: _.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      u("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(M) }),
      u("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(M) }),
      u("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      u("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      u("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      u("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      u("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(M) }),
      u("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: _.flanger,
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
    iconUrl: _.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      u("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [M("Free", 0), M("Sync", 1)] }),
      u("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      u("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Xn.map(M) }),
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
    iconUrl: _.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      u("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [M("Free", 0), M("Sync", 1)] }),
      u("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      u("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Yn.map(M) }),
      u("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      u("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      u("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: _.reverb,
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
], en = Zn, tn = Object.freeze(
  en.flatMap((t) => t.parameters)
);
new Map(
  tn.map((t) => [t.endpointID, t])
);
function nn() {
  return tn;
}
const C = 2048, ei = C + 3, mt = 20, on = "MSEG 1", ti = 0, N = 2, ni = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function He(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function G(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function ii(t) {
  return He(Number.isFinite(t) ? t : 0, -mt, mt);
}
function V(t) {
  return He(Number.isFinite(t) ? t : 0, 0, 1);
}
function rn(t = on) {
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
function Ke() {
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
function oi(t) {
  const e = Number(t);
  return He(
    Number.isFinite(e) ? e : 1,
    ti,
    N
  );
}
function ri(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = V(Number(e.startX)), i = V(Number(e.endX));
  return G(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function ai(t = Ke()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = ni.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: oi(Number.isFinite(i) ? i : 1)
    },
    loop: ri(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function si(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = V(r)), {
    x: r,
    y: V(Number(i.y)),
    curvePower: ii(Number(i.curvePower))
  };
}
function ae(t = rn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => si(r, o, n.length));
  if (!G(i[0].x, 0) || !G(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : on,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function ft(t) {
  return JSON.stringify(ae(t));
}
function li(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function ci(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (G(e, r.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && G(t[o + 1].x, e); )
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
function ui(t, e) {
  const n = V(Number(e)), i = ci(t, n);
  if (i.laterPointWins || G(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = V(li(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function di(t, e) {
  return ui(ae(t).points, e);
}
function mi(t) {
  const e = ae(t), n = new Float32Array(C);
  for (let r = 0; r < C; r += 1) {
    const o = r / (C - 1);
    n[r] = di(e, o);
  }
  const i = new Float32Array(ei);
  return i[0] = n[0], i.set(n, 1), i[C + 1] = n[C - 1], i[C + 2] = n[C - 1], i;
}
function ht(t, e) {
  return ft(t) === ft(e);
}
const g = ["A", "B", "C"], fi = [
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
], hi = [
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
  "filterMix"
], $ = Object.freeze([
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
]), pi = Object.freeze([
  ...g.flatMap((t) => fi.map(
    (e) => `osc${t}.${e}`
  )),
  ...hi
]), an = Object.freeze(
  pi.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), gi = nn().filter((t) => t.modulationTargetIndex !== null), sn = Object.freeze(
  gi.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), L = Object.freeze([
  ...an,
  ...sn
]), ge = $.length, ln = an.length, cn = sn.length, Ii = ge * L.length, Si = new Map($.map((t) => [t.id, t])), un = new Map($.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), q = new Map(L.map((t) => [t.kind, t]));
function yi() {
  if (ge !== 13 || ln !== 51 || cn !== 36 || Ii !== 1131)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = $.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 51], ["rack", 36]]) {
    const n = L.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Si.size !== ge || un.size !== ge || q.size !== L.length)
    throw new Error("Modulation identities must be unique");
}
yi();
function dn(t, e) {
  const n = un.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Je(t) {
  return typeof t != "string" ? null : q.has(t) ? t : null;
}
function vi(t) {
  const e = Je(t);
  return e !== null && q.get(e)?.group === "voice" ? e : null;
}
function bi(t) {
  const e = Je(t);
  return e !== null && q.get(e)?.group === "rack" ? e : null;
}
function Ri(t) {
  const e = q.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function xi(t) {
  const e = q.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ai(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Te = "modulationProgram", Ti = "modulationAmount", mn = $.filter((t) => t.group === "voice").length, fn = $.filter((t) => t.group === "macro").length, Se = ln, ye = cn, F = mn * Se, z = fn * Se, K = mn * ye, ne = fn * ye, hn = F + z;
function Mi(t) {
  const e = dn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Ei(t) {
  const e = vi(t);
  return e === null ? null : Ri(e);
}
function pn(t) {
  const e = Ei(t.targetKind), n = bi(t.targetKind), i = n === null ? void 0 : xi(n);
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = dn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = a.runtimeIndex;
    if (e !== null) {
      const c = l * Se + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: l,
        targetIndex: e,
        articulationCellIndex: F + c
      };
    }
    const s = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * ye + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const r = Mi(t);
  if (e !== null) {
    const a = r * Se + e;
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
    cellIndex: r * ye + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function gn(t) {
  return pn(t).articulationCellIndex;
}
function wi(t) {
  return {
    ...pn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function In(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    const i = wi(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function Di(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function j(t) {
  return [...t.values()].filter(Di).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ue(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function Me(t) {
  const e = In(t), n = j(e.voice), i = j(e.macroVoice), r = j(e.voiceRack), o = j(e.macroRack), a = Array.from({ length: F }, () => 0), l = Array.from({ length: F }, () => 0), s = Array.from({ length: F }, () => 0), c = Array.from({ length: F }, () => 0), m = Array.from({ length: F }, () => 0);
  ue(n, a, l, s, c);
  const d = Array.from({ length: z }, () => 0), p = Array.from({ length: z }, () => 0), f = Array.from({ length: z }, () => 0), I = Array.from({ length: z }, () => 0), y = Array.from({ length: z }, () => 0);
  ue(
    i,
    d,
    p,
    f,
    I
  );
  const k = Array.from({ length: K }, () => 0), Q = Array.from({ length: K }, () => 0), X = Array.from({ length: K }, () => 0), Y = Array.from({ length: K }, () => 0), Z = Array.from({ length: K }, () => 0), ee = Array.from({ length: K }, () => 0);
  ue(
    r,
    k,
    Q,
    X,
    Y
  );
  const ce = Array.from({ length: ne }, () => 0), it = Array.from({ length: ne }, () => 0), ot = Array.from({ length: ne }, () => 0), rt = Array.from({ length: ne }, () => 0), at = Array.from({ length: ne }, () => 0);
  ue(
    o,
    ce,
    it,
    ot,
    rt
  );
  for (const A of e.voice.values()) m[A.cellIndex] = A.amount;
  for (const A of e.macroVoice.values()) y[A.cellIndex] = A.amount;
  for (const A of e.voiceRack.values()) ee[A.cellIndex] = A.amount;
  for (const A of e.macroRack.values()) at[A.cellIndex] = A.amount;
  for (let A = 0; A < r.length; A += 1) {
    const st = r[A];
    if (st === void 0) throw new Error(`Missing compiled voice-rack route at index ${A}`);
    Z[A] = st.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: m,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: p,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: k,
    voiceRackRouteSources: Q,
    voiceRackRouteTargets: X,
    voiceRackRoutePolarities: Y,
    voiceRackRouteReducers: Z,
    voiceRackRouteAmounts: ee,
    macroRackRouteCount: o.length,
    macroRackRouteCells: ce,
    macroRackRouteSources: it,
    macroRackRouteTargets: ot,
    macroRackRoutePolarities: rt,
    macroRackRouteAmounts: at
  };
}
const ki = ["voice", "macroVoice", "voiceRack", "macroRack"], Oi = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function pt(t) {
  return In(t);
}
function _i(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ci(t, e) {
  if (t === null)
    return [{ endpointID: Te, value: Me(e) }];
  const n = pt(t), i = pt(e), r = [];
  for (const o of ki) {
    const a = j(n[o]), l = j(i[o]);
    if (a.length !== l.length)
      return [{ endpointID: Te, value: Me(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], m = l[s];
      if (c === void 0 || m === void 0 || !_i(c, m))
        return [{ endpointID: Te, value: Me(e) }];
      c.amount !== m.amount && r.push({
        endpointID: Ti,
        value: {
          pathKind: Oi[o],
          cellIndex: m.cellIndex,
          amount: m.amount
        }
      });
    }
  }
  return r;
}
function H(t) {
  return { _tag: "ok", value: t };
}
function re(t) {
  return { _tag: "err", error: t };
}
function Li(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Pi(t) {
  throw new Error(t ?? "Invariant violated");
}
function de(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const Ni = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      de("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      de("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      de("mix", "Mix", 100, 100),
      de("drive", "Drive", 15, 0)
    ]
  }
], gt = 1e-6;
function J(t, e) {
  if (!Number.isFinite(t) || t < -gt || t > 1 + gt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function ve(t, e) {
  return J(t / 100, `${e} catalog percentage`);
}
function Qe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Fi(t) {
  return 20 * 1e3 ** t;
}
function Ui(t) {
  return J(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Bi(t) {
  return 0.1 * 200 ** t;
}
function Vi(t) {
  return J(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function $i(t) {
  return t;
}
function Ki(t) {
  return J(t, "filterMix endpoint conversion");
}
function Ie(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function zi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: Ie("filterCutoff", Fi, Ui),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ie("filterQ", Bi, Vi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ie("filterMix", $i, Ki),
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
function Sn(t) {
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
      return Li(t);
  }
}
function ji(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Wi(t, e) {
  const n = Qe(t.moduleId, e.id), i = Sn(e.format), r = zi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: ve(e.defaultPercent, n),
    initialValue: ve(e.initialPercent, n),
    format: i,
    modAmount: ji(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Gi = [
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
function qi(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Hi(t, e) {
  const n = `osc${t}`, i = Qe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: ve(e.defaultPercent, i),
    initialValue: ve(e.initialPercent, i),
    format: Sn(e.format),
    modAmount: qi(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Ji = Object.freeze(
  g.flatMap((t) => Gi.map((e) => Hi(t, e)))
), Qi = Object.freeze([
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
  { moduleId: "env3", targetIdSuffix: "release", endpointID: "env3Release", targetKind: "env3Release", label: "ENV 3 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env3.releaseSeconds" }
]);
function Xi(t) {
  const e = Qe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => J(
    (o - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: r(t.initial),
    initialValue: r(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: Ie(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Yi = Object.freeze(
  Qi.map(Xi)
);
function Zi(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ee(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return J(n, `${t.endpointID} endpoint conversion`);
}
function eo(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function to(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function no(t) {
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
function io(t) {
  const e = Zi(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ee(t, t.initial),
    initialValue: Ee(t, t.initial),
    format: to(t),
    modAmount: no(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => eo(t, n),
      fromEngine: (n) => Ee(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const Xe = Object.freeze(
  [
    ...en.flatMap((t) => t.parameters.map(io)),
    ...Ji,
    ...Yi,
    ...Ni.flatMap(
      (t) => t.parameters.map(
        (e) => Wi(t, e)
      )
    )
  ]
), oo = new Map(
  Xe.map((t) => [t.targetId, t])
), yn = Xe.filter(
  (t) => t.modulationTargetKind !== null
), ze = new Map(
  yn.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (oo.size !== Xe.length)
  throw new Error("Target descriptor IDs must be unique");
if (yn.length !== L.length || ze.size !== L.length || L.some((t) => ze.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function It(t) {
  const e = ze.get(t);
  return e === void 0 ? Pi(`Modulation target "${t}" has no display descriptor`) : e;
}
function ro(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = It(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = It(t);
  return n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const ie = "modulation.v6", vn = 6, se = 3, U = 3, St = "modulationMsegBuffer", ao = "modulationMsegPlayback", bn = 4, so = ["MSEG 1", "MSEG 2", "MSEG 3"], Rn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], lo = ["Env 1", "Env 2", "Env 3"], co = 1e-3, b = 10, uo = 0.1, mo = 20, fo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: mo - uo },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
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
  mseg1Rate: { min: -N, max: N },
  mseg2Rate: { min: -N, max: N },
  mseg3Rate: { min: -N, max: N },
  env1Attack: { min: -b, max: b },
  env1Decay: { min: -b, max: b },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -b, max: b },
  env2Attack: { min: -b, max: b },
  env2Decay: { min: -b, max: b },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -b, max: b },
  env3Attack: { min: -b, max: b },
  env3Decay: { min: -b, max: b },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -b, max: b }
}, ho = nn().filter((t) => t.modulationTargetIndex !== null), po = new Map(
  ho.map((t) => [`rack.${t.endpointID}`, t])
);
class we extends Error {
  name = "ModulationStateParseError";
}
const go = {
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
$.map((t) => ({
  value: t.id,
  label: go[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
L.map((t) => ({
  value: t.kind,
  label: ro(t.kind)
}));
function Io(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ye(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function De(t, e) {
  const n = Number(t);
  return Ye(Number.isFinite(n) ? n : e, co, b);
}
function So(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function yo(t) {
  const e = po.get(t);
  return e !== void 0 ? So(e) : fo[Ai(t)];
}
function vo(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function bo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Ro(t, e) {
  const n = yo(t), i = Number(e);
  return Ye(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function xo(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Ao(t) {
  return xo(t) ?? "mseg";
}
function To(t) {
  return Je(t);
}
function Mo(t) {
  return To(t) ?? "oscA.wavetablePosition";
}
function Eo(t, e) {
  const n = Rn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function wo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? se : t === "macro" ? bn : U;
  return Ye(Number.isFinite(n) ? n : 1, 1, i);
}
function W(t) {
  return {
    name: lo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function xn(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = W(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: De(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: De(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: V(n.sustain ?? i.sustain),
    releaseSeconds: De(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function Do(t, e = 0) {
  return { name: xn(t, e).name };
}
function ko(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: vo(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: wo(n, t.sourceSlot),
    polarity: bo(t.polarity),
    targetKind: i,
    amount: Ro(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Oo(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = Ao(i.sourceKind), o = Mo(i.targetKind);
  return ko(i, e, r, o);
}
function _o(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Co(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Oo(n, i));
}
function Lo(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = _o(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function je(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => je(a, e[l]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => Io(i, a) && je(n[a], i[a]));
}
function An(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = rn(so[e] ?? `MSEG ${e + 1}`), r = ae(n.shapeA ?? i), o = ai({
    ...Ke(),
    ...n.playback ?? {},
    rate: Ke().rate
  }), { rate: a, ...l } = o;
  return {
    shapeA: r,
    shapeB: ae(n.shapeB ?? r),
    playback: l
  };
}
function We() {
  return {
    format: "cosimo.modulation",
    version: vn,
    msegSlots: Array.from({ length: se }, (t, e) => An({}, e)),
    envelopeSlots: Array.from({ length: U }, (t, e) => ({
      name: W(e).name
    })),
    routes: [],
    macroNames: Rn.slice()
  };
}
function Po(t = We()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: vn,
    msegSlots: Array.from({ length: se }, (o, a) => An(n[a], a)),
    envelopeSlots: Array.from({ length: U }, (o, a) => Do(i[a], a)),
    routes: Co(e.routes),
    macroNames: Array.from(
      { length: bn },
      (o, a) => Eo(r[a], a)
    )
  };
}
function yt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return re(new we("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return re(new we("Expected valid modulation JSON"));
    }
  }
  const n = Po(e);
  return !je(e, n) || !Lo(n.routes) ? re(new we("Expected the current modulation schema")) : H(n);
}
function No(t, e) {
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
function vt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(mi(n))
  };
}
function Fo(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Uo(t, e = null) {
  const n = [];
  for (let i = 0; i < se; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !ht(o.shapeA, r.shapeA)) && n.push({
      endpointID: St,
      value: vt(i, 0, r.shapeA)
    }), (o === void 0 || !ht(o.shapeB, r.shapeB)) && n.push({
      endpointID: St,
      value: vt(i, 1, r.shapeB)
    }), (o === void 0 || !Fo(o.playback, r.playback)) && n.push({
      endpointID: ao,
      value: No(i, r.playback)
    });
  }
  return n.push(...Ci(e?.routes ?? null, t.routes)), n;
}
const ke = "articulationSnapshot", S = 128, bt = 48, Bo = 1e6, x = -1, Oe = [
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
function Ze(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function _e(t) {
  return Ze(Number.isFinite(t) ? t : 0, 0, 1);
}
function T(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Ze(Number.isFinite(r) ? r : e, n, i);
}
function R(t, e, n, i) {
  return Ze(Math.round(T(t, e)), n, i);
}
function Tn(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Ce() {
  return Array.from({ length: S }, () => x);
}
function Vo(t) {
  const e = R(t, 0, 0, S - 1), n = Oe[e % Oe.length], i = Math.floor(e / Oe.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function $o() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: -9.542425,
    mute: 0,
    solo: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoff: 1e3,
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
function Ko(t) {
  const e = $o(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: T(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: T(n.pan, e.pan, -1, 1),
    octave: R(n.octave, e.octave, -4, 4),
    semitone: R(n.semitone, e.semitone, -12, 12),
    fineCents: T(n.fineCents, e.fineCents, -100, 100),
    volumeDb: T(n.volumeDb, e.volumeDb, -48, 6),
    mute: R(n.mute, e.mute, 0, 1),
    solo: R(n.solo, e.solo, 0, 1),
    warpMode: R(n.warpMode, e.warpMode, 0, 4),
    warpAmount: T(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: R(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: T(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterQ: T(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: R(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: T(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: T(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: T(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: T(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: T(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: R(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: R(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: R(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: T(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: T(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      _e(Number(i[0])),
      _e(Number(i[1])),
      _e(Number(i[2]))
    ]
  };
}
function zo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: T(e.amount, 0, -48, 48)
  } : null;
}
function jo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(zo).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Ko(e.parameters),
    envelopes: [0, 1, 2].map((r) => xn(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Wo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = R(n.runtimeSlot, e, 0, S - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Vo(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: jo(n.snapshot)
  };
}
function Go(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: R(n.note, 0, 0, S - 1),
    articulationId: i
  } : null;
}
function qo(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let l = R(o.min, r, r, S - 1), s = R(o.max, l, r, S - 1);
  return s < l && ([l, s] = [s, l]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: l,
    max: s
  };
}
function Rt(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < r.length; l += 1) {
    const s = qo(
      r[l],
      e,
      l,
      n,
      i
    );
    !s || o.has(s.id) || (o.add(s.id), a.push(s));
  }
  return a;
}
function Ho(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = Go(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function Jo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let s = 0; s < n.length && o.length < S; s += 1) {
    const c = Wo(n[s], s);
    !c || i.has(c.runtimeSlot) || r.has(c.id) || (i.add(c.runtimeSlot), r.add(c.id), o.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((s) => s.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(o.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Tn(e.activeTriggerMode),
    slots: o,
    chainAssignments: Rt(e.chainAssignments, l, "chain", 0),
    keyAssignments: Ho(e.keyAssignments, l),
    velocityAssignments: Rt(e.velocityAssignments, l, "velocity", 1)
  };
}
function xt(t) {
  const e = (n) => g.map(() => n);
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
    volumeDbs: e(-9.542425),
    mutes: e(0),
    solos: e(0),
    warpModes: e(0),
    warpAmounts: e(0),
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterQ: 0.707107,
    unisonVoices: e(1),
    unisonDetunes: e(0.1),
    unisonBlends: e(0.75),
    unisonWidths: e(1),
    unisonDetuneModes: e(0),
    unisonStackModes: e(0),
    unisonWavetablePositionSpreads: e(0),
    unisonWarpSpreads: e(0),
    msegMorphs: Array.from({ length: se }, () => 0),
    routeAmounts: Array.from({ length: hn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: U }, (n, i) => W(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: U }, (n, i) => W(i).decaySeconds),
    envelopeSustain: Array.from({ length: U }, (n, i) => W(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: U }, (n, i) => W(i).releaseSeconds)
  };
}
function At(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === x && (t[o] = r);
  }
}
function Qo(t) {
  const e = Jo(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = Ce(), r = Ce(), o = Ce();
  At(i, e.chainAssignments, n), At(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const l = n.get(a.articulationId);
    l === void 0 || r[a.note] !== x || (r[a.note] = l);
  }
  return o[0] = x, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function Xo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Qo(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Tn(e.activeMode),
    chain: Array.from({ length: S }, (n, i) => R(e.chain?.[i], x, x, S - 1)),
    key: Array.from({ length: S }, (n, i) => R(e.key?.[i], x, x, S - 1)),
    velocity: Array.from({ length: S }, (n, i) => i === 0 ? x : R(e.velocity?.[i], x, x, S - 1))
  });
}
function Yo(t, e) {
  const n = Xo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const oe = "articulations.v4", et = [
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
], tt = [
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
  "env3.releaseSeconds"
], Zo = [
  ...g.flatMap((t) => et.map(
    (e) => `osc${t}.${e}`
  )),
  ...tt
];
class Mn extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function h(t) {
  return re(new Mn("malformed", t));
}
function le(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function nt(t, e, n) {
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
function be(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < S;
}
function er(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function tr(t) {
  return Zo.some((e) => e === t);
}
function Tt(t, e) {
  if (!le(t))
    return h(`${e} must be an object`);
  const n = nt(t, ["min", "max"], e);
  return n !== null ? h(n) : be(t.min) ? be(t.max) ? t.min > t.max ? h(`${e}.min must be less than or equal to ${e}.max`) : H({ min: t.min, max: t.max }) : h(`${e}.max must be an integer in 0..127`) : h(`${e}.min must be an integer in 0..127`);
}
function nr(t, e) {
  if (!le(t))
    return h(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return h(`${e} has a non-string parameter id`);
    if (!tr(i))
      return h(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return h(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return H(n);
}
function ir(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function or() {
  return {};
}
function rr(t, e, n) {
  if (!le(t))
    return h(`${e} must be an object`);
  const i = or();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return h(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > bt)
      return h(
        `${e}.${r} must be a finite route amount within ±${bt}`
      );
    if (!n.has(r))
      return h(`${e}.${r} does not name a current articulable mapping`);
    ir(i, r, o);
  }
  return H(i);
}
function ar(t, e, n) {
  const i = `slots[${e}]`;
  if (!le(t))
    return h(`${i} must be an object`);
  const r = nt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return h(r);
  if (typeof t.id != "string")
    return h(`${i}.id must be a string`);
  if (!be(t.runtimeSlot))
    return h(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return h(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return h(`${i}.color must be a string`);
  if (!be(t.key))
    return h(`${i}.key must be an integer in 0..127`);
  const o = Tt(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Tt(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = nr(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = rr(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : H({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: l.value,
    routeAmounts: s.value
  });
}
const sr = Object.fromEntries(
  et.map((t, e) => [t, 2 ** e])
), lr = Object.fromEntries(
  tt.map((t, e) => [t, 2 ** e])
);
function Mt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function cr(t, e) {
  return et.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | sr[i] : n, 0);
}
function ur(t) {
  return tt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | lr[n] : e, 0);
}
function dr(t, e) {
  const n = (o, a) => Mt(t, `osc${o}.${a}`), i = (o) => Mt(t, o), r = Array.from(
    { length: hn },
    () => Bo
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const l = e[o];
    l !== void 0 && (r[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: g.map((o) => cr(t, o)),
    sharedOverrideMask: ur(t),
    framePositions: g.map((o) => n(o, "framePosition")),
    pans: g.map((o) => n(o, "pan")),
    octaves: g.map((o) => n(o, "octave")),
    semitones: g.map((o) => n(o, "semitone")),
    fineCents: g.map((o) => n(o, "fineCents")),
    phases: g.map((o) => n(o, "phase")),
    phaseRandoms: g.map((o) => n(o, "phaseRandom")),
    retriggers: g.map((o) => n(o, "retrigger")),
    volumeDbs: g.map((o) => n(o, "volumeDb")),
    mutes: g.map((o) => n(o, "mute")),
    solos: g.map((o) => n(o, "solo")),
    warpModes: g.map((o) => n(o, "warpMode")),
    warpAmounts: g.map((o) => n(o, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterQ: i("filterQ"),
    unisonVoices: g.map((o) => n(o, "unisonVoices")),
    unisonDetunes: g.map((o) => n(o, "unisonDetune")),
    unisonBlends: g.map((o) => n(o, "unisonBlend")),
    unisonWidths: g.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: g.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: g.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: g.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: g.map((o) => n(o, "unisonWarpSpread")),
    msegMorphs: [
      i("msegMorph1"),
      i("msegMorph2"),
      i("msegMorph3")
    ],
    routeAmounts: r,
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
function mr(t, e) {
  return t.slots.map((n) => dr(n, e));
}
function fr(t, e) {
  if (!le(t))
    return h("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return h('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return re(new Mn(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = nt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return h(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return h("selectedSlotId must be null or a string");
  if (!er(t.activeTriggerMode))
    return h('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return h("slots must be an array");
  if (t.slots.length > S)
    return h(`slots must contain at most ${S} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = ar(t.slots[a], a, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (r.has(s.id))
      return h(`slots[${a}].id duplicates "${s.id}"`);
    if (o.has(s.runtimeSlot))
      return h(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    r.add(s.id), o.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? h(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : H({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function En() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function hr(t) {
  const e = Array.from({ length: S }, () => x), n = Array.from({ length: S }, () => x), i = Array.from({ length: S }, () => x);
  for (const r of t.slots) {
    n[r.key] === x && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === x && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === x && (i[o] = r.runtimeSlot);
  }
  return i[0] = x, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Ge = "runtimeState";
function wn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const pr = {
  endpointID: Ge,
  required: !0,
  mapValue: wn
}, Et = "runtimeInstallAck", gr = "runtimeSyncRequest", wt = 0, Ir = 8e3, Re = /* @__PURE__ */ new WeakMap(), Dn = 1e9;
let me = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Dn;
function Sr(t) {
  return me = me % Dn + 1, t === "modulation" ? -1e9 - me : 1e9 + me;
}
function yr(t, e) {
  const n = t, i = Re.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Re.set(n, i);
}
function Dt(t, e) {
  const n = t, i = Re.get(n);
  i?.delete(e), i?.size === 0 && Re.delete(n);
}
const vr = [100, 250, 500, 1e3], fe = { _tag: "accepted" }, br = { _tag: "superseded" }, Rr = { _tag: "stopped" }, kt = { _tag: "transport-timeout" };
function xr(t) {
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
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || r < 0 || o < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function Ar(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Ot {
  #r;
  #e;
  #d;
  #v;
  #m = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #o = /* @__PURE__ */ new Map();
  #u = 0;
  #i = !1;
  #a = 0;
  #f = /* @__PURE__ */ new Set();
  #b = this.#w.bind(this);
  constructor(e, n) {
    this.#r = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#d = i && i.length > 0 ? i : [...vr], this.#v = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Ir)
    );
  }
  start() {
    if (!this.#i) {
      yr(this.#r, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#r.addEndpointListener?.(Et, this.#b);
      } catch (e) {
        throw this.#i = !1, Dt(this.#r, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#r.removeEndpointListener?.(Et, this.#b), Dt(this.#r, this.#e), this.#o.clear(), this.#s = null, this.#l.clear(), this.#y());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#o.clear(), this.#a += 1, this.#y());
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
      const r = await this.#R(
        n,
        i
      );
      if (r._tag !== "accepted")
        return r;
      let o = null;
      for (const a of e) {
        const l = await this.#E(
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
      return o ?? fe;
    } finally {
      this.#m = !1;
    }
  }
  #A(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #T(e, n) {
    const i = this.#A(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #M() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #R(e, n) {
    if (this.#s === e)
      return fe;
    const i = Sr(this.#e);
    this.#l.add(i);
    const r = Date.now() + this.#v;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return fe;
        const l = r - Date.now();
        if (l <= 0)
          return kt;
        const s = this.#a;
        this.#I(i), await this.#S(
          s,
          Math.min(this.#g(o), l)
        ), o += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #E(e, n, i) {
    const r = this.#M(), o = Ar(e.value, n, r);
    let a = 0, l = 0, s = this.#c;
    for (this.#x(e.endpointID, o); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const m = this.#h(n, r, s);
      if (m !== null)
        return m;
      const d = this.#a;
      await this.#S(
        d,
        this.#g(a)
      );
      const p = this.#h(
        n,
        r,
        s
      );
      if (p !== null)
        return p;
      let f = this.#a;
      for (this.#I(r); ; ) {
        const I = this.#p(n, i);
        if (I)
          return I;
        const y = await this.#S(
          f,
          this.#g(a)
        ), k = this.#h(
          n,
          r,
          s
        );
        if (k !== null)
          return k;
        if (y && this.#n?.dspSessionId === n && this.#n.syncSerial === r) {
          if (l >= 1)
            return kt;
          s = this.#c, this.#x(e.endpointID, o), l += 1, a += 1;
          break;
        }
        if (y) {
          f = this.#a;
          continue;
        }
        y || (a += 1, f = this.#a, this.#I(r));
      }
    }
  }
  #h(e, n, i) {
    const r = this.#n;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#T(r, n) ? (this.#o.delete(n), fe) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Rr : this.#t !== e ? br : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #x(e, n) {
    try {
      this.#r.sendEventOrValue?.(
        e,
        n,
        void 0,
        wt
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          gr,
          e,
          void 0,
          wt
        );
      } catch {
      }
  }
  #w(e) {
    const n = xr(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#s = n.dspSessionId), this.#n = n, this.#c += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#c
      }); this.#o.size > 16; ) {
        const r = this.#o.keys().next().value;
        if (r === void 0) break;
        this.#o.delete(r);
      }
    this.#a += 1, this.#y();
  }
  #S(e, n) {
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
const Tr = 1e3, Le = [ie, oe];
function _t(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Pe(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (_t(i, e)) return i[e];
  if (_t(n, e)) return n[e];
}
function Ne(t, e) {
  if (t === void 0) return En();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = fr(n, e);
  return i._tag === "ok" ? i.value : null;
}
function Ct(t) {
  return new Set(t.routes.flatMap((e) => gn(e) === null ? [] : [e.id]));
}
function Lt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Mr {
  constructor(e) {
    this.connection = e, this.modulationLane = new Ot(e, { laneKind: "modulation" }), this.articulationLane = new Ot(e, { laneKind: "articulation" });
  }
  modulationState = We();
  articulationBank = En();
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
    { length: S },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Ge, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Ge, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Le) this.connection.requestStoredStateValue(n);
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
    const n = Pe(e, ie), i = n === void 0 ? { _tag: "ok", value: We() } : yt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      const a = Pe(e, oe), l = Ne(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = Pe(e, oe), o = Ne(
      r,
      Ct(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${oe} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Le.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Le.length) {
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
    if (e === ie) {
      const r = yt(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Ne(n, Ct(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${oe}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = wn(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, r = this.lastAppliedModulationGeneration !== e, o = Uo(
      n,
      r ? null : this.lastAppliedModulationState
    ), a = await this.modulationLane.sendBatch(o);
    if (!this.acceptOutcome("modulation", a, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = e, this.desiredStateChanged(e, n, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(n, i), s = Array.from({ length: S }, (f, I) => {
      const y = l.get(I);
      return y ? Lt(y) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, m = c && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let f = 0; f < S; f += 1) {
      const I = l.get(f), y = s[f] !== this.lastAppliedArticulationTokens[f];
      m ? d.push({
        endpointID: ke,
        value: I ?? xt(f)
      }) : c ? I && d.push({ endpointID: ke, value: I }) : y && d.push({
        endpointID: ke,
        value: I ?? xt(f)
      });
    }
    const p = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", p, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, Yo(
      hr(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = gn(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      mr(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = Lt(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Tr));
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
function Er(t) {
  return new Mr(t);
}
const E = "rack.v1", wr = "rackOrder", Dr = "rackEnable", B = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), kn = Object.freeze({
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
  B.map((t) => [kn[t], t])
);
function On() {
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
function Pt() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...B],
    enabled: On()
  };
}
function kr(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${E} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${E} is not valid JSON: ${n}` };
  }
}
function Nt(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Or(t) {
  return typeof t != "string" ? null : B.find((e) => e === t) ?? null;
}
function _r(t) {
  const e = kr(t);
  if (e._tag === "err")
    return e;
  if (!Nt(e.value))
    return { _tag: "err", message: `${E} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const a of Reflect.ownKeys(e.value))
    if (typeof a != "string" || !n.has(a))
      return { _tag: "err", message: `${E} has unexpected field ${String(a)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${E} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== B.length)
    return { _tag: "err", message: `${E}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const a of e.value.order) {
    const l = Or(a);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${E}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!Nt(e.value.enabled))
    return { _tag: "err", message: `${E}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== B.length)
    return { _tag: "err", message: `${E}.enabled must contain every effect once` };
  const o = On();
  for (const a of B) {
    const l = e.value.enabled[a];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${E}.enabled.${a} must be boolean` };
    o[a] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: o }
  };
}
function Cr(t) {
  if (t === void 0)
    return Pt();
  const e = _r(t);
  return e._tag === "ok" ? e.value : Pt();
}
function Lr(t) {
  return [
    {
      endpointID: wr,
      value: { moduleIds: t.order.map((e) => kn[e]) }
    },
    {
      endpointID: Dr,
      value: { enabledFlags: B.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const Pr = 2e3;
function Ft(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Nr(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Ft(i, e) ? {
    found: !0,
    value: i[e]
  } : Ft(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Ut(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Fr {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Ur(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Nr(e, this.options.stateKey);
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
    }, r = Ut(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), l = Ut({
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
        this.options.sendTimeoutMilliseconds ?? Pr
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Ur(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Br(t, e) {
  return new Fr(t, e);
}
function Vr(t) {
  return Br(t, {
    stateKey: E,
    runtimeEndpointDependencies: [pr],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Cr,
    buildRuntimeEvents: ({ state: e }) => [...Lr(e)]
  });
}
const $r = "runtimeSyncRequest", Kr = 2147483647, zr = "runtimeState", jr = "retryDesiredTableRequest", Wr = "workerLoadFailure", Gr = "serviceLoadAbort", qr = "wavetableLoadBegin", Hr = "wavetableMipFrame", Jr = "wavetableUploadAck", Qr = "wavetableMipRequest", Xr = "wavetablePrewarmRequest", Yr = "wavetablePrewarmNotification", Zr = "assets/factory-bank-catalog.json", qe = 3, ea = 1, ta = qe * pe, na = 1, ia = 2, oa = 3, ra = 1, aa = 2, sa = 2e4, he = na, la = ia, Bt = oa, P = ra, Vt = aa, ca = 48 * 1024 * 1024, Fe = 3;
function $t(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function v(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Kt(t) {
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
function zt(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function jt(t, e) {
  if (!t)
    throw new Error(e);
}
function ua(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function da(t, e) {
  return $n(await t.readJSON(e));
}
function ma(t) {
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
function fa(t, e) {
  const n = Math.round(Number(t) || 0);
  return ua(n, 0, Math.max(0, e - 1));
}
function Ue(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function ha(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Wt(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Gt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function qt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function pa(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class ga {
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
    this.connection = e, this.resourceClient = Vn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Zr, this.maxBatchesInFlight = $t(
      n.maxFramesInFlight,
      ea
    ), this.mipLevelCount = n.mipLevelCount ?? Xt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ca) || 0)), this.serviceLoadTimeoutMs = $t(n.serviceLoadTimeoutMs, sa), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, v("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(zr, this.handleRuntimeState), this.connection.addEndpointListener?.(Jr, this.handleUploadAck), this.connection.addEndpointListener?.(Qr, this.handleMipRequest), this.connection.addEndpointListener?.(Xr, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Yr, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      $r,
      Kr
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await da(this.resourceClient, this.catalogPath), v("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Fe; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Wt(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Wt(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ue(
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
          ...Gt(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: r } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (v("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Bt,
          failureReasonCode: Vt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Bt || e.failureReasonCode !== Vt ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = he,
    failureReasonCode: l = P
  }) {
    this.connection.sendEventOrValue?.(Wr, {
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
    failureReasonCode: o = P
  }) {
    this.connection.sendEventOrValue?.(Gr, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    v("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Kt(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(jr, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = fa(e, i.tables.length), o = i.tables[r];
    jt(o, `Could not resolve table ${r}`);
    const a = ha(o, pe, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, v("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = qt();
    v("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), m = Gn(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: pe
    });
    return v("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: m.frameCount,
      loadDurationMs: Math.round(qt() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: r,
      tableMeta: o,
      frameCount: m.frameCount,
      frames: m.frames,
      spectra: new Array(m.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    v("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(qr, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    v("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: he,
      failureReasonCode: P
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: he,
      failureReasonCode: P
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = he,
    failureReasonCode: i = P
  } = {}) {
    v("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (v("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Be(o)
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
      this.isCurrentRuntimeState(e) && (v("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Be(a)
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
    for (let e = 0; e < Fe; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, pa(() => {
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
        v("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: P
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
    const n = ma(e ?? {});
    if (v("info", "Received runtime state", Kt(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Fe)
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
          r.spectra[a] || (r.spectra[a] = dt(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), v("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        v("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Be(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Ue(
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
      ...Gt(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (v("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), m = Ue(
      i,
      r,
      o,
      a,
      l
    ), d = this.mipJobs.get(m), p = this.serviceTable?.frameCount ?? 0, f = Math.min(
      qe,
      p - s
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(s) || c <= 0 || c !== f)) {
      d.inFlightBatchBases.delete(s);
      for (let I = 0; I < c; I += 1) {
        const y = s + I;
        d.ackedFrames[y] || (d.ackedFrames[y] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === p && d.nextFrameIndex >= p && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), zt(s, c, p) && v("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: o,
        tableIndex: d.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: c,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: p,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (jt(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = dt(this.serviceTable.frames[e]);
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
        qe,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(ta);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, l = this.getSpectrumForFrame(a), s = qn(l, e.mipIndex);
          r.set(s, o * pe);
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
            failurePhase: la,
            failureReasonCode: P
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Hr, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), zt(n, i, this.serviceTable.frameCount) && v("info", "Sent wavetable mip batch", {
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
function Be(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ia(t, e = {}) {
  return new ga(t, e);
}
async function Sa(t, e = {}) {
  return Qn(t, [
    Er,
    Vr,
    () => Ia(t, e)
  ]);
}
export {
  ea as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  ia as FAILURE_PHASE_BUILD_MIP,
  na as FAILURE_PHASE_LOAD_SOURCE,
  oa as FAILURE_PHASE_TRANSFER_MIP,
  ra as FAILURE_REASON_GENERIC,
  aa as FAILURE_REASON_TIMEOUT,
  qe as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  Kr as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  ga as WavetableWorkerController,
  Ia as createWavetableWorkerController,
  Sa as default
};
