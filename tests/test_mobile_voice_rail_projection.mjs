import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const railModulePromise = loadUIModule(repoRoot, "ui/shared/mobile-voice-rail-projection.ts");

test("rail state truth table", async () => {
    const { resolveMobileVoiceRailState } = await railModulePromise;

    assert.equal(
        resolveMobileVoiceRailState({ modulatable: false, armed: true, route: null }),
        "not-modulatable",
    );
    assert.equal(
        resolveMobileVoiceRailState({ modulatable: true, armed: false, route: null }),
        "no-source",
    );
    assert.equal(
        resolveMobileVoiceRailState({ modulatable: true, armed: true, route: null }),
        "unmapped",
    );
    assert.equal(
        resolveMobileVoiceRailState({ modulatable: true, armed: true, route: { enabled: true, amount: 0 } }),
        "mapped-zero",
        "a route at exactly 0 is mapped, never confused with unmapped",
    );
    assert.equal(
        resolveMobileVoiceRailState({ modulatable: true, armed: true, route: { enabled: true, amount: 0.38 } }),
        "mapped",
    );
    assert.equal(
        resolveMobileVoiceRailState({ modulatable: true, armed: true, route: { enabled: false, amount: 0.38 } }),
        "bypassed",
        "a bypassed route keeps its geometry rather than disappearing",
    );
});

test("a unipolar positive route projects one-sided travel from the base tick", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const band = projectMobileVoiceRailBand(
        { min: 0, max: 1 },
        0.4,
        { amount: 0.3, polarity: "unipolar" },
    );

    assert.equal(band.baseNormalized, 0.4);
    assert.equal(band.lowNormalized, 0.4);
    assert.ok(Math.abs(band.highNormalized - 0.7) < 1e-9);
    assert.equal(band.clippedLow, false);
    assert.equal(band.clippedHigh, false);
});

test("a unipolar negative route travels below the base tick", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const band = projectMobileVoiceRailBand(
        { min: 0, max: 1 },
        0.4,
        { amount: -0.25, polarity: "unipolar" },
    );

    assert.ok(Math.abs(band.lowNormalized - 0.15) < 1e-9);
    assert.equal(band.highNormalized, 0.4);
});

test("a bipolar route travels symmetrically around the base tick", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const band = projectMobileVoiceRailBand(
        { min: -1, max: 1 },
        0,
        { amount: 0.5, polarity: "bipolar" },
    );

    assert.equal(band.baseNormalized, 0.5);
    assert.ok(Math.abs(band.lowNormalized - 0.25) < 1e-9);
    assert.ok(Math.abs(band.highNormalized - 0.75) < 1e-9);
});

test("travel clamps at the range bound and reports the clipped edge", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const band = projectMobileVoiceRailBand(
        { min: 0, max: 1 },
        0.72,
        { amount: 0.6, polarity: "unipolar" },
    );

    assert.equal(band.highNormalized, 1, "band clips at the legal bound");
    assert.equal(band.clippedHigh, true, "the clipped edge keeps its marker");
    assert.equal(band.clippedLow, false);
    assert.equal(band.fullyClipped, false);
});

test("a nonzero route pinned entirely past the bound reports fullyClipped", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const band = projectMobileVoiceRailBand(
        { min: 0, max: 1 },
        1,
        { amount: 0.5, polarity: "unipolar" },
    );

    assert.equal(band.fullyClipped, true, "the mapping must not visually disappear");
    assert.equal(band.clippedHigh, true);
});

test("aggregate tune base combines octave, semitone, and cents", async () => {
    const { aggregateTuneBaseSemitones } = await railModulePromise;

    assert.equal(aggregateTuneBaseSemitones(0, 0, 0), 0);
    assert.equal(aggregateTuneBaseSemitones(1, 7, 50), 19.5);
    assert.equal(aggregateTuneBaseSemitones(-2, -12, -100), -37);
});

test("aggregate tune travel is expressed in semitones and clamps to the tune domain", async () => {
    const { projectAggregateTuneTravel, AGGREGATE_TUNE_DOMAIN } = await railModulePromise;

    const travel = projectAggregateTuneTravel(19.5, { amount: 2, polarity: "unipolar" });
    assert.equal(travel.lowSemitones, 19.5);
    assert.equal(travel.highSemitones, 21.5);

    const clamped = projectAggregateTuneTravel(60, { amount: 12, polarity: "unipolar" });
    assert.equal(clamped.highSemitones, AGGREGATE_TUNE_DOMAIN.max);
});

test("the shared Tune route projects onto each component cell by its own semitone span", async () => {
    const { projectTuneComponentBand } = await railModulePromise;
    const route = { amount: 2, polarity: "unipolar" };

    const octave = projectTuneComponentBand("octave", 0.5, route);
    const semitone = projectTuneComponentBand("semitone", 0.5, route);
    const fine = projectTuneComponentBand("fineCents", 0.5, route);

    assert.ok(Math.abs((octave.highNormalized - octave.lowNormalized) - 2 / 96) < 1e-9);
    assert.ok(Math.abs((semitone.highNormalized - semitone.lowNormalized) - 2 / 24) < 1e-9);
    assert.equal(fine.highNormalized, 1, "a 2 st route saturates the 2 st Fine cell");
    assert.equal(fine.clippedHigh, true, "travel past the Fine bound keeps its edge marker");

    const exactFine = projectTuneComponentBand("fineCents", 0.5, { amount: 1, polarity: "unipolar" });
    assert.equal(exactFine.highNormalized, 1, "a 1 st route exactly reaches the Fine bound");
    assert.equal(exactFine.clippedHigh, false, "exactly reaching the bound is not clipping");
});

test("a zero-span rail domain is rejected as a programming error", async () => {
    const { projectMobileVoiceRailBand } = await railModulePromise;

    assert.throws(() => projectMobileVoiceRailBand(
        { min: 1, max: 1 },
        1,
        { amount: 0, polarity: "unipolar" },
    ));
});

test("an amp route in dB units can lift any base to the +6 dB rail", async () => {
    // Live repro (2026-08-18): with base Level at -20.1 dB the high limit
    // froze at -14.1 dB because the OFFSET was capped at the parameter's own
    // +6 maximum. Amounts are additive dB offsets over the full 54 dB span.
    const { projectMobileVoiceRailBand } = await railModulePromise;
    const domain = { min: -48, max: 6 };

    const reachesTop = projectMobileVoiceRailBand(
        domain,
        -20.1,
        { amount: 26.1, polarity: "unipolar" },
    );
    assert.ok(Math.abs(reachesTop.highNormalized - 1) < 1e-9, "base -20.1 + 26.1 dB reaches the +6 rail");
    assert.equal(reachesTop.clippedHigh, false, "exact-rail travel is not clipped");
    assert.ok(Math.abs(reachesTop.lowNormalized - reachesTop.baseNormalized) < 1e-9);

    const saturates = projectMobileVoiceRailBand(
        domain,
        -20.1,
        { amount: 54, polarity: "unipolar" },
    );
    assert.ok(Math.abs(saturates.highNormalized - 1) < 1e-9, "a full-span offset saturates at +6 dB");
    assert.equal(saturates.clippedHigh, true, "overshoot past the rail reports the clipped edge");

    const floors = projectMobileVoiceRailBand(
        domain,
        -20.1,
        { amount: -54, polarity: "unipolar" },
    );
    assert.ok(Math.abs(floors.lowNormalized - 0) < 1e-9, "a full negative offset reaches the -48 dB rail");
    assert.equal(floors.clippedLow, true);

    const oldCap = projectMobileVoiceRailBand(
        domain,
        -20.1,
        { amount: 6, polarity: "unipolar" },
    );
    assert.ok(
        Math.abs(oldCap.highNormalized - ((-14.1 + 48) / 54)) < 1e-9,
        "a +6 dB offset stops at -14.1 dB — the value the capped build could never exceed",
    );
});
