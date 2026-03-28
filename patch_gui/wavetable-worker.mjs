import {
    DEFAULT_MIP_LEVEL_COUNT,
    DEFAULT_SAMPLES_PER_FRAME,
    buildMipFrameFromSpectrum,
    buildSpectrumCacheForFrames,
    extractSourceFramesFromSamples,
    normalizeDecodedAudioFileSamples,
} from "./wavetable-mip.mjs";
import { getFactoryBankCatalogValue } from "./wavetable-bank.mjs";

const wavetableSelectEndpointID = "wavetableSelect";
const loadBeginEndpointID = "wavetableLoadBegin";
const mipFrameEndpointID = "wavetableMipFrame";
const uploadAckEndpointID = "wavetableUploadAck";
const mipRequestEndpointID = "wavetableMipRequest";
const defaultCatalogPath = "assets/factory-bank-catalog.json";

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

function normalizeRequestedTableIndex(value, tableCount) {
    const rounded = Math.round(Number(value) || 0);
    return clamp(rounded, 0, Math.max(0, tableCount - 1));
}

export class WavetableWorkerController {
    constructor(
        connection,
        {
            catalogPath = defaultCatalogPath,
            maxFramesInFlight = 4,
            mipLevelCount = DEFAULT_MIP_LEVEL_COUNT,
        } = {}
    ) {
        this.connection = connection;
        this.catalogPath = catalogPath;
        this.maxFramesInFlight = Math.max(1, Math.round(Number(maxFramesInFlight) || 1));
        this.mipLevelCount = mipLevelCount;
        this.catalog = null;
        this.started = false;
        this.nextGeneration = 1;
        this.currentSelectionSerial = 0;
        this.currentTable = null;
        this.pendingMipRequests = [];
        this.pendingMipRequestSet = new Set();
        this.activeUpload = null;
        this.handleWavetableSelect = this.handleWavetableSelect.bind(this);
        this.handleUploadAck = this.handleUploadAck.bind(this);
        this.handleMipRequest = this.handleMipRequest.bind(this);
    }

    async start() {
        if (this.started) {
            return this;
        }

        this.started = true;
        this.connection.addParameterListener?.(
            wavetableSelectEndpointID,
            this.handleWavetableSelect
        );
        this.connection.addEndpointListener?.(
            uploadAckEndpointID,
            this.handleUploadAck
        );
        this.connection.addEndpointListener?.(
            mipRequestEndpointID,
            this.handleMipRequest
        );
        this.connection.requestParameterValue?.(wavetableSelectEndpointID);
        return this;
    }

    async ensureCatalogLoaded() {
        if (!this.catalog) {
            this.catalog = await readCatalogFromConnection(this.connection, this.catalogPath);
        }

        return this.catalog;
    }

    async handleWavetableSelect(nextValue) {
        try {
            const catalog = await this.ensureCatalogLoaded();
            const tableIndex = normalizeRequestedTableIndex(nextValue, catalog.tables.length);

            if (
                this.currentTable &&
                this.currentTable.tableIndex === tableIndex &&
                this.currentTable.pendingSelectionValue === tableIndex
            ) {
                return;
            }

            const selectionSerial = this.currentSelectionSerial + 1;
            this.currentSelectionSerial = selectionSerial;
            const tableMeta = catalog.tables[tableIndex];
            assert(tableMeta, `Could not resolve table ${tableIndex}`);

            const audioFile = await this.connection.readResourceAsAudioData(tableMeta.sourceWav);
            if (selectionSerial !== this.currentSelectionSerial) {
                return;
            }

            const { samples } = normalizeDecodedAudioFileSamples(audioFile);
            const sourceTable = extractSourceFramesFromSamples(samples, {
                expectedFrameCount: Number(tableMeta.frameCount),
                samplesPerFrame: DEFAULT_SAMPLES_PER_FRAME,
            });
            const spectra = buildSpectrumCacheForFrames(sourceTable.frames);

            if (selectionSerial !== this.currentSelectionSerial) {
                return;
            }

            this.currentTable = {
                generation: this.nextGeneration,
                tableIndex,
                frameCount: sourceTable.frameCount,
                spectra,
                completedMips: new Set(),
                pendingSelectionValue: tableIndex,
            };
            this.nextGeneration += 1;
            this.pendingMipRequests = [];
            this.pendingMipRequestSet.clear();
            this.activeUpload = null;

            this.connection.sendEventOrValue?.(loadBeginEndpointID, {
                generation: this.currentTable.generation,
                tableIndex: this.currentTable.tableIndex,
                frameCount: this.currentTable.frameCount,
            });
        } catch (error) {
            console.error(error);
        }
    }

    handleMipRequest(request) {
        if (!this.currentTable) {
            return;
        }

        const generation = Math.trunc(Number(request?.generation));
        const tableIndex = Math.trunc(Number(request?.tableIndex));
        const mipIndex = Math.trunc(Number(request?.mipIndex));

        if (
            generation !== this.currentTable.generation ||
            tableIndex !== this.currentTable.tableIndex
        ) {
            return;
        }

        if (mipIndex < 0 || mipIndex >= this.mipLevelCount) {
            return;
        }

        if (
            this.currentTable.completedMips.has(mipIndex) ||
            this.pendingMipRequestSet.has(mipIndex) ||
            this.activeUpload?.mipIndex === mipIndex
        ) {
            return;
        }

        this.pendingMipRequests.push(mipIndex);
        this.pendingMipRequestSet.add(mipIndex);
        this.pumpUploads();
    }

    handleUploadAck(ack) {
        if (!this.activeUpload || !this.currentTable) {
            return;
        }

        const generation = Math.trunc(Number(ack?.generation));
        const tableIndex = Math.trunc(Number(ack?.tableIndex));
        const mipIndex = Math.trunc(Number(ack?.mipIndex));
        const frameIndex = Math.trunc(Number(ack?.frameIndex));

        if (
            generation !== this.activeUpload.generation ||
            tableIndex !== this.activeUpload.tableIndex ||
            mipIndex !== this.activeUpload.mipIndex ||
            frameIndex < 0 ||
            frameIndex >= this.activeUpload.frameCount ||
            this.activeUpload.ackedFrames[frameIndex]
        ) {
            return;
        }

        this.activeUpload.ackedFrames[frameIndex] = 1;
        this.activeUpload.inFlight = Math.max(0, this.activeUpload.inFlight - 1);
        this.activeUpload.ackedFrameCount += 1;

        if (
            this.activeUpload.ackedFrameCount === this.activeUpload.frameCount &&
            this.activeUpload.nextFrameIndex >= this.activeUpload.frameCount
        ) {
            this.currentTable.completedMips.add(this.activeUpload.mipIndex);
            this.activeUpload = null;
        }

        this.pumpUploads();
    }

    pumpUploads() {
        if (!this.currentTable) {
            return;
        }

        if (!this.activeUpload) {
            const nextMipIndex = this.pendingMipRequests.shift();

            if (nextMipIndex === undefined) {
                return;
            }

            this.pendingMipRequestSet.delete(nextMipIndex);
            this.activeUpload = {
                generation: this.currentTable.generation,
                tableIndex: this.currentTable.tableIndex,
                mipIndex: nextMipIndex,
                frameCount: this.currentTable.frameCount,
                nextFrameIndex: 0,
                inFlight: 0,
                ackedFrameCount: 0,
                ackedFrames: new Uint8Array(this.currentTable.frameCount),
            };
        }

        while (
            this.activeUpload &&
            this.activeUpload.inFlight < this.maxFramesInFlight &&
            this.activeUpload.nextFrameIndex < this.activeUpload.frameCount
        ) {
            const frameIndex = this.activeUpload.nextFrameIndex;
            const mipSamples = buildMipFrameFromSpectrum(
                this.currentTable.spectra[frameIndex],
                this.activeUpload.mipIndex
            );

            this.connection.sendEventOrValue?.(mipFrameEndpointID, {
                generation: this.activeUpload.generation,
                tableIndex: this.activeUpload.tableIndex,
                mipIndex: this.activeUpload.mipIndex,
                frameIndex,
                samples: Array.from(mipSamples),
            });

            this.activeUpload.nextFrameIndex += 1;
            this.activeUpload.inFlight += 1;
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

