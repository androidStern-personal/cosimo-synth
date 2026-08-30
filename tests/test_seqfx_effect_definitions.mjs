import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    assert.deepEqual(
        crush.parameters.map(({ id, label, min, max, defaultValue, unit, latch, auxEligible, options }) => ({
            id,
            label,
            min,
            max,
            defaultValue,
            unit,
            latch,
            auxEligible,
            options,
        })),
        [
            { id: "bits", label: "Bits", min: 2, max: 16, defaultValue: 8, unit: "bits", latch: "continuous", auxEligible: true, options: undefined },
            { id: "rateHz", label: "Rate", min: 200, max: 48_000, defaultValue: 48_000, unit: "Hz", latch: "continuous", auxEligible: true, options: undefined },
            { id: "drive", label: "Drive", min: 0, max: 36, defaultValue: 0, unit: "dB", latch: "continuous", auxEligible: true, options: undefined },
            { id: "character", label: "Character", min: 0, max: 3, defaultValue: 1, unit: "", latch: "trigger", auxEligible: false, options: ["Original", "Classic", "Smooth", "Progressive"] },
            { id: "adcQuality", label: "ADC Q", min: 0, max: 1, defaultValue: 0, unit: "%", latch: "continuous", auxEligible: true, options: undefined },
            { id: "dacQuality", label: "DAC Q", min: 0, max: 1, defaultValue: 0, unit: "%", latch: "continuous", auxEligible: true, options: undefined },
            { id: "dither", label: "Dither", min: 0, max: 1, defaultValue: 0, unit: "%", latch: "continuous", auxEligible: true, options: undefined },
        ],
    );
});

test("Cmajor accepts every append-only effect ID without aliasing future effects to Stutter", async () => {
    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    const cmajorNames = {
        empty: "effectEmpty",
        filter: "effectFilter",
        crusher: "effectCrusher",
        tapeStop: "effectTapeStop",
        stutter: "effectStutter",
        pitch: "effectPitch",
        comb: "effectComb",
        ring: "effectRing",
        reverse: "effectReverse",
        talkBox: "effectTalkBox",
        vibro: "effectVibro",
        flange: "effectFlange",
        dirty: "effectDirty",
    };

    for (const [key, cmajorName] of Object.entries(cmajorNames)) {
        assert.match(source, new RegExp(`\\blet ${cmajorName} = ${SEQFX_EFFECT_TYPES[key]};`));
    }

    assert.equal(
        [...source.matchAll(/clampInt \(stepEffectTypes\[[^\n]+effectEmpty, seqfx::(effect\w+)\)/g)]
            .every((match) => match[1] === "effectDirty"),
        true,
    );
    assert.doesNotMatch(
        source,
        /clampInt \(upload\.effectTypes\[[^\n]+effectEmpty, seqfx::effectStutter\)/,
    );
});

test("Dirty keeps one sequenced identity while its nonlinear core runs at fixed 4x quality", async () => {
    const dirty = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.dirty);
    assert.equal(dirty.lifecycle, "gated");
    assert.deepEqual(
        dirty.parameters.map(({ id, defaultValue, latch, auxEligible }) => ({ id, defaultValue, latch, auxEligible })),
        [
            { id: "driveDb", defaultValue: 12, latch: "continuous", auxEligible: true },
            { id: "character", defaultValue: 0, latch: "trigger", auxEligible: false },
            { id: "bias", defaultValue: 0, latch: "continuous", auxEligible: true },
            { id: "dynamics", defaultValue: 0.65, latch: "continuous", auxEligible: true },
            { id: "toneHz", defaultValue: 12_000, latch: "continuous", auxEligible: true },
            { id: "trimDb", defaultValue: -6, latch: "continuous", auxEligible: true },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /let dirtyOversampleFactor = 4;/);
    assert.match(source, /node core = DirtyCore \* dirtyOversampleFactor;/);
    assert.match(source, /node dirtyCores = seqfx::DirtyBus\[seqfx::laneCount\];/);
});

test("Pitch keeps an established complementary-grain contract with honest modulation policy", async () => {
    const pitch = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.pitch);
    assert.equal(pitch.lifecycle, "captured");
    assert.equal(pitch.fontaudioIcon, "fad-arrows-vert");
    assert.deepEqual(
        pitch.parameters.map(({ id, min, max, defaultValue, latch, auxEligible }) => ({
            id,
            min,
            max,
            defaultValue,
            latch,
            auxEligible,
        })),
        [
            { id: "semitones", min: -24, max: 24, defaultValue: 0, latch: "continuous", auxEligible: true },
            { id: "cents", min: -100, max: 100, defaultValue: 0, latch: "continuous", auxEligible: true },
            { id: "grainMs", min: 10, max: 120, defaultValue: 48, latch: "trigger", auxEligible: false },
            { id: "jitter", min: 0, max: 1, defaultValue: 0, latch: "continuous", auxEligible: true },
            { id: "spread", min: 0, max: 1, defaultValue: 0.35, latch: "continuous", auxEligible: true },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /let pitchGrainVoiceCount = 2;/);
    assert.match(source, /pitchGrainSourcePosition/);
    assert.match(source, /pitchHistoryFade/);
    assert.match(source, /let nextPhase = phase \+ phaseIncrement;/);
    assert.doesNotMatch(source, /signedPhaseIncrement/);
    assert.match(source, /processPitch/);
    assert.doesNotMatch(source, /pitchCorrelate/);
});

test("Reverse is a bounded rolling lookback looper with established length fade and decay controls", async () => {
    const reverse = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.reverse);
    assert.equal(reverse.lifecycle, "captured");
    assert.equal(reverse.fontaudioIcon, "fad-backward");
    assert.deepEqual(
        reverse.parameters.map(({ id, min, max, defaultValue, latch, auxEligible, options }) => ({
            id,
            min,
            max,
            defaultValue,
            latch,
            auxEligible,
            options,
        })),
        [
            { id: "division", min: 0, max: 4, defaultValue: 4, latch: "trigger", auxEligible: false, options: ["1/32", "1/16", "1/8", "1/4", "1 Cell"] },
            { id: "crossfade", min: 0, max: 0.25, defaultValue: 0.08, latch: "continuous", auxEligible: true, options: undefined },
            { id: "timingMode", min: 0, max: 1, defaultValue: 0, latch: "trigger", auxEligible: false, options: ["Sync", "Free"] },
            { id: "freeMs", min: 20, max: 4_000, defaultValue: 250, latch: "trigger", auxEligible: false, options: undefined },
            { id: "decay", min: 0, max: 1, defaultValue: 1, latch: "continuous", auxEligible: true, options: undefined },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /let reverseVoiceCount = 2;/);
    assert.match(source, /reverseWindowEnd/);
    assert.match(source, /processReverse/);
    assert.doesNotMatch(source, /reversePlaybackSpeed/);
});

test("Comb keeps the selected reference-neutral vector-dispersive production contract", async () => {
    const comb = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.comb);
    assert.equal(comb.lifecycle, "tail");
    assert.deepEqual(
        comb.parameters.map(({ id, defaultValue, latch, auxEligible }) => ({ id, defaultValue, latch, auxEligible })),
        [
            { id: "tuneHz", defaultValue: 220, latch: "continuous", auxEligible: true },
            { id: "decaySeconds", defaultValue: 1.4, latch: "continuous", auxEligible: true },
            { id: "polarity", defaultValue: 0, latch: "trigger", auxEligible: false },
            { id: "dispersion", defaultValue: 0.55, latch: "continuous", auxEligible: true },
            { id: "dampingHz", defaultValue: 7_500, latch: "continuous", auxEligible: true },
            { id: "motion", defaultValue: 0.12, latch: "continuous", auxEligible: true },
            { id: "drive", defaultValue: 0.18, latch: "continuous", auxEligible: true },
            { id: "width", defaultValue: 0.65, latch: "continuous", auxEligible: true },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /let combModeCount = 4;/);
    assert.match(source, /let combAllpassStageCount = 4;/);
    assert.match(source, /combVectorHistory/);
    assert.match(source, /combMeasuredPeriodCompensation/);
    assert.match(source, /combTailActive/);
});

test("Vibro is a wet-only Doppler modulation with explicit free and sync timing", async () => {
    const vibro = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.vibro);
    assert.equal(vibro.lifecycle, "modulatedDelay");
    assert.equal(vibro.fontaudioIcon, "fad-modtri");
    assert.deepEqual(
        vibro.parameters.map(({ id, defaultValue, latch, auxEligible, options }) => ({
            id,
            defaultValue,
            latch,
            auxEligible,
            options,
        })),
        [
            { id: "rateHz", defaultValue: 4.5, latch: "continuous", auxEligible: true, options: undefined },
            { id: "depthCents", defaultValue: 28, latch: "continuous", auxEligible: true, options: undefined },
            { id: "waveform", defaultValue: 0, latch: "trigger", auxEligible: false, options: ["Sine", "Triangle"] },
            { id: "spreadDegrees", defaultValue: 90, latch: "continuous", auxEligible: true, options: undefined },
            { id: "timingMode", defaultValue: 0, latch: "trigger", auxEligible: false, options: ["Sync", "Free"] },
            { id: "division", defaultValue: 2, latch: "trigger", auxEligible: false, options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar"] },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /vibroMaxDelaySeconds/);
    assert.match(source, /vibroTriangleIntegral/);
    assert.match(source, /processVibro/);
    assert.doesNotMatch(source, /vibroFeedback/);
});

test("Flange keeps the established short-delay feedback contract without an unproven scroll mode", async () => {
    const flange = getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.flange);
    assert.equal(flange.lifecycle, "modulatedDelay");
    assert.deepEqual(
        flange.parameters.map(({ id, defaultValue, latch, auxEligible, options }) => ({
            id,
            defaultValue,
            latch,
            auxEligible,
            options,
        })),
        [
            { id: "delayMs", defaultValue: 1.2, latch: "continuous", auxEligible: true, options: undefined },
            { id: "depthMs", defaultValue: 3.5, latch: "continuous", auxEligible: true, options: undefined },
            { id: "rateHz", defaultValue: 0.28, latch: "continuous", auxEligible: true, options: undefined },
            { id: "feedback", defaultValue: 0.55, latch: "continuous", auxEligible: true, options: undefined },
            { id: "spreadDegrees", defaultValue: 120, latch: "continuous", auxEligible: true, options: undefined },
            { id: "polarity", defaultValue: 0, latch: "trigger", auxEligible: false, options: ["Normal", "Inverse"] },
            { id: "timingMode", defaultValue: 1, latch: "trigger", auxEligible: false, options: ["Sync", "Free"] },
            { id: "division", defaultValue: 5, latch: "trigger", auxEligible: false, options: ["1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars"] },
        ],
    );

    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /flangeMaxDelaySeconds/);
    assert.match(source, /resolveFlangeRateHz/);
    assert.match(source, /processFlange/);
    assert.match(source, /flangeFeedbackPolarity/);
    assert.doesNotMatch(source, /flangeScroll/);
});
