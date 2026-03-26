export const FACTORY_BANK_EXTERNAL_ID = "wt::factoryBank";
export const DEFAULT_SAMPLES_PER_FRAME = 2048;
export const DEFAULT_PADDED_FRAME_SIZE = DEFAULT_SAMPLES_PER_FRAME + 3;
export const DEFAULT_VISIBLE_MIP_INDEX = 10;
export const DEFAULT_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank.json";

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

function isAbsoluteURL(value) {
    return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function resolvePatchResourceUrl(path, patchConnection) {
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

function toFactoryBankManifestValue(catalogValue) {
    return {
        sampleBlob: catalogValue.sampleBlob,
        tables: catalogValue.tables.map((table) => ({
            frameCount: Number(table.frameCount),
            sampleOffset: Number(table.sampleOffset),
        })),
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

export function getFactoryBankValue(manifest, externalID = FACTORY_BANK_EXTERNAL_ID) {
    const external = manifest?.externals?.[externalID];

    assert(external, `Patch manifest is missing external ${externalID}`);
    assert(Array.isArray(external.tables), `${externalID} must provide a tables array`);
    assert(typeof external.sampleBlob === "string", `${externalID} must provide a sampleBlob path`);

    return external;
}

export function getFactoryBankCatalogValue(catalogValue) {
    assert(typeof catalogValue?.sampleBlob === "string", "Factory bank catalog must provide a sampleBlob path");
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
            Number.isInteger(Number(table?.sampleOffset)) && Number(table.sampleOffset) >= 0,
            `Factory bank catalog table ${tableIndex} must provide a non-negative sampleOffset`
        );
    });

    return catalogValue;
}

export function extractWavetableFrames(
    sampleBlob,
    tableMeta,
    {
        visibleMipIndex = DEFAULT_VISIBLE_MIP_INDEX,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
        paddedFrameSize = DEFAULT_PADDED_FRAME_SIZE,
    } = {}
) {
    const typedBlob = sampleBlob instanceof Float32Array ? sampleBlob : Float32Array.from(sampleBlob);
    const frameCount = Number(tableMeta?.frameCount);
    const sampleOffset = Number(tableMeta?.sampleOffset ?? 0);

    assert(Number.isInteger(frameCount) && frameCount > 0, "tableMeta.frameCount must be a positive integer");
    assert(Number.isInteger(sampleOffset) && sampleOffset >= 0, "tableMeta.sampleOffset must be a non-negative integer");

    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const base =
            sampleOffset + (((visibleMipIndex * frameCount) + frameIndex) * paddedFrameSize);
        const start = base + 1;
        const end = start + samplesPerFrame;

        assert(end <= typedBlob.length, "Wavetable bank does not contain the requested frame range");

        frames.push(typedBlob.slice(start, end));
    }

    return frames;
}

export async function loadWavetableFramesFromUrls(
    {
        manifestValue,
        sampleBlobUrl,
        tableIndex = 0,
        visibleMipIndex = DEFAULT_VISIBLE_MIP_INDEX,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
        paddedFrameSize = DEFAULT_PADDED_FRAME_SIZE,
    }
) {
    const response = await fetch(sampleBlobUrl.toString());
    assert(response.ok, `Failed to fetch wavetable bank from ${sampleBlobUrl}`);

    const arrayBuffer = await response.arrayBuffer();
    const parsedWave = parseWaveFile(arrayBuffer);
    const clampedTableIndex = clampToRange(tableIndex, 0, manifestValue.tables.length - 1);
    const tableMeta = manifestValue.tables[clampedTableIndex];

    return {
        sampleRate: parsedWave.sampleRate,
        sampleBlobPath: manifestValue.sampleBlob,
        tableIndex: clampedTableIndex,
        visibleMipIndex,
        frameCount: Number(tableMeta.frameCount),
        frames: extractWavetableFrames(parsedWave.samples, tableMeta, {
            visibleMipIndex,
            samplesPerFrame,
            paddedFrameSize,
        }),
    };
}

export async function loadFactoryBankCatalogFromPatch(
    patchConnection,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
    } = {}
) {
    const catalogUrl = resolvePatchResourceUrl(catalogPath, patchConnection);
    return getFactoryBankCatalogValue(await fetchJSON(catalogUrl, "factory bank catalog"));
}

export async function loadFactoryBankFramesFromPatch(
    patchConnection,
    {
        manifest = patchConnection?.manifest,
        externalID = FACTORY_BANK_EXTERNAL_ID,
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
        tableIndex = 0,
        visibleMipIndex = DEFAULT_VISIBLE_MIP_INDEX,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
        paddedFrameSize = DEFAULT_PADDED_FRAME_SIZE,
    } = {}
) {
    const manifestValue = manifest?.externals?.[externalID]
        ? getFactoryBankValue(manifest, externalID)
        : toFactoryBankManifestValue(
            await loadFactoryBankCatalogFromPatch(patchConnection, { catalogPath })
        );
    const sampleBlobUrl = resolvePatchResourceUrl(manifestValue.sampleBlob, patchConnection);

    return loadWavetableFramesFromUrls({
        manifestValue,
        sampleBlobUrl,
        tableIndex,
        visibleMipIndex,
        samplesPerFrame,
        paddedFrameSize,
    });
}
