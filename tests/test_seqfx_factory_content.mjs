import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definitionModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-effect-definitions.ts");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const factoryModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-factory-content.ts");

const {
    SEQFX_SELECTABLE_EFFECT_IDS,
    getSeqFxEffectDefinition,
} = definitionModule;
const {
    createDefaultSeqFxState,
    getSeqFxLaneBlocks,
} = stateModule;
const {
    SEQFX_FACTORY_PATTERNS,
    applySeqFxFactoryPattern,
    applySeqFxSafeLoopVariation,
} = factoryModule;

test("every selectable SeqFX effect owns three unique bounded factory presets", () => {
    assert.equal(SEQFX_SELECTABLE_EFFECT_IDS.length, 12);

    for (const effectType of SEQFX_SELECTABLE_EFFECT_IDS) {
        const definition = getSeqFxEffectDefinition(effectType);
        assert.equal(definition.factoryPresets.length, 3, `${definition.name} should expose exactly three curated starting points`);
        assert.equal(new Set(definition.factoryPresets.map((preset) => preset.id)).size, 3);
        assert.equal(new Set(definition.factoryPresets.map((preset) => preset.name)).size, 3);

        for (const preset of definition.factoryPresets) {
            assert.match(preset.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            assert.ok(preset.name.length > 3);
            assert.ok(preset.description.length > 12);
            assert.ok(preset.mix >= 0 && preset.mix <= 1);
            assert.equal(preset.params.length, definition.parameters.length);
            for (const [paramIndex, value] of preset.params.entries()) {
                const parameter = definition.parameters[paramIndex];
                assert.ok(Number.isFinite(value));
                assert.ok(value >= parameter.min && value <= parameter.max, `${definition.name}/${preset.name}/${parameter.label} is out of range`);
                if (parameter.integer) {
                    assert.equal(Number.isInteger(value), true, `${definition.name}/${preset.name}/${parameter.label} must be integral`);
                }
            }
        }
    }
});

test("twelve full factory patterns are valid, non-overlapping, and demonstrate every effect", () => {
    assert.equal(SEQFX_FACTORY_PATTERNS.length, 12);
    assert.equal(new Set(SEQFX_FACTORY_PATTERNS.map((pattern) => pattern.id)).size, 12);
    assert.equal(new Set(SEQFX_FACTORY_PATTERNS.map((pattern) => pattern.name)).size, 12);
    assert.deepEqual(
        new Set(SEQFX_FACTORY_PATTERNS.map((pattern) => pattern.category)),
        new Set(["Bass", "Drums", "Harmony", "Showcase", "Subtle", "Transitions", "Vocals"]),
    );

    const demonstratedEffects = new Set();
    for (const factoryPattern of SEQFX_FACTORY_PATTERNS) {
        const applied = applySeqFxFactoryPattern(createDefaultSeqFxState(), 0, factoryPattern);
        const actualBlocks = applied.patterns[0].lanes.flatMap((lane, laneIndex) => (
            getSeqFxLaneBlocks(applied.patterns[0], laneIndex)
        ));
        assert.equal(actualBlocks.length, factoryPattern.blocks.length, factoryPattern.name);

        for (const recipeBlock of factoryPattern.blocks) {
            demonstratedEffects.add(recipeBlock.effectType);
            assert.ok(recipeBlock.lane >= 0 && recipeBlock.lane < 4);
            assert.ok(recipeBlock.startStep >= 0 && recipeBlock.startStep + recipeBlock.length <= 32);
            const preset = getSeqFxEffectDefinition(recipeBlock.effectType).factoryPresets.find((candidate) => (
                candidate.id === recipeBlock.presetId
            ));
            assert.ok(preset, `${factoryPattern.name} references missing preset ${recipeBlock.presetId}`);
            const actual = actualBlocks.find((candidate) => (
                candidate.lane === recipeBlock.lane && candidate.startStep === recipeBlock.startStep
            ));
            assert.ok(actual, `${factoryPattern.name} is missing a rendered block at lane ${recipeBlock.lane}, step ${recipeBlock.startStep}`);
            assert.equal(actual.effectType, recipeBlock.effectType);
            const step = applied.patterns[0].lanes[recipeBlock.lane].steps[recipeBlock.startStep];
            assert.equal(step.mix, preset.mix);
            assert.deepEqual(step.params.slice(0, preset.params.length), [...preset.params]);
        }
    }

    assert.deepEqual([...demonstratedEffects].sort((left, right) => left - right), [...SEQFX_SELECTABLE_EFFECT_IDS]);
});

test("safe loop variation preserves timing and effect identity while using only factory values", () => {
    const factoryPattern = SEQFX_FACTORY_PATTERNS.find((pattern) => pattern.id === "twelve-effect-tour");
    assert.ok(factoryPattern);
    const original = applySeqFxFactoryPattern(createDefaultSeqFxState(), 0, factoryPattern);
    const varied = applySeqFxSafeLoopVariation(original, { patternIndex: 0, startStep: 0, length: 32 }, 1);

    for (let lane = 0; lane < 4; lane += 1) {
        const originalBlocks = getSeqFxLaneBlocks(original.patterns[0], lane);
        const variedBlocks = getSeqFxLaneBlocks(varied.patterns[0], lane);
        assert.deepEqual(
            variedBlocks.map(({ startStep, length, effectType }) => ({ startStep, length, effectType })),
            originalBlocks.map(({ startStep, length, effectType }) => ({ startStep, length, effectType })),
        );
        for (const block of variedBlocks) {
            const step = varied.patterns[0].lanes[lane].steps[block.startStep];
            const definition = getSeqFxEffectDefinition(block.effectType);
            assert.ok(definition.factoryPresets.some((preset) => (
                preset.mix === step.mix
                && preset.params.every((value, paramIndex) => value === step.params[paramIndex])
            )));
        }
    }
});
