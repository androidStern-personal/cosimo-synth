import { clamp01, mix } from "../easing";
import { buildPerformanceSampleEvents, type NotePerformance } from "../midi/performance-events";
import {
    applySpeedrunOp,
    type CumulativePatchState,
} from "../partial-states";
import type { DefaultsSnapshot } from "../patch-io";
import type { SpeedrunRecipe, UIOp } from "../recipe";
import {
    SPEEDRUN_SAMPLES_PER_FRAME,
    type SpeedrunTimeline,
    type TimedOp,
} from "../timeline";

export type ScriptedMidiEvent = {
    readonly frame: number;
    readonly code: number;
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

