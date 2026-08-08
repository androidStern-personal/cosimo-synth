function v(t, e) {
  if (!t)
    throw new Error(e);
}
function z(t, e, n) {
  let o = "";
  for (let i = 0; i < n; i += 1)
    o += String.fromCharCode(t.getUint8(e + i));
  return o;
}
function ct(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Q(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ue(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const o = Object.keys(t).slice(0, 6), i = o.length > 0 ? ` keys=${o.join(",")}` : "";
  return n ? `${e}:${n}${i}` : `${e}${i}`;
}
function dt() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function $(t, e) {
  const n = dt();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (ct(e))
      return new URL(e);
    const o = e.startsWith("/") ? e.slice(1) : e;
    return new URL(o, n);
  }
  return new URL(t, n);
}
async function de(t) {
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
  throw new Error(`Unsupported text resource payload (${Ue(t)})`);
}
function ut(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Q(t);
  throw new Error(`Unsupported binary resource payload (${Ue(t)})`);
}
function ht(t) {
  const e = t?.frames;
  v(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), o = new Float32Array(n.length);
  for (let i = 0; i < n.length; i += 1) {
    const r = n[i];
    if (typeof r == "number") {
      o[i] = r;
      continue;
    }
    if (ArrayBuffer.isView(r) || Array.isArray(r)) {
      const a = r;
      v(a.length === 1, "Only mono wavetable source files are supported"), o[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: o
  };
}
function Be(t) {
  const e = new DataView(t);
  v(z(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), v(z(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, o = null, i = null, r = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const h = z(e, c, 4), u = e.getUint32(c + 4, !0), p = c + 8;
    h === "fmt " ? (n = e.getUint16(p, !0), o = e.getUint16(p + 2, !0), i = e.getUint32(p + 4, !0), a = e.getUint16(p + 12, !0), r = e.getUint16(p + 14, !0)) : h === "data" && (l = p, s = u), c = p + u + u % 2;
  }
  v(n !== null, "Wave file is missing a fmt chunk"), v(l !== null && s !== null, "Wave file is missing a data chunk"), v(o === 1, "Only mono wavetable bank files are supported");
  let m;
  if (n === 3 && r === 32)
    m = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const h = s / 2, u = new Int16Array(t.slice(l, l + s));
    m = new Float32Array(h);
    for (let p = 0; p < h; p += 1)
      m[p] = u[p] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: o,
    sampleRate: i ?? 0,
    bitsPerSample: r,
    blockAlign: a ?? 0,
    samples: m
  };
}
async function ue(t) {
  v(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return v(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function X(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Ve(t) {
  const e = new Uint8Array(t).buffer, n = Be(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function ft(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const o = async (s) => (v(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), i = async (s) => {
    v(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return ht(c);
  }, r = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const m = $(s, c), h = await ue(m), u = Be(h);
    return {
      sampleRate: u.sampleRate,
      samples: u.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const m = $(s, c);
    return new Uint8Array(await ue(m));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return de(await o(s));
      const c = r(s);
      return e === "url" && c !== null ? X(await l(s, c)) : typeof t.readResource == "function" ? de(await o(s)) : X(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? ut(await o(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return i(s);
      const c = r(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? i(s) : Ve(await this.readBytes(s));
    },
    getURL(s) {
      return $(s, t.getResourceAddress?.(s));
    }
  };
}
function mt(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return ft(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function pt(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, o = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, i = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (o)
        return X(await o(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (o)
        return o(a);
      if (e)
        return Q(await e(a));
      if (n)
        return Q(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Ve(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function gt(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function bt(t) {
  return gt(t) ? pt(t) : mt(t);
}
const he = 2048;
function N(t, e) {
  if (!t)
    throw new Error(e);
}
function St(t) {
  N(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, o) => {
    N(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${o} must provide tableId`
    ), N(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${o} must provide name`
    ), N(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${o} must provide a positive frameCount`
    ), N(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${o} must provide sourceWav`
    );
  }), e;
}
const yt = 2048, We = 11, It = 256;
function M(t, e) {
  if (!t)
    throw new Error(e);
}
function vt(t) {
  return t > 0 && (t & t - 1) === 0;
}
const fe = /* @__PURE__ */ new Map();
function Tt(t) {
  const e = fe.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), o = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let r = 0, a = i;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | a & 1, a >>= 1;
    o[i] = r;
  }
  return fe.set(t, o), o;
}
function ze(t, e, n = !1) {
  const o = t.length;
  M(o === e.length, "FFT real and imaginary buffers must have the same length"), M(vt(o), "FFT input length must be a power of two");
  const i = Tt(o);
  for (let r = 0; r < o; r += 1) {
    const a = i[r];
    if (a <= r)
      continue;
    const l = t[r];
    t[r] = t[a], t[a] = l;
    const s = e[r];
    e[r] = e[a], e[a] = s;
  }
  for (let r = 2; r <= o; r <<= 1) {
    const a = r >> 1, l = (n ? 2 : -2) * Math.PI / r, s = Math.cos(l), c = Math.sin(l);
    for (let m = 0; m < o; m += r) {
      let h = 1, u = 0;
      for (let p = 0; p < a; p += 1) {
        const L = m + p, O = L + a, ie = t[O], re = e[O], ae = h * ie - u * re, se = h * re + u * ie, le = t[L], ce = e[L];
        t[L] = le + ae, e[L] = ce + se, t[O] = le - ae, e[O] = ce - se;
        const lt = h * s - u * c;
        u = h * c + u * s, h = lt;
      }
    }
  }
  if (n)
    for (let r = 0; r < o; r += 1)
      t[r] /= o, e[r] /= o;
}
function $e(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const o = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    i[r] = (Number(e[r]) || 0) - o;
  return i;
}
function Mt(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = yt,
  maxFramesPerTable: o = It
} = {}) {
  const i = Float32Array.from(t);
  M(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = i.length / n;
  M(r > 0, "Source wavetable files must contain at least one frame"), M(r <= o, `Source wavetable files must contain at most ${o} frames`), e !== void 0 && M(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, c = s + n;
    a.push($e(i.slice(s, c)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function me(t) {
  const e = $e(t), n = Float64Array.from(e), o = new Float64Array(n.length);
  return ze(n, o, !1), n[0] = 0, o[0] = 0, {
    real: n,
    imaginary: o
  };
}
function At(t, e, {
  mipLevelCount: n = We
} = {}) {
  const o = t?.real?.length ?? 0;
  M(o > 0, "Spectrum must contain real samples"), M(o === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), M(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, o >> 1), r = new Float64Array(o), a = new Float64Array(o);
  for (let l = 1; l <= i; l += 1) {
    r[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (o - l) % o;
    s !== l && (r[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return ze(r, a, !0), Float32Array.from(r);
}
class Rt {
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
        for (const o of [...this.services].reverse())
          try {
            await o.stop?.();
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
function xt(t, e) {
  return new Rt(t, e);
}
async function wt(t, e) {
  const n = xt(t, e);
  return await n.start(), n;
}
const S = (t, e) => ({ label: t, value: e });
function A(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const R = Object.freeze({
  filter: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: A(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), d = (t, e, n, o, i, r, a, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: o,
  min: i,
  max: r,
  initial: a,
  step: l.step ?? (r - i) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear")
}), Et = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Dt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Ft = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: R.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(S), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: R.drive,
    initialQuickEndpointID: "distortionDriveDb",
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [S("Classic", 0), S("Harmonics", 1)] }),
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
    iconUrl: R.ott,
    initialQuickEndpointID: "ottAmount",
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
    iconUrl: R.chorus,
    initialQuickEndpointID: "chorusMix",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(S) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(S) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(S) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: R.flanger,
    initialQuickEndpointID: "flangerRate",
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
    iconUrl: R.phaser,
    initialQuickEndpointID: "phaserRate",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [S("Free", 0), S("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Et.map(S) }),
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
    iconUrl: R.delay,
    initialQuickEndpointID: "delayTime",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [S("Free", 0), S("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Dt.map(S) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: R.reverb,
    initialQuickEndpointID: "reverbSize",
    parameters: [
      d("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      d("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      d("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      d("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], _t = Ft, Ke = Object.freeze(
  _t.flatMap((t) => t.parameters)
);
new Map(
  Ke.map((t) => [t.endpointID, t])
);
function Ct() {
  return Ke;
}
const x = 2048, Lt = x + 3, pe = 20, Ge = "MSEG 1", Nt = 0, kt = 2, Ot = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function te(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function _(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Pt(t) {
  return te(Number.isFinite(t) ? t : 0, -pe, pe);
}
function w(t) {
  return te(Number.isFinite(t) ? t : 0, 0, 1);
}
function He(t = Ge) {
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
function qe() {
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
function je(t) {
  const e = Number(t);
  return te(
    Number.isFinite(e) ? e : 1,
    Nt,
    kt
  );
}
function Ut(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = w(Number(e.startX)), o = w(Number(e.endX));
  return _(n, o) ? null : o < n ? {
    startX: o,
    endX: n
  } : { startX: n, endX: o };
}
function Bt(t = qe()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, o = Number(n.seconds), i = e.noteOffPolicy, r = Ot.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: je(Number.isFinite(o) ? o : 1)
    },
    loop: Ut(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Vt(t, e, n) {
  const o = t && typeof t == "object" ? t : {};
  let i = Number(o.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = w(i)), {
    x: i,
    y: w(Number(o.y)),
    curvePower: Pt(Number(o.curvePower))
  };
}
function B(t = He()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const o = n.map((i, r) => Vt(i, r, n.length));
  if (!_(o[0].x, 0) || !_(o[o.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < o.length; i += 1)
    if (o[i].x < o[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Ge,
    globalSmooth: !!e.globalSmooth,
    points: o
  };
}
function Wt(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, o = Math.exp(e) - 1;
  return n / o;
}
function zt(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const o = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: o, to: i, laterPointWins: !1 };
    if (_(e, i.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && _(t[r + 1].x, e); )
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
function $t(t, e) {
  const n = w(Number(e)), o = zt(t, n);
  if (o.laterPointWins || _(o.from.x, o.to.x))
    return o.to.y;
  const i = o.to.x - o.from.x, r = i <= 0 ? 1 : (n - o.from.x) / i, a = w(Wt(r, o.from.curvePower));
  return o.from.y + (o.to.y - o.from.y) * a;
}
function Kt(t, e) {
  return $t(B(t).points, e);
}
function Gt(t) {
  const e = B(t), n = new Float32Array(x);
  for (let i = 0; i < x; i += 1) {
    const r = i / (x - 1);
    n[i] = Kt(e, r);
  }
  const o = new Float32Array(Lt);
  return o[0] = n[0], o.set(n, 1), o[x + 1] = n[x - 1], o[x + 2] = n[x - 1], o;
}
const U = "modulation.v2", k = 12, C = 3, y = 3, Ht = "modulationClear", ge = "modulationEnable", be = "modulationMsegBuffer", qt = "modulationMsegPlayback", jt = "modulationEnvelope", Jt = "modulationRoute", Qt = "rackModulationRoute", Xt = 100, Yt = 0, Zt = 1, en = 2, tn = 1, nn = 2, on = 3, rn = 4, an = 5, sn = 6, Je = 4, ln = 0, cn = 1, dn = 1, un = 2, hn = 3, fn = 4, mn = 5, pn = 6, gn = 7, bn = 8, Sn = 9, yn = 10, In = 11, vn = 12, Tn = ["MSEG 1", "MSEG 2", "MSEG 3"], Qe = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Mn = ["Env 1", "Env 2", "Env 3"], An = 1e-3, Rn = 10, xn = 0.1, wn = 20, En = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: wn - xn },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 }
}, Xe = Ct().filter((t) => t.modulationTargetIndex !== null), V = new Map(
  Xe.map((t) => [`rack.${t.endpointID}`, t])
);
[
  ...Xe.map((t) => ({
    value: `rack.${t.endpointID}`,
    label: `${t.effectId.toUpperCase()} ${t.shortLabel.toUpperCase()}`
  }))
];
let Se = 1;
function ne(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function K(t, e) {
  const n = Number(t);
  return ne(Number.isFinite(n) ? n : e, An, Rn);
}
function ye(t) {
  return V.has(t);
}
function Dn(t) {
  return t !== "macro";
}
function Fn(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function _n(t) {
  const e = V.get(t);
  return e !== void 0 ? Fn(e) : En[t];
}
function Cn() {
  const t = `mod-route-auto-${Se}`;
  return Se += 1, t;
}
function Ln(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Nn(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function kn(t) {
  return t === "bipolar" ? cn : ln;
}
function Ye(t, e) {
  const n = _n(t), o = Number(e);
  return ne(Number.isFinite(o) ? o : 0, n.min, n.max);
}
function On(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : "mseg";
}
function Pn(t) {
  return typeof t == "string" && V.has(t) || t === "wavetablePosition" || t === "warpAmount" || t === "filterCutoffOctaves" || t === "filterQ" || t === "pitchSemitones" || t === "ampGainDb" || t === "pan" || t === "unisonDetune" || t === "unisonBlend" || t === "unisonWidth" || t === "unisonWavetablePositionSpread" || t === "unisonWarpSpread" ? t : "wavetablePosition";
}
function Un(t, e) {
  const n = Qe[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Bn(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const o = t === "mseg" ? C : t === "macro" ? Je : y;
  return ne(Number.isFinite(n) ? n : 1, 1, o);
}
function T(t) {
  return {
    name: Mn[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ze(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, o = T(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : o.name,
    attackSeconds: K(n.attackSeconds ?? o.attackSeconds, o.attackSeconds),
    decaySeconds: K(n.decaySeconds ?? o.decaySeconds, o.decaySeconds),
    sustain: w(n.sustain ?? o.sustain),
    releaseSeconds: K(n.releaseSeconds ?? o.releaseSeconds, o.releaseSeconds)
  };
}
function Ie(t = {}) {
  return {
    id: t.id ?? Cn(),
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
function W(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, o = On(n.sourceKind), i = Pn(n.targetKind), r = Number(n.amount);
  return {
    id: Ln(n.id, e),
    enabled: n.enabled !== !1,
    sourceKind: o,
    sourceSlot: Bn(o, n.sourceSlot),
    polarity: Nn(n.polarity),
    targetKind: i,
    amount: Ye(i, r),
    reducer: n.reducer === "mean" ? "mean" : "max"
  };
}
function et(t, e) {
  const n = t && typeof t == "object" ? t : {}, o = He(Tn[e] ?? `MSEG ${e + 1}`), i = B(n.shapeA ?? o);
  return {
    shapeA: i,
    shapeB: B(n.shapeB ?? i),
    morph: w(n.morph ?? 0),
    playback: Bt(n.playback ?? qe())
  };
}
function Y() {
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: C }, (t, e) => et({}, e)),
    envelopeSlots: Array.from({ length: y }, (t, e) => T(e)),
    routes: [
      Ie({ id: "mod-route-1", amount: 1 }),
      Ie({
        id: "mod-route-2",
        targetKind: "filterCutoffOctaves",
        amount: 4
      })
    ],
    macroNames: Qe.slice()
  };
}
function Vn(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}:${t.targetKind}`;
}
function Wn(t) {
  const e = /* @__PURE__ */ new Set(), n = [];
  for (const o of t) {
    const i = W(o, n.length), r = Vn(i);
    if (!e.has(r) && (e.add(r), n.push(i), n.length >= k))
      break;
  }
  return n;
}
function tt(t = Y()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], o = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.routes) ? e.routes : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: C }, (a, l) => et(n[l], l)),
    envelopeSlots: Array.from({ length: y }, (a, l) => Ze(o[l], l)),
    routes: Wn(i),
    macroNames: Array.from(
      { length: Je },
      (a, l) => Un(r[l], l)
    )
  };
}
function Z(t) {
  if (typeof t != "string" || t.trim() === "")
    return Y();
  try {
    return tt(JSON.parse(t));
  } catch {
    return Y();
  }
}
function zn(t) {
  return t === "mseg" ? tn : t === "env" ? nn : t === "velocity" ? on : t === "pressure" ? rn : t === "slide" ? an : sn;
}
function $n(t) {
  const e = V.get(t);
  return e?.modulationTargetIndex !== null && e?.modulationTargetIndex !== void 0 ? Xt + e.modulationTargetIndex : t === "wavetablePosition" ? dn : t === "warpAmount" ? un : t === "filterCutoffOctaves" ? hn : t === "filterQ" ? fn : t === "pitchSemitones" ? mn : t === "ampGainDb" ? pn : t === "unisonDetune" ? bn : t === "unisonBlend" ? Sn : t === "unisonWidth" ? yn : t === "unisonWavetablePositionSpread" ? In : t === "unisonWarpSpread" ? vn : gn;
}
function Kn(t, e) {
  return {
    slot: t + 1,
    seconds: je(e.rate.seconds),
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function ve(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Gt(n))
  };
}
function Gn(t, e) {
  return {
    slot: t + 1,
    attackSeconds: e.attackSeconds,
    decaySeconds: e.decaySeconds,
    sustain: e.sustain,
    releaseSeconds: e.releaseSeconds
  };
}
function nt(t, e) {
  const n = e ? W(e) : null, o = n?.enabled ?? !1;
  return {
    routeIndex: t,
    enabled: o,
    sourceKind: zn(n?.sourceKind ?? "mseg"),
    sourceSlot: o ? n?.sourceSlot ?? 0 : 0,
    polarityKind: kn(n?.polarity ?? "unipolar"),
    targetKind: $n(n?.targetKind ?? "wavetablePosition"),
    amount: o ? n?.amount ?? 0 : 0
  };
}
function Hn(t, e) {
  const n = W(e);
  return {
    ...nt(t, n),
    reducerKind: Dn(n.sourceKind) ? n.reducer === "mean" ? en : Zt : Yt
  };
}
function qn(t) {
  const e = tt(t), n = [
    { endpointID: ge, value: 0 },
    { endpointID: Ht, value: 1 }
  ];
  for (let o = 0; o < C; o += 1) {
    const i = e.msegSlots[o];
    n.push({
      endpointID: be,
      value: ve(o, 0, i.shapeA)
    }), n.push({
      endpointID: be,
      value: ve(o, 1, i.shapeB)
    }), n.push({
      endpointID: qt,
      value: Kn(o, i.playback)
    });
  }
  for (let o = 0; o < y; o += 1)
    n.push({
      endpointID: jt,
      value: Gn(o, e.envelopeSlots[o])
    });
  for (let o = 0; o < k; o += 1) {
    const i = e.routes[o] ?? null;
    n.push({
      endpointID: i !== null && ye(i.targetKind) ? Qt : Jt,
      value: i !== null && ye(i.targetKind) ? Hn(o, i) : nt(o, i)
    });
  }
  return n.push({ endpointID: ge, value: 1 }), n;
}
const G = "articulations.v2", jn = "articulationSnapshot", F = 128, H = [
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
function oe(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function q(t) {
  return oe(Number.isFinite(t) ? t : 0, 0, 1);
}
function f(t, e, n = -Number.MAX_VALUE, o = Number.MAX_VALUE) {
  const i = Number(t);
  return oe(Number.isFinite(i) ? i : e, n, o);
}
function b(t, e, n, o) {
  return oe(Math.round(f(t, e)), n, o);
}
function Jn(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Qn(t) {
  const e = b(t, 0, 0, F - 1), n = H[e % H.length], o = Math.floor(e / H.length);
  return o === 0 ? n : `${n} ${o + 1}`;
}
function Xn() {
  return {
    wavetablePosition: 0,
    playMode: 0,
    glideTime: 0,
    pan: 0,
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
    msegMorphs: [0, 0, 0],
    distortionMode: 0,
    distortionDriveDb: 12,
    distortionKnee: 0.35,
    distortionWet: 0,
    distortionWetHPHz: 40,
    distortionWetLPHz: 18e3,
    chorusMix: 0,
    chorusMotionMode: 1,
    chorusBloomMode: 0,
    chorusTone: 0.5,
    chorusFeedback: 0.42,
    chorusRingAmount: 0,
    chorusRingOffsetMode: 0,
    chorusRingFineSemitones: 0
  };
}
function Yn(t) {
  const e = Xn(), n = t && typeof t == "object" ? t : {}, o = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: f(n.wavetablePosition, e.wavetablePosition, 0, 1),
    playMode: b(n.playMode, e.playMode, 0, 2),
    glideTime: f(n.glideTime, e.glideTime, 0, 2),
    pan: f(n.pan, e.pan, -1, 1),
    warpMode: b(n.warpMode, e.warpMode, 0, 4),
    warpAmount: f(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: b(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: f(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterQ: f(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: b(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: f(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: f(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: f(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: f(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: f(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: b(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: b(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: b(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: f(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: f(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      q(Number(o[0])),
      q(Number(o[1])),
      q(Number(o[2]))
    ],
    distortionMode: b(n.distortionMode, e.distortionMode, 0, 1),
    distortionDriveDb: f(n.distortionDriveDb, e.distortionDriveDb, 0, 36),
    distortionKnee: f(n.distortionKnee, e.distortionKnee, 0, 1),
    distortionWet: f(n.distortionWet, e.distortionWet, 0, 1),
    distortionWetHPHz: f(n.distortionWetHPHz, e.distortionWetHPHz, 20, 4e3),
    distortionWetLPHz: f(n.distortionWetLPHz, e.distortionWetLPHz, 20, 2e4),
    chorusMix: f(n.chorusMix, e.chorusMix, 0, 1),
    chorusMotionMode: b(n.chorusMotionMode, e.chorusMotionMode, 0, 3),
    chorusBloomMode: b(n.chorusBloomMode, e.chorusBloomMode, 0, 4),
    chorusTone: f(n.chorusTone, e.chorusTone, 0, 1),
    chorusFeedback: f(n.chorusFeedback, e.chorusFeedback, 0, 0.95),
    chorusRingAmount: f(n.chorusRingAmount, e.chorusRingAmount, 0, 1),
    chorusRingOffsetMode: b(n.chorusRingOffsetMode, e.chorusRingOffsetMode, 0, 3),
    chorusRingFineSemitones: f(n.chorusRingFineSemitones, e.chorusRingFineSemitones, -2, 2)
  };
}
function Zn(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: f(e.amount, 0, -48, 48)
  } : null;
}
function ot(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Zn).filter((i) => i !== null) : [], o = /* @__PURE__ */ new Map();
  for (const i of n)
    o.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Yn(e.parameters),
    envelopes: [0, 1, 2].map((i) => Ze(
      Array.isArray(e.envelopes) ? e.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...o.values()]
  };
}
function eo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, o = b(n.runtimeSlot, e, 0, F - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${o}`, r = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Qn(o);
  return {
    id: i,
    runtimeSlot: o,
    name: r,
    snapshot: ot(n.snapshot)
  };
}
function to(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, o = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(o) ? {
    note: b(n.note, 0, 0, F - 1),
    articulationId: o
  } : null;
}
function no(t, e, n, o, i) {
  if (!t || typeof t != "object")
    return null;
  const r = t, a = typeof r.articulationId == "string" ? r.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let l = b(r.min, i, i, F - 1), s = b(r.max, l, i, F - 1);
  return s < l && ([l, s] = [s, l]), {
    id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `${o}-${n}`,
    articulationId: a,
    min: l,
    max: s
  };
}
function Te(t, e, n, o) {
  const i = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < i.length; l += 1) {
    const s = no(
      i[l],
      e,
      l,
      n,
      o
    );
    !s || r.has(s.id) || (r.add(s.id), a.push(s));
  }
  return a;
}
function oo(t, e) {
  const n = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), i = [];
  for (const r of n) {
    const a = to(r, e);
    !a || o.has(a.note) || (o.add(a.note), i.push(a));
  }
  return i;
}
function ee(t) {
  let e = t;
  if (typeof e == "string" && e.trim())
    try {
      e = JSON.parse(e);
    } catch {
      e = null;
    }
  const n = e && typeof e == "object" ? e : {}, o = Array.isArray(n.slots) ? n.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), a = [];
  for (let c = 0; c < o.length && a.length < F; c += 1) {
    const m = eo(o[c], c);
    !m || i.has(m.runtimeSlot) || r.has(m.id) || (i.add(m.runtimeSlot), r.add(m.id), a.push(m));
  }
  const l = typeof n.selectedSlotId == "string" && a.some((c) => c.id === n.selectedSlotId) ? n.selectedSlotId : null, s = new Set(a.map((c) => c.id));
  return {
    format: "cosimo.articulations",
    version: 2,
    selectedSlotId: l,
    activeTriggerMode: Jn(n.activeTriggerMode),
    slots: a,
    chainAssignments: Te(n.chainAssignments, s, "chain", 0),
    keyAssignments: oo(n.keyAssignments, s),
    velocityAssignments: Te(n.velocityAssignments, s, "velocity", 1)
  };
}
function io(t) {
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
    msegMorphs: Array.from({ length: C }, () => 0),
    routeAmounts: Array.from({ length: k }, () => 0),
    envelopeAttackSeconds: Array.from({ length: y }, (e, n) => T(n).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: y }, (e, n) => T(n).decaySeconds),
    envelopeSustain: Array.from({ length: y }, (e, n) => T(n).sustain),
    envelopeReleaseSeconds: Array.from({ length: y }, (e, n) => T(n).releaseSeconds)
  };
}
function ro(t) {
  return Array.isArray(t) ? t.slice(0, k).map((e, n) => W(e, n)) : [];
}
function ao(t, e = []) {
  const n = ee(t), o = ro(e), i = new Map(n.slots.map((r) => [r.runtimeSlot, r]));
  return Array.from({ length: F }, (r, a) => {
    const l = i.get(a);
    if (!l)
      return io(a);
    const s = ot(l.snapshot), c = s.parameters, m = new Map(s.modRouteAmounts.map((h) => [
      h.routeId,
      h.amount
    ]));
    return {
      selectorA: a,
      enabled: !0,
      framePosition: c.wavetablePosition,
      pan: c.pan,
      warpMode: c.warpMode,
      warpAmount: c.warpAmount,
      filterMode: c.filterMode,
      filterCutoffHz: c.filterCutoff,
      filterQ: c.filterQ,
      unisonVoices: c.unisonVoices,
      unisonDetune: c.unisonDetune,
      unisonBlend: c.unisonBlend,
      unisonWidth: c.unisonWidth,
      unisonPhase: c.unisonPhase,
      unisonRandom: c.unisonRandom,
      unisonPhaseMode: c.unisonPhaseMode,
      unisonDetuneMode: c.unisonDetuneMode,
      unisonStackMode: c.unisonStackMode,
      unisonWavetablePositionSpread: c.unisonWavetablePositionSpread,
      unisonWarpSpread: c.unisonWarpSpread,
      msegMorphs: Array.from({ length: C }, (h, u) => c.msegMorphs[u] ?? 0),
      routeAmounts: Array.from({ length: k }, (h, u) => {
        const p = o[u];
        return p ? m.has(p.id) ? Ye(
          p.targetKind,
          Number(m.get(p.id))
        ) : p.amount : 0;
      }),
      envelopeAttackSeconds: Array.from({ length: y }, (h, u) => s.envelopes[u]?.attackSeconds ?? T(u).attackSeconds),
      envelopeDecaySeconds: Array.from({ length: y }, (h, u) => s.envelopes[u]?.decaySeconds ?? T(u).decaySeconds),
      envelopeSustain: Array.from({ length: y }, (h, u) => s.envelopes[u]?.sustain ?? T(u).sustain),
      envelopeReleaseSeconds: Array.from({ length: y }, (h, u) => s.envelopes[u]?.releaseSeconds ?? T(u).releaseSeconds)
    };
  });
}
const Me = "runtimeState";
function Ae(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Re(t, e) {
  const n = t && typeof t == "object" ? t : {}, o = n.values && typeof n.values == "object" ? n.values : {};
  if (Ae(o, e))
    return o[e];
  if (Ae(n, e))
    return n[e];
}
function so(t) {
  return !t || typeof t != "object" ? 0 : Math.trunc(Number(t.dspSessionId) || 0);
}
function lo(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class co {
  constructor(e) {
    this.connection = e;
  }
  articulationBank = ee(void 0);
  modulationState = Z(void 0);
  hasArticulationState = !1;
  hasModulationState = !1;
  hasRuntimeState = !1;
  runtimeDspSessionId = 0;
  started = !1;
  lastAppliedToken = null;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Me, this.handleRuntimeStateBound), this.requestBootState());
  }
  stop() {
    this.started && (this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Me, this.handleRuntimeStateBound));
  }
  requestBootState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((e) => {
        this.applyArticulationState(Re(e, G)), this.applyModulationState(Re(e, U));
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.connection.requestStoredStateValue(G), this.connection.requestStoredStateValue(U);
      return;
    }
    this.applyArticulationState(void 0), this.applyModulationState(void 0);
  }
  handleStoredStateValue(e) {
    if (!e || typeof e != "object")
      return;
    const n = e;
    if (n.key === G) {
      this.applyArticulationState(n.value);
      return;
    }
    n.key === U && this.applyModulationState(n.value);
  }
  handleRuntimeState(e) {
    this.runtimeDspSessionId = so(e), this.hasRuntimeState = !0, this.applyRuntimeStateIfReady();
  }
  applyArticulationState(e) {
    this.articulationBank = ee(e), this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  applyModulationState(e) {
    this.modulationState = Z(e), this.hasModulationState = !0, this.applyRuntimeStateIfReady();
  }
  applyRuntimeStateIfReady() {
    if (!this.hasArticulationState || !this.hasModulationState || !this.hasRuntimeState)
      return;
    const e = ao(this.articulationBank, this.modulationState.routes), n = lo({
      runtimeDspSessionId: this.runtimeDspSessionId,
      uploads: e
    });
    if (n !== this.lastAppliedToken) {
      for (const o of e)
        this.connection.sendEventOrValue?.(jn, o);
      this.lastAppliedToken = n;
    }
  }
}
function uo(t) {
  return new co(t);
}
const ho = "runtimeState";
function fo(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const it = {
  endpointID: ho,
  required: !0,
  mapValue: fo
};
function xe(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function mo(t, e) {
  const n = t && typeof t == "object" ? t : {}, o = n.values && typeof n.values == "object" ? n.values : {};
  return xe(o, e) ? {
    found: !0,
    value: o[e]
  } : xe(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function po(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class go {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
  parameterValues = /* @__PURE__ */ new Map();
  parameterListeners = /* @__PURE__ */ new Map();
  runtimeEndpointValues = /* @__PURE__ */ new Map();
  runtimeEndpointListeners = /* @__PURE__ */ new Map();
  state = null;
  hasState = !1;
  started = !1;
  lastAppliedToken = null;
  constructor(e, n) {
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = bo(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((e) => {
        const n = mo(e, this.options.stateKey);
        if (n.found) {
          this.applyStoredValue(n.value);
          return;
        }
        this.handleMissingStoredState();
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.connection.requestStoredStateValue(this.options.stateKey);
      return;
    }
    this.handleMissingStoredState();
  }
  handleMissingStoredState() {
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
    const o = (i) => {
      this.parameterValues.set(e, i), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, o), o;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const o = (i) => {
      const r = e.mapValue ? e.mapValue(i) : i;
      this.runtimeEndpointValues.set(e.endpointID, r), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(e.endpointID, o), o;
  }
  applyStoredValue(e) {
    this.state = this.options.deserializeStoredState(e), this.hasState = !0, this.applyRuntimeStateIfReady();
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState)
      return;
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
    const o = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, i = this.options.buildRuntimeEvents(o), r = po({
      runtimeEndpoints: n,
      events: i
    });
    if (r !== this.lastAppliedToken) {
      for (const a of i)
        this.connection.sendEventOrValue?.(a.endpointID, a.value);
      this.lastAppliedToken = r;
    }
  }
}
function bo(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function rt(t, e) {
  return new go(t, e);
}
function So(t) {
  return rt(t, {
    stateKey: U,
    runtimeEndpointDependencies: [it],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Z,
    buildRuntimeEvents: ({ state: e }) => qn(e)
  });
}
const I = "rack.v1", yo = "rackOrder", Io = "rackEnable", D = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), at = Object.freeze({
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
  D.map((t) => [at[t], t])
);
function st() {
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
function we() {
  return {
    format: "cosimo.rack",
    version: 1,
    order: [...D],
    enabled: st()
  };
}
function vo(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${I} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${I} is not valid JSON: ${n}` };
  }
}
function Ee(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function To(t) {
  return typeof t != "string" ? null : D.find((e) => e === t) ?? null;
}
function Mo(t) {
  const e = vo(t);
  if (e._tag === "err")
    return e;
  if (!Ee(e.value))
    return { _tag: "err", message: `${I} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled"]);
  for (const a of Reflect.ownKeys(e.value))
    if (typeof a != "string" || !n.has(a))
      return { _tag: "err", message: `${I} has unexpected field ${String(a)}` };
  if (e.value.format !== "cosimo.rack" || e.value.version !== 1)
    return { _tag: "err", message: `${I} must be cosimo.rack version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== D.length)
    return { _tag: "err", message: `${I}.order must contain every effect once` };
  const o = [], i = /* @__PURE__ */ new Set();
  for (const a of e.value.order) {
    const l = To(a);
    if (l === null || i.has(l))
      return { _tag: "err", message: `${I}.order is not a complete permutation` };
    i.add(l), o.push(l);
  }
  if (!Ee(e.value.enabled))
    return { _tag: "err", message: `${I}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== D.length)
    return { _tag: "err", message: `${I}.enabled must contain every effect once` };
  const r = st();
  for (const a of D) {
    const l = e.value.enabled[a];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${I}.enabled.${a} must be boolean` };
    r[a] = l;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.rack", version: 1, order: o, enabled: r }
  };
}
function Ao(t) {
  if (t === void 0)
    return we();
  const e = Mo(t);
  return e._tag === "ok" ? e.value : we();
}
function Ro(t) {
  return [
    {
      endpointID: yo,
      value: { moduleIds: t.order.map((e) => at[e]) }
    },
    {
      endpointID: Io,
      value: { enabledFlags: D.map((e) => t.enabled[e] ? 1 : 0) }
    }
  ];
}
function xo(t) {
  return rt(t, {
    stateKey: I,
    runtimeEndpointDependencies: [it],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Ao,
    buildRuntimeEvents: ({ state: e }) => [...Ro(e)]
  });
}
const wo = "runtimeSyncRequest", Eo = "runtimeState", Do = "retryDesiredTableRequest", Fo = "workerLoadFailure", _o = "serviceLoadAbort", Co = "wavetableLoadBegin", Lo = "wavetableMipFrame", No = "wavetableUploadAck", ko = "wavetableMipRequest", Oo = "wavetablePrewarmRequest", Po = "wavetablePrewarmNotification", Uo = "assets/factory-bank-catalog.json", Bo = 1, Vo = 2, Wo = 3, zo = 1, $o = 2, Ko = 2e4, P = Bo, Go = Vo, De = Wo, E = zo, Fe = $o, Ho = 48 * 1024 * 1024;
function _e(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function g(t, e, n = null) {
  const o = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (o) {
    if (n && Object.keys(n).length > 0) {
      o(`[wavetable-worker] ${e}`, n);
      return;
    }
    o(`[wavetable-worker] ${e}`);
  }
}
function Ce(t) {
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
function Le(t, e) {
  const n = t + 1;
  return n === 1 || n === e || n % 16 === 0;
}
function Ne(t, e) {
  if (!t)
    throw new Error(e);
}
function qo(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function jo(t, e) {
  return St(await t.readJSON(e));
}
function Jo(t) {
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
function Qo(t, e) {
  const n = Math.round(Number(t) || 0);
  return qo(n, 0, Math.max(0, e - 1));
}
function j(t, e, n) {
  return `${t}:${e}:${n}`;
}
function Xo(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function ke(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Oe(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function Pe() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
class Yo {
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
    this.connection = e, this.resourceClient = bt(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Uo, this.maxFramesInFlight = _e(n.maxFramesInFlight, 1), this.mipLevelCount = n.mipLevelCount ?? We, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Ho) || 0)), this.serviceLoadTimeoutMs = _e(n.serviceLoadTimeoutMs, Ko), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, g("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Eo, this.handleRuntimeState), this.connection.addEndpointListener?.(No, this.handleUploadAck), this.connection.addEndpointListener?.(ko, this.handleMipRequest), this.connection.addEndpointListener?.(Oo, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Po, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(wo, 1), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await jo(this.resourceClient, this.catalogPath), g("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = ke(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      let n = null, o = null;
      for (const [i, r] of this.tableCache)
        e.has(i) || (!o || r.lastUsedSerial < o.lastUsedSerial) && (n = i, o = r);
      if (!n || !o)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= o.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const o = {
      ...e,
      byteCount: ke(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(o.cacheKey, o), this.tableCacheBytes += o.byteCount, this.evictCacheIfNeeded(), o;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const o = j(
          this.serviceTable.dspSessionId,
          this.serviceTable.generation,
          n
        );
        this.mipJobs.has(o) || this.mipJobs.set(o, {
          key: o,
          dspSessionId: this.serviceTable.dspSessionId,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...Oe(this.serviceTable.frameCount),
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
    const { dspSessionId: e, generation: n, tableIndex: o } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.generation !== n || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (g("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        generation: n,
        tableIndex: o,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          generation: n,
          tableIndex: o
        },
        {
          failurePhase: De,
          failureReasonCode: Fe
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== De || e.failureReasonCode !== Fe ? !1 : this.autoRetryConsumedKey !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    tableIndex: n,
    generation: o = 0,
    candidateAttemptSerial: i = 0,
    failurePhase: r = P,
    failureReasonCode: a = E
  }) {
    this.connection.sendEventOrValue?.(Fo, {
      dspSessionId: e,
      tableIndex: n,
      generation: o,
      candidateAttemptSerial: i,
      failurePhase: r,
      failureReasonCode: a
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    generation: n,
    tableIndex: o,
    failureReasonCode: i = E
  }) {
    this.connection.sendEventOrValue?.(_o, {
      dspSessionId: e,
      generation: n,
      tableIndex: o,
      failureReasonCode: i
    });
  }
  emitRetryDesiredTableRequest() {
    g("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? Ce(this.latestRuntimeState) : null
    }), this.connection.sendEventOrValue?.(Do, 1);
  }
  async loadTableSource(e, n, o) {
    const i = await this.ensureCatalogLoaded();
    if (o !== this.asyncStateToken)
      return null;
    const r = Qo(e, i.tables.length), a = i.tables[r];
    Ne(a, `Could not resolve table ${r}`);
    const l = Xo(a, he, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, g("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = Pe();
    g("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const m = await this.resourceClient.readAudio(a.sourceWav), h = Mt(m.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: he
    });
    return !h || o !== this.asyncStateToken ? null : (g("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: h.frameCount,
      loadDurationMs: Math.round(Pe() - c)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: r,
      tableMeta: a,
      frameCount: h.frameCount,
      frames: h.frames,
      spectra: new Array(h.frameCount)
    }));
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, o) {
    g("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: o.tableMeta?.name ?? null,
      frameCount: o.frameCount
    }), this.serviceTable = {
      ...o,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidation = {
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGeneration = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Co, {
      dspSessionId: e.dspSessionId,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: o.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    g("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: P,
      failureReasonCode: E
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: P,
      failureReasonCode: E
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = P,
    failureReasonCode: o = E
  } = {}) {
    g("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: o
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: o
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: o
    });
  }
  async prepareServiceTarget(e, n, o) {
    if (this.isMatchingServiceTable(e))
      return this.serviceTable && (this.serviceTable.mode = e.kind), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0;
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex, void 0, o);
    } catch (r) {
      return o === this.asyncStateToken && (g("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: J(r)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    return !i || o !== this.asyncStateToken ? !1 : (this.serviceTable = {
      ...i,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads()), this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.generation === e.generation && this.candidateValidation.tableIndex === e.tableIndex && (this.candidateValidation = null), !0);
  }
  async prepareDesiredLoad(e, n) {
    const o = e.desiredTableIndex;
    if (this.candidateValidation && this.candidateValidation.dspSessionId === e.dspSessionId && this.candidateValidation.tableIndex === o && this.candidateValidation.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const i = Math.max(
      this.nextLoadGeneration,
      e.generationFrontier + 1
    );
    let r = null;
    try {
      r = await this.loadTableSource(o, void 0, n);
    } catch (a) {
      n === this.asyncStateToken && (g("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: o,
        detail: J(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !r || n !== this.asyncStateToken || this.markCommittedDesiredLoad(e, i, r);
  }
  async prepareDesiredCandidate(e, n) {
    await this.prepareDesiredLoad(e, n);
  }
  async handleRuntimeState(e) {
    try {
      const n = Jo(e ?? {});
      if (g("info", "Received runtime state", Ce(n)), n.dspSessionId <= 0)
        return;
      const o = n.dspSessionId !== this.knownSessionId, i = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null, r = this.getDesiredRetryKey(n);
      o ? this.resetSessionState(n) : this.nextLoadGeneration = Math.max(
        this.nextLoadGeneration,
        n.generationFrontier + 1
      ), (o || i !== r) && (this.autoRetryConsumedKey = null), this.latestRuntimeState = n;
      const a = this.asyncStateToken + 1;
      if (this.asyncStateToken = a, this.candidateValidation && this.candidateValidation.dspSessionId === n.dspSessionId && this.candidateValidation.generation > n.generationFrontier)
        return;
      const l = this.resolveServiceTarget(n), s = o && l?.kind === "active";
      if (l) {
        if (!await this.prepareServiceTarget(l, n, a))
          return;
        if (l.kind === "loading" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n)) {
          g("warn", "Aborting obsolete wavetable load because the desired table changed", {
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            staleTableIndex: l.tableIndex,
            desiredTableIndex: n.desiredTableIndex,
            desiredIntentSerial: n.desiredIntentSerial
          }), this.emitServiceLoadAbort({
            dspSessionId: l.dspSessionId,
            generation: l.generation,
            tableIndex: l.tableIndex,
            failureReasonCode: E
          }), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        l.kind === "active" && n.desiredTableIndex !== l.tableIndex && !this.shouldStayIdleOnFailure(n) && !s && await this.prepareDesiredCandidate(n, a);
        return;
      }
      if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(n)) {
        this.autoRetryConsumedKey = r, this.emitRetryDesiredTableRequest();
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
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, o = Math.trunc(Number(n?.tableIndex ?? e));
    if (!Number.isFinite(o))
      return;
    const i = this.asyncStateToken;
    try {
      const r = await this.loadTableSource(o, void 0, i);
      if (!r || i !== this.asyncStateToken)
        return;
      for (let l = 0; l < r.frameCount; l += 1)
        r.spectra[l] || (r.spectra[l] = me(r.frames[l]));
      const a = this.tableCache.get(r.cacheKey);
      a && this.refreshCacheEntryByteCount(a), g("info", "Prewarmed wavetable source table", {
        tableIndex: r.tableIndex,
        tableId: r.tableMeta.tableId,
        tableName: r.tableMeta.name,
        reason: typeof n?.reason == "string" ? n.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (r) {
      g("warn", "Ignoring wavetable prewarm failure", {
        tableIndex: o,
        reason: typeof n?.reason == "string" ? n.reason : null,
        detail: J(r)
      });
    }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), o = Math.trunc(Number(e?.generation)), i = Math.trunc(Number(e?.tableIndex)), r = Math.trunc(Number(e?.mipIndex)), a = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || o !== this.serviceTable.generation || i !== this.serviceTable.tableIndex || r < 0 || r >= this.mipLevelCount)
      return null;
    const l = j(n, o, r);
    let s = this.mipJobs.get(l);
    return s ? (!s.completed && a > s.urgencyLevel && (s.urgencyLevel = a), s) : (s = {
      key: l,
      dspSessionId: n,
      generation: o,
      tableIndex: i,
      mipIndex: r,
      urgencyLevel: a,
      ...Oe(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, s), s);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (g("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, o = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.generation)), r = Math.trunc(Number(n.mipIndex)), a = Math.trunc(Number(n.frameIndex)), l = j(o, i, r), s = this.mipJobs.get(l);
    !s || s.completed || !s.inFlightFrames.has(a) || (s.inFlightFrames.delete(a), s.ackedFrames[a] || (s.ackedFrames[a] = 1, s.ackedFrameCount += 1), s.ackedFrameCount === this.serviceTable?.frameCount && s.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && s.inFlightFrames.size === 0 && (s.completed = !0, this.activeUploadKey === s.key && (this.activeUploadKey = null)), Le(a, this.serviceTable?.frameCount ?? 0) && g("info", "Acknowledged wavetable mip frame", {
      dspSessionId: o,
      generation: i,
      tableIndex: s.tableIndex,
      mipIndex: r,
      frameIndex: a,
      ackedFrameCount: s.ackedFrameCount,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.armServiceLoadWatchdog(), this.pumpUploads());
  }
  getSpectrumForFrame(e) {
    if (Ne(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = me(this.serviceTable.frames[e]);
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
        let o;
        try {
          const i = this.getSpectrumForFrame(n);
          o = At(i, e.mipIndex);
        } catch {
          this.handleServiceTargetFailure(
            {
              kind: this.serviceTable.mode ?? "loading",
              dspSessionId: e.dspSessionId,
              generation: e.generation,
              tableIndex: e.tableIndex
            },
            {
              failurePhase: Go,
              failureReasonCode: E
            }
          ), this.serviceTable = null, this.clearMipTransferState();
          return;
        }
        this.connection.sendEventOrValue?.(Lo, {
          dspSessionId: e.dspSessionId,
          generation: e.generation,
          tableIndex: e.tableIndex,
          mipIndex: e.mipIndex,
          frameIndex: n,
          samples: Array.from(o)
        }), Le(n, this.serviceTable.frameCount) && g("info", "Sent wavetable mip frame", {
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
function J(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Zo(t, e = {}) {
  return new Yo(t, e);
}
async function ei(t, e = {}) {
  return wt(t, [
    So,
    xo,
    uo,
    () => Zo(t, e)
  ]);
}
export {
  Vo as FAILURE_PHASE_BUILD_MIP,
  Bo as FAILURE_PHASE_LOAD_SOURCE,
  Wo as FAILURE_PHASE_TRANSFER_MIP,
  zo as FAILURE_REASON_GENERIC,
  $o as FAILURE_REASON_TIMEOUT,
  Yo as WavetableWorkerController,
  Zo as createWavetableWorkerController,
  ei as default
};
