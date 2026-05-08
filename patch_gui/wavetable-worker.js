function assert$3(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function readAscii(view, offset, length) {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}
function isAbsoluteURL(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}
function encodeTextPayload(text) {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text);
  }
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}
function describePayload(payload) {
  if (payload === null) {
    return "null";
  }
  if (payload === void 0) {
    return "undefined";
  }
  const type = typeof payload;
  const constructorName = payload?.constructor?.name;
  if (type !== "object") {
    return constructorName ? `${type}:${constructorName}` : type;
  }
  const keys = Object.keys(payload).slice(0, 6);
  const keySummary = keys.length > 0 ? ` keys=${keys.join(",")}` : "";
  return constructorName ? `${type}:${constructorName}${keySummary}` : `${type}${keySummary}`;
}
function getDefaultPatchRootUrl() {
  const locationHref = globalThis.location?.href;
  if (typeof locationHref === "string" && locationHref.length > 0) {
    return new URL("/", locationHref);
  }
  const moduleUrl = new URL(import.meta.url);
  const modulePath = moduleUrl.pathname;
  if (modulePath.includes("/patch_gui/desktop/")) {
    moduleUrl.pathname = modulePath.replace(/\/patch_gui\/desktop\/[^/]+$/, "/");
    return moduleUrl;
  }
  if (modulePath.includes("/patch_gui/")) {
    moduleUrl.pathname = modulePath.replace(/\/patch_gui\/[^/]+$/, "/");
    return moduleUrl;
  }
  if (modulePath.includes("/ui/shared/")) {
    moduleUrl.pathname = modulePath.replace(/\/ui\/shared\/[^/]+$/, "/");
    return moduleUrl;
  }
  moduleUrl.pathname = modulePath.replace(/\/[^/]+$/, "/");
  return moduleUrl;
}
function resourceAddressToUrl(path, resourceAddress) {
  const patchRootUrl = getDefaultPatchRootUrl();
  if (resourceAddress instanceof URL) {
    return resourceAddress;
  }
  if (typeof resourceAddress === "string" && resourceAddress.length > 0) {
    if (isAbsoluteURL(resourceAddress)) {
      return new URL(resourceAddress);
    }
    const normalizedPath = resourceAddress.startsWith("/") ? resourceAddress.slice(1) : resourceAddress;
    return new URL(normalizedPath, patchRootUrl);
  }
  return new URL(path, patchRootUrl);
}
async function decodeTextPayload(payload) {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload.text === "function") {
    return payload.text();
  }
  if (payload instanceof ArrayBuffer) {
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(new Uint8Array(payload));
    }
    return String.fromCharCode(...new Uint8Array(payload));
  }
  if (ArrayBuffer.isView(payload)) {
    const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(bytes);
    }
    return String.fromCharCode(...bytes);
  }
  if (Array.isArray(payload)) {
    const bytes = Uint8Array.from(payload);
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(bytes);
    }
    return String.fromCharCode(...bytes);
  }
  throw new Error(`Unsupported text resource payload (${describePayload(payload)})`);
}
function normalizeBytesPayload(payload) {
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload.slice(0));
  }
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
  }
  if (Array.isArray(payload)) {
    return Uint8Array.from(payload);
  }
  if (typeof payload === "string") {
    return encodeTextPayload(payload);
  }
  throw new Error(`Unsupported binary resource payload (${describePayload(payload)})`);
}
function normalizeDecodedAudioFileSamples(audioFile) {
  const frames = audioFile?.frames;
  assert$3(
    Array.isArray(frames) || ArrayBuffer.isView(frames),
    "Decoded audio data must provide a frames array"
  );
  const frameArray = Array.from(frames);
  const samples = new Float32Array(frameArray.length);
  for (let index = 0; index < frameArray.length; index += 1) {
    const frame = frameArray[index];
    if (typeof frame === "number") {
      samples[index] = frame;
      continue;
    }
    if (ArrayBuffer.isView(frame) || Array.isArray(frame)) {
      const monoFrame = frame;
      assert$3(monoFrame.length === 1, "Only mono wavetable source files are supported");
      samples[index] = Number(monoFrame[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(audioFile?.sampleRate) || 0,
    samples
  };
}
function parseWaveFile(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  assert$3(readAscii(view, 0, 4) === "RIFF", "Expected a RIFF wave file");
  assert$3(readAscii(view, 8, 4) === "WAVE", "Expected a WAVE file");
  let format = null;
  let channelCount = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let blockAlign = null;
  let dataOffset = null;
  let dataSize = null;
  let cursor = 12;
  while (cursor + 8 <= view.byteLength) {
    const chunkID = readAscii(view, cursor, 4);
    const chunkSize = view.getUint32(cursor + 4, true);
    const chunkDataOffset = cursor + 8;
    if (chunkID === "fmt ") {
      format = view.getUint16(chunkDataOffset, true);
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      blockAlign = view.getUint16(chunkDataOffset + 12, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkID === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }
    cursor = chunkDataOffset + chunkSize + chunkSize % 2;
  }
  assert$3(format !== null, "Wave file is missing a fmt chunk");
  assert$3(dataOffset !== null && dataSize !== null, "Wave file is missing a data chunk");
  assert$3(channelCount === 1, "Only mono wavetable bank files are supported");
  let samples;
  if (format === 3 && bitsPerSample === 32) {
    samples = new Float32Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
  } else if (format === 1 && bitsPerSample === 16) {
    const sampleCount = dataSize / 2;
    const pcm = new Int16Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
    samples = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = pcm[index] / 32768;
    }
  } else {
    throw new Error(`Unsupported WAV format: format=${format}, bitsPerSample=${bitsPerSample}`);
  }
  return {
    format,
    channelCount,
    sampleRate: sampleRate ?? 0,
    bitsPerSample,
    blockAlign: blockAlign ?? 0,
    samples
  };
}
async function fetchArrayBuffer(url) {
  assert$3(typeof fetch === "function", `Could not fetch ${url}: global fetch is unavailable`);
  const response = await fetch(url.toString());
  assert$3(response.ok, `Failed to fetch resource from ${url}`);
  return response.arrayBuffer();
}
function readTextFromBytes(bytes) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder().decode(bytes);
  }
  return String.fromCharCode(...bytes);
}
function readAudioFromBytes(bytes) {
  const arrayBuffer = new Uint8Array(bytes).buffer;
  const parsedWave = parseWaveFile(arrayBuffer);
  return {
    sampleRate: parsedWave.sampleRate,
    samples: parsedWave.samples
  };
}
function createResourceClient(source, {
  textPreference = "bridge",
  audioPreference = "url"
} = {}) {
  const readResourcePayload = async (path) => {
    assert$3(typeof source.readResource === "function", `Resource bridge cannot read ${path}`);
    return source.readResource(path);
  };
  const readAudioBridge = async (path) => {
    assert$3(typeof source.readResourceAsAudioData === "function", `Audio resource bridge cannot read ${path}`);
    const audioFile = await source.readResourceAsAudioData(path);
    return normalizeDecodedAudioFileSamples(audioFile);
  };
  const getExplicitResourceAddress = (path) => {
    const resourceAddress = source.getResourceAddress?.(path);
    return resourceAddress !== null && resourceAddress !== void 0 ? resourceAddress : null;
  };
  const fetchAudioFromUrl = async (path, resourceAddress = source.getResourceAddress?.(path)) => {
    const url = resourceAddressToUrl(path, resourceAddress);
    const arrayBuffer = await fetchArrayBuffer(url);
    const parsedWave = parseWaveFile(arrayBuffer);
    return {
      sampleRate: parsedWave.sampleRate,
      samples: parsedWave.samples
    };
  };
  const fetchBytesFromUrl = async (path, resourceAddress = source.getResourceAddress?.(path)) => {
    const url = resourceAddressToUrl(path, resourceAddress);
    return new Uint8Array(await fetchArrayBuffer(url));
  };
  return {
    async readText(path) {
      if (textPreference === "bridge" && typeof source.readResource === "function") {
        return decodeTextPayload(await readResourcePayload(path));
      }
      const explicitResourceAddress = getExplicitResourceAddress(path);
      if (textPreference === "url" && explicitResourceAddress !== null) {
        return readTextFromBytes(await fetchBytesFromUrl(path, explicitResourceAddress));
      }
      if (typeof source.readResource === "function") {
        return decodeTextPayload(await readResourcePayload(path));
      }
      return readTextFromBytes(await fetchBytesFromUrl(path, explicitResourceAddress));
    },
    async readJSON(path) {
      return JSON.parse(await this.readText(path));
    },
    async readBytes(path) {
      if (typeof source.readResource === "function") {
        return normalizeBytesPayload(await readResourcePayload(path));
      }
      return fetchBytesFromUrl(path);
    },
    async readAudio(path) {
      if (audioPreference === "bridge" && typeof source.readResourceAsAudioData === "function") {
        return readAudioBridge(path);
      }
      const explicitResourceAddress = getExplicitResourceAddress(path);
      if (audioPreference === "url" && explicitResourceAddress !== null) {
        return fetchAudioFromUrl(path, explicitResourceAddress);
      }
      if (typeof source.readResourceAsAudioData === "function") {
        return readAudioBridge(path);
      }
      return readAudioFromBytes(await this.readBytes(path));
    },
    getURL(path) {
      return resourceAddressToUrl(path, source.getResourceAddress?.(path));
    }
  };
}
function createPatchConnectionResourceClient(source) {
  const normalizedSource = source ?? {};
  const prefersBridgeAudio = Boolean(normalizedSource.prefersAudioResourceReadBridge);
  return createResourceClient(normalizedSource, {
    textPreference: "bridge",
    audioPreference: prefersBridgeAudio ? "bridge" : "url"
  });
}
function normalizeResourceClient(value) {
  const readText = typeof value.readText === "function" ? value.readText.bind(value) : null;
  const readJSON = typeof value.readJSON === "function" ? value.readJSON.bind(value) : null;
  const readBytes = typeof value.readBytes === "function" ? value.readBytes.bind(value) : null;
  const readAudio = typeof value.readAudio === "function" ? value.readAudio.bind(value) : null;
  const getURL = typeof value.getURL === "function" ? value.getURL.bind(value) : null;
  return {
    async readText(path) {
      if (readText) {
        return readText(path);
      }
      if (readJSON) {
        return JSON.stringify(await readJSON(path));
      }
      if (readBytes) {
        return readTextFromBytes(await readBytes(path));
      }
      throw new Error(`Resource client cannot read text ${path}`);
    },
    async readJSON(path) {
      if (readJSON) {
        return readJSON(path);
      }
      return JSON.parse(await this.readText(path));
    },
    async readBytes(path) {
      if (readBytes) {
        return readBytes(path);
      }
      if (readText) {
        return encodeTextPayload(await readText(path));
      }
      if (readJSON) {
        return encodeTextPayload(JSON.stringify(await readJSON(path)));
      }
      throw new Error(`Resource client cannot read bytes ${path}`);
    },
    async readAudio(path) {
      if (readAudio) {
        return readAudio(path);
      }
      return readAudioFromBytes(await this.readBytes(path));
    },
    getURL(path) {
      return getURL ? getURL(path) : null;
    }
  };
}
function isResourceClient(value) {
  return typeof value?.readText === "function" || typeof value?.readJSON === "function" || typeof value?.readBytes === "function" || typeof value?.readAudio === "function";
}
function asResourceClient(value) {
  if (isResourceClient(value)) {
    return normalizeResourceClient(value);
  }
  return createPatchConnectionResourceClient(value);
}
const DEFAULT_SAMPLES_PER_FRAME$1 = 2048;
function assert$2(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function getFactoryBankCatalogValue(catalogValue) {
  assert$2(
    Array.isArray(catalogValue?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const catalog = catalogValue;
  catalog.tables.forEach((table, tableIndex) => {
    assert$2(
      typeof table?.tableId === "string" && table.tableId.length > 0,
      `Factory bank catalog table ${tableIndex} must provide tableId`
    );
    assert$2(
      typeof table?.name === "string" && table.name.length > 0,
      `Factory bank catalog table ${tableIndex} must provide name`
    );
    assert$2(
      Number.isInteger(Number(table?.frameCount)) && Number(table.frameCount) > 0,
      `Factory bank catalog table ${tableIndex} must provide a positive frameCount`
    );
    assert$2(
      typeof table?.sourceWav === "string" && table.sourceWav.length > 0,
      `Factory bank catalog table ${tableIndex} must provide sourceWav`
    );
  });
  return catalog;
}
const DEFAULT_SAMPLES_PER_FRAME = 2048;
const DEFAULT_MIP_LEVEL_COUNT = 11;
const DEFAULT_MAX_FRAMES_PER_TABLE = 256;
function assert$1(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function isPowerOfTwo(value) {
  return value > 0 && (value & value - 1) === 0;
}
const bitReverseIndexCache = /* @__PURE__ */ new Map();
function getBitReverseIndices(size) {
  const cached = bitReverseIndexCache.get(size);
  if (cached) {
    return cached;
  }
  const bitCount = Math.round(Math.log2(size));
  const indices = new Uint32Array(size);
  for (let index = 0; index < size; index += 1) {
    let reversed = 0;
    let source = index;
    for (let bit = 0; bit < bitCount; bit += 1) {
      reversed = reversed << 1 | source & 1;
      source >>= 1;
    }
    indices[index] = reversed;
  }
  bitReverseIndexCache.set(size, indices);
  return indices;
}
function fftComplexInPlace(real, imaginary, inverse = false) {
  const size = real.length;
  assert$1(size === imaginary.length, "FFT real and imaginary buffers must have the same length");
  assert$1(isPowerOfTwo(size), "FFT input length must be a power of two");
  const bitReverseIndices = getBitReverseIndices(size);
  for (let index = 0; index < size; index += 1) {
    const reversedIndex = bitReverseIndices[index];
    if (reversedIndex <= index) {
      continue;
    }
    const realSample = real[index];
    real[index] = real[reversedIndex];
    real[reversedIndex] = realSample;
    const imaginarySample = imaginary[index];
    imaginary[index] = imaginary[reversedIndex];
    imaginary[reversedIndex] = imaginarySample;
  }
  for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
    const halfBlockSize = blockSize >> 1;
    const angle = (inverse ? 2 : -2) * Math.PI / blockSize;
    const phaseStepReal = Math.cos(angle);
    const phaseStepImaginary = Math.sin(angle);
    for (let blockOffset = 0; blockOffset < size; blockOffset += blockSize) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let pairIndex = 0; pairIndex < halfBlockSize; pairIndex += 1) {
        const evenIndex = blockOffset + pairIndex;
        const oddIndex = evenIndex + halfBlockSize;
        const oddReal = real[oddIndex];
        const oddImaginary = imaginary[oddIndex];
        const transformedReal = twiddleReal * oddReal - twiddleImaginary * oddImaginary;
        const transformedImaginary = twiddleReal * oddImaginary + twiddleImaginary * oddReal;
        const evenReal = real[evenIndex];
        const evenImaginary = imaginary[evenIndex];
        real[evenIndex] = evenReal + transformedReal;
        imaginary[evenIndex] = evenImaginary + transformedImaginary;
        real[oddIndex] = evenReal - transformedReal;
        imaginary[oddIndex] = evenImaginary - transformedImaginary;
        const nextTwiddleReal = twiddleReal * phaseStepReal - twiddleImaginary * phaseStepImaginary;
        twiddleImaginary = twiddleReal * phaseStepImaginary + twiddleImaginary * phaseStepReal;
        twiddleReal = nextTwiddleReal;
      }
    }
  }
  if (inverse) {
    for (let index = 0; index < size; index += 1) {
      real[index] /= size;
      imaginary[index] /= size;
    }
  }
}
function canonicalizeFrame(frame) {
  const sourceFrame = ArrayBuffer.isView(frame) ? frame : Float32Array.from(frame);
  let sum = 0;
  for (let index = 0; index < sourceFrame.length; index += 1) {
    sum += Number(sourceFrame[index]) || 0;
  }
  const mean = sum / Math.max(1, sourceFrame.length);
  const canonical = new Float32Array(sourceFrame.length);
  for (let index = 0; index < sourceFrame.length; index += 1) {
    canonical[index] = (Number(sourceFrame[index]) || 0) - mean;
  }
  return canonical;
}
function extractSourceFramesFromSamples(samples, {
  expectedFrameCount,
  samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
  maxFramesPerTable = DEFAULT_MAX_FRAMES_PER_TABLE
} = {}) {
  const sourceSamples = Float32Array.from(samples);
  assert$1(sourceSamples.length % samplesPerFrame === 0, `Source wavetable files must contain a whole number of ${samplesPerFrame}-sample frames`);
  const frameCount = sourceSamples.length / samplesPerFrame;
  assert$1(frameCount > 0, "Source wavetable files must contain at least one frame");
  assert$1(frameCount <= maxFramesPerTable, `Source wavetable files must contain at most ${maxFramesPerTable} frames`);
  if (expectedFrameCount !== void 0) {
    assert$1(frameCount === expectedFrameCount, `Source wavetable frame count mismatch: expected ${expectedFrameCount}, got ${frameCount}`);
  }
  const frames = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * samplesPerFrame;
    const end = start + samplesPerFrame;
    frames.push(canonicalizeFrame(sourceSamples.slice(start, end)));
  }
  return {
    frameCount,
    frames
  };
}
function buildFrameSpectrum(frame) {
  const canonical = canonicalizeFrame(frame);
  const real = Float64Array.from(canonical);
  const imaginary = new Float64Array(real.length);
  fftComplexInPlace(real, imaginary, false);
  real[0] = 0;
  imaginary[0] = 0;
  return {
    real,
    imaginary
  };
}
function buildMipFrameFromSpectrum(spectrum, mipIndex, {
  mipLevelCount = DEFAULT_MIP_LEVEL_COUNT
} = {}) {
  const size = spectrum?.real?.length ?? 0;
  assert$1(size > 0, "Spectrum must contain real samples");
  assert$1(size === spectrum.imaginary.length, "Spectrum real and imaginary buffers must have the same length");
  assert$1(mipIndex >= 0 && mipIndex < mipLevelCount, `Mip index must stay inside [0, ${mipLevelCount - 1}]`);
  const harmonicLimit = Math.min(1 << mipIndex, size >> 1);
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let harmonic = 1; harmonic <= harmonicLimit; harmonic += 1) {
    real[harmonic] = spectrum.real[harmonic];
    imaginary[harmonic] = spectrum.imaginary[harmonic];
    const mirrorIndex = (size - harmonic) % size;
    if (mirrorIndex !== harmonic) {
      real[mirrorIndex] = spectrum.real[mirrorIndex];
      imaginary[mirrorIndex] = spectrum.imaginary[mirrorIndex];
    }
  }
  fftComplexInPlace(real, imaginary, true);
  return Float32Array.from(real);
}
class PatchWorkerServiceHost {
  connection;
  serviceFactories;
  services = [];
  started = false;
  constructor(connection, serviceFactories) {
    this.connection = connection;
    this.serviceFactories = serviceFactories;
  }
  async start() {
    if (this.started) {
      return;
    }
    this.started = true;
    try {
      for (const serviceFactory of this.serviceFactories) {
        const service = typeof serviceFactory === "function" ? await serviceFactory(this.connection) : serviceFactory;
        this.services.push(service);
        await service.start();
      }
    } catch (startError) {
      const cleanupErrors = [];
      for (const service of [...this.services].reverse()) {
        try {
          await service.stop?.();
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      this.services.length = 0;
      this.started = false;
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [startError, ...cleanupErrors],
          "Patch worker service startup failed and cleanup also failed"
        );
      }
      throw startError;
    }
  }
  async stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    for (const service of [...this.services].reverse()) {
      await service.stop?.();
    }
    this.services.length = 0;
  }
  getServices() {
    return [...this.services];
  }
}
function createPatchWorkerServiceHost(connection, serviceFactories) {
  return new PatchWorkerServiceHost(connection, serviceFactories);
}
async function startPatchWorkerServices(connection, serviceFactories) {
  const host = createPatchWorkerServiceHost(connection, serviceFactories);
  await host.start();
  return host;
}
const MSEG_BODY_SAMPLES = 2048;
const MSEG_PADDED_SAMPLES = MSEG_BODY_SAMPLES + 3;
const MSEG_CURVE_POWER_LIMIT = 20;
const MSEG_DEFAULT_NAME = "MSEG 1";
const MSEG_RATE_MIN_SECONDS = 0;
const MSEG_RATE_MAX_SECONDS = 2;
const MSEG_NOTE_OFF_POLICY_VALUES = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function clamp$3(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function almostEqual(left, right, epsilon = 1e-12) {
  return Math.abs(left - right) <= epsilon;
}
function clampCurvePower(value) {
  return clamp$3(Number.isFinite(value) ? value : 0, -MSEG_CURVE_POWER_LIMIT, MSEG_CURVE_POWER_LIMIT);
}
function clamp01$1(value) {
  return clamp$3(Number.isFinite(value) ? value : 0, 0, 1);
}
function createDefaultMsegShape(name = MSEG_DEFAULT_NAME) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name,
    globalSmooth: false,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function createDefaultMsegPlayback() {
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: 1
    },
    loop: { startX: 0, endX: 1 },
    noteOffPolicy: "finish_loop",
    legatoRestarts: false,
    holdFinalValue: true
  };
}
function clampMsegRateSeconds(value) {
  const numericValue = Number(value);
  return clamp$3(
    Number.isFinite(numericValue) ? numericValue : 1,
    MSEG_RATE_MIN_SECONDS,
    MSEG_RATE_MAX_SECONDS
  );
}
function normalizeMsegLoop(loop) {
  if (!loop || typeof loop !== "object") {
    return null;
  }
  const nextLoop = loop;
  const startX = clamp01$1(Number(nextLoop.startX));
  const endX = clamp01$1(Number(nextLoop.endX));
  if (almostEqual(startX, endX)) {
    return null;
  }
  if (endX < startX) {
    return {
      startX: endX,
      endX: startX
    };
  }
  return { startX, endX };
}
function normalizeMsegPlayback(playback = createDefaultMsegPlayback()) {
  const next = playback && typeof playback === "object" ? playback : {};
  const rate = next.rate && typeof next.rate === "object" ? next.rate : {};
  const seconds = Number(rate.seconds);
  const noteOffPolicyCandidate = next.noteOffPolicy;
  const noteOffPolicy = MSEG_NOTE_OFF_POLICY_VALUES.has(noteOffPolicyCandidate) ? noteOffPolicyCandidate : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: clampMsegRateSeconds(Number.isFinite(seconds) ? seconds : 1)
    },
    loop: normalizeMsegLoop(next.loop),
    noteOffPolicy,
    legatoRestarts: Boolean(next.legatoRestarts),
    holdFinalValue: next.holdFinalValue !== false
  };
}
function normalizePoint(point, pointIndex, pointCount) {
  const nextPoint = point && typeof point === "object" ? point : {};
  let x = Number(nextPoint.x);
  if (!Number.isFinite(x)) {
    x = pointIndex === 0 ? 0 : pointIndex === pointCount - 1 ? 1 : 0;
  }
  if (pointIndex !== 0 && pointIndex !== pointCount - 1) {
    x = clamp01$1(x);
  }
  return {
    x,
    y: clamp01$1(Number(nextPoint.y)),
    curvePower: clampCurvePower(Number(nextPoint.curvePower))
  };
}
function normalizeMsegShape(shape = createDefaultMsegShape()) {
  const next = shape && typeof shape === "object" ? shape : {};
  const inputPoints = Array.isArray(next.points) ? next.points : [];
  if (inputPoints.length < 2) {
    throw new Error("MSEG shapes require at least two points");
  }
  const points = inputPoints.map((point, index) => normalizePoint(point, index, inputPoints.length));
  if (!almostEqual(points[0].x, 0) || !almostEqual(points[points.length - 1].x, 1)) {
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  }
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x < points[index - 1].x) {
      throw new Error("MSEG shape points must stay in non-decreasing x order");
    }
  }
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof next.name === "string" && next.name.trim() ? next.name : MSEG_DEFAULT_NAME,
    globalSmooth: Boolean(next.globalSmooth),
    points
  };
}
function powerScale(value, power) {
  if (Math.abs(power) < 0.01) {
    return value;
  }
  const numerator = Math.exp(power * value) - 1;
  const denominator = Math.exp(power) - 1;
  return numerator / denominator;
}
function findEvaluationSegment(points, x) {
  if (x <= points[0].x) {
    return { from: points[0], to: points[0], laterPointWins: false };
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (x < to.x) {
      return { from, to, laterPointWins: false };
    }
    if (almostEqual(x, to.x)) {
      let latestIndex = index + 1;
      while (latestIndex + 1 < points.length && almostEqual(points[latestIndex + 1].x, x)) {
        latestIndex += 1;
      }
      return {
        from: points[latestIndex],
        to: points[latestIndex],
        laterPointWins: true
      };
    }
  }
  return {
    from: points[points.length - 1],
    to: points[points.length - 1],
    laterPointWins: false
  };
}
function evaluateNormalizedMsegShape(points, x) {
  const clampedX = clamp01$1(Number(x));
  const segment = findEvaluationSegment(points, clampedX);
  if (segment.laterPointWins || almostEqual(segment.from.x, segment.to.x)) {
    return segment.to.y;
  }
  const width = segment.to.x - segment.from.x;
  const t = width <= 0 ? 1 : (clampedX - segment.from.x) / width;
  const curvedT = clamp01$1(powerScale(t, segment.from.curvePower));
  return segment.from.y + (segment.to.y - segment.from.y) * curvedT;
}
function evaluateMsegShape(shape, x) {
  return evaluateNormalizedMsegShape(normalizeMsegShape(shape).points, x);
}
function renderMsegShape(shape) {
  const normalizedShape = normalizeMsegShape(shape);
  const body = new Float32Array(MSEG_BODY_SAMPLES);
  for (let sampleIndex = 0; sampleIndex < MSEG_BODY_SAMPLES; sampleIndex += 1) {
    const x = sampleIndex / (MSEG_BODY_SAMPLES - 1);
    body[sampleIndex] = evaluateMsegShape(normalizedShape, x);
  }
  const padded = new Float32Array(MSEG_PADDED_SAMPLES);
  padded[0] = body[0];
  padded.set(body, 1);
  padded[MSEG_BODY_SAMPLES + 1] = body[MSEG_BODY_SAMPLES - 1];
  padded[MSEG_BODY_SAMPLES + 2] = body[MSEG_BODY_SAMPLES - 1];
  return padded;
}
const MODULATION_STATE_KEY = "modulation.v2";
const MODULATION_MAX_ROUTES = 12;
const MODULATION_MSEG_SLOT_COUNT = 3;
const MODULATION_ENV_SLOT_COUNT = 3;
const MODULATION_CLEAR_ENDPOINT_ID = "modulationClear";
const MODULATION_ENABLE_ENDPOINT_ID = "modulationEnable";
const MODULATION_MSEG_BUFFER_ENDPOINT_ID = "modulationMsegBuffer";
const MODULATION_MSEG_PLAYBACK_ENDPOINT_ID = "modulationMsegPlayback";
const MODULATION_ENV_ENDPOINT_ID = "modulationEnvelope";
const MODULATION_ROUTE_ENDPOINT_ID = "modulationRoute";
const MOD_SOURCE_MSEG = 1;
const MOD_SOURCE_ENV = 2;
const MOD_SOURCE_VELOCITY = 3;
const MOD_SOURCE_PRESSURE = 4;
const MOD_SOURCE_SLIDE = 5;
const MOD_POLARITY_UNIPOLAR = 0;
const MOD_POLARITY_BIPOLAR = 1;
const MOD_TARGET_WAVETABLE_POSITION = 1;
const MOD_TARGET_WARP_AMOUNT = 2;
const MOD_TARGET_FILTER_CUTOFF_OCTAVES = 3;
const MOD_TARGET_FILTER_Q = 4;
const MOD_TARGET_PITCH_SEMITONES = 5;
const MOD_TARGET_AMP_GAIN_DB = 6;
const MOD_TARGET_PAN = 7;
const MSEG_SLOT_NAMES = ["MSEG 1", "MSEG 2", "MSEG 3"];
const ENV_SLOT_NAMES = ["Env 1", "Env 2", "Env 3"];
const ENV_MIN_SECONDS = 1e-3;
const ENV_MAX_SECONDS = 10;
const FILTER_Q_MIN = 0.1;
const FILTER_Q_MAX = 20;
const ROUTE_AMOUNT_LIMITS = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: FILTER_Q_MAX - FILTER_Q_MIN },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 }
};
let generatedRouteIdCounter = 1;
function clamp$2(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function clampEnvSeconds(value, fallback) {
  const numeric = Number(value);
  return clamp$2(Number.isFinite(numeric) ? numeric : fallback, ENV_MIN_SECONDS, ENV_MAX_SECONDS);
}
function createGeneratedRouteId() {
  const routeId = `mod-route-auto-${generatedRouteIdCounter}`;
  generatedRouteIdCounter += 1;
  return routeId;
}
function normalizeRouteId(value, routeIndex) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return `mod-route-${routeIndex + 1}`;
}
function normalizePolarity(value) {
  return value === "bipolar" ? "bipolar" : "unipolar";
}
function polarityToCode(polarity) {
  return polarity === "bipolar" ? MOD_POLARITY_BIPOLAR : MOD_POLARITY_UNIPOLAR;
}
function clampModulationRouteAmount(targetKind, value) {
  const limits = ROUTE_AMOUNT_LIMITS[targetKind];
  const numeric = Number(value);
  return clamp$2(Number.isFinite(numeric) ? numeric : 0, limits.min, limits.max);
}
function normalizeSourceKind(value) {
  if (value === "mseg" || value === "env" || value === "velocity" || value === "pressure" || value === "slide") {
    return value;
  }
  return "mseg";
}
function normalizeTargetKind(value) {
  if (value === "wavetablePosition" || value === "warpAmount" || value === "filterCutoffOctaves" || value === "filterQ" || value === "pitchSemitones" || value === "ampGainDb" || value === "pan") {
    return value;
  }
  return "wavetablePosition";
}
function normalizeSourceSlot(sourceKind, rawSlot) {
  const numericSlot = Math.round(Number(rawSlot));
  if (sourceKind === "velocity" || sourceKind === "pressure" || sourceKind === "slide") {
    return null;
  }
  const maxSlot = sourceKind === "mseg" ? MODULATION_MSEG_SLOT_COUNT : MODULATION_ENV_SLOT_COUNT;
  return clamp$2(Number.isFinite(numericSlot) ? numericSlot : 1, 1, maxSlot);
}
function createDefaultEnvelope(slotIndex) {
  return {
    name: ENV_SLOT_NAMES[slotIndex] ?? `Env ${slotIndex + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function normalizeEnvelope(value, slotIndex = 0) {
  const nextValue = value && typeof value === "object" ? value : {};
  const fallback = createDefaultEnvelope(slotIndex);
  return {
    name: typeof nextValue.name === "string" && nextValue.name.trim() ? nextValue.name : fallback.name,
    attackSeconds: clampEnvSeconds(nextValue.attackSeconds ?? fallback.attackSeconds, fallback.attackSeconds),
    decaySeconds: clampEnvSeconds(nextValue.decaySeconds ?? fallback.decaySeconds, fallback.decaySeconds),
    sustain: clamp01$1(nextValue.sustain ?? fallback.sustain),
    releaseSeconds: clampEnvSeconds(nextValue.releaseSeconds ?? fallback.releaseSeconds, fallback.releaseSeconds)
  };
}
function createDefaultRoute(overrides = {}) {
  return {
    id: overrides.id ?? createGeneratedRouteId(),
    enabled: true,
    sourceKind: "mseg",
    sourceSlot: 1,
    polarity: "unipolar",
    targetKind: "wavetablePosition",
    amount: 0,
    ...overrides
  };
}
function normalizeRoute(value, routeIndex = 0) {
  const nextValue = value && typeof value === "object" ? value : {};
  const sourceKind = normalizeSourceKind(nextValue.sourceKind);
  const targetKind = normalizeTargetKind(nextValue.targetKind);
  const numericAmount = Number(nextValue.amount);
  return {
    id: normalizeRouteId(nextValue.id, routeIndex),
    enabled: nextValue.enabled !== false,
    sourceKind,
    sourceSlot: normalizeSourceSlot(sourceKind, nextValue.sourceSlot),
    polarity: normalizePolarity(nextValue.polarity),
    targetKind,
    amount: clampModulationRouteAmount(targetKind, numericAmount)
  };
}
function normalizeMsegSlot(value, slotIndex) {
  const nextValue = value && typeof value === "object" ? value : {};
  const defaultShape = createDefaultMsegShape(MSEG_SLOT_NAMES[slotIndex] ?? `MSEG ${slotIndex + 1}`);
  const shapeA = normalizeMsegShape(nextValue.shapeA ?? defaultShape);
  return {
    shapeA,
    shapeB: normalizeMsegShape(nextValue.shapeB ?? shapeA),
    morph: clamp01$1(nextValue.morph ?? 0),
    playback: normalizeMsegPlayback(nextValue.playback ?? createDefaultMsegPlayback())
  };
}
function createDefaultModulationState() {
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot({}, slotIndex)),
    envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex)),
    routes: [createDefaultRoute({ id: "mod-route-1" })]
  };
}
function normalizeModulationState(value = createDefaultModulationState()) {
  const nextValue = value && typeof value === "object" ? value : {};
  const inputMsegSlots = Array.isArray(nextValue.msegSlots) ? nextValue.msegSlots : [];
  const inputEnvelopeSlots = Array.isArray(nextValue.envelopeSlots) ? nextValue.envelopeSlots : [];
  const inputRoutes = Array.isArray(nextValue.routes) ? nextValue.routes : [];
  return {
    format: "cosimo.modulation",
    version: 2,
    msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot(inputMsegSlots[slotIndex], slotIndex)),
    envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => normalizeEnvelope(inputEnvelopeSlots[slotIndex], slotIndex)),
    routes: inputRoutes.slice(0, MODULATION_MAX_ROUTES).map((route, routeIndex) => normalizeRoute(route, routeIndex))
  };
}
function deserializeModulationState(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return createDefaultModulationState();
  }
  try {
    return normalizeModulationState(JSON.parse(value));
  } catch {
    return createDefaultModulationState();
  }
}
function sourceKindToCode(sourceKind) {
  if (sourceKind === "mseg") return MOD_SOURCE_MSEG;
  if (sourceKind === "env") return MOD_SOURCE_ENV;
  if (sourceKind === "velocity") return MOD_SOURCE_VELOCITY;
  if (sourceKind === "pressure") return MOD_SOURCE_PRESSURE;
  return MOD_SOURCE_SLIDE;
}
function targetKindToCode(targetKind) {
  if (targetKind === "wavetablePosition") return MOD_TARGET_WAVETABLE_POSITION;
  if (targetKind === "warpAmount") return MOD_TARGET_WARP_AMOUNT;
  if (targetKind === "filterCutoffOctaves") return MOD_TARGET_FILTER_CUTOFF_OCTAVES;
  if (targetKind === "filterQ") return MOD_TARGET_FILTER_Q;
  if (targetKind === "pitchSemitones") return MOD_TARGET_PITCH_SEMITONES;
  if (targetKind === "ampGainDb") return MOD_TARGET_AMP_GAIN_DB;
  return MOD_TARGET_PAN;
}
function toMsegPlaybackUpload(slotIndex, playback) {
  return {
    slot: slotIndex + 1,
    seconds: clampMsegRateSeconds(playback.rate.seconds),
    holdFinalValue: playback.holdFinalValue !== false,
    rateKind: 0,
    loopEnabled: Boolean(playback.loop),
    loopStart: playback.loop?.startX ?? 0,
    loopEnd: playback.loop?.endX ?? 1,
    noteOffPolicy: playback.noteOffPolicy === "immediate" ? 1 : playback.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: Boolean(playback.legatoRestarts)
  };
}
function toMsegBufferUpload(slotIndex, shapeIndex, shape) {
  return {
    slot: slotIndex + 1,
    shapeIndex,
    buffer: Array.from(renderMsegShape(shape))
  };
}
function toEnvelopeUpload(slotIndex, envelope) {
  return {
    slot: slotIndex + 1,
    attackSeconds: envelope.attackSeconds,
    decaySeconds: envelope.decaySeconds,
    sustain: envelope.sustain,
    releaseSeconds: envelope.releaseSeconds
  };
}
function toRouteUpload(routeIndex, route) {
  const normalizedRoute = route ? normalizeRoute(route) : null;
  const isEnabled = normalizedRoute?.enabled ?? false;
  return {
    routeIndex,
    enabled: isEnabled,
    sourceKind: sourceKindToCode(normalizedRoute?.sourceKind ?? "mseg"),
    sourceSlot: isEnabled ? normalizedRoute?.sourceSlot ?? 0 : 0,
    polarityKind: polarityToCode(normalizedRoute?.polarity ?? "unipolar"),
    targetKind: targetKindToCode(normalizedRoute?.targetKind ?? "wavetablePosition"),
    amount: isEnabled ? normalizedRoute?.amount ?? 0 : 0
  };
}
function buildModulationRuntimeEvents(stateValue) {
  const state = normalizeModulationState(stateValue);
  const events = [
    { endpointID: MODULATION_ENABLE_ENDPOINT_ID, value: 0 },
    { endpointID: MODULATION_CLEAR_ENDPOINT_ID, value: 1 }
  ];
  for (let slotIndex = 0; slotIndex < MODULATION_MSEG_SLOT_COUNT; slotIndex += 1) {
    const slot = state.msegSlots[slotIndex];
    events.push({
      endpointID: MODULATION_MSEG_BUFFER_ENDPOINT_ID,
      value: toMsegBufferUpload(slotIndex, 0, slot.shapeA)
    });
    events.push({
      endpointID: MODULATION_MSEG_BUFFER_ENDPOINT_ID,
      value: toMsegBufferUpload(slotIndex, 1, slot.shapeB)
    });
    events.push({
      endpointID: MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
      value: toMsegPlaybackUpload(slotIndex, slot.playback)
    });
  }
  for (let slotIndex = 0; slotIndex < MODULATION_ENV_SLOT_COUNT; slotIndex += 1) {
    events.push({
      endpointID: MODULATION_ENV_ENDPOINT_ID,
      value: toEnvelopeUpload(slotIndex, state.envelopeSlots[slotIndex])
    });
  }
  for (let routeIndex = 0; routeIndex < MODULATION_MAX_ROUTES; routeIndex += 1) {
    events.push({
      endpointID: MODULATION_ROUTE_ENDPOINT_ID,
      value: toRouteUpload(routeIndex, state.routes[routeIndex] ?? null)
    });
  }
  events.push({ endpointID: MODULATION_ENABLE_ENDPOINT_ID, value: 1 });
  return events;
}
const ARTICULATION_STATE_KEY = "articulations.v2";
const ARTICULATION_SNAPSHOT_ENDPOINT_ID = "articulationSnapshot";
const ARTICULATION_MAX_SLOTS = 128;
const ARTICULATION_DEFAULT_NAMES = [
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
function clamp$1(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function clamp01(value) {
  return clamp$1(Number.isFinite(value) ? value : 0, 0, 1);
}
function normalizeNumber(value, fallback, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
  const numericValue = Number(value);
  return clamp$1(Number.isFinite(numericValue) ? numericValue : fallback, min, max);
}
function normalizeInteger(value, fallback, min, max) {
  return clamp$1(Math.round(normalizeNumber(value, fallback)), min, max);
}
function normalizeTriggerMode(value) {
  return value === "key" || value === "vel" || value === "chain" ? value : "chain";
}
function createDefaultArticulationName(runtimeSlot) {
  const safeRuntimeSlot = normalizeInteger(runtimeSlot, 0, 0, ARTICULATION_MAX_SLOTS - 1);
  const baseName = ARTICULATION_DEFAULT_NAMES[safeRuntimeSlot % ARTICULATION_DEFAULT_NAMES.length];
  const cycleIndex = Math.floor(safeRuntimeSlot / ARTICULATION_DEFAULT_NAMES.length);
  return cycleIndex === 0 ? baseName : `${baseName} ${cycleIndex + 1}`;
}
function createDefaultArticulationParameterSnapshot() {
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
    msegMorphs: [0, 0, 0],
    distortionMode: 0,
    distortionDriveDb: 12,
    distortionKnee: 0.35,
    distortionWet: 0,
    distortionWetHPHz: 40,
    distortionWetLPHz: 18e3,
    chorusEnabled: 0,
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
function normalizeArticulationParameterSnapshot(value) {
  const defaults = createDefaultArticulationParameterSnapshot();
  const nextValue = value && typeof value === "object" ? value : {};
  const msegMorphs = Array.isArray(nextValue.msegMorphs) ? nextValue.msegMorphs : [];
  return {
    wavetablePosition: normalizeNumber(nextValue.wavetablePosition, defaults.wavetablePosition, 0, 1),
    playMode: normalizeInteger(nextValue.playMode, defaults.playMode, 0, 2),
    glideTime: normalizeNumber(nextValue.glideTime, defaults.glideTime, 0, 2),
    pan: normalizeNumber(nextValue.pan, defaults.pan, -1, 1),
    warpMode: normalizeInteger(nextValue.warpMode, defaults.warpMode, 0, 4),
    warpAmount: normalizeNumber(nextValue.warpAmount, defaults.warpAmount, 0, 1),
    filterMode: normalizeInteger(nextValue.filterMode, defaults.filterMode, 0, 5),
    filterCutoff: normalizeNumber(nextValue.filterCutoff, defaults.filterCutoff, 20, 2e4),
    filterQ: normalizeNumber(nextValue.filterQ, defaults.filterQ, 0.1, 20),
    msegMorphs: [
      clamp01(Number(msegMorphs[0])),
      clamp01(Number(msegMorphs[1])),
      clamp01(Number(msegMorphs[2]))
    ],
    distortionMode: normalizeInteger(nextValue.distortionMode, defaults.distortionMode, 0, 1),
    distortionDriveDb: normalizeNumber(nextValue.distortionDriveDb, defaults.distortionDriveDb, 0, 36),
    distortionKnee: normalizeNumber(nextValue.distortionKnee, defaults.distortionKnee, 0, 1),
    distortionWet: normalizeNumber(nextValue.distortionWet, defaults.distortionWet, 0, 1),
    distortionWetHPHz: normalizeNumber(nextValue.distortionWetHPHz, defaults.distortionWetHPHz, 20, 4e3),
    distortionWetLPHz: normalizeNumber(nextValue.distortionWetLPHz, defaults.distortionWetLPHz, 20, 2e4),
    chorusEnabled: normalizeInteger(nextValue.chorusEnabled, defaults.chorusEnabled, 0, 1),
    chorusMix: normalizeNumber(nextValue.chorusMix, defaults.chorusMix, 0, 1),
    chorusMotionMode: normalizeInteger(nextValue.chorusMotionMode, defaults.chorusMotionMode, 0, 3),
    chorusBloomMode: normalizeInteger(nextValue.chorusBloomMode, defaults.chorusBloomMode, 0, 4),
    chorusTone: normalizeNumber(nextValue.chorusTone, defaults.chorusTone, 0, 1),
    chorusFeedback: normalizeNumber(nextValue.chorusFeedback, defaults.chorusFeedback, 0, 0.95),
    chorusRingAmount: normalizeNumber(nextValue.chorusRingAmount, defaults.chorusRingAmount, 0, 1),
    chorusRingOffsetMode: normalizeInteger(nextValue.chorusRingOffsetMode, defaults.chorusRingOffsetMode, 0, 3),
    chorusRingFineSemitones: normalizeNumber(nextValue.chorusRingFineSemitones, defaults.chorusRingFineSemitones, -2, 2)
  };
}
function normalizeArticulationRouteAmountSnapshot(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nextValue = value;
  const routeId = typeof nextValue.routeId === "string" ? nextValue.routeId.trim() : "";
  if (!routeId) {
    return null;
  }
  return {
    routeId,
    amount: normalizeNumber(nextValue.amount, 0, -48, 48)
  };
}
function normalizeArticulationSnapshot(value) {
  const nextValue = value && typeof value === "object" ? value : {};
  const routeAmounts = Array.isArray(nextValue.modRouteAmounts) ? nextValue.modRouteAmounts.map(normalizeArticulationRouteAmountSnapshot).filter((entry) => entry !== null) : [];
  const routeAmountById = /* @__PURE__ */ new Map();
  for (const routeAmount of routeAmounts) {
    routeAmountById.set(routeAmount.routeId, routeAmount);
  }
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: normalizeArticulationParameterSnapshot(nextValue.parameters),
    envelopes: [0, 1, 2].map((slotIndex) => normalizeEnvelope(
      Array.isArray(nextValue.envelopes) ? nextValue.envelopes[slotIndex] : void 0,
      slotIndex
    )),
    modRouteAmounts: [...routeAmountById.values()]
  };
}
function normalizeArticulationSlot(value, fallbackRuntimeSlot) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nextValue = value;
  const runtimeSlot = normalizeInteger(nextValue.runtimeSlot, fallbackRuntimeSlot, 0, ARTICULATION_MAX_SLOTS - 1);
  const id = typeof nextValue.id === "string" && nextValue.id.trim() ? nextValue.id.trim() : `articulation-${runtimeSlot}`;
  const name = typeof nextValue.name === "string" && nextValue.name.trim() ? nextValue.name.trim() : createDefaultArticulationName(runtimeSlot);
  return {
    id,
    runtimeSlot,
    name,
    snapshot: normalizeArticulationSnapshot(nextValue.snapshot)
  };
}
function normalizeKeyAssignment(value, validArticulationIds) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nextValue = value;
  const articulationId = typeof nextValue.articulationId === "string" ? nextValue.articulationId.trim() : "";
  if (!validArticulationIds.has(articulationId)) {
    return null;
  }
  return {
    note: normalizeInteger(nextValue.note, 0, 0, ARTICULATION_MAX_SLOTS - 1),
    articulationId
  };
}
function normalizeRangeAssignment(value, validArticulationIds, assignmentIndex, idPrefix, minAllowed) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nextValue = value;
  const articulationId = typeof nextValue.articulationId === "string" ? nextValue.articulationId.trim() : "";
  if (!validArticulationIds.has(articulationId)) {
    return null;
  }
  let min = normalizeInteger(nextValue.min, minAllowed, minAllowed, ARTICULATION_MAX_SLOTS - 1);
  let max = normalizeInteger(nextValue.max, min, minAllowed, ARTICULATION_MAX_SLOTS - 1);
  if (max < min) {
    [min, max] = [max, min];
  }
  const id = typeof nextValue.id === "string" && nextValue.id.trim() ? nextValue.id.trim() : `${idPrefix}-${assignmentIndex}`;
  return {
    id,
    articulationId,
    min,
    max
  };
}
function normalizeRangeAssignments(value, validArticulationIds, idPrefix, minAllowed) {
  const inputAssignments = Array.isArray(value) ? value : [];
  const usedIds = /* @__PURE__ */ new Set();
  const assignments = [];
  for (let assignmentIndex = 0; assignmentIndex < inputAssignments.length; assignmentIndex += 1) {
    const assignment = normalizeRangeAssignment(
      inputAssignments[assignmentIndex],
      validArticulationIds,
      assignmentIndex,
      idPrefix,
      minAllowed
    );
    if (!assignment || usedIds.has(assignment.id)) {
      continue;
    }
    usedIds.add(assignment.id);
    assignments.push(assignment);
  }
  return assignments;
}
function normalizeKeyAssignments(value, validArticulationIds) {
  const inputAssignments = Array.isArray(value) ? value : [];
  const usedNotes = /* @__PURE__ */ new Set();
  const assignments = [];
  for (const inputAssignment of inputAssignments) {
    const assignment = normalizeKeyAssignment(inputAssignment, validArticulationIds);
    if (!assignment || usedNotes.has(assignment.note)) {
      continue;
    }
    usedNotes.add(assignment.note);
    assignments.push(assignment);
  }
  return assignments;
}
function normalizeArticulationBank(value) {
  let parsedValue = value;
  if (typeof parsedValue === "string" && parsedValue.trim()) {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch {
      parsedValue = null;
    }
  }
  const nextValue = parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  const inputSlots = Array.isArray(nextValue.slots) ? nextValue.slots : [];
  const usedRuntimeSlots = /* @__PURE__ */ new Set();
  const usedIds = /* @__PURE__ */ new Set();
  const slots = [];
  for (let slotIndex = 0; slotIndex < inputSlots.length && slots.length < ARTICULATION_MAX_SLOTS; slotIndex += 1) {
    const slot = normalizeArticulationSlot(inputSlots[slotIndex], slotIndex);
    if (!slot || usedRuntimeSlots.has(slot.runtimeSlot) || usedIds.has(slot.id)) {
      continue;
    }
    usedRuntimeSlots.add(slot.runtimeSlot);
    usedIds.add(slot.id);
    slots.push(slot);
  }
  const selectedSlotId = typeof nextValue.selectedSlotId === "string" && slots.some((slot) => slot.id === nextValue.selectedSlotId) ? nextValue.selectedSlotId : null;
  const validArticulationIds = new Set(slots.map((slot) => slot.id));
  return {
    format: "cosimo.articulations",
    version: 2,
    selectedSlotId,
    activeTriggerMode: normalizeTriggerMode(nextValue.activeTriggerMode),
    slots,
    chainAssignments: normalizeRangeAssignments(nextValue.chainAssignments, validArticulationIds, "chain", 0),
    keyAssignments: normalizeKeyAssignments(nextValue.keyAssignments, validArticulationIds),
    velocityAssignments: normalizeRangeAssignments(nextValue.velocityAssignments, validArticulationIds, "velocity", 1)
  };
}
function createDisabledRuntimeUpload(selectorA) {
  return {
    selectorA,
    enabled: false,
    framePosition: 0,
    pan: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterQ: 0.707107,
    msegMorphs: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, () => 0),
    routeAmounts: Array.from({ length: MODULATION_MAX_ROUTES }, () => 0),
    envelopeAttackSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).decaySeconds),
    envelopeSustain: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).sustain),
    envelopeReleaseSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).releaseSeconds)
  };
}
function normalizeRuntimeRoutes(routesValue) {
  return Array.isArray(routesValue) ? routesValue.slice(0, MODULATION_MAX_ROUTES).map((route, routeIndex) => normalizeRoute(route, routeIndex)) : [];
}
function buildArticulationRuntimeUploads(bankValue, currentRoutesValue = []) {
  const bank = normalizeArticulationBank(bankValue);
  const currentRoutes = normalizeRuntimeRoutes(currentRoutesValue);
  const slotByRuntimeSlot = new Map(bank.slots.map((slot) => [slot.runtimeSlot, slot]));
  return Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, selectorA) => {
    const slot = slotByRuntimeSlot.get(selectorA);
    if (!slot) {
      return createDisabledRuntimeUpload(selectorA);
    }
    const snapshot = normalizeArticulationSnapshot(slot.snapshot);
    const parameters = snapshot.parameters;
    const routeAmountById = new Map(snapshot.modRouteAmounts.map((routeAmount) => [
      routeAmount.routeId,
      routeAmount.amount
    ]));
    return {
      selectorA,
      enabled: true,
      framePosition: parameters.wavetablePosition,
      pan: parameters.pan,
      warpMode: parameters.warpMode,
      warpAmount: parameters.warpAmount,
      filterMode: parameters.filterMode,
      filterCutoffHz: parameters.filterCutoff,
      filterQ: parameters.filterQ,
      msegMorphs: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_2, slotIndex) => parameters.msegMorphs[slotIndex] ?? 0),
      routeAmounts: Array.from({ length: MODULATION_MAX_ROUTES }, (_2, routeIndex) => {
        const route = currentRoutes[routeIndex];
        if (!route) {
          return 0;
        }
        if (!routeAmountById.has(route.id)) {
          return route.amount;
        }
        return clampModulationRouteAmount(
          route.targetKind,
          Number(routeAmountById.get(route.id))
        );
      }),
      envelopeAttackSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_2, slotIndex) => snapshot.envelopes[slotIndex]?.attackSeconds ?? createDefaultEnvelope(slotIndex).attackSeconds),
      envelopeDecaySeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_2, slotIndex) => snapshot.envelopes[slotIndex]?.decaySeconds ?? createDefaultEnvelope(slotIndex).decaySeconds),
      envelopeSustain: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_2, slotIndex) => snapshot.envelopes[slotIndex]?.sustain ?? createDefaultEnvelope(slotIndex).sustain),
      envelopeReleaseSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_2, slotIndex) => snapshot.envelopes[slotIndex]?.releaseSeconds ?? createDefaultEnvelope(slotIndex).releaseSeconds)
    };
  });
}
const runtimeStateEndpointID$2 = "runtimeState";
function hasOwnValue$1(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}
function getFullStoredStateValue$1(storedState, key) {
  const fullState = storedState && typeof storedState === "object" ? storedState : {};
  const values = fullState.values && typeof fullState.values === "object" ? fullState.values : {};
  if (hasOwnValue$1(values, key)) {
    return values[key];
  }
  if (hasOwnValue$1(fullState, key)) {
    return fullState[key];
  }
  return void 0;
}
function getRuntimeDspSessionId$1(value) {
  if (!value || typeof value !== "object") {
    return 0;
  }
  return Math.trunc(Number(value.dspSessionId) || 0);
}
function toStableToken$1(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
class ArticulationWorkerService {
  constructor(connection) {
    this.connection = connection;
  }
  articulationBank = normalizeArticulationBank(void 0);
  modulationState = deserializeModulationState(void 0);
  hasArticulationState = false;
  hasModulationState = false;
  hasRuntimeState = false;
  runtimeDspSessionId = 0;
  started = false;
  lastAppliedToken = null;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
    this.connection.addEndpointListener?.(runtimeStateEndpointID$2, this.handleRuntimeStateBound);
    this.requestBootState();
  }
  stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
    this.connection.removeEndpointListener?.(runtimeStateEndpointID$2, this.handleRuntimeStateBound);
  }
  requestBootState() {
    if (typeof this.connection.requestFullStoredState === "function") {
      this.connection.requestFullStoredState((storedState) => {
        this.applyArticulationState(getFullStoredStateValue$1(storedState, ARTICULATION_STATE_KEY));
        this.applyModulationState(getFullStoredStateValue$1(storedState, MODULATION_STATE_KEY));
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue === "function") {
      this.connection.requestStoredStateValue(ARTICULATION_STATE_KEY);
      this.connection.requestStoredStateValue(MODULATION_STATE_KEY);
      return;
    }
    this.applyArticulationState(void 0);
    this.applyModulationState(void 0);
  }
  handleStoredStateValue(message) {
    if (!message || typeof message !== "object") {
      return;
    }
    const nextMessage = message;
    if (nextMessage.key === ARTICULATION_STATE_KEY) {
      this.applyArticulationState(nextMessage.value);
      return;
    }
    if (nextMessage.key === MODULATION_STATE_KEY) {
      this.applyModulationState(nextMessage.value);
    }
  }
  handleRuntimeState(value) {
    this.runtimeDspSessionId = getRuntimeDspSessionId$1(value);
    this.hasRuntimeState = true;
    this.applyRuntimeStateIfReady();
  }
  applyArticulationState(value) {
    this.articulationBank = normalizeArticulationBank(value);
    this.hasArticulationState = true;
    this.applyRuntimeStateIfReady();
  }
  applyModulationState(value) {
    this.modulationState = deserializeModulationState(value);
    this.hasModulationState = true;
    this.applyRuntimeStateIfReady();
  }
  applyRuntimeStateIfReady() {
    if (!this.hasArticulationState || !this.hasModulationState || !this.hasRuntimeState) {
      return;
    }
    const uploads = buildArticulationRuntimeUploads(this.articulationBank, this.modulationState.routes);
    const nextAppliedToken = toStableToken$1({
      runtimeDspSessionId: this.runtimeDspSessionId,
      uploads
    });
    if (nextAppliedToken === this.lastAppliedToken) {
      return;
    }
    for (const upload of uploads) {
      this.connection.sendEventOrValue?.(ARTICULATION_SNAPSHOT_ENDPOINT_ID, upload);
    }
    this.lastAppliedToken = nextAppliedToken;
  }
}
function createArticulationWorkerService(connection) {
  return new ArticulationWorkerService(connection);
}
function hasOwnValue(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}
function getFullStoredStateValue(storedState, key) {
  const fullState = storedState && typeof storedState === "object" ? storedState : {};
  const values = fullState.values && typeof fullState.values === "object" ? fullState.values : {};
  if (hasOwnValue(values, key)) {
    return {
      found: true,
      value: values[key]
    };
  }
  if (hasOwnValue(fullState, key)) {
    return {
      found: true,
      value: fullState[key]
    };
  }
  return {
    found: false,
    value: void 0
  };
}
function toStableToken(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
class StoredStateRuntimeMirror {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
  parameterValues = /* @__PURE__ */ new Map();
  parameterListeners = /* @__PURE__ */ new Map();
  runtimeEndpointValues = /* @__PURE__ */ new Map();
  runtimeEndpointListeners = /* @__PURE__ */ new Map();
  state = null;
  hasState = false;
  started = false;
  lastAppliedToken = null;
  constructor(connection, options) {
    this.connection = connection;
    this.options = options;
    this.parameterEndpointIDs = [...new Set(options.parameterEndpointIDs ?? [])];
    this.runtimeEndpointDependencies = dedupeRuntimeEndpointDependencies(options.runtimeEndpointDependencies ?? []);
    this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
    for (const endpointID of this.parameterEndpointIDs) {
      this.connection.addParameterListener?.(endpointID, this.getParameterListener(endpointID));
      this.connection.requestParameterValue?.(endpointID);
    }
    for (const dependency of this.runtimeEndpointDependencies) {
      this.connection.addEndpointListener?.(dependency.endpointID, this.getRuntimeEndpointListener(dependency));
    }
    this.requestStoredState();
  }
  stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
    for (const endpointID of this.parameterEndpointIDs) {
      this.connection.removeParameterListener?.(endpointID, this.getParameterListener(endpointID));
    }
    for (const dependency of this.runtimeEndpointDependencies) {
      this.connection.removeEndpointListener?.(dependency.endpointID, this.getRuntimeEndpointListener(dependency));
    }
  }
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState === "function") {
      this.connection.requestFullStoredState((storedState) => {
        const storedValue = getFullStoredStateValue(storedState, this.options.stateKey);
        if (storedValue.found) {
          this.applyStoredValue(storedValue.value);
          return;
        }
        this.handleMissingStoredState();
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue === "function") {
      this.connection.requestStoredStateValue(this.options.stateKey);
      return;
    }
    this.handleMissingStoredState();
  }
  handleMissingStoredState() {
    if (typeof this.connection.requestStoredStateValue === "function") {
      this.connection.requestStoredStateValue(this.options.stateKey);
      return;
    }
    if (this.options.applyDefaultRuntimeStateWhenMissing) {
      this.applyStoredValue(void 0);
    }
  }
  handleStoredStateValue(message) {
    if (!message || typeof message !== "object") {
      return;
    }
    const nextMessage = message;
    if (nextMessage.key !== this.options.stateKey) {
      return;
    }
    if (nextMessage.value === void 0 && !this.options.applyDefaultRuntimeStateWhenMissing) {
      return;
    }
    this.applyStoredValue(nextMessage.value);
  }
  getParameterListener(endpointID) {
    const existingListener = this.parameterListeners.get(endpointID);
    if (existingListener) {
      return existingListener;
    }
    const listener = (value) => {
      this.parameterValues.set(endpointID, value);
      this.applyRuntimeStateIfReady();
    };
    this.parameterListeners.set(endpointID, listener);
    return listener;
  }
  getRuntimeEndpointListener(dependency) {
    const existingListener = this.runtimeEndpointListeners.get(dependency.endpointID);
    if (existingListener) {
      return existingListener;
    }
    const listener = (value) => {
      const mappedValue = dependency.mapValue ? dependency.mapValue(value) : value;
      this.runtimeEndpointValues.set(dependency.endpointID, mappedValue);
      this.applyRuntimeStateIfReady();
    };
    this.runtimeEndpointListeners.set(dependency.endpointID, listener);
    return listener;
  }
  applyStoredValue(value) {
    this.state = this.options.deserializeStoredState(value);
    this.hasState = true;
    this.applyRuntimeStateIfReady();
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState) {
      return;
    }
    const parameters = {};
    for (const endpointID of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(endpointID)) {
        return;
      }
      parameters[endpointID] = this.parameterValues.get(endpointID);
    }
    const runtimeEndpoints = {};
    for (const dependency of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(dependency.endpointID)) {
        if (dependency.required) {
          return;
        }
        continue;
      }
      runtimeEndpoints[dependency.endpointID] = this.runtimeEndpointValues.get(dependency.endpointID);
    }
    const snapshot = {
      state: this.state,
      parameters,
      runtimeEndpoints
    };
    const events = this.options.buildRuntimeEvents(snapshot);
    const nextAppliedToken = toStableToken({
      runtimeEndpoints,
      events
    });
    if (nextAppliedToken === this.lastAppliedToken) {
      return;
    }
    for (const event of events) {
      this.connection.sendEventOrValue?.(event.endpointID, event.value);
    }
    this.lastAppliedToken = nextAppliedToken;
  }
}
function dedupeRuntimeEndpointDependencies(dependencies) {
  const dependenciesByEndpointID = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    if (!dependenciesByEndpointID.has(dependency.endpointID)) {
      dependenciesByEndpointID.set(dependency.endpointID, dependency);
    }
  }
  return [...dependenciesByEndpointID.values()];
}
function createStoredStateRuntimeMirror(connection, options) {
  return new StoredStateRuntimeMirror(connection, options);
}
const runtimeStateEndpointID$1 = "runtimeState";
function getRuntimeDspSessionId(value) {
  if (!value || typeof value !== "object") {
    return 0;
  }
  return Math.trunc(Number(value.dspSessionId) || 0);
}
function createModulationWorkerService(connection) {
  return createStoredStateRuntimeMirror(connection, {
    stateKey: MODULATION_STATE_KEY,
    runtimeEndpointDependencies: [{
      endpointID: runtimeStateEndpointID$1,
      required: true,
      mapValue: getRuntimeDspSessionId
    }],
    applyDefaultRuntimeStateWhenMissing: true,
    deserializeStoredState: deserializeModulationState,
    buildRuntimeEvents: ({ state }) => buildModulationRuntimeEvents(state)
  });
}
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const workerLoadFailureEndpointID = "workerLoadFailure";
const serviceLoadAbortEndpointID = "serviceLoadAbort";
const loadBeginEndpointID = "wavetableLoadBegin";
const mipFrameEndpointID = "wavetableMipFrame";
const uploadAckEndpointID = "wavetableUploadAck";
const mipRequestEndpointID = "wavetableMipRequest";
const prewarmRequestEndpointID = "wavetablePrewarmRequest";
const prewarmNotificationEndpointID = "wavetablePrewarmNotification";
const defaultCatalogPath = "assets/factory-bank-catalog.json";
const FAILURE_PHASE_LOAD_SOURCE = 1;
const FAILURE_PHASE_BUILD_MIP = 2;
const FAILURE_PHASE_TRANSFER_MIP = 3;
const FAILURE_REASON_GENERIC = 1;
const FAILURE_REASON_TIMEOUT = 2;
const defaultServiceLoadTimeoutMs = 2e4;
const failurePhaseLoadSource = FAILURE_PHASE_LOAD_SOURCE;
const failurePhaseBuildMip = FAILURE_PHASE_BUILD_MIP;
const failurePhaseTransferMip = FAILURE_PHASE_TRANSFER_MIP;
const failureReasonGeneric = FAILURE_REASON_GENERIC;
const failureReasonTimeout = FAILURE_REASON_TIMEOUT;
const defaultCacheBudgetBytes = 48 * 1024 * 1024;
function resolvePositiveIntegerOption(value, fallback) {
  const normalized = Math.round(Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}
function emitWorkerLog(level, message, fields = null) {
  const logger = typeof console?.[level] === "function" ? console[level].bind(console) : console.log?.bind(console);
  if (!logger) {
    return;
  }
  if (fields && Object.keys(fields).length > 0) {
    logger(`[wavetable-worker] ${message}`, fields);
    return;
  }
  logger(`[wavetable-worker] ${message}`);
}
function summarizeRuntimeStateForLog(runtimeState) {
  return {
    dspSessionId: runtimeState.dspSessionId,
    desiredIntentSerial: runtimeState.desiredIntentSerial,
    desiredTableIndex: runtimeState.desiredTableIndex,
    generationFrontier: runtimeState.generationFrontier,
    serviceState: runtimeState.serviceState,
    active: runtimeState.hasActive ? {
      tableIndex: runtimeState.activeTableIndex,
      generation: runtimeState.activeGeneration
    } : null,
    loading: runtimeState.hasLoading ? {
      tableIndex: runtimeState.loadingTableIndex,
      generation: runtimeState.loadingGeneration
    } : null,
    failure: runtimeState.hasFailure ? {
      tableIndex: runtimeState.failedTableIndex,
      generation: runtimeState.failedGeneration,
      scope: runtimeState.failureScope,
      phase: runtimeState.failurePhase,
      reason: runtimeState.failureReasonCode
    } : null
  };
}
function shouldLogFrameProgress(frameIndex, frameCount) {
  const nextFrame = frameIndex + 1;
  return nextFrame === 1 || nextFrame === frameCount || nextFrame % 16 === 0;
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
async function readCatalogFromResourceClient(resourceClient, catalogPath) {
  return getFactoryBankCatalogValue(await resourceClient.readJSON(catalogPath));
}
function normalizeRuntimeState(state) {
  return {
    dspSessionId: Math.trunc(Number(state?.dspSessionId) || 0),
    desiredIntentSerial: Math.trunc(Number(state?.desiredIntentSerial) || 0),
    desiredTableIndex: Math.trunc(Number(state?.desiredTableIndex) || 0),
    generationFrontier: Math.trunc(Number(state?.generationFrontier) || 0),
    serviceState: Math.trunc(Number(state?.serviceState) || 0),
    hasActive: Boolean(state?.hasActive),
    activeTableIndex: Math.trunc(Number(state?.activeTableIndex) || 0),
    activeGeneration: Math.trunc(Number(state?.activeGeneration) || 0),
    hasLoading: Boolean(state?.hasLoading),
    loadingTableIndex: Math.trunc(Number(state?.loadingTableIndex) || 0),
    loadingGeneration: Math.trunc(Number(state?.loadingGeneration) || 0),
    hasFailure: Boolean(state?.hasFailure),
    failedTableIndex: Math.trunc(Number(state?.failedTableIndex) || 0),
    failedGeneration: Math.trunc(Number(state?.failedGeneration) || 0),
    failureScope: Math.trunc(Number(state?.failureScope) || 0),
    failurePhase: Math.trunc(Number(state?.failurePhase) || 0),
    failureReasonCode: Math.trunc(Number(state?.failureReasonCode) || 0)
  };
}
function normalizeRequestedTableIndex(value, tableCount) {
  const rounded = Math.round(Number(value) || 0);
  return clamp(rounded, 0, Math.max(0, tableCount - 1));
}
function createMipJobKey(dspSessionId, generation, mipIndex) {
  return `${dspSessionId}:${generation}:${mipIndex}`;
}
function createTableCacheKey(tableMeta, samplesPerFrame, mipLevelCount) {
  return [
    tableMeta.tableId,
    tableMeta.sourceWav,
    samplesPerFrame,
    mipLevelCount
  ].join("|");
}
function estimateLoadedTableBytes(table) {
  let bytes = 0;
  for (const frame of table.frames) {
    bytes += frame.byteLength;
  }
  for (const spectrum of table.spectra) {
    if (spectrum) {
      bytes += spectrum.real.byteLength + spectrum.imaginary.byteLength;
    }
  }
  return bytes;
}
function createEmptyMipJobFrameState(frameCount) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(frameCount),
    ackedFrameCount: 0,
    inFlightFrames: /* @__PURE__ */ new Set()
  };
}
function getNow() {
  return typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();
}
class WavetableWorkerController {
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
  started = false;
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
  constructor(connection, options = {}) {
    this.connection = connection;
    this.resourceClient = asResourceClient(options.resourceClient ?? connection);
    this.catalogPath = options.catalogPath ?? defaultCatalogPath;
    this.maxFramesInFlight = resolvePositiveIntegerOption(options.maxFramesInFlight, 1);
    this.mipLevelCount = options.mipLevelCount ?? DEFAULT_MIP_LEVEL_COUNT;
    this.cacheBudgetBytes = Math.max(0, Math.round(Number(options.cacheBudgetBytes ?? defaultCacheBudgetBytes) || 0));
    this.serviceLoadTimeoutMs = resolvePositiveIntegerOption(options.serviceLoadTimeoutMs, defaultServiceLoadTimeoutMs);
    this.setTimeoutFn = typeof options.setTimeoutFn === "function" ? options.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null;
    this.clearTimeoutFn = typeof options.clearTimeoutFn === "function" ? options.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null;
    this.handleRuntimeState = this.handleRuntimeState.bind(this);
    this.handleUploadAck = this.handleUploadAck.bind(this);
    this.handleMipRequest = this.handleMipRequest.bind(this);
    this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started) {
      return this;
    }
    this.started = true;
    emitWorkerLog("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxFramesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    });
    this.connection.addEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeState);
    this.connection.addEndpointListener?.(uploadAckEndpointID, this.handleUploadAck);
    this.connection.addEndpointListener?.(mipRequestEndpointID, this.handleMipRequest);
    this.connection.addEndpointListener?.(prewarmRequestEndpointID, this.handlePrewarmRequest);
    this.connection.addEndpointListener?.(prewarmNotificationEndpointID, this.handlePrewarmRequest);
    this.connection.sendEventOrValue?.(runtimeSyncRequestEndpointID, 1);
    return this;
  }
  async ensureCatalogLoaded() {
    if (!this.catalog) {
      this.catalog = await readCatalogFromResourceClient(this.resourceClient, this.catalogPath);
      emitWorkerLog("info", "Loaded wavetable catalog", {
        catalogPath: this.catalogPath,
        tableCount: this.catalog.tables.length
      });
    }
    return this.catalog;
  }
  resetSessionState(runtimeState) {
    this.knownSessionId = runtimeState.dspSessionId;
    this.nextLoadGeneration = Math.max(1, runtimeState.generationFrontier + 1);
    this.serviceTable = null;
    this.candidateValidation = null;
    this.mipJobs.clear();
    this.activeUploadKey = null;
    this.autoRetryConsumedKey = null;
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog();
    this.mipJobs.clear();
    this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(entry) {
    this.tableCacheBytes -= entry.byteCount;
    entry.byteCount = estimateLoadedTableBytes(entry);
    entry.lastUsedSerial = this.cacheUseSerial++;
    this.tableCacheBytes += entry.byteCount;
    this.evictCacheIfNeeded();
  }
  getPinnedCacheKeys() {
    const pinned = /* @__PURE__ */ new Set();
    if (this.serviceTable?.cacheKey) {
      pinned.add(this.serviceTable.cacheKey);
    }
    return pinned;
  }
  evictCacheIfNeeded() {
    if (this.cacheBudgetBytes <= 0) {
      return;
    }
    const pinned = this.getPinnedCacheKeys();
    while (this.tableCacheBytes > this.cacheBudgetBytes) {
      let evictKey = null;
      let evictEntry = null;
      for (const [key, entry] of this.tableCache) {
        if (pinned.has(key)) {
          continue;
        }
        if (!evictEntry || entry.lastUsedSerial < evictEntry.lastUsedSerial) {
          evictKey = key;
          evictEntry = entry;
        }
      }
      if (!evictKey || !evictEntry) {
        return;
      }
      this.tableCache.delete(evictKey);
      this.tableCacheBytes -= evictEntry.byteCount;
    }
  }
  rememberLoadedTable(table) {
    const existing = this.tableCache.get(table.cacheKey);
    if (existing) {
      existing.lastUsedSerial = this.cacheUseSerial++;
      return existing;
    }
    const entry = {
      ...table,
      byteCount: estimateLoadedTableBytes(table),
      lastUsedSerial: this.cacheUseSerial++
    };
    this.tableCache.set(entry.cacheKey, entry);
    this.tableCacheBytes += entry.byteCount;
    this.evictCacheIfNeeded();
    return entry;
  }
  createFullMipJobsForServiceTable(urgencyLevel = 2) {
    if (!this.serviceTable || this.serviceTable.mode !== "loading") {
      return;
    }
    for (let mipIndex = 0; mipIndex < this.mipLevelCount; mipIndex += 1) {
      const key = createMipJobKey(
        this.serviceTable.dspSessionId,
        this.serviceTable.generation,
        mipIndex
      );
      if (this.mipJobs.has(key)) {
        continue;
      }
      this.mipJobs.set(key, {
        key,
        dspSessionId: this.serviceTable.dspSessionId,
        generation: this.serviceTable.generation,
        tableIndex: this.serviceTable.tableIndex,
        mipIndex,
        urgencyLevel,
        ...createEmptyMipJobFrameState(this.serviceTable.frameCount),
        completed: false
      });
    }
  }
  cancelServiceLoadWatchdog() {
    if (this.serviceLoadWatchdogHandle === null) {
      return;
    }
    this.clearTimeoutFn?.(this.serviceLoadWatchdogHandle);
    this.serviceLoadWatchdogHandle = null;
  }
  serviceLoadHasPendingTransfers() {
    if (!this.serviceTable || this.serviceTable.mode !== "loading") {
      return false;
    }
    for (const job of this.mipJobs.values()) {
      if (job.dspSessionId === this.serviceTable.dspSessionId && job.generation === this.serviceTable.generation && job.tableIndex === this.serviceTable.tableIndex && !job.completed && (job.inFlightFrames.size > 0 || job.nextFrameIndex > 0)) {
        return true;
      }
    }
    return false;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId, generation, tableIndex } = this.serviceTable;
    this.cancelServiceLoadWatchdog();
    this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null;
      if (!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== dspSessionId || this.serviceTable.generation !== generation || this.serviceTable.tableIndex !== tableIndex || !this.serviceLoadHasPendingTransfers()) {
        return;
      }
      emitWorkerLog("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId,
        generation,
        tableIndex,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      });
      this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId,
          generation,
          tableIndex
        },
        {
          failurePhase: failurePhaseTransferMip,
          failureReasonCode: failureReasonTimeout
        }
      );
      this.serviceTable = null;
      this.clearMipTransferState();
    }, this.serviceLoadTimeoutMs);
    const maybeNodeTimer = this.serviceLoadWatchdogHandle;
    maybeNodeTimer?.unref?.();
  }
  resolveServiceTarget(runtimeState) {
    if (runtimeState.hasLoading) {
      return {
        kind: "loading",
        dspSessionId: runtimeState.dspSessionId,
        generation: runtimeState.loadingGeneration,
        tableIndex: runtimeState.loadingTableIndex
      };
    }
    if (runtimeState.hasActive) {
      return {
        kind: "active",
        dspSessionId: runtimeState.dspSessionId,
        generation: runtimeState.activeGeneration,
        tableIndex: runtimeState.activeTableIndex
      };
    }
    return null;
  }
  shouldStayIdleOnFailure(runtimeState) {
    return runtimeState.hasFailure && runtimeState.failedTableIndex === runtimeState.desiredTableIndex && runtimeState.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(runtimeState) {
    return `${runtimeState.dspSessionId}:${runtimeState.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(runtimeState) {
    if (!runtimeState.hasFailure || runtimeState.failedTableIndex !== runtimeState.desiredTableIndex || runtimeState.failurePhase !== failurePhaseTransferMip || runtimeState.failureReasonCode !== failureReasonTimeout) {
      return false;
    }
    return this.autoRetryConsumedKey !== this.getDesiredRetryKey(runtimeState);
  }
  emitWorkerLoadFailure({
    dspSessionId,
    tableIndex,
    generation = 0,
    candidateAttemptSerial = 0,
    failurePhase = failurePhaseLoadSource,
    failureReasonCode = failureReasonGeneric
  }) {
    this.connection.sendEventOrValue?.(workerLoadFailureEndpointID, {
      dspSessionId,
      tableIndex,
      generation,
      candidateAttemptSerial,
      failurePhase,
      failureReasonCode
    });
  }
  emitServiceLoadAbort({
    dspSessionId,
    generation,
    tableIndex,
    failureReasonCode = failureReasonGeneric
  }) {
    this.connection.sendEventOrValue?.(serviceLoadAbortEndpointID, {
      dspSessionId,
      generation,
      tableIndex,
      failureReasonCode
    });
  }
  emitRetryDesiredTableRequest() {
    emitWorkerLog("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeState ? summarizeRuntimeStateForLog(this.latestRuntimeState) : null
    });
    this.connection.sendEventOrValue?.(retryDesiredTableRequestEndpointID, 1);
  }
  async loadTableSource(tableIndex, expectedFrameCount, token) {
    const catalog = await this.ensureCatalogLoaded();
    if (token !== this.asyncStateToken) {
      return null;
    }
    const normalizedIndex = normalizeRequestedTableIndex(tableIndex, catalog.tables.length);
    const tableMeta = catalog.tables[normalizedIndex];
    assert(tableMeta, `Could not resolve table ${normalizedIndex}`);
    const cacheKey = createTableCacheKey(tableMeta, DEFAULT_SAMPLES_PER_FRAME$1, this.mipLevelCount);
    const cachedTable = this.tableCache.get(cacheKey);
    if (cachedTable) {
      cachedTable.lastUsedSerial = this.cacheUseSerial++;
      emitWorkerLog("info", "Using cached wavetable source table", {
        tableIndex: normalizedIndex,
        tableId: tableMeta.tableId,
        tableName: tableMeta.name,
        sourceWav: tableMeta.sourceWav,
        frameCount: cachedTable.frameCount,
        cacheBytes: this.tableCacheBytes
      });
      return cachedTable;
    }
    const startTime = getNow();
    emitWorkerLog("info", "Reading wavetable source", {
      tableIndex: normalizedIndex,
      tableId: tableMeta.tableId,
      tableName: tableMeta.name,
      sourceWav: tableMeta.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: expectedFrameCount === void 0 ? Number(tableMeta.frameCount) : expectedFrameCount
    });
    const sourceAudio = await this.resourceClient.readAudio(tableMeta.sourceWav);
    const sourceTable = extractSourceFramesFromSamples(sourceAudio.samples, {
      expectedFrameCount: expectedFrameCount === void 0 ? Number(tableMeta.frameCount) : expectedFrameCount,
      samplesPerFrame: DEFAULT_SAMPLES_PER_FRAME$1
    });
    if (!sourceTable || token !== this.asyncStateToken) {
      return null;
    }
    emitWorkerLog("info", "Prepared wavetable source table", {
      tableIndex: normalizedIndex,
      tableId: tableMeta.tableId,
      tableName: tableMeta.name,
      sourceWav: tableMeta.sourceWav,
      frameCount: sourceTable.frameCount,
      loadDurationMs: Math.round(getNow() - startTime)
    });
    return this.rememberLoadedTable({
      cacheKey,
      tableIndex: normalizedIndex,
      tableMeta,
      frameCount: sourceTable.frameCount,
      frames: sourceTable.frames,
      spectra: new Array(sourceTable.frameCount)
    });
  }
  isMatchingServiceTable(serviceTarget) {
    return Boolean(
      this.serviceTable && this.serviceTable.dspSessionId === serviceTarget.dspSessionId && this.serviceTable.generation === serviceTarget.generation && this.serviceTable.tableIndex === serviceTarget.tableIndex
    );
  }
  markCommittedDesiredLoad(runtimeState, generation, loadedTable) {
    emitWorkerLog("info", "Committing desired wavetable load", {
      dspSessionId: runtimeState.dspSessionId,
      desiredIntentSerial: runtimeState.desiredIntentSerial,
      generation,
      tableIndex: runtimeState.desiredTableIndex,
      tableName: loadedTable.tableMeta?.name ?? null,
      frameCount: loadedTable.frameCount
    });
    this.serviceTable = {
      ...loadedTable,
      mode: "loading",
      dspSessionId: runtimeState.dspSessionId,
      generation,
      desiredIntentSerial: runtimeState.desiredIntentSerial
    };
    this.candidateValidation = {
      dspSessionId: runtimeState.dspSessionId,
      tableIndex: runtimeState.desiredTableIndex,
      desiredIntentSerial: runtimeState.desiredIntentSerial,
      generation
    };
    this.nextLoadGeneration = generation + 1;
    this.clearMipTransferState();
    this.connection.sendEventOrValue?.(loadBeginEndpointID, {
      dspSessionId: runtimeState.dspSessionId,
      generation,
      tableIndex: runtimeState.desiredTableIndex,
      frameCount: loadedTable.frameCount
    });
    this.createFullMipJobsForServiceTable(2);
    this.pumpUploads();
  }
  handleCandidateLoadFailure(runtimeState) {
    emitWorkerLog("error", "Failed to prepare desired wavetable source", {
      dspSessionId: runtimeState.dspSessionId,
      desiredIntentSerial: runtimeState.desiredIntentSerial,
      tableIndex: runtimeState.desiredTableIndex,
      failurePhase: failurePhaseLoadSource,
      failureReasonCode: failureReasonGeneric
    });
    this.emitWorkerLoadFailure({
      dspSessionId: runtimeState.dspSessionId,
      tableIndex: runtimeState.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: runtimeState.desiredIntentSerial,
      failurePhase: failurePhaseLoadSource,
      failureReasonCode: failureReasonGeneric
    });
  }
  handleServiceTargetFailure(serviceTarget, {
    failurePhase = failurePhaseLoadSource,
    failureReasonCode = failureReasonGeneric
  } = {}) {
    emitWorkerLog("error", "Service wavetable load failed", {
      kind: serviceTarget.kind,
      dspSessionId: serviceTarget.dspSessionId,
      generation: serviceTarget.generation,
      tableIndex: serviceTarget.tableIndex,
      failurePhase,
      failureReasonCode
    });
    this.emitWorkerLoadFailure({
      dspSessionId: serviceTarget.dspSessionId,
      tableIndex: serviceTarget.tableIndex,
      generation: serviceTarget.generation,
      candidateAttemptSerial: 0,
      failurePhase,
      failureReasonCode
    });
    if (serviceTarget.kind === "loading") {
      this.emitServiceLoadAbort({
        dspSessionId: serviceTarget.dspSessionId,
        generation: serviceTarget.generation,
        tableIndex: serviceTarget.tableIndex,
        failureReasonCode
      });
    }
  }
  async prepareServiceTarget(serviceTarget, runtimeState, token) {
    if (this.isMatchingServiceTable(serviceTarget)) {
      if (this.serviceTable) {
        this.serviceTable.mode = serviceTarget.kind;
      }
      if (this.candidateValidation && this.candidateValidation.dspSessionId === serviceTarget.dspSessionId && this.candidateValidation.generation === serviceTarget.generation && this.candidateValidation.tableIndex === serviceTarget.tableIndex) {
        this.candidateValidation = null;
      }
      return true;
    }
    let loadedTable = null;
    try {
      loadedTable = await this.loadTableSource(serviceTarget.tableIndex, void 0, token);
    } catch (error) {
      if (token === this.asyncStateToken) {
        emitWorkerLog("error", "Could not reload committed service wavetable source", {
          kind: serviceTarget.kind,
          dspSessionId: serviceTarget.dspSessionId,
          generation: serviceTarget.generation,
          tableIndex: serviceTarget.tableIndex,
          detail: describeErrorDetail(error)
        });
        this.handleServiceTargetFailure(serviceTarget);
      }
      return false;
    }
    if (!loadedTable || token !== this.asyncStateToken) {
      return false;
    }
    this.serviceTable = {
      ...loadedTable,
      mode: serviceTarget.kind,
      dspSessionId: serviceTarget.dspSessionId,
      generation: serviceTarget.generation,
      desiredIntentSerial: runtimeState.desiredIntentSerial
    };
    this.clearMipTransferState();
    if (serviceTarget.kind === "loading") {
      this.createFullMipJobsForServiceTable(2);
      this.pumpUploads();
    }
    if (this.candidateValidation && this.candidateValidation.dspSessionId === serviceTarget.dspSessionId && this.candidateValidation.generation === serviceTarget.generation && this.candidateValidation.tableIndex === serviceTarget.tableIndex) {
      this.candidateValidation = null;
    }
    return true;
  }
  async prepareDesiredLoad(runtimeState, token) {
    const desiredTableIndex = runtimeState.desiredTableIndex;
    if (this.candidateValidation && this.candidateValidation.dspSessionId === runtimeState.dspSessionId && this.candidateValidation.tableIndex === desiredTableIndex && this.candidateValidation.desiredIntentSerial === runtimeState.desiredIntentSerial) {
      return;
    }
    const generation = Math.max(
      this.nextLoadGeneration,
      runtimeState.generationFrontier + 1
    );
    let loadedTable = null;
    try {
      loadedTable = await this.loadTableSource(desiredTableIndex, void 0, token);
    } catch (error) {
      if (token === this.asyncStateToken) {
        emitWorkerLog("error", "Could not prepare desired wavetable source", {
          dspSessionId: runtimeState.dspSessionId,
          desiredIntentSerial: runtimeState.desiredIntentSerial,
          tableIndex: desiredTableIndex,
          detail: describeErrorDetail(error)
        });
        this.handleCandidateLoadFailure(runtimeState);
      }
      return;
    }
    if (!loadedTable || token !== this.asyncStateToken) {
      return;
    }
    this.markCommittedDesiredLoad(runtimeState, generation, loadedTable);
  }
  async prepareDesiredCandidate(runtimeState, token) {
    await this.prepareDesiredLoad(runtimeState, token);
  }
  async handleRuntimeState(nextState) {
    try {
      const runtimeState = normalizeRuntimeState(nextState ?? {});
      emitWorkerLog("info", "Received runtime state", summarizeRuntimeStateForLog(runtimeState));
      if (runtimeState.dspSessionId <= 0) {
        return;
      }
      const sessionChanged = runtimeState.dspSessionId !== this.knownSessionId;
      const previousDesiredRetryKey = this.latestRuntimeState ? this.getDesiredRetryKey(this.latestRuntimeState) : null;
      const currentDesiredRetryKey = this.getDesiredRetryKey(runtimeState);
      if (sessionChanged) {
        this.resetSessionState(runtimeState);
      } else {
        this.nextLoadGeneration = Math.max(
          this.nextLoadGeneration,
          runtimeState.generationFrontier + 1
        );
      }
      if (sessionChanged || previousDesiredRetryKey !== currentDesiredRetryKey) {
        this.autoRetryConsumedKey = null;
      }
      this.latestRuntimeState = runtimeState;
      const token = this.asyncStateToken + 1;
      this.asyncStateToken = token;
      if (this.candidateValidation && this.candidateValidation.dspSessionId === runtimeState.dspSessionId && this.candidateValidation.generation > runtimeState.generationFrontier) {
        return;
      }
      const serviceTarget = this.resolveServiceTarget(runtimeState);
      const skipDesiredCandidateForRestoredActiveService = sessionChanged && serviceTarget?.kind === "active";
      if (serviceTarget) {
        const prepared = await this.prepareServiceTarget(serviceTarget, runtimeState, token);
        if (!prepared) {
          return;
        }
        if (serviceTarget.kind === "loading" && runtimeState.desiredTableIndex !== serviceTarget.tableIndex && !this.shouldStayIdleOnFailure(runtimeState)) {
          emitWorkerLog("warn", "Aborting obsolete wavetable load because the desired table changed", {
            dspSessionId: serviceTarget.dspSessionId,
            generation: serviceTarget.generation,
            staleTableIndex: serviceTarget.tableIndex,
            desiredTableIndex: runtimeState.desiredTableIndex,
            desiredIntentSerial: runtimeState.desiredIntentSerial
          });
          this.emitServiceLoadAbort({
            dspSessionId: serviceTarget.dspSessionId,
            generation: serviceTarget.generation,
            tableIndex: serviceTarget.tableIndex,
            failureReasonCode: failureReasonGeneric
          });
          this.serviceTable = null;
          this.clearMipTransferState();
          return;
        }
        if (serviceTarget.kind === "active" && runtimeState.desiredTableIndex !== serviceTarget.tableIndex && !this.shouldStayIdleOnFailure(runtimeState) && !skipDesiredCandidateForRestoredActiveService) {
          await this.prepareDesiredCandidate(runtimeState, token);
        }
        return;
      }
      this.serviceTable = null;
      this.clearMipTransferState();
      if (this.shouldAutomaticallyRetryTimeoutFailure(runtimeState)) {
        this.autoRetryConsumedKey = currentDesiredRetryKey;
        this.emitRetryDesiredTableRequest();
        return;
      }
      if (runtimeState.serviceState !== 0 || this.shouldStayIdleOnFailure(runtimeState)) {
        return;
      }
      await this.prepareDesiredLoad(runtimeState, token);
    } catch (error) {
      console.error(error);
    }
  }
  async handlePrewarmRequest(request) {
    const prewarm = request !== null && typeof request === "object" && !Array.isArray(request) ? request : null;
    const tableIndex = Math.trunc(Number(prewarm?.tableIndex ?? request));
    if (!Number.isFinite(tableIndex)) {
      return;
    }
    const token = this.asyncStateToken;
    try {
      const loadedTable = await this.loadTableSource(tableIndex, void 0, token);
      if (!loadedTable || token !== this.asyncStateToken) {
        return;
      }
      for (let frameIndex = 0; frameIndex < loadedTable.frameCount; frameIndex += 1) {
        if (!loadedTable.spectra[frameIndex]) {
          loadedTable.spectra[frameIndex] = buildFrameSpectrum(loadedTable.frames[frameIndex]);
        }
      }
      const cacheEntry = this.tableCache.get(loadedTable.cacheKey);
      if (cacheEntry) {
        this.refreshCacheEntryByteCount(cacheEntry);
      }
      emitWorkerLog("info", "Prewarmed wavetable source table", {
        tableIndex: loadedTable.tableIndex,
        tableId: loadedTable.tableMeta.tableId,
        tableName: loadedTable.tableMeta.name,
        reason: typeof prewarm?.reason === "string" ? prewarm.reason : null,
        cacheBytes: this.tableCacheBytes
      });
    } catch (error) {
      emitWorkerLog("warn", "Ignoring wavetable prewarm failure", {
        tableIndex,
        reason: typeof prewarm?.reason === "string" ? prewarm.reason : null,
        detail: describeErrorDetail(error)
      });
    }
  }
  getOrCreateMipJob(request) {
    const dspSessionId = Math.trunc(Number(request?.dspSessionId));
    const generation = Math.trunc(Number(request?.generation));
    const tableIndex = Math.trunc(Number(request?.tableIndex));
    const mipIndex = Math.trunc(Number(request?.mipIndex));
    const urgencyLevel = Math.trunc(Number(request?.urgencyLevel) || 0);
    if (!this.serviceTable) {
      return null;
    }
    if (dspSessionId !== this.serviceTable.dspSessionId || generation !== this.serviceTable.generation || tableIndex !== this.serviceTable.tableIndex) {
      return null;
    }
    if (mipIndex < 0 || mipIndex >= this.mipLevelCount) {
      return null;
    }
    const key = createMipJobKey(dspSessionId, generation, mipIndex);
    let job = this.mipJobs.get(key);
    if (!job) {
      job = {
        key,
        dspSessionId,
        generation,
        tableIndex,
        mipIndex,
        urgencyLevel,
        ...createEmptyMipJobFrameState(this.serviceTable.frameCount),
        completed: false
      };
      this.mipJobs.set(key, job);
      return job;
    }
    if (!job.completed && urgencyLevel > job.urgencyLevel) {
      job.urgencyLevel = urgencyLevel;
    }
    return job;
  }
  handleMipRequest(request) {
    const job = this.getOrCreateMipJob(request ?? {});
    if (!job || job.completed) {
      return;
    }
    emitWorkerLog("info", "Received wavetable mip request", {
      dspSessionId: job.dspSessionId,
      generation: job.generation,
      tableIndex: job.tableIndex,
      mipIndex: job.mipIndex,
      urgencyLevel: job.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    });
    this.pumpUploads();
  }
  handleUploadAck(ack) {
    const uploadAck = ack ?? {};
    const dspSessionId = Math.trunc(Number(uploadAck.dspSessionId));
    const generation = Math.trunc(Number(uploadAck.generation));
    const mipIndex = Math.trunc(Number(uploadAck.mipIndex));
    const frameIndex = Math.trunc(Number(uploadAck.frameIndex));
    const key = createMipJobKey(dspSessionId, generation, mipIndex);
    const job = this.mipJobs.get(key);
    if (!job || job.completed || !job.inFlightFrames.has(frameIndex)) {
      return;
    }
    job.inFlightFrames.delete(frameIndex);
    if (!job.ackedFrames[frameIndex]) {
      job.ackedFrames[frameIndex] = 1;
      job.ackedFrameCount += 1;
    }
    if (job.ackedFrameCount === this.serviceTable?.frameCount && job.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) && job.inFlightFrames.size === 0) {
      job.completed = true;
      if (this.activeUploadKey === job.key) {
        this.activeUploadKey = null;
      }
    }
    if (shouldLogFrameProgress(frameIndex, this.serviceTable?.frameCount ?? 0)) {
      emitWorkerLog("info", "Acknowledged wavetable mip frame", {
        dspSessionId,
        generation,
        tableIndex: job.tableIndex,
        mipIndex,
        frameIndex,
        ackedFrameCount: job.ackedFrameCount,
        frameCount: this.serviceTable?.frameCount ?? 0
      });
    }
    this.armServiceLoadWatchdog();
    this.pumpUploads();
  }
  getSpectrumForFrame(frameIndex) {
    assert(this.serviceTable, "Current table must exist before building a spectrum");
    if (!this.serviceTable.spectra[frameIndex]) {
      this.serviceTable.spectra[frameIndex] = buildFrameSpectrum(this.serviceTable.frames[frameIndex]);
      const cacheEntry = this.tableCache.get(this.serviceTable.cacheKey);
      if (cacheEntry) {
        this.refreshCacheEntryByteCount(cacheEntry);
      }
    }
    return this.serviceTable.spectra[frameIndex];
  }
  selectNextMipJob() {
    let selectedJob = null;
    for (const job of this.mipJobs.values()) {
      if (job.completed) {
        continue;
      }
      if (selectedJob === null || job.urgencyLevel > selectedJob.urgencyLevel) {
        selectedJob = job;
      }
    }
    return selectedJob;
  }
  pumpUploads() {
    if (!this.serviceTable) {
      return;
    }
    let activeJob = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if (!activeJob || activeJob.completed) {
      activeJob = this.selectNextMipJob();
      this.activeUploadKey = activeJob?.key ?? null;
    }
    if (!activeJob) {
      return;
    }
    while (activeJob.inFlightFrames.size < this.maxFramesInFlight && activeJob.nextFrameIndex < this.serviceTable.frameCount) {
      const frameIndex = activeJob.nextFrameIndex;
      let mipSamples;
      try {
        const spectrum = this.getSpectrumForFrame(frameIndex);
        mipSamples = buildMipFrameFromSpectrum(spectrum, activeJob.mipIndex);
      } catch (error) {
        this.handleServiceTargetFailure(
          {
            kind: this.serviceTable.mode ?? "loading",
            dspSessionId: activeJob.dspSessionId,
            generation: activeJob.generation,
            tableIndex: activeJob.tableIndex
          },
          {
            failurePhase: failurePhaseBuildMip,
            failureReasonCode: failureReasonGeneric
          }
        );
        this.serviceTable = null;
        this.clearMipTransferState();
        return;
      }
      this.connection.sendEventOrValue?.(mipFrameEndpointID, {
        dspSessionId: activeJob.dspSessionId,
        generation: activeJob.generation,
        tableIndex: activeJob.tableIndex,
        mipIndex: activeJob.mipIndex,
        frameIndex,
        samples: Array.from(mipSamples)
      });
      if (shouldLogFrameProgress(frameIndex, this.serviceTable.frameCount)) {
        emitWorkerLog("info", "Sent wavetable mip frame", {
          dspSessionId: activeJob.dspSessionId,
          generation: activeJob.generation,
          tableIndex: activeJob.tableIndex,
          mipIndex: activeJob.mipIndex,
          frameIndex,
          frameCount: this.serviceTable.frameCount,
          inFlightFrames: activeJob.inFlightFrames.size + 1
        });
      }
      activeJob.inFlightFrames.add(frameIndex);
      activeJob.nextFrameIndex += 1;
      this.armServiceLoadWatchdog();
    }
    if (activeJob.ackedFrameCount === this.serviceTable.frameCount && activeJob.nextFrameIndex >= this.serviceTable.frameCount && activeJob.inFlightFrames.size === 0) {
      activeJob.completed = true;
      this.activeUploadKey = null;
      this.pumpUploads();
    }
  }
}
function describeErrorDetail(error) {
  if (error && typeof error === "object") {
    const maybeError = error;
    return maybeError.message || maybeError.stack || String(error);
  }
  return String(error);
}
function createWavetableWorkerController(connection, options = {}) {
  return new WavetableWorkerController(connection, options);
}
async function runWavetableWorker(connection, options = {}) {
  return startPatchWorkerServices(connection, [
    createModulationWorkerService,
    createArticulationWorkerService,
    () => createWavetableWorkerController(connection, options)
  ]);
}
export {
  FAILURE_PHASE_BUILD_MIP,
  FAILURE_PHASE_LOAD_SOURCE,
  FAILURE_PHASE_TRANSFER_MIP,
  FAILURE_REASON_GENERIC,
  FAILURE_REASON_TIMEOUT,
  WavetableWorkerController,
  createWavetableWorkerController,
  runWavetableWorker as default
};
