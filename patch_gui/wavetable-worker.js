function E(t, e) {
  if (!t)
    throw new Error(e);
}
function ye(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function _n(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Fe(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function jt(t) {
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
function be(t, e) {
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
async function tt(t) {
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
  throw new Error(`Unsupported text resource payload (${jt(t)})`);
}
function Ln(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Fe(t);
  throw new Error(`Unsupported binary resource payload (${jt(t)})`);
}
function Nn(t) {
  const e = t?.frames;
  E(
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
      const s = o;
      E(s.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(s[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Wt(t) {
  const e = new DataView(t);
  E(ye(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), E(ye(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, s = null, l = null, a = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const m = ye(e, c, 4), g = e.getUint32(c + 4, !0), f = c + 8;
    m === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), r = e.getUint32(f + 4, !0), s = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : m === "data" && (l = f, a = g), c = f + g + g % 2;
  }
  E(n !== null, "Wave file is missing a fmt chunk"), E(l !== null && a !== null, "Wave file is missing a data chunk"), E(i === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && o === 32)
    u = new Float32Array(t.slice(l, l + a));
  else if (n === 1 && o === 16) {
    const m = a / 2, g = new Int16Array(t.slice(l, l + a));
    u = new Float32Array(m);
    for (let f = 0; f < m; f += 1)
      u[f] = g[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: o,
    blockAlign: s ?? 0,
    samples: u
  };
}
async function nt(t) {
  E(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return E(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Ue(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function qt(t) {
  const e = new Uint8Array(t).buffer, n = Wt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Pn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (a) => (E(typeof t.readResource == "function", `Resource bridge cannot read ${a}`), t.readResource(a)), r = async (a) => {
    E(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${a}`);
    const c = await t.readResourceAsAudioData(a);
    return Nn(c);
  }, o = (a) => {
    const c = t.getResourceAddress?.(a);
    return c ?? null;
  }, s = async (a, c = t.getResourceAddress?.(a)) => {
    const u = be(a, c), m = await nt(u), g = Wt(m);
    return {
      sampleRate: g.sampleRate,
      samples: g.samples
    };
  }, l = async (a, c = t.getResourceAddress?.(a)) => {
    const u = be(a, c);
    return new Uint8Array(await nt(u));
  };
  return {
    async readText(a) {
      if (e === "bridge" && typeof t.readResource == "function")
        return tt(await i(a));
      const c = o(a);
      return e === "url" && c !== null ? Ue(await l(a, c)) : typeof t.readResource == "function" ? tt(await i(a)) : Ue(await l(a, c));
    },
    async readJSON(a) {
      return JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      return typeof t.readResource == "function" ? Ln(await i(a)) : l(a);
    },
    async readAudio(a) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(a);
      const c = o(a);
      return n === "url" && c !== null ? s(a, c) : typeof t.readResourceAsAudioData == "function" ? r(a) : qt(await this.readBytes(a));
    },
    getURL(a) {
      return be(a, t.getResourceAddress?.(a));
    }
  };
}
function Fn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Pn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Un(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(s) {
      if (e)
        return e(s);
      if (n)
        return JSON.stringify(await n(s));
      if (i)
        return Ue(await i(s));
      throw new Error(`Resource client cannot read text ${s}`);
    },
    async readJSON(s) {
      return n ? n(s) : JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      if (i)
        return i(s);
      if (e)
        return Fe(await e(s));
      if (n)
        return Fe(JSON.stringify(await n(s)));
      throw new Error(`Resource client cannot read bytes ${s}`);
    },
    async readAudio(s) {
      return r ? r(s) : qt(await this.readBytes(s));
    },
    getURL(s) {
      return o ? o(s) : null;
    }
  };
}
function Bn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function $n(t) {
  return Bn(t) ? Un(t) : Fn(t);
}
const it = 2048;
function Y(t, e) {
  if (!t)
    throw new Error(e);
}
function Vn(t) {
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
const Kn = 2048, Gt = 11, zn = 256;
function w(t, e) {
  if (!t)
    throw new Error(e);
}
function jn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ot = /* @__PURE__ */ new Map();
function Wn(t) {
  const e = ot.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, s = r;
    for (let l = 0; l < n; l += 1)
      o = o << 1 | s & 1, s >>= 1;
    i[r] = o;
  }
  return ot.set(t, i), i;
}
function Ht(t, e, n = !1) {
  const i = t.length;
  w(i === e.length, "FFT real and imaginary buffers must have the same length"), w(jn(i), "FFT input length must be a power of two");
  const r = Wn(i);
  for (let o = 0; o < i; o += 1) {
    const s = r[o];
    if (s <= o)
      continue;
    const l = t[o];
    t[o] = t[s], t[s] = l;
    const a = e[o];
    e[o] = e[s], e[s] = a;
  }
  for (let o = 2; o <= i; o <<= 1) {
    const s = o >> 1, l = (n ? 2 : -2) * Math.PI / o, a = Math.cos(l), c = Math.sin(l);
    for (let u = 0; u < i; u += o) {
      let m = 1, g = 0;
      for (let f = 0; f < s; f += 1) {
        const y = u + f, T = y + s, k = t[T], G = e[T], H = m * k - g * G, J = m * G + g * k, Q = t[y], X = e[y];
        t[y] = Q + H, e[y] = X + J, t[T] = Q - H, e[T] = X - J;
        const se = m * a - g * c;
        g = m * c + g * a, m = se;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function Jt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function qn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Kn,
  maxFramesPerTable: i = zn
} = {}) {
  const r = Float32Array.from(t);
  w(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  w(o > 0, "Source wavetable files must contain at least one frame"), w(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && w(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const s = [];
  for (let l = 0; l < o; l += 1) {
    const a = l * n, c = a + n;
    s.push(Jt(r.slice(a, c)));
  }
  return {
    frameCount: o,
    frames: s
  };
}
function rt(t) {
  const e = Jt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Ht(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Gn(t, e, {
  mipLevelCount: n = Gt
} = {}) {
  const i = t?.real?.length ?? 0;
  w(i > 0, "Spectrum must contain real samples"), w(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), w(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), s = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    o[l] = t.real[l], s[l] = t.imaginary[l];
    const a = (i - l) % i;
    a !== l && (o[a] = t.real[a], s[a] = t.imaginary[a]);
  }
  return Ht(o, s, !0), Float32Array.from(o);
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
const x = (t, e) => ({ label: t, value: e });
function O(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const D = Object.freeze({
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
}), d = (t, e, n, i, r, o, s, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: o,
  initial: s,
  step: l.step ?? (o - r) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), Xn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Yn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Zn = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: D.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(x), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: D.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [x("Classic", 0), x("Harmonics", 1)] }),
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
    iconUrl: D.ott,
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
    iconUrl: D.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(x) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(x) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(x) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: D.flanger,
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
    iconUrl: D.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [x("Free", 0), x("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Xn.map(x) }),
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
    iconUrl: D.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [x("Free", 0), x("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Yn.map(x) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: D.reverb,
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
], Qt = Zn, Xt = Object.freeze(
  Qt.flatMap((t) => t.parameters)
);
new Map(
  Xt.map((t) => [t.endpointID, t])
);
function Yt() {
  return Xt;
}
const _ = 2048, ei = _ + 3, st = 20, Zt = "MSEG 1", ti = 0, ni = 2, ii = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Ke(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function j(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function oi(t) {
  return Ke(Number.isFinite(t) ? t : 0, -st, st);
}
function U(t) {
  return Ke(Number.isFinite(t) ? t : 0, 0, 1);
}
function en(t = Zt) {
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
function tn() {
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
function nn(t) {
  const e = Number(t);
  return Ke(
    Number.isFinite(e) ? e : 1,
    ti,
    ni
  );
}
function ri(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = U(Number(e.startX)), i = U(Number(e.endX));
  return j(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function on(t = tn()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = ii.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: nn(Number.isFinite(i) ? i : 1)
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
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = U(r)), {
    x: r,
    y: U(Number(i.y)),
    curvePower: oi(Number(i.curvePower))
  };
}
function ie(t = en()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => si(r, o, n.length));
  if (!j(i[0].x, 0) || !j(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Zt,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function at(t) {
  return JSON.stringify(ie(t));
}
function lt(t) {
  return JSON.stringify(on(t));
}
function ai(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function li(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (j(e, r.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && j(t[o + 1].x, e); )
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
function ci(t, e) {
  const n = U(Number(e)), i = li(t, n);
  if (i.laterPointWins || j(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, s = U(ai(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * s;
}
function ui(t, e) {
  return ci(ie(t).points, e);
}
function di(t) {
  const e = ie(t), n = new Float32Array(_);
  for (let r = 0; r < _; r += 1) {
    const o = r / (_ - 1);
    n[r] = ui(e, o);
  }
  const i = new Float32Array(ei);
  return i[0] = n[0], i.set(n, 1), i[_ + 1] = n[_ - 1], i[_ + 2] = n[_ - 1], i;
}
function ct(t, e) {
  return at(t) === at(e);
}
function fi(t, e) {
  return lt(t) === lt(e);
}
const p = ["A", "B", "C"], hi = [
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
], mi = [
  "filterCutoffOctaves",
  "filterQ"
], B = Object.freeze([
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
  ...p.flatMap((t) => hi.map(
    (e) => `osc${t}.${e}`
  )),
  ...mi
]), rn = Object.freeze(
  pi.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), gi = Yt().filter((t) => t.modulationTargetIndex !== null), sn = Object.freeze(
  gi.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), L = Object.freeze([
  ...rn,
  ...sn
]), de = B.length, an = rn.length, ln = sn.length, Ii = de * L.length, Si = new Map(B.map((t) => [t.id, t])), cn = new Map(B.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), W = new Map(L.map((t) => [t.kind, t]));
function yi() {
  if (de !== 13 || an !== 32 || ln !== 36 || Ii !== 884)
    throw new Error("Modulation identity catalog has an unexpected domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = B.filter((r) => r.group === t), i = n.map((r) => r.runtimeIndex).sort((r, o) => r - o);
    if (n.length !== e || i.some((r, o) => r !== o))
      throw new Error(`Modulation ${t} source indexes must be unique and contiguous`);
  }
  for (const [t, e] of [["voice", 32], ["rack", 36]]) {
    const n = L.filter((r) => r.group === t), i = n.map((r) => r.runtimeIndex).sort((r, o) => r - o);
    if (n.length !== e || i.some((r, o) => r !== o))
      throw new Error(`Modulation ${t} target indexes must be unique and contiguous`);
  }
  if (Si.size !== de || cn.size !== de || W.size !== L.length)
    throw new Error("Modulation identities must be unique");
}
yi();
function un(t, e) {
  const n = cn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function ze(t) {
  return typeof t != "string" ? null : W.has(t) ? t : null;
}
function bi(t) {
  const e = ze(t);
  return e !== null && W.get(e)?.group === "voice" ? e : null;
}
function vi(t) {
  const e = ze(t);
  return e !== null && W.get(e)?.group === "rack" ? e : null;
}
function Ri(t) {
  const e = W.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ti(t) {
  const e = W.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ai(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const ve = "modulationProgram", xi = "modulationAmount", dn = B.filter((t) => t.group === "voice").length, fn = B.filter((t) => t.group === "macro").length, fe = an, he = ln, P = dn * fe, V = fn * fe, $ = dn * he, Z = fn * he, hn = P + V;
function Mi(t) {
  const e = un(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Ei(t) {
  const e = bi(t);
  return e === null ? null : Ri(e);
}
function mn(t) {
  const e = Ei(t.targetKind), n = vi(t.targetKind), i = n === null ? void 0 : Ti(n);
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const s = un(t.sourceKind, t.sourceSlot);
    if (s.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = s.runtimeIndex;
    if (e !== null) {
      const c = l * fe + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: l,
        targetIndex: e,
        articulationCellIndex: P + c
      };
    }
    const a = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * he + a,
      sourceIndex: l,
      targetIndex: a,
      articulationCellIndex: null
    };
  }
  const r = Mi(t);
  if (e !== null) {
    const s = r * fe + e;
    return {
      path: "voice",
      cellIndex: s,
      sourceIndex: r,
      targetIndex: e,
      articulationCellIndex: s
    };
  }
  const o = i ?? 0;
  return {
    path: "voiceRack",
    cellIndex: r * he + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function pn(t) {
  return mn(t).articulationCellIndex;
}
function wi(t) {
  return {
    ...mn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function gn(t) {
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
function ki(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function K(t) {
  return [...t.values()].filter(ki).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ae(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const s = t[o];
    if (s === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = s.cellIndex, n[o] = s.sourceIndex, i[o] = s.targetIndex, r[o] = s.polarity;
  }
}
function Re(t) {
  const e = gn(t), n = K(e.voice), i = K(e.macroVoice), r = K(e.voiceRack), o = K(e.macroRack), s = Array.from({ length: P }, () => 0), l = Array.from({ length: P }, () => 0), a = Array.from({ length: P }, () => 0), c = Array.from({ length: P }, () => 0), u = Array.from({ length: P }, () => 0);
  ae(n, s, l, a, c);
  const m = Array.from({ length: V }, () => 0), g = Array.from({ length: V }, () => 0), f = Array.from({ length: V }, () => 0), y = Array.from({ length: V }, () => 0), T = Array.from({ length: V }, () => 0);
  ae(
    i,
    m,
    g,
    f,
    y
  );
  const k = Array.from({ length: $ }, () => 0), G = Array.from({ length: $ }, () => 0), H = Array.from({ length: $ }, () => 0), J = Array.from({ length: $ }, () => 0), Q = Array.from({ length: $ }, () => 0), X = Array.from({ length: $ }, () => 0);
  ae(
    r,
    k,
    G,
    H,
    J
  );
  const se = Array.from({ length: Z }, () => 0), Qe = Array.from({ length: Z }, () => 0), Xe = Array.from({ length: Z }, () => 0), Ye = Array.from({ length: Z }, () => 0), Ze = Array.from({ length: Z }, () => 0);
  ae(
    o,
    se,
    Qe,
    Xe,
    Ye
  );
  for (const R of e.voice.values()) u[R.cellIndex] = R.amount;
  for (const R of e.macroVoice.values()) T[R.cellIndex] = R.amount;
  for (const R of e.voiceRack.values()) X[R.cellIndex] = R.amount;
  for (const R of e.macroRack.values()) Ze[R.cellIndex] = R.amount;
  for (let R = 0; R < r.length; R += 1) {
    const et = r[R];
    if (et === void 0) throw new Error(`Missing compiled voice-rack route at index ${R}`);
    Q[R] = et.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: s,
    voiceRouteSources: l,
    voiceRouteTargets: a,
    voiceRoutePolarities: c,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: g,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: y,
    macroVoiceRouteAmounts: T,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: k,
    voiceRackRouteSources: G,
    voiceRackRouteTargets: H,
    voiceRackRoutePolarities: J,
    voiceRackRouteReducers: Q,
    voiceRackRouteAmounts: X,
    macroRackRouteCount: o.length,
    macroRackRouteCells: se,
    macroRackRouteSources: Qe,
    macroRackRouteTargets: Xe,
    macroRackRoutePolarities: Ye,
    macroRackRouteAmounts: Ze
  };
}
const Oi = ["voice", "macroVoice", "voiceRack", "macroRack"], Di = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function ut(t) {
  return gn(t);
}
function _i(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ci(t, e) {
  if (t === null)
    return [{ endpointID: ve, value: Re(e) }];
  const n = ut(t), i = ut(e), r = [];
  for (const o of Oi) {
    const s = K(n[o]), l = K(i[o]);
    if (s.length !== l.length)
      return [{ endpointID: ve, value: Re(e) }];
    for (let a = 0; a < l.length; a += 1) {
      const c = s[a], u = l[a];
      if (c === void 0 || u === void 0 || !_i(c, u))
        return [{ endpointID: ve, value: Re(e) }];
      c.amount !== u.amount && r.push({
        endpointID: xi,
        value: {
          pathKind: Di[o],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return r;
}
function q(t) {
  return { _tag: "ok", value: t };
}
function ne(t) {
  return { _tag: "err", error: t };
}
function Li(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function dt(t) {
  throw new Error(t ?? "Invariant violated");
}
function Te(t, e, n, i, r = "percent", o = null) {
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
      Te("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Te("resonance", "Resonance", 36.91760377573153, 0),
      Te("drive", "Drive", 15, 0)
    ]
  }
], ft = 1e-6;
function Se(t, e) {
  if (!Number.isFinite(t) || t < -ft || t > 1 + ft)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function me(t, e) {
  return Se(t / 100, `${e} catalog percentage`);
}
function In(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Pi(t) {
  return 20 * 1e3 ** t;
}
function Fi(t) {
  return Se(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Ui(t) {
  return 0.1 * 200 ** t;
}
function Bi(t) {
  return Se(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ht(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function $i(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: ht("filterCutoff", Pi, Fi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ht("filterQ", Ui, Bi),
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
function Vi(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ki(t, e) {
  const n = In(t.moduleId, e.id), i = Sn(e.format), r = $i(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: me(e.defaultPercent, n),
    initialValue: me(e.initialPercent, n),
    format: i,
    modAmount: Vi(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const zi = [
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
function ji(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Wi(t, e) {
  const n = `osc${t}`, i = In(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: me(e.defaultPercent, i),
    initialValue: me(e.initialPercent, i),
    format: Sn(e.format),
    modAmount: ji(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const qi = Object.freeze(
  p.flatMap((t) => zi.map((e) => Wi(t, e)))
);
function Gi(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ae(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return Se(n, `${t.endpointID} endpoint conversion`);
}
function Hi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ji(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Qi(t) {
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
function Xi(t) {
  const e = Gi(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ae(t, t.initial),
    initialValue: Ae(t, t.initial),
    format: Ji(t),
    modAmount: Qi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Hi(t, n),
      fromEngine: (n) => Ae(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const je = Object.freeze(
  [
    ...Qt.flatMap((t) => t.parameters.map(Xi)),
    ...qi,
    ...Ni.flatMap(
      (t) => t.parameters.map(
        (e) => Ki(t, e)
      )
    )
  ]
), Yi = new Map(
  je.map((t) => [t.targetId, t])
), yn = je.filter(
  (t) => t.modulationTargetKind !== null
), pe = new Map(
  yn.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Yi.size !== je.length)
  throw new Error("Target descriptor IDs must be unique");
if (yn.length !== L.length || pe.size !== L.length || L.some((t) => pe.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Zi(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = pe.get(t);
    return i === void 0 ? dt(`Modulation target "${t}" has no display descriptor`) : `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = pe.get(t);
  return n === void 0 ? dt(`Modulation target "${t}" has no display descriptor`) : n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const ee = "modulation.v5", bn = 5, oe = 3, C = 3, mt = "modulationMsegBuffer", eo = "modulationMsegPlayback", to = "modulationEnvelope", vn = 4, no = ["MSEG 1", "MSEG 2", "MSEG 3"], Rn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], io = ["Env 1", "Env 2", "Env 3"], oo = 1e-3, ro = 10, so = 0.1, ao = 20, lo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: ao - so },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, co = Yt().filter((t) => t.modulationTargetIndex !== null), uo = new Map(
  co.map((t) => [`rack.${t.endpointID}`, t])
);
class xe extends Error {
  name = "ModulationStateParseError";
}
const fo = {
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
B.map((t) => ({
  value: t.id,
  label: fo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
L.map((t) => ({
  value: t.kind,
  label: Zi(t.kind)
}));
function ho(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function We(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Me(t, e) {
  const n = Number(t);
  return We(Number.isFinite(n) ? n : e, oo, ro);
}
function mo(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function po(t) {
  const e = uo.get(t);
  return e !== void 0 ? mo(e) : lo[Ai(t)];
}
function go(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Io(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function So(t, e) {
  const n = po(t), i = Number(e);
  return We(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function yo(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function bo(t) {
  return yo(t) ?? "mseg";
}
function vo(t) {
  return ze(t);
}
function Ro(t) {
  return vo(t) ?? "oscA.wavetablePosition";
}
function To(t, e) {
  const n = Rn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Ao(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? oe : t === "macro" ? vn : C;
  return We(Number.isFinite(n) ? n : 1, 1, i);
}
function z(t) {
  return {
    name: io[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Tn(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = z(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Me(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Me(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: U(n.sustain ?? i.sustain),
    releaseSeconds: Me(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function xo(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: go(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Ao(n, t.sourceSlot),
    polarity: Io(t.polarity),
    targetKind: i,
    amount: So(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Mo(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = bo(i.sourceKind), o = Ro(i.targetKind);
  return xo(i, e, r, o);
}
function Eo(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function wo(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Mo(n, i));
}
function ko(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = Eo(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function Be(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((s, l) => Be(s, e[l]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((s) => ho(i, s) && Be(n[s], i[s]));
}
function An(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = en(no[e] ?? `MSEG ${e + 1}`), r = ie(n.shapeA ?? i);
  return {
    shapeA: r,
    shapeB: ie(n.shapeB ?? r),
    playback: on(n.playback ?? tn())
  };
}
function $e() {
  return {
    format: "cosimo.modulation",
    version: bn,
    msegSlots: Array.from({ length: oe }, (t, e) => An({}, e)),
    envelopeSlots: Array.from({ length: C }, (t, e) => z(e)),
    routes: [],
    macroNames: Rn.slice()
  };
}
function Oo(t = $e()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: bn,
    msegSlots: Array.from({ length: oe }, (o, s) => An(n[s], s)),
    envelopeSlots: Array.from({ length: C }, (o, s) => Tn(i[s], s)),
    routes: wo(e.routes),
    macroNames: Array.from(
      { length: vn },
      (o, s) => To(r[s], s)
    )
  };
}
function pt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ne(new xe("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ne(new xe("Expected valid modulation JSON"));
    }
  }
  const n = Oo(e);
  return !Be(e, n) || !ko(n.routes) ? ne(new xe("Expected the current modulation schema")) : q(n);
}
function Do(t, e) {
  return {
    slot: t + 1,
    seconds: nn(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function gt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(di(n))
  };
}
function _o(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function Co(t, e = null) {
  const n = [];
  for (let i = 0; i < oe; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !ct(o.shapeA, r.shapeA)) && n.push({
      endpointID: mt,
      value: gt(i, 0, r.shapeA)
    }), (o === void 0 || !ct(o.shapeB, r.shapeB)) && n.push({
      endpointID: mt,
      value: gt(i, 1, r.shapeB)
    }), (o === void 0 || !fi(o.playback, r.playback)) && n.push({
      endpointID: eo,
      value: Do(i, r.playback)
    });
  }
  for (let i = 0; i < C; i += 1) {
    const r = t.envelopeSlots[i], o = e?.envelopeSlots[i];
    (o === void 0 || JSON.stringify(o) !== JSON.stringify(r)) && n.push({
      endpointID: to,
      value: _o(i, r)
    });
  }
  return n.push(...Ci(e?.routes ?? null, t.routes)), n;
}
const Ee = "articulationSnapshot", I = 128, It = 48, Lo = 1e6, v = -1, we = [
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
function qe(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ke(t) {
  return qe(Number.isFinite(t) ? t : 0, 0, 1);
}
function A(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return qe(Number.isFinite(r) ? r : e, n, i);
}
function b(t, e, n, i) {
  return qe(Math.round(A(t, e)), n, i);
}
function xn(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Oe() {
  return Array.from({ length: I }, () => v);
}
function No(t) {
  const e = b(t, 0, 0, I - 1), n = we[e % we.length], i = Math.floor(e / we.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function Po() {
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
function Fo(t) {
  const e = Po(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: A(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: A(n.pan, e.pan, -1, 1),
    octave: b(n.octave, e.octave, -4, 4),
    semitone: b(n.semitone, e.semitone, -12, 12),
    fineCents: A(n.fineCents, e.fineCents, -100, 100),
    volumeDb: A(n.volumeDb, e.volumeDb, -48, 6),
    mute: b(n.mute, e.mute, 0, 1),
    solo: b(n.solo, e.solo, 0, 1),
    warpMode: b(n.warpMode, e.warpMode, 0, 4),
    warpAmount: A(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: b(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: A(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterQ: A(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: b(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: A(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: A(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: A(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: A(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: A(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: b(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: b(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: b(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: A(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: A(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      ke(Number(i[0])),
      ke(Number(i[1])),
      ke(Number(i[2]))
    ]
  };
}
function Uo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: A(e.amount, 0, -48, 48)
  } : null;
}
function Bo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Uo).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Fo(e.parameters),
    envelopes: [0, 1, 2].map((r) => Tn(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function $o(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = b(n.runtimeSlot, e, 0, I - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : No(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: Bo(n.snapshot)
  };
}
function Vo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: b(n.note, 0, 0, I - 1),
    articulationId: i
  } : null;
}
function Ko(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, s = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(s))
    return null;
  let l = b(o.min, r, r, I - 1), a = b(o.max, l, r, I - 1);
  return a < l && ([l, a] = [a, l]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: s,
    min: l,
    max: a
  };
}
function St(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), s = [];
  for (let l = 0; l < r.length; l += 1) {
    const a = Ko(
      r[l],
      e,
      l,
      n,
      i
    );
    !a || o.has(a.id) || (o.add(a.id), s.push(a));
  }
  return s;
}
function zo(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const s = Vo(o, e);
    !s || i.has(s.note) || (i.add(s.note), r.push(s));
  }
  return r;
}
function jo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let a = 0; a < n.length && o.length < I; a += 1) {
    const c = $o(n[a], a);
    !c || i.has(c.runtimeSlot) || r.has(c.id) || (i.add(c.runtimeSlot), r.add(c.id), o.push(c));
  }
  const s = typeof e.selectedSlotId == "string" && o.some((a) => a.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(o.map((a) => a.id));
  return {
    selectedSlotId: s,
    activeTriggerMode: xn(e.activeTriggerMode),
    slots: o,
    chainAssignments: St(e.chainAssignments, l, "chain", 0),
    keyAssignments: zo(e.keyAssignments, l),
    velocityAssignments: St(e.velocityAssignments, l, "velocity", 1)
  };
}
function yt(t) {
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
    msegMorphs: Array.from({ length: oe }, () => 0),
    routeAmounts: Array.from({ length: hn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: C }, (n, i) => z(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: C }, (n, i) => z(i).decaySeconds),
    envelopeSustain: Array.from({ length: C }, (n, i) => z(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: C }, (n, i) => z(i).releaseSeconds)
  };
}
function bt(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === v && (t[o] = r);
  }
}
function Wo(t) {
  const e = jo(t), n = new Map(e.slots.map((s) => [s.id, s.runtimeSlot])), i = Oe(), r = Oe(), o = Oe();
  bt(i, e.chainAssignments, n), bt(o, e.velocityAssignments, n);
  for (const s of e.keyAssignments) {
    const l = n.get(s.articulationId);
    l === void 0 || r[s.note] !== v || (r[s.note] = l);
  }
  return o[0] = v, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function qo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Wo(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: xn(e.activeMode),
    chain: Array.from({ length: I }, (n, i) => b(e.chain?.[i], v, v, I - 1)),
    key: Array.from({ length: I }, (n, i) => b(e.key?.[i], v, v, I - 1)),
    velocity: Array.from({ length: I }, (n, i) => i === 0 ? v : b(e.velocity?.[i], v, v, I - 1))
  });
}
function Go(t, e) {
  const n = qo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const te = "articulations.v4", Ge = [
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
], He = [
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
], Ho = [
  ...p.flatMap((t) => Ge.map(
    (e) => `osc${t}.${e}`
  )),
  ...He
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
  return ne(new Mn("malformed", t));
}
function re(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Je(t, e, n) {
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
function ge(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < I;
}
function Jo(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Qo(t) {
  return Ho.some((e) => e === t);
}
function vt(t, e) {
  if (!re(t))
    return h(`${e} must be an object`);
  const n = Je(t, ["min", "max"], e);
  return n !== null ? h(n) : ge(t.min) ? ge(t.max) ? t.min > t.max ? h(`${e}.min must be less than or equal to ${e}.max`) : q({ min: t.min, max: t.max }) : h(`${e}.max must be an integer in 0..127`) : h(`${e}.min must be an integer in 0..127`);
}
function Xo(t, e) {
  if (!re(t))
    return h(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return h(`${e} has a non-string parameter id`);
    if (!Qo(i))
      return h(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return h(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return q(n);
}
function Yo(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Zo() {
  return {};
}
function er(t, e, n) {
  if (!re(t))
    return h(`${e} must be an object`);
  const i = Zo();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return h(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > It)
      return h(
        `${e}.${r} must be a finite route amount within ±${It}`
      );
    if (!n.has(r))
      return h(`${e}.${r} does not name a current articulable mapping`);
    Yo(i, r, o);
  }
  return q(i);
}
function tr(t, e, n) {
  const i = `slots[${e}]`;
  if (!re(t))
    return h(`${i} must be an object`);
  const r = Je(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return h(r);
  if (typeof t.id != "string")
    return h(`${i}.id must be a string`);
  if (!ge(t.runtimeSlot))
    return h(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return h(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return h(`${i}.color must be a string`);
  if (!ge(t.key))
    return h(`${i}.key must be an integer in 0..127`);
  const o = vt(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const s = vt(t.chainRange, `${i}.chainRange`);
  if (s._tag === "err")
    return s;
  const l = Xo(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const a = er(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return a._tag === "err" ? a : q({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: o.value,
    chainRange: s.value,
    overrides: l.value,
    routeAmounts: a.value
  });
}
const nr = Object.fromEntries(
  Ge.map((t, e) => [t, 2 ** e])
), ir = Object.fromEntries(
  He.map((t, e) => [t, 2 ** e])
);
function Rt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function or(t, e) {
  return Ge.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | nr[i] : n, 0);
}
function rr(t) {
  return He.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | ir[n] : e, 0);
}
function sr(t, e) {
  const n = (o, s) => Rt(t, `osc${o}.${s}`), i = (o) => Rt(t, o), r = Array.from(
    { length: hn },
    () => Lo
  );
  for (const [o, s] of Object.entries(t.routeAmounts)) {
    const l = e[o];
    l !== void 0 && (r[l] = s);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: p.map((o) => or(t, o)),
    sharedOverrideMask: rr(t),
    framePositions: p.map((o) => n(o, "framePosition")),
    pans: p.map((o) => n(o, "pan")),
    octaves: p.map((o) => n(o, "octave")),
    semitones: p.map((o) => n(o, "semitone")),
    fineCents: p.map((o) => n(o, "fineCents")),
    phases: p.map((o) => n(o, "phase")),
    phaseRandoms: p.map((o) => n(o, "phaseRandom")),
    retriggers: p.map((o) => n(o, "retrigger")),
    volumeDbs: p.map((o) => n(o, "volumeDb")),
    mutes: p.map((o) => n(o, "mute")),
    solos: p.map((o) => n(o, "solo")),
    warpModes: p.map((o) => n(o, "warpMode")),
    warpAmounts: p.map((o) => n(o, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterQ: i("filterQ"),
    unisonVoices: p.map((o) => n(o, "unisonVoices")),
    unisonDetunes: p.map((o) => n(o, "unisonDetune")),
    unisonBlends: p.map((o) => n(o, "unisonBlend")),
    unisonWidths: p.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: p.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: p.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: p.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: p.map((o) => n(o, "unisonWarpSpread")),
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
function ar(t, e) {
  return t.slots.map((n) => sr(n, e));
}
function lr(t, e) {
  if (!re(t))
    return h("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return h('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ne(new Mn(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Je(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return h(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return h("selectedSlotId must be null or a string");
  if (!Jo(t.activeTriggerMode))
    return h('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return h("slots must be an array");
  if (t.slots.length > I)
    return h(`slots must contain at most ${I} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let s = 0; s < t.slots.length; s += 1) {
    const l = tr(t.slots[s], s, e);
    if (l._tag === "err")
      return l;
    const a = l.value;
    if (r.has(a.id))
      return h(`slots[${s}].id duplicates "${a.id}"`);
    if (o.has(a.runtimeSlot))
      return h(`slots[${s}].runtimeSlot duplicates ${a.runtimeSlot}`);
    r.add(a.id), o.add(a.runtimeSlot), i.push(a);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? h(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : q({
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
function cr(t) {
  const e = Array.from({ length: I }, () => v), n = Array.from({ length: I }, () => v), i = Array.from({ length: I }, () => v);
  for (const r of t.slots) {
    n[r.key] === v && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === v && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === v && (i[o] = r.runtimeSlot);
  }
  return i[0] = v, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Ve = "runtimeState";
function wn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const ur = {
  endpointID: Ve,
  required: !0,
  mapValue: wn
}, Tt = "runtimeInstallAck", dr = "runtimeSyncRequest", At = 0, fr = 8e3, Ie = /* @__PURE__ */ new WeakMap(), kn = 1e9;
let le = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % kn;
function hr(t) {
  return le = le % kn + 1, t === "modulation" ? -1e9 - le : 1e9 + le;
}
function mr(t, e) {
  const n = t, i = Ie.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Ie.set(n, i);
}
function xt(t, e) {
  const n = t, i = Ie.get(n);
  i?.delete(e), i?.size === 0 && Ie.delete(n);
}
const pr = [100, 250, 500, 1e3], ce = { _tag: "accepted" }, gr = { _tag: "superseded" }, Ir = { _tag: "stopped" }, Mt = { _tag: "transport-timeout" };
function Sr(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, r = i.dspSessionId, o = i.acceptedModulationSerial, s = i.acceptedArticulationSerial, l = i.rejectedSerial, a = i.rejectionReason, c = i.syncSerial;
  return ![
    r,
    o,
    s,
    l,
    a,
    c
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof s != "number" || typeof l != "number" || typeof a != "number" || typeof c != "number" || r < 0 || o < 0 || s > 0 || a < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: s,
    rejectedSerial: l,
    rejectionReason: a,
    syncSerial: c
  };
}
function yr(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Et {
  #r;
  #e;
  #d;
  #b;
  #f = !1;
  #t = null;
  #a = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #o = /* @__PURE__ */ new Map();
  #u = 0;
  #i = !1;
  #s = 0;
  #h = /* @__PURE__ */ new Set();
  #v = this.#w.bind(this);
  constructor(e, n) {
    this.#r = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#d = i && i.length > 0 ? i : [...pr], this.#b = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? fr)
    );
  }
  start() {
    if (!this.#i) {
      mr(this.#r, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#a = null, this.#l.clear(), this.#r.addEndpointListener?.(Tt, this.#v);
      } catch (e) {
        throw this.#i = !1, xt(this.#r, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#r.removeEndpointListener?.(Tt, this.#v), xt(this.#r, this.#e), this.#o.clear(), this.#a = null, this.#l.clear(), this.#y());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#a = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#o.clear(), this.#s += 1, this.#y());
  }
  getAcceptedFrontier() {
    return this.#n?.dspSessionId !== this.#t ? 0 : this.#e === "modulation" ? this.#n.acceptedModulationSerial : this.#n.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#n ? { ...this.#n } : null;
  }
  hasSessionBaseline() {
    return this.#t !== null && this.#a === this.#t;
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
    const n = this.#t, i = this.#u;
    try {
      const r = await this.#R(
        n,
        i
      );
      if (r._tag !== "accepted")
        return r;
      let o = null;
      for (const s of e) {
        const l = await this.#E(
          s,
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
      return o ?? ce;
    } finally {
      this.#f = !1;
    }
  }
  #A(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #x(e, n) {
    const i = this.#A(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #M() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #R(e, n) {
    if (this.#a === e)
      return ce;
    const i = hr(this.#e);
    this.#l.add(i);
    const r = Date.now() + this.#b;
    let o = 0;
    try {
      for (; ; ) {
        const s = this.#p(e, n);
        if (s)
          return s;
        if (this.#a === e)
          return ce;
        const l = r - Date.now();
        if (l <= 0)
          return Mt;
        const a = this.#s;
        this.#I(i), await this.#S(
          a,
          Math.min(this.#g(o), l)
        ), o += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #E(e, n, i) {
    const r = this.#M(), o = yr(e.value, n, r);
    let s = 0, l = 0, a = this.#c;
    for (this.#T(e.endpointID, o); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const u = this.#m(n, r, a);
      if (u !== null)
        return u;
      const m = this.#s;
      await this.#S(
        m,
        this.#g(s)
      );
      const g = this.#m(
        n,
        r,
        a
      );
      if (g !== null)
        return g;
      let f = this.#s;
      for (this.#I(r); ; ) {
        const y = this.#p(n, i);
        if (y)
          return y;
        const T = await this.#S(
          f,
          this.#g(s)
        ), k = this.#m(
          n,
          r,
          a
        );
        if (k !== null)
          return k;
        if (T && this.#n?.dspSessionId === n && this.#n.syncSerial === r) {
          if (l >= 1)
            return Mt;
          a = this.#c, this.#T(e.endpointID, o), l += 1, s += 1;
          break;
        }
        if (T) {
          f = this.#s;
          continue;
        }
        T || (s += 1, f = this.#s, this.#I(r));
      }
    }
  }
  #m(e, n, i) {
    const r = this.#n;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#x(r, n) ? (this.#o.delete(n), ce) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Ir : this.#t !== e ? gr : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #T(e, n) {
    try {
      this.#r.sendEventOrValue?.(
        e,
        n,
        void 0,
        At
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          dr,
          e,
          void 0,
          At
        );
      } catch {
      }
  }
  #w(e) {
    const n = Sr(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#n = n, this.#c += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#c
      }); this.#o.size > 16; ) {
        const r = this.#o.keys().next().value;
        if (r === void 0) break;
        this.#o.delete(r);
      }
    this.#s += 1, this.#y();
  }
  #S(e, n) {
    return !this.#i || this.#s !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const o = {
        finish: (s) => {
          r || (r = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#h.delete(o), i(s));
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
const br = 1e3, De = [ee, te];
function wt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function _e(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (wt(i, e)) return i[e];
  if (wt(n, e)) return n[e];
}
function Ce(t, e) {
  if (t === void 0) return En();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = lr(n, e);
  return i._tag === "ok" ? i.value : null;
}
function kt(t) {
  return new Set(t.routes.flatMap((e) => pn(e) === null ? [] : [e.id]));
}
function Ot(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class vr {
  constructor(e) {
    this.connection = e, this.modulationLane = new Et(e, { laneKind: "modulation" }), this.articulationLane = new Et(e, { laneKind: "articulation" });
  }
  modulationState = $e();
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
    { length: I },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Ve, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Ve, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of De) this.connection.requestStoredStateValue(n);
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
    const n = _e(e, ee), i = n === void 0 ? { _tag: "ok", value: $e() } : pt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ee} is invalid; boot state was not installed.`);
      const s = _e(e, te), l = Ce(s, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = _e(e, te), o = Ce(
      r,
      kt(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${te} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !De.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === De.length) {
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
    if (e === ee) {
      const r = pt(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ee}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Ce(n, kt(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${te}.`);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, r = this.lastAppliedModulationGeneration !== e, o = Co(
      n,
      r ? null : this.lastAppliedModulationState
    ), s = await this.modulationLane.sendBatch(o);
    if (!this.acceptOutcome("modulation", s, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = e, this.desiredStateChanged(e, n, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(n, i), a = Array.from({ length: I }, (f, y) => {
      const T = l.get(y);
      return T ? Ot(T) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, u = c && this.articulationLane.getAcceptedFrontier() !== 0, m = [];
    for (let f = 0; f < I; f += 1) {
      const y = l.get(f), T = a[f] !== this.lastAppliedArticulationTokens[f];
      u ? m.push({
        endpointID: Ee,
        value: y ?? yt(f)
      }) : c ? y && m.push({ endpointID: Ee, value: y }) : T && m.push({
        endpointID: Ee,
        value: y ?? yt(f)
      });
    }
    const g = await this.articulationLane.sendBatch(m);
    this.acceptOutcome("articulation", g, a) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = a, Go(
      cr(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = pn(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      ar(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = Ot(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, br));
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
function Rr(t) {
  return new vr(t);
}
const M = "rack.v1", Tr = "rackOrder", Ar = "rackEnable", F = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), On = Object.freeze({
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
  F.map((t) => [On[t], t])
);
function Dn() {
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
function Dt() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...F],
    enabled: Dn()
  };
}
function xr(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${M} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${M} is not valid JSON: ${n}` };
  }
}
function _t(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Mr(t) {
  return typeof t != "string" ? null : F.find((e) => e === t) ?? null;
}
function Er(t) {
  const e = xr(t);
  if (e._tag === "err")
    return e;
  if (!_t(e.value))
    return { _tag: "err", message: `${M} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${M} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${M} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== F.length)
    return { _tag: "err", message: `${M}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const l = Mr(s);
    if (l === null || r.has(l))
      return { _tag: "err", message: `${M}.order is not a complete permutation` };
    r.add(l), i.push(l);
  }
  if (!_t(e.value.enabled))
    return { _tag: "err", message: `${M}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== F.length)
    return { _tag: "err", message: `${M}.enabled must contain every effect once` };
  const o = Dn();
  for (const s of F) {
    const l = e.value.enabled[s];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${M}.enabled.${s} must be boolean` };
    o[s] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: i, enabled: o }
  };
}
function wr(t) {
  if (t === void 0)
    return Dt();
  const e = Er(t);
  return e._tag === "ok" ? e.value : Dt();
}
function kr(t) {
  return [
    {
      endpointID: Tr,
      value: { moduleIds: t.order.map((e) => On[e]) }
    },
    {
      endpointID: Ar,
      value: { enabledFlags: F.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
const Or = 2e3;
function Ct(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Dr(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Ct(i, e) ? {
    found: !0,
    value: i[e]
  } : Ct(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Lt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class _r {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Cr(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Dr(e, this.options.stateKey);
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
    for (const a of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(a))
        return;
      e[a] = this.parameterValues.get(a);
    }
    const n = {};
    for (const a of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(a.endpointID)) {
        if (a.required)
          return;
        continue;
      }
      n[a.endpointID] = this.runtimeEndpointValues.get(a.endpointID);
    }
    const i = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, r = Lt(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, s = this.options.buildRuntimeEvents(i, o), l = Lt({
      runtimeEndpoints: n,
      events: s
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (s.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(s, i).then((a) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        a ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(s);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(s);
        const a = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, a && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const a of s)
      this.connection.sendEventOrValue?.(
        a.endpointID,
        a.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Or
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Cr(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Lr(t, e) {
  return new _r(t, e);
}
function Nr(t) {
  return Lr(t, {
    stateKey: M,
    runtimeEndpointDependencies: [ur],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: wr,
    buildRuntimeEvents: ({ state: e }) => [...kr(e)]
  });
}
const Pr = "runtimeSyncRequest", Fr = 2147483647, Ur = "runtimeState", Br = "retryDesiredTableRequest", $r = "workerLoadFailure", Vr = "serviceLoadAbort", Kr = "wavetableLoadBegin", zr = "wavetableMipFrame", jr = "wavetableUploadAck", Wr = "wavetableMipRequest", qr = "wavetablePrewarmRequest", Gr = "wavetablePrewarmNotification", Hr = "assets/factory-bank-catalog.json", Jr = 1, Qr = 2, Xr = 3, Yr = 1, Zr = 2, es = 2e4, ue = Jr, ts = Qr, Nt = Xr, N = Yr, Pt = Zr, ns = 48 * 1024 * 1024, Le = 3;
function Ft(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function S(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Ut(t) {
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
function Bt(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function $t(t, e) {
  if (!t)
    throw new Error(e);
}
function is(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function os(t, e) {
  return Vn(await t.readJSON(e));
}
function rs(t) {
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
function ss(t, e) {
  const n = Math.round(Number(t) || 0);
  return is(n, 0, Math.max(0, e - 1));
}
function Ne(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function as(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Vt(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Kt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function zt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function ls(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class cs {
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
    this.connection = e, this.resourceClient = $n(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Hr, this.maxFramesInFlight = Ft(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? Gt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ns) || 0)), this.serviceLoadTimeoutMs = Ft(n.serviceLoadTimeoutMs, es), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, S("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Ur, this.handleRuntimeState), this.connection.addEndpointListener?.(jr, this.handleUploadAck), this.connection.addEndpointListener?.(Wr, this.handleMipRequest), this.connection.addEndpointListener?.(qr, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Gr, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Pr,
      Fr
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await os(this.resourceClient, this.catalogPath), S("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Le; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Vt(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Vt(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ne(
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
          ...Kt(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (S("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Nt,
          failureReasonCode: Pt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Nt || e.failureReasonCode !== Pt ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: s = ue,
    failureReasonCode: l = N
  }) {
    this.connection.sendEventOrValue?.($r, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: o,
      failurePhase: s,
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
    this.connection.sendEventOrValue?.(Vr, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    S("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ut(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Br, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = ss(e, i.tables.length), o = i.tables[r];
    $t(o, `Could not resolve table ${r}`);
    const s = as(o, it, this.mipLevelCount), l = this.tableCache.get(s);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, S("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const a = zt();
    S("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), u = qn(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: it
    });
    return S("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(zt() - a)
    }), this.rememberLoadedTable({
      cacheKey: s,
      tableIndex: r,
      tableMeta: o,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    S("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Kr, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    S("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: ue,
      failureReasonCode: N
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: ue,
      failureReasonCode: N
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = ue,
    failureReasonCode: i = N
  } = {}) {
    S("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (S("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Pe(o)
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
    } catch (s) {
      this.isCurrentRuntimeState(e) && (S("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Pe(s)
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
    for (let e = 0; e < Le; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, ls(() => {
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
        S("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
    const n = rs(e ?? {});
    if (S("info", "Received runtime state", Ut(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Le)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, o = this.latestRuntimeStates[r], s = o ? this.getDesiredRetryKey(o) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || s !== l) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let s = 0; s < r.frameCount; s += 1)
          r.spectra[s] || (r.spectra[s] = rt(r.frames[s]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), S("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        S("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Pe(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), s = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || s < 0 || s >= this.mipLevelCount)
      return null;
    const a = Ne(
      n,
      i,
      r,
      o,
      s
    );
    let c = this.mipJobs.get(a);
    return c ? (!c.completed && l > c.urgencyLevel && (c.urgencyLevel = l), c) : (c = {
      key: a,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: o,
      mipIndex: s,
      urgencyLevel: l,
      ...Kt(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(a, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (S("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), s = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), a = Math.trunc(Number(n.frameIndex)), c = Ne(
      i,
      r,
      o,
      s,
      l
    ), u = this.mipJobs.get(c);
    !u || u.completed || !u.inFlightFrames.has(a) || (u.inFlightFrames.delete(a), u.ackedFrames[a] || (u.ackedFrames[a] = 1, u.ackedFrameCount += 1), u.ackedFrameCount === this.serviceTable?.frameCount && u.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && u.inFlightFrames.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), Bt(a, this.serviceTable?.frameCount ?? 0) && S("info", "Acknowledged wavetable mip frame", {
      dspSessionId: i,
      oscillatorIndex: r,
      generation: o,
      tableIndex: u.tableIndex,
      mipIndex: l,
      frameIndex: a,
      ackedFrameCount: u.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if ($t(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = rt(this.serviceTable.frames[e]);
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
        i = Gn(r, e.mipIndex);
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
            failurePhase: ts,
            failureReasonCode: N
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(zr, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndex: n,
        samples: Array.from(i)
      }), Bt(n, this.serviceTable.frameCount) && S("info", "Sent wavetable mip frame", {
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
function Pe(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function us(t, e = {}) {
  return new cs(t, e);
}
async function ds(t, e = {}) {
  return Qn(t, [
    Rr,
    Nr,
    () => us(t, e)
  ]);
}
export {
  Qr as FAILURE_PHASE_BUILD_MIP,
  Jr as FAILURE_PHASE_LOAD_SOURCE,
  Xr as FAILURE_PHASE_TRANSFER_MIP,
  Yr as FAILURE_REASON_GENERIC,
  Zr as FAILURE_REASON_TIMEOUT,
  Fr as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  cs as WavetableWorkerController,
  us as createWavetableWorkerController,
  ds as default
};
