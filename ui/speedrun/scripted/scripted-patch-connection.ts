import {
    ARTICULATIONS_V4_STATE_KEY,
    serializeArticulationsV4,
} from "../../shared/articulation-image";
import { LANE_STATE_KEY } from "../../shared/lane-state";
import { serializeLaneStateV2 } from "../../shared/lane-state-v2";
import {
    MODULATION_STATE_KEY,
    serializeModulationState,
} from "../../shared/modulation";
import { MockPatchConnection } from "../../shared/patch-connection-mock";
import type { DefaultsSnapshot } from "../patch-io";
import {
    applySpeedrunOp,
    type CumulativePatchState,
} from "../partial-states";
import type { SpeedrunRecipe, UIOp } from "../recipe";
import {
    SPEEDRUN_SAMPLES_PER_FRAME,
    type SpeedrunTimeline,
    type TimedOp,
} from "../timeline";
import type { NotePerformance } from "../audio/checkpoint-renderer";
import type {
    SpeedrunTelemetryEndpointID,
    SpeedrunTelemetryTrack,
} from "../audio/telemetry";

export type ScriptedMidiEvent = {
    readonly frame: number;
    readonly code: number;
};

export type ScriptedConnectionFrameSnapshot = {
    readonly frame: number;
    readonly parameterCount: number;
    readonly telemetryEndpoints: ReadonlyArray<string>;
    readonly midiCodes: ReadonlyArray<number>;
};

function clone<T>(value: T): T {
    return structuredClone(value);
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothstep(value: number) {
    const progress = clamp01(value);
    return progress * progress * (3 - (2 * progress));
}

function mix(from: number, to: number, progress: number) {
    return from + ((to - from) * smoothstep(progress));
}

function initialState(defaults: DefaultsSnapshot, recipe: SpeedrunRecipe): CumulativePatchState {
    return recipe.prelude.reduce(applySpeedrunOp, {
        parameters: { ...defaults.parameters },
        modulation: clone(defaults.modulation),
        lane: clone(defaults.lane),
        articulations: clone(recipe.articulations),
    });
}

function partialOp(op: UIOp, progress: number): UIOp | null {
    switch (op.kind) {
        case "installLaneBaseline":
        case "installModulationBaseline":
            return op;
        case "navigate":
            return null;
        case "setParam":
        case "setLaneParam":
            return { ...op, to: mix(op.from, op.to, progress) };
        case "selectWavetable":
            return progress >= 0.58 ? op : null;
        case "toggleEffect":
            return progress >= 0.62 ? op : null;
        case "mapRoute": {
            if (progress < 0.55) return null;
            const routeProgress = clamp01((progress - 0.55) / 0.45);
            return {
                ...op,
                route: { ...op.route, amount: mix(0, op.route.amount, routeProgress) },
            };
        }
        case "configureMseg":
            return {
                ...op,
                rate: mix(1, op.rate, progress),
                morph: mix(0, op.morph, progress),
            };
        case "setEnvelope":
            return {
                ...op,
                name: progress >= 0.45 ? op.name : `ENV ${op.slot}`,
                attack: mix(0.01, op.attack, progress),
                decay: mix(0.2, op.decay, progress),
                sustain: mix(0.8, op.sustain, progress),
                release: mix(0.4, op.release, progress),
            };
        case "setMacro":
            return {
                ...op,
                name: progress >= 0.45 ? op.name : `Macro ${op.slot}`,
                value: mix(0, op.value, progress),
            };
    }
}

function applyTimedOp(state: CumulativePatchState, span: TimedOp, frame: number) {
    if (frame < span.startFrame) return state;
    const duration = Math.max(1, span.endFrame - span.startFrame);
    const progress = frame >= span.endFrame
        ? 1
        : clamp01((frame - span.startFrame) / duration);
    const op = partialOp(span.op, progress);
    return op === null ? state : applySpeedrunOp(state, op);
}

/** Exact recipe state at an integer video frame, independent of retained UI state. */
export function scriptedPatchStateAtFrame(
    defaults: DefaultsSnapshot,
    recipe: SpeedrunRecipe,
    timeline: SpeedrunTimeline,
    requestedFrame: number,
) {
    const frame = Math.min(
        Math.max(0, Math.floor(requestedFrame)),
        Math.max(0, timeline.durationInFrames - 1),
    );
    let state = initialState(defaults, recipe);
    for (const section of timeline.sections) {
        if (frame < section.startFrame) break;
        for (const span of section.opSpans) {
            state = applyTimedOp(state, span, frame);
        }
    }
    return state;
}

function performanceEvents(
    performance: NotePerformance,
    frameCount: number,
    sampleRate: number,
) {
    const cycleFrames = Math.max(1, Math.round(performance.durationSec * sampleRate));
    const normalized = performance.events.map((event) => ({
        sample: Math.max(0, Math.min(cycleFrames - 1, Math.round(event.atSec * sampleRate))),
        code: Math.trunc(event.code),
    })).sort((left, right) => left.sample - right.sample || left.code - right.code);
    const events: Array<{ sample: number; code: number }> = [];
    for (let cycleStart = 0; cycleStart < frameCount; cycleStart += cycleFrames) {
        for (const event of normalized) {
            const sample = cycleStart + event.sample;
            if (sample < frameCount) events.push({ sample, code: event.code });
        }
    }
    return events;
}

/** MIDI frame events follow each independently rendered audio checkpoint. */
export function buildScriptedMidiEvents(
    timeline: SpeedrunTimeline,
    performance: NotePerformance,
): ReadonlyArray<ScriptedMidiEvent> {
    return timeline.sections.flatMap((section) => {
        if (section.checkpointIndex < 0) return [];
        const sectionSamples = section.endSample - section.startSample;
        return performanceEvents(performance, sectionSamples, timeline.sampleRate).map((event) => ({
            frame: section.startFrame + Math.floor(event.sample / SPEEDRUN_SAMPLES_PER_FRAME),
            code: event.code,
        }));
    }).sort((left, right) => left.frame - right.frame || left.code - right.code);
}

function runtimeState(oscillatorIndex: number, tableIndex: number) {
    return {
        dspSessionId: 1,
        oscillatorIndex,
        desiredTableIndex: tableIndex,
        desiredIntentSerial: tableIndex + 1,
        serviceState: 0,
        hasActive: true,
        activeTableIndex: tableIndex,
        activeGeneration: tableIndex + 1,
        hasLoading: false,
        loadingTableIndex: 0,
        loadingGeneration: 0,
        hasFailure: false,
        failedTableIndex: 0,
        failedGeneration: 0,
        failureScope: 0,
        failurePhase: 0,
        failureReasonCode: 0,
    };
}

function numberField(value: unknown, key: string, fallback = 0) {
    if (!value || typeof value !== "object") return fallback;
    const next = Number(Reflect.get(value, key));
    return Number.isFinite(next) ? next : fallback;
}

/**
 * Production connection contract driven by recipe frame state and recorded
 * engine telemetry. Product UI writes still go through the normal connection
 * methods; the director never reaches into React component state.
 */
export class ScriptedPatchConnection extends MockPatchConnection {
    private readonly telemetryByFrame = new Map<number, Readonly<Record<string, unknown>>>();
    private readonly midiByFrame = new Map<number, number[]>();
    private readonly publishedParameterValues = new Map<string, number>();
    private readonly storedValues = new Map<string, string>();
    private readonly tableIndices = [-1, -1, -1];
    private latestFrame = -1;
    private latestSnapshot: ScriptedConnectionFrameSnapshot = {
        frame: -1,
        parameterCount: 0,
        telemetryEndpoints: [],
        midiCodes: [],
    };

    constructor(
        private readonly defaults: DefaultsSnapshot,
        private readonly recipe: SpeedrunRecipe,
        private readonly timeline: SpeedrunTimeline,
        performance: NotePerformance,
        telemetry: SpeedrunTelemetryTrack,
        keyboardClass: CustomElementConstructor,
        resourceBaseURL: string | URL,
    ) {
        super({ name: recipe.label });
        this.manifest = { name: recipe.label };
        (this.utilities as { PianoKeyboard: CustomElementConstructor }).PianoKeyboard = keyboardClass;
        this.resourceBaseURL = new URL("./", resourceBaseURL);
        for (const frame of telemetry.frames) {
            this.telemetryByFrame.set(frame.frame, frame.events);
        }
        for (const event of buildScriptedMidiEvents(timeline, performance)) {
            const codes = this.midiByFrame.get(event.frame) ?? [];
            codes.push(event.code);
            this.midiByFrame.set(event.frame, codes);
        }
    }

    private readonly resourceBaseURL: URL;

    override getResourceAddress(path: string) {
        return new URL(path.replace(/^\//u, ""), this.resourceBaseURL).href;
    }

    advanceToFrame(requestedFrame: number) {
        const frame = Math.min(
            Math.max(0, Math.floor(requestedFrame)),
            Math.max(0, this.timeline.durationInFrames - 1),
        );
        if (frame < this.latestFrame) {
            throw new Error(`ScriptedPatchConnection requires sequential frames (${frame} after ${this.latestFrame}).`);
        }
        if (frame === this.latestFrame) return this.latestSnapshot;

        const state = scriptedPatchStateAtFrame(this.defaults, this.recipe, this.timeline, frame);
        for (const [endpointID, value] of Object.entries(state.parameters)) {
            if (Object.is(this.publishedParameterValues.get(endpointID), value)) continue;
            this.publishedParameterValues.set(endpointID, value);
            this.setParameterValue(endpointID, value);
        }

        this.publishStoredState(LANE_STATE_KEY, serializeLaneStateV2(state.lane));
        this.publishStoredState(MODULATION_STATE_KEY, serializeModulationState(state.modulation));
        this.publishStoredState(
            ARTICULATIONS_V4_STATE_KEY,
            serializeArticulationsV4(state.articulations),
        );

        ["A", "B", "C"].forEach((oscillator, oscillatorIndex) => {
            const tableIndex = Math.max(
                0,
                Math.trunc(Number(state.parameters[`osc${oscillator}WavetableSelect`]) || 0),
            );
            if (this.tableIndices[oscillatorIndex] === tableIndex) return;
            this.tableIndices[oscillatorIndex] = tableIndex;
            this.setRuntimeState(runtimeState(oscillatorIndex, tableIndex));
        });

        const telemetryEndpoints: string[] = [];
        const midiCodes: number[] = [];
        for (let dueFrame = this.latestFrame + 1; dueFrame <= frame; dueFrame += 1) {
            const events = this.telemetryByFrame.get(dueFrame) ?? {};
            for (const [endpointID, value] of Object.entries(events)) {
                telemetryEndpoints.push(endpointID);
                this.publishTelemetry(endpointID as SpeedrunTelemetryEndpointID, value);
            }
            for (const code of this.midiByFrame.get(dueFrame) ?? []) {
                midiCodes.push(code);
                this.sendMIDIInputEvent("midiIn", code);
            }
        }

        this.latestFrame = frame;
        this.latestSnapshot = {
            frame,
            parameterCount: this.publishedParameterValues.size,
            telemetryEndpoints,
            midiCodes,
        };
        return this.latestSnapshot;
    }

    getFrameSnapshot() {
        return this.latestSnapshot;
    }

    private publishStoredState(key: string, value: unknown) {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        if (this.storedValues.get(key) === serialized) return;
        this.storedValues.set(key, serialized);
        this.setStoredStateValue(key, value);
    }

    private publishTelemetry(endpointID: SpeedrunTelemetryEndpointID, value: unknown) {
        switch (endpointID) {
            case "runtimeState":
                this.setRuntimeState(value && typeof value === "object" ? value : {});
                return;
            case "effectiveWavetablePosition":
                this.emitEffectiveWavetablePosition(
                    numberField(value, "position"),
                    numberField(value, "voiceGeneration", 1),
                );
                return;
            case "effectiveWarpState":
                this.emitEffectiveWarpState(value && typeof value === "object" ? value : {});
                return;
            case "effectiveUnisonState":
                this.emitEffectiveUnisonState(value && typeof value === "object" ? value : {});
                return;
            case "effectiveFilterState":
                this.emitEffectiveFilterState(value && typeof value === "object" ? value : {});
                return;
            case "effectiveMsegState":
                this.emitEffectiveMsegState(value && typeof value === "object" ? value : {});
                return;
            case "effectiveModSourceState":
                this.emitEffectiveModSourceState(value && typeof value === "object" ? value : {});
                return;
            case "filterSpectrum":
                this.emitFilterSpectrum(value && typeof value === "object" ? value : {});
                return;
            case "distortionHistory":
                this.emitDistortionHistory(value && typeof value === "object" ? value : {});
                return;
            case "distortionScope":
                this.emitDistortionScope(value && typeof value === "object" ? value : {});
        }
    }
}
