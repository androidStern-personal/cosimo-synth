import test from "node:test";
import assert from "node:assert/strict";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const { TALK_BOX_FORMANTS_HZ, TALK_BOX_VOWELS, resolveTalkBoxFormants } = await loadUIModule(
    process.cwd(),
    "fx/seqfx/view/talk-box-contract.ts",
);

test("Talk Box owns the five documented vowel labels and Peterson-Barney F1/F2 targets", () => {
    assert.deepEqual(TALK_BOX_VOWELS, ["A", "E", "I", "O", "U"]);
    assert.deepEqual(TALK_BOX_FORMANTS_HZ, [
        { firstHz: 730, secondHz: 1_090 },
        { firstHz: 530, secondHz: 1_840 },
        { firstHz: 270, secondHz: 2_290 },
        { firstHz: 570, secondHz: 840 },
        { firstHz: 300, secondHz: 870 },
    ]);
});

test("Talk Box morph interpolates formants logarithmically and clamps public inputs", () => {
    const midpoint = resolveTalkBoxFormants(0, 2, 0.5);
    assert.ok(Math.abs(midpoint.firstHz - Math.sqrt(730 * 270)) < 1e-9);
    assert.ok(Math.abs(midpoint.secondHz - Math.sqrt(1_090 * 2_290)) < 1e-9);
    assert.deepEqual(resolveTalkBoxFormants(-20, 99, -1), TALK_BOX_FORMANTS_HZ[0]);
});
