import {
    asResourceClient,
    parseWaveFile,
} from "./resource-client.js";

export { parseWaveFile } from "./resource-client.js";

export const DEFAULT_SAMPLES_PER_FRAME = 2048;
export const DEFAULT_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank-catalog.json";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function clampToRange(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function canonicalizeFrame(frame) {
    let sum = 0;

    for (let index = 0; index < frame.length; index += 1) {
        sum += Number(frame[index]) || 0;
    }

    const mean = sum / Math.max(1, frame.length);
    const canonical = new Float32Array(frame.length);

    for (let index = 0; index < frame.length; index += 1) {
        canonical[index] = (Number(frame[index]) || 0) - mean;
    }

    return canonical;
}

export function resolvePatchResourceUrl(path, patchConnection) {
    return asResourceClient(patchConnection).getURL(path);
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

export async function loadFactoryBankCatalog(
    resourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
    } = {}
) {
    const resourceClient = asResourceClient(resourceClientInput);
    return getFactoryBankCatalogValue(await resourceClient.readJSON(catalogPath));
}

export async function loadFactoryBankCatalogFromPatch(
    patchConnection,
    options = {},
) {
    return loadFactoryBankCatalog(patchConnection, options);
}

export async function loadFactoryBankFrames(
    resourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
        tableIndex = 0,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    } = {}
) {
    const resourceClient = asResourceClient(resourceClientInput);
    const catalogValue = await loadFactoryBankCatalog(resourceClient, { catalogPath });
    const clampedTableIndex = clampToRange(tableIndex, 0, catalogValue.tables.length - 1);
    const sourceTableMeta = catalogValue.tables[clampedTableIndex];
    const sourceAudio = await resourceClient.readAudio(sourceTableMeta.sourceWav);
    const sourceFrames = extractSourceFrames(sourceAudio.samples, {
        expectedFrameCount: Number(sourceTableMeta.frameCount),
        samplesPerFrame,
    });

    return {
        sampleRate: sourceAudio.sampleRate,
        sampleBlobPath: sourceTableMeta.sourceWav,
        tableIndex: clampedTableIndex,
        frameCount: sourceFrames.frameCount,
        samples: sourceAudio.samples,
        frames: sourceFrames.frames,
    };
}

export async function loadFactoryBankFramesFromPatch(
    patchConnection,
    options = {},
) {
    return loadFactoryBankFrames(patchConnection, options);
}
