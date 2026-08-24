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
    buildScriptedMidiEvents,
    scriptedPatchStateAtFrame,
} from "./scripted-state";
import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import type { NotePerformance } from "../midi/performance-events";
import type {
    SpeedrunTelemetryEndpointID,
    SpeedrunTelemetryTrack,
} from "../audio/telemetry";

export {
    buildScriptedMidiEvents,
    scriptedPatchStateAtFrame,
    type ScriptedMidiEvent,
} from "./scripted-state";

export type ScriptedConnectionFrameSnapshot = {
    readonly frame: number;
    readonly parameterCount: number;
    readonly telemetryEndpoints: ReadonlyArray<string>;
    readonly midiCodes: ReadonlyArray<number>;
};

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
