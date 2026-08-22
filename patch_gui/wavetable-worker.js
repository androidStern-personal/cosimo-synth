function w(t, e) {
  if (!t)
    throw new Error(e);
}
function Ae(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Un(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function $e(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Yt(t) {
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
function Bn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Te(t, e) {
  const n = Bn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Un(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function mt(t) {
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
  throw new Error(`Unsupported text resource payload (${Yt(t)})`);
}
function Vn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return $e(t);
  throw new Error(`Unsupported binary resource payload (${Yt(t)})`);
}
function $n(t) {
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
function Zt(t) {
  const e = new DataView(t);
  w(Ae(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), w(Ae(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const d = Ae(e, c, 4), p = e.getUint32(c + 4, !0), f = c + 8;
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
async function ft(t) {
  w(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return w(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Ke(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function en(t) {
  const e = new Uint8Array(t).buffer, n = Zt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Kn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (w(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), r = async (s) => {
    w(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return $n(c);
  }, o = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Te(s, c), d = await ft(m), p = Zt(d);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Te(s, c);
    return new Uint8Array(await ft(m));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return mt(await i(s));
      const c = o(s);
      return e === "url" && c !== null ? Ke(await l(s, c)) : typeof t.readResource == "function" ? mt(await i(s)) : Ke(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Vn(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(s);
      const c = o(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? r(s) : en(await this.readBytes(s));
    },
    getURL(s) {
      return Te(s, t.getResourceAddress?.(s));
    }
  };
}
function zn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Kn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function jn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return Ke(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return $e(await e(a));
      if (n)
        return $e(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : en(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Wn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Gn(t) {
  return Wn(t) ? jn(t) : zn(t);
}
const pe = 2048;
function te(t, e) {
  if (!t)
    throw new Error(e);
}
function qn(t) {
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
const Hn = 2048, tn = 11, Jn = 256;
function D(t, e) {
  if (!t)
    throw new Error(e);
}
function Qn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ht = /* @__PURE__ */ new Map();
function Xn(t) {
  const e = ht.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let l = 0; l < n; l += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return ht.set(t, i), i;
}
function nn(t, e, n = !1) {
  const i = t.length;
  D(i === e.length, "FFT real and imaginary buffers must have the same length"), D(Qn(i), "FFT input length must be a power of two");
  const r = Xn(i);
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
function on(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function Yn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Hn,
  maxFramesPerTable: i = Jn
} = {}) {
  const r = Float32Array.from(t);
  D(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  D(o > 0, "Source wavetable files must contain at least one frame"), D(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && D(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let l = 0; l < o; l += 1) {
    const s = l * n, c = s + n;
    a.push(on(r.slice(s, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function pt(t) {
  const e = on(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return nn(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Zn(t, e, {
  mipLevelCount: n = tn
} = {}) {
  const i = t?.real?.length ?? 0;
  D(i > 0, "Spectrum must contain real samples"), D(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), D(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    o[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (o[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return nn(o, a, !0), Float32Array.from(o);
}
class ei {
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
function ti(t, e) {
  return new ei(t, e);
}
async function ni(t, e) {
  const n = ti(t, e);
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
}), ii = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], oi = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], ri = [
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
      u("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: ii.map(M) }),
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
      u("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: oi.map(M) }),
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
], rn = ri, an = Object.freeze(
  rn.flatMap((t) => t.parameters)
);
new Map(
  an.map((t) => [t.endpointID, t])
);
function sn() {
  return an;
}
const g = ["A", "B", "C"], ai = [
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
], si = [
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
]), li = Object.freeze([
  ...g.flatMap((t) => ai.map(
    (e) => `osc${t}.${e}`
  )),
  ...si
]), ln = Object.freeze(
  li.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), ci = sn().filter((t) => t.modulationTargetIndex !== null), cn = Object.freeze(
  ci.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), L = Object.freeze([
  ...ln,
  ...cn
]), ge = $.length, un = ln.length, Je = cn.length, ui = ge * L.length, di = new Map($.map((t) => [t.id, t])), dn = new Map($.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), q = new Map(L.map((t) => [t.kind, t]));
function mi() {
  if (ge !== 13 || un !== 51 || Je !== 36 || ui !== 1131)
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
  if (di.size !== ge || dn.size !== ge || q.size !== L.length)
    throw new Error("Modulation identities must be unique");
}
mi();
function mn(t, e) {
  const n = dn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Qe(t) {
  return typeof t != "string" ? null : q.has(t) ? t : null;
}
function fi(t) {
  const e = Qe(t);
  return e !== null && q.get(e)?.group === "voice" ? e : null;
}
function hi(t) {
  const e = Qe(t);
  return e !== null && q.get(e)?.group === "rack" ? e : null;
}
function pi(t) {
  const e = q.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function gi(t) {
  const e = q.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ii(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Si = 4, fn = /* @__PURE__ */ new Map([
  ["delay", [
    { endpointID: "delayTime", laneOffset: 0, mirrorRackKind: "rack.delayTime" },
    { endpointID: "delayFeedback", laneOffset: 1, mirrorRackKind: "rack.delayFeedback" },
    { endpointID: "delayFilter", laneOffset: 2, mirrorRackKind: "rack.delayFilter" },
    { endpointID: "delayMix", laneOffset: 3, mirrorRackKind: "rack.delayMix" }
  ]]
]), yi = /^lane\.([a-z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function xe(t) {
  if (typeof t != "string")
    return null;
  const e = yi.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = fn.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.some((o) => o.endpointID === r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function hn(t) {
  const n = fn.get(t.deviceType)?.find((i) => i.endpointID === t.endpointID);
  if (n === void 0)
    throw new Error(`Unknown lane endpoint ${t.deviceType}.${t.endpointID}`);
  return n;
}
function vi(t) {
  return hn(t).mirrorRackKind;
}
function pn(t, e) {
  if (t === null)
    return null;
  const n = e.get(t.instanceId);
  return n === void 0 ? null : Je + n + hn(t).laneOffset;
}
const C = 2048, bi = C + 3, gt = 20, gn = "MSEG 1", Ri = 0, P = 2, xi = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Xe(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function G(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Ai(t) {
  return Xe(Number.isFinite(t) ? t : 0, -gt, gt);
}
function V(t) {
  return Xe(Number.isFinite(t) ? t : 0, 0, 1);
}
function In(t = gn) {
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
function ze() {
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
function Ti(t) {
  const e = Number(t);
  return Xe(
    Number.isFinite(e) ? e : 1,
    Ri,
    P
  );
}
function Mi(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = V(Number(e.startX)), i = V(Number(e.endX));
  return G(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Ei(t = ze()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = xi.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Ti(Number.isFinite(i) ? i : 1)
    },
    loop: Mi(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function wi(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = V(r)), {
    x: r,
    y: V(Number(i.y)),
    curvePower: Ai(Number(i.curvePower))
  };
}
function ae(t = In()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => wi(r, o, n.length));
  if (!G(i[0].x, 0) || !G(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : gn,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function It(t) {
  return JSON.stringify(ae(t));
}
function Di(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function ki(t, e) {
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
function Oi(t, e) {
  const n = V(Number(e)), i = ki(t, n);
  if (i.laterPointWins || G(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = V(Di(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function _i(t, e) {
  return Oi(ae(t).points, e);
}
function Ci(t) {
  const e = ae(t), n = new Float32Array(C);
  for (let r = 0; r < C; r += 1) {
    const o = r / (C - 1);
    n[r] = _i(e, o);
  }
  const i = new Float32Array(bi);
  return i[0] = n[0], i.set(n, 1), i[C + 1] = n[C - 1], i[C + 2] = n[C - 1], i;
}
function St(t, e) {
  return It(t) === It(e);
}
const Me = "modulationProgram", Li = "modulationAmount", Sn = $.filter((t) => t.group === "voice").length, yn = $.filter((t) => t.group === "macro").length, Se = un, Ni = Je, ye = Ni + Si, F = Sn * Se, z = yn * Se, K = Sn * ye, ne = yn * ye, vn = F + z;
function Pi(t) {
  const e = mn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Fi(t) {
  const e = fi(t);
  return e === null ? null : pi(e);
}
function bn(t, e = Ye) {
  const n = Fi(t.targetKind), i = hi(t.targetKind);
  let r = i === null ? void 0 : gi(i);
  if (r === void 0) {
    const l = pn(
      xe(t.targetKind),
      e
    );
    l !== null && (r = l);
  }
  if (n === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const l = mn(t.sourceKind, t.sourceSlot);
    if (l.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = l.runtimeIndex;
    if (n !== null) {
      const m = s * Se + n;
      return {
        path: "macroVoice",
        cellIndex: m,
        sourceIndex: s,
        targetIndex: n,
        articulationCellIndex: F + m
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * ye + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const o = Pi(t);
  if (n !== null) {
    const l = o * Se + n;
    return {
      path: "voice",
      cellIndex: l,
      sourceIndex: o,
      targetIndex: n,
      articulationCellIndex: l
    };
  }
  const a = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: o * ye + a,
    sourceIndex: o,
    targetIndex: a,
    articulationCellIndex: null
  };
}
function Rn(t) {
  return bn(t).articulationCellIndex;
}
const Ye = /* @__PURE__ */ new Map();
function Ui(t, e) {
  const n = xe(t.targetKind);
  return n !== null && pn(n, e) === null;
}
function Bi(t, e) {
  return {
    ...bn(t, e),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function xn(t, e = Ye) {
  const n = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const i of t) {
    if (Ui(i, e))
      continue;
    const r = Bi(i, e), o = n[r.path];
    if (o.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    o.set(r.cellIndex, r);
  }
  return n;
}
function Vi(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function j(t) {
  return [...t.values()].filter(Vi).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ue(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function Ee(t, e = Ye) {
  const n = xn(t, e), i = j(n.voice), r = j(n.macroVoice), o = j(n.voiceRack), a = j(n.macroRack), l = Array.from({ length: F }, () => 0), s = Array.from({ length: F }, () => 0), c = Array.from({ length: F }, () => 0), m = Array.from({ length: F }, () => 0), d = Array.from({ length: F }, () => 0);
  ue(i, l, s, c, m);
  const p = Array.from({ length: z }, () => 0), f = Array.from({ length: z }, () => 0), I = Array.from({ length: z }, () => 0), y = Array.from({ length: z }, () => 0), k = Array.from({ length: z }, () => 0);
  ue(
    r,
    p,
    f,
    I,
    y
  );
  const Q = Array.from({ length: K }, () => 0), X = Array.from({ length: K }, () => 0), Y = Array.from({ length: K }, () => 0), Z = Array.from({ length: K }, () => 0), ee = Array.from({ length: K }, () => 0), ce = Array.from({ length: K }, () => 0);
  ue(
    o,
    Q,
    X,
    Y,
    Z
  );
  const at = Array.from({ length: ne }, () => 0), st = Array.from({ length: ne }, () => 0), lt = Array.from({ length: ne }, () => 0), ct = Array.from({ length: ne }, () => 0), ut = Array.from({ length: ne }, () => 0);
  ue(
    a,
    at,
    st,
    lt,
    ct
  );
  for (const A of n.voice.values()) d[A.cellIndex] = A.amount;
  for (const A of n.macroVoice.values()) k[A.cellIndex] = A.amount;
  for (const A of n.voiceRack.values()) ce[A.cellIndex] = A.amount;
  for (const A of n.macroRack.values()) ut[A.cellIndex] = A.amount;
  for (let A = 0; A < o.length; A += 1) {
    const dt = o[A];
    if (dt === void 0) throw new Error(`Missing compiled voice-rack route at index ${A}`);
    ee[A] = dt.reducer;
  }
  return {
    voiceRouteCount: i.length,
    voiceRouteCells: l,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: m,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: p,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: I,
    macroVoiceRoutePolarities: y,
    macroVoiceRouteAmounts: k,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: Q,
    voiceRackRouteSources: X,
    voiceRackRouteTargets: Y,
    voiceRackRoutePolarities: Z,
    voiceRackRouteReducers: ee,
    voiceRackRouteAmounts: ce,
    macroRackRouteCount: a.length,
    macroRackRouteCells: at,
    macroRackRouteSources: st,
    macroRackRouteTargets: lt,
    macroRackRoutePolarities: ct,
    macroRackRouteAmounts: ut
  };
}
const $i = ["voice", "macroVoice", "voiceRack", "macroRack"], Ki = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function yt(t) {
  return xn(t);
}
function zi(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function ji(t, e) {
  if (t === null)
    return [{ endpointID: Me, value: Ee(e) }];
  const n = yt(t), i = yt(e), r = [];
  for (const o of $i) {
    const a = j(n[o]), l = j(i[o]);
    if (a.length !== l.length)
      return [{ endpointID: Me, value: Ee(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], m = l[s];
      if (c === void 0 || m === void 0 || !zi(c, m))
        return [{ endpointID: Me, value: Ee(e) }];
      c.amount !== m.amount && r.push({
        endpointID: Li,
        value: {
          pathKind: Ki[o],
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
function Wi(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Gi(t) {
  throw new Error(t ?? "Invariant violated");
}
function de(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const qi = [
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
], vt = 1e-6;
function J(t, e) {
  if (!Number.isFinite(t) || t < -vt || t > 1 + vt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function ve(t, e) {
  return J(t / 100, `${e} catalog percentage`);
}
function Ze(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Hi(t) {
  return 20 * 1e3 ** t;
}
function Ji(t) {
  return J(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Qi(t) {
  return 0.1 * 200 ** t;
}
function Xi(t) {
  return J(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Yi(t) {
  return t;
}
function Zi(t) {
  return J(t, "filterMix endpoint conversion");
}
function Ie(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function eo(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: Ie("filterCutoff", Hi, Ji),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ie("filterQ", Qi, Xi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ie("filterMix", Yi, Zi),
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
function An(t) {
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
      return Wi(t);
  }
}
function to(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function no(t, e) {
  const n = Ze(t.moduleId, e.id), i = An(e.format), r = eo(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: ve(e.defaultPercent, n),
    initialValue: ve(e.initialPercent, n),
    format: i,
    modAmount: to(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const io = [
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
function oo(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ro(t, e) {
  const n = `osc${t}`, i = Ze(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: ve(e.defaultPercent, i),
    initialValue: ve(e.initialPercent, i),
    format: An(e.format),
    modAmount: oo(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const ao = Object.freeze(
  g.flatMap((t) => io.map((e) => ro(t, e)))
), so = Object.freeze([
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
function lo(t) {
  const e = Ze(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => J(
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
const co = Object.freeze(
  so.map(lo)
);
function uo(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function we(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return J(n, `${t.endpointID} endpoint conversion`);
}
function mo(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function fo(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function ho(t) {
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
function po(t) {
  const e = uo(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: we(t, t.initial),
    initialValue: we(t, t.initial),
    format: fo(t),
    modAmount: ho(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => mo(t, n),
      fromEngine: (n) => we(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const et = Object.freeze(
  [
    ...rn.flatMap((t) => t.parameters.map(po)),
    ...ao,
    ...co,
    ...qi.flatMap(
      (t) => t.parameters.map(
        (e) => no(t, e)
      )
    )
  ]
), go = new Map(
  et.map((t) => [t.targetId, t])
), Tn = et.filter(
  (t) => t.modulationTargetKind !== null
), je = new Map(
  Tn.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (go.size !== et.length)
  throw new Error("Target descriptor IDs must be unique");
if (Tn.length !== L.length || je.size !== L.length || L.some((t) => je.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function bt(t) {
  const e = je.get(t);
  return e === void 0 ? Gi(`Modulation target "${t}" has no display descriptor`) : e;
}
function Io(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = bt(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = bt(t);
  return n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const ie = "modulation.v6", Mn = 6, se = 3, U = 3, Rt = "modulationMsegBuffer", So = "modulationMsegPlayback", En = 4, yo = ["MSEG 1", "MSEG 2", "MSEG 3"], wn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], vo = ["Env 1", "Env 2", "Env 3"], bo = 1e-3, b = 10, Ro = 0.1, xo = 20, Ao = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: xo - Ro },
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
  mseg1Rate: { min: -P, max: P },
  mseg2Rate: { min: -P, max: P },
  mseg3Rate: { min: -P, max: P },
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
}, To = sn().filter((t) => t.modulationTargetIndex !== null), Mo = new Map(
  To.map((t) => [`rack.${t.endpointID}`, t])
);
class De extends Error {
  name = "ModulationStateParseError";
}
const Eo = {
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
  label: Eo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
L.map((t) => ({
  value: t.kind,
  label: Io(t.kind)
}));
function wo(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function tt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ke(t, e) {
  const n = Number(t);
  return tt(Number.isFinite(n) ? n : e, bo, b);
}
function Do(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function ko(t) {
  const e = xe(t);
  return e !== null ? vi(e) : t;
}
function Oo(t) {
  const e = ko(t), n = Mo.get(e);
  return n !== void 0 ? Do(n) : Ao[Ii(e)];
}
function _o(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Co(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Lo(t, e) {
  const n = Oo(t), i = Number(e);
  return tt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function No(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Po(t) {
  return No(t) ?? "mseg";
}
function Fo(t) {
  const e = Qe(t);
  return e !== null ? e : xe(t) !== null ? t : null;
}
function Uo(t) {
  return Fo(t) ?? "oscA.wavetablePosition";
}
function Bo(t, e) {
  const n = wn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Vo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? se : t === "macro" ? En : U;
  return tt(Number.isFinite(n) ? n : 1, 1, i);
}
function W(t) {
  return {
    name: vo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Dn(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = W(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: ke(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: ke(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: V(n.sustain ?? i.sustain),
    releaseSeconds: ke(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function $o(t, e = 0) {
  return { name: Dn(t, e).name };
}
function Ko(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: _o(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Vo(n, t.sourceSlot),
    polarity: Co(t.polarity),
    targetKind: i,
    amount: Lo(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function zo(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = Po(i.sourceKind), o = Uo(i.targetKind);
  return Ko(i, e, r, o);
}
function jo(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Wo(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => zo(n, i));
}
function Go(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = jo(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function We(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => We(a, e[l]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => wo(i, a) && We(n[a], i[a]));
}
function kn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = In(yo[e] ?? `MSEG ${e + 1}`), r = ae(n.shapeA ?? i), o = Ei({
    ...ze(),
    ...n.playback ?? {},
    rate: ze().rate
  }), { rate: a, ...l } = o;
  return {
    shapeA: r,
    shapeB: ae(n.shapeB ?? r),
    playback: l
  };
}
function Ge() {
  return {
    format: "cosimo.modulation",
    version: Mn,
    msegSlots: Array.from({ length: se }, (t, e) => kn({}, e)),
    envelopeSlots: Array.from({ length: U }, (t, e) => ({
      name: W(e).name
    })),
    routes: [],
    macroNames: wn.slice()
  };
}
function qo(t = Ge()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Mn,
    msegSlots: Array.from({ length: se }, (o, a) => kn(n[a], a)),
    envelopeSlots: Array.from({ length: U }, (o, a) => $o(i[a], a)),
    routes: Wo(e.routes),
    macroNames: Array.from(
      { length: En },
      (o, a) => Bo(r[a], a)
    )
  };
}
function xt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return re(new De("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return re(new De("Expected valid modulation JSON"));
    }
  }
  const n = qo(e);
  return !We(e, n) || !Go(n.routes) ? re(new De("Expected the current modulation schema")) : H(n);
}
function Ho(t, e) {
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
function At(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Ci(n))
  };
}
function Jo(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Qo(t, e = null) {
  const n = [];
  for (let i = 0; i < se; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !St(o.shapeA, r.shapeA)) && n.push({
      endpointID: Rt,
      value: At(i, 0, r.shapeA)
    }), (o === void 0 || !St(o.shapeB, r.shapeB)) && n.push({
      endpointID: Rt,
      value: At(i, 1, r.shapeB)
    }), (o === void 0 || !Jo(o.playback, r.playback)) && n.push({
      endpointID: So,
      value: Ho(i, r.playback)
    });
  }
  return n.push(...ji(e?.routes ?? null, t.routes)), n;
}
const Oe = "articulationSnapshot", S = 128, Tt = 48, Xo = 1e6, x = -1, _e = [
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
function nt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ce(t) {
  return nt(Number.isFinite(t) ? t : 0, 0, 1);
}
function T(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return nt(Number.isFinite(r) ? r : e, n, i);
}
function R(t, e, n, i) {
  return nt(Math.round(T(t, e)), n, i);
}
function On(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Le() {
  return Array.from({ length: S }, () => x);
}
function Yo(t) {
  const e = R(t, 0, 0, S - 1), n = _e[e % _e.length], i = Math.floor(e / _e.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function Zo() {
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
function er(t) {
  const e = Zo(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
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
      Ce(Number(i[0])),
      Ce(Number(i[1])),
      Ce(Number(i[2]))
    ]
  };
}
function tr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: T(e.amount, 0, -48, 48)
  } : null;
}
function nr(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(tr).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: er(e.parameters),
    envelopes: [0, 1, 2].map((r) => Dn(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function ir(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = R(n.runtimeSlot, e, 0, S - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Yo(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: nr(n.snapshot)
  };
}
function or(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: R(n.note, 0, 0, S - 1),
    articulationId: i
  } : null;
}
function rr(t, e, n, i, r) {
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
function Mt(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < r.length; l += 1) {
    const s = rr(
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
function ar(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = or(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function sr(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let s = 0; s < n.length && o.length < S; s += 1) {
    const c = ir(n[s], s);
    !c || i.has(c.runtimeSlot) || r.has(c.id) || (i.add(c.runtimeSlot), r.add(c.id), o.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((s) => s.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(o.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: On(e.activeTriggerMode),
    slots: o,
    chainAssignments: Mt(e.chainAssignments, l, "chain", 0),
    keyAssignments: ar(e.keyAssignments, l),
    velocityAssignments: Mt(e.velocityAssignments, l, "velocity", 1)
  };
}
function Et(t) {
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
    routeAmounts: Array.from({ length: vn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: U }, (n, i) => W(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: U }, (n, i) => W(i).decaySeconds),
    envelopeSustain: Array.from({ length: U }, (n, i) => W(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: U }, (n, i) => W(i).releaseSeconds)
  };
}
function wt(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === x && (t[o] = r);
  }
}
function lr(t) {
  const e = sr(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = Le(), r = Le(), o = Le();
  wt(i, e.chainAssignments, n), wt(o, e.velocityAssignments, n);
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
function cr(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : lr(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: On(e.activeMode),
    chain: Array.from({ length: S }, (n, i) => R(e.chain?.[i], x, x, S - 1)),
    key: Array.from({ length: S }, (n, i) => R(e.key?.[i], x, x, S - 1)),
    velocity: Array.from({ length: S }, (n, i) => i === 0 ? x : R(e.velocity?.[i], x, x, S - 1))
  });
}
function ur(t, e) {
  const n = cr(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const oe = "articulations.v4", it = [
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
], ot = [
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
], dr = [
  ...g.flatMap((t) => it.map(
    (e) => `osc${t}.${e}`
  )),
  ...ot
];
class _n extends Error {
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
  return re(new _n("malformed", t));
}
function le(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function rt(t, e, n) {
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
function mr(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function fr(t) {
  return dr.some((e) => e === t);
}
function Dt(t, e) {
  if (!le(t))
    return h(`${e} must be an object`);
  const n = rt(t, ["min", "max"], e);
  return n !== null ? h(n) : be(t.min) ? be(t.max) ? t.min > t.max ? h(`${e}.min must be less than or equal to ${e}.max`) : H({ min: t.min, max: t.max }) : h(`${e}.max must be an integer in 0..127`) : h(`${e}.min must be an integer in 0..127`);
}
function hr(t, e) {
  if (!le(t))
    return h(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return h(`${e} has a non-string parameter id`);
    if (!fr(i))
      return h(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return h(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return H(n);
}
function pr(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function gr() {
  return {};
}
function Ir(t, e, n) {
  if (!le(t))
    return h(`${e} must be an object`);
  const i = gr();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return h(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Tt)
      return h(
        `${e}.${r} must be a finite route amount within ±${Tt}`
      );
    if (!n.has(r))
      return h(`${e}.${r} does not name a current articulable mapping`);
    pr(i, r, o);
  }
  return H(i);
}
function Sr(t, e, n) {
  const i = `slots[${e}]`;
  if (!le(t))
    return h(`${i} must be an object`);
  const r = rt(
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
  const o = Dt(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Dt(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = hr(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = Ir(
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
const yr = Object.fromEntries(
  it.map((t, e) => [t, 2 ** e])
), vr = Object.fromEntries(
  ot.map((t, e) => [t, 2 ** e])
);
function kt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function br(t, e) {
  return it.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | yr[i] : n, 0);
}
function Rr(t) {
  return ot.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | vr[n] : e, 0);
}
function xr(t, e) {
  const n = (o, a) => kt(t, `osc${o}.${a}`), i = (o) => kt(t, o), r = Array.from(
    { length: vn },
    () => Xo
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const l = e[o];
    l !== void 0 && (r[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: g.map((o) => br(t, o)),
    sharedOverrideMask: Rr(t),
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
function Ar(t, e) {
  return t.slots.map((n) => xr(n, e));
}
function Tr(t, e) {
  if (!le(t))
    return h("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return h('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return re(new _n(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = rt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return h(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return h("selectedSlotId must be null or a string");
  if (!mr(t.activeTriggerMode))
    return h('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return h("slots must be an array");
  if (t.slots.length > S)
    return h(`slots must contain at most ${S} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = Sr(t.slots[a], a, e);
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
function Cn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Mr(t) {
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
const qe = "runtimeState";
function Ln(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Er = {
  endpointID: qe,
  required: !0,
  mapValue: Ln
}, Ot = "runtimeInstallAck", wr = "runtimeSyncRequest", _t = 0, Dr = 8e3, Re = /* @__PURE__ */ new WeakMap(), Nn = 1e9;
let me = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Nn;
function kr(t) {
  return me = me % Nn + 1, t === "modulation" ? -1e9 - me : 1e9 + me;
}
function Or(t, e) {
  const n = t, i = Re.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Re.set(n, i);
}
function Ct(t, e) {
  const n = t, i = Re.get(n);
  i?.delete(e), i?.size === 0 && Re.delete(n);
}
const _r = [100, 250, 500, 1e3], fe = { _tag: "accepted" }, Cr = { _tag: "superseded" }, Lr = { _tag: "stopped" }, Lt = { _tag: "transport-timeout" };
function Nr(t) {
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
function Pr(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Nt {
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
    this.#d = i && i.length > 0 ? i : [..._r], this.#v = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Dr)
    );
  }
  start() {
    if (!this.#i) {
      Or(this.#r, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#r.addEndpointListener?.(Ot, this.#b);
      } catch (e) {
        throw this.#i = !1, Ct(this.#r, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#r.removeEndpointListener?.(Ot, this.#b), Ct(this.#r, this.#e), this.#o.clear(), this.#s = null, this.#l.clear(), this.#y());
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
    const i = kr(this.#e);
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
          return Lt;
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
    const r = this.#M(), o = Pr(e.value, n, r);
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
            return Lt;
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
    return !this.#i || this.#u !== n ? Lr : this.#t !== e ? Cr : null;
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
        _t
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          wr,
          e,
          void 0,
          _t
        );
      } catch {
      }
  }
  #w(e) {
    const n = Nr(e);
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
const Fr = 1e3, Ne = [ie, oe];
function Pt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Pe(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (Pt(i, e)) return i[e];
  if (Pt(n, e)) return n[e];
}
function Fe(t, e) {
  if (t === void 0) return Cn();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Tr(n, e);
  return i._tag === "ok" ? i.value : null;
}
function Ft(t) {
  return new Set(t.routes.flatMap((e) => Rn(e) === null ? [] : [e.id]));
}
function Ut(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Ur {
  constructor(e) {
    this.connection = e, this.modulationLane = new Nt(e, { laneKind: "modulation" }), this.articulationLane = new Nt(e, { laneKind: "articulation" });
  }
  modulationState = Ge();
  articulationBank = Cn();
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
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(qe, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(qe, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Ne) this.connection.requestStoredStateValue(n);
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
    const n = Pe(e, ie), i = n === void 0 ? { _tag: "ok", value: Ge() } : xt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      const a = Pe(e, oe), l = Fe(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = Pe(e, oe), o = Fe(
      r,
      Ft(i.value)
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
    if (!(typeof n.key != "string" || !Ne.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Ne.length) {
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
      const r = xt(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Fe(n, Ft(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${oe}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Ln(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, r = this.lastAppliedModulationGeneration !== e, o = Qo(
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
      return y ? Ut(y) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, m = c && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let f = 0; f < S; f += 1) {
      const I = l.get(f), y = s[f] !== this.lastAppliedArticulationTokens[f];
      m ? d.push({
        endpointID: Oe,
        value: I ?? Et(f)
      }) : c ? I && d.push({ endpointID: Oe, value: I }) : y && d.push({
        endpointID: Oe,
        value: I ?? Et(f)
      });
    }
    const p = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", p, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, ur(
      Mr(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = Rn(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      Ar(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = Ut(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Fr));
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
function Br(t) {
  return new Ur(t);
}
const E = "rack.v1", Vr = "rackOrder", $r = "rackEnable", B = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Pn = Object.freeze({
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
  B.map((t) => [Pn[t], t])
);
function Fn() {
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
function Bt() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...B],
    enabled: Fn()
  };
}
function Kr(t) {
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
function Vt(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function zr(t) {
  return typeof t != "string" ? null : B.find((e) => e === t) ?? null;
}
function jr(t) {
  const e = Kr(t);
  if (e._tag === "err")
    return e;
  if (!Vt(e.value))
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
    const l = zr(a);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${E}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!Vt(e.value.enabled))
    return { _tag: "err", message: `${E}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== B.length)
    return { _tag: "err", message: `${E}.enabled must contain every effect once` };
  const o = Fn();
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
function Wr(t) {
  if (t === void 0)
    return Bt();
  const e = jr(t);
  return e._tag === "ok" ? e.value : Bt();
}
function Gr(t) {
  return [
    {
      endpointID: Vr,
      value: { moduleIds: t.order.map((e) => Pn[e]) }
    },
    {
      endpointID: $r,
      value: { enabledFlags: B.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const qr = 2e3;
function $t(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Hr(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return $t(i, e) ? {
    found: !0,
    value: i[e]
  } : $t(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Kt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Jr {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Qr(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Hr(e, this.options.stateKey);
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
    }, r = Kt(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), l = Kt({
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
        this.options.sendTimeoutMilliseconds ?? qr
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Qr(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Xr(t, e) {
  return new Jr(t, e);
}
function Yr(t) {
  return Xr(t, {
    stateKey: E,
    runtimeEndpointDependencies: [Er],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Wr,
    buildRuntimeEvents: ({ state: e }) => [...Gr(e)]
  });
}
const Zr = "runtimeSyncRequest", ea = 2147483647, ta = "runtimeState", na = "retryDesiredTableRequest", ia = "workerLoadFailure", oa = "serviceLoadAbort", ra = "wavetableLoadBegin", aa = "wavetableMipFrame", sa = "wavetableUploadAck", la = "wavetableMipRequest", ca = "wavetablePrewarmRequest", ua = "wavetablePrewarmNotification", da = "assets/factory-bank-catalog.json", He = 3, ma = 1, fa = He * pe, ha = 1, pa = 2, ga = 3, Ia = 1, Sa = 2, ya = 2e4, he = ha, va = pa, zt = ga, N = Ia, jt = Sa, ba = 48 * 1024 * 1024, Ue = 3;
function Wt(t, e) {
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
function Gt(t) {
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
function qt(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Ht(t, e) {
  if (!t)
    throw new Error(e);
}
function Ra(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function xa(t, e) {
  return qn(await t.readJSON(e));
}
function Aa(t) {
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
function Ta(t, e) {
  const n = Math.round(Number(t) || 0);
  return Ra(n, 0, Math.max(0, e - 1));
}
function Be(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Ma(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Jt(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Qt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Xt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Ea(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class wa {
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
    this.connection = e, this.resourceClient = Gn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? da, this.maxBatchesInFlight = Wt(
      n.maxFramesInFlight,
      ma
    ), this.mipLevelCount = n.mipLevelCount ?? tn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ba) || 0)), this.serviceLoadTimeoutMs = Wt(n.serviceLoadTimeoutMs, ya), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, v("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ta, this.handleRuntimeState), this.connection.addEndpointListener?.(sa, this.handleUploadAck), this.connection.addEndpointListener?.(la, this.handleMipRequest), this.connection.addEndpointListener?.(ca, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ua, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Zr,
      ea
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await xa(this.resourceClient, this.catalogPath), v("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Ue; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Jt(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Jt(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Be(
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
          ...Qt(this.serviceTable.frameCount),
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
          failurePhase: zt,
          failureReasonCode: jt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== zt || e.failureReasonCode !== jt ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = he,
    failureReasonCode: l = N
  }) {
    this.connection.sendEventOrValue?.(ia, {
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
    failureReasonCode: o = N
  }) {
    this.connection.sendEventOrValue?.(oa, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    v("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Gt(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(na, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Ta(e, i.tables.length), o = i.tables[r];
    Ht(o, `Could not resolve table ${r}`);
    const a = Ma(o, pe, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, v("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = Xt();
    v("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), m = Yn(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: pe
    });
    return v("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: m.frameCount,
      loadDurationMs: Math.round(Xt() - s)
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(ra, {
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
      failureReasonCode: N
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: he,
      failureReasonCode: N
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = he,
    failureReasonCode: i = N
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
        detail: Ve(o)
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
        detail: Ve(a)
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
    for (let e = 0; e < Ue; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Ea(() => {
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
          failureReasonCode: N
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
    const n = Aa(e ?? {});
    if (v("info", "Received runtime state", Gt(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Ue)
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
          r.spectra[a] || (r.spectra[a] = pt(r.frames[a]));
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
          detail: Ve(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Be(
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
      ...Qt(this.serviceTable.frameCount),
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), m = Be(
      i,
      r,
      o,
      a,
      l
    ), d = this.mipJobs.get(m), p = this.serviceTable?.frameCount ?? 0, f = Math.min(
      He,
      p - s
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(s) || c <= 0 || c !== f)) {
      d.inFlightBatchBases.delete(s);
      for (let I = 0; I < c; I += 1) {
        const y = s + I;
        d.ackedFrames[y] || (d.ackedFrames[y] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === p && d.nextFrameIndex >= p && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), qt(s, c, p) && v("info", "Acknowledged wavetable mip batch", {
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
    if (Ht(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = pt(this.serviceTable.frames[e]);
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
        He,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(fa);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, l = this.getSpectrumForFrame(a), s = Zn(l, e.mipIndex);
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
            failurePhase: va,
            failureReasonCode: N
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(aa, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), qt(n, i, this.serviceTable.frameCount) && v("info", "Sent wavetable mip batch", {
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
function Ve(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Da(t, e = {}) {
  return new wa(t, e);
}
async function ka(t, e = {}) {
  return ni(t, [
    Br,
    Yr,
    () => Da(t, e)
  ]);
}
export {
  ma as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  pa as FAILURE_PHASE_BUILD_MIP,
  ha as FAILURE_PHASE_LOAD_SOURCE,
  ga as FAILURE_PHASE_TRANSFER_MIP,
  Ia as FAILURE_REASON_GENERIC,
  Sa as FAILURE_REASON_TIMEOUT,
  He as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  ea as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  wa as WavetableWorkerController,
  Da as createWavetableWorkerController,
  ka as default
};
