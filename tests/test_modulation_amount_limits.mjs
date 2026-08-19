// Route-amount range contract for voice modulation destinations.
//
// A route amount is an ADDITIVE OFFSET in the target's parameter units, and
// the engine clamps base + offset to the parameter's domain at application.
// Two properties follow, and this file exists because both were violated for
// ampGainDb (live-repro: with Level at -20.1 dB the high mod limit froze at
// -14.1 dB — the amount's positive side had been copied from the PARAMETER
// range, +6, instead of covering the parameter's span):
//
// 1. Offset limits must be SYMMETRIC. An asymmetric amount range silently
//    caps one drag direction at an arbitrary distance from base.
// 2. For full-span destinations (wavetable position, warp, filter Q/Mix, amp),
//    the limit must cover the whole parameter span so any base value can be
//    modulated to either rail. Deliberately narrower musical caps (pitch at
//    +/-48 st, cutoff at +/-6 oct, pan at +/-1) are pinned exactly.

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");

const AMP_GAIN_DB_MIN = -48;
const AMP_GAIN_DB_MAX = 6;
const AMP_GAIN_DB_SPAN = AMP_GAIN_DB_MAX - AMP_GAIN_DB_MIN;

const VOICE_TARGET_KINDS_BY_PARAMETER = {
    wavetablePosition: "oscA.wavetablePosition",
    warpAmount: "oscA.warpAmount",
    filterCutoffOctaves: "filterCutoffOctaves",
    filterQ: "filterQ",
    filterMix: "filterMix",
    pitchSemitones: "oscA.pitchSemitones",
    ampGainDb: "oscA.ampGainDb",
    pan: "oscA.pan",
    unisonDetune: "oscA.unisonDetune",
    unisonBlend: "oscA.unisonBlend",
    unisonWidth: "oscA.unisonWidth",
    unisonWavetablePositionSpread: "oscA.unisonWavetablePositionSpread",
    unisonWarpSpread: "oscA.unisonWarpSpread",
};

test("every voice route amount range is a symmetric offset window", async () => {
    const { getModulationAmountBounds } = await modulationModulePromise;
    for (const [parameterKind, targetKind] of Object.entries(VOICE_TARGET_KINDS_BY_PARAMETER)) {
        const bounds = getModulationAmountBounds(targetKind);
        assert.equal(
            -bounds.min,
            bounds.max,
            `${parameterKind}: amount limits ${bounds.min}..${bounds.max} cap one drag direction harder than the other`,
        );
        assert.ok(bounds.max > 0, `${parameterKind}: amount range is empty`);
        assert.ok(bounds.step > 0, `${parameterKind}: amount step must be positive`);
    }
});

test("amp gain route amounts cover the full parameter span in both directions", async () => {
    const { getModulationAmountBounds } = await modulationModulePromise;
    const bounds = getModulationAmountBounds(VOICE_TARGET_KINDS_BY_PARAMETER.ampGainDb);
    assert.ok(
        bounds.max >= AMP_GAIN_DB_SPAN,
        `an amp route must be able to lift any base to +6 dB: needs +${AMP_GAIN_DB_SPAN}, allows +${bounds.max}`,
    );
    assert.ok(
        bounds.min <= -AMP_GAIN_DB_SPAN,
        `an amp route must be able to pull any base to -48 dB: needs ${-AMP_GAIN_DB_SPAN}, allows ${bounds.min}`,
    );
});

test("full-span offset destinations reach both rails from any base value", async () => {
    const { getModulationAmountBounds } = await modulationModulePromise;
    const fullSpanCases = [
        { parameterKind: "wavetablePosition", span: 1 },
        { parameterKind: "warpAmount", span: 1 },
        { parameterKind: "filterQ", span: 19.9 },
        { parameterKind: "filterMix", span: 1 },
        { parameterKind: "ampGainDb", span: AMP_GAIN_DB_SPAN },
        { parameterKind: "unisonDetune", span: 1 },
        { parameterKind: "unisonBlend", span: 1 },
        { parameterKind: "unisonWidth", span: 1 },
        { parameterKind: "unisonWavetablePositionSpread", span: 1 },
        { parameterKind: "unisonWarpSpread", span: 1 },
    ];
    for (const { parameterKind, span } of fullSpanCases) {
        const bounds = getModulationAmountBounds(VOICE_TARGET_KINDS_BY_PARAMETER[parameterKind]);
        assert.ok(
            bounds.max >= span - 1e-9 && bounds.min <= -(span - 1e-9),
            `${parameterKind}: limits ${bounds.min}..${bounds.max} cannot span the ${span} parameter range`,
        );
    }
});

test("deliberately narrower musical offset caps are pinned exactly", async () => {
    const { getModulationAmountBounds } = await modulationModulePromise;
    const pinned = [
        { parameterKind: "pitchSemitones", min: -48, max: 48 },
        { parameterKind: "filterCutoffOctaves", min: -6, max: 6 },
        { parameterKind: "pan", min: -1, max: 1 },
    ];
    for (const { parameterKind, min, max } of pinned) {
        const bounds = getModulationAmountBounds(VOICE_TARGET_KINDS_BY_PARAMETER[parameterKind]);
        assert.equal(bounds.min, min, `${parameterKind} min moved — deliberate design change?`);
        assert.equal(bounds.max, max, `${parameterKind} max moved — deliberate design change?`);
    }
});

test("the generated patch_gui twin stays in sync with ui/shared on every voice amount range", async () => {
    const shared = await modulationModulePromise;
    const twin = await import(path.join(repoRoot, "patch_gui", "modulation.js"));
    for (const targetKind of Object.values(VOICE_TARGET_KINDS_BY_PARAMETER)) {
        assert.deepEqual(
            twin.getModulationAmountBounds(targetKind),
            shared.getModulationAmountBounds(targetKind),
            `${targetKind}: patch_gui/modulation.js drifted from ui/shared/modulation.ts`,
        );
    }
});
