import {
    asResourceClient,
    type ResourceClientInput,
} from "./resource-client";

export const DEFAULT_SAMPLES_PER_FRAME = 2048;
export const DEFAULT_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank-catalog.json";

export type FactoryTableMeta = {
    tableId: string;
    name: string;
    frameCount: number;
    sourceWav: string;
};

export type FactoryBankCatalog = {
    tables: FactoryTableMeta[];
};

export type SourceWavetableFrames = {
    sampleRate: number;
    sampleBlobPath: string;
    tableIndex: number;
    frameCount: number;
    samples: Float32Array;
    frames: Float32Array[];
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function clampToRange(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function canonicalizeFrame(frame: ArrayLike<number>) {
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

export function getFactoryBankCatalogValue(catalogValue: unknown): FactoryBankCatalog {
    assert(
        Array.isArray((catalogValue as FactoryBankCatalog | null)?.tables),
        "Factory bank catalog must provide a tables array",
    );

    const catalog = catalogValue as FactoryBankCatalog;
    catalog.tables.forEach((table, tableIndex) => {
        assert(
            typeof table?.tableId === "string" && table.tableId.length > 0,
            `Factory bank catalog table ${tableIndex} must provide tableId`,
        );
        assert(
            typeof table?.name === "string" && table.name.length > 0,
            `Factory bank catalog table ${tableIndex} must provide name`,
        );
        assert(
            Number.isInteger(Number(table?.frameCount)) && Number(table.frameCount) > 0,
            `Factory bank catalog table ${tableIndex} must provide a positive frameCount`,
        );
        assert(
            typeof table?.sourceWav === "string" && table.sourceWav.length > 0,
            `Factory bank catalog table ${tableIndex} must provide sourceWav`,
        );
    });

    return catalog;
}

function extractSourceFrames(
    samples: Float32Array,
    {
        expectedFrameCount,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    }: {
        expectedFrameCount?: number;
        samplesPerFrame?: number;
    } = {},
) {
    assert(
        samples.length % samplesPerFrame === 0,
        `Source wavetable files must contain a whole number of ${samplesPerFrame}-sample frames`,
    );

    const frameCount = samples.length / samplesPerFrame;
    assert(frameCount > 0, "Source wavetable files must contain at least one frame");

    if (expectedFrameCount !== undefined) {
        assert(
            frameCount === expectedFrameCount,
            `Source wavetable frame count mismatch: expected ${expectedFrameCount}, got ${frameCount}`,
        );
    }

    const frames: Float32Array[] = [];

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

export async function loadFactoryBankCatalogFromPatch(
    patchConnection: ResourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
    }: {
        catalogPath?: string;
    } = {},
): Promise<FactoryBankCatalog> {
    return loadFactoryBankCatalog(patchConnection, { catalogPath });
}

export async function loadFactoryBankCatalog(
    resourceClientInput: ResourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
    }: {
        catalogPath?: string;
    } = {},
): Promise<FactoryBankCatalog> {
    const resourceClient = asResourceClient(resourceClientInput);
    return getFactoryBankCatalogValue(await resourceClient.readJSON<FactoryBankCatalog>(catalogPath));
}

export async function loadFactoryBankFramesFromPatch(
    patchConnection: ResourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
        tableIndex = 0,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    }: {
        catalogPath?: string;
        tableIndex?: number;
        samplesPerFrame?: number;
    } = {},
): Promise<SourceWavetableFrames> {
    return loadFactoryBankFrames(patchConnection, { catalogPath, tableIndex, samplesPerFrame });
}

export async function loadFactoryBankFrames(
    resourceClientInput: ResourceClientInput,
    {
        catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
        tableIndex = 0,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
    }: {
        catalogPath?: string;
        tableIndex?: number;
        samplesPerFrame?: number;
    } = {},
): Promise<SourceWavetableFrames> {
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
