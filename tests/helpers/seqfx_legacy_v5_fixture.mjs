import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const legacyFixturePath = new URL("../fixtures/seqfx/legacy-v5-dense-state.json.gz", import.meta.url);
const fixtureEnvelope = JSON.parse(gunzipSync(readFileSync(legacyFixturePath)));
const capturedLegacyState = JSON.parse(fixtureEnvelope.storedState);
const emptyPatternTemplate = capturedLegacyState.patterns?.[0];

const LEGACY_EFFECT_TYPE_BY_LANE = [1, 2, 3, 4];
const LEGACY_FILTER_LANE = 0;
const LEGACY_CRUSH_LANE = 1;
const LEGACY_MAX_EFFECT_TYPE = 4;
const LEGACY_PARAM_COUNT = 8;
const LEGACY_STEP_COUNT = 32;
const LEGACY_CRUSH_BITS_MIN = 4;
const LEGACY_CRUSH_BITS_MAX = 16;
const LEGACY_CRUSH_HOLD_FRAMES_MIN = 1;
const LEGACY_CRUSH_HOLD_FRAMES_MAX = 64;

if (
    fixtureEnvelope.schemaVersion !== 5
    || capturedLegacyState.version !== 5
    || !emptyPatternTemplate
    || emptyPatternTemplate.lanes?.length !== LEGACY_EFFECT_TYPE_BY_LANE.length
    || emptyPatternTemplate.lanes.some((lane) => lane.steps?.length !== LEGACY_STEP_COUNT)
    || emptyPatternTemplate.lanes.flatMap((lane) => lane.steps).some((step) => step.active)
) {
    throw new Error("The frozen SeqFX predecessor fixture does not contain an empty version-5 pattern template.");
}

/**
 * Creates an empty dense state from the frozen predecessor implementation,
 * rather than relabelling today's v7 defaults as version 5.
 */
export function createEmptyLegacyV5State() {
    return {
        version: 5,
        patterns: Array.from(
            { length: capturedLegacyState.patterns.length },
            () => structuredClone(emptyPatternTemplate),
        ),
    };
}

export function createLegacyV5StateWithBlock({
    patternIndex,
    lane,
    startStep,
    length,
    params,
    mix = 1,
}) {
    const state = createEmptyLegacyV5State();
    const effectType = LEGACY_EFFECT_TYPE_BY_LANE[lane];

    if (!Number.isInteger(patternIndex) || patternIndex < 0 || patternIndex >= state.patterns.length) {
        throw new RangeError(`Legacy SeqFX pattern ${patternIndex} is outside the fixture matrix.`);
    }
    if (effectType === undefined) {
        throw new RangeError(`Legacy SeqFX lane ${lane} is outside the fixture matrix.`);
    }
    const hasInvalidBlockRange = !Number.isInteger(startStep)
        || !Number.isInteger(length)
        || length < 1
        || startStep < 0
        || startStep + length > LEGACY_STEP_COUNT;
    if (hasInvalidBlockRange) {
        throw new RangeError(`Legacy SeqFX block ${startStep}+${length} is outside the fixture matrix.`);
    }
    if (
        !Array.isArray(params)
        || params.length !== LEGACY_PARAM_COUNT
        || params.some((value) => !Number.isFinite(value))
    ) {
        throw new TypeError("Legacy SeqFX block parameters must contain eight finite numbers.");
    }
    if (lane === LEGACY_CRUSH_LANE) {
        const [bits, holdFrames] = params;
        if (
            !Number.isInteger(bits)
            || bits < LEGACY_CRUSH_BITS_MIN
            || bits > LEGACY_CRUSH_BITS_MAX
            || !Number.isInteger(holdFrames)
            || holdFrames < LEGACY_CRUSH_HOLD_FRAMES_MIN
            || holdFrames > LEGACY_CRUSH_HOLD_FRAMES_MAX
        ) {
            throw new RangeError("Legacy Crush requires integer bits from 4 to 16 and holdFrames from 1 to 64.");
        }
    }

    const pattern = state.patterns[patternIndex];
    for (let offset = 0; offset < length; offset += 1) {
        const step = pattern.lanes[lane].steps[startStep + offset];
        step.active = true;
        step.trigger = offset === 0;
        step.effectType = effectType;
        step.mix = mix;
        step.params = [...params];
        step.aux.targets = step.aux.targets.map((target, paramIndex) => ({
            ...target,
            end: lane === LEGACY_FILTER_LANE && paramIndex === 1 ? params[2] : params[paramIndex],
        }));
    }

    return state;
}

/**
 * Supplies frozen v5 defaults for inactive cells while preserving active cells
 * that a test has already authored in predecessor parameter space.
 */
export function projectCompatibleDenseStateToLegacyV5Fixture(state) {
    const legacy = structuredClone(state);
    const emptyLegacy = createEmptyLegacyV5State();
    legacy.version = 5;

    legacy.patterns.forEach((pattern, patternIndex) => {
        pattern.lanes.forEach((lane, laneIndex) => {
            lane.steps.forEach((step, stepIndex) => {
                if (!step.active) {
                    const predecessorStep = emptyLegacy.patterns[patternIndex].lanes[laneIndex].steps[stepIndex];
                    step.params = structuredClone(predecessorStep.params);
                    step.aux = structuredClone(predecessorStep.aux);
                }

                for (const memories of [step.effectParams, step.effectAux]) {
                    if (!memories) {
                        continue;
                    }
                    for (const effectId of Object.keys(memories)) {
                        if (Number(effectId) > LEGACY_MAX_EFFECT_TYPE) {
                            delete memories[effectId];
                        }
                    }
                }
            });
        });
    });

    return legacy;
}
