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
import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import type { NotePerformance } from "../midi/performance-events";
import type {
    SpeedrunTelemetryEndpointID,
    SpeedrunTelemetryTrack,
} from "../audio/telemetry";
import {
    buildScriptedMidiEvents,
    scriptedPatchStateAtFrame,
} from "../scripted/scripted-state";

function numberField(value: unknown, key: string, fallback = 0) {
    if (!value || typeof value !== "object") return fallback;
    const next = Number(Reflect.get(value, key));
    return Number.isFinite(next) ? next : fallback;
}

function activeRuntimeState(oscillatorIndex: number, tableIndex: number) {
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

/**
 * The live-performance connection: recipe frame state, recorded engine
 * telemetry, and performance MIDI published on the performance clock — and
 * nothing else. Unlike the frame-stepped ScriptedPatchConnection it does NOT
 * override the mock's wall-clock behaviors: the performance runs in real
 * time, so the product's own wavetable loading→active choreography (driven by
 * the director's real gesture on the real select control) is the choreography.
 */
const LIVE_WAVETABLE_ACTIVATION_DELAY_MS = 700;

export class LiveScriptedConnection extends MockPatchConnection {
    private readonly resourceBaseURL: URL;
    private readonly telemetryByFrame = new Map<number, Readonly<Record<string, unknown>>>();
    private readonly midiByFrame = new Map<number, number[]>();
    private readonly publishedParameterValues = new Map<string, number>();
    private readonly storedValues = new Map<string, string>();
    private readonly oscillatorRuntime: Array<ReturnType<typeof activeRuntimeState>> = [
        activeRuntimeState(0, 0),
        activeRuntimeState(1, 0),
        activeRuntimeState(2, 0),
    ];
    private readonly oscillatorActivationTimers: Array<number | null> = [null, null, null];
    private latestFrame = -1;

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
     * The patch loads with its oscillators' tables already active, exactly as
     * a real plugin boot leaves them. Called once after the view has mounted
     * and subscribed.
     */
    primeInitialRuntimeState() {
        OSCILLATOR_IDS.forEach((oscillator, oscillatorIndex) => {
            const tableIndex = Math.max(
                0,
                Math.trunc(Number(this.defaults.parameters[`osc${oscillator}WavetableSelect`]) || 0),
            );
            this.oscillatorRuntime[oscillatorIndex] = activeRuntimeState(oscillatorIndex, tableIndex);
        });
        this.emitOscillatorRuntime();
    }

    /**
     * The shared harness mock models wavetable activation for a single
     * oscillator (its state machine is keyed to oscillator A and one merged
     * runtime record), which a three-oscillator live performance cannot use.
     * Suppress its timer and run the same loading→active choreography per
     * oscillator on real wall-clock timers, from the same product write.
     */
    protected override scheduleWavetableActivation() {
        this.cancelScheduledWavetableActivation();
    }

    override sendEventOrValue(endpointID: string, value: unknown) {
        super.sendEventOrValue(endpointID, value);
        const selected = /^osc([ABC])WavetableSelect$/u.exec(endpointID);
        if (!selected) return;
        const oscillatorIndex = "ABC".indexOf(selected[1]);
        const tableIndex = Math.max(0, Math.trunc(Number(value) || 0));
        const previous = this.oscillatorRuntime[oscillatorIndex];
        const existingTimer = this.oscillatorActivationTimers[oscillatorIndex];
        if (existingTimer !== null) window.clearTimeout(existingTimer);
        if (previous.hasActive && previous.activeTableIndex === tableIndex && !previous.hasLoading) {
            this.emitOscillatorRuntime();
            return;
        }
        const generation = Math.max(previous.activeGeneration, previous.loadingGeneration) + 1;
        this.oscillatorRuntime[oscillatorIndex] = {
            ...previous,
            desiredTableIndex: tableIndex,
            desiredIntentSerial: previous.desiredIntentSerial + 1,
            hasLoading: true,
            loadingTableIndex: tableIndex,
            loadingGeneration: generation,
            hasFailure: false,
        };
        this.emitOscillatorRuntime();
        this.oscillatorActivationTimers[oscillatorIndex] = window.setTimeout(() => {
            this.oscillatorActivationTimers[oscillatorIndex] = null;
            this.oscillatorRuntime[oscillatorIndex] = {
                ...activeRuntimeState(oscillatorIndex, tableIndex),
                desiredIntentSerial: this.oscillatorRuntime[oscillatorIndex].desiredIntentSerial,
                activeGeneration: generation,
            };
            this.emitOscillatorRuntime();
        }, LIVE_WAVETABLE_ACTIVATION_DELAY_MS);
    }

    /** Re-emit every oscillator's runtime record so any transient emission
        from the shared mock's single-state flow is immediately corrected. */
    private emitOscillatorRuntime() {
        for (const state of this.oscillatorRuntime) {
            this.setRuntimeState(state);
        }
    }

    /**
     * Publish everything due at the given timeline frame. Forward-only; a
     * pump that skipped frames (a slow rAF) publishes all missed telemetry
     * and MIDI so no note or playback-graphics event is dropped.
     */
    publishFrame(requestedFrame: number) {
        const frame = Math.min(
            Math.max(0, Math.floor(requestedFrame)),
            Math.max(0, this.timeline.durationInFrames - 1),
        );
        if (frame <= this.latestFrame) return;

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

        for (let dueFrame = this.latestFrame + 1; dueFrame <= frame; dueFrame += 1) {
            const events = this.telemetryByFrame.get(dueFrame) ?? {};
            for (const [endpointID, value] of Object.entries(events)) {
                this.publishTelemetry(endpointID as SpeedrunTelemetryEndpointID, value);
            }
            for (const code of this.midiByFrame.get(dueFrame) ?? []) {
                this.sendMIDIInputEvent("midiIn", code);
            }
        }
        this.latestFrame = frame;
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
            default:
                return;
        }
    }
}
