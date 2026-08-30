import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definitionsModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-effect-definitions.ts");

const {
    SEQFX_EFFECT_DEFINITIONS,
    SEQFX_EFFECT_TYPES,
    SEQFX_PARAM_COUNT,
    SEQFX_SELECTABLE_EFFECT_IDS,
    getSeqFxDefaultParams,
    getSeqFxEffectDefinition,
    getSeqFxParamLimits,
} = definitionsModule;

test("seqfx effect IDs are append-only and cover the requested sequenced effects", () => {
    assert.deepEqual(SEQFX_EFFECT_TYPES, {
        empty: 0,
        filter: 1,
        crusher: 2,
        tapeStop: 3,
        stutter: 4,
        pitch: 5,
        comb: 6,
        ring: 7,
        reverse: 8,
        talkBox: 9,
        vibro: 10,
        flange: 11,
        dirty: 12,
    });
    assert.deepEqual(SEQFX_SELECTABLE_EFFECT_IDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(
        SEQFX_SELECTABLE_EFFECT_IDS.map((id) => getSeqFxEffectDefinition(id).name),
        ["Filter", "Crush", "Tape Stop", "Stutter", "Pitch", "Comb", "Ring", "Reverse", "Talk Box", "Vibro", "Flange", "Dirty"],
    );
});

test("every selectable effect has one coherent parameter vector and public identity", () => {
    for (const definition of SEQFX_EFFECT_DEFINITIONS) {
        assert.equal(getSeqFxEffectDefinition(definition.id), definition);
        assert.equal(getSeqFxDefaultParams(definition.id).length, SEQFX_PARAM_COUNT);
        if (definition.id !== SEQFX_EFFECT_TYPES.empty) {
            assert.match(definition.name, /\S/);
            assert.match(definition.shortName, /\S/);
            assert.match(definition.fontaudioIcon, /^fad-/);
        }

        definition.parameters.forEach((parameter, index) => {
            assert.ok(parameter.min <= parameter.defaultValue);
            assert.ok(parameter.defaultValue <= parameter.max);
            assert.deepEqual(getSeqFxParamLimits(definition.id, index), [parameter.min, parameter.max]);
        });
    }
});

test("Crush keeps persisted ID 2 while adopting the requested display name", () => {
    const crush = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.crusher);
    assert.equal(crush.id, 2);
    assert.equal(crush.key, "crush");
    assert.equal(crush.name, "Crush");
});
