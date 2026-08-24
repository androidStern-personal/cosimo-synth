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

const hardeningDigestFrames = Array.from(
    { length: Math.ceil(timeline.durationInFrames / 30) },
    (_, index) => index * 30,
).filter((frame) => frame < timeline.durationInFrames);

function slimInspection(inspection: {
    readonly frame: number;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly scaffoldHitTestable: boolean;
    readonly canvasCount: number;
    readonly svgCount: number;
    readonly keyboardNoteCount: number;
    readonly keyboardActiveNoteCount: number;
}) {
    return {
        frame: inspection.frame,
        viewport: inspection.viewport,
        scaffoldHitTestable: inspection.scaffoldHitTestable,
        canvasCount: inspection.canvasCount,
        svgCount: inspection.svgCount,
        keyboardNoteCount: inspection.keyboardNoteCount,
        keyboardActiveNoteCount: inspection.keyboardActiveNoteCount,
    };
}

async function renderHardeningOnce() {
    const startedAt = globalThis.performance.now();
    const result = await renderScriptedVideoInIframe({
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
        digestFrames: hardeningDigestFrames,
        pixelProbeFrames: hardeningDigestFrames,
        contactSheetFrames: hardeningDigestFrames,
    }, {
        moduleURL: new URL("/video-bounce/index.js", location.href).href,
    });
    const finalInspection = result.inspections.at(-1) ?? null;
    return {
        blobBytes: result.blob.size,
        blobType: result.blob.type,
        digests: result.preencodeDigests,
        pixelProbes: result.pixelProbes,
        contactSheet: result.contactSheet,
        iframeRafMode: result.iframeRafMode,
        inspectedFrames: result.inspections.length,
        inspections: result.inspections.map(slimInspection),
        missedOps: finalInspection?.interaction.missedOps ?? null,
        elapsedMilliseconds: Math.round(globalThis.performance.now() - startedAt),
    };
}

async function renderHardeningTwice() {
    return {
        firstFrame,
        durationInFrames: timeline.durationInFrames,
        digestFrames: hardeningDigestFrames,
        first: await renderHardeningOnce(),
        second: await renderHardeningOnce(),
    };
}

const gestureModulation = createDefaultModulationState();
const gestureMseg = structuredClone(gestureModulation.msegSlots[0]);
gestureMseg.shapeA = {
    ...gestureMseg.shapeA,
    name: "M2 Motion",
    points: [
        { x: 0, y: 0, curvePower: 0 },
        { x: 0.42, y: 0.86, curvePower: 2.4 },
        { x: 1, y: 0.24, curvePower: -1.8 },
    ],
};
gestureMseg.shapeB = {
    ...gestureMseg.shapeB,
    name: "M2 Motion B",
    points: [
        { x: 0, y: 0.18, curvePower: 0 },
        { x: 0.68, y: 0.36, curvePower: -2.2 },
        { x: 1, y: 1, curvePower: 0 },
    ],
};
const gestureRecipe: SpeedrunRecipe = {
    ...recipe,
    label: "M2 scripted gesture gate",
    sections: [
        {
            id: "source-mseg-1",
            kind: "source",
            title: "MSEG 1",
            ops: [
                { kind: "navigate", to: { tab: "mod", sourceId: "mseg-1" } },
                {
                    kind: "configureMseg",
                    slot: 1,
                    state: gestureMseg,
                    rate: 0.64,
                    morph: 0.58,
                },
            ],
            captions: ["MSEG 1 shape and playback"],
            allCaptions: ["MSEG 1 shape and playback"],
            opCaptionLines: [null, 0],
        },
        ...recipe.sections,
    ],
};
const gestureTimeline = assembleTimeline(gestureRecipe);
const gestureDefaults = defaultsFor(gestureRecipe);
const gestureStates = buildCumulativeStates(gestureDefaults, gestureRecipe);
const gestureTelemetry = {
    fps: gestureTimeline.fps,
    durationInFrames: gestureTimeline.durationInFrames,
    frames: [],
};

function gestureSection(id: string) {
    const section = gestureTimeline.sections.find((candidate) => candidate.section.id === id);
    if (!section) throw new Error(`Missing scripted gesture section ${id}.`);
    return section;
}

function lastOp(sectionId: string, predicate: (op: UIOp) => boolean) {
    const span = [...gestureSection(sectionId).opSpans].reverse().find(({ op }) => predicate(op));
    if (!span) throw new Error(`Missing scripted gesture span in ${sectionId}.`);
    return span;
}

const voiceParamSpan = lastOp("oscillator-A", (op) => (
    op.kind === "setParam" && op.endpointID === "oscAWavetablePosition"
));
const macroSpan = lastOp("source-macro-2", (op) => op.kind === "setMacro");

const gestureRanges = [
    {
        name: "sources",
        startFrame: gestureSection("source-mseg-1").startFrame,
        endFrame: lastOp("source-macro-2", (op) => op.kind === "setMacro").endFrame - 1,
    },
    {
        name: "voice",
        startFrame: gestureSection("oscillator-A").startFrame,
        // One frame past the span end so the post-gesture snap frame is
        // rendered and the exact recipe target is assertable on screen.
        endFrame: voiceParamSpan.endFrame + 1,
    },
    {
        name: "filter-map",
        startFrame: gestureSection("voice-filter").startFrame,
        endFrame: lastOp("voice-filter", (op) => op.kind === "mapRoute").endFrame - 1,
    },
    {
        name: "fx-map",
        startFrame: gestureSection("effect-delay#2").startFrame,
        endFrame: lastOp("effect-delay#2", (op) => op.kind === "mapRoute").endFrame - 1,
    },
] as const;

async function renderGestures() {
    const probes = [];
    for (const range of gestureRanges) {
        const probeFrames = Array.from(
            { length: (range.endFrame - range.startFrame) + 1 },
            (_, index) => range.startFrame + index,
        );
        const result = await renderScriptedVideoInIframe({
            defaults: gestureDefaults,
            recipe: gestureRecipe,
            timeline: gestureTimeline,
            states: gestureStates,
            performance,
            telemetry: gestureTelemetry,
            masterAudioUrl: null,
            patchLabel: gestureRecipe.label,
            resourceBaseURL: new URL("/", location.href).href,
            format: SPEEDRUN_WEBM_FORMAT,
            videoBitrate: "very-low",
            frameRange: [range.startFrame, range.endFrame],
            pixelProbeFrames: probeFrames,
        }, {
            moduleURL: new URL("/video-bounce/index.js", location.href).href,
        });
        probes.push({
            ...range,
            blobBytes: result.blob.size,
            iframeRafMode: result.iframeRafMode,
            inspections: result.inspections,
            pixelProbes: result.pixelProbes,
        });
    }
    return {
        durationInFrames: gestureTimeline.durationInFrames,
        expectations: {
            voiceParam: {
                endpointID: "oscAWavetablePosition",
                to: voiceParamSpan.op.kind === "setParam" ? voiceParamSpan.op.to : 0,
                snapFrame: voiceParamSpan.endFrame,
            },
            macro: {
                slot: macroSpan.op.kind === "setMacro" ? macroSpan.op.slot : 0,
                value: macroSpan.op.kind === "setMacro" ? macroSpan.op.value : 0,
            },
        },
        probes,
    };
}

declare global {
    interface Window {
        __COSIMO_SCRIPTED_SESSION_HARNESS__?: {
            readonly firstFrame: number;
            renderHardeningTwice(): ReturnType<typeof renderHardeningTwice>;
            renderGestures(): ReturnType<typeof renderGestures>;
        };
    }
}

window.__COSIMO_SCRIPTED_SESSION_HARNESS__ = {
    firstFrame,
    renderHardeningTwice,
    renderGestures,
};
const status = document.querySelector("#status");
if (status) status.textContent = "Scripted real-UI harness ready";
