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
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const workerLoadFailureEndpointID = "workerLoadFailure";
const serviceLoadAbortEndpointID = "serviceLoadAbort";
const loadBeginEndpointID = "wavetableLoadBegin";
const mipFrameEndpointID = "wavetableMipFrame";
const uploadAckEndpointID = "wavetableUploadAck";
const mipRequestEndpointID = "wavetableMipRequest";
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
  constructor(connection, options = {}) {
    this.connection = connection;
    this.resourceClient = asResourceClient(options.resourceClient ?? connection);
    this.catalogPath = options.catalogPath ?? defaultCatalogPath;
    this.maxFramesInFlight = resolvePositiveIntegerOption(options.maxFramesInFlight, 1);
    this.mipLevelCount = options.mipLevelCount ?? DEFAULT_MIP_LEVEL_COUNT;
    this.serviceLoadTimeoutMs = resolvePositiveIntegerOption(options.serviceLoadTimeoutMs, defaultServiceLoadTimeoutMs);
    this.setTimeoutFn = typeof options.setTimeoutFn === "function" ? options.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null;
    this.clearTimeoutFn = typeof options.clearTimeoutFn === "function" ? options.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null;
    this.handleRuntimeState = this.handleRuntimeState.bind(this);
    this.handleUploadAck = this.handleUploadAck.bind(this);
    this.handleMipRequest = this.handleMipRequest.bind(this);
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
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    });
    this.connection.addEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeState);
    this.connection.addEndpointListener?.(uploadAckEndpointID, this.handleUploadAck);
    this.connection.addEndpointListener?.(mipRequestEndpointID, this.handleMipRequest);
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
    return {
      tableIndex: normalizedIndex,
      tableMeta,
      frameCount: sourceTable.frameCount,
      frames: sourceTable.frames,
      spectra: new Array(sourceTable.frameCount)
    };
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
  const controller = createWavetableWorkerController(connection, options);
  await controller.start();
  return controller;
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
