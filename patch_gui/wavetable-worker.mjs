import {
    DEFAULT_MIP_LEVEL_COUNT,
    DEFAULT_SAMPLES_PER_FRAME,
    buildFrameSpectrum,
    buildMipFrameFromSpectrum,
    extractSourceFramesFromSamples,
    normalizeDecodedAudioFileSamples,
} from "./wavetable-mip.mjs";
import { getFactoryBankCatalogValue } from "./wavetable-bank.mjs";

const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
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

const failurePhaseLoadSource = FAILURE_PHASE_LOAD_SOURCE;
const failurePhaseBuildMip = FAILURE_PHASE_BUILD_MIP;
const failurePhaseTransferMip = FAILURE_PHASE_TRANSFER_MIP;
const failureReasonGeneric = FAILURE_REASON_GENERIC;
const failureReasonTimeout = FAILURE_REASON_TIMEOUT;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function decodeTextPayload(payload) {
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

    throw new Error("Unsupported text resource payload");
}

async function readCatalogFromConnection(connection, catalogPath) {
    const payload = await connection.readResource(catalogPath);
    return getFactoryBankCatalogValue(JSON.parse(await decodeTextPayload(payload)));
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
        failureReasonCode: Math.trunc(Number(state?.failureReasonCode) || 0),
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
        inFlightFrames: new Set(),
    };
}

export class WavetableWorkerController {
    constructor(
        connection,
        {
            catalogPath = defaultCatalogPath,
            maxFramesInFlight = 4,
            mipLevelCount = DEFAULT_MIP_LEVEL_COUNT,
            serviceLoadTimeoutMs = 1500,
            setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
            clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
        } = {}
    ) {
        this.connection = connection;
        this.catalogPath = catalogPath;
        this.maxFramesInFlight = Math.max(1, Math.round(Number(maxFramesInFlight) || 1));
        this.mipLevelCount = mipLevelCount;
        this.serviceLoadTimeoutMs = Math.max(1, Math.round(Number(serviceLoadTimeoutMs) || 1));
        this.setTimeoutFn = typeof setTimeoutFn === "function" ? setTimeoutFn : null;
        this.clearTimeoutFn = typeof clearTimeoutFn === "function" ? clearTimeoutFn : null;
        this.catalog = null;
        this.started = false;
        this.knownSessionId = 0;
        this.nextLoadGeneration = 1;
        this.latestRuntimeState = null;
        this.asyncStateToken = 0;
        this.serviceTable = null;
        this.candidateValidation = null;
        this.mipJobs = new Map();
        this.activeUploadKey = null;
        this.serviceLoadWatchdogHandle = null;
        this.handleRuntimeState = this.handleRuntimeState.bind(this);
        this.handleUploadAck = this.handleUploadAck.bind(this);
        this.handleMipRequest = this.handleMipRequest.bind(this);
    }

    async start() {
        if (this.started) {
            return this;
        }

        this.started = true;
        this.connection.addEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeState);
        this.connection.addEndpointListener?.(uploadAckEndpointID, this.handleUploadAck);
        this.connection.addEndpointListener?.(mipRequestEndpointID, this.handleMipRequest);
        this.connection.sendEventOrValue?.(runtimeSyncRequestEndpointID, 1);
        return this;
    }

    async ensureCatalogLoaded() {
        if (!this.catalog) {
            this.catalog = await readCatalogFromConnection(this.connection, this.catalogPath);
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

    armServiceLoadWatchdog() {
        if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers()) {
            this.cancelServiceLoadWatchdog();
            return;
        }

        const {
            dspSessionId,
            generation,
            tableIndex,
        } = this.serviceTable;

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

    shouldStayIdleOnFailure(runtimeState) {
        return runtimeState.hasFailure
            && runtimeState.failedTableIndex === runtimeState.desiredTableIndex
            && runtimeState.desiredIntentSerial > 0;
    }

    emitWorkerLoadFailure({
        dspSessionId,
        tableIndex,
        generation = 0,
        candidateAttemptSerial = 0,
        failurePhase = failurePhaseLoadSource,
        failureReasonCode = failureReasonGeneric,
    }) {
        this.connection.sendEventOrValue?.(workerLoadFailureEndpointID, {
            dspSessionId,
            tableIndex,
            generation,
            candidateAttemptSerial,
            failurePhase,
            failureReasonCode,
        });
    }

    emitServiceLoadAbort({
        dspSessionId,
        generation,
        tableIndex,
        failureReasonCode = failureReasonGeneric,
    }) {
        this.connection.sendEventOrValue?.(serviceLoadAbortEndpointID, {
            dspSessionId,
            generation,
            tableIndex,
            failureReasonCode,
        });
    }

    async loadTableSource(tableIndex, expectedFrameCount, token) {
        const catalog = await this.ensureCatalogLoaded();

        if (token !== this.asyncStateToken) {
            return null;
        }

        const normalizedIndex = normalizeRequestedTableIndex(tableIndex, catalog.tables.length);
        const tableMeta = catalog.tables[normalizedIndex];
        assert(tableMeta, `Could not resolve table ${normalizedIndex}`);

        const audioFile = await this.connection.readResourceAsAudioData(tableMeta.sourceWav);

        if (token !== this.asyncStateToken) {
            return null;
        }

        const { samples } = normalizeDecodedAudioFileSamples(audioFile);
        const sourceTable = extractSourceFramesFromSamples(samples, {
            expectedFrameCount:
                expectedFrameCount === undefined ? Number(tableMeta.frameCount) : expectedFrameCount,
            samplesPerFrame: DEFAULT_SAMPLES_PER_FRAME,
        });

        return {
            tableIndex: normalizedIndex,
            tableMeta,
            frameCount: sourceTable.frameCount,
            frames: sourceTable.frames,
            spectra: new Array(sourceTable.frameCount),
        };
    }

    isMatchingServiceTable(serviceTarget) {
        return Boolean(
            this.serviceTable &&
            this.serviceTable.dspSessionId === serviceTarget.dspSessionId &&
            this.serviceTable.generation === serviceTarget.generation &&
            this.serviceTable.tableIndex === serviceTarget.tableIndex
        );
    }

    markCommittedDesiredLoad(runtimeState, generation, loadedTable) {
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

    handleCandidateLoadFailure(runtimeState) {
        this.emitWorkerLoadFailure({
            dspSessionId: runtimeState.dspSessionId,
            tableIndex: runtimeState.desiredTableIndex,
            generation: 0,
            candidateAttemptSerial: runtimeState.desiredIntentSerial,
            failurePhase: failurePhaseLoadSource,
            failureReasonCode: failureReasonGeneric,
        });
    }

    handleServiceTargetFailure(
        serviceTarget,
        {
            failurePhase = failurePhaseLoadSource,
            failureReasonCode = failureReasonGeneric,
        } = {}
    ) {
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

    async prepareServiceTarget(serviceTarget, runtimeState, token) {
        if (this.isMatchingServiceTable(serviceTarget)) {
            this.serviceTable.mode = serviceTarget.kind;

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

        let loadedTable = null;

        try {
            loadedTable = await this.loadTableSource(
                serviceTarget.tableIndex,
                undefined,
                token
            );
        } catch (error) {
            if (token === this.asyncStateToken) {
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

    async prepareDesiredLoad(runtimeState, token) {
        const desiredTableIndex = runtimeState.desiredTableIndex;

        if (
            this.candidateValidation &&
            this.candidateValidation.dspSessionId === runtimeState.dspSessionId
            && this.candidateValidation.tableIndex === desiredTableIndex
            && this.candidateValidation.desiredIntentSerial === runtimeState.desiredIntentSerial
        ) {
            return;
        }

        const generation = Math.max(
            this.nextLoadGeneration,
            runtimeState.generationFrontier + 1
        );

        let loadedTable = null;

        try {
            loadedTable = await this.loadTableSource(desiredTableIndex, undefined, token);
        } catch (error) {
            if (token === this.asyncStateToken) {
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
            const runtimeState = normalizeRuntimeState(nextState);

            if (runtimeState.dspSessionId <= 0) {
                return;
            }

            const sessionChanged = runtimeState.dspSessionId !== this.knownSessionId;
            if (sessionChanged) {
                this.resetSessionState(runtimeState);
            } else {
                this.nextLoadGeneration = Math.max(
                    this.nextLoadGeneration,
                    runtimeState.generationFrontier + 1
                );
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

    getOrCreateMipJob(request) {
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

    handleMipRequest(request) {
        const job = this.getOrCreateMipJob(request);

        if (!job || job.completed) {
            return;
        }

        this.pumpUploads();
    }

    handleUploadAck(ack) {
        const dspSessionId = Math.trunc(Number(ack?.dspSessionId));
        const generation = Math.trunc(Number(ack?.generation));
        const mipIndex = Math.trunc(Number(ack?.mipIndex));
        const frameIndex = Math.trunc(Number(ack?.frameIndex));
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

        this.armServiceLoadWatchdog();
        this.pumpUploads();
    }

    getSpectrumForFrame(frameIndex) {
        assert(this.serviceTable, "Current table must exist before building a spectrum");

        if (!this.serviceTable.spectra[frameIndex]) {
            this.serviceTable.spectra[frameIndex] = buildFrameSpectrum(
                this.serviceTable.frames[frameIndex]
            );
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

        let activeJob = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) : null;

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
            let mipSamples = null;

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
                samples: Array.from(mipSamples),
            });

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

export function createWavetableWorkerController(connection, options = {}) {
    return new WavetableWorkerController(connection, options);
}

export default async function runWavetableWorker(connection, options = {}) {
    const controller = createWavetableWorkerController(connection, options);
    await controller.start();
    return controller;
}
