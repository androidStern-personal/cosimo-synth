function O(t, e) {
  if (!t)
    throw new Error(e);
}
function Ne(t, e, n) {
  let i = "";
  for (let o = 0; o < n; o += 1)
    i += String.fromCharCode(t.getUint8(e + o));
  return i;
}
function yi(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Ye(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function vn(t) {
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
function Ai() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ce(t, e) {
  const n = Ai();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (yi(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function _t(t) {
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
  throw new Error(`Unsupported text resource payload (${vn(t)})`);
}
function Ri(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Ye(t);
  throw new Error(`Unsupported binary resource payload (${vn(t)})`);
}
function Ti(t) {
  const e = t?.frames;
  O(
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
      O(a.length === 1, "Only mono wavetable source files are supported"), i[o] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Sn(t) {
  const e = new DataView(t);
  O(Ne(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), O(Ne(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, o = null, r = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const d = Ne(e, c, 4), h = e.getUint32(c + 4, !0), f = c + 8;
    d === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), o = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), r = e.getUint16(f + 14, !0)) : d === "data" && (l = f, s = h), c = f + h + h % 2;
  }
  O(n !== null, "Wave file is missing a fmt chunk"), O(l !== null && s !== null, "Wave file is missing a data chunk"), O(i === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && r === 32)
    u = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const d = s / 2, h = new Int16Array(t.slice(l, l + s));
    u = new Float32Array(d);
    for (let f = 0; f < d; f += 1)
      u[f] = h[f] / 32768;
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
async function wt(t) {
  O(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return O(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Ze(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function bn(t) {
  const e = new Uint8Array(t).buffer, n = Sn(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function xi(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (O(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), o = async (s) => {
    O(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return Ti(c);
  }, r = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const u = Ce(s, c), d = await wt(u), h = Sn(d);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const u = Ce(s, c);
    return new Uint8Array(await wt(u));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return _t(await i(s));
      const c = r(s);
      return e === "url" && c !== null ? Ze(await l(s, c)) : typeof t.readResource == "function" ? _t(await i(s)) : Ze(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Ri(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(s);
      const c = r(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? o(s) : bn(await this.readBytes(s));
    },
    getURL(s) {
      return Ce(s, t.getResourceAddress?.(s));
    }
  };
}
function Ei(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return xi(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Mi(t) {
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
      return o ? o(a) : bn(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function _i(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function wi(t) {
  return _i(t) ? Mi(t) : Ei(t);
}
const Ae = 2048;
function ae(t, e) {
  if (!t)
    throw new Error(e);
}
function Oi(t) {
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
const Di = 2048, yn = 11, ki = 256;
function L(t, e) {
  if (!t)
    throw new Error(e);
}
function Li(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Ot = /* @__PURE__ */ new Map();
function Ni(t) {
  const e = Ot.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let r = 0, a = o;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | a & 1, a >>= 1;
    i[o] = r;
  }
  return Ot.set(t, i), i;
}
function An(t, e, n = !1) {
  const i = t.length;
  L(i === e.length, "FFT real and imaginary buffers must have the same length"), L(Li(i), "FFT input length must be a power of two");
  const o = Ni(i);
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
      let d = 1, h = 0;
      for (let f = 0; f < a; f += 1) {
        const I = u + f, v = I + a, w = t[v], $ = e[v], k = d * w - h * $, ie = d * $ + h * w, re = t[I], oe = e[I];
        t[I] = re + k, e[I] = oe + ie, t[v] = re - k, e[v] = oe - ie;
        const pe = d * s - h * c;
        h = d * c + h * s, d = pe;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function Rn(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    o[r] = (Number(e[r]) || 0) - i;
  return o;
}
function Ci(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Di,
  maxFramesPerTable: i = ki
} = {}) {
  const o = Float32Array.from(t);
  L(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = o.length / n;
  L(r > 0, "Source wavetable files must contain at least one frame"), L(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && L(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, c = s + n;
    a.push(Rn(o.slice(s, c)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function Dt(t) {
  const e = Rn(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return An(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Pi(t, e, {
  mipLevelCount: n = yn
} = {}) {
  const i = t?.real?.length ?? 0;
  L(i > 0, "Spectrum must contain real samples"), L(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), L(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, i >> 1), r = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= o; l += 1) {
    r[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return An(r, a, !0), Float32Array.from(r);
}
class Fi {
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
  return new Fi(t, e);
}
async function Bi(t, e) {
  const n = Ui(t, e);
  return await n.start(), n;
}
const _ = (t, e) => ({ label: t, value: e });
function C(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const P = Object.freeze({
  filter: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: C(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: C(
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
  modulationDragStyle: l.modulationDragStyle
}), $i = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Vi = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Ki = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: P.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(_), quick: !0 }),
      m("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      m("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      m("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: P.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [_("Classic", 0), _("Harmonics", 1)] }),
      m("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      m("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      m("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      m("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      m("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      m("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [_("Symmetric", 0), _("Asymmetric", 1), _("Wavefold", 2)] })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: P.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      m("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      m("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      m("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      m("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      m("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: P.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      m("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(_) }),
      m("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(_) }),
      m("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      m("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      m("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      m("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      m("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(_) }),
      m("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: P.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      m("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      m("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      m("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      m("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: P.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      m("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [_("Free", 0), _("Sync", 1)] }),
      m("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      m("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: $i.map(_) }),
      m("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      m("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      m("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      m("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      m("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: P.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      m("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [_("Free", 0), _("Sync", 1)] }),
      m("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      m("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Vi.map(_) }),
      m("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      m("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      m("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: P.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      m("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      m("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      m("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      m("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], De = Ki, Tn = Object.freeze(
  De.flatMap((t) => t.parameters)
);
new Map(
  Tn.map((t) => [t.endpointID, t])
);
function xn(t) {
  const e = De.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function En() {
  return Tn;
}
const g = ["A", "B", "C"], Mn = [
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
], zi = [
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
], G = Object.freeze([
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
]), ji = Object.freeze([
  ...g.flatMap((t) => Mn.map(
    (e) => `osc${t}.${e}`
  )),
  ...zi
]);
new Set(
  g.flatMap((t) => Mn.map(
    (e) => `osc${t}.${e}`
  ))
);
const _n = Object.freeze(
  ji.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Wi = En().filter((t) => t.modulationTargetIndex !== null), Gi = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ut(t) {
  const e = Hi(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Hi(t) {
  const e = Gi.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const wn = Object.freeze(
  Wi.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: ut(t.endpointID),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), B = Object.freeze([
  ..._n,
  ...wn
]), Re = G.length, On = _n.length, ke = wn.length, qi = Re * B.length, Ji = new Map(G.map((t) => [t.id, t])), Dn = new Map(G.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ee = new Map(B.map((t) => [t.kind, t]));
function Qi() {
  if (Re !== 14 || On !== 56 || ke !== 36 || qi !== 1288)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = G.filter((i) => i.group === t).sort((i, o) => i.runtimeIndex - o.runtimeIndex);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 36]]) {
    const n = B.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Ji.size !== Re || Dn.size !== Re || ee.size !== B.length)
    throw new Error("Modulation identities must be unique");
}
Qi();
function kn(t, e) {
  const n = Dn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function dt(t) {
  return typeof t != "string" ? null : ee.has(t) ? t : null;
}
function Xi(t) {
  const e = dt(t);
  return e !== null && ee.get(e)?.group === "voice" ? e : null;
}
function Ln(t) {
  const e = dt(t);
  return e !== null && ee.get(e)?.group === "rack" ? e : null;
}
function Yi(t) {
  const e = ee.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Nn(t) {
  const e = ee.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Zi(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Cn = 4, er = Cn * ke, tr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]]
]), nr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function te(t) {
  if (typeof t != "string")
    return null;
  const e = nr.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = tr.get(n);
  if (i === void 0)
    return null;
  const o = e[3];
  return i.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function mt(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Pn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Fn(t) {
  if (t === null)
    return null;
  const e = Pn(t) - 1;
  return e > Cn ? null : e * ke + Nn(mt(t));
}
const U = 2048, ir = U + 3, kt = 20, Un = "MSEG 1", rr = 0, z = 2, or = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function ft(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Z(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function ar(t) {
  return ft(Number.isFinite(t) ? t : 0, -kt, kt);
}
function W(t) {
  return ft(Number.isFinite(t) ? t : 0, 0, 1);
}
function Bn(t = Un) {
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
function sr(t) {
  const e = Number(t);
  return ft(
    Number.isFinite(e) ? e : 1,
    rr,
    z
  );
}
function lr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = W(Number(e.startX)), i = W(Number(e.endX));
  return Z(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function cr(t = et()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), o = e.noteOffPolicy, r = or.has(o) ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: sr(Number.isFinite(i) ? i : 1)
    },
    loop: lr(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function ur(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let o = Number(i.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = W(o)), {
    x: o,
    y: W(Number(i.y)),
    curvePower: ar(Number(i.curvePower))
  };
}
function me(t = Bn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((o, r) => ur(o, r, n.length));
  if (!Z(i[0].x, 0) || !Z(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < i.length; o += 1)
    if (i[o].x < i[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Un,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Lt(t) {
  return JSON.stringify(me(t));
}
function dr(t, e) {
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
    if (Z(e, o.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && Z(t[r + 1].x, e); )
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
function fr(t, e) {
  const n = W(Number(e)), i = mr(t, n);
  if (i.laterPointWins || Z(i.from.x, i.to.x))
    return i.to.y;
  const o = i.to.x - i.from.x, r = o <= 0 ? 1 : (n - i.from.x) / o, a = W(dr(r, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function hr(t, e) {
  return fr(me(t).points, e);
}
function pr(t) {
  const e = me(t), n = new Float32Array(U);
  for (let o = 0; o < U; o += 1) {
    const r = o / (U - 1);
    n[o] = hr(e, r);
  }
  const i = new Float32Array(ir);
  return i[0] = n[0], i.set(n, 1), i[U + 1] = n[U - 1], i[U + 2] = n[U - 1], i;
}
function Nt(t, e) {
  return Lt(t) === Lt(e);
}
const Pe = "modulationProgram", gr = "modulationAmount", $n = G.filter((t) => t.group === "voice").length, Vn = G.filter((t) => t.group === "macro").length, Te = On, Ir = ke, xe = Ir + er, j = $n * Te, q = Vn * Te, vr = $n * xe, Sr = Vn * xe, V = 512, H = 256, Kn = j + q;
function br(t) {
  const e = kn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function yr(t) {
  const e = Xi(t);
  return e === null ? null : Yi(e);
}
function zn(t) {
  const e = yr(t.targetKind), n = Ln(t.targetKind);
  let i = n === null ? void 0 : Nn(n);
  if (i === void 0) {
    const a = Fn(
      te(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = kn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const l = a.runtimeIndex;
    if (e !== null) {
      const c = l * Te + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: l,
        targetIndex: e,
        articulationCellIndex: j + c
      };
    }
    const s = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: l * xe + s,
      sourceIndex: l,
      targetIndex: s,
      articulationCellIndex: null
    };
  }
  const o = br(t);
  if (e !== null) {
    const a = o * Te + e;
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
    cellIndex: o * xe + r,
    sourceIndex: o,
    targetIndex: r,
    articulationCellIndex: null
  };
}
function jn(t) {
  return te(t.targetKind) !== null ? null : zn(t).articulationCellIndex;
}
function Ar(t) {
  if (Ln(t.targetKind) !== null)
    return !1;
  const e = te(t.targetKind);
  return e !== null && Fn(e) === null;
}
function Rr(t) {
  return {
    ...zn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Wn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Ar(n))
      continue;
    const i = Rr(n), o = e[i.path];
    if (o.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    o.set(i.cellIndex, i);
  }
  return e;
}
function Tr(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function J(t) {
  return [...t.values()].filter(Tr).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ge(t, e, n, i, o) {
  for (let r = 0; r < t.length; r += 1) {
    const a = t[r];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${r}`);
    e[r] = a.cellIndex, n[r] = a.sourceIndex, i[r] = a.targetIndex, o[r] = a.polarity;
  }
}
function Fe(t) {
  const e = Wn(t), n = J(e.voice), i = J(e.macroVoice), o = J(e.voiceRack), r = J(e.macroRack), a = Array.from({ length: j }, () => 0), l = Array.from({ length: j }, () => 0), s = Array.from({ length: j }, () => 0), c = Array.from({ length: j }, () => 0), u = Array.from({ length: j }, () => 0);
  ge(n, a, l, s, c);
  const d = Array.from({ length: q }, () => 0), h = Array.from({ length: q }, () => 0), f = Array.from({ length: q }, () => 0), I = Array.from({ length: q }, () => 0), v = Array.from({ length: q }, () => 0);
  if (ge(
    i,
    d,
    h,
    f,
    I
  ), o.length > V || r.length > H)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${V}), ${r.length} macro-rack (max ${H})`
    );
  const w = Array.from({ length: V }, () => 0), $ = Array.from({ length: V }, () => 0), k = Array.from({ length: V }, () => 0), ie = Array.from({ length: V }, () => 0), re = Array.from({ length: V }, () => 0), oe = Array.from({ length: vr }, () => 0);
  ge(
    o,
    w,
    $,
    k,
    ie
  );
  const pe = Array.from({ length: H }, () => 0), Rt = Array.from({ length: H }, () => 0), Tt = Array.from({ length: H }, () => 0), xt = Array.from({ length: H }, () => 0), Et = Array.from({ length: Sr }, () => 0);
  ge(
    r,
    pe,
    Rt,
    Tt,
    xt
  );
  for (const x of e.voice.values()) u[x.cellIndex] = x.amount;
  for (const x of e.macroVoice.values()) v[x.cellIndex] = x.amount;
  for (const x of e.voiceRack.values()) oe[x.cellIndex] = x.amount;
  for (const x of e.macroRack.values()) Et[x.cellIndex] = x.amount;
  for (let x = 0; x < o.length; x += 1) {
    const Mt = o[x];
    if (Mt === void 0) throw new Error(`Missing compiled voice-rack route at index ${x}`);
    re[x] = Mt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: l,
    voiceRouteTargets: s,
    voiceRoutePolarities: c,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: h,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: I,
    macroVoiceRouteAmounts: v,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: w,
    voiceRackRouteSources: $,
    voiceRackRouteTargets: k,
    voiceRackRoutePolarities: ie,
    voiceRackRouteReducers: re,
    voiceRackRouteAmounts: oe,
    macroRackRouteCount: r.length,
    macroRackRouteCells: pe,
    macroRackRouteSources: Rt,
    macroRackRouteTargets: Tt,
    macroRackRoutePolarities: xt,
    macroRackRouteAmounts: Et
  };
}
const xr = ["voice", "macroVoice", "voiceRack", "macroRack"], Er = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Ct(t) {
  return Wn(t);
}
function Mr(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function _r(t, e) {
  if (t === null)
    return [{ endpointID: Pe, value: Fe(e) }];
  const n = Ct(t), i = Ct(e), o = [];
  for (const r of xr) {
    const a = J(n[r]), l = J(i[r]);
    if (a.length !== l.length)
      return [{ endpointID: Pe, value: Fe(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], u = l[s];
      if (c === void 0 || u === void 0 || !Mr(c, u))
        return [{ endpointID: Pe, value: Fe(e) }];
      c.amount !== u.amount && o.push({
        endpointID: gr,
        value: {
          pathKind: Er[r],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return o;
}
function ne(t) {
  return { _tag: "ok", value: t };
}
function ue(t) {
  return { _tag: "err", error: t };
}
function wr(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Or(t) {
  throw new Error(t ?? "Invariant violated");
}
const Dr = "globalTune", kr = "globalTuneSemitones", F = -24, se = 24, Pt = 0, Gn = -48, Hn = 48, tt = -48, qn = 6, ht = 0, Ft = (ht - tt) / (qn - tt);
function Ie(t, e, n, i, o = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: o, compound: r };
}
const Lr = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Ie("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ie("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Ie("mix", "Mix", 100, 100),
      Ie("drive", "Drive", 15, 0)
    ]
  }
], Ut = 1e-6;
function N(t, e) {
  if (!Number.isFinite(t) || t < -Ut || t > 1 + Ut)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Ee(t, e) {
  return N(t / 100, `${e} catalog percentage`);
}
function Le(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Nr(t) {
  return 20 * 1e3 ** t;
}
function Cr(t) {
  return N(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Pr(t) {
  return 0.1 * 200 ** t;
}
function Fr(t) {
  return N(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ur(t) {
  return t;
}
function Br(t) {
  return N(t, "filterMix endpoint conversion");
}
function de(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function $r(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: de("filterCutoff", Nr, Cr),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: de("filterQ", Pr, Fr),
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
function Jn(t) {
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
function Kr(t, e) {
  const n = Le(t.moduleId, e.id), i = Jn(e.format), o = $r(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Ee(e.defaultPercent, n),
    initialValue: Ee(e.initialPercent, n),
    format: i,
    modAmount: Vr(i),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const zr = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Ft * 100, defaultPercent: Ft * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function jr(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Wr(t, e) {
  const n = `osc${t}`, i = Le(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Ee(e.defaultPercent, i),
    initialValue: Ee(e.initialPercent, i),
    format: Jn(e.format),
    modAmount: jr(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Gr = Object.freeze(
  g.flatMap((t) => zr.map((e) => Wr(t, e)))
), Hr = Object.freeze({
  targetId: Le("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: N(
    (Pt - F) / (se - F),
    "Global Tune default"
  ),
  initialValue: N(
    (Pt - F) / (se - F),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: se },
  modAmount: {
    min: Gn,
    max: Hn,
    unit: "st",
    digits: 2
  },
  binding: de(
    Dr,
    (t) => F + (se - F) * t,
    (t) => N(
      (t - F) / (se - F),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: kr
}), qr = Object.freeze([
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
function Jr(t) {
  const e = Le(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, o = (r) => N(
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
  qr.map(Jr)
);
function Xr(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ue(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return N(n, `${t.endpointID} endpoint conversion`);
}
function Yr(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Zr(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function eo(t) {
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
function to(t) {
  const e = Xr(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ue(t, t.initial),
    initialValue: Ue(t, t.initial),
    format: Zr(t),
    modAmount: eo(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Yr(t, n),
      fromEngine: (n) => Ue(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ut(t.endpointID)
  });
}
const pt = Object.freeze(
  [
    ...De.flatMap((t) => t.parameters.map(to)),
    Hr,
    ...Gr,
    ...Qr,
    ...Lr.flatMap(
      (t) => t.parameters.map(
        (e) => Kr(t, e)
      )
    )
  ]
), no = new Map(
  pt.map((t) => [t.targetId, t])
), Qn = pt.filter(
  (t) => t.modulationTargetKind !== null
), nt = new Map(
  Qn.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (no.size !== pt.length)
  throw new Error("Target descriptor IDs must be unique");
if (Qn.length !== B.length || nt.size !== B.length || B.some((t) => nt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Be(t) {
  const e = nt.get(t);
  return e === void 0 ? Or(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  De.map((t) => [t.id, t.label])
);
function io(t) {
  const e = Pn(t);
  return e === 1 ? "" : ` ${e}`;
}
function ro(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = Be(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = te(t);
  if (n !== null) {
    const i = Be(mt(n));
    return `${i.moduleId.toUpperCase()}${io(n)} ${i.label.toUpperCase()}`;
  }
  return Be(t).label.toUpperCase();
}
const le = "modulation.v6", Xn = 6, fe = 3, Q = 3, oo = 4, Bt = "modulationMsegBuffer", ao = "modulationMsegPlayback", Yn = 4, so = ["MSEG 1", "MSEG 2", "MSEG 3"], Zn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], lo = ["Env 1", "Env 2", "Env 3"], co = 1e-3, S = 10, uo = 0.1, mo = 20, fo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: mo - uo },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Gn,
    max: Hn
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
  mseg1Rate: { min: -z, max: z },
  mseg2Rate: { min: -z, max: z },
  mseg3Rate: { min: -z, max: z },
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
  ampRelease: { min: -S, max: S }
}, ho = En().filter((t) => t.modulationTargetIndex !== null), ei = new Map(
  ho.map((t) => [ut(t.endpointID), t])
);
class $e extends Error {
  name = "ModulationStateParseError";
}
const po = {
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
G.map((t) => ({
  value: t.id,
  label: po[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const go = B.map((t) => ({
  value: t.kind,
  label: ro(t.kind)
}));
go.filter((t) => !vo(t.value));
function Io(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function gt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ve(t, e) {
  const n = Number(t);
  return gt(Number.isFinite(n) ? n : e, co, S);
}
function vo(t) {
  return ei.has(t);
}
function So(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function bo(t) {
  const e = te(t);
  return e !== null ? mt(e) : t;
}
function yo(t) {
  const e = bo(t), n = ei.get(e);
  return n !== void 0 ? So(n) : fo[Zi(e)];
}
function Ao(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Ro(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function To(t, e) {
  const n = yo(t), i = Number(e);
  return gt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function xo(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Eo(t) {
  return xo(t) ?? "mseg";
}
function Mo(t) {
  const e = dt(t);
  return e !== null ? e : te(t) !== null ? t : null;
}
function _o(t) {
  return Mo(t) ?? "oscA.wavetablePosition";
}
function wo(t, e) {
  const n = Zn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Oo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? fe : t === "macro" ? Yn : oo;
  return gt(Number.isFinite(n) ? n : 1, 1, i);
}
function X(t) {
  return {
    name: lo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function ti(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = X(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Ve(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Ve(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: W(n.sustain ?? i.sustain),
    releaseSeconds: Ve(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function Do(t, e = 0) {
  return { name: ti(t, e).name };
}
function ko(t, e, n, i) {
  const o = Number(t.amount);
  return {
    id: Ao(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Oo(n, t.sourceSlot),
    polarity: Ro(t.polarity),
    targetKind: i,
    amount: To(i, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Lo(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, o = Eo(i.sourceKind), r = _o(i.targetKind);
  return ko(i, e, o, r);
}
function No(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Co(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Lo(n, i));
}
function Po(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const o = No(i);
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
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => it(a, e[l]));
  const n = t, i = e, o = Object.keys(n), r = Object.keys(i);
  return o.length === r.length && o.every((a) => Io(i, a) && it(n[a], i[a]));
}
function ni(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = Bn(so[e] ?? `MSEG ${e + 1}`), o = me(n.shapeA ?? i), r = cr({
    ...et(),
    ...n.playback ?? {},
    rate: et().rate
  }), { rate: a, ...l } = r;
  return {
    shapeA: o,
    shapeB: me(n.shapeB ?? o),
    playback: l
  };
}
function rt() {
  return {
    format: "cosimo.modulation",
    version: Xn,
    msegSlots: Array.from({ length: fe }, (t, e) => ni({}, e)),
    envelopeSlots: Array.from({ length: Q }, (t, e) => ({
      name: X(e).name
    })),
    routes: [],
    macroNames: Zn.slice()
  };
}
function Fo(t = rt()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Xn,
    msegSlots: Array.from({ length: fe }, (r, a) => ni(n[a], a)),
    envelopeSlots: Array.from({ length: Q }, (r, a) => Do(i[a], a)),
    routes: Co(e.routes),
    macroNames: Array.from(
      { length: Yn },
      (r, a) => wo(o[a], a)
    )
  };
}
function $t(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ue(new $e("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ue(new $e("Expected valid modulation JSON"));
    }
  }
  const n = Fo(e);
  return !it(e, n) || !Po(n.routes) ? ue(new $e("Expected the current modulation schema")) : ne(n);
}
function Uo(t, e) {
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
function Vt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(pr(n))
  };
}
function Bo(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function $o(t, e = null) {
  const n = [];
  for (let i = 0; i < fe; i += 1) {
    const o = t.msegSlots[i], r = e?.msegSlots[i];
    (r === void 0 || !Nt(r.shapeA, o.shapeA)) && n.push({
      endpointID: Bt,
      value: Vt(i, 0, o.shapeA)
    }), (r === void 0 || !Nt(r.shapeB, o.shapeB)) && n.push({
      endpointID: Bt,
      value: Vt(i, 1, o.shapeB)
    }), (r === void 0 || !Bo(r.playback, o.playback)) && n.push({
      endpointID: ao,
      value: Uo(i, o.playback)
    });
  }
  return n.push(..._r(e?.routes ?? null, t.routes)), n;
}
const Ke = "articulationSnapshot", y = 128, Kt = 48, Vo = 1e6, T = -1, ze = [
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
function It(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function je(t) {
  return It(Number.isFinite(t) ? t : 0, 0, 1);
}
function E(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const o = Number(t);
  return It(Number.isFinite(o) ? o : e, n, i);
}
function R(t, e, n, i) {
  return It(Math.round(E(t, e)), n, i);
}
function ii(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function We() {
  return Array.from({ length: y }, () => T);
}
function Ko(t) {
  const e = R(t, 0, 0, y - 1), n = ze[e % ze.length], i = Math.floor(e / ze.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function zo() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: ht,
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
function jo(t) {
  const e = zo(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: E(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: E(n.pan, e.pan, -1, 1),
    octave: R(n.octave, e.octave, -4, 4),
    semitone: R(n.semitone, e.semitone, -12, 12),
    fineCents: E(n.fineCents, e.fineCents, -100, 100),
    volumeDb: E(
      n.volumeDb,
      e.volumeDb,
      tt,
      qn
    ),
    mute: R(n.mute, e.mute, 0, 1),
    solo: R(n.solo, e.solo, 0, 1),
    warpMode: R(n.warpMode, e.warpMode, 0, 4),
    warpAmount: E(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: R(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: E(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterQ: E(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: R(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: E(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: E(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: E(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: E(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: E(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: R(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: R(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: R(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: E(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: E(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      je(Number(i[0])),
      je(Number(i[1])),
      je(Number(i[2]))
    ]
  };
}
function Wo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: E(e.amount, 0, -48, 48)
  } : null;
}
function Go(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Wo).filter((o) => o !== null) : [], i = /* @__PURE__ */ new Map();
  for (const o of n)
    i.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: jo(e.parameters),
    envelopes: [0, 1, 2].map((o) => ti(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Ho(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = R(n.runtimeSlot, e, 0, y - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, r = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Ko(i);
  return {
    id: o,
    runtimeSlot: i,
    name: r,
    snapshot: Go(n.snapshot)
  };
}
function qo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: R(n.note, 0, 0, y - 1),
    articulationId: i
  } : null;
}
function Jo(t, e, n, i, o) {
  if (!t || typeof t != "object")
    return null;
  const r = t, a = typeof r.articulationId == "string" ? r.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let l = R(r.min, o, o, y - 1), s = R(r.max, l, o, y - 1);
  return s < l && ([l, s] = [s, l]), {
    id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: l,
    max: s
  };
}
function zt(t, e, n, i) {
  const o = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < o.length; l += 1) {
    const s = Jo(
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
function Qo(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), o = [];
  for (const r of n) {
    const a = qo(r, e);
    !a || i.has(a.note) || (i.add(a.note), o.push(a));
  }
  return o;
}
function Xo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), r = [];
  for (let s = 0; s < n.length && r.length < y; s += 1) {
    const c = Ho(n[s], s);
    !c || i.has(c.runtimeSlot) || o.has(c.id) || (i.add(c.runtimeSlot), o.add(c.id), r.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && r.some((s) => s.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(r.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ii(e.activeTriggerMode),
    slots: r,
    chainAssignments: zt(e.chainAssignments, l, "chain", 0),
    keyAssignments: Qo(e.keyAssignments, l),
    velocityAssignments: zt(e.velocityAssignments, l, "velocity", 1)
  };
}
function jt(t) {
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
    volumeDbs: e(ht),
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
    msegMorphs: Array.from({ length: fe }, () => 0),
    routeAmounts: Array.from({ length: Kn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: Q }, (n, i) => X(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: Q }, (n, i) => X(i).decaySeconds),
    envelopeSustain: Array.from({ length: Q }, (n, i) => X(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: Q }, (n, i) => X(i).releaseSeconds)
  };
}
function Wt(t, e, n) {
  for (const i of e) {
    const o = n.get(i.articulationId);
    if (o !== void 0)
      for (let r = i.min; r <= i.max; r += 1)
        t[r] === T && (t[r] = o);
  }
}
function Yo(t) {
  const e = Xo(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = We(), o = We(), r = We();
  Wt(i, e.chainAssignments, n), Wt(r, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const l = n.get(a.articulationId);
    l === void 0 || o[a.note] !== T || (o[a.note] = l);
  }
  return r[0] = T, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: o,
    velocity: r
  };
}
function Zo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Yo(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ii(e.activeMode),
    chain: Array.from({ length: y }, (n, i) => R(e.chain?.[i], T, T, y - 1)),
    key: Array.from({ length: y }, (n, i) => R(e.key?.[i], T, T, y - 1)),
    velocity: Array.from({ length: y }, (n, i) => i === 0 ? T : R(e.velocity?.[i], T, T, y - 1))
  });
}
function ea(t, e) {
  const n = Zo(t);
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
], St = [
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
], ta = [
  ...g.flatMap((t) => vt.map(
    (e) => `osc${t}.${e}`
  )),
  ...St
];
class ri extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function p(t) {
  return ue(new ri("malformed", t));
}
function he(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function bt(t, e, n) {
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
function Me(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < y;
}
function na(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function ia(t) {
  return ta.some((e) => e === t);
}
function Gt(t, e) {
  if (!he(t))
    return p(`${e} must be an object`);
  const n = bt(t, ["min", "max"], e);
  return n !== null ? p(n) : Me(t.min) ? Me(t.max) ? t.min > t.max ? p(`${e}.min must be less than or equal to ${e}.max`) : ne({ min: t.min, max: t.max }) : p(`${e}.max must be an integer in 0..127`) : p(`${e}.min must be an integer in 0..127`);
}
function ra(t, e) {
  if (!he(t))
    return p(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return p(`${e} has a non-string parameter id`);
    if (!ia(i))
      return p(`${e} has unknown parameter id "${i}"`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o))
      return p(`${e}.${i} must be a finite number`);
    n[i] = o;
  }
  return ne(n);
}
function oa(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function aa() {
  return {};
}
function sa(t, e, n) {
  if (!he(t))
    return p(`${e} must be an object`);
  const i = aa();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return p(`${e} has a non-string route id`);
    const r = t[o];
    if (typeof r != "number" || !Number.isFinite(r) || Math.abs(r) > Kt)
      return p(
        `${e}.${o} must be a finite route amount within ±${Kt}`
      );
    if (!n.has(o))
      return p(`${e}.${o} does not name a current articulable mapping`);
    oa(i, o, r);
  }
  return ne(i);
}
function la(t, e, n) {
  const i = `slots[${e}]`;
  if (!he(t))
    return p(`${i} must be an object`);
  const o = bt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (o !== null)
    return p(o);
  if (typeof t.id != "string")
    return p(`${i}.id must be a string`);
  if (!Me(t.runtimeSlot))
    return p(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return p(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return p(`${i}.color must be a string`);
  if (!Me(t.key))
    return p(`${i}.key must be an integer in 0..127`);
  const r = Gt(t.velRange, `${i}.velRange`);
  if (r._tag === "err")
    return r;
  const a = Gt(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = ra(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = sa(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : ne({
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
const ca = Object.fromEntries(
  vt.map((t, e) => [t, 2 ** e])
), ua = Object.fromEntries(
  St.map((t, e) => [t, 2 ** e])
);
function Ht(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function da(t, e) {
  return vt.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | ca[i] : n, 0);
}
function ma(t) {
  return St.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | ua[n] : e, 0);
}
function fa(t, e) {
  const n = (r, a) => Ht(t, `osc${r}.${a}`), i = (r) => Ht(t, r), o = Array.from(
    { length: Kn },
    () => Vo
  );
  for (const [r, a] of Object.entries(t.routeAmounts)) {
    const l = e[r];
    l !== void 0 && (o[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: g.map((r) => da(t, r)),
    sharedOverrideMask: ma(t),
    framePositions: g.map((r) => n(r, "framePosition")),
    pans: g.map((r) => n(r, "pan")),
    octaves: g.map((r) => n(r, "octave")),
    semitones: g.map((r) => n(r, "semitone")),
    fineCents: g.map((r) => n(r, "fineCents")),
    phases: g.map((r) => n(r, "phase")),
    phaseRandoms: g.map((r) => n(r, "phaseRandom")),
    retriggers: g.map((r) => n(r, "retrigger")),
    volumeDbs: g.map((r) => n(r, "volumeDb")),
    mutes: g.map((r) => n(r, "mute")),
    solos: g.map((r) => n(r, "solo")),
    warpModes: g.map((r) => n(r, "warpMode")),
    warpAmounts: g.map((r) => n(r, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterQ: i("filterQ"),
    unisonVoices: g.map((r) => n(r, "unisonVoices")),
    unisonDetunes: g.map((r) => n(r, "unisonDetune")),
    unisonBlends: g.map((r) => n(r, "unisonBlend")),
    unisonWidths: g.map((r) => n(r, "unisonWidth")),
    unisonDetuneModes: g.map((r) => n(r, "unisonDetuneMode")),
    unisonStackModes: g.map((r) => n(r, "unisonStackMode")),
    unisonWavetablePositionSpreads: g.map((r) => n(r, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: g.map((r) => n(r, "unisonWarpSpread")),
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
function ha(t, e) {
  return t.slots.map((n) => fa(n, e));
}
function pa(t, e) {
  if (!he(t))
    return p("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return p('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ue(new ri(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = bt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return p(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return p("selectedSlotId must be null or a string");
  if (!na(t.activeTriggerMode))
    return p('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return p("slots must be an array");
  if (t.slots.length > y)
    return p(`slots must contain at most ${y} entries`);
  const i = [], o = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = la(t.slots[a], a, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (o.has(s.id))
      return p(`slots[${a}].id duplicates "${s.id}"`);
    if (r.has(s.runtimeSlot))
      return p(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    o.add(s.id), r.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? p(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : ne({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function oi() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function ga(t) {
  const e = Array.from({ length: y }, () => T), n = Array.from({ length: y }, () => T), i = Array.from({ length: y }, () => T);
  for (const o of t.slots) {
    n[o.key] === T && (n[o.key] = o.runtimeSlot);
    for (let r = o.chainRange.min; r <= o.chainRange.max; r += 1)
      e[r] === T && (e[r] = o.runtimeSlot);
    for (let r = o.velRange.min; r <= o.velRange.max; r += 1)
      i[r] === T && (i[r] = o.runtimeSlot);
  }
  return i[0] = T, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const ot = "runtimeState";
function ai(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Ia = {
  endpointID: ot,
  required: !0,
  mapValue: ai
}, qt = "runtimeInstallAck", va = "runtimeSyncRequest", Jt = 0, Sa = 8e3, _e = /* @__PURE__ */ new WeakMap(), si = 1e9;
let ve = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % si;
function ba(t) {
  return ve = ve % si + 1, t === "modulation" ? -1e9 - ve : 1e9 + ve;
}
function ya(t, e) {
  const n = t, i = _e.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), _e.set(n, i);
}
function Qt(t, e) {
  const n = t, i = _e.get(n);
  i?.delete(e), i?.size === 0 && _e.delete(n);
}
const Aa = [100, 250, 500, 1e3], Se = { _tag: "accepted" }, Ra = { _tag: "superseded" }, Ta = { _tag: "stopped" }, Xt = { _tag: "transport-timeout" };
function xa(t) {
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
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof o != "number" || typeof r != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || o < 0 || r < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: r,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function Ea(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Yt {
  #o;
  #e;
  #d;
  #b;
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
  #y = this.#_.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#d = i && i.length > 0 ? i : [...Aa], this.#b = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Sa)
    );
  }
  start() {
    if (!this.#i) {
      ya(this.#o, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(qt, this.#y);
      } catch (e) {
        throw this.#i = !1, Qt(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(qt, this.#y), Qt(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#S());
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
    } : this.#A(e, n) : {
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
      const o = await this.#A(
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
      return r ?? Se;
    } finally {
      this.#m = !1;
    }
  }
  #T(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #x(e, n) {
    const i = this.#T(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #E() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #A(e, n) {
    if (this.#s === e)
      return Se;
    const i = ba(this.#e);
    this.#l.add(i);
    const o = Date.now() + this.#b;
    let r = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return Se;
        const l = o - Date.now();
        if (l <= 0)
          return Xt;
        const s = this.#a;
        this.#I(i), await this.#v(
          s,
          Math.min(this.#g(r), l)
        ), r += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const o = this.#E(), r = Ea(e.value, n, o);
    let a = 0, l = 0, s = this.#c;
    for (this.#R(e.endpointID, r); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const u = this.#h(n, o, s);
      if (u !== null)
        return u;
      const d = this.#a;
      await this.#v(
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
        const I = this.#p(n, i);
        if (I)
          return I;
        const v = await this.#v(
          f,
          this.#g(a)
        ), w = this.#h(
          n,
          o,
          s
        );
        if (w !== null)
          return w;
        if (v && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
          if (l >= 1)
            return Xt;
          s = this.#c, this.#R(e.endpointID, r), l += 1, a += 1;
          break;
        }
        if (v) {
          f = this.#a;
          continue;
        }
        v || (a += 1, f = this.#a, this.#I(o));
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
    }) : this.#x(o, n) ? (this.#r.delete(n), Se) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Ta : this.#t !== e ? Ra : null;
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
        Jt
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
          Jt
        );
      } catch {
      }
  }
  #_(e) {
    const n = xa(e);
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
  #v(e, n) {
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
  #S() {
    for (const e of [...this.#f])
      e.finish(!0);
  }
}
const Ma = 1e3, Ge = [le, ce];
function Zt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function He(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (Zt(i, e)) return i[e];
  if (Zt(n, e)) return n[e];
}
function qe(t, e) {
  if (t === void 0) return oi();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = pa(n, e);
  return i._tag === "ok" ? i.value : null;
}
function en(t) {
  return new Set(t.routes.flatMap((e) => jn(e) === null ? [] : [e.id]));
}
function tn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class _a {
  constructor(e) {
    this.connection = e, this.modulationLane = new Yt(e, { laneKind: "modulation" }), this.articulationLane = new Yt(e, { laneKind: "articulation" });
  }
  modulationState = rt();
  articulationBank = oi();
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
    { length: y },
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
      for (const n of Ge) this.connection.requestStoredStateValue(n);
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
    const n = He(e, le), i = n === void 0 ? { _tag: "ok", value: rt() } : $t(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${le} is invalid; boot state was not installed.`);
      const a = He(e, ce), l = qe(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const o = He(e, ce), r = qe(
      o,
      en(i.value)
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
    if (!(typeof n.key != "string" || !Ge.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Ge.length) {
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
      const o = $t(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${le}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = qe(n, en(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ce}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = ai(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, o = this.lastAppliedModulationGeneration !== e, r = $o(
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
    const l = this.buildUploadsBySelector(n, i), s = Array.from({ length: y }, (f, I) => {
      const v = l.get(I);
      return v ? tn(v) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, u = c && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let f = 0; f < y; f += 1) {
      const I = l.get(f), v = s[f] !== this.lastAppliedArticulationTokens[f];
      u ? d.push({
        endpointID: Ke,
        value: I ?? jt(f)
      }) : c ? I && d.push({ endpointID: Ke, value: I }) : v && d.push({
        endpointID: Ke,
        value: I ?? jt(f)
      });
    }
    const h = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", h, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, ea(
      ga(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((o) => {
      const r = jn(o);
      return r === null ? [] : [[o.id, r]];
    }));
    return new Map(
      ha(n, i).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = tn(i), r = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), r && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ma));
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
function wa(t) {
  return new _a(t);
}
const li = 8, yt = 5, ci = 8, Oa = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), ui = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
});
function di(t) {
  return ui[t];
}
function Da(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= yt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * ci + Oa[t];
}
function ka(t, e) {
  const n = new Array(li).fill(0);
  return ui[t].forEach((i, o) => {
    const r = e[i];
    if (typeof r != "number" || !Number.isFinite(r))
      throw new Error(`Missing lane parameter value: ${t}.${i}`);
    n[o] = r;
  }), n;
}
const M = "lane.v1", La = "laneTopology", nn = "laneSlotParams", at = 16, Na = 8, mi = 4, Ca = 3, fi = yt * ci, hi = 4, Pa = 4, Fa = fi, Ua = fi + hi, Ba = 0, $a = 1;
function Va(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > mi)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Na;
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
]), we = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
});
new Map(
  Object.entries(we).map(([t, e]) => [e, t])
);
const Ka = Object.freeze({
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
  D.map((t) => [Ka[t], t])
);
function pi() {
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
function za(t) {
  return Object.fromEntries(
    xn(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function ja() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...D],
    enabled: pi(),
    params: Object.fromEntries(
      D.map((t) => [t, za(t)])
    )
  };
}
function Wa(t) {
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
function be(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ga(t) {
  return typeof t != "string" ? null : D.find((e) => e === t) ?? null;
}
function Ha(t) {
  const e = Wa(t);
  if (e._tag === "err")
    return e;
  if (!be(e.value))
    return { _tag: "err", message: `${M} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const l of Reflect.ownKeys(e.value))
    if (typeof l != "string" || !n.has(l))
      return { _tag: "err", message: `${M} has unexpected field ${String(l)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${M} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== D.length)
    return { _tag: "err", message: `${M}.order must contain every effect once` };
  const i = [], o = /* @__PURE__ */ new Set();
  for (const l of e.value.order) {
    const s = Ga(l);
    if (s === null || o.has(s))
      return { _tag: "err", message: `${M}.order is not a complete permutation` };
    o.add(s), i.push(s);
  }
  if (!be(e.value.enabled))
    return { _tag: "err", message: `${M}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== D.length)
    return { _tag: "err", message: `${M}.enabled must contain every effect once` };
  const r = pi();
  for (const l of D) {
    const s = e.value.enabled[l];
    if (typeof s != "boolean")
      return { _tag: "err", message: `${M}.enabled.${l} must be boolean` };
    r[l] = s;
  }
  if (!be(e.value.params))
    return { _tag: "err", message: `${M}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== D.length)
    return { _tag: "err", message: `${M}.params must contain every effect once` };
  const a = {};
  for (const l of D) {
    const s = e.value.params[l];
    if (!be(s))
      return { _tag: "err", message: `${M}.params.${l} must be an object` };
    const c = xn(l).parameters;
    if (Reflect.ownKeys(s).length !== c.length)
      return { _tag: "err", message: `${M}.params.${l} must contain every parameter once` };
    const u = {};
    for (const d of c) {
      const h = s[d.endpointID];
      if (typeof h != "number" || !Number.isFinite(h))
        return { _tag: "err", message: `${M}.params.${l}.${d.endpointID} must be a finite number` };
      u[d.endpointID] = h;
    }
    a[l] = u;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: a }
  };
}
const gi = 40, Ii = 18e3, st = D.map((t) => we[t]), qa = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ja = /^(parallel|split)#([1-9][0-9]*)$/;
function At(t) {
  if (typeof t != "string")
    return null;
  const e = qa.exec(t);
  if (e === null)
    return null;
  const n = st.find((o) => o === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > yt ? null : { deviceType: n, instanceNumber: i };
}
function vi(t) {
  if (typeof t != "string")
    return null;
  const e = Ja.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? hi : Pa) ? null : { groupKind: n, unitNumber: i };
}
function Y(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Oe(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function b(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Qa(t, e) {
  const n = At(t);
  if (n === null)
    return { failure: b(`device id ${t} is not a pool instance`) };
  if (!Y(e) || !Oe(e, ["params"]) || !Y(e.params))
    return { failure: b(`device ${t} must be { params }`) };
  const i = di(n.deviceType);
  if (Reflect.ownKeys(e.params).length !== i.length)
    return { failure: b(`device ${t} must carry every parameter once`) };
  const o = {};
  for (const r of i) {
    const a = e.params[r];
    if (typeof a != "number" || !Number.isFinite(a))
      return { failure: b(`device ${t}.${r} must be a finite number`) };
    o[r] = a;
  }
  return { record: { params: o } };
}
function Xa(t, e) {
  return !Y(t) || t.kind !== "device" ? { failure: b("branches may hold device placements only") } : Oe(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: b(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: b(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: b("a device placement is { kind, deviceId, enabled }") };
}
function rn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= gi && t <= Ii;
}
function Ya(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const u = c instanceof Error ? c.message : String(c);
      return b(`is not valid JSON: ${u}`);
    }
  if (!Y(e) || !Oe(e, ["format", "version", "devices", "chain"]))
    return b("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return b("must be cosimo.lane version 2");
  if (!Y(e.devices))
    return b("devices must be an object");
  if (!Array.isArray(e.chain))
    return b("chain must be an array");
  const n = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return b("device ids must be strings");
    const u = Qa(c, e.devices[c]);
    if ("failure" in u)
      return u.failure;
    n[c] = u.record;
  }
  const i = new Set(Object.keys(n)), o = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), a = [];
  let l = 0;
  const s = (c) => {
    const u = Xa(c, i);
    return "placement" in u && (o.set(
      u.placement.deviceId,
      (o.get(u.placement.deviceId) ?? 0) + 1
    ), l += 1), u;
  };
  for (const c of e.chain) {
    if (!Y(c))
      return b("chain nodes must be objects");
    if (c.kind === "device") {
      const v = s(c);
      if ("failure" in v)
        return v.failure;
      a.push(v.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return b(`unknown chain node kind ${String(c.kind)}`);
    const u = c.kind === "split", d = u ? ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"] : ["kind", "groupId", "enabled", "branches"];
    if (!Oe(c, d))
      return b(`a ${c.kind} group is { ${d.join(", ")} }`);
    const h = vi(c.groupId);
    if (h === null || h.groupKind !== c.kind)
      return b(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (r.has(String(c.groupId)))
      return b(`group ${String(c.groupId)} is used twice`);
    if (r.add(String(c.groupId)), typeof c.enabled != "boolean")
      return b(`group ${String(c.groupId)} needs a boolean enable`);
    const f = u ? Ca : mi;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > f)
      return b(`group ${String(c.groupId)} needs 2..${f} branches`);
    if (u && (!rn(c.xoverLowHz) || !rn(c.xoverHighHz)))
      return b(`group ${String(c.groupId)} crossovers must sit in ${gi}..${Ii} Hz`);
    l += 1;
    const I = [];
    for (const v of c.branches) {
      if (!Array.isArray(v))
        return b(`group ${String(c.groupId)} branches must be arrays`);
      const w = [];
      for (const $ of v) {
        const k = s($);
        if ("failure" in k)
          return k.failure;
        w.push(k.placement);
      }
      I.push(w);
    }
    a.push(u ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      branches: I
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: I
    });
  }
  for (const c of i)
    if ((o.get(c) ?? 0) !== 1)
      return b(`device ${c} must be placed exactly once`);
  return l > at ? b(`flattens to ${l} wire entries; the topology upload holds ${at}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: a } };
}
function Si(t) {
  const e = {};
  for (const n of D) {
    const i = we[n];
    e[`${i}#1`] = {
      params: Object.fromEntries(di(i).map((o) => [
        o,
        t.params[n][o] ?? 0
      ]))
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${we[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const on = ["distortion#1", "delay#1", "reverb#1"];
function an() {
  const t = Si(ja()), e = {};
  for (const n of on) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && on.includes(n.deviceId))
  };
}
function Za(t) {
  if (t === void 0)
    return an();
  const e = Ya(t);
  if (e._tag === "ok")
    return e.value;
  const n = Ha(t);
  return n._tag === "ok" ? Si(n.value) : an();
}
function es(t) {
  return Object.keys(t.devices).map((e) => {
    const n = At(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => st.indexOf(e.parsed.deviceType) - st.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function lt(t) {
  const e = At(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Da(e.deviceType, e.instanceNumber - 1);
}
function bi(t) {
  const e = vi(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Fa : Ua) + (e.unitNumber - 1);
}
function ts(t) {
  const e = new Array(at).fill(0);
  let n = 0, i = 0;
  const o = (r, a, l) => {
    e[i] = Va(r, a), l && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      o(lt(r.deviceId), 0, r.enabled);
      continue;
    }
    o(bi(r), r.branches.length, r.enabled), r.branches.forEach((a, l) => {
      for (const s of a)
        o(lt(s.deviceId), l + 1, s.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function ns(t) {
  const e = new Array(li).fill(0);
  return e[Ba] = t.xoverLowHz, e[$a] = t.xoverHighHz, e;
}
function is(t) {
  const e = [];
  let n = 0;
  for (const i of es(t))
    n += 1, e.push({
      endpointID: nn,
      value: {
        slotId: lt(i.instanceId),
        deliverySerial: n,
        values: ka(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: nn,
      value: {
        slotId: bi(i),
        deliverySerial: n,
        values: ns(i)
      }
    }));
  return e.push({
    endpointID: La,
    value: ts(t)
  }), e;
}
const rs = 2e3;
function sn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function os(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return sn(i, e) ? {
    found: !0,
    value: i[e]
  } : sn(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function ln(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class as {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = ss(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = os(e, this.options.stateKey);
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
    }, o = ln(n), r = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, r), l = ln({
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
        this.options.sendTimeoutMilliseconds ?? rs
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
  }
}
function ss(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function ls(t, e) {
  return new as(t, e);
}
function cs(t) {
  return ls(t, {
    stateKey: M,
    runtimeEndpointDependencies: [Ia],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Za,
    buildRuntimeEvents: ({ state: e }) => [...is(e)]
  });
}
const us = "runtimeSyncRequest", ds = 2147483647, ms = "runtimeState", fs = "retryDesiredTableRequest", hs = "workerLoadFailure", ps = "serviceLoadAbort", gs = "wavetableLoadBegin", Is = "wavetableMipFrame", vs = "wavetableUploadAck", Ss = "wavetableMipRequest", bs = "wavetablePrewarmRequest", ys = "wavetablePrewarmNotification", As = "assets/factory-bank-catalog.json", ct = 3, Rs = 1, Ts = ct * Ae, xs = 1, Es = 2, Ms = 3, _s = 1, ws = 2, Os = 2e4, ye = xs, Ds = Es, cn = Ms, K = _s, un = ws, ks = 48 * 1024 * 1024, Je = 3;
function dn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function A(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function mn(t) {
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
function fn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function hn(t, e) {
  if (!t)
    throw new Error(e);
}
function Ls(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Ns(t, e) {
  return Oi(await t.readJSON(e));
}
function Cs(t) {
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
function Ps(t, e) {
  const n = Math.round(Number(t) || 0);
  return Ls(n, 0, Math.max(0, e - 1));
}
function Qe(t, e, n, i, o) {
  return `${t}:${e}:${n}:${i}:${o}`;
}
function Fs(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function pn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function gn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function In() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Us(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Bs {
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
    this.connection = e, this.resourceClient = wi(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? As, this.maxBatchesInFlight = dn(
      n.maxFramesInFlight,
      Rs
    ), this.mipLevelCount = n.mipLevelCount ?? yn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? ks) || 0)), this.serviceLoadTimeoutMs = dn(n.serviceLoadTimeoutMs, Os), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, A("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ms, this.handleRuntimeState), this.connection.addEndpointListener?.(vs, this.handleUploadAck), this.connection.addEndpointListener?.(Ss, this.handleMipRequest), this.connection.addEndpointListener?.(bs, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ys, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      us,
      ds
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Ns(this.resourceClient, this.catalogPath), A("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = pn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: pn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Qe(
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
          ...gn(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (A("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: cn,
          failureReasonCode: un
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== cn || e.failureReasonCode !== un ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: o = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = ye,
    failureReasonCode: l = K
  }) {
    this.connection.sendEventOrValue?.(hs, {
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
    failureReasonCode: r = K
  }) {
    this.connection.sendEventOrValue?.(ps, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: o,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    A("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? mn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(fs, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), o = Ps(e, i.tables.length), r = i.tables[o];
    hn(r, `Could not resolve table ${o}`);
    const a = Fs(r, Ae, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, A("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = In();
    A("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(r.sourceWav), u = Ci(c.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: Ae
    });
    return A("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(In() - s)
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
    A("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(gs, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    A("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: ye,
      failureReasonCode: K
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: ye,
      failureReasonCode: K
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = ye,
    failureReasonCode: i = K
  } = {}) {
    A("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (A("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Xe(r)
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
      this.isCurrentRuntimeState(e) && (A("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Xe(a)
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
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Us(() => {
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
        A("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: K
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
    const n = Cs(e ?? {});
    if (A("info", "Received runtime state", mn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Je)
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
          o.spectra[a] || (o.spectra[a] = Dt(o.frames[a]));
        const r = this.tableCache.get(o.cacheKey);
        r && this.refreshCacheEntryByteCount(r), A("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        A("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Xe(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Qe(
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
      ...gn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (A("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), u = Qe(
      i,
      o,
      r,
      a,
      l
    ), d = this.mipJobs.get(u), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      ct,
      h - s
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(s) || c <= 0 || c !== f)) {
      d.inFlightBatchBases.delete(s);
      for (let I = 0; I < c; I += 1) {
        const v = s + I;
        d.ackedFrames[v] || (d.ackedFrames[v] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === h && d.nextFrameIndex >= h && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), fn(s, c, h) && A("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: o,
        generation: r,
        tableIndex: d.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: c,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: h,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (hn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Dt(this.serviceTable.frames[e]);
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
      ), o = new Float32Array(Ts);
      try {
        for (let r = 0; r < i; r += 1) {
          const a = n + r, l = this.getSpectrumForFrame(a), s = Pi(l, e.mipIndex);
          o.set(s, r * Ae);
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
            failurePhase: Ds,
            failureReasonCode: K
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Is, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(o)
      }), fn(n, i, this.serviceTable.frameCount) && A("info", "Sent wavetable mip batch", {
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
function Xe(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function $s(t, e = {}) {
  return new Bs(t, e);
}
async function Vs(t, e = {}) {
  return Bi(t, [
    wa,
    cs,
    () => $s(t, e)
  ]);
}
export {
  Rs as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  Es as FAILURE_PHASE_BUILD_MIP,
  xs as FAILURE_PHASE_LOAD_SOURCE,
  Ms as FAILURE_PHASE_TRANSFER_MIP,
  _s as FAILURE_REASON_GENERIC,
  ws as FAILURE_REASON_TIMEOUT,
  ct as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  ds as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Bs as WavetableWorkerController,
  $s as createWavetableWorkerController,
  Vs as default
};
