import {
    compileArticulationOverrideImages,
} from "../../shared/articulation-image";
import {
    compileLaneTopologyUpload,
    buildLaneRuntimeEventsV2,
} from "../../shared/lane-state-v2";
import { buildModulationRuntimeEvents } from "../../shared/modulation";
import { getModulationArticulationCellIndex } from "../../shared/modulation-runtime-program";
import { startPatchWorkerServices } from "../../shared/patch-worker-services";
import { createModulationArticulationWorkerService } from "../../worker/modulation-articulation-worker-service";
import { createRackStateWorkerService } from "../../worker/rack-state-worker-service";
import { createWavetableWorkerController } from "../../worker/wavetable-worker";
import type { CumulativePatchState } from "../partial-states";
import { SPEEDRUN_SAMPLES_PER_FRAME } from "../timeline";
import {
    OfflineEngineHost,
    type OfflinePerformerClass,
} from "./offline-engine-host";
import {
    createSpeedrunResourceClient,
    type SpeedrunWavetableResourceBundle,
} from "./resources";
import {
    SPEEDRUN_TELEMETRY_ENDPOINT_IDS,
    type SpeedrunCheckpointTelemetryTrack,
    type SpeedrunTelemetryEndpointID,
} from "./telemetry";

export type NotePerformanceEvent = {
    readonly atSec: number;
    readonly code: number;
};

export type NotePerformance = {
    readonly events: ReadonlyArray<NotePerformanceEvent>;
    readonly durationSec: number;
};

export type SpeedrunCheckpointRenderJob = {
    readonly rootIndex: number;
    readonly rootNote: number;
    readonly sessionID: number;
    readonly checkpointIndex: number;
    readonly state: CumulativePatchState;
    readonly frameCount: number;
    readonly sampleRate: 48_000;
    readonly performance: NotePerformance;
    readonly resourceBaseURL: string;
    readonly resourceBundle?: SpeedrunWavetableResourceBundle;
    readonly maxInstallFrames?: number;
};

export type SpeedrunCheckpointRenderResult = {
    readonly rootIndex: number;
    readonly rootNote: number;
    readonly checkpointIndex: number;
    readonly frameCount: number;
    readonly samples: Float32Array;
    readonly telemetry: SpeedrunCheckpointTelemetryTrack;
    readonly metrics: {
        readonly renderedFrameCount: number;
        readonly installFrameCount: number;
        readonly elapsedMilliseconds: number;
        readonly realtimeMultiplier: number | null;
    };
};

export type SpeedrunInstallLane = "wavetable" | "modulation" | "articulation" | "rack";

export class SpeedrunInstallError extends Error {
    constructor(
        readonly lane: SpeedrunInstallLane,
        message: string,
        options: { readonly cause?: unknown } = {},
    ) {
        super(`${lane} install failed: ${message}`, options);
        this.name = "SpeedrunInstallError";
    }
}

type InstallExpectations = {
    readonly tableIndices: readonly number[];
    readonly modulationFrontier: number;
    readonly articulationFrontier: number;
    readonly rackChainLength: number;
    readonly rackParamSerial: number;
};

function installExpectations(state: CumulativePatchState): InstallExpectations {
    const routeCells = Object.fromEntries(state.modulation.routes.flatMap((route) => {
        const cell = getModulationArticulationCellIndex(route);
        return cell === null ? [] : [[route.id, cell] as const];
    }));
    const laneEvents = buildLaneRuntimeEventsV2(state.lane);
    return {
        tableIndices: ["A", "B", "C"].map((oscillator) => (
            Math.round(Number(state.parameters[`osc${oscillator}WavetableSelect`]) || 0)
        )),
        modulationFrontier: buildModulationRuntimeEvents(state.modulation, null).length,
        articulationFrontier: compileArticulationOverrideImages(
            state.articulations,
            routeCells,
        ).length,
        rackChainLength: compileLaneTopologyUpload(state.lane).chainLength,
        rackParamSerial: Math.max(0, laneEvents.length - 1),
    };
}

function installationFailure(
    state: ReturnType<OfflineEngineHost["getInstallationState"]>,
    expected: InstallExpectations,
): SpeedrunInstallError | null {
    for (let oscillatorIndex = 0; oscillatorIndex < expected.tableIndices.length; oscillatorIndex += 1) {
        const runtime = state.runtimeStates.get(oscillatorIndex);
        if (runtime && Boolean(runtime.hasFailure)
            && Number(runtime.failedTableIndex) === expected.tableIndices[oscillatorIndex]) {
            return new SpeedrunInstallError(
                "wavetable",
                `oscillator ${oscillatorIndex + 1} rejected table ${expected.tableIndices[oscillatorIndex]}.`,
            );
        }
    }
    const rejectedSerial = Math.trunc(Number(state.runtimeInstallAck?.rejectedSerial) || 0);
    if (rejectedSerial > 0) {
        return new SpeedrunInstallError("modulation", `runtime serial ${rejectedSerial} was rejected.`);
    }
    if (rejectedSerial < 0) {
        return new SpeedrunInstallError("articulation", `runtime serial ${rejectedSerial} was rejected.`);
    }
    const rejectedRackUploads = Math.trunc(
        Number(state.effectiveRackState?.laneRejectedUploadCount) || 0,
    );
    if (rejectedRackUploads > 0) {
        return new SpeedrunInstallError("rack", `${rejectedRackUploads} topology upload(s) were rejected.`);
    }
    return null;
}

function installationComplete(
    state: ReturnType<OfflineEngineHost["getInstallationState"]>,
    expected: InstallExpectations,
) {
    const wavetablesReady = expected.tableIndices.every((tableIndex, oscillatorIndex) => {
        const runtime = state.runtimeStates.get(oscillatorIndex);
        return Boolean(runtime?.hasActive) && Number(runtime?.activeTableIndex) === tableIndex;
    });
    const modulationReady = expected.modulationFrontier === 0
        || Number(state.runtimeInstallAck?.acceptedModulationSerial) >= expected.modulationFrontier;
    const articulationReady = expected.articulationFrontier === 0
        || Number(state.runtimeInstallAck?.acceptedArticulationSerial) <= -expected.articulationFrontier;
    const rackReady = Number(state.effectiveRackState?.laneCommittedChainLength)
            === expected.rackChainLength
        && Number(state.effectiveRackState?.laneParamsAcknowledgedSerial)
            >= expected.rackParamSerial;
    return wavetablesReady && modulationReady && articulationReady && rackReady;
}

function pendingLane(
    state: ReturnType<OfflineEngineHost["getInstallationState"]>,
    expected: InstallExpectations,
): SpeedrunInstallLane {
    if (!expected.tableIndices.every((tableIndex, oscillatorIndex) => {
        const runtime = state.runtimeStates.get(oscillatorIndex);
        return Boolean(runtime?.hasActive) && Number(runtime?.activeTableIndex) === tableIndex;
    })) return "wavetable";
    if (expected.modulationFrontier > 0
        && Number(state.runtimeInstallAck?.acceptedModulationSerial) < expected.modulationFrontier) {
        return "modulation";
    }
    if (expected.articulationFrontier > 0
        && Number(state.runtimeInstallAck?.acceptedArticulationSerial) > -expected.articulationFrontier) {
        return "articulation";
    }
    return "rack";
}

function installStateSummary(state: ReturnType<OfflineEngineHost["getInstallationState"]>) {
    const wavetable = [0, 1, 2].map((oscillatorIndex) => {
        const runtime = state.runtimeStates.get(oscillatorIndex);
        return runtime
            ? `${oscillatorIndex}:${Number(runtime.activeGeneration) || 0}/${Number(runtime.generationFrontier) || 0}`
                + ` load=${Number(runtime.loadingGeneration) || 0} active=${Boolean(runtime.hasActive)}`
            : `${oscillatorIndex}:missing`;
    }).join(", ");
    return `${wavetable}; mod=${Number(state.runtimeInstallAck?.acceptedModulationSerial) || 0}`
        + ` art=${Number(state.runtimeInstallAck?.acceptedArticulationSerial) || 0}`
        + ` rack=${Number(state.effectiveRackState?.laneCommittedChainLength) || 0}`
        + ` params=${Number(state.effectiveRackState?.laneParamsAcknowledgedSerial) || 0}`
        + ` mipSent=${state.inputEventCounts.get("wavetableMipFrame") ?? 0}`
        + ` mipAck=${state.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}

function status(code: number) {
    return (code >>> 16) & 0xff;
}

function note(code: number) {
    return (code >>> 8) & 0x7f;
}

function velocity(code: number) {
    return code & 0x7f;
}

function performanceEvents(performance: NotePerformance, frameCount: number, sampleRate: number) {
    if (!Number.isFinite(performance.durationSec) || performance.durationSec <= 0) {
        throw new Error("Speedrun performance duration must be positive and finite.");
    }
    const cycleFrames = Math.max(1, Math.round(performance.durationSec * sampleRate));
    const normalized = performance.events.map((event) => ({
        frame: Math.max(0, Math.min(cycleFrames - 1, Math.round(event.atSec * sampleRate))),
        code: Math.trunc(event.code),
    })).sort((left, right) => left.frame - right.frame || left.code - right.code);
    const events: Array<{ frame: number; code: number }> = [];
    for (let cycleStart = 0; cycleStart < frameCount; cycleStart += cycleFrames) {
        for (const event of normalized) {
            const frame = cycleStart + event.frame;
            if (frame < frameCount) events.push({ frame, code: event.code });
        }
    }
    return events;
}

function articulationSelector(serializedConfig: string | null, code: number, chainIndex: number) {
    if (serializedConfig === null) return null;
    let config: Record<string, unknown>;
    try {
        config = JSON.parse(serializedConfig) as Record<string, unknown>;
    } catch {
        return null;
    }
    const mode = config.activeMode;
    const values = mode === "key"
        ? config.key
        : mode === "vel"
            ? config.velocity
            : config.chain;
    if (!Array.isArray(values)) return null;
    const index = mode === "key" ? note(code) : mode === "vel" ? velocity(code) : chainIndex % 128;
    const selector = Math.trunc(Number(values[index]));
    return selector >= 0 && selector <= 127 ? selector : null;
}

function sendPerformanceEvent(
    host: OfflineEngineHost,
    code: number,
    articulationConfig: string | null,
    chainIndex: number,
) {
    const midiStatus = status(code);
    if ((midiStatus & 0xf0) === 0x90 && velocity(code) > 0) {
        const selector = articulationSelector(articulationConfig, code, chainIndex);
        if (selector !== null) {
            host.sendEventOrValue("articulationNoteMeta", {
                channel: midiStatus & 0x0f,
                noteNumber: note(code),
                selectorA: selector,
                selectorB: 0,
                durationSamples: 0,
                ageSamples: 0,
            });
        }
    }
    host.sendMIDIInputEvent("midiIn", code);
}

async function yieldInstallTurn() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Render one cumulative checkpoint through the real worker-service stack. */
export async function renderSpeedrunCheckpoint(
    PerformerClass: OfflinePerformerClass,
    job: SpeedrunCheckpointRenderJob,
): Promise<SpeedrunCheckpointRenderResult> {
    const startedAt = globalThis.performance?.now?.() ?? 0;
    const host = new OfflineEngineHost(PerformerClass, {
        modulation: job.state.modulation,
        lane: job.state.lane,
        articulations: job.state.articulations,
    }, job.resourceBaseURL);
    await host.initialise(job.sessionID, job.sampleRate);
    host.setInitialParameters(job.state.parameters);
    host.sendEventOrValue("tempo", { bpm: 120 });

    const services = await startPatchWorkerServices(host, [
        createModulationArticulationWorkerService,
        createRackStateWorkerService,
        () => createWavetableWorkerController(host, {
            maxFramesInFlight: 1,
            serviceLoadTimeoutMs: 20_000,
            ...(job.resourceBundle
                ? { resourceClient: createSpeedrunResourceClient(job.resourceBundle) }
                : {}),
        }),
    ]);
    const expected = installExpectations(job.state);
    const maxInstallFrames = job.maxInstallFrames ?? job.sampleRate * 4;
    let installFrameCount = 0;
    try {
        while (installFrameCount < maxInstallFrames) {
            await host.pump(128);
            installFrameCount += 128;
            const installState = host.getInstallationState();
            const failure = installationFailure(installState, expected);
            if (failure) throw failure;
            if (installationComplete(installState, expected)) break;
            if ((installFrameCount / 128) % 8 === 0) await yieldInstallTurn();
        }
        const installState = host.getInstallationState();
        if (!installationComplete(installState, expected)) {
            const lane = pendingLane(installState, expected);
            throw new SpeedrunInstallError(
                lane,
                `timed out after ${installFrameCount} virtual frames (${installStateSummary(installState)}).`,
            );
        }
    } finally {
        await services.stop();
    }

    const samples = new Float32Array(job.frameCount * 2);
    const events = performanceEvents(job.performance, job.frameCount, job.sampleRate);
    const articulationConfig = host.getInstallationState().articulationTriggerConfig;
    const telemetryByFrame = new Map<
        number,
        Partial<Record<SpeedrunTelemetryEndpointID, unknown>>
    >();
    let eventIndex = 0;
    let renderedFrames = 0;
    let noteOnIndex = 0;
    const telemetryListeners = SPEEDRUN_TELEMETRY_ENDPOINT_IDS.map((endpointID) => {
        const listener = (value: unknown) => {
            const videoFrame = Math.floor(renderedFrames / SPEEDRUN_SAMPLES_PER_FRAME);
            const eventsAtFrame = telemetryByFrame.get(videoFrame) ?? {};
            eventsAtFrame[endpointID] = structuredClone(value);
            telemetryByFrame.set(videoFrame, eventsAtFrame);
        };
        host.addEndpointListener(endpointID, listener);
        return { endpointID, listener };
    });
    try {
        while (renderedFrames < job.frameCount) {
            while (eventIndex < events.length && events[eventIndex].frame === renderedFrames) {
                const event = events[eventIndex];
                sendPerformanceEvent(host, event.code, articulationConfig, noteOnIndex);
                if ((status(event.code) & 0xf0) === 0x90 && velocity(event.code) > 0) noteOnIndex += 1;
                eventIndex += 1;
            }
            const nextEventFrame = events[eventIndex]?.frame ?? job.frameCount;
            const nextVideoFrame = (
                Math.floor(renderedFrames / SPEEDRUN_SAMPLES_PER_FRAME) + 1
            ) * SPEEDRUN_SAMPLES_PER_FRAME;
            const count = Math.min(
                128,
                job.frameCount - renderedFrames,
                nextEventFrame - renderedFrames,
                nextVideoFrame - renderedFrames,
            );
            if (count < 1) continue;
            host.render(count, samples, renderedFrames);
            renderedFrames += count;
        }
    } finally {
        for (const { endpointID, listener } of telemetryListeners) {
            host.removeEndpointListener(endpointID, listener);
        }
    }

    const elapsedMilliseconds = (globalThis.performance?.now?.() ?? startedAt) - startedAt;
    return {
        rootIndex: job.rootIndex,
        rootNote: job.rootNote,
        checkpointIndex: job.checkpointIndex,
        frameCount: job.frameCount,
        samples,
        telemetry: {
            frameCount: Math.ceil(job.frameCount / SPEEDRUN_SAMPLES_PER_FRAME),
            frames: [...telemetryByFrame.entries()]
                .sort(([left], [right]) => left - right)
                .map(([frame, frameEvents]) => ({ frame, events: frameEvents })),
        },
        metrics: {
            renderedFrameCount: job.frameCount,
            installFrameCount,
            elapsedMilliseconds,
            realtimeMultiplier: elapsedMilliseconds > 0
                ? job.frameCount / (elapsedMilliseconds * job.sampleRate / 1_000)
                : null,
        },
    };
}
