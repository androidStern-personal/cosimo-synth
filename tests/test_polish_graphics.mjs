import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const polishModulePromise = loadUIModule(repoRoot, "ui/shared/polish.ts");

test("the Safe Bass graph mirrors the approved amount blend and fixed 120 Hz response", async () => {
    const polish = await polishModulePromise;

    assert.equal(polish.polishSafeBassMagnitudeDb(20, 0), 0);
    assert.ok(Math.abs(polish.polishSafeBassMagnitudeDb(120, 1) + 3.0102999566) < 1e-6);
    assert.ok(polish.polishSafeBassMagnitudeDb(20, 1) < -25);
    assert.ok(polish.polishSafeBassMagnitudeDb(20, 0.5) > -7);
});

test("the Polish Enhancer graph mirrors Stereo body and Mid/Side air laws", async () => {
    const polish = await polishModulePromise;

    assert.equal(polish.polishEnhancerResponseDb(130, 0, "mid"), 0);
    assert.equal(polish.polishEnhancerResponseDb(130, 0, "side"), 0);
    const midBody = polish.polishEnhancerResponseDb(130, 1, "mid");
    const sideBody = polish.polishEnhancerResponseDb(130, 1, "side");
    assert.ok(Math.abs(midBody - sideBody) < 0.05);
    assert.ok(
        polish.polishEnhancerResponseDb(9_000, 1, "side")
        > polish.polishEnhancerResponseDb(9_000, 1, "mid") + 3,
    );
});

test("the compressor transfer curve mirrors the accepted threshold, knee, and macro ratio", async () => {
    const polish = await polishModulePromise;

    assert.equal(polish.polishCompressorOutputDb(12, 0), 12);
    assert.ok(Math.abs(polish.polishCompressorOutputDb(12, 1) - 3) < 1e-9);
    assert.ok(Math.abs(polish.polishCompressorOutputDb(0, 1) - (-0.5625)) < 1e-9);
    assert.equal(polish.polishCompressorOutputDb(-12, 1), -12);
});

test("the soft-clip transfer curve preserves the accepted knee, symmetry, and Comp blend", async () => {
    const polish = await polishModulePromise;
    const knee = 0.7079457843841379;

    assert.equal(polish.polishSoftClipOutput(1, 0), 1);
    assert.equal(polish.polishSoftClipOutput(knee, 1), knee);
    const clipped = polish.polishSoftClipOutput(1, 1);
    assert.ok(clipped < 1 && clipped > knee);
    assert.equal(polish.polishSoftClipOutput(-1, 1), -clipped);
    assert.ok(Math.abs(polish.polishSoftClipOutput(1, 0.5) - (1 + clipped) / 2) < 1e-12);
});
