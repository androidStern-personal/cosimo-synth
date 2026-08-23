import { createBounceCaptureSnapshot } from "../../bounce/capture-plan.mjs";
import type { ResourceClient } from "./resource-client";
import {
    loadFactoryBankCatalog,
} from "./wavetable-bank";
import {
    DEFAULT_MIP_LEVEL_COUNT,
    DEFAULT_SAMPLES_PER_FRAME,
    buildFrameSpectrum,
    buildMipFrameFromSpectrum,
    extractSourceFramesFromSamples,
} from "./wavetable-mip";
import {
    buildModulationRuntimeEvents,
    parseModulationState,
} from "./modulation";
import {
    buildLaneRuntimeEvents,
    parseLaneState,
} from "./lane-state";
import {
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
} from "./articulations";
import {
    buildArticulationTriggerConfigV4,
    compileArticulationOverrideImages,
    parseArticulationsV4,
} from "./articulation-image";
import { getModulationArticulationCellIndex } from "./modulation-runtime-program";

const WAVETABLE_LOAD_BEGIN_ENDPOINT_ID = "wavetableLoadBegin";
const WAVETABLE_MIP_FRAME_ENDPOINT_ID = "wavetableMipFrame";
const ARTICULATION_NOTE_META_ENDPOINT_ID = "articulationNoteMeta";
const WAVETABLE_MIP_FRAME_BATCH_SIZE = 3;
const WAVETABLE_BATCH_SAMPLE_COUNT = WAVETABLE_MIP_FRAME_BATCH_SIZE * DEFAULT_SAMPLES_PER_FRAME;
const OSCILLATOR_TABLE_ENDPOINTS = [
    "oscAWavetableSelect",
    "oscBWavetableSelect",
    "oscCWavetableSelect",
] as const;

export type BounceRecipeProgress = {
    readonly completedUnits: number;
    readonly totalUnits: number;
    readonly tableIndex: number;
};

type PatchDocumentLike = {
    readonly parameters: Readonly<Record<string, number>>;
    readonly storedState: Readonly<Record<string, unknown>>;
};

type SetupEvent = {
    readonly endpointID: string;
    readonly value: unknown;
    readonly advanceFrames?: number;
    readonly sessionScoped?: boolean;
};

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new DOMException("Bounce preparation was cancelled", "AbortError");
    }
}

function decodeJsonDocument(value: unknown, key: string) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value) as unknown;
    } catch (cause) {
        throw new Error(`${key} is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
    }
}

function objectPayload(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} runtime event is not an object`);
    }
    return value as Record<string, unknown>;
}

async function yieldPreparationTurn() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

type WavetableBatchTemplate = {
    readonly mipIndex: number;
    readonly frameIndexBase: number;
    readonly frameCount: number;
    readonly samples: Float32Array;
};

type WavetableTemplate = {
    readonly tableIndex: number;
    readonly frameCount: number;
    readonly batches: ReadonlyArray<WavetableBatchTemplate>;
};

async function buildWavetableTemplates(
    resourceClient: ResourceClient,
    tableIndices: ReadonlyArray<number>,
    {
        signal,
        onProgress,
    }: {
        signal?: AbortSignal;
        onProgress?: (progress: BounceRecipeProgress) => void;
    },
) {
    const catalog = await loadFactoryBankCatalog(resourceClient);
    const normalizedIndices = tableIndices.map((value) => Math.min(
        Math.max(Math.round(Number(value) || 0), 0),
        catalog.tables.length - 1,
    ));
    const distinctIndices = [...new Set(normalizedIndices)].sort((left, right) => left - right);
    throwIfAborted(signal);
    const loadedSources = await Promise.all(distinctIndices.map(async (tableIndex) => {
        const metadata = catalog.tables[tableIndex];
        const sourceAudio = await resourceClient.readAudio(metadata.sourceWav);
        const source = extractSourceFramesFromSamples(sourceAudio.samples, {
            expectedFrameCount: metadata.frameCount,
        });
        return {
            tableIndex,
            frameCount: source.frameCount,
            frames: source.frames,
        };
    }));
    throwIfAborted(signal);

    // Count source FFTs as well as mip synthesis so the progress bar and
    // cancellation both remain alive during the expensive first phase.
    const totalUnits = loadedSources.reduce(
        (sum, table) => sum + (table.frameCount * (DEFAULT_MIP_LEVEL_COUNT + 1)),
        0,
    );
    let completedUnits = 0;
    const templateByIndex = new Map<number, WavetableTemplate>();
    for (const table of loadedSources) {
        const spectra = [];
        for (let frameIndex = 0; frameIndex < table.frameCount; frameIndex += 1) {
            throwIfAborted(signal);
            spectra.push(buildFrameSpectrum(table.frames[frameIndex]));
            completedUnits += 1;
            onProgress?.({ completedUnits, totalUnits, tableIndex: table.tableIndex });
            if ((frameIndex + 1) % 8 === 0) await yieldPreparationTurn();
        }
        const batches: WavetableBatchTemplate[] = [];
        for (let mipIndex = 0; mipIndex < DEFAULT_MIP_LEVEL_COUNT; mipIndex += 1) {
            for (let frameIndexBase = 0;
                frameIndexBase < table.frameCount;
                frameIndexBase += WAVETABLE_MIP_FRAME_BATCH_SIZE) {
                throwIfAborted(signal);
                const frameCount = Math.min(
                    WAVETABLE_MIP_FRAME_BATCH_SIZE,
                    table.frameCount - frameIndexBase,
                );
                const samples = new Float32Array(WAVETABLE_BATCH_SAMPLE_COUNT);
                for (let batchOffset = 0; batchOffset < frameCount; batchOffset += 1) {
                    const mip = buildMipFrameFromSpectrum(
                        spectra[frameIndexBase + batchOffset],
                        mipIndex,
                    );
                    samples.set(mip, batchOffset * DEFAULT_SAMPLES_PER_FRAME);
                }
                batches.push({ mipIndex, frameIndexBase, frameCount, samples });
                completedUnits += frameCount;
                onProgress?.({ completedUnits, totalUnits, tableIndex: table.tableIndex });
                // FFT preparation is finite but substantial for large factory
                // tables. Let paint/input run between small batches.
                if (batches.length % 8 === 0) await yieldPreparationTurn();
            }
        }
        templateByIndex.set(table.tableIndex, {
            tableIndex: table.tableIndex,
            frameCount: table.frameCount,
            batches,
        });
    }
    return normalizedIndices.map((tableIndex) => {
        const template = templateByIndex.get(tableIndex);
        if (!template) throw new Error(`Factory table ${tableIndex} was not prepared`);
        return template;
    });
}

function wavetableSetupEvents(templates: ReadonlyArray<WavetableTemplate>) {
    const events: SetupEvent[] = [];
    templates.forEach((template, oscillatorIndex) => {
        events.push({
            endpointID: WAVETABLE_LOAD_BEGIN_ENDPOINT_ID,
            sessionScoped: true,
            advanceFrames: 1,
            value: {
                dspSessionId: 0,
                oscillatorIndex,
                generation: 1,
                tableIndex: template.tableIndex,
                frameCount: template.frameCount,
            },
        });
        for (const batch of template.batches) {
            events.push({
                endpointID: WAVETABLE_MIP_FRAME_ENDPOINT_ID,
                sessionScoped: true,
                advanceFrames: 1,
                value: {
                    dspSessionId: 0,
                    oscillatorIndex,
                    generation: 1,
                    tableIndex: template.tableIndex,
                    mipIndex: batch.mipIndex,
                    frameIndexBase: batch.frameIndexBase,
                    frameCount: batch.frameCount,
                    // Templates are deliberately shared across oscillators
                    // that selected the same table. capture-plan preserves
                    // this alias while cloning the immutable wire recipe.
                    samples: batch.samples,
                },
            });
        }
    });
    return events;
}

function structuredRuntimeSetupEvents(document: PatchDocumentLike) {
    const modulationResult = parseModulationState(document.storedState["modulation.v6"]);
    if (modulationResult._tag === "err") throw modulationResult.error;
    const modulation = modulationResult.value;
    const routeCells = Object.fromEntries(modulation.routes.flatMap((route) => {
        const cellIndex = getModulationArticulationCellIndex(route);
        return cellIndex === null ? [] : [[route.id, cellIndex] as const];
    }));

    const rawArticulations = decodeJsonDocument(
        document.storedState["articulations.v4"],
        "articulations.v4",
    );
    const articulationsResult = parseArticulationsV4(
        rawArticulations,
        new Set(Object.keys(routeCells)),
    );
    if (articulationsResult._tag === "err") throw articulationsResult.error;
    const articulations = articulationsResult.value;

    const laneResult = parseLaneState(document.storedState["lane.v1"]);
    if (laneResult._tag === "err") throw new Error(laneResult.message);

    let modulationSerial = 0;
    const modulationEvents: SetupEvent[] = buildModulationRuntimeEvents(modulation, null).map((event) => ({
        endpointID: event.endpointID,
        sessionScoped: true,
        advanceFrames: 1,
        value: {
            ...objectPayload(event.value, event.endpointID),
            dspSessionId: 0,
            deliverySerial: modulationSerial += 1,
        },
    }));
    let articulationSerial = 0;
    const articulationEvents: SetupEvent[] = compileArticulationOverrideImages(
        articulations,
        routeCells,
    ).map((upload) => ({
        endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        sessionScoped: true,
        advanceFrames: 1,
        value: {
            ...upload,
            dspSessionId: 0,
            deliverySerial: articulationSerial -= 1,
        },
    }));
    const laneEvents: SetupEvent[] = buildLaneRuntimeEvents(laneResult.value).map((event) => ({
        endpointID: event.endpointID,
        value: event.value,
        // Let the topology commit and its resident devices settle before the
        // audition note. Positional parameter records themselves need 1 frame.
        advanceFrames: event.endpointID === "laneTopology" ? 1_024 : 1,
    }));

    return {
        events: [...modulationEvents, ...articulationEvents, ...laneEvents],
        articulationTriggerConfig: buildArticulationTriggerConfigV4(articulations),
    };
}

function articulationRootSetupEvents(
    config: ReturnType<typeof buildArticulationTriggerConfigV4>,
) {
    const selectorA = config.activeMode === "vel" ? config.velocity[100] : -1;
    if (!Number.isInteger(selectorA) || selectorA < 0 || selectorA > 127) return [];
    return [{
        endpointID: ARTICULATION_NOTE_META_ENDPOINT_ID,
        rootNoteField: "noteNumber",
        advanceFrames: 0,
        value: {
            channel: 0,
            noteNumber: 0,
            selectorA,
            selectorB: 0,
            durationSamples: 0,
            ageSamples: 0,
        },
    }];
}

/** Build the exact, structured-clone capture recipe from the press snapshot. */
export async function createProductBounceCaptureSnapshot({
    patchDocument,
    resourceClient,
    sampleRate,
    tempoBpm = 120,
    signal,
    onProgress,
}: {
    patchDocument: PatchDocumentLike;
    resourceClient: ResourceClient;
    sampleRate: number;
    tempoBpm?: number;
    signal?: AbortSignal;
    onProgress?: (progress: BounceRecipeProgress) => void;
}) {
    if (Math.round(Number(patchDocument.parameters.sourceMode) || 0) !== 0) {
        throw new Error("Recursive Bounce is enabled in milestone M7.");
    }
    const tableIndices = OSCILLATOR_TABLE_ENDPOINTS.map((endpointID) => {
        const value = patchDocument.parameters[endpointID];
        if (!Number.isFinite(value)) throw new Error(`Bounce snapshot is missing ${endpointID}`);
        return value;
    });
    const templates = await buildWavetableTemplates(resourceClient, tableIndices, {
        signal,
        onProgress,
    });
    throwIfAborted(signal);
    const structured = structuredRuntimeSetupEvents(patchDocument);
    return {
        snapshot: createBounceCaptureSnapshot({
            sampleRate: Math.round(sampleRate),
            tempoBpm,
            parameters: patchDocument.parameters,
            setupEvents: [
                ...wavetableSetupEvents(templates),
                ...structured.events,
            ],
            rootSetupEvents: articulationRootSetupEvents(structured.articulationTriggerConfig),
        }),
        articulationTriggerConfig: structured.articulationTriggerConfig,
    };
}

export const bounceCaptureRecipeInternals = Object.freeze({
    OSCILLATOR_TABLE_ENDPOINTS,
    WAVETABLE_BATCH_SAMPLE_COUNT,
    articulationRootSetupEvents,
    structuredRuntimeSetupEvents,
});
