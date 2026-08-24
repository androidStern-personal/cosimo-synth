import assert from "node:assert/strict";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";
import {
    buildMaximalCurrentSpeedrunPatch,
    createCurrentSpeedrunContext,
    loadSpeedrunModules,
    readFactoryCatalog,
    repoRoot,
} from "./helpers/speedrun_test_context.mjs";

let fixturePromise;

function maximalFixture() {
    fixturePromise ??= buildFixture();
    return fixturePromise;
}

async function buildFixture() {
    const [modules, context, catalog, maximal, patchInput, share] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readFactoryCatalog(),
        buildMaximalCurrentSpeedrunPatch(),
        loadUIModule(repoRoot, "ui/speedrun/studio/patch-input.ts"),
        loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
    ]);
    const intake = modules.patchIO.intakePatch(maximal.patch, context.options);
    assert.equal(intake.ok, true, intake.error?.message);
    const analysis = modules.analyzer.analyzePatch(intake.value.document, intake.value.defaults);
    const recipe = modules.recipe.compileRecipe(
        analysis,
        intake.value.document,
        intake.value.defaults,
        catalog,
    );
    return { modules, context, maximal, patchInput, share, intake, analysis, recipe };
}

test("the maximal current patch deterministically compresses to the configured video ceiling", async () => {
    const { modules, maximal, intake, analysis, recipe } = await maximalFixture();
    assert.equal(analysis.oscillators.length, maximal.expected.oscillatorCount);
    assert.equal(analysis.effects.length, maximal.expected.effectCount);
    assert.equal(analysis.sources.length, maximal.expected.sourceCount);
    assert.equal(analysis.demonstratedRouteIds.size, maximal.expected.routeCount);
    assert.equal(Object.keys(intake.value.document.parameters).length, maximal.expected.parameterCount);

    const uncompressed = modules.timeline.assembleTimeline(recipe, {
        maxDurationInFrames: 1_000_000,
    });
    const defaultCeiling = modules.timeline.assembleTimeline(recipe);
    const shortCeiling = modules.timeline.assembleTimeline(recipe, {
        maxDurationInFrames: 30 * 30,
    });

    assert.equal(uncompressed.compressionLevel, 0);
    assert.ok(uncompressed.durationInFrames > 2_700);
    assert.equal(defaultCeiling.durationInFrames, 2_700);
    assert.equal(defaultCeiling.compressionLevel, 3);
    assert.equal(shortCeiling.durationInFrames, 900);
    assert.equal(shortCeiling.compressionLevel, 3);
    for (const compressed of [defaultCeiling, shortCeiling]) {
        assert.equal(compressed.sections.length, recipe.sections.length);
        assert.equal(compressed.sections.at(-1).endFrame, compressed.durationInFrames);
        assert.ok(compressed.sections.every((section) => section.endFrame > section.startFrame));
        assert.ok(compressed.sections.every((section) => (
            section.startSample === section.startFrame * 1_600
            && section.endSample === section.endFrame * 1_600
        )));
        assert.equal(
            JSON.stringify(modules.timeline.assembleTimeline(recipe, {
                maxDurationInFrames: compressed.durationInFrames,
            })),
            JSON.stringify(compressed),
        );
    }

    console.log(`# ${JSON.stringify({
        maximalVideoPacing: {
            parameters: maximal.expected.parameterCount,
            routes: maximal.expected.routeCount,
            effects: maximal.expected.effectCount,
            sources: maximal.expected.sourceCount,
            oscillators: maximal.expected.oscillatorCount,
            sections: recipe.sections.length,
            operations: recipe.sections.reduce((sum, section) => sum + section.ops.length, 0),
            uncompressedFrames: uncompressed.durationInFrames,
            compressedFrames: defaultCeiling.durationInFrames,
            compressionLevel: defaultCeiling.compressionLevel,
        },
    })}`);
});

test("maximal-patch URL compression independently enforces the copy limit", async () => {
    const { context, patchInput, share, intake } = await maximalFixture();
    const runtime = {
        intakeOptions: context.options,
        webRootURL: new URL("https://cosimo.test/app/"),
    };
    const envelope = patchInput.createStudioShareEnvelope(intake.value.document, runtime);
    const rawBytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
    const fragment = await share.encodeSoundShareFragment(envelope);
    assert.equal(fragment.ok, true, fragment.error?.message);
    const candidateURL = new URL(runtime.webRootURL);
    candidateURL.hash = fragment.value.slice(1);
    const link = await patchInput.createStudioShareLink(intake.value.document, runtime);

    assert.ok(fragment.value.length < rawBytes * 0.2, `${fragment.value.length}/${rawBytes}`);
    assert.ok(candidateURL.href.length > share.SOUND_SHARE_URL_MAX_LENGTH, candidateURL.href.length);
    assert.equal(link._tag, "unavailable");
    assert.equal(link.code, "URLTooLong");
    assert.match(link.message, /links over 8,000 cannot be copied/u);

    console.log(`# ${JSON.stringify({
        maximalShareURL: {
            rawBytes,
            compressedURLCharacters: candidateURL.href.length,
            policy: link.code,
        },
    })}`);
});
