function w(t, e) {
  if (!t)
    throw new Error(e);
}
function Me(t, e, n) {
  let i = "";
  for (let o = 0; o < n; o += 1)
    i += String.fromCharCode(t.getUint8(e + o));
  return i;
}
function $n(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function ze(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Zt(t) {
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
function Vn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ee(t, e) {
  const n = Vn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if ($n(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function ht(t) {
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
  throw new Error(`Unsupported text resource payload (${Zt(t)})`);
}
function Kn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return ze(t);
  throw new Error(`Unsupported binary resource payload (${Zt(t)})`);
}
function zn(t) {
  const e = t?.frames;
  w(
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
      w(a.length === 1, "Only mono wavetable source files are supported"), i[o] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function en(t) {
  const e = new DataView(t);
  w(Me(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), w(Me(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, o = null, r = null, a = null, l = null, s = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = Me(e, c, 4), h = e.getUint32(c + 4, !0), f = c + 8;
    u === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), o = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), r = e.getUint16(f + 14, !0)) : u === "data" && (l = f, s = h), c = f + h + h % 2;
  }
  w(n !== null, "Wave file is missing a fmt chunk"), w(l !== null && s !== null, "Wave file is missing a data chunk"), w(i === 1, "Only mono wavetable bank files are supported");
  let m;
  if (n === 3 && r === 32)
    m = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const u = s / 2, h = new Int16Array(t.slice(l, l + s));
    m = new Float32Array(u);
    for (let f = 0; f < u; f += 1)
      m[f] = h[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: o ?? 0,
    bitsPerSample: r,
    blockAlign: a ?? 0,
    samples: m
  };
}
async function pt(t) {
  w(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return w(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function je(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function tn(t) {
  const e = new Uint8Array(t).buffer, n = en(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function jn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (w(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), o = async (s) => {
    w(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const c = await t.readResourceAsAudioData(s);
    return zn(c);
  }, r = (s) => {
    const c = t.getResourceAddress?.(s);
    return c ?? null;
  }, a = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Ee(s, c), u = await pt(m), h = en(u);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, l = async (s, c = t.getResourceAddress?.(s)) => {
    const m = Ee(s, c);
    return new Uint8Array(await pt(m));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return ht(await i(s));
      const c = r(s);
      return e === "url" && c !== null ? je(await l(s, c)) : typeof t.readResource == "function" ? ht(await i(s)) : je(await l(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? Kn(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(s);
      const c = r(s);
      return n === "url" && c !== null ? a(s, c) : typeof t.readResourceAsAudioData == "function" ? o(s) : tn(await this.readBytes(s));
    },
    getURL(s) {
      return Ee(s, t.getResourceAddress?.(s));
    }
  };
}
function Wn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return jn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Gn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, o = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return je(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return ze(await e(a));
      if (n)
        return ze(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : tn(await this.readBytes(a));
    },
    getURL(a) {
      return r ? r(a) : null;
    }
  };
}
function qn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Hn(t) {
  return qn(t) ? Gn(t) : Wn(t);
}
const Ie = 2048;
function ne(t, e) {
  if (!t)
    throw new Error(e);
}
function Jn(t) {
  ne(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    ne(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), ne(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), ne(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), ne(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Qn = 2048, nn = 11, Xn = 256;
function _(t, e) {
  if (!t)
    throw new Error(e);
}
function Yn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const gt = /* @__PURE__ */ new Map();
function Zn(t) {
  const e = gt.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let r = 0, a = o;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | a & 1, a >>= 1;
    i[o] = r;
  }
  return gt.set(t, i), i;
}
function rn(t, e, n = !1) {
  const i = t.length;
  _(i === e.length, "FFT real and imaginary buffers must have the same length"), _(Yn(i), "FFT input length must be a power of two");
  const o = Zn(i);
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
    for (let m = 0; m < i; m += r) {
      let u = 1, h = 0;
      for (let f = 0; f < a; f += 1) {
        const I = m + f, b = I + a, O = t[b], X = e[b], Y = u * O - h * X, Z = u * X + h * O, ee = t[I], te = e[I];
        t[I] = ee + Y, e[I] = te + Z, t[b] = ee - Y, e[b] = te - Z;
        const ue = u * s - h * c;
        h = u * c + h * s, u = ue;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function on(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    o[r] = (Number(e[r]) || 0) - i;
  return o;
}
function ei(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Qn,
  maxFramesPerTable: i = Xn
} = {}) {
  const o = Float32Array.from(t);
  _(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = o.length / n;
  _(r > 0, "Source wavetable files must contain at least one frame"), _(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && _(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const a = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, c = s + n;
    a.push(on(o.slice(s, c)));
  }
  return {
    frameCount: r,
    frames: a
  };
}
function It(t) {
  const e = on(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return rn(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function ti(t, e, {
  mipLevelCount: n = nn
} = {}) {
  const i = t?.real?.length ?? 0;
  _(i > 0, "Spectrum must contain real samples"), _(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), _(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, i >> 1), r = new Float64Array(i), a = new Float64Array(i);
  for (let l = 1; l <= o; l += 1) {
    r[l] = t.real[l], a[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], a[s] = t.imaginary[s]);
  }
  return rn(r, a, !0), Float32Array.from(r);
}
class ni {
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
function ii(t, e) {
  return new ni(t, e);
}
async function ri(t, e) {
  const n = ii(t, e);
  return await n.start(), n;
}
const E = (t, e) => ({ label: t, value: e });
function k(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const C = Object.freeze({
  filter: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: k(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: k(
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
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear"),
  modulationDragStyle: l.modulationDragStyle
}), oi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ai = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], si = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: C.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(E), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: C.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [E("Classic", 0), E("Harmonics", 1)] }),
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
    iconUrl: C.ott,
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
    iconUrl: C.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(E) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(E) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(E) }),
      d("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: C.flanger,
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
    iconUrl: C.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [E("Free", 0), E("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: oi.map(E) }),
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
    iconUrl: C.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [E("Free", 0), E("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ai.map(E) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: C.reverb,
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
], Xe = si, an = Object.freeze(
  Xe.flatMap((t) => t.parameters)
);
new Map(
  an.map((t) => [t.endpointID, t])
);
function sn(t) {
  const e = Xe.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function ln() {
  return an;
}
const g = ["A", "B", "C"], li = [
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
], ci = [
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
], K = Object.freeze([
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
]), ui = Object.freeze([
  ...g.flatMap((t) => li.map(
    (e) => `osc${t}.${e}`
  )),
  ...ci
]), cn = Object.freeze(
  ui.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), di = ln().filter((t) => t.modulationTargetIndex !== null), un = Object.freeze(
  di.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: `rack.${t.endpointID}`,
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), N = Object.freeze([
  ...cn,
  ...un
]), Se = K.length, dn = cn.length, ae = un.length, mi = Se * N.length, fi = new Map(K.map((t) => [t.id, t])), mn = new Map(K.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), H = new Map(N.map((t) => [t.kind, t]));
function hi() {
  if (Se !== 13 || dn !== 51 || ae !== 36 || mi !== 1131)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = K.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 51], ["rack", 36]]) {
    const n = N.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, o) => i.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (fi.size !== Se || mn.size !== Se || H.size !== N.length)
    throw new Error("Modulation identities must be unique");
}
hi();
function fn(t, e) {
  const n = mn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Ye(t) {
  return typeof t != "string" ? null : H.has(t) ? t : null;
}
function pi(t) {
  const e = Ye(t);
  return e !== null && H.get(e)?.group === "voice" ? e : null;
}
function gi(t) {
  const e = Ye(t);
  return e !== null && H.get(e)?.group === "rack" ? e : null;
}
function Ii(t) {
  const e = H.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function hn(t) {
  const e = H.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Si(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const pn = 4, bi = pn * ae, vi = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]]
]), yi = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Te(t) {
  if (typeof t != "string")
    return null;
  const e = yi.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = vi.get(n);
  if (i === void 0)
    return null;
  const o = e[3];
  return i.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function gn(t) {
  return `rack.${t.endpointID}`;
}
function In(t, e) {
  if (t === null)
    return null;
  const n = e.get(t.instanceId);
  return n === void 0 || !Number.isInteger(n) || n < 0 || n >= pn ? null : ae + n * ae + hn(gn(t));
}
const L = 2048, Ri = L + 3, St = 20, Sn = "MSEG 1", Ai = 0, U = 2, xi = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Ze(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function q(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Ti(t) {
  return Ze(Number.isFinite(t) ? t : 0, -St, St);
}
function V(t) {
  return Ze(Number.isFinite(t) ? t : 0, 0, 1);
}
function bn(t = Sn) {
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
function We() {
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
function Mi(t) {
  const e = Number(t);
  return Ze(
    Number.isFinite(e) ? e : 1,
    Ai,
    U
  );
}
function Ei(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = V(Number(e.startX)), i = V(Number(e.endX));
  return q(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function wi(t = We()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), o = e.noteOffPolicy, r = xi.has(o) ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Mi(Number.isFinite(i) ? i : 1)
    },
    loop: Ei(e.loop),
    noteOffPolicy: r,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Di(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let o = Number(i.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = V(o)), {
    x: o,
    y: V(Number(i.y)),
    curvePower: Ti(Number(i.curvePower))
  };
}
function se(t = bn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((o, r) => Di(o, r, n.length));
  if (!q(i[0].x, 0) || !q(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < i.length; o += 1)
    if (i[o].x < i[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Sn,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function bt(t) {
  return JSON.stringify(se(t));
}
function _i(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function Oi(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: i, to: o, laterPointWins: !1 };
    if (q(e, o.x)) {
      let r = n + 1;
      for (; r + 1 < t.length && q(t[r + 1].x, e); )
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
function ki(t, e) {
  const n = V(Number(e)), i = Oi(t, n);
  if (i.laterPointWins || q(i.from.x, i.to.x))
    return i.to.y;
  const o = i.to.x - i.from.x, r = o <= 0 ? 1 : (n - i.from.x) / o, a = V(_i(r, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Ci(t, e) {
  return ki(se(t).points, e);
}
function Li(t) {
  const e = se(t), n = new Float32Array(L);
  for (let o = 0; o < L; o += 1) {
    const r = o / (L - 1);
    n[o] = Ci(e, r);
  }
  const i = new Float32Array(Ri);
  return i[0] = n[0], i.set(n, 1), i[L + 1] = n[L - 1], i[L + 2] = n[L - 1], i;
}
function vt(t, e) {
  return bt(t) === bt(e);
}
const we = "modulationProgram", Ni = "modulationAmount", vn = K.filter((t) => t.group === "voice").length, yn = K.filter((t) => t.group === "macro").length, ve = dn, Pi = ae, ye = Pi + bi, B = vn * ve, j = yn * ve, Fi = vn * ye, Ui = yn * ye, P = 512, z = 256, Rn = B + j;
function Bi(t) {
  const e = fn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function $i(t) {
  const e = pi(t);
  return e === null ? null : Ii(e);
}
function An(t, e = et) {
  const n = $i(t.targetKind), i = gi(t.targetKind);
  let o = i === null ? void 0 : hn(i);
  if (o === void 0) {
    const l = In(
      Te(t.targetKind),
      e
    );
    l !== null && (o = l);
  }
  if (n === null && o === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const l = fn(t.sourceKind, t.sourceSlot);
    if (l.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = l.runtimeIndex;
    if (n !== null) {
      const m = s * ve + n;
      return {
        path: "macroVoice",
        cellIndex: m,
        sourceIndex: s,
        targetIndex: n,
        articulationCellIndex: B + m
      };
    }
    const c = o ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * ye + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const r = Bi(t);
  if (n !== null) {
    const l = r * ve + n;
    return {
      path: "voice",
      cellIndex: l,
      sourceIndex: r,
      targetIndex: n,
      articulationCellIndex: l
    };
  }
  const a = o ?? 0;
  return {
    path: "voiceRack",
    cellIndex: r * ye + a,
    sourceIndex: r,
    targetIndex: a,
    articulationCellIndex: null
  };
}
function xn(t) {
  return An(t).articulationCellIndex;
}
const et = /* @__PURE__ */ new Map();
function Vi(t, e) {
  const n = Te(t.targetKind);
  return n !== null && In(n, e) === null;
}
function Ki(t, e) {
  return {
    ...An(t, e),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Tn(t, e = et) {
  const n = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const i of t) {
    if (Vi(i, e))
      continue;
    const o = Ki(i, e), r = n[o.path];
    if (r.has(o.cellIndex))
      throw new Error(`Duplicate modulation route cell ${o.path}:${o.cellIndex}`);
    r.set(o.cellIndex, o);
  }
  return n;
}
function zi(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function W(t) {
  return [...t.values()].filter(zi).sort((e, n) => e.cellIndex - n.cellIndex);
}
function de(t, e, n, i, o) {
  for (let r = 0; r < t.length; r += 1) {
    const a = t[r];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${r}`);
    e[r] = a.cellIndex, n[r] = a.sourceIndex, i[r] = a.targetIndex, o[r] = a.polarity;
  }
}
function De(t, e = et) {
  const n = Tn(t, e), i = W(n.voice), o = W(n.macroVoice), r = W(n.voiceRack), a = W(n.macroRack), l = Array.from({ length: B }, () => 0), s = Array.from({ length: B }, () => 0), c = Array.from({ length: B }, () => 0), m = Array.from({ length: B }, () => 0), u = Array.from({ length: B }, () => 0);
  de(i, l, s, c, m);
  const h = Array.from({ length: j }, () => 0), f = Array.from({ length: j }, () => 0), I = Array.from({ length: j }, () => 0), b = Array.from({ length: j }, () => 0), O = Array.from({ length: j }, () => 0);
  if (de(
    o,
    h,
    f,
    I,
    b
  ), r.length > P || a.length > z)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${P}), ${a.length} macro-rack (max ${z})`
    );
  const X = Array.from({ length: P }, () => 0), Y = Array.from({ length: P }, () => 0), Z = Array.from({ length: P }, () => 0), ee = Array.from({ length: P }, () => 0), te = Array.from({ length: P }, () => 0), ue = Array.from({ length: Fi }, () => 0);
  de(
    r,
    X,
    Y,
    Z,
    ee
  );
  const lt = Array.from({ length: z }, () => 0), ct = Array.from({ length: z }, () => 0), ut = Array.from({ length: z }, () => 0), dt = Array.from({ length: z }, () => 0), mt = Array.from({ length: Ui }, () => 0);
  de(
    a,
    lt,
    ct,
    ut,
    dt
  );
  for (const x of n.voice.values()) u[x.cellIndex] = x.amount;
  for (const x of n.macroVoice.values()) O[x.cellIndex] = x.amount;
  for (const x of n.voiceRack.values()) ue[x.cellIndex] = x.amount;
  for (const x of n.macroRack.values()) mt[x.cellIndex] = x.amount;
  for (let x = 0; x < r.length; x += 1) {
    const ft = r[x];
    if (ft === void 0) throw new Error(`Missing compiled voice-rack route at index ${x}`);
    te[x] = ft.reducer;
  }
  return {
    voiceRouteCount: i.length,
    voiceRouteCells: l,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: m,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: o.length,
    macroVoiceRouteCells: h,
    macroVoiceRouteSources: f,
    macroVoiceRouteTargets: I,
    macroVoiceRoutePolarities: b,
    macroVoiceRouteAmounts: O,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: X,
    voiceRackRouteSources: Y,
    voiceRackRouteTargets: Z,
    voiceRackRoutePolarities: ee,
    voiceRackRouteReducers: te,
    voiceRackRouteAmounts: ue,
    macroRackRouteCount: a.length,
    macroRackRouteCells: lt,
    macroRackRouteSources: ct,
    macroRackRouteTargets: ut,
    macroRackRoutePolarities: dt,
    macroRackRouteAmounts: mt
  };
}
const ji = ["voice", "macroVoice", "voiceRack", "macroRack"], Wi = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function yt(t) {
  return Tn(t);
}
function Gi(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function qi(t, e) {
  if (t === null)
    return [{ endpointID: we, value: De(e) }];
  const n = yt(t), i = yt(e), o = [];
  for (const r of ji) {
    const a = W(n[r]), l = W(i[r]);
    if (a.length !== l.length)
      return [{ endpointID: we, value: De(e) }];
    for (let s = 0; s < l.length; s += 1) {
      const c = a[s], m = l[s];
      if (c === void 0 || m === void 0 || !Gi(c, m))
        return [{ endpointID: we, value: De(e) }];
      c.amount !== m.amount && o.push({
        endpointID: Ni,
        value: {
          pathKind: Wi[r],
          cellIndex: m.cellIndex,
          amount: m.amount
        }
      });
    }
  }
  return o;
}
function J(t) {
  return { _tag: "ok", value: t };
}
function oe(t) {
  return { _tag: "err", error: t };
}
function Hi(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Ji(t) {
  throw new Error(t ?? "Invariant violated");
}
function me(t, e, n, i, o = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: o, compound: r };
}
const Qi = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      me("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      me("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      me("mix", "Mix", 100, 100),
      me("drive", "Drive", 15, 0)
    ]
  }
], Rt = 1e-6;
function Q(t, e) {
  if (!Number.isFinite(t) || t < -Rt || t > 1 + Rt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Re(t, e) {
  return Q(t / 100, `${e} catalog percentage`);
}
function tt(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Xi(t) {
  return 20 * 1e3 ** t;
}
function Yi(t) {
  return Q(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Zi(t) {
  return 0.1 * 200 ** t;
}
function er(t) {
  return Q(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function tr(t) {
  return t;
}
function nr(t) {
  return Q(t, "filterMix endpoint conversion");
}
function be(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ir(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: be("filterCutoff", Xi, Yi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: be("filterQ", Zi, er),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: be("filterMix", tr, nr),
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
function Mn(t) {
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
      return Hi(t);
  }
}
function rr(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function or(t, e) {
  const n = tt(t.moduleId, e.id), i = Mn(e.format), o = ir(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Re(e.defaultPercent, n),
    initialValue: Re(e.initialPercent, n),
    format: i,
    modAmount: rr(i),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
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
  const n = `osc${t}`, i = tt(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Re(e.defaultPercent, i),
    initialValue: Re(e.initialPercent, i),
    format: Mn(e.format),
    modAmount: sr(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const cr = Object.freeze(
  g.flatMap((t) => ar.map((e) => lr(t, e)))
), ur = Object.freeze([
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
function dr(t) {
  const e = tt(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, o = (r) => Q(
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
    binding: be(t.endpointID, i, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const mr = Object.freeze(
  ur.map(dr)
);
function fr(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function _e(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return Q(n, `${t.endpointID} endpoint conversion`);
}
function hr(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function pr(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function gr(t) {
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
function Ir(t) {
  const e = fr(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: _e(t, t.initial),
    initialValue: _e(t, t.initial),
    format: pr(t),
    modAmount: gr(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => hr(t, n),
      fromEngine: (n) => _e(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : `rack.${t.endpointID}`
  });
}
const nt = Object.freeze(
  [
    ...Xe.flatMap((t) => t.parameters.map(Ir)),
    ...cr,
    ...mr,
    ...Qi.flatMap(
      (t) => t.parameters.map(
        (e) => or(t, e)
      )
    )
  ]
), Sr = new Map(
  nt.map((t) => [t.targetId, t])
), En = nt.filter(
  (t) => t.modulationTargetKind !== null
), Ge = new Map(
  En.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Sr.size !== nt.length)
  throw new Error("Target descriptor IDs must be unique");
if (En.length !== N.length || Ge.size !== N.length || N.some((t) => Ge.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function At(t) {
  const e = Ge.get(t);
  return e === void 0 ? Ji(`Modulation target "${t}" has no display descriptor`) : e;
}
function br(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = At(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = At(t);
  return n.workspace === "effects" ? `${n.moduleId.toUpperCase()} ${n.label.toUpperCase()}` : n.label.toUpperCase();
}
const ie = "modulation.v6", wn = 6, le = 3, $ = 3, xt = "modulationMsegBuffer", vr = "modulationMsegPlayback", Dn = 4, yr = ["MSEG 1", "MSEG 2", "MSEG 3"], _n = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Rr = ["Env 1", "Env 2", "Env 3"], Ar = 1e-3, y = 10, xr = 0.1, Tr = 20, Mr = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Tr - xr },
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
  mseg1Rate: { min: -U, max: U },
  mseg2Rate: { min: -U, max: U },
  mseg3Rate: { min: -U, max: U },
  env1Attack: { min: -y, max: y },
  env1Decay: { min: -y, max: y },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -y, max: y },
  env2Attack: { min: -y, max: y },
  env2Decay: { min: -y, max: y },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -y, max: y },
  env3Attack: { min: -y, max: y },
  env3Decay: { min: -y, max: y },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -y, max: y }
}, Er = ln().filter((t) => t.modulationTargetIndex !== null), wr = new Map(
  Er.map((t) => [`rack.${t.endpointID}`, t])
);
class Oe extends Error {
  name = "ModulationStateParseError";
}
const Dr = {
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
K.map((t) => ({
  value: t.id,
  label: Dr[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
N.map((t) => ({
  value: t.kind,
  label: br(t.kind)
}));
function _r(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function it(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ke(t, e) {
  const n = Number(t);
  return it(Number.isFinite(n) ? n : e, Ar, y);
}
function Or(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function kr(t) {
  const e = Te(t);
  return e !== null ? gn(e) : t;
}
function Cr(t) {
  const e = kr(t), n = wr.get(e);
  return n !== void 0 ? Or(n) : Mr[Si(e)];
}
function Lr(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Nr(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Pr(t, e) {
  const n = Cr(t), i = Number(e);
  return it(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function Fr(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Ur(t) {
  return Fr(t) ?? "mseg";
}
function Br(t) {
  const e = Ye(t);
  return e !== null ? e : Te(t) !== null ? t : null;
}
function $r(t) {
  return Br(t) ?? "oscA.wavetablePosition";
}
function Vr(t, e) {
  const n = _n[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Kr(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? le : t === "macro" ? Dn : $;
  return it(Number.isFinite(n) ? n : 1, 1, i);
}
function G(t) {
  return {
    name: Rr[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function On(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = G(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: ke(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: ke(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: V(n.sustain ?? i.sustain),
    releaseSeconds: ke(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function zr(t, e = 0) {
  return { name: On(t, e).name };
}
function jr(t, e, n, i) {
  const o = Number(t.amount);
  return {
    id: Lr(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Kr(n, t.sourceSlot),
    polarity: Nr(t.polarity),
    targetKind: i,
    amount: Pr(i, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Wr(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, o = Ur(i.sourceKind), r = $r(i.targetKind);
  return jr(i, e, o, r);
}
function Gr(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function qr(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => Wr(n, i));
}
function Hr(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const o = Gr(i);
    if (e.has(i.id) || n.has(o))
      return !1;
    e.add(i.id), n.add(o);
  }
  return !0;
}
function qe(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, l) => qe(a, e[l]));
  const n = t, i = e, o = Object.keys(n), r = Object.keys(i);
  return o.length === r.length && o.every((a) => _r(i, a) && qe(n[a], i[a]));
}
function kn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = bn(yr[e] ?? `MSEG ${e + 1}`), o = se(n.shapeA ?? i), r = wi({
    ...We(),
    ...n.playback ?? {},
    rate: We().rate
  }), { rate: a, ...l } = r;
  return {
    shapeA: o,
    shapeB: se(n.shapeB ?? o),
    playback: l
  };
}
function He() {
  return {
    format: "cosimo.modulation",
    version: wn,
    msegSlots: Array.from({ length: le }, (t, e) => kn({}, e)),
    envelopeSlots: Array.from({ length: $ }, (t, e) => ({
      name: G(e).name
    })),
    routes: [],
    macroNames: _n.slice()
  };
}
function Jr(t = He()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: wn,
    msegSlots: Array.from({ length: le }, (r, a) => kn(n[a], a)),
    envelopeSlots: Array.from({ length: $ }, (r, a) => zr(i[a], a)),
    routes: qr(e.routes),
    macroNames: Array.from(
      { length: Dn },
      (r, a) => Vr(o[a], a)
    )
  };
}
function Tt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return oe(new Oe("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return oe(new Oe("Expected valid modulation JSON"));
    }
  }
  const n = Jr(e);
  return !qe(e, n) || !Hr(n.routes) ? oe(new Oe("Expected the current modulation schema")) : J(n);
}
function Qr(t, e) {
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
function Mt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Li(n))
  };
}
function Xr(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Yr(t, e = null) {
  const n = [];
  for (let i = 0; i < le; i += 1) {
    const o = t.msegSlots[i], r = e?.msegSlots[i];
    (r === void 0 || !vt(r.shapeA, o.shapeA)) && n.push({
      endpointID: xt,
      value: Mt(i, 0, o.shapeA)
    }), (r === void 0 || !vt(r.shapeB, o.shapeB)) && n.push({
      endpointID: xt,
      value: Mt(i, 1, o.shapeB)
    }), (r === void 0 || !Xr(r.playback, o.playback)) && n.push({
      endpointID: vr,
      value: Qr(i, o.playback)
    });
  }
  return n.push(...qi(e?.routes ?? null, t.routes)), n;
}
const Ce = "articulationSnapshot", S = 128, Et = 48, Zr = 1e6, A = -1, Le = [
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
function rt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ne(t) {
  return rt(Number.isFinite(t) ? t : 0, 0, 1);
}
function T(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const o = Number(t);
  return rt(Number.isFinite(o) ? o : e, n, i);
}
function R(t, e, n, i) {
  return rt(Math.round(T(t, e)), n, i);
}
function Cn(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Pe() {
  return Array.from({ length: S }, () => A);
}
function eo(t) {
  const e = R(t, 0, 0, S - 1), n = Le[e % Le.length], i = Math.floor(e / Le.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function to() {
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
function no(t) {
  const e = to(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
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
      Ne(Number(i[0])),
      Ne(Number(i[1])),
      Ne(Number(i[2]))
    ]
  };
}
function io(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: T(e.amount, 0, -48, 48)
  } : null;
}
function ro(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(io).filter((o) => o !== null) : [], i = /* @__PURE__ */ new Map();
  for (const o of n)
    i.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: no(e.parameters),
    envelopes: [0, 1, 2].map((o) => On(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...i.values()]
  };
}
function oo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = R(n.runtimeSlot, e, 0, S - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, r = typeof n.name == "string" && n.name.trim() ? n.name.trim() : eo(i);
  return {
    id: o,
    runtimeSlot: i,
    name: r,
    snapshot: ro(n.snapshot)
  };
}
function ao(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: R(n.note, 0, 0, S - 1),
    articulationId: i
  } : null;
}
function so(t, e, n, i, o) {
  if (!t || typeof t != "object")
    return null;
  const r = t, a = typeof r.articulationId == "string" ? r.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let l = R(r.min, o, o, S - 1), s = R(r.max, l, o, S - 1);
  return s < l && ([l, s] = [s, l]), {
    id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: l,
    max: s
  };
}
function wt(t, e, n, i) {
  const o = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), a = [];
  for (let l = 0; l < o.length; l += 1) {
    const s = so(
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
function lo(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), o = [];
  for (const r of n) {
    const a = ao(r, e);
    !a || i.has(a.note) || (i.add(a.note), o.push(a));
  }
  return o;
}
function co(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), r = [];
  for (let s = 0; s < n.length && r.length < S; s += 1) {
    const c = oo(n[s], s);
    !c || i.has(c.runtimeSlot) || o.has(c.id) || (i.add(c.runtimeSlot), o.add(c.id), r.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && r.some((s) => s.id === e.selectedSlotId) ? e.selectedSlotId : null, l = new Set(r.map((s) => s.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Cn(e.activeTriggerMode),
    slots: r,
    chainAssignments: wt(e.chainAssignments, l, "chain", 0),
    keyAssignments: lo(e.keyAssignments, l),
    velocityAssignments: wt(e.velocityAssignments, l, "velocity", 1)
  };
}
function Dt(t) {
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
    msegMorphs: Array.from({ length: le }, () => 0),
    routeAmounts: Array.from({ length: Rn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: $ }, (n, i) => G(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: $ }, (n, i) => G(i).decaySeconds),
    envelopeSustain: Array.from({ length: $ }, (n, i) => G(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: $ }, (n, i) => G(i).releaseSeconds)
  };
}
function _t(t, e, n) {
  for (const i of e) {
    const o = n.get(i.articulationId);
    if (o !== void 0)
      for (let r = i.min; r <= i.max; r += 1)
        t[r] === A && (t[r] = o);
  }
}
function uo(t) {
  const e = co(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = Pe(), o = Pe(), r = Pe();
  _t(i, e.chainAssignments, n), _t(r, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const l = n.get(a.articulationId);
    l === void 0 || o[a.note] !== A || (o[a.note] = l);
  }
  return r[0] = A, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: o,
    velocity: r
  };
}
function mo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : uo(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Cn(e.activeMode),
    chain: Array.from({ length: S }, (n, i) => R(e.chain?.[i], A, A, S - 1)),
    key: Array.from({ length: S }, (n, i) => R(e.key?.[i], A, A, S - 1)),
    velocity: Array.from({ length: S }, (n, i) => i === 0 ? A : R(e.velocity?.[i], A, A, S - 1))
  });
}
function fo(t, e) {
  const n = mo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const re = "articulations.v4", ot = [
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
], at = [
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
], ho = [
  ...g.flatMap((t) => ot.map(
    (e) => `osc${t}.${e}`
  )),
  ...at
];
class Ln extends Error {
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
  return oe(new Ln("malformed", t));
}
function ce(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function st(t, e, n) {
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
function Ae(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < S;
}
function po(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function go(t) {
  return ho.some((e) => e === t);
}
function Ot(t, e) {
  if (!ce(t))
    return p(`${e} must be an object`);
  const n = st(t, ["min", "max"], e);
  return n !== null ? p(n) : Ae(t.min) ? Ae(t.max) ? t.min > t.max ? p(`${e}.min must be less than or equal to ${e}.max`) : J({ min: t.min, max: t.max }) : p(`${e}.max must be an integer in 0..127`) : p(`${e}.min must be an integer in 0..127`);
}
function Io(t, e) {
  if (!ce(t))
    return p(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return p(`${e} has a non-string parameter id`);
    if (!go(i))
      return p(`${e} has unknown parameter id "${i}"`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o))
      return p(`${e}.${i} must be a finite number`);
    n[i] = o;
  }
  return J(n);
}
function So(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function bo() {
  return {};
}
function vo(t, e, n) {
  if (!ce(t))
    return p(`${e} must be an object`);
  const i = bo();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return p(`${e} has a non-string route id`);
    const r = t[o];
    if (typeof r != "number" || !Number.isFinite(r) || Math.abs(r) > Et)
      return p(
        `${e}.${o} must be a finite route amount within ±${Et}`
      );
    if (!n.has(o))
      return p(`${e}.${o} does not name a current articulable mapping`);
    So(i, o, r);
  }
  return J(i);
}
function yo(t, e, n) {
  const i = `slots[${e}]`;
  if (!ce(t))
    return p(`${i} must be an object`);
  const o = st(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (o !== null)
    return p(o);
  if (typeof t.id != "string")
    return p(`${i}.id must be a string`);
  if (!Ae(t.runtimeSlot))
    return p(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return p(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return p(`${i}.color must be a string`);
  if (!Ae(t.key))
    return p(`${i}.key must be an integer in 0..127`);
  const r = Ot(t.velRange, `${i}.velRange`);
  if (r._tag === "err")
    return r;
  const a = Ot(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const l = Io(t.overrides, `${i}.overrides`);
  if (l._tag === "err")
    return l;
  const s = vo(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return s._tag === "err" ? s : J({
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
const Ro = Object.fromEntries(
  ot.map((t, e) => [t, 2 ** e])
), Ao = Object.fromEntries(
  at.map((t, e) => [t, 2 ** e])
);
function kt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function xo(t, e) {
  return ot.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | Ro[i] : n, 0);
}
function To(t) {
  return at.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Ao[n] : e, 0);
}
function Mo(t, e) {
  const n = (r, a) => kt(t, `osc${r}.${a}`), i = (r) => kt(t, r), o = Array.from(
    { length: Rn },
    () => Zr
  );
  for (const [r, a] of Object.entries(t.routeAmounts)) {
    const l = e[r];
    l !== void 0 && (o[l] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: g.map((r) => xo(t, r)),
    sharedOverrideMask: To(t),
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
function Eo(t, e) {
  return t.slots.map((n) => Mo(n, e));
}
function wo(t, e) {
  if (!ce(t))
    return p("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return p('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return oe(new Ln(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = st(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return p(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return p("selectedSlotId must be null or a string");
  if (!po(t.activeTriggerMode))
    return p('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return p("slots must be an array");
  if (t.slots.length > S)
    return p(`slots must contain at most ${S} entries`);
  const i = [], o = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const l = yo(t.slots[a], a, e);
    if (l._tag === "err")
      return l;
    const s = l.value;
    if (o.has(s.id))
      return p(`slots[${a}].id duplicates "${s.id}"`);
    if (r.has(s.runtimeSlot))
      return p(`slots[${a}].runtimeSlot duplicates ${s.runtimeSlot}`);
    o.add(s.id), r.add(s.runtimeSlot), i.push(s);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? p(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : J({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function Nn() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Do(t) {
  const e = Array.from({ length: S }, () => A), n = Array.from({ length: S }, () => A), i = Array.from({ length: S }, () => A);
  for (const o of t.slots) {
    n[o.key] === A && (n[o.key] = o.runtimeSlot);
    for (let r = o.chainRange.min; r <= o.chainRange.max; r += 1)
      e[r] === A && (e[r] = o.runtimeSlot);
    for (let r = o.velRange.min; r <= o.velRange.max; r += 1)
      i[r] === A && (i[r] = o.runtimeSlot);
  }
  return i[0] = A, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Je = "runtimeState";
function Pn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const _o = {
  endpointID: Je,
  required: !0,
  mapValue: Pn
}, Ct = "runtimeInstallAck", Oo = "runtimeSyncRequest", Lt = 0, ko = 8e3, xe = /* @__PURE__ */ new WeakMap(), Fn = 1e9;
let fe = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Fn;
function Co(t) {
  return fe = fe % Fn + 1, t === "modulation" ? -1e9 - fe : 1e9 + fe;
}
function Lo(t, e) {
  const n = t, i = xe.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), xe.set(n, i);
}
function Nt(t, e) {
  const n = t, i = xe.get(n);
  i?.delete(e), i?.size === 0 && xe.delete(n);
}
const No = [100, 250, 500, 1e3], he = { _tag: "accepted" }, Po = { _tag: "superseded" }, Fo = { _tag: "stopped" }, Pt = { _tag: "transport-timeout" };
function Uo(t) {
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
  ].every((u) => typeof u == "number" && Number.isSafeInteger(u) && u >= -2147483648 && u <= 2147483647) || typeof o != "number" || typeof r != "number" || typeof a != "number" || typeof l != "number" || typeof s != "number" || typeof c != "number" || o < 0 || r < 0 || a > 0 || s < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: r,
    acceptedArticulationSerial: a,
    rejectedSerial: l,
    rejectionReason: s,
    syncSerial: c
  };
}
function Bo(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Ft {
  #o;
  #e;
  #d;
  #v;
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
  #y = this.#w.bind(this);
  constructor(e, n) {
    this.#o = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#d = i && i.length > 0 ? i : [...No], this.#v = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? ko)
    );
  }
  start() {
    if (!this.#i) {
      Lo(this.#o, this.#e);
      try {
        this.#u += 1, this.#i = !0, this.#s = null, this.#l.clear(), this.#o.addEndpointListener?.(Ct, this.#y);
      } catch (e) {
        throw this.#i = !1, Nt(this.#o, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#o.removeEndpointListener?.(Ct, this.#y), Nt(this.#o, this.#e), this.#r.clear(), this.#s = null, this.#l.clear(), this.#b());
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
      return r ?? he;
    } finally {
      this.#m = !1;
    }
  }
  #x(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #T(e, n) {
    const i = this.#x(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #M() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #R(e, n) {
    if (this.#s === e)
      return he;
    const i = Co(this.#e);
    this.#l.add(i);
    const o = Date.now() + this.#v;
    let r = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#s === e)
          return he;
        const l = o - Date.now();
        if (l <= 0)
          return Pt;
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
    const o = this.#M(), r = Bo(e.value, n, o);
    let a = 0, l = 0, s = this.#c;
    for (this.#A(e.endpointID, r); ; ) {
      const c = this.#p(n, i);
      if (c)
        return c;
      const m = this.#h(n, o, s);
      if (m !== null)
        return m;
      const u = this.#a;
      await this.#S(
        u,
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
        const b = await this.#S(
          f,
          this.#g(a)
        ), O = this.#h(
          n,
          o,
          s
        );
        if (O !== null)
          return O;
        if (b && this.#n?.dspSessionId === n && this.#n.syncSerial === o) {
          if (l >= 1)
            return Pt;
          s = this.#c, this.#A(e.endpointID, r), l += 1, a += 1;
          break;
        }
        if (b) {
          f = this.#a;
          continue;
        }
        b || (a += 1, f = this.#a, this.#I(o));
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
    }) : this.#T(o, n) ? (this.#r.delete(n), he) : null;
  }
  #p(e, n) {
    return !this.#i || this.#u !== n ? Fo : this.#t !== e ? Po : null;
  }
  #g(e) {
    return this.#d[Math.min(
      e,
      this.#d.length - 1
    )];
  }
  #A(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        Lt
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          Oo,
          e,
          void 0,
          Lt
        );
      } catch {
      }
  }
  #w(e) {
    const n = Uo(e);
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
const $o = 1e3, Fe = [ie, re];
function Ut(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ue(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (Ut(i, e)) return i[e];
  if (Ut(n, e)) return n[e];
}
function Be(t, e) {
  if (t === void 0) return Nn();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = wo(n, e);
  return i._tag === "ok" ? i.value : null;
}
function Bt(t) {
  return new Set(t.routes.flatMap((e) => xn(e) === null ? [] : [e.id]));
}
function $t(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Vo {
  constructor(e) {
    this.connection = e, this.modulationLane = new Ft(e, { laneKind: "modulation" }), this.articulationLane = new Ft(e, { laneKind: "articulation" });
  }
  modulationState = He();
  articulationBank = Nn();
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
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Je, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Je, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Fe) this.connection.requestStoredStateValue(n);
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
    const n = Ue(e, ie), i = n === void 0 ? { _tag: "ok", value: He() } : Tt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      const a = Ue(e, re), l = Be(a, /* @__PURE__ */ new Set());
      l !== null && (this.articulationBank = l, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const o = Ue(e, re), r = Be(
      o,
      Bt(i.value)
    );
    if (r === null) {
      console.error(`[runtime-state-worker] ${re} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Fe.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Fe.length) {
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
      const o = Tt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = Be(n, Bt(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${re}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Pn(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, o = this.lastAppliedModulationGeneration !== e, r = Yr(
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
    const l = this.buildUploadsBySelector(n, i), s = Array.from({ length: S }, (f, I) => {
      const b = l.get(I);
      return b ? $t(b) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, m = c && this.articulationLane.getAcceptedFrontier() !== 0, u = [];
    for (let f = 0; f < S; f += 1) {
      const I = l.get(f), b = s[f] !== this.lastAppliedArticulationTokens[f];
      m ? u.push({
        endpointID: Ce,
        value: I ?? Dt(f)
      }) : c ? I && u.push({ endpointID: Ce, value: I }) : b && u.push({
        endpointID: Ce,
        value: I ?? Dt(f)
      });
    }
    const h = await this.articulationLane.sendBatch(u);
    this.acceptOutcome("articulation", h, s) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = s, fo(
      Do(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((o) => {
      const r = xn(o);
      return r === null ? [] : [[o.id, r]];
    }));
    return new Map(
      Eo(n, i).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = $t(i), r = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), r && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, $o));
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
function Ko(t) {
  return new Vo(t);
}
const zo = 8, jo = 5, Wo = 8, Go = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), qo = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
});
function Ho(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= jo)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Wo + Go[t];
}
function Jo(t, e) {
  const n = new Array(zo).fill(0);
  return qo[t].forEach((i, o) => {
    const r = e[i];
    if (typeof r != "number" || !Number.isFinite(r))
      throw new Error(`Missing lane parameter value: ${t}.${i}`);
    n[o] = r;
  }), n;
}
const M = "lane.v1", Qo = "laneTopology", Xo = "laneSlotParams", Yo = 16, D = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Zo = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Un = Object.freeze({
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
  D.map((t) => [Un[t], t])
);
function Bn() {
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
function ea(t) {
  return Object.fromEntries(
    sn(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Vt() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...D],
    enabled: Bn(),
    params: Object.fromEntries(
      D.map((t) => [t, ea(t)])
    )
  };
}
function ta(t) {
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
function pe(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function na(t) {
  return typeof t != "string" ? null : D.find((e) => e === t) ?? null;
}
function ia(t) {
  const e = ta(t);
  if (e._tag === "err")
    return e;
  if (!pe(e.value))
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
    const s = na(l);
    if (s === null || o.has(s))
      return { _tag: "err", message: `${M}.order is not a complete permutation` };
    o.add(s), i.push(s);
  }
  if (!pe(e.value.enabled))
    return { _tag: "err", message: `${M}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== D.length)
    return { _tag: "err", message: `${M}.enabled must contain every effect once` };
  const r = Bn();
  for (const l of D) {
    const s = e.value.enabled[l];
    if (typeof s != "boolean")
      return { _tag: "err", message: `${M}.enabled.${l} must be boolean` };
    r[l] = s;
  }
  if (!pe(e.value.params))
    return { _tag: "err", message: `${M}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== D.length)
    return { _tag: "err", message: `${M}.params must contain every effect once` };
  const a = {};
  for (const l of D) {
    const s = e.value.params[l];
    if (!pe(s))
      return { _tag: "err", message: `${M}.params.${l} must be an object` };
    const c = sn(l).parameters;
    if (Reflect.ownKeys(s).length !== c.length)
      return { _tag: "err", message: `${M}.params.${l} must contain every parameter once` };
    const m = {};
    for (const u of c) {
      const h = s[u.endpointID];
      if (typeof h != "number" || !Number.isFinite(h))
        return { _tag: "err", message: `${M}.params.${l}.${u.endpointID} must be a finite number` };
      m[u.endpointID] = h;
    }
    a[l] = m;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: a }
  };
}
function ra(t) {
  if (t === void 0)
    return Vt();
  const e = ia(t);
  return e._tag === "ok" ? e.value : Vt();
}
function oa(t) {
  const e = [];
  let n = 0;
  for (const r of D) {
    n += 1;
    const a = Zo[r];
    e.push({
      endpointID: Xo,
      value: {
        slotId: Ho(a, 0),
        deliverySerial: n,
        values: Jo(a, t.params[r])
      }
    });
  }
  const i = new Array(Yo).fill(0);
  let o = 0;
  return t.order.forEach((r, a) => {
    i[a] = Un[r], t.enabled[r] && (o |= 1 << a);
  }), e.push({
    endpointID: Qo,
    value: { chainLength: t.order.length, slotIds: i, enabledMask: o }
  }), e;
}
const aa = 2e3;
function Kt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function sa(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Kt(i, e) ? {
    found: !0,
    value: i[e]
  } : Kt(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function zt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class la {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = ca(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = sa(e, this.options.stateKey);
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
    }, o = zt(n), r = !this.forceFullReplay && o === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, r), l = zt({
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
        this.options.sendTimeoutMilliseconds ?? aa
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = o, this.lastAppliedSnapshot = i;
  }
}
function ca(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function ua(t, e) {
  return new la(t, e);
}
function da(t) {
  return ua(t, {
    stateKey: M,
    runtimeEndpointDependencies: [_o],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: ra,
    buildRuntimeEvents: ({ state: e }) => [...oa(e)]
  });
}
const ma = "runtimeSyncRequest", fa = 2147483647, ha = "runtimeState", pa = "retryDesiredTableRequest", ga = "workerLoadFailure", Ia = "serviceLoadAbort", Sa = "wavetableLoadBegin", ba = "wavetableMipFrame", va = "wavetableUploadAck", ya = "wavetableMipRequest", Ra = "wavetablePrewarmRequest", Aa = "wavetablePrewarmNotification", xa = "assets/factory-bank-catalog.json", Qe = 3, Ta = 1, Ma = Qe * Ie, Ea = 1, wa = 2, Da = 3, _a = 1, Oa = 2, ka = 2e4, ge = Ea, Ca = wa, jt = Da, F = _a, Wt = Oa, La = 48 * 1024 * 1024, $e = 3;
function Gt(t, e) {
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
function qt(t) {
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
function Ht(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Jt(t, e) {
  if (!t)
    throw new Error(e);
}
function Na(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Pa(t, e) {
  return Jn(await t.readJSON(e));
}
function Fa(t) {
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
function Ua(t, e) {
  const n = Math.round(Number(t) || 0);
  return Na(n, 0, Math.max(0, e - 1));
}
function Ve(t, e, n, i, o) {
  return `${t}:${e}:${n}:${i}:${o}`;
}
function Ba(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Qt(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Xt(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Yt() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function $a(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Va {
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
    this.connection = e, this.resourceClient = Hn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? xa, this.maxBatchesInFlight = Gt(
      n.maxFramesInFlight,
      Ta
    ), this.mipLevelCount = n.mipLevelCount ?? nn, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? La) || 0)), this.serviceLoadTimeoutMs = Gt(n.serviceLoadTimeoutMs, ka), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, v("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ha, this.handleRuntimeState), this.connection.addEndpointListener?.(va, this.handleUploadAck), this.connection.addEndpointListener?.(ya, this.handleMipRequest), this.connection.addEndpointListener?.(Ra, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Aa, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ma,
      fa
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Pa(this.resourceClient, this.catalogPath), v("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < $e; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Qt(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Qt(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Ve(
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
          ...Xt(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (v("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: jt,
          failureReasonCode: Wt
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== jt || e.failureReasonCode !== Wt ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: o = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: a = ge,
    failureReasonCode: l = F
  }) {
    this.connection.sendEventOrValue?.(ga, {
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
    failureReasonCode: r = F
  }) {
    this.connection.sendEventOrValue?.(Ia, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: o,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    v("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? qt(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(pa, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), o = Ua(e, i.tables.length), r = i.tables[o];
    Jt(r, `Could not resolve table ${o}`);
    const a = Ba(r, Ie, this.mipLevelCount), l = this.tableCache.get(a);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, v("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = Yt();
    v("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(r.sourceWav), m = ei(c.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: Ie
    });
    return v("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: m.frameCount,
      loadDurationMs: Math.round(Yt() - s)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: r,
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Sa, {
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
      failurePhase: ge,
      failureReasonCode: F
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: ge,
      failureReasonCode: F
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = ge,
    failureReasonCode: i = F
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
      const r = this.candidateValidations[e.oscillatorIndex];
      return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (r) {
      return this.isCurrentRuntimeState(n) && (v("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Ke(r)
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
      this.isCurrentRuntimeState(e) && (v("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Ke(a)
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
    for (let e = 0; e < $e; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, $a(() => {
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
        v("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: F
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
    const n = Fa(e ?? {});
    if (v("info", "Received runtime state", qt(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= $e)
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
          o.spectra[a] || (o.spectra[a] = It(o.frames[a]));
        const r = this.tableCache.get(o.cacheKey);
        r && this.refreshCacheEntryByteCount(r), v("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        v("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Ke(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const s = Ve(
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
      ...Xt(this.serviceTable.frameCount),
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), m = Ve(
      i,
      o,
      r,
      a,
      l
    ), u = this.mipJobs.get(m), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Qe,
      h - s
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(s) || c <= 0 || c !== f)) {
      u.inFlightBatchBases.delete(s);
      for (let I = 0; I < c; I += 1) {
        const b = s + I;
        u.ackedFrames[b] || (u.ackedFrames[b] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === h && u.nextFrameIndex >= h && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), Ht(s, c, h) && v("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: o,
        generation: r,
        tableIndex: u.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: c,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: h,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Jt(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = It(this.serviceTable.frames[e]);
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
        Qe,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(Ma);
      try {
        for (let r = 0; r < i; r += 1) {
          const a = n + r, l = this.getSpectrumForFrame(a), s = ti(l, e.mipIndex);
          o.set(s, r * Ie);
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
            failurePhase: Ca,
            failureReasonCode: F
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ba, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(o)
      }), Ht(n, i, this.serviceTable.frameCount) && v("info", "Sent wavetable mip batch", {
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
function Ke(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ka(t, e = {}) {
  return new Va(t, e);
}
async function za(t, e = {}) {
  return ri(t, [
    Ko,
    da,
    () => Ka(t, e)
  ]);
}
export {
  Ta as DEFAULT_MAX_WAVETABLE_BATCHES_IN_FLIGHT,
  wa as FAILURE_PHASE_BUILD_MIP,
  Ea as FAILURE_PHASE_LOAD_SOURCE,
  Da as FAILURE_PHASE_TRANSFER_MIP,
  _a as FAILURE_REASON_GENERIC,
  Oa as FAILURE_REASON_TIMEOUT,
  Qe as WAVETABLE_MIP_FRAME_BATCH_SIZE,
  fa as WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
  Va as WavetableWorkerController,
  Ka as createWavetableWorkerController,
  za as default
};
