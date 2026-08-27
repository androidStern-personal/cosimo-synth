function k(t, e) {
  if (!t)
    throw new Error(e);
}
function Ne(t, e, n) {
  let i = "";
  for (let o = 0; o < n; o += 1)
    i += String.fromCharCode(t.getUint8(e + o));
  return i;
}
function Ti(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Ye(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function An(t) {
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
function Ri() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ce(t, e) {
  const n = Ri();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Ti(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Nt(t) {
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
  throw new Error(`Unsupported text resource payload (${An(t)})`);
}
function Ai(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Ye(t);
  throw new Error(`Unsupported binary resource payload (${An(t)})`);
}
function xi(t) {
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
function xn(t) {
  const e = new DataView(t);
  k(Ne(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), k(Ne(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, o = null, r = null, a = null, s = null, l = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = Ne(e, c, 4), h = e.getUint32(c + 4, !0), m = c + 8;
    u === "fmt " ? (n = e.getUint16(m, !0), i = e.getUint16(m + 2, !0), o = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), r = e.getUint16(m + 14, !0)) : u === "data" && (s = m, l = h), c = m + h + h % 2;
  }
  k(n !== null, "Wave file is missing a fmt chunk"), k(s !== null && l !== null, "Wave file is missing a data chunk"), k(i === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && r === 32)
    d = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && r === 16) {
    const u = l / 2, h = new Int16Array(t.slice(s, s + l));
    d = new Float32Array(u);
    for (let m = 0; m < u; m += 1)
      d[m] = h[m] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: o ?? 0,
    bitsPerSample: r,
    blockAlign: a ?? 0,
    samples: d
  };
}
async function Ct(t) {
  k(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return k(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Ze(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function En(t) {
  const e = new Uint8Array(t).buffer, n = xn(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Ei(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (k(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), o = async (l) => {
    k(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const c = await t.readResourceAsAudioData(l);
    return xi(c);
  }, r = (l) => {
    const c = t.getResourceAddress?.(l);
    return c ?? null;
  }, a = async (l, c = t.getResourceAddress?.(l)) => {
    const d = Ce(l, c), u = await Ct(d), h = xn(u);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, s = async (l, c = t.getResourceAddress?.(l)) => {
    const d = Ce(l, c);
    return new Uint8Array(await Ct(d));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Nt(await i(l));
      const c = r(l);
      return e === "url" && c !== null ? Ze(await s(l, c)) : typeof t.readResource == "function" ? Nt(await i(l)) : Ze(await s(l, c));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? Ai(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(l);
      const c = r(l);
      return n === "url" && c !== null ? a(l, c) : typeof t.readResourceAsAudioData == "function" ? o(l) : En(await this.readBytes(l));
    },
    getURL(l) {
      return Ce(l, t.getResourceAddress?.(l));
    }
  };
}
function Mi(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Ei(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function _i(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, o = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return Ze(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return Ye(await e(a));
      if (n)
        return Ye(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : En(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function Oi(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function wi(t) {
  return Oi(t) ? _i(t) : Mi(t);
}
const Ae = 2048;
function ae(t, e) {
  if (!t)
    throw new Error(e);
}
function ki(t) {
  ae(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    ae(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), ae(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), ae(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), ae(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Di = 2048, Mn = 11, Li = 256;
function C(t, e) {
  if (!t)
    throw new Error(e);
}
function Ni(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Pt = /* @__PURE__ */ new Map();
function Ci(t) {
  const e = Pt.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let r = 0, a = o;
    for (let s = 0; s < n; s += 1)
      r = r << 1 | a & 1, a >>= 1;
    i[o] = r;
  }
  return Pt.set(t, i), i;
}
function _n(t, e, n = !1) {
  const i = t.length;
  C(i === e.length, "FFT real and imaginary buffers must have the same length"), C(Ni(i), "FFT input length must be a power of two");
  const o = Ci(i);
  for (let r = 0; r < i; r += 1) {
    const a = o[r];
    if (a <= r)
      continue;
    const s = t[r];
    t[r] = t[a], t[a] = s;
    const l = e[r];
    e[r] = e[a], e[a] = l;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const a = r >> 1, s = (n ? 2 : -2) * Math.PI / r, l = Math.cos(s), c = Math.sin(s);
    for (let d = 0; d < i; d += r) {
      let u = 1, h = 0;
      for (let m = 0; m < a; m += 1) {
        const p = d + m, g = p + a, R = t[g], L = e[g], w = u * R - h * L, F = u * L + h * R, z = t[p], N = e[p];
        t[p] = z + w, e[p] = N + F, t[g] = z - w, e[g] = N - F;
        const Ie = u * l - h * c;
        h = u * c + h * l, u = Ie;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function On(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    o[r] = (Number(e[r]) || 0) - i;
  return o;
}
function Pi(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Di,
  maxFramesPerTable: i = Li
} = {}) {
  const o = Float32Array.from(t);
  C(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = o.length / n;
  C(r > 0, "Source wavetable files must contain at least one frame"), C(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && C(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let s = 0; s < r; s += 1) {
    const l = s * n, c = l + n;
    a.push(On(o.slice(l, c)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function Ft(t) {
  const e = On(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return _n(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Fi(t, e, {
  mipLevelCount: n = Mn
} = {}) {
  const i = t?.real?.length ?? 0;
  C(i > 0, "Spectrum must contain real samples"), C(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), C(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, i >> 1), r = new Float64Array(i), a = new Float64Array(i);
  for (let s = 1; s <= o; s += 1) {
    r[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (i - s) % i;
    l !== s && (r[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return _n(r, a, !0), Float32Array.from(r);
}
class Ki {
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
function Ui(t, e) {
  return new Ki(t, e);
}
async function Bi(t, e) {
  const n = Ui(t, e);
  return await n.start(), n;
}
const O = (t, e) => ({ label: t, value: e });
function K(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const U = Object.freeze({
  filter: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), f = (t, e, n, i, o, r, a, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: o,
  max: r,
  initial: a,
  step: s.step ?? (r - o) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
}), $i = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Vi = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], zi = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: U.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(O), quick: !0 }),
      f("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      f("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      f("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: U.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [O("Classic", 0), O("Harmonics", 1)] }),
      f("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      f("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      f("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      f("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      f("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      f("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [O("Symmetric", 0), O("Asymmetric", 1), O("Wavefold", 2)] })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: U.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      f("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      f("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      f("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      f("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      f("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: U.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      f("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(O) }),
      f("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(O) }),
      f("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      f("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      f("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      f("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      f("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: U.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      f("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      f("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      f("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      f("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      f("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: U.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      f("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [O("Free", 0), O("Sync", 1)] }),
      f("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      f("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: $i.map(O) }),
      f("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      f("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      f("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      f("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      f("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: U.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      f("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [O("Free", 0), O("Sync", 1)] }),
      f("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      f("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Vi.map(O) }),
      f("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      f("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      f("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: U.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      f("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      f("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      f("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      f("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], ke = zi, wn = Object.freeze(
  ke.flatMap((t) => t.parameters)
);
new Map(
  wn.map((t) => [t.endpointID, t])
);
function ut(t) {
  const e = ke.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function kn() {
  return wn;
}
function dt(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const y = ["A", "B", "C"], Dn = [
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
], Hi = [
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
  "ampRelease"
], J = Object.freeze([
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
]), Wi = Object.freeze([
  ...y.flatMap((t) => Dn.map(
    (e) => `osc${t}.${e}`
  )),
  ...Hi
]);
new Set(
  y.flatMap((t) => Dn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Ln = Object.freeze(
  Wi.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), ji = kn().filter((t) => t.modulationTargetIndex !== null), Gi = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ft(t) {
  const e = qi(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function qi(t) {
  const e = Gi.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Nn = Object.freeze(
  [
    ...ji.map((t) => ({
      // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
      // and indexes are both minted only by the rack descriptor catalog.
      kind: ft(dt(t)),
      group: "rack",
      runtimeIndex: t.modulationTargetIndex
    })).sort((t, e) => t.runtimeIndex - e.runtimeIndex),
    { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
    { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
  ]
), V = Object.freeze([
  ...Ln,
  ...Nn
]), xe = J.length, Cn = Ln.length, De = Nn.length, Ji = xe * V.length, Xi = new Map(J.map((t) => [t.id, t])), Pn = new Map(J.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), re = new Map(V.map((t) => [t.kind, t]));
function Qi() {
  if (xe !== 14 || Cn !== 56 || De !== 39 || Ji !== 1330)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = J.filter((i) => i.group === t).sort((i, o) => i.runtimeIndex - o.runtimeIndex);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 39]]) {
    const n = V.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Xi.size !== xe || Pn.size !== xe || re.size !== V.length)
    throw new Error("Modulation identities must be unique");
}
Qi();
function Fn(t, e) {
  const n = Pn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function mt(t) {
  return typeof t != "string" ? null : re.has(t) ? t : null;
}
function Yi(t) {
  const e = mt(t);
  return e !== null && re.get(e)?.group === "voice" ? e : null;
}
function ht(t) {
  const e = mt(t);
  return e !== null && re.get(e)?.group === "rack" ? e : null;
}
function Zi(t) {
  const e = re.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Kn(t) {
  const e = re.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function er(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Un = 4, tr = Un * De, nr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), ir = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function X(t) {
  if (typeof t != "string")
    return null;
  const e = ir.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = nr.get(n);
  if (i === void 0)
    return null;
  const o = e[3];
  return i.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function pt(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Bn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function $n(t) {
  if (t === null)
    return null;
  const e = Bn(t) - 1;
  return e > Un ? null : e * De + Kn(pt(t));
}
const $ = 2048, rr = $ + 3, Kt = 20, Vn = "MSEG 1", or = 0, j = 2, ar = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function gt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ie(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function sr(t) {
  return gt(Number.isFinite(t) ? t : 0, -Kt, Kt);
}
function q(t) {
  return gt(Number.isFinite(t) ? t : 0, 0, 1);
}
function zn(t = Vn) {
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
function et() {
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
function lr(t) {
  const e = Number(t);
  return gt(
    Number.isFinite(e) ? e : 1,
    or,
    j
  );
}
function cr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = q(Number(e.startX)), i = q(Number(e.endX));
  return ie(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function ur(t = et()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), o = e.noteOffPolicy, r = ar.has(o) ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: lr(Number.isFinite(i) ? i : 1)
    },
    loop: cr(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function dr(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let o = Number(i.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = q(o)), {
    x: o,
    y: q(Number(i.y)),
    curvePower: sr(Number(i.curvePower))
  };
}
function me(t = zn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((o, r) => dr(o, r, n.length));
  if (!ie(i[0].x, 0) || !ie(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < i.length; o += 1)
    if (i[o].x < i[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Vn,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Ut(t) {
  return JSON.stringify(me(t));
}
function fr(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function mr(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: i, to: o, laterPointWins: !1 };
    if (ie(e, o.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && ie(t[r + 1].x, e); )
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
function hr(t, e) {
  const n = q(Number(e)), i = mr(t, n);
  if (i.laterPointWins || ie(i.from.x, i.to.x))
    return i.to.y;
  const o = i.to.x - i.from.x, r = o <= 0 ? 1 : (n - i.from.x) / o, a = q(fr(r, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function pr(t, e) {
  return hr(me(t).points, e);
}
function gr(t) {
  const e = me(t), n = new Float32Array($);
  for (let o = 0; o < $; o += 1) {
    const r = o / ($ - 1);
    n[o] = pr(e, r);
  }
  const i = new Float32Array(rr);
  return i[0] = n[0], i.set(n, 1), i[$ + 1] = n[$ - 1], i[$ + 2] = n[$ - 1], i;
}
function Bt(t, e) {
  return Ut(t) === Ut(e);
}
const Pe = "modulationProgram", Ir = "modulationAmount", Hn = J.filter((t) => t.group === "voice").length, Wn = J.filter((t) => t.group === "macro").length, Ee = Cn, yr = De, Me = yr + tr, G = Hn * Ee, Y = Wn * Ee, Sr = Hn * Me, br = Wn * Me, H = 512, Q = 256, jn = G + Y;
function vr(t) {
  const e = Fn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Tr(t) {
  const e = Yi(t);
  return e === null ? null : Zi(e);
}
function Gn(t) {
  const e = Tr(t.targetKind), n = ht(t.targetKind);
  let i = n === null ? void 0 : Kn(n);
  if (i === void 0) {
    const a = $n(
      X(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Fn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const c = s * Ee + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: G + c
      };
    }
    const l = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Me + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const o = vr(t);
  if (e !== null) {
    const a = o * Ee + e;
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
    cellIndex: o * Me + r,
    sourceIndex: o,
    targetIndex: r,
    articulationCellIndex: null
  };
}
function qn(t) {
  return X(t.targetKind) !== null ? null : Gn(t).articulationCellIndex;
}
function Rr(t) {
  if (ht(t.targetKind) !== null)
    return !1;
  const e = X(t.targetKind);
  return e !== null && $n(e) === null;
}
function Ar(t) {
  return {
    ...Gn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Jn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Rr(n))
      continue;
    const i = Ar(n), o = e[i.path];
    if (o.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    o.set(i.cellIndex, i);
  }
  return e;
}
function xr(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function Z(t) {
  return [...t.values()].filter(xr).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ye(t, e, n, i, o) {
  for (let r = 0; r < t.length; r += 1) {
    const a = t[r];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${r}`);
    e[r] = a.cellIndex, n[r] = a.sourceIndex, i[r] = a.targetIndex, o[r] = a.polarity;
  }
}
function Fe(t) {
  const e = Jn(t), n = Z(e.voice), i = Z(e.macroVoice), o = Z(e.voiceRack), r = Z(e.macroRack), a = Array.from({ length: G }, () => 0), s = Array.from({ length: G }, () => 0), l = Array.from({ length: G }, () => 0), c = Array.from({ length: G }, () => 0), d = Array.from({ length: G }, () => 0);
  ye(n, a, s, l, c);
  const u = Array.from({ length: Y }, () => 0), h = Array.from({ length: Y }, () => 0), m = Array.from({ length: Y }, () => 0), p = Array.from({ length: Y }, () => 0), g = Array.from({ length: Y }, () => 0);
  if (ye(
    i,
    u,
    h,
    m,
    p
  ), o.length > H || r.length > Q)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${H}), ${r.length} macro-rack (max ${Q})`
    );
  const R = Array.from({ length: H }, () => 0), L = Array.from({ length: H }, () => 0), w = Array.from({ length: H }, () => 0), F = Array.from({ length: H }, () => 0), z = Array.from({ length: H }, () => 0), N = Array.from({ length: Sr }, () => 0);
  ye(
    o,
    R,
    L,
    w,
    F
  );
  const Ie = Array.from({ length: Q }, () => 0), Ot = Array.from({ length: Q }, () => 0), wt = Array.from({ length: Q }, () => 0), kt = Array.from({ length: Q }, () => 0), Dt = Array.from({ length: br }, () => 0);
  ye(
    r,
    Ie,
    Ot,
    wt,
    kt
  );
  for (const E of e.voice.values()) d[E.cellIndex] = E.amount;
  for (const E of e.macroVoice.values()) g[E.cellIndex] = E.amount;
  for (const E of e.voiceRack.values()) N[E.cellIndex] = E.amount;
  for (const E of e.macroRack.values()) Dt[E.cellIndex] = E.amount;
  for (let E = 0; E < o.length; E += 1) {
    const Lt = o[E];
    if (Lt === void 0) throw new Error(`Missing compiled voice-rack route at index ${E}`);
    z[E] = Lt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: c,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: u,
    macroVoiceRouteSources: h,
    macroVoiceRouteTargets: m,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: g,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: R,
    voiceRackRouteSources: L,
    voiceRackRouteTargets: w,
    voiceRackRoutePolarities: F,
    voiceRackRouteReducers: z,
    voiceRackRouteAmounts: N,
    macroRackRouteCount: r.length,
    macroRackRouteCells: Ie,
    macroRackRouteSources: Ot,
    macroRackRouteTargets: wt,
    macroRackRoutePolarities: kt,
    macroRackRouteAmounts: Dt
  };
}
const Er = ["voice", "macroVoice", "voiceRack", "macroRack"], Mr = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function $t(t) {
  return Jn(t);
}
function _r(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Or(t, e) {
  if (t === null)
    return [{ endpointID: Pe, value: Fe(e) }];
  const n = $t(t), i = $t(e), o = [];
  for (const r of Er) {
    const a = Z(n[r]), s = Z(i[r]);
    if (a.length !== s.length)
      return [{ endpointID: Pe, value: Fe(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const c = a[l], d = s[l];
      if (c === void 0 || d === void 0 || !_r(c, d))
        return [{ endpointID: Pe, value: Fe(e) }];
      c.amount !== d.amount && o.push({
        endpointID: Ir,
        value: {
          pathKind: Mr[r],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return o;
}
function oe(t) {
  return { _tag: "ok", value: t };
}
function ue(t) {
  return { _tag: "err", error: t };
}
function wr(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function kr(t) {
  throw new Error(t ?? "Invariant violated");
}
const Dr = "globalTune", Lr = "globalTuneSemitones", B = -24, se = 24, Vt = 0, Xn = -48, Qn = 48, tt = -48, Yn = 6, It = 0, zt = (It - tt) / (Yn - tt);
function Se(t, e, n, i, o = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: o, compound: r };
}
const Nr = [
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
function P(t, e) {
  if (!Number.isFinite(t) || t < -Ht || t > 1 + Ht)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function _e(t, e) {
  return P(t / 100, `${e} catalog percentage`);
}
function Le(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Cr(t) {
  return 20 * 1e3 ** t;
}
function Pr(t) {
  return P(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Fr(t) {
  return 0.1 * 200 ** t;
}
function Kr(t) {
  return P(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ur(t) {
  return t;
}
function Br(t) {
  return P(t, "filterMix endpoint conversion");
}
function de(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function $r(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: de("filterCutoff", Cr, Pr),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: de("filterQ", Fr, Kr),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: de("filterMix", Ur, Br),
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
function Zn(t) {
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
      return wr(t);
  }
}
function Vr(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function zr(t, e) {
  const n = Le(t.moduleId, e.id), i = Zn(e.format), o = $r(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: _e(e.defaultPercent, n),
    initialValue: _e(e.initialPercent, n),
    format: i,
    modAmount: Vr(i),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const Hr = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: zt * 100, defaultPercent: zt * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Wr(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function jr(t, e) {
  const n = `osc${t}`, i = Le(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: _e(e.defaultPercent, i),
    initialValue: _e(e.initialPercent, i),
    format: Zn(e.format),
    modAmount: Wr(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Gr = Object.freeze(
  y.flatMap((t) => Hr.map((e) => jr(t, e)))
), qr = Object.freeze({
  targetId: Le("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: P(
    (Vt - B) / (se - B),
    "Global Tune default"
  ),
  initialValue: P(
    (Vt - B) / (se - B),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: se },
  modAmount: {
    min: Xn,
    max: Qn,
    unit: "st",
    digits: 2
  },
  binding: de(
    Dr,
    (t) => B + (se - B) * t,
    (t) => P(
      (t - B) / (se - B),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Lr
}), Jr = Object.freeze([
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
function Xr(t) {
  const e = Le(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, o = (r) => P(
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
    binding: de(t.endpointID, i, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Qr = Object.freeze(
  Jr.map(Xr)
), Yr = Object.freeze([
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
function Zr(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ke(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return P(n, `${t.endpointID} endpoint conversion`);
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
  const e = Zr(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ke(t, t.initial),
    initialValue: Ke(t, t.initial),
    format: to(t),
    modAmount: no(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => eo(t, n),
      fromEngine: (n) => Ke(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ft(dt(t))
  });
}
const yt = Object.freeze(
  [
    ...ke.flatMap((t) => t.parameters.map(io)),
    ...Yr,
    qr,
    ...Gr,
    ...Qr,
    ...Nr.flatMap(
      (t) => t.parameters.map(
        (e) => zr(t, e)
      )
    )
  ]
), ro = new Map(
  yt.map((t) => [t.targetId, t])
), ei = yt.filter(
  (t) => t.modulationTargetKind !== null
), nt = new Map(
  ei.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (ro.size !== yt.length)
  throw new Error("Target descriptor IDs must be unique");
if (ei.length !== V.length || nt.size !== V.length || V.some((t) => nt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ue(t) {
  const e = nt.get(t);
  return e === void 0 ? kr(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  ke.map((t) => [t.id, t.label])
);
function oo(t) {
  const e = Bn(t);
  return e === 1 ? "" : ` ${e}`;
}
function ao(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = Ue(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = X(t);
  if (n !== null) {
    const i = Ue(pt(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${oo(n)} ${i.label.toUpperCase()}`;
  }
  return Ue(t).label.toUpperCase();
}
const le = "modulation.v6", ti = 6, pe = 3, ee = 3, so = 4, Wt = "modulationMsegBuffer", lo = "modulationMsegPlayback", ni = 4, co = ["MSEG 1", "MSEG 2", "MSEG 3"], ii = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], uo = ["Env 1", "Env 2", "Env 3"], fo = 1e-3, b = 10, mo = 0.1, ho = 20, po = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: ho - mo },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Xn,
    max: Qn
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
  mseg1Rate: { min: -j, max: j },
  mseg2Rate: { min: -j, max: j },
  mseg3Rate: { min: -j, max: j },
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
  env3Release: { min: -b, max: b },
  ampAttack: { min: -b, max: b },
  ampDecay: { min: -b, max: b },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -b, max: b }
}, go = kn().filter((t) => t.modulationTargetIndex !== null), Io = new Map(
  go.map((t) => [
    ft(dt(t)),
    t
  ])
);
class Be extends Error {
  name = "ModulationStateParseError";
}
const yo = {
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
J.map((t) => ({
  value: t.id,
  label: yo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const So = V.map((t) => ({
  value: t.kind,
  label: ao(t.kind)
}));
So.filter((t) => !vo(t.value));
function bo(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function St(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function $e(t, e) {
  const n = Number(t);
  return St(Number.isFinite(n) ? n : e, fo, b);
}
function vo(t) {
  return ht(t) !== null;
}
function To(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Ro(t) {
  const e = X(t);
  return e !== null ? pt(e) : t;
}
function Ao(t) {
  const e = Ro(t);
  if (X(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Io.get(e);
  return n !== void 0 ? To(n) : po[er(e)];
}
function xo(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Eo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Mo(t, e) {
  const n = Ao(t), i = Number(e);
  return St(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function _o(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Oo(t) {
  return _o(t) ?? "mseg";
}
function wo(t) {
  const e = mt(t);
  return e !== null ? e : X(t) !== null ? t : null;
}
function ko(t) {
  return wo(t) ?? "oscA.wavetablePosition";
}
function Do(t, e) {
  const n = ii[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Lo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? pe : t === "macro" ? ni : so;
  return St(Number.isFinite(n) ? n : 1, 1, i);
}
function te(t) {
  return {
    name: uo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function ri(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = te(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: $e(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: $e(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: q(n.sustain ?? i.sustain),
    releaseSeconds: $e(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function No(t, e = 0) {
  return { name: ri(t, e).name };
}
function Co(t, e, n, i) {
  const o = Number(t.amount);
  return {
    id: xo(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Lo(n, t.sourceSlot),
    polarity: Eo(t.polarity),
    targetKind: i,
    amount: Mo(i, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Po(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, o = Oo(i.sourceKind), r = ko(i.targetKind);
  return Co(i, e, o, r);
}
function Fo(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Ko(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Po(n, i));
}
function Uo(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const o = Fo(i);
    if (e.has(i.id) || n.has(o))
      return !1;
    e.add(i.id), n.add(o);
  }
  return !0;
}
function it(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => it(a, e[s]));
  const n = t, i = e, o = Object.keys(n), r = Object.keys(i);
  return o.length === r.length && o.every((a) => bo(i, a) && it(n[a], i[a]));
}
function oi(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = zn(co[e] ?? `MSEG ${e + 1}`), o = me(n.shapeA ?? i), r = ur({
    ...et(),
    ...n.playback ?? {},
    rate: et().rate
  }), { rate: a, ...s } = r;
  return {
    shapeA: o,
    shapeB: me(n.shapeB ?? o),
    playback: s
  };
}
function rt() {
  return {
    format: "cosimo.modulation",
    version: ti,
    msegSlots: Array.from({ length: pe }, (t, e) => oi({}, e)),
    envelopeSlots: Array.from({ length: ee }, (t, e) => ({
      name: te(e).name
    })),
    routes: [],
    macroNames: ii.slice()
  };
}
function Bo(t = rt()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: ti,
    msegSlots: Array.from({ length: pe }, (r, a) => oi(n[a], a)),
    envelopeSlots: Array.from({ length: ee }, (r, a) => No(i[a], a)),
    routes: Ko(e.routes),
    macroNames: Array.from(
      { length: ni },
      (r, a) => Do(o[a], a)
    )
  };
}
function jt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ue(new Be("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ue(new Be("Expected valid modulation JSON"));
    }
  }
  const n = Bo(e);
  return !it(e, n) || !Uo(n.routes) ? ue(new Be("Expected the current modulation schema")) : oe(n);
}
function $o(t, e) {
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
    buffer: Array.from(gr(n))
  };
}
function Vo(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function zo(t, e = null) {
  const n = [];
  for (let i = 0; i < pe; i += 1) {
    const o = t.msegSlots[i], r = e?.msegSlots[i];
    (r === void 0 || !Bt(r.shapeA, o.shapeA)) && n.push({
      endpointID: Wt,
      value: Gt(i, 0, o.shapeA)
    }), (r === void 0 || !Bt(r.shapeB, o.shapeB)) && n.push({
      endpointID: Wt,
      value: Gt(i, 1, o.shapeB)
    }), (r === void 0 || !Vo(r.playback, o.playback)) && n.push({
      endpointID: lo,
      value: $o(i, o.playback)
    });
  }
  return n.push(...Or(e?.routes ?? null, t.routes)), n;
}
const Ve = "articulationSnapshot", v = 128, qt = 48, Ho = 1e6, x = -1, ze = [
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
function bt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function He(t) {
  return bt(Number.isFinite(t) ? t : 0, 0, 1);
}
function M(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const o = Number(t);
  return bt(Number.isFinite(o) ? o : e, n, i);
}
function A(t, e, n, i) {
  return bt(Math.round(M(t, e)), n, i);
}
function ai(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function We() {
  return Array.from({ length: v }, () => x);
}
function Wo(t) {
  const e = A(t, 0, 0, v - 1), n = ze[e % ze.length], i = Math.floor(e / ze.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function jo() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: It,
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
function Go(t) {
  const e = jo(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: M(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: M(n.pan, e.pan, -1, 1),
    octave: A(n.octave, e.octave, -4, 4),
    semitone: A(n.semitone, e.semitone, -12, 12),
    fineCents: M(n.fineCents, e.fineCents, -100, 100),
    volumeDb: M(
      n.volumeDb,
      e.volumeDb,
      tt,
      Yn
    ),
    mute: A(n.mute, e.mute, 0, 1),
    solo: A(n.solo, e.solo, 0, 1),
    warpMode: A(n.warpMode, e.warpMode, 0, 4),
    warpAmount: M(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: A(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: M(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: M(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: M(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: A(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: M(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: M(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: M(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: M(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: M(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: A(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: A(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: A(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: M(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: M(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      He(Number(i[0])),
      He(Number(i[1])),
      He(Number(i[2]))
    ]
  };
}
function qo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: M(e.amount, 0, -48, 48)
  } : null;
}
function Jo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(qo).filter((o) => o !== null) : [], i = /* @__PURE__ */ new Map();
  for (const o of n)
    i.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Go(e.parameters),
    envelopes: [0, 1, 2].map((o) => ri(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Xo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = A(n.runtimeSlot, e, 0, v - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, r = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Wo(i);
  return {
    id: o,
    runtimeSlot: i,
    name: r,
    snapshot: Jo(n.snapshot)
  };
}
function Qo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: A(n.note, 0, 0, v - 1),
    articulationId: i
  } : null;
}
function Yo(t, e, n, i, o) {
  if (!t || typeof t != "object")
    return null;
  const r = t, a = typeof r.articulationId == "string" ? r.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = A(r.min, o, o, v - 1), l = A(r.max, s, o, v - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function Jt(t, e, n, i) {
  const o = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < o.length; s += 1) {
    const l = Yo(
      o[s],
      e,
      s,
      n,
      i
    );
    !l || r.has(l.id) || (r.add(l.id), a.push(l));
  }
  return a;
}
function Zo(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), o = [];
  for (const r of n) {
    const a = Qo(r, e);
    !a || i.has(a.note) || (i.add(a.note), o.push(a));
  }
  return o;
}
function ea(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), r = [];
  for (let l = 0; l < n.length && r.length < v; l += 1) {
    const c = Xo(n[l], l);
    !c || i.has(c.runtimeSlot) || o.has(c.id) || (i.add(c.runtimeSlot), o.add(c.id), r.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && r.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(r.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ai(e.activeTriggerMode),
    slots: r,
    chainAssignments: Jt(e.chainAssignments, s, "chain", 0),
    keyAssignments: Zo(e.keyAssignments, s),
    velocityAssignments: Jt(e.velocityAssignments, s, "velocity", 1)
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
    volumeDbs: e(It),
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
    msegMorphs: Array.from({ length: pe }, () => 0),
    routeAmounts: Array.from({ length: jn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: ee }, (n, i) => te(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: ee }, (n, i) => te(i).decaySeconds),
    envelopeSustain: Array.from({ length: ee }, (n, i) => te(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: ee }, (n, i) => te(i).releaseSeconds)
  };
}
function Qt(t, e, n) {
  for (const i of e) {
    const o = n.get(i.articulationId);
    if (o !== void 0)
      for (let r = i.min; r <= i.max; r += 1)
        t[r] === x && (t[r] = o);
  }
}
function ta(t) {
  const e = ea(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = We(), o = We(), r = We();
  Qt(i, e.chainAssignments, n), Qt(r, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || o[a.note] !== x || (o[a.note] = s);
  }
  return r[0] = x, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: o,
    velocity: r
  };
}
function na(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : ta(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ai(e.activeMode),
    chain: Array.from({ length: v }, (n, i) => A(e.chain?.[i], x, x, v - 1)),
    key: Array.from({ length: v }, (n, i) => A(e.key?.[i], x, x, v - 1)),
    velocity: Array.from({ length: v }, (n, i) => i === 0 ? x : A(e.velocity?.[i], x, x, v - 1))
  });
}
function ia(t, e) {
  const n = na(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const ce = "articulations.v4", vt = [
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
], Tt = [
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
], ra = [
  ...y.flatMap((t) => vt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Tt
];
class si extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function I(t) {
  return ue(new si("malformed", t));
}
function ge(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Rt(t, e, n) {
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
function Oe(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < v;
}
function oa(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function aa(t) {
  return ra.some((e) => e === t);
}
function Yt(t, e) {
  if (!ge(t))
    return I(`${e} must be an object`);
  const n = Rt(t, ["min", "max"], e);
  return n !== null ? I(n) : Oe(t.min) ? Oe(t.max) ? t.min > t.max ? I(`${e}.min must be less than or equal to ${e}.max`) : oe({ min: t.min, max: t.max }) : I(`${e}.max must be an integer in 0..127`) : I(`${e}.min must be an integer in 0..127`);
}
function sa(t, e) {
  if (!ge(t))
    return I(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return I(`${e} has a non-string parameter id`);
    if (!aa(i))
      return I(`${e} has unknown parameter id "${i}"`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o))
      return I(`${e}.${i} must be a finite number`);
    n[i] = o;
  }
  return oe(n);
}
function la(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function ca() {
  return {};
}
function ua(t, e, n) {
  if (!ge(t))
    return I(`${e} must be an object`);
  const i = ca();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return I(`${e} has a non-string route id`);
    const r = t[o];
    if (typeof r != "number" || !Number.isFinite(r) || Math.abs(r) > qt)
      return I(
        `${e}.${o} must be a finite route amount within ±${qt}`
      );
    if (!n.has(o))
      return I(`${e}.${o} does not name a current articulable mapping`);
    la(i, o, r);
  }
  return oe(i);
}
function da(t, e, n) {
  const i = `slots[${e}]`;
  if (!ge(t))
    return I(`${i} must be an object`);
  const o = Rt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (o !== null)
    return I(o);
  if (typeof t.id != "string")
    return I(`${i}.id must be a string`);
  if (!Oe(t.runtimeSlot))
    return I(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return I(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return I(`${i}.color must be a string`);
  if (!Oe(t.key))
    return I(`${i}.key must be an integer in 0..127`);
  const r = Yt(t.velRange, `${i}.velRange`);
  if (r._tag === "err")
    return r;
  const a = Yt(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = sa(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = ua(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : oe({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: r.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: l.value
  });
}
const fa = Object.fromEntries(
  vt.map((t, e) => [t, 2 ** e])
), ma = Object.fromEntries(
  Tt.map((t, e) => [t, 2 ** e])
);
function Zt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function ha(t, e) {
  return vt.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | fa[i] : n, 0);
}
function pa(t) {
  return Tt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | ma[n] : e, 0);
}
function ga(t, e) {
  const n = (r, a) => Zt(t, `osc${r}.${a}`), i = (r) => Zt(t, r), o = Array.from(
    { length: jn },
    () => Ho
  );
  for (const [r, a] of Object.entries(t.routeAmounts)) {
    const s = e[r];
    s !== void 0 && (o[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: y.map((r) => ha(t, r)),
    sharedOverrideMask: pa(t),
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
function Ia(t, e) {
  return t.slots.map((n) => ga(n, e));
}
function ya(t, e) {
  if (!ge(t))
    return I("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return I('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ue(new si(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Rt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return I(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return I("selectedSlotId must be null or a string");
  if (!oa(t.activeTriggerMode))
    return I('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return I("slots must be an array");
  if (t.slots.length > v)
    return I(`slots must contain at most ${v} entries`);
  const i = [], o = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = da(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (o.has(l.id))
      return I(`slots[${a}].id duplicates "${l.id}"`);
    if (r.has(l.runtimeSlot))
      return I(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    o.add(l.id), r.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? I(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : oe({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function li() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Sa(t) {
  const e = Array.from({ length: v }, () => x), n = Array.from({ length: v }, () => x), i = Array.from({ length: v }, () => x);
  for (const o of t.slots) {
    n[o.key] === x && (n[o.key] = o.runtimeSlot);
    for (let r = o.chainRange.min; r <= o.chainRange.max; r += 1)
      e[r] === x && (e[r] = o.runtimeSlot);
    for (let r = o.velRange.min; r <= o.velRange.max; r += 1)
      i[r] === x && (i[r] = o.runtimeSlot);
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
const ot = "runtimeState";
function ci(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const ba = {
  endpointID: ot,
  required: !0,
  mapValue: ci
}, en = "runtimeInstallAck", va = "runtimeSyncRequest", tn = 0, Ta = 8e3, we = /* @__PURE__ */ new WeakMap(), ui = 1e9;
let be = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % ui;
function Ra(t) {
  return be = be % ui + 1, t === "modulation" ? -1e9 - be : 1e9 + be;
}
function Aa(t, e) {
  const n = t, i = we.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), we.set(n, i);
}
function nn(t, e) {
  const n = t, i = we.get(n);
  i?.delete(e), i?.size === 0 && we.delete(n);
}
const xa = [100, 250, 500, 1e3], ve = { _tag: "accepted" }, Ea = { _tag: "superseded" }, Ma = { _tag: "stopped" }, rn = { _tag: "transport-timeout" };
function _a(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, o = i.dspSessionId, r = i.acceptedModulationSerial, a = i.acceptedArticulationSerial, s = i.rejectedSerial, l = i.rejectionReason, c = i.syncSerial;
  return ![
    o,
    r,
    a,
    s,
    l,
    c
  ].every((u) => typeof u == "number" && Number.isSafeInteger(u) && u >= -2147483648 && u <= 2147483647) || typeof o != "number" || typeof r != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof c != "number" || o < 0 || r < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: r,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: c
  };
}
function Oa(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class on {
  #o;
  #e;
  #d;
  #b;
  #f = !1;
  #t = null;
  #s = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #c = 0;
  #r = /* @__PURE__ */ new Map();
  #u = 0;
  #i = !1;
  #a = 0;
  #m = /* @__PURE__ */ new Set();
  #v = this.#_.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#d = i && i.length > 0 ? i : [...xa], this.#b = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Ta)
    );
  }
  start() {
    if (!this.#i) {
      Aa(this.#o, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(en, this.#v);
      } catch (e) {
        throw this.#i = !1, nn(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(en, this.#v), nn(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#S());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#s = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#r.clear(), this.#a += 1, this.#S());
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
      const o = await this.#T(
        n,
        i
      );
      if (o._tag !== "accepted")
        return o;
      let r = null;
      for (const a of e) {
        const s = await this.#M(
          a,
          n,
          i
        );
        if (s._tag === "rejected" && this.#e === "articulation") {
          r ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return r ?? ve;
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
  #E() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#s === e)
      return ve;
    const i = Ra(this.#e);
    this.#l.add(i);
    const o = Date.now() + this.#b;
    let r = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return ve;
        const s = o - Date.now();
        if (s <= 0)
          return rn;
        const l = this.#a;
        this.#I(i), await this.#y(
          l,
          Math.min(this.#g(r), s)
        ), r += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const o = this.#E(), r = Oa(e.value, n, o);
    let a = 0, s = 0, l = this.#c;
    for (this.#R(e.endpointID, r); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const d = this.#h(n, o, l);
      if (d !== null)
        return d;
      const u = this.#a;
      await this.#y(
        u,
        this.#g(a)
      );
      const h = this.#h(
        n,
        o,
        l
      );
      if (h !== null)
        return h;
      let m = this.#a;
      for (this.#I(o); ; ) {
        const p = this.#p(n, i);
        if (p)
          return p;
        const g = await this.#y(
          m,
          this.#g(a)
        ), R = this.#h(
          n,
          o,
          l
        );
        if (R !== null)
          return R;
        if (g && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
          if (s >= 1)
            return rn;
          l = this.#c, this.#R(e.endpointID, r), s += 1, a += 1;
          break;
        }
        if (g) {
          m = this.#a;
          continue;
        }
        g || (a += 1, m = this.#a, this.#I(o));
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
    }) : this.#x(o, n) ? (this.#r.delete(n), ve) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Ma : this.#t !== e ? Ea : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #R(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        tn
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          va,
          e,
          void 0,
          tn
        );
      } catch {
      }
  }
  #_(e) {
    const n = _a(e);
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
    this.#a += 1, this.#S();
  }
  #y(e, n) {
    return !this.#i || this.#a !== e ? Promise.resolve(!0) : new Promise((i) => {
      let o = !1;
      const r = {
        finish: (a) => {
          o || (o = !0, r.timeoutHandle !== null && clearTimeout(r.timeoutHandle), this.#m.delete(r), i(a));
        },
        timeoutHandle: null
      };
      r.timeoutHandle = setTimeout(() => r.finish(!1), n), this.#m.add(r);
    });
  }
  #S() {
    for (const e of [...this.#m])
      e.finish(!0);
  }
}
const wa = 1e3, je = [le, ce];
function an(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ge(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (an(i, e)) return i[e];
  if (an(n, e)) return n[e];
}
function qe(t, e) {
  if (t === void 0) return li();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = ya(n, e);
  return i._tag === "ok" ? i.value : null;
}
function sn(t) {
  return new Set(t.routes.flatMap((e) => qn(e) === null ? [] : [e.id]));
}
function ln(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class ka {
  constructor(e) {
    this.connection = e, this.modulationLane = new on(e, { laneKind: "modulation" }), this.articulationLane = new on(e, { laneKind: "articulation" });
  }
  modulationState = rt();
  articulationBank = li();
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
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(ot, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(ot, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of je) this.connection.requestStoredStateValue(n);
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
    const n = Ge(e, le), i = n === void 0 ? { _tag: "ok", value: rt() } : jt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${le} is invalid; boot state was not installed.`);
      const a = Ge(e, ce), s = qe(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const o = Ge(e, ce), r = qe(
      o,
      sn(i.value)
    );
    if (r === null) {
      console.error(`[runtime-state-worker] ${ce} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !je.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === je.length) {
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
    if (e === le) {
      const o = jt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${le}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = qe(n, sn(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ce}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = ci(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, o = this.lastAppliedModulationGeneration !== e, r = zo(
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
    const s = this.buildUploadsBySelector(n, i), l = Array.from({ length: v }, (m, p) => {
      const g = s.get(p);
      return g ? ln(g) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, d = c && this.articulationLane.getAcceptedFrontier() !== 0, u = [];
    for (let m = 0; m < v; m += 1) {
      const p = s.get(m), g = l[m] !== this.lastAppliedArticulationTokens[m];
      d ? u.push({
        endpointID: Ve,
        value: p ?? Xt(m)
      }) : c ? p && u.push({ endpointID: Ve, value: p }) : g && u.push({
        endpointID: Ve,
        value: p ?? Xt(m)
      });
    }
    const h = await this.articulationLane.sendBatch(u);
    this.acceptOutcome("articulation", h, l) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = l, ia(
      Sa(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((o) => {
      const r = qn(o);
      return r === null ? [] : [[o.id, r]];
    }));
    return new Map(
      Ia(n, i).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = ln(i), r = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), r && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, wa));
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
function Da(t) {
  return new ka(t);
}
const di = 12, At = 5, fi = 8, La = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), xt = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones"
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
    "distortionWetLPKeyTrackOffsetSemitones"
  ],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
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
    "chorusRingLegacyClampEnabled"
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones"
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
    "phaserFrequencyKeyTrackOffsetSemitones"
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
    "delayFilterKeyTrackOffsetSemitones"
  ],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Et = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Na = Object.freeze([
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
]), Ca = Object.freeze({
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
function Pa(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function Mt(t, e) {
  const n = {};
  for (const a of xt[t]) {
    const s = e[a];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[a] = s;
      continue;
    }
    const l = Ca[a];
    if (l === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${a}`);
    n[a] = l;
  }
  const i = Et.chorus, o = Object.keys(e);
  return t === "chorus" && o.length === i.length && o.every((a) => i.includes(a)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Pa(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Fa(t) {
  return xt[t];
}
function Ka(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= At)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * fi + La[t];
}
function Ua(t, e) {
  const n = new Array(di).fill(0), i = Mt(t, e);
  return xt[t].forEach((o, r) => {
    n[r] = i[o];
  }), n;
}
const _ = "lane.v1", Ba = "laneTopology", cn = "laneSlotParams", at = 16, $a = 8, mi = 4, Va = 3, hi = At * fi, pi = 4, za = 4, Ha = hi, Wa = hi + pi, ja = 0, Ga = 1, qa = 2, Ja = 3, Xa = 4, Qa = 5;
function Ya(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > mi)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << $a;
}
const D = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), he = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Za = new Map(
  Object.entries(he).map(([t, e]) => [e, t])
), es = Object.freeze({
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
  D.map((t) => [es[t], t])
);
function gi() {
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
function ts(t) {
  return Object.fromEntries(
    ut(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function ns() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...D],
    enabled: gi(),
    params: Object.fromEntries(
      D.map((t) => [t, ts(t)])
    )
  };
}
function is(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${_} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${_} is not valid JSON: ${n}` };
  }
}
function Te(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function rs(t) {
  return typeof t != "string" ? null : D.find((e) => e === t) ?? null;
}
function os(t) {
  const e = is(t);
  if (e._tag === "err")
    return e;
  if (!Te(e.value))
    return { _tag: "err", message: `${_} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${_} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${_} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== D.length)
    return { _tag: "err", message: `${_}.order must contain every effect once` };
  const i = [], o = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const l = rs(s);
    if (l === null || o.has(l))
      return { _tag: "err", message: `${_}.order is not a complete permutation` };
    o.add(l), i.push(l);
  }
  if (!Te(e.value.enabled))
    return { _tag: "err", message: `${_}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== D.length)
    return { _tag: "err", message: `${_}.enabled must contain every effect once` };
  const r = gi();
  for (const s of D) {
    const l = e.value.enabled[s];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${_}.enabled.${s} must be boolean` };
    r[s] = l;
  }
  if (!Te(e.value.params))
    return { _tag: "err", message: `${_}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== D.length)
    return { _tag: "err", message: `${_}.params must contain every effect once` };
  const a = {};
  for (const s of D) {
    const l = e.value.params[s];
    if (!Te(l))
      return { _tag: "err", message: `${_}.params.${s} must be an object` };
    const d = ut(s).parameters.map((g) => g.endpointID), u = Et[he[s]], h = Reflect.ownKeys(l), m = (g) => h.length === g.length && h.every((R) => typeof R == "string" && g.includes(R));
    if (!m(d) && !m(u))
      return { _tag: "err", message: `${_}.params.${s} must contain every parameter once` };
    const p = {};
    for (const g of h) {
      if (typeof g != "string")
        return { _tag: "err", message: `${_}.params.${s} has an invalid parameter key` };
      const R = l[g];
      if (typeof R != "number" || !Number.isFinite(R))
        return { _tag: "err", message: `${_}.params.${s}.${g} must be a finite number` };
      p[g] = R;
    }
    a[s] = p;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: a }
  };
}
const as = Object.freeze([
  "voice.filterCutoff",
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
]), ss = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
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
  as.map((t) => [t, Object.freeze({
    id: t,
    family: ss[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ii = 40, yi = 18e3, st = D.map((t) => he[t]), ls = /^([a-zA-Z]+)#([1-9][0-9]*)$/, cs = /^(parallel|split)#([1-9][0-9]*)$/;
function _t(t) {
  if (typeof t != "string")
    return null;
  const e = ls.exec(t);
  if (e === null)
    return null;
  const n = st.find((o) => o === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > At ? null : { deviceType: n, instanceNumber: i };
}
function Si(t) {
  if (typeof t != "string")
    return null;
  const e = cs.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? pi : za) ? null : { groupKind: n, unitNumber: i };
}
function ne(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function fe(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function S(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function us(t, e) {
  const n = _t(t);
  if (n === null)
    return { failure: S(`device id ${t} is not a pool instance`) };
  if (!ne(e) || !fe(e, ["params"]) || !ne(e.params))
    return { failure: S(`device ${t} must be { params }`) };
  const i = Fa(n.deviceType), o = Et[n.deviceType], r = Za.get(n.deviceType);
  if (r === void 0)
    return { failure: S(`device ${t} has no effect descriptor`) };
  const a = ut(r).parameters.map((u) => u.endpointID), s = e.params, l = Object.keys(s), c = (u) => l.length === u.length && l.every((h) => u.includes(h));
  if (!(c(i) || c(o) || n.deviceType === "chorus" && c(Na) || c(a)))
    return { failure: S(`device ${t} must carry every parameter once`) };
  for (const u of l) {
    const h = s[u];
    if (typeof h != "number" || !Number.isFinite(h))
      return { failure: S(`device ${t}.${u} must be a finite number`) };
  }
  return { record: { params: Mt(n.deviceType, s) } };
}
function ds(t, e) {
  return !ne(t) || t.kind !== "device" ? { failure: S("branches may hold device placements only") } : fe(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: S(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: S(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: S("a device placement is { kind, deviceId, enabled }") };
}
function un(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Ii && t <= yi;
}
function fs(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return S(`is not valid JSON: ${d}`);
    }
  if (!ne(e) || !fe(e, ["format", "version", "devices", "chain"]))
    return S("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return S("must be cosimo.lane version 2");
  if (!ne(e.devices))
    return S("devices must be an object");
  if (!Array.isArray(e.chain))
    return S("chain must be an array");
  const n = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return S("device ids must be strings");
    const d = us(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    n[c] = d.record;
  }
  const i = new Set(Object.keys(n)), o = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), a = [];
  let s = 0;
  const l = (c) => {
    const d = ds(c, i);
    return "placement" in d && (o.set(
      d.placement.deviceId,
      (o.get(d.placement.deviceId) ?? 0) + 1
    ), s += 1), d;
  };
  for (const c of e.chain) {
    if (!ne(c))
      return S("chain nodes must be objects");
    if (c.kind === "device") {
      const w = l(c);
      if ("failure" in w)
        return w.failure;
      a.push(w.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return S(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", u = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], m = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], p = d && fe(c, u);
    if (!fe(c, m) && !p)
      return S(`a ${c.kind} group is { ${m.join(", ")} }`);
    const g = Si(c.groupId);
    if (g === null || g.groupKind !== c.kind)
      return S(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (r.has(String(c.groupId)))
      return S(`group ${String(c.groupId)} is used twice`);
    if (r.add(String(c.groupId)), typeof c.enabled != "boolean")
      return S(`group ${String(c.groupId)} needs a boolean enable`);
    const R = d ? Va : mi;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > R)
      return S(`group ${String(c.groupId)} needs 2..${R} branches`);
    if (d && (!un(c.xoverLowHz) || !un(c.xoverHighHz)))
      return S(`group ${String(c.groupId)} crossovers must sit in ${Ii}..${yi} Hz`);
    if (d && !p && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return S(`group ${String(c.groupId)} Key Track state must be finite`);
    s += 1;
    const L = [];
    for (const w of c.branches) {
      if (!Array.isArray(w))
        return S(`group ${String(c.groupId)} branches must be arrays`);
      const F = [];
      for (const z of w) {
        const N = l(z);
        if ("failure" in N)
          return N.failure;
        F.push(N.placement);
      }
      L.push(F);
    }
    a.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: p ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: p ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: p ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: p ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: L
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: L
    });
  }
  for (const c of i)
    if ((o.get(c) ?? 0) !== 1)
      return S(`device ${c} must be placed exactly once`);
  return s > at ? S(`flattens to ${s} wire entries; the topology upload holds ${at}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: a } };
}
function bi(t) {
  const e = {};
  for (const n of D) {
    const i = he[n];
    e[`${i}#1`] = {
      params: Mt(i, t.params[n])
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${he[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const dn = ["distortion#1", "delay#1", "reverb#1"];
function fn() {
  const t = bi(ns()), e = {};
  for (const n of dn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && dn.includes(n.deviceId))
  };
}
function ms(t) {
  if (t === void 0)
    return fn();
  const e = fs(t);
  if (e._tag === "ok")
    return e.value;
  const n = os(t);
  return n._tag === "ok" ? bi(n.value) : fn();
}
function hs(t) {
  return Object.keys(t.devices).map((e) => {
    const n = _t(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => st.indexOf(e.parsed.deviceType) - st.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function lt(t) {
  const e = _t(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Ka(e.deviceType, e.instanceNumber - 1);
}
function vi(t) {
  const e = Si(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ha : Wa) + (e.unitNumber - 1);
}
function ps(t) {
  const e = new Array(at).fill(0);
  let n = 0, i = 0;
  const o = (r, a, s) => {
    e[i] = Ya(r, a), s && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      o(lt(r.deviceId), 0, r.enabled);
      continue;
    }
    o(vi(r), r.branches.length, r.enabled), r.branches.forEach((a, s) => {
      for (const l of a)
        o(lt(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function gs(t) {
  const e = new Array(di).fill(0);
  return e[ja] = t.xoverLowHz, e[Ga] = t.xoverHighHz, e[qa] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Ja] = t.xoverLowKeyTrackOffsetSemitones, e[Xa] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[Qa] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Is(t) {
  const e = [];
  let n = 0;
  for (const i of hs(t))
    n += 1, e.push({
      endpointID: cn,
      value: {
        slotId: lt(i.instanceId),
        deliverySerial: n,
        values: Ua(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: cn,
      value: {
        slotId: vi(i),
        deliverySerial: n,
        values: gs(i)
      }
    }));
  return e.push({
    endpointID: Ba,
    value: ps(t)
  }), e;
}
const ys = 2e3;
function mn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ss(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return mn(i, e) ? {
    found: !0,
    value: i[e]
  } : mn(n, e) ? {
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
class bs {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = vs(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Ss(e, this.options.stateKey);
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
    for (const l of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(l))
        return;
      e[l] = this.parameterValues.get(l);
    }
    const n = {};
    for (const l of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(l.endpointID)) {
        if (l.required)
          return;
        continue;
      }
      n[l.endpointID] = this.runtimeEndpointValues.get(l.endpointID);
    }
    const i = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, o = hn(n), r = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, r), s = hn({
      runtimeEndpoints: n,
      events: a
    });
    if (s === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, i).then((l) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        l ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(a);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(a);
        const l = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, l && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const l of a)
      this.connection.sendEventOrValue?.(
        l.endpointID,
        l.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? ys
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
  }
}
function vs(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Ts(t, e) {
  return new bs(t, e);
}
function Rs(t) {
  return Ts(t, {
    stateKey: _,
    runtimeEndpointDependencies: [ba],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: ms,
    buildRuntimeEvents: ({ state: e }) => [...Is(e)]
  });
}
const As = "runtimeSyncRequest", xs = 2147483647, Es = "runtimeState", Ms = "retryDesiredTableRequest", _s = "workerLoadFailure", Os = "serviceLoadAbort", ws = "wavetableLoadBegin", ks = "wavetableMipFrame", Ds = "wavetableUploadAck", Ls = "wavetableMipRequest", Ns = "wavetablePrewarmRequest", Cs = "wavetablePrewarmNotification", Ps = "assets/factory-bank-catalog.json", ct = 3, Fs = 1, Ks = ct * Ae, Us = 1, Bs = 2, $s = 3, Vs = 1, zs = 2, Hs = 2e4, Re = Us, Ws = Bs, pn = $s, W = Vs, gn = zs, js = 48 * 1024 * 1024, Je = 3;
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
function Sn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function bn(t, e) {
  if (!t)
    throw new Error(e);
}
function Gs(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function qs(t, e) {
  return ki(await t.readJSON(e));
}
function Js(t) {
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
function Xs(t, e) {
  const n = Math.round(Number(t) || 0);
  return Gs(n, 0, Math.max(0, e - 1));
}
function Xe(t, e, n, i, o) {
  return `${t}:${e}:${n}:${i}:${o}`;
}
function Qs(t, e, n) {
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
function Rn() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Ys(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Zs {
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
    this.connection = e, this.resourceClient = wi(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ps, this.maxBatchesInFlight = In(
      n.maxFramesInFlight,
      Fs
    ), this.mipLevelCount = n.mipLevelCount ?? Mn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? js) || 0)), this.serviceLoadTimeoutMs = In(n.serviceLoadTimeoutMs, Hs), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, T("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Es, this.handleRuntimeState), this.connection.addEndpointListener?.(Ds, this.handleUploadAck), this.connection.addEndpointListener?.(Ls, this.handleMipRequest), this.connection.addEndpointListener?.(Ns, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Cs, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      As,
      xs
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await qs(this.resourceClient, this.catalogPath), T("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Je; n += 1)
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
        const i = Xe(
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
    failurePhase: a = Re,
    failureReasonCode: s = W
  }) {
    this.connection.sendEventOrValue?.(_s, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: o,
      candidateAttemptSerial: r,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: o,
    failureReasonCode: r = W
  }) {
    this.connection.sendEventOrValue?.(Os, {
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
    }), this.connection.sendEventOrValue?.(Ms, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), o = Xs(e, i.tables.length), r = i.tables[o];
    bn(r, `Could not resolve table ${o}`);
    const a = Qs(r, Ae, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, T("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = Rn();
    T("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(r.sourceWav), d = Pi(c.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: Ae
    });
    return T("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(Rn() - l)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: r,
      frameCount: d.frameCount,
      frames: d.frames,
      spectra: new Array(d.frameCount)
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(ws, {
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
      failurePhase: Re,
      failureReasonCode: W
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Re,
      failureReasonCode: W
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Re,
    failureReasonCode: i = W
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
        detail: Qe(r)
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
        detail: Qe(a)
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
    for (let e = 0; e < Je; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Ys(() => {
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
          failureReasonCode: W
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
    const n = Js(e ?? {});
    if (T("info", "Received runtime state", yn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Je)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const o = n.oscillatorIndex, r = this.latestRuntimeStates[o], a = r ? this.getDesiredRetryKey(r) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[o] = Math.max(
      this.nextLoadGenerations[o] ?? 1,
      n.generationFrontier + 1
    ), (i || a !== s) && (this.autoRetryConsumedKeys[o] = null), this.latestRuntimeStates[o] = n, this.pendingRuntimeStateOscillators.add(o), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const o = await this.loadTableSource(i);
        for (let a = 0; a < o.frameCount; a += 1)
          o.spectra[a] || (o.spectra[a] = Ft(o.frames[a]));
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
          detail: Qe(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = Xe(
      n,
      i,
      o,
      r,
      a
    );
    let c = this.mipJobs.get(l);
    return c ? (!c.completed && s > c.urgencyLevel && (c.urgencyLevel = s), c) : (c = {
      key: l,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: o,
      tableIndex: r,
      mipIndex: a,
      urgencyLevel: s,
      ...Tn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, c), c);
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), d = Xe(
      i,
      o,
      r,
      a,
      s
    ), u = this.mipJobs.get(d), h = this.serviceTable?.frameCount ?? 0, m = Math.min(
      ct,
      h - l
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(l) || c <= 0 || c !== m)) {
      u.inFlightBatchBases.delete(l);
      for (let p = 0; p < c; p += 1) {
        const g = l + p;
        u.ackedFrames[g] || (u.ackedFrames[g] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === h && u.nextFrameIndex >= h && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), Sn(l, c, h) && T("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: o,
        generation: r,
        tableIndex: u.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: c,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: h,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (bn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Ft(this.serviceTable.frames[e]);
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
        ct,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(Ks);
      try {
        for (let r = 0; r < i; r += 1) {
          const a = n + r, s = this.getSpectrumForFrame(a), l = Fi(s, e.mipIndex);
          o.set(l, r * Ae);
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
            failurePhase: Ws,
            failureReasonCode: W
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ks, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(o)
      }), Sn(n, i, this.serviceTable.frameCount) && T("info", "Sent wavetable mip batch", {
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
function Qe(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function el(t, e = {}) {
  return new Zs(t, e);
}
async function tl(t, e = {}) {
  return Bi(t, [
    Da,
    Rs,
    () => el(t, e)
  ]);
}
export {
  Fs as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Bs as FAILURE_PHASE_BUILD_MIP,
  Us as FAILURE_PHASE_LOAD_SOURCE,
  $s as FAILURE_PHASE_TRANSFER_MIP,
  Vs as FAILURE_REASON_GENERIC,
  zs as FAILURE_REASON_TIMEOUT,
  ct as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  xs as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Zs as WavetableWorkerController,
  el as createWavetableWorkerController,
  tl as default
};
