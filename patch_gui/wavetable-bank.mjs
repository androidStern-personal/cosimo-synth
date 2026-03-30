export const DEFAULT_SAMPLES_PER_FRAME = 2048;
export const DEFAULT_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank-catalog.json";

function assert(condition, message) {
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

function clampToRange(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function canonicalizeFrame(frame) {
    let sum = 0;

    for (let index = 0; index < frame.length; index += 1) {
        sum += frame[index];
    }

    const mean = sum / Math.max(1, frame.length);
    const canonical = new Float32Array(frame.length);

    for (let index = 0; index < frame.length; index += 1) {
        canonical[index] = frame[index] - mean;
    }

    return canonical;
}

function isAbsoluteURL(value) {
    return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function describePayload(payload) {
    if (payload === null) {
        return "null";
    }

    if (payload === undefined) {
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

export function resolvePatchResourceUrl(path, patchConnection) {
    const patchRootUrl = new URL("../", import.meta.url);
    const resourceAddress = patchConnection?.getResourceAddress?.(path);

    if (resourceAddress instanceof URL) {
        return resourceAddress;
    }

    if (typeof resourceAddress === "string" && resourceAddress.length > 0) {
        if (isAbsoluteURL(resourceAddress)) {
            return new URL(resourceAddress);
        }

        const normalisedPath = resourceAddress.startsWith("/")
            ? resourceAddress.slice(1)
            : resourceAddress;

        return new URL(normalisedPath, patchRootUrl);
    }

    return new URL(path, patchRootUrl);
}

async function fetchJSON(url, label) {
    const response = await fetch(url.toString());
    assert(response.ok, `Failed to fetch ${label} from ${url}`);
    return response.json();
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
        if (typeof TextDecoder === "function") {
            return new TextDecoder().decode(payload);
        }

        return String.fromCharCode(...payload);
    }

    if (Array.isArray(payload)) {
        const byteArray = Uint8Array.from(payload);

        if (typeof TextDecoder === "function") {
            return new TextDecoder().decode(byteArray);
        }

        return String.fromCharCode(...byteArray);
    }

    throw new Error(`Unsupported text resource payload (${describePayload(payload)})`);
}

function normalizeDecodedAudioFileSamples(audioFile) {
    const frames = audioFile?.frames;

    assert(
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
            assert(frame.length === 1, "Only mono wavetable source files are supported");
            samples[index] = Number(frame[0]) || 0;
            continue;
        }

        throw new Error("Decoded audio frames must contain numeric mono samples");
    }

    return {
        sampleRate: Number(audioFile?.sampleRate) || 0,
        samples,
    };
}

export function parseWaveFile(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    assert(readAscii(view, 0, 4) === "RIFF", "Expected a RIFF wave file");
    assert(readAscii(view, 8, 4) === "WAVE", "Expected a WAVE file");

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

        cursor = chunkDataOffset + chunkSize + (chunkSize % 2);
    }

    assert(format !== null, "Wave file is missing a fmt chunk");
    assert(dataOffset !== null && dataSize !== null, "Wave file is missing a data chunk");
    assert(channelCount === 1, "Only mono wavetable bank files are supported");

    let samples;

    if (format === 3 && bitsPerSample === 32) {
        samples = new Float32Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
    } else if (format === 1 && bitsPerSample === 16) {
        const sampleCount = dataSize / 2;
        const pcm = new Int16Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
        samples = new Float32Array(sampleCount);

        for (let index = 0; index < sampleCount; index += 1) {
            samples[index] = pcm[index] / 32768.0;
        }
    } else {
        throw new Error(
            `Unsupported WAV format: format=${format}, bitsPerSample=${bitsPerSample}`
        );
    }

    return {
        format,
        channelCount,
        sampleRate,
        bitsPerSample,
        blockAlign,
        samples,
    };
}

export function getFactoryBankCatalogValue(catalogValue) {
    assert(Array.isArray(catalogValue?.tables), "Factory bank catalog must provide a tables array");

    catalogValue.tables.forEach((table, tableIndex) => {
        assert(
            typeof table?.tableId === "string" && table.tableId.length > 0,
            `Factory bank catalog table ${tableIndex} must provide tableId`
        );
        assert(
            typeof table?.name === "string" && table.name.length > 0,
            `Factory bank catalog table ${tableIndex} must provide name`
        );
        assert(
            Number.isInteger(Number(table?.frameCount)) && Number(table.frameCount) > 0,
            `Factory bank catalog table ${tableIndex} must provide a positive frameCount`
        );
        assert(
            typeof table?.sourceWav === "string" && table.sourceWav.length > 0,
            `Factory bank catalog table ${tableIndex} must provide sourceWav`
        );
    });

    return catalogValue;
}

function extractSourceFrames(
    samples,
    {
        expectedFrameCount = undefined,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    } = {}
) {
    assert(
        samples.length % samplesPerFrame === 0,
        `Source wavetable files must contain a whole number of ${samplesPerFrame}-sample frames`
    );

    const frameCount = samples.length / samplesPerFrame;
    assert(frameCount > 0, "Source wavetable files must contain at least one frame");

    if (expectedFrameCount !== undefined) {
        assert(
            frameCount === expectedFrameCount,
            `Source wavetable frame count mismatch: expected ${expectedFrameCount}, got ${frameCount}`
        );
    }

    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const start = frameIndex * samplesPerFrame;
        const end = start + samplesPerFrame;
        frames.push(canonicalizeFrame(samples.slice(start, end)));
    }

    return {
        frameCount,
        frames,
    };
}

export async function loadSourceWavetableFramesFromUrl(
    {
        sourceWavUrl,
        sourceWavPath,
        tableIndex = 0,
        expectedFrameCount = undefined,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    }
) {
    const response = await fetch(sourceWavUrl.toString());
    assert(response.ok, `Failed to fetch source wavetable from ${sourceWavUrl}`);

    const arrayBuffer = await response.arrayBuffer();
    const parsedWave = parseWaveFile(arrayBuffer);
    const sourceFrames = extractSourceFrames(parsedWave.samples, {
        expectedFrameCount,
        samplesPerFrame,
    });

    return {
        sampleRate: parsedWave.sampleRate,
        sampleBlobPath: sourceWavPath,
        tableIndex,
        frameCount: sourceFrames.frameCount,
        samples: parsedWave.samples,
        frames: sourceFrames.frames,
    };
}

async function loadSourceWavetableFramesFromPatchConnection(
    {
        patchConnection,
        sourceWavPath,
        tableIndex = 0,
        expectedFrameCount = undefined,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    }
) {
    const audioFile = await patchConnection.readResourceAsAudioData(sourceWavPath);
    const decodedAudio = normalizeDecodedAudioFileSamples(audioFile);
    const sourceFrames = extractSourceFrames(decodedAudio.samples, {
        expectedFrameCount,
        samplesPerFrame,
    });

    return {
        sampleRate: decodedAudio.sampleRate,
        sampleBlobPath: sourceWavPath,
        tableIndex,
        frameCount: sourceFrames.frameCount,
        samples: decodedAudio.samples,
        frames: sourceFrames.frames,
    };
}

export async function loadFactoryBankCatalogFromPatch(
    patchConnection,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
    } = {}
) {
    if (typeof patchConnection?.readResource === "function") {
        const payload = await patchConnection.readResource(catalogPath);
        return getFactoryBankCatalogValue(JSON.parse(await decodeTextPayload(payload)));
    }

    const catalogUrl = resolvePatchResourceUrl(catalogPath, patchConnection);
    return getFactoryBankCatalogValue(await fetchJSON(catalogUrl, "factory bank catalog"));
}

export async function loadFactoryBankFramesFromPatch(
    patchConnection,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
        tableIndex = 0,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    } = {}
) {
    const catalogValue = await loadFactoryBankCatalogFromPatch(patchConnection, { catalogPath });
    const clampedTableIndex = clampToRange(tableIndex, 0, catalogValue.tables.length - 1);
    const sourceTableMeta = catalogValue.tables[clampedTableIndex];

    if (typeof patchConnection?.readResourceAsAudioData === "function") {
        return loadSourceWavetableFramesFromPatchConnection({
            patchConnection,
            sourceWavPath: sourceTableMeta.sourceWav,
            tableIndex: clampedTableIndex,
            expectedFrameCount: Number(sourceTableMeta.frameCount),
            samplesPerFrame,
        });
    }

    const sourceWavUrl = resolvePatchResourceUrl(sourceTableMeta.sourceWav, patchConnection);

    return loadSourceWavetableFramesFromUrl({
        sourceWavUrl,
        sourceWavPath: sourceTableMeta.sourceWav,
        tableIndex: clampedTableIndex,
        expectedFrameCount: Number(sourceTableMeta.frameCount),
        samplesPerFrame,
    });
}
