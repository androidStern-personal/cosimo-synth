import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const scriptedState = await loadUIModule(repoRoot, "ui/speedrun/scripted/scripted-state.ts");
const performanceEvents = await loadUIModule(repoRoot, "ui/speedrun/midi/performance-events.ts");
const timelineModule = await loadUIModule(repoRoot, "ui/speedrun/timeline.ts");

const { scriptedPatchStateAtFrame, buildScriptedMidiEvents } = scriptedState;
const { buildPerformanceSampleEvents } = performanceEvents;
const { SPEEDRUN_SAMPLES_PER_FRAME, SPEEDRUN_FPS, SPEEDRUN_SAMPLE_RATE } = timelineModule;

const emptyModulation = { routes: [], msegSlots: [], envelopeSlots: [], macroNames: [] };
const emptyLane = { chain: [], devices: {} };

function makeDefaults(parameters = {}) {
    return {
        contractHash: "test",
        parameters,
        annotations: {},
        modulation: structuredClone(emptyModulation),
        lane: structuredClone(emptyLane),
        articulations: { articulations: [], assignments: [] },
    };
}

function makeRecipe(ops) {
    return {
        contractHash: "test",
        label: "unit",
        prelude: [],
        articulations: { articulations: [], assignments: [] },
        sections: [{
            id: "unit-section",
            kind: "oscillator",
            title: "Unit",
            ops,
            captions: [],
            allCaptions: [],
            opCaptionLines: ops.map(() => null),
        }],
    };
}

function makeTimeline(opSpans, durationInFrames) {
    return {
        fps: SPEEDRUN_FPS,
        sampleRate: SPEEDRUN_SAMPLE_RATE,
        samplesPerFrame: SPEEDRUN_SAMPLES_PER_FRAME,
        durationInFrames,
        compressionLevel: 0,
        sections: [{
            section: makeRecipe(opSpans.map(({ op }) => op)).sections[0],
            startFrame: 0,
            endFrame: durationInFrames,
            startSample: 0,
            endSample: durationInFrames * SPEEDRUN_SAMPLES_PER_FRAME,
            captionEvents: [],
            opSpans,
            checkpointIndex: 0,
        }],
    };
}

test("setParam interpolates smoothly and lands exactly on the recipe target", () => {
    const op = {
        kind: "setParam",
        endpointID: "filterCutoff",
        from: 100,
        to: 900,
        surface: "s",
        weight: "normal",
    };
    const spans = [{ op, startFrame: 10, endFrame: 20 }];
    const recipe = makeRecipe([op]);
    const timeline = makeTimeline(spans, 40);
    const defaults = makeDefaults({ filterCutoff: 100 });

    const before = scriptedPatchStateAtFrame(defaults, recipe, timeline, 9);
    assert.equal(before.parameters.filterCutoff, 100);

    const mid = scriptedPatchStateAtFrame(defaults, recipe, timeline, 15);
    assert.ok(mid.parameters.filterCutoff > 100 && mid.parameters.filterCutoff < 900, String(mid.parameters.filterCutoff));

    // Monotonic along the span — this is the visible knob motion.
    let previous = 100;
    for (let frame = 10; frame <= 20; frame += 1) {
        const value = scriptedPatchStateAtFrame(defaults, recipe, timeline, frame).parameters.filterCutoff;
        assert.ok(value >= previous, `frame ${frame}: ${value} < ${previous}`);
        previous = value;
    }

    const after = scriptedPatchStateAtFrame(defaults, recipe, timeline, 20);
    assert.equal(after.parameters.filterCutoff, 900, "span end must snap to the exact target");
});

test("toggleEffect and mapRoute apply only at completed progress (the real UI owns mid-gesture)", () => {
    const toggle = { kind: "toggleEffect", deviceId: "drive#1", effectId: "drive", enabled: true };
    const route = {
        kind: "mapRoute",
        surface: "s",
        route: {
            id: "r1",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 0.4,
            reducer: "max",
        },
    };
    const lane = {
        chain: [{ kind: "device", deviceId: "drive#1", enabled: false }],
        devices: { "drive#1": { params: {} } },
    };
    const spans = [
        { op: toggle, startFrame: 0, endFrame: 10 },
        { op: route, startFrame: 10, endFrame: 20 },
    ];
    const recipe = makeRecipe([toggle, route]);
    const timeline = makeTimeline(spans, 40);
    const defaults = { ...makeDefaults(), lane };

    const midToggle = scriptedPatchStateAtFrame(defaults, recipe, timeline, 5);
    assert.equal(midToggle.lane.chain[0].enabled, false, "mid-span toggle must stay with the real tap");
    const doneToggle = scriptedPatchStateAtFrame(defaults, recipe, timeline, 10);
    assert.equal(doneToggle.lane.chain[0].enabled, true);

    const midRoute = scriptedPatchStateAtFrame(defaults, recipe, timeline, 15);
    assert.equal(midRoute.modulation.routes.length, 0, "mid-span route must stay with the real drop");
    const doneRoute = scriptedPatchStateAtFrame(defaults, recipe, timeline, 20);
    assert.equal(doneRoute.modulation.routes.length, 1);
    assert.equal(doneRoute.modulation.routes[0].amount, 0.4);
});

test("setEnvelope eases from the engine defaults snapshot, not restated literals", () => {
    const op = {
        kind: "setEnvelope",
        slot: 1,
        name: "Pluck",
        attack: 1,
        decay: 1,
        sustain: 0.2,
        release: 1,
    };
    const spans = [{ op, startFrame: 0, endFrame: 100 }];
    const recipe = makeRecipe([op]);
    const timeline = makeTimeline(spans, 120);
    const defaults = makeDefaults({ env1Attack: 0.5, env1Decay: 0.5, env1Sustain: 0.5, env1Release: 0.5 });

    const early = scriptedPatchStateAtFrame(defaults, recipe, timeline, 1);
    assert.ok(
        Math.abs(early.parameters.env1Attack - 0.5) < 0.05,
        `attack should start from the default 0.5, saw ${early.parameters.env1Attack}`,
    );
});

test("video keyboard frames land exactly where the audio render's MIDI lands", () => {
    const performance = {
        durationSec: 0.5,
        events: [
            { atSec: 0, code: (0x90 << 16) | (48 << 8) | 100 },
            { atSec: 0.2, code: (0x80 << 16) | (48 << 8) },
            { atSec: 0.31, code: (0x90 << 16) | (52 << 8) | 90 },
        ],
    };
    const durationInFrames = 60;
    const timeline = makeTimeline([], durationInFrames);

    const videoEvents = buildScriptedMidiEvents(timeline, performance);
    const sectionSamples = durationInFrames * SPEEDRUN_SAMPLES_PER_FRAME;
    const audioEvents = buildPerformanceSampleEvents(performance, sectionSamples, SPEEDRUN_SAMPLE_RATE);

    // The audio/visual sync authority: every audio event maps to the video
    // frame containing its sample, and nothing else appears.
    const expected = audioEvents
        .map(({ sample, code }) => ({ frame: Math.floor(sample / SPEEDRUN_SAMPLES_PER_FRAME), code }))
        .sort((left, right) => left.frame - right.frame || left.code - right.code);
    assert.deepEqual(videoEvents, expected);
    assert.ok(videoEvents.length >= 6, `expected repeated cycles, saw ${videoEvents.length}`);

    // A one-frame offset in either authority breaks this exact equality.
    const offBy = videoEvents.map(({ frame, code }) => ({ frame: frame + 1, code }));
    assert.notDeepEqual(videoEvents, offBy);
});

test("performance events cycle to the section length and reject non-positive durations", () => {
    const performance = { durationSec: 0.25, events: [{ atSec: 0.1, code: 1 }] };
    const events = buildPerformanceSampleEvents(performance, 48_000, 48_000);
    assert.equal(events.length, 4, "0.25s cycle over 1s = 4 events");
    assert.throws(() => buildPerformanceSampleEvents({ durationSec: 0, events: [] }, 100, 48_000));
});
