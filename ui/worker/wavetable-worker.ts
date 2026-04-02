import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    DEFAULT_SAMPLES_PER_FRAME,
    getFactoryBankCatalogValue,
    type FactoryBankCatalog,
    type FactoryTableMeta,
} from "../shared/wavetable-bank";
import {
    DEFAULT_MIP_LEVEL_COUNT,
    buildFrameSpectrum,
    buildMipFrameFromSpectrum,
    extractSourceFramesFromSamples,
} from "../shared/wavetable-mip";
import {
    asResourceClient,
    type ResourceClient,
    type ResourceClientInput,
} from "../shared/resource-client";

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
export const FAILURE_PHASE_LOAD_SOURCE = 1;
export const FAILURE_PHASE_BUILD_MIP = 2;
export const FAILURE_PHASE_TRANSFER_MIP = 3;
export const FAILURE_REASON_GENERIC = 1;
export const FAILURE_REASON_TIMEOUT = 2;
const defaultServiceLoadTimeoutMs = 20000;

const failurePhaseLoadSource = FAILURE_PHASE_LOAD_SOURCE;
const failurePhaseBuildMip = FAILURE_PHASE_BUILD_MIP;
const failurePhaseTransferMip = FAILURE_PHASE_TRANSFER_MIP;
const failureReasonGeneric = FAILURE_REASON_GENERIC;
const failureReasonTimeout = FAILURE_REASON_TIMEOUT;

type NormalizedRuntimeState = ReturnType<typeof normalizeRuntimeState>;
type Spectrum = ReturnType<typeof buildFrameSpectrum>;
type ServiceTargetKind = "loading" | "active";
type TimerHandle = ReturnType<NonNullable<typeof globalThis.setTimeout>> | number;

type WorkerOptions = {
    catalogPath?: string;
    maxFramesInFlight?: number;
    mipLevelCount?: number;
    serviceLoadTimeoutMs?: number;
    resourceClient?: ResourceClientInput;
    setTimeoutFn?: ((callback: () => void, delay: number) => TimerHandle) | null;
    clearTimeoutFn?: ((handle: TimerHandle) => void) | null;
};

type ServiceTarget = {
    kind: ServiceTargetKind;
    dspSessionId: number;
    generation: number;
    tableIndex: number;
};

type CandidateValidation = {
    dspSessionId: number;
    tableIndex: number;
    desiredIntentSerial: number;
    generation: number;
};

type LoadedTable = {
    tableIndex: number;
    tableMeta: FactoryTableMeta;
    frameCount: number;
    frames: Float32Array[];
    spectra: Array<Spectrum | undefined>;
};

type ServiceTable = LoadedTable & {
    mode: ServiceTargetKind;
    dspSessionId: number;
    generation: number;
    desiredIntentSerial: number;
};

type MipJob = {
    key: string;
    dspSessionId: number;
    generation: number;
    tableIndex: number;
    mipIndex: number;
    urgencyLevel: number;
    nextFrameIndex: number;
    ackedFrames: Uint8Array;
    ackedFrameCount: number;
    inFlightFrames: Set<number>;
    completed: boolean;
};

type WorkerFailureDetail = {
    failurePhase?: number;
    failureReasonCode?: number;
};

type WorkerLoadFailurePayload = {
    dspSessionId: number;
    tableIndex: number;
    generation?: number;
    candidateAttemptSerial?: number;
    failurePhase?: number;
    failureReasonCode?: number;
};

type ServiceLoadAbortPayload = {
    dspSessionId: number;
    generation: number;
    tableIndex: number;
    failureReasonCode?: number;
};

type RuntimeStateLike = {
    dspSessionId?: unknown;
    desiredIntentSerial?: unknown;
    desiredTableIndex?: unknown;
    generationFrontier?: unknown;
    serviceState?: unknown;
    hasActive?: unknown;
    activeTableIndex?: unknown;
    activeGeneration?: unknown;
    hasLoading?: unknown;
    loadingTableIndex?: unknown;
    loadingGeneration?: unknown;
    hasFailure?: unknown;
    failedTableIndex?: unknown;
    failedGeneration?: unknown;
    failureScope?: unknown;
    failurePhase?: unknown;
    failureReasonCode?: unknown;
};

type MipRequestLike = {
    dspSessionId?: unknown;
    generation?: unknown;
    tableIndex?: unknown;
    mipIndex?: unknown;
    urgencyLevel?: unknown;
};

type UploadAckLike = {
    dspSessionId?: unknown;
    generation?: unknown;
    mipIndex?: unknown;
    frameIndex?: unknown;
};

function resolvePositiveIntegerOption(value: unknown, fallback: number) {
    const normalized = Math.round(Number(value));
    return Number.isFinite(normalized) && normalized > 0
        ? normalized
        : fallback;
}

function emitWorkerLog(level: "info" | "warn" | "error", message: string, fields: Record<string, unknown> | null = null) {
    const logger = typeof console?.[level] === "function"
        ? console[level].bind(console)
        : console.log?.bind(console);

    if (!logger) {
        return;
    }

    if (fields && Object.keys(fields).length > 0) {
        logger(`[wavetable-worker] ${message}`, fields);
        return;
    }

    logger(`[wavetable-worker] ${message}`);
}

function summarizeRuntimeStateForLog(runtimeState: NormalizedRuntimeState) {
    return {
        dspSessionId: runtimeState.dspSessionId,
        desiredIntentSerial: runtimeState.desiredIntentSerial,
        desiredTableIndex: runtimeState.desiredTableIndex,
        generationFrontier: runtimeState.generationFrontier,
        serviceState: runtimeState.serviceState,
        active: runtimeState.hasActive
            ? {
                tableIndex: runtimeState.activeTableIndex,
                generation: runtimeState.activeGeneration,
            }
            : null,
        loading: runtimeState.hasLoading
            ? {
                tableIndex: runtimeState.loadingTableIndex,
                generation: runtimeState.loadingGeneration,
            }
            : null,
        failure: runtimeState.hasFailure
            ? {
                tableIndex: runtimeState.failedTableIndex,
                generation: runtimeState.failedGeneration,
                scope: runtimeState.failureScope,
                phase: runtimeState.failurePhase,
                reason: runtimeState.failureReasonCode,
            }
            : null,
    };
}

function shouldLogFrameProgress(frameIndex: number, frameCount: number) {
    const nextFrame = frameIndex + 1;
    return nextFrame === 1 || nextFrame === frameCount || (nextFrame % 16) === 0;
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function decodeTextPayload(payload: unknown) {
    if (typeof payload === "string") {
        return Promise.resolve(payload);
    }

    if (payload && typeof (payload as { text?: () => Promise<string> }).text === "function") {
        return (payload as { text: () => Promise<string> }).text();
    }

    if (payload instanceof ArrayBuffer) {
        if (typeof TextDecoder === "function") {
            return Promise.resolve(new TextDecoder().decode(new Uint8Array(payload)));
        }

        return Promise.resolve(String.fromCharCode(...new Uint8Array(payload)));
    }

    if (ArrayBuffer.isView(payload)) {
        const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);

        if (typeof TextDecoder === "function") {
            return Promise.resolve(new TextDecoder().decode(bytes));
        }

        return Promise.resolve(String.fromCharCode(...bytes));
    }

    if (Array.isArray(payload)) {
        const bytes = Uint8Array.from(payload);
        if (typeof TextDecoder === "function") {
            return Promise.resolve(new TextDecoder().decode(bytes));
        }

        return Promise.resolve(String.fromCharCode(...bytes));
    }

    throw new Error("Unsupported text resource payload");
}

async function readCatalogFromResourceClient(resourceClient: ResourceClient, catalogPath: string) {
    return getFactoryBankCatalogValue(await resourceClient.readJSON<FactoryBankCatalog>(catalogPath));
}

function normalizeRuntimeState(state: RuntimeStateLike) {
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
        failureReasonCode: Math.trunc(Number(state?.failureReasonCode) || 0),
    };
}

function normalizeRequestedTableIndex(value: number, tableCount: number) {
    const rounded = Math.round(Number(value) || 0);
    return clamp(rounded, 0, Math.max(0, tableCount - 1));
}

function createMipJobKey(dspSessionId: number, generation: number, mipIndex: number) {
    return `${dspSessionId}:${generation}:${mipIndex}`;
}

function createEmptyMipJobFrameState(frameCount: number) {
    return {
        nextFrameIndex: 0,
        ackedFrames: new Uint8Array(frameCount),
        ackedFrameCount: 0,
        inFlightFrames: new Set<number>(),
    };
}

function getNow() {
    return typeof globalThis.performance?.now === "function"
        ? globalThis.performance.now()
        : Date.now();
}

export class WavetableWorkerController {
    private readonly connection: PatchConnectionLike;
    private readonly resourceClient: ResourceClient;
    private readonly catalogPath: string;
    private readonly maxFramesInFlight: number;
    private readonly mipLevelCount: number;
    private readonly serviceLoadTimeoutMs: number;
    private readonly setTimeoutFn: ((callback: () => void, delay: number) => TimerHandle) | null;
    private readonly clearTimeoutFn: ((handle: TimerHandle) => void) | null;
    private catalog: FactoryBankCatalog | null = null;
    private started = false;
    private knownSessionId = 0;
    private nextLoadGeneration = 1;
    private latestRuntimeState: NormalizedRuntimeState | null = null;
    private asyncStateToken = 0;
    private serviceTable: ServiceTable | null = null;
    private candidateValidation: CandidateValidation | null = null;
    private mipJobs = new Map<string, MipJob>();
    private activeUploadKey: string | null = null;
    private serviceLoadWatchdogHandle: TimerHandle | null = null;
    private autoRetryConsumedKey: string | null = null;

    constructor(connection: PatchConnectionLike, options: WorkerOptions = {}) {
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
            serviceLoadTimeoutMs: this.serviceLoadTimeoutMs,
        });
        this.connection.addEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeState);
        this.connection.addEndpointListener?.(uploadAckEndpointID, this.handleUploadAck);
        this.connection.addEndpointListener?.(mipRequestEndpointID, this.handleMipRequest);
        this.connection.sendEventOrValue?.(runtimeSyncRequestEndpointID, 1);
        return this;
    }

    private async ensureCatalogLoaded() {
        if (!this.catalog) {
            this.catalog = await readCatalogFromResourceClient(this.resourceClient, this.catalogPath);
            emitWorkerLog("info", "Loaded wavetable catalog", {
                catalogPath: this.catalogPath,
                tableCount: this.catalog.tables.length,
            });
        }

        return this.catalog;
    }

    private resetSessionState(runtimeState: NormalizedRuntimeState) {
        this.knownSessionId = runtimeState.dspSessionId;
        this.nextLoadGeneration = Math.max(1, runtimeState.generationFrontier + 1);
        this.serviceTable = null;
        this.candidateValidation = null;
        this.mipJobs.clear();
        this.activeUploadKey = null;
        this.autoRetryConsumedKey = null;
    }

    private clearMipTransferState() {
        this.cancelServiceLoadWatchdog();
        this.mipJobs.clear();
        this.activeUploadKey = null;
    }

    private cancelServiceLoadWatchdog() {
        if (this.serviceLoadWatchdogHandle === null) {
            return;
        }

        this.clearTimeoutFn?.(this.serviceLoadWatchdogHandle);
        this.serviceLoadWatchdogHandle = null;
    }

    private serviceLoadHasPendingTransfers() {
        if (!this.serviceTable || this.serviceTable.mode !== "loading") {
            return false;
        }

        for (const job of this.mipJobs.values()) {
            if (
                job.dspSessionId === this.serviceTable.dspSessionId &&
                job.generation === this.serviceTable.generation &&
                job.tableIndex === this.serviceTable.tableIndex &&
                !job.completed &&
                (job.inFlightFrames.size > 0 || job.nextFrameIndex > 0)
            ) {
                return true;
            }
        }

        return false;
    }

    private armServiceLoadWatchdog() {
        if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
            this.cancelServiceLoadWatchdog();
            return;
        }

        const { dspSessionId, generation, tableIndex } = this.serviceTable;

        this.cancelServiceLoadWatchdog();
        this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
            this.serviceLoadWatchdogHandle = null;

            if (
                !this.serviceTable ||
                this.serviceTable.mode !== "loading" ||
                this.serviceTable.dspSessionId !== dspSessionId ||
                this.serviceTable.generation !== generation ||
                this.serviceTable.tableIndex !== tableIndex ||
                !this.serviceLoadHasPendingTransfers()
            ) {
                return;
            }

            emitWorkerLog("error", "Timed out waiting for wavetable mip upload acknowledgements", {
                dspSessionId,
                generation,
                tableIndex,
                serviceLoadTimeoutMs: this.serviceLoadTimeoutMs,
            });
            this.handleServiceTargetFailure(
                {
                    kind: "loading",
                    dspSessionId,
                    generation,
                    tableIndex,
                },
                {
                    failurePhase: failurePhaseTransferMip,
                    failureReasonCode: failureReasonTimeout,
                },
            );
            this.serviceTable = null;
            this.clearMipTransferState();
        }, this.serviceLoadTimeoutMs);
    }

    private resolveServiceTarget(runtimeState: NormalizedRuntimeState): ServiceTarget | null {
        if (runtimeState.hasLoading) {
            return {
                kind: "loading",
                dspSessionId: runtimeState.dspSessionId,
                generation: runtimeState.loadingGeneration,
                tableIndex: runtimeState.loadingTableIndex,
            };
        }

        if (runtimeState.hasActive) {
            return {
                kind: "active",
                dspSessionId: runtimeState.dspSessionId,
                generation: runtimeState.activeGeneration,
                tableIndex: runtimeState.activeTableIndex,
            };
        }

        return null;
    }

    private shouldStayIdleOnFailure(runtimeState: NormalizedRuntimeState) {
        return runtimeState.hasFailure
            && runtimeState.failedTableIndex === runtimeState.desiredTableIndex
            && runtimeState.desiredIntentSerial > 0;
    }

    private getDesiredRetryKey(runtimeState: NormalizedRuntimeState) {
        return `${runtimeState.dspSessionId}:${runtimeState.desiredTableIndex}`;
    }

    private shouldAutomaticallyRetryTimeoutFailure(runtimeState: NormalizedRuntimeState) {
        if (
            !runtimeState.hasFailure ||
            runtimeState.failedTableIndex !== runtimeState.desiredTableIndex ||
            runtimeState.failurePhase !== failurePhaseTransferMip ||
            runtimeState.failureReasonCode !== failureReasonTimeout
        ) {
            return false;
        }

        return this.autoRetryConsumedKey !== this.getDesiredRetryKey(runtimeState);
    }

    private emitWorkerLoadFailure({
        dspSessionId,
        tableIndex,
        generation = 0,
        candidateAttemptSerial = 0,
        failurePhase = failurePhaseLoadSource,
        failureReasonCode = failureReasonGeneric,
    }: WorkerLoadFailurePayload) {
        this.connection.sendEventOrValue?.(workerLoadFailureEndpointID, {
            dspSessionId,
            tableIndex,
            generation,
            candidateAttemptSerial,
            failurePhase,
            failureReasonCode,
        });
    }

    private emitServiceLoadAbort({
        dspSessionId,
        generation,
        tableIndex,
        failureReasonCode = failureReasonGeneric,
    }: ServiceLoadAbortPayload) {
        this.connection.sendEventOrValue?.(serviceLoadAbortEndpointID, {
            dspSessionId,
            generation,
            tableIndex,
            failureReasonCode,
        });
    }

    private emitRetryDesiredTableRequest() {
        emitWorkerLog("warn", "Requesting retry for failed desired wavetable load", {
            latestRuntimeState: this.latestRuntimeState
                ? summarizeRuntimeStateForLog(this.latestRuntimeState)
                : null,
        });
        this.connection.sendEventOrValue?.(retryDesiredTableRequestEndpointID, 1);
    }

    private async loadTableSource(tableIndex: number, expectedFrameCount: number | undefined, token: number): Promise<LoadedTable | null> {
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
            expectedFrameCount: expectedFrameCount === undefined ? Number(tableMeta.frameCount) : expectedFrameCount,
        });

        const sourceAudio = await this.resourceClient.readAudio(tableMeta.sourceWav);
        const sourceTable = extractSourceFramesFromSamples(sourceAudio.samples, {
            expectedFrameCount: expectedFrameCount === undefined ? Number(tableMeta.frameCount) : expectedFrameCount,
            samplesPerFrame: DEFAULT_SAMPLES_PER_FRAME,
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
            loadDurationMs: Math.round(getNow() - startTime),
        });

        return {
            tableIndex: normalizedIndex,
            tableMeta,
            frameCount: sourceTable.frameCount,
            frames: sourceTable.frames,
            spectra: new Array(sourceTable.frameCount),
        };
    }

    private isMatchingServiceTable(serviceTarget: ServiceTarget) {
        return Boolean(
            this.serviceTable &&
            this.serviceTable.dspSessionId === serviceTarget.dspSessionId &&
            this.serviceTable.generation === serviceTarget.generation &&
            this.serviceTable.tableIndex === serviceTarget.tableIndex,
        );
    }

    private markCommittedDesiredLoad(runtimeState: NormalizedRuntimeState, generation: number, loadedTable: LoadedTable) {
        emitWorkerLog("info", "Committing desired wavetable load", {
            dspSessionId: runtimeState.dspSessionId,
            desiredIntentSerial: runtimeState.desiredIntentSerial,
            generation,
            tableIndex: runtimeState.desiredTableIndex,
            tableName: loadedTable.tableMeta?.name ?? null,
            frameCount: loadedTable.frameCount,
        });
        this.serviceTable = {
            ...loadedTable,
            mode: "loading",
            dspSessionId: runtimeState.dspSessionId,
            generation,
            desiredIntentSerial: runtimeState.desiredIntentSerial,
        };
        this.candidateValidation = {
            dspSessionId: runtimeState.dspSessionId,
            tableIndex: runtimeState.desiredTableIndex,
            desiredIntentSerial: runtimeState.desiredIntentSerial,
            generation,
        };
        this.nextLoadGeneration = generation + 1;
        this.clearMipTransferState();
        this.connection.sendEventOrValue?.(loadBeginEndpointID, {
            dspSessionId: runtimeState.dspSessionId,
            generation,
            tableIndex: runtimeState.desiredTableIndex,
            frameCount: loadedTable.frameCount,
        });
    }

    private handleCandidateLoadFailure(runtimeState: NormalizedRuntimeState) {
        emitWorkerLog("error", "Failed to prepare desired wavetable source", {
            dspSessionId: runtimeState.dspSessionId,
            desiredIntentSerial: runtimeState.desiredIntentSerial,
            tableIndex: runtimeState.desiredTableIndex,
            failurePhase: failurePhaseLoadSource,
            failureReasonCode: failureReasonGeneric,
        });
        this.emitWorkerLoadFailure({
            dspSessionId: runtimeState.dspSessionId,
            tableIndex: runtimeState.desiredTableIndex,
            generation: 0,
            candidateAttemptSerial: runtimeState.desiredIntentSerial,
            failurePhase: failurePhaseLoadSource,
            failureReasonCode: failureReasonGeneric,
        });
    }

    private handleServiceTargetFailure(serviceTarget: ServiceTarget, {
        failurePhase = failurePhaseLoadSource,
        failureReasonCode = failureReasonGeneric,
    }: WorkerFailureDetail = {}) {
        emitWorkerLog("error", "Service wavetable load failed", {
            kind: serviceTarget.kind,
            dspSessionId: serviceTarget.dspSessionId,
            generation: serviceTarget.generation,
            tableIndex: serviceTarget.tableIndex,
            failurePhase,
            failureReasonCode,
        });
        this.emitWorkerLoadFailure({
            dspSessionId: serviceTarget.dspSessionId,
            tableIndex: serviceTarget.tableIndex,
            generation: serviceTarget.generation,
            candidateAttemptSerial: 0,
            failurePhase,
            failureReasonCode,
        });

        if (serviceTarget.kind === "loading") {
            this.emitServiceLoadAbort({
                dspSessionId: serviceTarget.dspSessionId,
                generation: serviceTarget.generation,
                tableIndex: serviceTarget.tableIndex,
                failureReasonCode,
            });
        }
    }

    private async prepareServiceTarget(serviceTarget: ServiceTarget, runtimeState: NormalizedRuntimeState, token: number) {
        if (this.isMatchingServiceTable(serviceTarget)) {
            if (this.serviceTable) {
                this.serviceTable.mode = serviceTarget.kind;
            }

            if (
                this.candidateValidation &&
                this.candidateValidation.dspSessionId === serviceTarget.dspSessionId &&
                this.candidateValidation.generation === serviceTarget.generation &&
                this.candidateValidation.tableIndex === serviceTarget.tableIndex
            ) {
                this.candidateValidation = null;
            }

            return true;
        }

        let loadedTable: LoadedTable | null = null;

        try {
            loadedTable = await this.loadTableSource(serviceTarget.tableIndex, undefined, token);
        } catch (error) {
            if (token === this.asyncStateToken) {
                emitWorkerLog("error", "Could not reload committed service wavetable source", {
                    kind: serviceTarget.kind,
                    dspSessionId: serviceTarget.dspSessionId,
                    generation: serviceTarget.generation,
                    tableIndex: serviceTarget.tableIndex,
                    detail: describeErrorDetail(error),
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
            desiredIntentSerial: runtimeState.desiredIntentSerial,
        };
        this.clearMipTransferState();
        if (
            this.candidateValidation &&
            this.candidateValidation.dspSessionId === serviceTarget.dspSessionId &&
            this.candidateValidation.generation === serviceTarget.generation &&
            this.candidateValidation.tableIndex === serviceTarget.tableIndex
        ) {
            this.candidateValidation = null;
        }

        return true;
    }

    private async prepareDesiredLoad(runtimeState: NormalizedRuntimeState, token: number) {
        const desiredTableIndex = runtimeState.desiredTableIndex;

        if (
            this.candidateValidation &&
            this.candidateValidation.dspSessionId === runtimeState.dspSessionId &&
            this.candidateValidation.tableIndex === desiredTableIndex &&
            this.candidateValidation.desiredIntentSerial === runtimeState.desiredIntentSerial
        ) {
            return;
        }

        const generation = Math.max(
            this.nextLoadGeneration,
            runtimeState.generationFrontier + 1,
        );

        let loadedTable: LoadedTable | null = null;

        try {
            loadedTable = await this.loadTableSource(desiredTableIndex, undefined, token);
        } catch (error) {
            if (token === this.asyncStateToken) {
                emitWorkerLog("error", "Could not prepare desired wavetable source", {
                    dspSessionId: runtimeState.dspSessionId,
                    desiredIntentSerial: runtimeState.desiredIntentSerial,
                    tableIndex: desiredTableIndex,
                    detail: describeErrorDetail(error),
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

    private async prepareDesiredCandidate(runtimeState: NormalizedRuntimeState, token: number) {
        await this.prepareDesiredLoad(runtimeState, token);
    }

    async handleRuntimeState(nextState: unknown) {
        try {
            const runtimeState = normalizeRuntimeState((nextState as RuntimeStateLike | null) ?? {});
            emitWorkerLog("info", "Received runtime state", summarizeRuntimeStateForLog(runtimeState));

            if (runtimeState.dspSessionId <= 0) {
                return;
            }

            const sessionChanged = runtimeState.dspSessionId !== this.knownSessionId;
            const previousDesiredRetryKey = this.latestRuntimeState
                ? this.getDesiredRetryKey(this.latestRuntimeState)
                : null;
            const currentDesiredRetryKey = this.getDesiredRetryKey(runtimeState);
            if (sessionChanged) {
                this.resetSessionState(runtimeState);
            } else {
                this.nextLoadGeneration = Math.max(
                    this.nextLoadGeneration,
                    runtimeState.generationFrontier + 1,
                );
            }

            if (sessionChanged || previousDesiredRetryKey !== currentDesiredRetryKey) {
                this.autoRetryConsumedKey = null;
            }

            this.latestRuntimeState = runtimeState;
            const token = this.asyncStateToken + 1;
            this.asyncStateToken = token;

            if (
                this.candidateValidation &&
                this.candidateValidation.dspSessionId === runtimeState.dspSessionId &&
                this.candidateValidation.generation > runtimeState.generationFrontier
            ) {
                return;
            }

            const serviceTarget = this.resolveServiceTarget(runtimeState);
            const skipDesiredCandidateForRestoredActiveService =
                sessionChanged && serviceTarget?.kind === "active";
            if (serviceTarget) {
                const prepared = await this.prepareServiceTarget(serviceTarget, runtimeState, token);

                if (!prepared) {
                    return;
                }

                if (
                    serviceTarget.kind === "loading" &&
                    runtimeState.desiredTableIndex !== serviceTarget.tableIndex &&
                    !this.shouldStayIdleOnFailure(runtimeState)
                ) {
                    emitWorkerLog("warn", "Aborting obsolete wavetable load because the desired table changed", {
                        dspSessionId: serviceTarget.dspSessionId,
                        generation: serviceTarget.generation,
                        staleTableIndex: serviceTarget.tableIndex,
                        desiredTableIndex: runtimeState.desiredTableIndex,
                        desiredIntentSerial: runtimeState.desiredIntentSerial,
                    });
                    this.emitServiceLoadAbort({
                        dspSessionId: serviceTarget.dspSessionId,
                        generation: serviceTarget.generation,
                        tableIndex: serviceTarget.tableIndex,
                        failureReasonCode: failureReasonGeneric,
                    });
                    this.serviceTable = null;
                    this.clearMipTransferState();
                    return;
                }

                if (
                    serviceTarget.kind === "active" &&
                    runtimeState.desiredTableIndex !== serviceTarget.tableIndex &&
                    !this.shouldStayIdleOnFailure(runtimeState) &&
                    !skipDesiredCandidateForRestoredActiveService
                ) {
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

            if (
                runtimeState.serviceState !== 0 ||
                this.shouldStayIdleOnFailure(runtimeState)
            ) {
                return;
            }

            await this.prepareDesiredLoad(runtimeState, token);
        } catch (error) {
            console.error(error);
        }
    }

    private getOrCreateMipJob(request: MipRequestLike) {
        const dspSessionId = Math.trunc(Number(request?.dspSessionId));
        const generation = Math.trunc(Number(request?.generation));
        const tableIndex = Math.trunc(Number(request?.tableIndex));
        const mipIndex = Math.trunc(Number(request?.mipIndex));
        const urgencyLevel = Math.trunc(Number(request?.urgencyLevel) || 0);

        if (!this.serviceTable) {
            return null;
        }

        if (
            dspSessionId !== this.serviceTable.dspSessionId ||
            generation !== this.serviceTable.generation ||
            tableIndex !== this.serviceTable.tableIndex
        ) {
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
                completed: false,
            };
            this.mipJobs.set(key, job);
            return job;
        }

        if (!job.completed && urgencyLevel > job.urgencyLevel) {
            job.urgencyLevel = urgencyLevel;
        }

        return job;
    }

    handleMipRequest(request: unknown) {
        const job = this.getOrCreateMipJob((request as MipRequestLike | null) ?? {});

        if (!job || job.completed) {
            return;
        }

        emitWorkerLog("info", "Received wavetable mip request", {
            dspSessionId: job.dspSessionId,
            generation: job.generation,
            tableIndex: job.tableIndex,
            mipIndex: job.mipIndex,
            urgencyLevel: job.urgencyLevel,
            frameCount: this.serviceTable?.frameCount ?? 0,
        });

        this.pumpUploads();
    }

    handleUploadAck(ack: unknown) {
        const uploadAck = (ack as UploadAckLike | null) ?? {};
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

        if (
            job.ackedFrameCount === this.serviceTable?.frameCount &&
            job.nextFrameIndex >= (this.serviceTable?.frameCount ?? 0) &&
            job.inFlightFrames.size === 0
        ) {
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
                frameCount: this.serviceTable?.frameCount ?? 0,
            });
        }

        this.armServiceLoadWatchdog();
        this.pumpUploads();
    }

    private getSpectrumForFrame(frameIndex: number) {
        assert(this.serviceTable, "Current table must exist before building a spectrum");

        if (!this.serviceTable.spectra[frameIndex]) {
            this.serviceTable.spectra[frameIndex] = buildFrameSpectrum(this.serviceTable.frames[frameIndex]);
        }

        return this.serviceTable.spectra[frameIndex]!;
    }

    private selectNextMipJob() {
        let selectedJob: MipJob | null = null;

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

        while (
            activeJob.inFlightFrames.size < this.maxFramesInFlight &&
            activeJob.nextFrameIndex < this.serviceTable.frameCount
        ) {
            const frameIndex = activeJob.nextFrameIndex;
            let mipSamples: Float32Array;

            try {
                const spectrum = this.getSpectrumForFrame(frameIndex);
                mipSamples = buildMipFrameFromSpectrum(spectrum, activeJob.mipIndex);
            } catch (error) {
                this.handleServiceTargetFailure(
                    {
                        kind: this.serviceTable.mode ?? "loading",
                        dspSessionId: activeJob.dspSessionId,
                        generation: activeJob.generation,
                        tableIndex: activeJob.tableIndex,
                    },
                    {
                        failurePhase: failurePhaseBuildMip,
                        failureReasonCode: failureReasonGeneric,
                    },
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
                samples: Array.from(mipSamples),
            });

            if (shouldLogFrameProgress(frameIndex, this.serviceTable.frameCount)) {
                emitWorkerLog("info", "Sent wavetable mip frame", {
                    dspSessionId: activeJob.dspSessionId,
                    generation: activeJob.generation,
                    tableIndex: activeJob.tableIndex,
                    mipIndex: activeJob.mipIndex,
                    frameIndex,
                    frameCount: this.serviceTable.frameCount,
                    inFlightFrames: activeJob.inFlightFrames.size + 1,
                });
            }

            activeJob.inFlightFrames.add(frameIndex);
            activeJob.nextFrameIndex += 1;
            this.armServiceLoadWatchdog();
        }

        if (
            activeJob.ackedFrameCount === this.serviceTable.frameCount &&
            activeJob.nextFrameIndex >= this.serviceTable.frameCount &&
            activeJob.inFlightFrames.size === 0
        ) {
            activeJob.completed = true;
            this.activeUploadKey = null;
            this.pumpUploads();
        }
    }
}

function describeErrorDetail(error: unknown) {
    if (error && typeof error === "object") {
        const maybeError = error as { message?: string; stack?: string };
        return maybeError.message || maybeError.stack || String(error);
    }

    return String(error);
}

export function createWavetableWorkerController(connection: PatchConnectionLike, options: WorkerOptions = {}) {
    return new WavetableWorkerController(connection, options);
}

export default async function runWavetableWorker(connection: PatchConnectionLike, options: WorkerOptions = {}) {
    const controller = createWavetableWorkerController(connection, options);
    await controller.start();
    return controller;
}
