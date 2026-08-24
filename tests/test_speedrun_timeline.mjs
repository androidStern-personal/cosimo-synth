import assert from "node:assert/strict";
import test from "node:test";

import {
    barePatchFromDefaults,
    createCurrentSpeedrunContext,
    loadSpeedrunModules,
    readFactoryCatalog,
    readSpeedrunFixture,
} from "./helpers/speedrun_test_context.mjs";

async function timelineFixture() {
    const [modules, context, lane, catalog] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
        readFactoryCatalog(),
    ]);
    const modulation = {
        ...context.defaults.modulation,
        routes: [{
            id: "timeline-env-filter",
            enabled: true,
            sourceKind: "env",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 1.5,
            reducer: "max",
        }],
    };
    const intake = modules.patchIO.intakePatch(barePatchFromDefaults(context.defaults, {
        lane,
        modulation,
        parameters: {
            oscAWavetablePosition: 0.5,
            oscBMute: 1,
            oscCMute: 1,
            env1Attack: 0.08,
            filterCutoff: 800,
        },
    }), context.options);
    assert.equal(intake.ok, true, intake.error?.message);
    const analysis = modules.analyzer.analyzePatch(intake.value.document, intake.value.defaults);
    const recipe = modules.recipe.compileRecipe(analysis, intake.value.document, intake.value.defaults, catalog);
    return { ...modules, recipe };
}

test("timeline is the exact 30fps / 48kHz frame-to-sample authority", async () => {
    const { timeline, recipe } = await timelineFixture();
    const assembled = timeline.assembleTimeline(recipe);

    assert.equal(assembled.fps, 30);
    assert.equal(assembled.sampleRate, 48_000);
    assert.equal(assembled.samplesPerFrame, 1_600);
    assert.equal(assembled.compressionLevel, 0);
    assert.ok(assembled.sections.every((section) => section.endFrame - section.startFrame >= 105));
    assert.ok(assembled.sections.every((section) => section.startSample === section.startFrame * 1_600));
    assert.ok(assembled.sections.every((section) => section.endSample === section.endFrame * 1_600));
    assert.ok(assembled.sections.every((section) => section.opSpans.every((span) => (
        Number.isInteger(span.startFrame) && Number.isInteger(span.endFrame) && span.endFrame >= span.startFrame
    ))));
    // Perception floor: at natural pacing every visible op is on screen for at
    // least 0.4s (rapid) and non-rapid gestures for at least 0.8s.
    assert.ok(assembled.sections.every((section) => section.opSpans.every((span) => {
        if (span.op.kind === "installLaneBaseline" || span.op.kind === "installModulationBaseline") return true;
        const rapid = (span.op.kind === "setParam" || span.op.kind === "setLaneParam")
            && span.op.weight === "rapid";
        return span.endFrame - span.startFrame >= (rapid ? 12 : 24);
    })));

    const source = assembled.sections.find((section) => section.section.kind === "source");
    const oscillator = assembled.sections.find((section) => section.section.kind === "oscillator");
    assert.equal(source.checkpointIndex, -1);
    assert.equal(oscillator.checkpointIndex, assembled.sections.indexOf(oscillator));
    assert.deepEqual(
        source.captionEvents.map((event) => event.atFrame - source.startFrame),
        source.captionEvents.map((_, index) => 24 + index * 12),
    );
    assert.equal(JSON.stringify(timeline.assembleTimeline(recipe)), JSON.stringify(assembled));
});

test("long recipes compress deterministically to the 90-second ceiling", async () => {
    const { timeline, recipe } = await timelineFixture();
    const sourceSection = recipe.sections.find((section) => section.kind === "effect") ?? recipe.sections[0];
    const manySections = Array.from({ length: 80 }, (_, index) => ({
        ...sourceSection,
        id: `stress-${index}`,
        ops: [
            ...sourceSection.ops,
            ...Array.from({ length: 18 }, (__, opIndex) => ({
                kind: "setParam",
                endpointID: "ampRelease",
                from: 0.2,
                to: 0.2 + opIndex * 0.01,
                surface: "stress",
                weight: opIndex >= 7 ? "rapid" : "normal",
            })),
        ],
        allCaptions: Array.from({ length: 20 }, (__, line) => `Line ${line}`),
        captions: [...Array.from({ length: 7 }, (__, line) => `Line ${line}`), "…+13 more"],
        opCaptionLines: [
            ...sourceSection.ops.map(() => null),
            ...Array.from({ length: 18 }, (__, line) => Math.min(line, 7)),
        ],
    }));
    const longRecipe = { ...recipe, sections: manySections };
    const assembled = timeline.assembleTimeline(longRecipe);

    assert.ok(assembled.compressionLevel > 0);
    assert.ok(assembled.durationInFrames <= 2_700);
    assert.equal(assembled.sections.at(-1).endFrame, assembled.durationInFrames);
    assert.equal(JSON.stringify(timeline.assembleTimeline(longRecipe)), JSON.stringify(assembled));
});
