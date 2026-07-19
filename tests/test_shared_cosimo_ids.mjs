import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const idsPromise = loadUIModule(repoRoot, "ui/shared/cosimo-ids.ts");

test("mapping ids roundtrip through compose/split for realistic id shapes", async () => {
    const ids = await idsPromise;
    const idText = fc.stringMatching(/^[a-z][a-z0-9.-]{0,30}$/);
    fc.assert(
        fc.property(idText, idText, (targetRaw, sourceRaw) => {
            const mappingId = ids.makeMappingId(targetRaw, sourceRaw);
            const split = ids.splitMappingId(mappingId);
            assert.notEqual(split, null);
            assert.equal(split.targetIdRaw, targetRaw);
            assert.equal(split.sourceIdRaw, sourceRaw);
        }),
    );
});

test("splitMappingId rejects shapes that are not target::source", async () => {
    const ids = await idsPromise;
    for (const bad of ["", "::", "a::", "::b", "no-separator", ":single:colon"]) {
        assert.equal(ids.splitMappingId(bad), null, JSON.stringify(bad));
    }
});

test("parseNormalizedValue accepts exactly the closed unit interval", async () => {
    const ids = await idsPromise;
    fc.assert(
        fc.property(fc.double({ noNaN: true }), (input) => {
            const result = ids.parseNormalizedValue(input);
            if (input >= 0 && input <= 1) {
                assert.equal(result._tag, "ok");
                assert.equal(result.value, input);
            } else {
                assert.equal(result._tag, "err");
                assert.equal(result.error._tag, "ValueOutOfRange");
            }
        }),
    );
    assert.equal(ids.parseNormalizedValue(Number.NaN)._tag, "err");
    assert.equal(ids.parseNormalizedValue(Number.POSITIVE_INFINITY)._tag, "err");
});

test("clampNormalizedValue is total, idempotent, and agrees with parse on valid input", async () => {
    const ids = await idsPromise;
    fc.assert(
        fc.property(fc.double(), (input) => {
            const clamped = ids.clampNormalizedValue(input);
            assert.equal(clamped >= 0 && clamped <= 1, true);
            assert.equal(ids.clampNormalizedValue(clamped), clamped);
            const parsed = ids.parseNormalizedValue(clamped);
            assert.equal(parsed._tag, "ok");
        }),
    );
    assert.equal(ids.clampNormalizedValue(Number.NaN), 0);
});
