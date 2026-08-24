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
import { OSCILLATOR_IDS } from "../../shared/modulation-targets";
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
import {
    buildPerformanceSampleEvents,
    type NotePerformance,
} from "../audio/checkpoint-renderer";
import { clamp01, mix } from "../easing";
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

function initialState(defaults: DefaultsSnapshot, recipe: SpeedrunRecipe): CumulativePatchState {
    return recipe.prelude.reduce(applySpeedrunOp, {
        parameters: { ...defaults.parameters },
        modulation: clone(defaults.modulation),
        lane: clone(defaults.lane),
        articulations: clone(recipe.articulations),
    });
}

function partialOp(op: UIOp, progress: number, defaults: DefaultsSnapshot): UIOp | null {
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
            // The real picker owns the visible selection during the span.
            // Snap the connection authority to the exact recipe value only
            // after the gesture completes.
            return progress >= 1 ? op : null;
        case "toggleEffect":
            return progress >= 1 ? op : null;
        case "mapRoute":
            // Avoid pre-creating the pair before the production drop handler
            // runs; the exact route is the end-of-gesture snap correction.
            return progress >= 1 ? op : null;
        case "configureMseg":
            return {
                ...op,
                rate: mix(1, op.rate, progress),
                morph: mix(0, op.morph, progress),
            };
        case "setEnvelope": {
            // Ease from the ENGINE's own defaults, not restated literals.
            const base = (suffix: string, fallback: number) => {
                const value = defaults.parameters[`env${op.slot}${suffix}`];
                return Number.isFinite(value) ? value : fallback;
            };
            return {
                ...op,
                name: progress >= 0.45 ? op.name : `ENV ${op.slot}`,
                attack: mix(base("Attack", 0.01), op.attack, progress),
                decay: mix(base("Decay", 0.2), op.decay, progress),
                sustain: mix(base("Sustain", 0.8), op.sustain, progress),
                release: mix(base("Release", 0.4), op.release, progress),
            };
        }
        case "setMacro":
            return {
                ...op,
                name: progress >= 0.45 ? op.name : `Macro ${op.slot}`,
                value: mix(0, op.value, progress),
            };
    }
}

function applyTimedOp(
    state: CumulativePatchState,
    span: TimedOp,
    frame: number,
    defaults: DefaultsSnapshot,
) {
    if (frame < span.startFrame) return state;
    const duration = Math.max(1, span.endFrame - span.startFrame);
    const progress = frame >= span.endFrame
        ? 1
        : clamp01((frame - span.startFrame) / duration);
    const op = partialOp(span.op, progress, defaults);
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
            state = applyTimedOp(state, span, frame, defaults);
        }
    }
    return state;
}

/** MIDI frame events follow each independently rendered audio checkpoint. */
export function buildScriptedMidiEvents(
    timeline: SpeedrunTimeline,
    performance: NotePerformance,
): ReadonlyArray<ScriptedMidiEvent> {
    return timeline.sections.flatMap((section) => {
        if (section.checkpointIndex < 0) return [];
        const sectionSamples = section.endSample - section.startSample;
        return buildPerformanceSampleEvents(performance, sectionSamples, timeline.sampleRate).map((event) => ({
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

function loadingRuntimeState(oscillatorIndex: number, activeTableIndex: number, loadingTableIndex: number) {
    return {
        ...runtimeState(oscillatorIndex, activeTableIndex),
        desiredTableIndex: loadingTableIndex,
        desiredIntentSerial: loadingTableIndex + 1,
        hasLoading: true,
        loadingTableIndex,
        loadingGeneration: loadingTableIndex + 1,
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
 *
 * Extending MockPatchConnection is a deliberate dependency on the maintained
 * in-memory connection model (endpoint fan-out, worker services, runtime
 * choreography) rather than a test shortcut; wall-clock behaviors the harness
 * mock owns are overridden below so capture stays frame-deterministic.
 */
export class ScriptedPatchConnection extends MockPatchConnection {
    private readonly resourceBaseURL: URL;
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

    override getResourceAddress(path: string) {
        return new URL(path.replace(/^\//u, ""), this.resourceBaseURL).href;
    }

    /**
     * The harness mock simulates wavetable activation on a wall-clock timer;
     * under frame-stepped capture that timer could fire between frames and
     * emit runtime state the script did not author. The scripted connection
     * owns the loading→active choreography in advanceToFrame instead.
     */
    protected override scheduleWavetableActivation() {
        this.cancelScheduledWavetableActivation();
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

        const loadingSpan = this.timeline.sections.flatMap((section) => section.opSpans).find((span) => {
            if (span.op.kind !== "selectWavetable") return false;
            const selectionFrame = span.startFrame
                + Math.ceil((span.endFrame - span.startFrame) * 0.22);
            return frame >= selectionFrame && frame < span.endFrame;
        });
        OSCILLATOR_IDS.forEach((oscillator, oscillatorIndex) => {
            const tableIndex = Math.max(
                0,
                Math.trunc(Number(state.parameters[`osc${oscillator}WavetableSelect`]) || 0),
            );
            if (
                loadingSpan?.op.kind === "selectWavetable"
                && loadingSpan.op.osc === oscillator
            ) {
                const activeTableIndex = Math.max(0, this.tableIndices[oscillatorIndex] < 0
                    ? tableIndex
                    : this.tableIndices[oscillatorIndex]);
                this.setRuntimeState(loadingRuntimeState(
                    oscillatorIndex,
                    activeTableIndex,
                    loadingSpan.op.tableIndex,
                ));
                return;
            }
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
