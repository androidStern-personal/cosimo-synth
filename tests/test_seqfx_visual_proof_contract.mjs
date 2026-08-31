import test from "node:test";
import assert from "node:assert/strict";

import {
    createSeqFxVisualProofContract,
    SEQFX_INTERACTIVE_TARGET_SELECTOR,
    SEQFX_VISUAL_EFFECTS,
    SEQFX_VISUAL_PROOF_SIZES,
    validateSeqFxInspectorDepthCoverage,
    validateSeqFxVisualProofCoverage,
} from "../scripts/seqfx-visual-proof-contract.mjs";

test("SeqFX visual audit includes native, semantic-role, and pointer-only targets", () => {
    assert.match(SEQFX_INTERACTIVE_TARGET_SELECTOR, /button/u);
    assert.match(SEQFX_INTERACTIVE_TARGET_SELECTOR, /\[role='slider'\]/u);
    assert.match(SEQFX_INTERACTIVE_TARGET_SELECTOR, /\[data-pointer-target='true'\]/u);
});

test("SeqFX visual proof contract covers four viewports, twelve effects, two depths, and empty states", () => {
    const contract = createSeqFxVisualProofContract();

    assert.equal(contract.length, 100);
    assert.equal(new Set(contract.map((entry) => entry.file)).size, 100);
    assert.equal(validateSeqFxVisualProofCoverage(contract).length, 0);
    for (const size of SEQFX_VISUAL_PROOF_SIZES) {
        assert.deepEqual(
            contract.filter((entry) => entry.size === size.id && entry.effectId > 0).map((entry) => entry.effectId),
            SEQFX_VISUAL_EFFECTS.flatMap((effect) => [effect.id, effect.id]),
        );
    }
});

test("SeqFX visual proof coverage rejects missing, duplicate, and misidentified states", () => {
    const contract = createSeqFxVisualProofContract();
    const broken = contract.slice(1);
    broken.push({ ...contract[1] });
    broken[1] = { ...broken[1], effectName: "Wrong" };
    broken[2] = { ...broken[2], file: "wrong.png" };

    const failures = validateSeqFxVisualProofCoverage(broken);
    assert.ok(failures.some((failure) => failure.includes("missing visual state default:0:empty")));
    assert.ok(failures.some((failure) => failure.includes("duplicate visual state default:1:top")));
    assert.ok(failures.some((failure) => failure.includes("used effect name Wrong")));
    assert.ok(failures.some((failure) => failure.includes("used screenshot wrong.png")));
});

test("SeqFX inspector depth contract requires every effect at every supported viewport", () => {
    const complete = SEQFX_VISUAL_PROOF_SIZES.flatMap((size) => (
        SEQFX_VISUAL_EFFECTS.map((effect) => ({
            size: size.id,
            effectId: effect.id,
            missingControlIndexes: [],
        }))
    ));
    assert.deepEqual(validateSeqFxInspectorDepthCoverage(complete), []);

    const broken = complete.slice(1);
    broken[0] = { ...broken[0], missingControlIndexes: [3] };
    const failures = validateSeqFxInspectorDepthCoverage(broken);
    assert.ok(failures.some((failure) => failure.includes("missing inspector traversal default:1")));
    assert.ok(failures.some((failure) => failure.includes("never exposed controls 3")));
});
