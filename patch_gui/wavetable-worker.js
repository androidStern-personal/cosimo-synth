function T(t, e) {
  if (!t)
    throw new Error(e);
}
function ge(t, e, n) {
  let i = "";
  for (let o = 0; o < n; o += 1)
    i += String.fromCharCode(t.getUint8(e + o));
  return i;
}
function vn(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function De(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Nt(t) {
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
function Rn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ie(t, e) {
  const n = Rn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (vn(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function He(t) {
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
  throw new Error(`Unsupported text resource payload (${Nt(t)})`);
}
function Tn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return De(t);
  throw new Error(`Unsupported binary resource payload (${Nt(t)})`);
}
function xn(t) {
  const e = t?.frames;
  T(
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
      T(a.length === 1, "Only mono wavetable source files are supported"), i[o] = Number(a[0]) || 0;
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
  T(ge(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), T(ge(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, o = null, r = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const m = ge(e, c, 4), g = e.getUint32(c + 4, !0), h = c + 8;
    m === "fmt " ? (n = e.getUint16(h, !0), i = e.getUint16(h + 2, !0), o = e.getUint32(h + 4, !0), a = e.getUint16(h + 12, !0), r = e.getUint16(h + 14, !0)) : m === "data" && (l = h, s = g), c = h + g + g % 2;
  }
  T(n !== null, "Wave file is missing a fmt chunk"), T(l !== null && s !== null, "Wave file is missing a data chunk"), T(i === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && r === 32)
    u = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const m = s / 2, g = new Int16Array(t.slice(l, l + s));
    u = new Float32Array(m);
    for (let h = 0; h < m; h += 1)
      u[h] = g[h] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: o ?? 0,
    bitsPerSample: r,
    blockAlign: a ?? 0,
    samples: u
  };
}
async function Je(t) {
  T(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return T(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function _e(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Ft(t) {
  const e = new Uint8Array(t).buffer, n = Pt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function An(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (T(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), o = async (s) => {
    T(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return xn(c);
  }, r = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const u = Ie(s, c), m = await Je(u), g = Pt(m);
    return {
      sampleRate: g.sampleRate,
      samples: g.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const u = Ie(s, c);
    return new Uint8Array(await Je(u));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return He(await i(s));
      const c = r(s);
      return e === "url" && c !== null ? _e(await l(s, c)) : typeof t.readResource == "function" ? He(await i(s)) : _e(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Tn(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(s);
      const c = r(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? o(s) : Ft(await this.readBytes(s));
    },
    getURL(s) {
      return Ie(s, t.getResourceAddress?.(s));
    }
  };
}
function Mn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return An(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function En(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, o = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return _e(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return De(await e(a));
      if (n)
        return De(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : Ft(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function wn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function On(t) {
  return wn(t) ? En(t) : Mn(t);
}
const Qe = 2048;
function J(t, e) {
  if (!t)
    throw new Error(e);
}
function kn(t) {
  J(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    J(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), J(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), J(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), J(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Dn = 2048, Ut = 11, _n = 256;
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function Cn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Xe = /* @__PURE__ */ new Map();
function Ln(t) {
  const e = Xe.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let r = 0, a = o;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | a & 1, a >>= 1;
    i[o] = r;
  }
  return Xe.set(t, i), i;
}
function $t(t, e, n = !1) {
  const i = t.length;
  x(i === e.length, "FFT real and imaginary buffers must have the same length"), x(Cn(i), "FFT input length must be a power of two");
  const o = Ln(i);
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
    const a = r >> 1, l = (n ? 2 : -2) * Math.PI / r, s = Math.cos(l), c = Math.sin(l);
    for (let u = 0; u < i; u += r) {
      let m = 1, g = 0;
      for (let h = 0; h < a; h += 1) {
        const S = u + h, y = S + a, A = t[y], j = e[y], W = m * A - g * j, q = m * j + g * A, G = t[S], H = e[S];
        t[S] = G + W, e[S] = H + q, t[y] = G - W, e[y] = H - q;
        const ie = m * s - g * c;
        g = m * c + g * s, m = ie;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function Bt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    o[r] = (Number(e[r]) || 0) - i;
  return o;
}
function Nn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Dn,
  maxFramesPerTable: i = _n
} = {}) {
  const o = Float32Array.from(t);
  x(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = o.length / n;
  x(r > 0, "Source wavetable files must contain at least one frame"), x(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && x(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, c = s + n;
    a.push(Bt(o.slice(s, c)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function Ye(t) {
  const e = Bt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return $t(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Pn(t, e, {
  mipLevelCount: n = Ut
} = {}) {
  const i = t?.real?.length ?? 0;
  x(i > 0, "Spectrum must contain real samples"), x(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), x(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, i >> 1), r = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= o; l += 1) {
    r[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return $t(r, a, !0), Float32Array.from(r);
}
class Fn {
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
function Un(t, e) {
  return new Fn(t, e);
}
async function $n(t, e) {
  const n = Un(t, e);
  return await n.start(), n;
}
const v = (t, e) => ({ label: t, value: e });
function M(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const E = Object.freeze({
  filter: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: M(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), d = (t, e, n, i, o, r, a, l = {}) => ({
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
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), Bn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Vn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Kn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: E.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(v), quick: !0 }),
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
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Classic", 0), v("Harmonics", 1)] }),
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
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(v) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(v) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(v) }),
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
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Bn.map(v) }),
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
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Vn.map(v) }),
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
], Vt = Kn, Kt = Object.freeze(
  Vt.flatMap((t) => t.parameters)
);
new Map(
  Kt.map((t) => [t.endpointID, t])
);
function zt() {
  return Kt;
}
const w = 2048, zn = w + 3, Ze = 20, jt = "MSEG 1", jn = 0, Wn = 2, qn = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Pe(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function V(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Gn(t) {
  return Pe(Number.isFinite(t) ? t : 0, -Ze, Ze);
}
function L(t) {
  return Pe(Number.isFinite(t) ? t : 0, 0, 1);
}
function Wt(t = jt) {
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
function qt() {
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
function Gt(t) {
  const e = Number(t);
  return Pe(
    Number.isFinite(e) ? e : 1,
    jn,
    Wn
  );
}
function Hn(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = L(Number(e.startX)), i = L(Number(e.endX));
  return V(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Ht(t = qt()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), o = e.noteOffPolicy, r = qn.has(o) ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Gt(Number.isFinite(i) ? i : 1)
    },
    loop: Hn(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Jn(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let o = Number(i.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = L(o)), {
    x: o,
    y: L(Number(i.y)),
    curvePower: Gn(Number(i.curvePower))
  };
}
function ee(t = Wt()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((o, r) => Jn(o, r, n.length));
  if (!V(i[0].x, 0) || !V(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < i.length; o += 1)
    if (i[o].x < i[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : jt,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function et(t) {
  return JSON.stringify(ee(t));
}
function tt(t) {
  return JSON.stringify(Ht(t));
}
function Qn(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function Xn(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: i, to: o, laterPointWins: !1 };
    if (V(e, o.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && V(t[r + 1].x, e); )
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
function Yn(t, e) {
  const n = L(Number(e)), i = Xn(t, n);
  if (i.laterPointWins || V(i.from.x, i.to.x))
    return i.to.y;
  const o = i.to.x - i.from.x, r = o <= 0 ? 1 : (n - i.from.x) / o, a = L(Qn(r, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Zn(t, e) {
  return Yn(ee(t).points, e);
}
function ei(t) {
  const e = ee(t), n = new Float32Array(w);
  for (let o = 0; o < w; o += 1) {
    const r = o / (w - 1);
    n[o] = Zn(e, r);
  }
  const i = new Float32Array(zn);
  return i[0] = n[0], i.set(n, 1), i[w + 1] = n[w - 1], i[w + 2] = n[w - 1], i;
}
function nt(t, e) {
  return et(t) === et(e);
}
function ti(t, e) {
  return tt(t) === tt(e);
}
const p = ["A", "B", "C"], ni = [
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
], ii = [
  "filterCutoffOctaves",
  "filterQ"
], N = Object.freeze([
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
]), ri = Object.freeze([
  ...p.flatMap((t) => ni.map(
    (e) => `osc${t}.${e}`
  )),
  ...ii
]), Jt = Object.freeze(
  ri.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), oi = zt().filter((t) => t.modulationTargetIndex !== null), Qt = Object.freeze(
  oi.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), k = Object.freeze([
  ...Jt,
  ...Qt
]), le = N.length, Xt = Jt.length, Yt = Qt.length, ai = le * k.length, si = new Map(N.map((t) => [t.id, t])), Zt = new Map(N.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), K = new Map(k.map((t) => [t.kind, t]));
function li() {
  if (le !== 13 || Xt !== 32 || Yt !== 36 || ai !== 884)
    throw new Error("Modulation identity catalog has an unexpected domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = N.filter((o) => o.group === t), i = n.map((o) => o.runtimeIndex).sort((o, r) => o - r);
    if (n.length !== e || i.some((o, r) => o !== r))
      throw new Error(`Modulation ${t} source indexes must be unique and contiguous`);
  }
  for (const [t, e] of [["voice", 32], ["rack", 36]]) {
    const n = k.filter((o) => o.group === t), i = n.map((o) => o.runtimeIndex).sort((o, r) => o - r);
    if (n.length !== e || i.some((o, r) => o !== r))
      throw new Error(`Modulation ${t} target indexes must be unique and contiguous`);
  }
  if (si.size !== le || Zt.size !== le || K.size !== k.length)
    throw new Error("Modulation identities must be unique");
}
li();
function en(t, e) {
  const n = Zt.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Fe(t) {
  return typeof t != "string" ? null : K.has(t) ? t : null;
}
function ci(t) {
  const e = Fe(t);
  return e !== null && K.get(e)?.group === "voice" ? e : null;
}
function ui(t) {
  const e = Fe(t);
  return e !== null && K.get(e)?.group === "rack" ? e : null;
}
function di(t) {
  const e = K.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function hi(t) {
  const e = K.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function fi(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Se = "modulationProgram", mi = "modulationAmount", tn = N.filter((t) => t.group === "voice").length, nn = N.filter((t) => t.group === "macro").length, ce = Xt, ue = Yt, _ = tn * ce, F = nn * ce, P = tn * ue, Q = nn * ue, rn = _ + F;
function pi(t) {
  const e = en(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function gi(t) {
  const e = ci(t);
  return e === null ? null : di(e);
}
function on(t) {
  const e = gi(t.targetKind), n = ui(t.targetKind), i = n === null ? void 0 : hi(n);
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = en(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = a.runtimeIndex;
    if (e !== null) {
      const c = l * ce + e;
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
      cellIndex: l * ue + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const o = pi(t);
  if (e !== null) {
    const a = o * ce + e;
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
    cellIndex: o * ue + r,
    sourceIndex: o,
    targetIndex: r,
    articulationCellIndex: null
  };
}
function an(t) {
  return on(t).articulationCellIndex;
}
function Ii(t) {
  return {
    ...on(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function sn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    const i = Ii(n), o = e[i.path];
    if (o.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    o.set(i.cellIndex, i);
  }
  return e;
}
function Si(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function U(t) {
  return [...t.values()].filter(Si).sort((e, n) => e.cellIndex - n.cellIndex);
}
function re(t, e, n, i, o) {
  for (let r = 0; r < t.length; r += 1) {
    const a = t[r];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${r}`);
    e[r] = a.cellIndex, n[r] = a.sourceIndex, i[r] = a.targetIndex, o[r] = a.polarity;
  }
}
function be(t) {
  const e = sn(t), n = U(e.voice), i = U(e.macroVoice), o = U(e.voiceRack), r = U(e.macroRack), a = Array.from({ length: _ }, () => 0), l = Array.from({ length: _ }, () => 0), s = Array.from({ length: _ }, () => 0), c = Array.from({ length: _ }, () => 0), u = Array.from({ length: _ }, () => 0);
  re(n, a, l, s, c);
  const m = Array.from({ length: F }, () => 0), g = Array.from({ length: F }, () => 0), h = Array.from({ length: F }, () => 0), S = Array.from({ length: F }, () => 0), y = Array.from({ length: F }, () => 0);
  re(
    i,
    m,
    g,
    h,
    S
  );
  const A = Array.from({ length: P }, () => 0), j = Array.from({ length: P }, () => 0), W = Array.from({ length: P }, () => 0), q = Array.from({ length: P }, () => 0), G = Array.from({ length: P }, () => 0), H = Array.from({ length: P }, () => 0);
  re(
    o,
    A,
    j,
    W,
    q
  );
  const ie = Array.from({ length: Q }, () => 0), ze = Array.from({ length: Q }, () => 0), je = Array.from({ length: Q }, () => 0), We = Array.from({ length: Q }, () => 0), qe = Array.from({ length: Q }, () => 0);
  re(
    r,
    ie,
    ze,
    je,
    We
  );
  for (const b of e.voice.values()) u[b.cellIndex] = b.amount;
  for (const b of e.macroVoice.values()) y[b.cellIndex] = b.amount;
  for (const b of e.voiceRack.values()) H[b.cellIndex] = b.amount;
  for (const b of e.macroRack.values()) qe[b.cellIndex] = b.amount;
  for (let b = 0; b < o.length; b += 1) {
    const Ge = o[b];
    if (Ge === void 0) throw new Error(`Missing compiled voice-rack route at index ${b}`);
    G[b] = Ge.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: g,
    macroVoiceRouteTargets: h,
    macroVoiceRoutePolarities: S,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: A,
    voiceRackRouteSources: j,
    voiceRackRouteTargets: W,
    voiceRackRoutePolarities: q,
    voiceRackRouteReducers: G,
    voiceRackRouteAmounts: H,
    macroRackRouteCount: r.length,
    macroRackRouteCells: ie,
    macroRackRouteSources: ze,
    macroRackRouteTargets: je,
    macroRackRoutePolarities: We,
    macroRackRouteAmounts: qe
  };
}
const bi = ["voice", "macroVoice", "voiceRack", "macroRack"], yi = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function it(t) {
  return sn(t);
}
function vi(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ri(t, e) {
  if (t === null)
    return [{ endpointID: Se, value: be(e) }];
  const n = it(t), i = it(e), o = [];
  for (const r of bi) {
    const a = U(n[r]), l = U(i[r]);
    if (a.length !== l.length)
      return [{ endpointID: Se, value: be(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], u = l[s];
      if (c === void 0 || u === void 0 || !vi(c, u))
        return [{ endpointID: Se, value: be(e) }];
      c.amount !== u.amount && o.push({
        endpointID: mi,
        value: {
          pathKind: yi[r],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return o;
}
function z(t) {
  return { _tag: "ok", value: t };
}
function Z(t) {
  return { _tag: "err", error: t };
}
function Ti(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function rt(t) {
  throw new Error(t ?? "Invariant violated");
}
function ye(t, e, n, i, o = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: o, compound: r };
}
const xi = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      ye("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      ye("resonance", "Resonance", 36.91760377573153, 0),
      ye("drive", "Drive", 15, 0)
    ]
  }
], ot = 1e-6;
function pe(t, e) {
  if (!Number.isFinite(t) || t < -ot || t > 1 + ot)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function de(t, e) {
  return pe(t / 100, `${e} catalog percentage`);
}
function ln(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Ai(t) {
  return 20 * 1e3 ** t;
}
function Mi(t) {
  return pe(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Ei(t) {
  return 0.1 * 200 ** t;
}
function wi(t) {
  return pe(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function at(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Oi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: at("filterCutoff", Ai, Mi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: at("filterQ", Ei, wi),
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
function cn(t) {
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
      return Ti(t);
  }
}
function ki(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Di(t, e) {
  const n = ln(t.moduleId, e.id), i = cn(e.format), o = Oi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: de(e.defaultPercent, n),
    initialValue: de(e.initialPercent, n),
    format: i,
    modAmount: ki(i),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const _i = [
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
function Ci(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Li(t, e) {
  const n = `osc${t}`, i = ln(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: de(e.defaultPercent, i),
    initialValue: de(e.initialPercent, i),
    format: cn(e.format),
    modAmount: Ci(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Ni = Object.freeze(
  p.flatMap((t) => _i.map((e) => Li(t, e)))
);
function Pi(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function ve(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return pe(n, `${t.endpointID} endpoint conversion`);
}
function Fi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ui(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function $i(t) {
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
function Bi(t) {
  const e = Pi(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: ve(t, t.initial),
    initialValue: ve(t, t.initial),
    format: Ui(t),
    modAmount: $i(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Fi(t, n),
      fromEngine: (n) => ve(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const Ue = Object.freeze(
  [
    ...Vt.flatMap((t) => t.parameters.map(Bi)),
    ...Ni,
    ...xi.flatMap(
      (t) => t.parameters.map(
        (e) => Di(t, e)
      )
    )
  ]
), Vi = new Map(
  Ue.map((t) => [t.targetId, t])
), un = Ue.filter(
  (t) => t.modulationTargetKind !== null
), he = new Map(
  un.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Vi.size !== Ue.length)
  throw new Error("Target descriptor IDs must be unique");
if (un.length !== k.length || he.size !== k.length || k.some((t) => he.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ki(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = he.get(t);
    return i === void 0 ? rt(`Modulation target "${t}" has no display descriptor`) : `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = he.get(t);
  return n === void 0 ? rt(`Modulation target "${t}" has no display descriptor`) : n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const X = "modulation.v5", dn = 5, te = 3, O = 3, st = "modulationMsegBuffer", zi = "modulationMsegPlayback", ji = "modulationEnvelope", hn = 4, Wi = ["MSEG 1", "MSEG 2", "MSEG 3"], fn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], qi = ["Env 1", "Env 2", "Env 3"], Gi = 1e-3, Hi = 10, Ji = 0.1, Qi = 20, Xi = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Qi - Ji },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, Yi = zt().filter((t) => t.modulationTargetIndex !== null), Zi = new Map(
  Yi.map((t) => [`rack.${t.endpointID}`, t])
);
class Re extends Error {
  name = "ModulationStateParseError";
}
const er = {
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
N.map((t) => ({
  value: t.id,
  label: er[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
k.map((t) => ({
  value: t.kind,
  label: Ki(t.kind)
}));
function tr(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function $e(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Te(t, e) {
  const n = Number(t);
  return $e(Number.isFinite(n) ? n : e, Gi, Hi);
}
function nr(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function ir(t) {
  const e = Zi.get(t);
  return e !== void 0 ? nr(e) : Xi[fi(t)];
}
function rr(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function or(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function ar(t, e) {
  const n = ir(t), i = Number(e);
  return $e(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function sr(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function lr(t) {
  return sr(t) ?? "mseg";
}
function cr(t) {
  return Fe(t);
}
function ur(t) {
  return cr(t) ?? "oscA.wavetablePosition";
}
function dr(t, e) {
  const n = fn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function hr(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? te : t === "macro" ? hn : O;
  return $e(Number.isFinite(n) ? n : 1, 1, i);
}
function $(t) {
  return {
    name: qi[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function fr(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = $(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Te(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Te(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: L(n.sustain ?? i.sustain),
    releaseSeconds: Te(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function mr(t, e, n, i) {
  const o = Number(t.amount);
  return {
    id: rr(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: hr(n, t.sourceSlot),
    polarity: or(t.polarity),
    targetKind: i,
    amount: ar(i, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function pr(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, o = lr(i.sourceKind), r = ur(i.targetKind);
  return mr(i, e, o, r);
}
function gr(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Ir(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => pr(n, i));
}
function Sr(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const o = gr(i);
    if (e.has(i.id) || n.has(o))
      return !1;
    e.add(i.id), n.add(o);
  }
  return !0;
}
function Ce(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => Ce(a, e[l]));
  const n = t, i = e, o = Object.keys(n), r = Object.keys(i);
  return o.length === r.length && o.every((a) => tr(i, a) && Ce(n[a], i[a]));
}
function mn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = Wt(Wi[e] ?? `MSEG ${e + 1}`), o = ee(n.shapeA ?? i);
  return {
    shapeA: o,
    shapeB: ee(n.shapeB ?? o),
    playback: Ht(n.playback ?? qt())
  };
}
function Le() {
  return {
    format: "cosimo.modulation",
    version: dn,
    msegSlots: Array.from({ length: te }, (t, e) => mn({}, e)),
    envelopeSlots: Array.from({ length: O }, (t, e) => $(e)),
    routes: [],
    macroNames: fn.slice()
  };
}
function br(t = Le()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: dn,
    msegSlots: Array.from({ length: te }, (r, a) => mn(n[a], a)),
    envelopeSlots: Array.from({ length: O }, (r, a) => fr(i[a], a)),
    routes: Ir(e.routes),
    macroNames: Array.from(
      { length: hn },
      (r, a) => dr(o[a], a)
    )
  };
}
function lt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return Z(new Re("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return Z(new Re("Expected valid modulation JSON"));
    }
  }
  const n = br(e);
  return !Ce(e, n) || !Sr(n.routes) ? Z(new Re("Expected the current modulation schema")) : z(n);
}
function yr(t, e) {
  return {
    slot: t + 1,
    seconds: Gt(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function ct(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(ei(n))
  };
}
function vr(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function Rr(t, e = null) {
  const n = [];
  for (let i = 0; i < te; i += 1) {
    const o = t.msegSlots[i], r = e?.msegSlots[i];
    (r === void 0 || !nt(r.shapeA, o.shapeA)) && n.push({
      endpointID: st,
      value: ct(i, 0, o.shapeA)
    }), (r === void 0 || !nt(r.shapeB, o.shapeB)) && n.push({
      endpointID: st,
      value: ct(i, 1, o.shapeB)
    }), (r === void 0 || !ti(r.playback, o.playback)) && n.push({
      endpointID: zi,
      value: yr(i, o.playback)
    });
  }
  for (let i = 0; i < O; i += 1) {
    const o = t.envelopeSlots[i], r = e?.envelopeSlots[i];
    (r === void 0 || JSON.stringify(r) !== JSON.stringify(o)) && n.push({
      endpointID: ji,
      value: vr(i, o)
    });
  }
  return n.push(...Ri(e?.routes ?? null, t.routes)), n;
}
const xe = "articulationSnapshot", B = 128, ut = 48, Tr = 1e6;
function dt(t) {
  const e = (n) => p.map(() => n);
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
    msegMorphs: Array.from({ length: te }, () => 0),
    routeAmounts: Array.from({ length: rn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: O }, (n, i) => $(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: O }, (n, i) => $(i).decaySeconds),
    envelopeSustain: Array.from({ length: O }, (n, i) => $(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: O }, (n, i) => $(i).releaseSeconds)
  };
}
const Y = "articulations.v4", Be = [
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
], Ve = [
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
], xr = [
  ...p.flatMap((t) => Be.map(
    (e) => `osc${t}.${e}`
  )),
  ...Ve
];
class pn extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function f(t) {
  return Z(new pn("malformed", t));
}
function ne(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ke(t, e, n) {
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
function fe(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < B;
}
function Ar(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Mr(t) {
  return xr.some((e) => e === t);
}
function ht(t, e) {
  if (!ne(t))
    return f(`${e} must be an object`);
  const n = Ke(t, ["min", "max"], e);
  return n !== null ? f(n) : fe(t.min) ? fe(t.max) ? t.min > t.max ? f(`${e}.min must be less than or equal to ${e}.max`) : z({ min: t.min, max: t.max }) : f(`${e}.max must be an integer in 0..127`) : f(`${e}.min must be an integer in 0..127`);
}
function Er(t, e) {
  if (!ne(t))
    return f(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return f(`${e} has a non-string parameter id`);
    if (!Mr(i))
      return f(`${e} has unknown parameter id "${i}"`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o))
      return f(`${e}.${i} must be a finite number`);
    n[i] = o;
  }
  return z(n);
}
function wr(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Or() {
  return {};
}
function kr(t, e, n) {
  if (!ne(t))
    return f(`${e} must be an object`);
  const i = Or();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return f(`${e} has a non-string route id`);
    const r = t[o];
    if (typeof r != "number" || !Number.isFinite(r) || Math.abs(r) > ut)
      return f(
        `${e}.${o} must be a finite route amount within ±${ut}`
      );
    if (!n.has(o))
      return f(`${e}.${o} does not name a current articulable mapping`);
    wr(i, o, r);
  }
  return z(i);
}
function Dr(t, e, n) {
  const i = `slots[${e}]`;
  if (!ne(t))
    return f(`${i} must be an object`);
  const o = Ke(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (o !== null)
    return f(o);
  if (typeof t.id != "string")
    return f(`${i}.id must be a string`);
  if (!fe(t.runtimeSlot))
    return f(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return f(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return f(`${i}.color must be a string`);
  if (!fe(t.key))
    return f(`${i}.key must be an integer in 0..127`);
  const r = ht(t.velRange, `${i}.velRange`);
  if (r._tag === "err")
    return r;
  const a = ht(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = Er(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = kr(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : z({
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
const _r = Object.fromEntries(
  Be.map((t, e) => [t, 2 ** e])
), Cr = Object.fromEntries(
  Ve.map((t, e) => [t, 2 ** e])
);
function ft(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Lr(t, e) {
  return Be.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | _r[i] : n, 0);
}
function Nr(t) {
  return Ve.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Cr[n] : e, 0);
}
function Pr(t, e) {
  const n = (r, a) => ft(t, `osc${r}.${a}`), i = (r) => ft(t, r), o = Array.from(
    { length: rn },
    () => Tr
  );
  for (const [r, a] of Object.entries(t.routeAmounts)) {
    const l = e[r];
    l !== void 0 && (o[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: p.map((r) => Lr(t, r)),
    sharedOverrideMask: Nr(t),
    framePositions: p.map((r) => n(r, "framePosition")),
    pans: p.map((r) => n(r, "pan")),
    octaves: p.map((r) => n(r, "octave")),
    semitones: p.map((r) => n(r, "semitone")),
    fineCents: p.map((r) => n(r, "fineCents")),
    phases: p.map((r) => n(r, "phase")),
    phaseRandoms: p.map((r) => n(r, "phaseRandom")),
    retriggers: p.map((r) => n(r, "retrigger")),
    volumeDbs: p.map((r) => n(r, "volumeDb")),
    mutes: p.map((r) => n(r, "mute")),
    solos: p.map((r) => n(r, "solo")),
    warpModes: p.map((r) => n(r, "warpMode")),
    warpAmounts: p.map((r) => n(r, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterQ: i("filterQ"),
    unisonVoices: p.map((r) => n(r, "unisonVoices")),
    unisonDetunes: p.map((r) => n(r, "unisonDetune")),
    unisonBlends: p.map((r) => n(r, "unisonBlend")),
    unisonWidths: p.map((r) => n(r, "unisonWidth")),
    unisonDetuneModes: p.map((r) => n(r, "unisonDetuneMode")),
    unisonStackModes: p.map((r) => n(r, "unisonStackMode")),
    unisonWavetablePositionSpreads: p.map((r) => n(r, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: p.map((r) => n(r, "unisonWarpSpread")),
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
function Fr(t, e) {
  return t.slots.map((n) => Pr(n, e));
}
function Ur(t, e) {
  if (!ne(t))
    return f("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return f('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return Z(new pn(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Ke(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return f(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return f("selectedSlotId must be null or a string");
  if (!Ar(t.activeTriggerMode))
    return f('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return f("slots must be an array");
  if (t.slots.length > B)
    return f(`slots must contain at most ${B} entries`);
  const i = [], o = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = Dr(t.slots[a], a, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (o.has(s.id))
      return f(`slots[${a}].id duplicates "${s.id}"`);
    if (r.has(s.runtimeSlot))
      return f(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    o.add(s.id), r.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? f(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : z({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function gn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
const Ne = "runtimeState";
function In(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const $r = {
  endpointID: Ne,
  required: !0,
  mapValue: In
}, mt = "runtimeInstallAck", Br = "runtimeSyncRequest", pt = 0, Vr = 8e3, me = /* @__PURE__ */ new WeakMap(), Sn = 1e9;
let oe = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Sn;
function Kr(t) {
  return oe = oe % Sn + 1, t === "modulation" ? -1e9 - oe : 1e9 + oe;
}
function zr(t, e) {
  const n = t, i = me.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), me.set(n, i);
}
function gt(t, e) {
  const n = t, i = me.get(n);
  i?.delete(e), i?.size === 0 && me.delete(n);
}
const jr = [100, 250, 500, 1e3], ae = { _tag: "accepted" }, Wr = { _tag: "superseded" }, qr = { _tag: "stopped" }, It = { _tag: "transport-timeout" };
function Gr(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, o = i.dspSessionId, r = i.acceptedModulationSerial, a = i.acceptedArticulationSerial, l = i.rejectedSerial, s = i.rejectionReason, c = i.syncSerial;
  return ![
    o,
    r,
    a,
    l,
    s,
    c
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof o != "number" || typeof r != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || o < 0 || r < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: r,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function Hr(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class St {
  #o;
  #e;
  #d;
  #y;
  #h = !1;
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
  #v = this.#w.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#d = i && i.length > 0 ? i : [...jr], this.#y = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Vr)
    );
  }
  start() {
    if (!this.#i) {
      zr(this.#o, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(mt, this.#v);
      } catch (e) {
        throw this.#i = !1, gt(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(mt, this.#v), gt(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#b());
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
      const o = await this.#R(
        n,
        i
      );
      if (o._tag !== "accepted")
        return o;
      let r = null;
      for (const a of e) {
        const l = await this.#E(
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
      return r ?? ae;
    } finally {
      this.#h = !1;
    }
  }
  #x(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #A(e, n) {
    const i = this.#x(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #M() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #R(e, n) {
    if (this.#s === e)
      return ae;
    const i = Kr(this.#e);
    this.#l.add(i);
    const o = Date.now() + this.#y;
    let r = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return ae;
        const l = o - Date.now();
        if (l <= 0)
          return It;
        const s = this.#a;
        this.#I(i), await this.#S(
          s,
          Math.min(this.#g(r), l)
        ), r += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #E(e, n, i) {
    const o = this.#M(), r = Hr(e.value, n, o);
    let a = 0, l = 0, s = this.#c;
    for (this.#T(e.endpointID, r); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const u = this.#m(n, o, s);
      if (u !== null)
        return u;
      const m = this.#a;
      await this.#S(
        m,
        this.#g(a)
      );
      const g = this.#m(
        n,
        o,
        s
      );
      if (g !== null)
        return g;
      let h = this.#a;
      for (this.#I(o); ; ) {
        const S = this.#p(n, i);
        if (S)
          return S;
        const y = await this.#S(
          h,
          this.#g(a)
        ), A = this.#m(
          n,
          o,
          s
        );
        if (A !== null)
          return A;
        if (y && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
          if (l >= 1)
            return It;
          s = this.#c, this.#T(e.endpointID, r), l += 1, a += 1;
          break;
        }
        if (y) {
          h = this.#a;
          continue;
        }
        y || (a += 1, h = this.#a, this.#I(o));
      }
    }
  }
  #m(e, n, i) {
    const o = this.#n;
    if (!o || o.dspSessionId !== e)
      return null;
    const r = this.#r.get(n);
    return r !== void 0 && r.version > i && r.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...r.acknowledgement }
    }) : this.#A(o, n) ? (this.#r.delete(n), ae) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? qr : this.#t !== e ? Wr : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #T(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        pt
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          Br,
          e,
          void 0,
          pt
        );
      } catch {
      }
  }
  #w(e) {
    const n = Gr(e);
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
  #S(e, n) {
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
const Jr = 1e3, Ae = [X, Y];
function bt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Me(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (bt(i, e)) return i[e];
  if (bt(n, e)) return n[e];
}
function Ee(t, e) {
  if (t === void 0) return gn();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Ur(n, e);
  return i._tag === "ok" ? i.value : null;
}
function yt(t) {
  return new Set(t.routes.flatMap((e) => an(e) === null ? [] : [e.id]));
}
function vt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Qr {
  constructor(e) {
    this.connection = e, this.modulationLane = new St(e, { laneKind: "modulation" }), this.articulationLane = new St(e, { laneKind: "articulation" });
  }
  modulationState = Le();
  articulationBank = gn();
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
    { length: B },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Ne, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Ne, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Ae) this.connection.requestStoredStateValue(n);
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
    const n = Me(e, X), i = n === void 0 ? { _tag: "ok", value: Le() } : lt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${X} is invalid; boot state was not installed.`);
      const a = Me(e, Y), l = Ee(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const o = Me(e, Y), r = Ee(
      o,
      yt(i.value)
    );
    if (r === null) {
      console.error(`[runtime-state-worker] ${Y} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Ae.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Ae.length) {
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
    if (e === X) {
      const o = lt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${X}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Ee(n, yt(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${Y}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = In(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, o = this.lastAppliedModulationGeneration !== e, r = Rr(
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
    const l = this.buildUploadsBySelector(n, i), s = Array.from({ length: B }, (h, S) => {
      const y = l.get(S);
      return y ? vt(y) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, u = c && this.articulationLane.getAcceptedFrontier() !== 0, m = [];
    for (let h = 0; h < B; h += 1) {
      const S = l.get(h), y = s[h] !== this.lastAppliedArticulationTokens[h];
      u ? m.push({
        endpointID: xe,
        value: S ?? dt(h)
      }) : c ? S && m.push({ endpointID: xe, value: S }) : y && m.push({
        endpointID: xe,
        value: S ?? dt(h)
      });
    }
    const g = await this.articulationLane.sendBatch(m);
    this.acceptOutcome("articulation", g, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((o) => {
      const r = an(o);
      return r === null ? [] : [[o.id, r]];
    }));
    return new Map(
      Fr(n, i).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = vt(i), r = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), r && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Jr));
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
function Xr(t) {
  return new Qr(t);
}
const R = "rack.v1", Yr = "rackOrder", Zr = "rackEnable", C = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), bn = Object.freeze({
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
  C.map((t) => [bn[t], t])
);
function yn() {
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
function Rt() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...C],
    enabled: yn()
  };
}
function eo(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${R} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${R} is not valid JSON: ${n}` };
  }
}
function Tt(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function to(t) {
  return typeof t != "string" ? null : C.find((e) => e === t) ?? null;
}
function no(t) {
  const e = eo(t);
  if (e._tag === "err")
    return e;
  if (!Tt(e.value))
    return { _tag: "err", message: `${R} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const a of Reflect.ownKeys(e.value))
    if (typeof a != "string" || !n.has(a))
      return { _tag: "err", message: `${R} has unexpected field ${String(a)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${R} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== C.length)
    return { _tag: "err", message: `${R}.order must contain every effect once` };
  const i = [], o = /* @__PURE__ */ new Set();
  for (const a of e.value.order) {
    const l = to(a);
    if (l === null || o.has(l))
      return { _tag: "err", message: `${R}.order is not a complete permutation` };
    o.add(l), i.push(l);
  }
  if (!Tt(e.value.enabled))
    return { _tag: "err", message: `${R}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== C.length)
    return { _tag: "err", message: `${R}.enabled must contain every effect once` };
  const r = yn();
  for (const a of C) {
    const l = e.value.enabled[a];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${R}.enabled.${a} must be boolean` };
    r[a] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: r }
  };
}
function io(t) {
  if (t === void 0)
    return Rt();
  const e = no(t);
  return e._tag === "ok" ? e.value : Rt();
}
function ro(t) {
  return [
    {
      endpointID: Yr,
      value: { moduleIds: t.order.map((e) => bn[e]) }
    },
    {
      endpointID: Zr,
      value: { enabledFlags: C.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const oo = 2e3;
function xt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function ao(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return xt(i, e) ? {
    found: !0,
    value: i[e]
  } : xt(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function At(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class so {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = lo(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = ao(e, this.options.stateKey);
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
    }, o = At(n), r = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, r), l = At({
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
        this.options.sendTimeoutMilliseconds ?? oo
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
  }
}
function lo(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function co(t, e) {
  return new so(t, e);
}
function uo(t) {
  return co(t, {
    stateKey: R,
    runtimeEndpointDependencies: [$r],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: io,
    buildRuntimeEvents: ({ state: e }) => [...ro(e)]
  });
}
const ho = "runtimeSyncRequest", fo = 2147483647, mo = "runtimeState", po = "retryDesiredTableRequest", go = "workerLoadFailure", Io = "serviceLoadAbort", So = "wavetableLoadBegin", bo = "wavetableMipFrame", yo = "wavetableUploadAck", vo = "wavetableMipRequest", Ro = "wavetablePrewarmRequest", To = "wavetablePrewarmNotification", xo = "assets/factory-bank-catalog.json", Ao = 1, Mo = 2, Eo = 3, wo = 1, Oo = 2, ko = 2e4, se = Ao, Do = Mo, Mt = Eo, D = wo, Et = Oo, _o = 48 * 1024 * 1024, we = 3;
function wt(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function I(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Ot(t) {
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
function kt(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function Dt(t, e) {
  if (!t)
    throw new Error(e);
}
function Co(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Lo(t, e) {
  return kn(await t.readJSON(e));
}
function No(t) {
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
function Po(t, e) {
  const n = Math.round(Number(t) || 0);
  return Co(n, 0, Math.max(0, e - 1));
}
function Oe(t, e, n, i, o) {
  return `${t}:${e}:${n}:${i}:${o}`;
}
function Fo(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function _t(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Ct(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function Lt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Uo(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class $o {
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
    this.connection = e, this.resourceClient = On(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? xo, this.maxFramesInFlight = wt(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? Ut, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? _o) || 0)), this.serviceLoadTimeoutMs = wt(n.serviceLoadTimeoutMs, ko), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, I("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(mo, this.handleRuntimeState), this.connection.addEndpointListener?.(yo, this.handleUploadAck), this.connection.addEndpointListener?.(vo, this.handleMipRequest), this.connection.addEndpointListener?.(Ro, this.handlePrewarmRequest), this.connection.addEndpointListener?.(To, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ho,
      fo
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Lo(this.resourceClient, this.catalogPath), I("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < we; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = _t(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: _t(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Oe(
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
          ...Ct(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: o } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (I("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Mt,
          failureReasonCode: Et
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Mt || e.failureReasonCode !== Et ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: o = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = se,
    failureReasonCode: l = D
  }) {
    this.connection.sendEventOrValue?.(go, {
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
    failureReasonCode: r = D
  }) {
    this.connection.sendEventOrValue?.(Io, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: o,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    I("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ot(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(po, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), o = Po(e, i.tables.length), r = i.tables[o];
    Dt(r, `Could not resolve table ${o}`);
    const a = Fo(r, Qe, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, I("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = Lt();
    I("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(r.sourceWav), u = Nn(c.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: Qe
    });
    return I("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(Lt() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: r,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    I("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(So, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    I("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: se,
      failureReasonCode: D
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: se,
      failureReasonCode: D
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = se,
    failureReasonCode: i = D
  } = {}) {
    I("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (I("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: ke(r)
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
      this.isCurrentRuntimeState(e) && (I("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: ke(a)
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
    for (let e = 0; e < we; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Uo(() => {
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
        I("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: D
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
    const n = No(e ?? {});
    if (I("info", "Received runtime state", Ot(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= we)
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
          o.spectra[a] || (o.spectra[a] = Ye(o.frames[a]));
        const r = this.tableCache.get(o.cacheKey);
        r && this.refreshCacheEntryByteCount(r), I("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        I("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: ke(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Oe(
      n,
      i,
      o,
      r,
      a
    );
    let c = this.mipJobs.get(s);
    return c ? (!c.completed && l > c.urgencyLevel && (c.urgencyLevel = l), c) : (c = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: o,
      tableIndex: r,
      mipIndex: a,
      urgencyLevel: l,
      ...Ct(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (I("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndex)), c = Oe(
      i,
      o,
      r,
      a,
      l
    ), u = this.mipJobs.get(c);
    !u || u.completed || !u.inFlightFrames.has(s) || (u.inFlightFrames.delete(s), u.ackedFrames[s] || (u.ackedFrames[s] = 1, u.ackedFrameCount += 1), u.ackedFrameCount === this.serviceTable?.frameCount && u.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && u.inFlightFrames.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), kt(s, this.serviceTable?.frameCount ?? 0) && I("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      oscillatorIndex: o,
      generation: r,
      tableIndex: u.tableIndex,
      mipIndex: l,
      frameIndex: s,
      ackedFrameCount: u.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (Dt(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Ye(this.serviceTable.frames[e]);
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
        const o = this.getSpectrumForFrame(n);
        i = Pn(o, e.mipIndex);
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
            failurePhase: Do,
            failureReasonCode: D
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(bo, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndex: n,
        samples: Array.from(i)
      }), kt(n, this.serviceTable.frameCount) && I("info", "Sent wavetable mip frame", {
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
function ke(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Bo(t, e = {}) {
  return new $o(t, e);
}
async function Vo(t, e = {}) {
  return $n(t, [
    Xr,
    uo,
    () => Bo(t, e)
  ]);
}
export {
  Mo as FAILURE_PHASE_BUILD_MIP,
  Ao as FAILURE_PHASE_LOAD_SOURCE,
  Eo as FAILURE_PHASE_TRANSFER_MIP,
  wo as FAILURE_REASON_GENERIC,
  Oo as FAILURE_REASON_TIMEOUT,
  fo as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  $o as WavetableWorkerController,
  Bo as createWavetableWorkerController,
  Vo as default
};
