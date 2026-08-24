import { createEmptyArticulationsState } from "../../../ui/shared/articulation-image";
import { createDefaultLaneStateV2 } from "../../../ui/shared/lane-state-v2";
import { createDefaultModulationState } from "../../../ui/shared/modulation";
import { buildCumulativeStates } from "../../../ui/speedrun/partial-states";
import type { DefaultsSnapshot } from "../../../ui/speedrun/patch-io";
import type { SpeedrunRecipe, UIOp } from "../../../ui/speedrun/recipe";
import { runLiveVideoSession } from "../../../ui/speedrun/live/live-session";
import { assembleTimeline } from "../../../ui/speedrun/timeline";
import fixtureRecipeJson from "./effects-lane-recipe.golden.json";

const recipe = fixtureRecipeJson as unknown as SpeedrunRecipe;
const timeline = assembleTimeline(recipe);

function opParameterDefaults(op: UIOp): ReadonlyArray<readonly [string, number]> {
    switch (op.kind) {
        case "setParam": return [[op.endpointID, op.from]];
        case "selectWavetable": return [[`osc${op.osc}WavetableSelect`, 0]];
        case "configureMseg": return [
            [`mseg${op.slot}Rate`, 1],
            [`mseg${op.slot}Morph`, 0],
        ];
        case "setEnvelope": return [
            [`env${op.slot}Attack`, 0.01],
            [`env${op.slot}Decay`, 0.2],
            [`env${op.slot}Sustain`, 0.8],
            [`env${op.slot}Release`, 0.4],
        ];
        case "setMacro": return [[`macro${op.slot}`, 0]];
        default: return [];
    }
}

function defaultsFor(targetRecipe: SpeedrunRecipe): DefaultsSnapshot {
    return {
        contractHash: targetRecipe.contractHash,
        parameters: {
            oscAMute: 1,
            oscBMute: 1,
            oscCMute: 1,
            filterMode: 1,
            filterCutoff: 1_000,
            filterQ: 0.707107,
            filterMix: 1,
            ...Object.fromEntries(
                [...targetRecipe.prelude, ...targetRecipe.sections.flatMap((section) => section.ops)]
                    .flatMap(opParameterDefaults),
            ),
        },
        annotations: {},
        modulation: createDefaultModulationState(),
        lane: createDefaultLaneStateV2(),
        articulations: createEmptyArticulationsState(),
    };
}

const defaults = defaultsFor(recipe);
const states = buildCumulativeStates(defaults, recipe);
const performance = {
    durationSec: 2,
    events: [
        { atSec: 0, code: (0x90 << 16) | (48 << 8) | 100 },
        { atSec: 0.9, code: (0x80 << 16) | (48 << 8) },
        { atSec: 1.1, code: (0x90 << 16) | (55 << 8) | 88 },
        { atSec: 1.9, code: (0x80 << 16) | (55 << 8) },
    ],
};

/** Synthetic per-frame engine telemetry rich enough that the playback
    graphics (wavetable sweep, filter motion, MSEG playheads, source lights)
    visibly animate during review renders that have no engine audio. */
function syntheticTelemetry() {
    const frames = [];
    const firstAudible = timeline.sections.find((section) => section.checkpointIndex >= 0);
    const start = firstAudible?.startFrame ?? 0;
    for (let frame = start; frame < timeline.durationInFrames; frame += 1) {
        const seconds = frame / timeline.fps;
        frames.push({
            frame,
            events: {
                effectiveWavetablePosition: {
                    voiceGeneration: 1,
                    position: 0.5 + (0.45 * Math.sin(seconds * 1.7)),
                },
                effectiveFilterState: {
                    voiceGeneration: 1,
                    hasActive: 1,
                    mode: 1,
                    cutoffHz: 900 + (700 * (1 + Math.sin(seconds * 1.1))),
                    q: 1.4,
                },
                effectiveMsegState: {
                    voiceGeneration: 1,
                    hasActive: 1,
                    positions: [(seconds * 0.61) % 1, (seconds * 0.37) % 1, (seconds * 0.23) % 1],
                },
                effectiveModSourceState: {
                    voiceGeneration: 1,
                    hasActive: 1,
                    values: Array.from({ length: 9 }, (_, index) => (
                        0.5 + (0.5 * Math.sin((seconds * (0.6 + (index * 0.13))) + index))
                    )),
                },
            },
        });
    }
    return { fps: timeline.fps, durationInFrames: timeline.durationInFrames, frames };
}

async function start(options: { startAtSeconds?: number; endAtSeconds?: number } = {}) {
    const controller = new AbortController();
    const endAt = options.endAtSeconds;
    let lastFrame = -1;
    const startedAt = globalThis.performance.now();
    const result = await runLiveVideoSession({
        defaults,
        recipe,
        timeline,
        states,
        performance,
        telemetry: syntheticTelemetry(),
        patchLabel: recipe.label,
        resourceBaseURL: new URL("/", location.href).href,
        masterAudioUrl: null,
        record: false,
        startAtSeconds: options.startAtSeconds,
        signal: controller.signal,
        onProgress: ({ frame }) => {
            lastFrame = frame;
            document.title = `live review ${frame}/${timeline.durationInFrames}`;
            if (endAt !== undefined && frame >= endAt * timeline.fps) {
                controller.abort();
            }
        },
    }, {
        moduleURL: new URL("/video-bounce/index.js", location.href).href,
    }).catch((error) => {
        if (endAt !== undefined && error instanceof DOMException && error.name === "AbortError") {
            return { blob: null, mimeType: null, report: null };
        }
        throw error;
    });
    return {
        report: result.report,
        lastFrame,
        durationInFrames: timeline.durationInFrames,
        fps: timeline.fps,
        elapsedMilliseconds: Math.round(globalThis.performance.now() - startedAt),
    };
}

declare global {
    interface Window {
        __COSIMO_LIVE_REVIEW__?: {
            readonly durationInFrames: number;
            readonly fps: number;
            start(options?: { startAtSeconds?: number; endAtSeconds?: number }): ReturnType<typeof start>;
        };
    }
}

window.__COSIMO_LIVE_REVIEW__ = {
    durationInFrames: timeline.durationInFrames,
    fps: timeline.fps,
    start,
};
const status = document.querySelector("#status");
if (status) status.textContent = `Live review harness ready (${timeline.durationInFrames} frames)`;
