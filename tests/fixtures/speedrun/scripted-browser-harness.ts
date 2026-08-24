import { createEmptyArticulationsState } from "../../../ui/shared/articulation-image";
import { createDefaultLaneStateV2 } from "../../../ui/shared/lane-state-v2";
import { createDefaultModulationState } from "../../../ui/shared/modulation";
import { buildCumulativeStates } from "../../../ui/speedrun/partial-states";
import type { DefaultsSnapshot } from "../../../ui/speedrun/patch-io";
import type { SpeedrunRecipe, UIOp } from "../../../ui/speedrun/recipe";
import { renderScriptedVideoInIframe } from "../../../ui/speedrun/scripted/iframe-renderer";
import { SPEEDRUN_WEBM_FORMAT } from "../../../ui/speedrun/studio/video-support";
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

const defaults: DefaultsSnapshot = {
    contractHash: recipe.contractHash,
    parameters: {
        oscAMute: 1,
        oscBMute: 1,
        oscCMute: 1,
        filterMode: 1,
        filterCutoff: 1_000,
        filterQ: 0.707107,
        filterMix: 1,
        ...Object.fromEntries(
            [...recipe.prelude, ...recipe.sections.flatMap((section) => section.ops)]
                .flatMap(opParameterDefaults),
        ),
    },
    annotations: {},
    modulation: createDefaultModulationState(),
    lane: createDefaultLaneStateV2(),
    articulations: createEmptyArticulationsState(),
};
const states = buildCumulativeStates(defaults, recipe);
const firstAudible = timeline.sections.find((section) => section.checkpointIndex >= 0);
if (!firstAudible) throw new Error("The scripted fixture has no audible section.");
const firstFrame = firstAudible.startFrame;
const performance = {
    durationSec: 0.5,
    events: [
        { atSec: 0, code: (0x90 << 16) | (48 << 8) | 100 },
        { atSec: 0.2, code: (0x80 << 16) | (48 << 8) },
    ],
};
const telemetry = {
    fps: timeline.fps,
    durationInFrames: timeline.durationInFrames,
    frames: [
        {
            frame: firstFrame,
            events: {
                effectiveWavetablePosition: { voiceGeneration: 1, position: 0.63 },
                effectiveWarpState: { voiceGeneration: 1, hasActive: 1, mode: 1, amount: 0.37 },
                effectiveUnisonState: { voiceGeneration: 1, hasActive: 1, voices: 5, detune: 0.31, blend: 0.72, width: 0.84 },
                effectiveFilterState: { voiceGeneration: 1, hasActive: 1, mode: 1, cutoffHz: 2_600, q: 2.2 },
                effectiveMsegState: { voiceGeneration: 1, hasActive: 1, positions: [0.22, 0.57, 0.81] },
                effectiveModSourceState: { voiceGeneration: 1, hasActive: 1, values: [0.3, 0.7, 0.45, 0.2, 0.8, 0.1, 0.65, 0.4, 0.9] },
            },
        },
        {
            frame: firstFrame + 1,
            events: {
                effectiveWavetablePosition: { voiceGeneration: 1, position: 0.71 },
            },
        },
    ],
};

async function renderOnce() {
    return renderScriptedVideoInIframe({
        defaults,
        recipe,
        timeline,
        states,
        performance,
        telemetry,
        masterAudioUrl: null,
        patchLabel: recipe.label,
        resourceBaseURL: new URL("/", location.href).href,
        format: SPEEDRUN_WEBM_FORMAT,
        videoBitrate: "very-low",
        frameRange: [firstFrame, firstFrame + 2],
        digestFrames: [firstFrame, firstFrame + 1, firstFrame + 2],
    }, {
        moduleURL: new URL("/video-bounce/index.js", location.href).href,
    });
}

async function renderTwice() {
    const first = await renderOnce();
    const second = await renderOnce();
    return {
        firstFrame,
        first: {
            blobBytes: first.blob.size,
            blobType: first.blob.type,
            iframeRafMode: first.iframeRafMode,
            digests: first.preencodeDigests,
            inspections: first.inspections,
        },
        second: {
            blobBytes: second.blob.size,
            blobType: second.blob.type,
            iframeRafMode: second.iframeRafMode,
            digests: second.preencodeDigests,
            inspections: second.inspections,
        },
    };
}

declare global {
    interface Window {
        __COSIMO_SCRIPTED_SESSION_HARNESS__?: {
            readonly firstFrame: number;
            renderTwice(): ReturnType<typeof renderTwice>;
        };
    }
}

window.__COSIMO_SCRIPTED_SESSION_HARNESS__ = { firstFrame, renderTwice };
const status = document.querySelector("#status");
if (status) status.textContent = "Scripted real-UI harness ready";
