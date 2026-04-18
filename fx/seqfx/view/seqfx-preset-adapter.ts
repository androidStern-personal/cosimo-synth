import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import type { EffectStoredStateAdapter } from "../../../ui/shared/effects/effect-preset-v2";
import {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANE_COUNT,
    SEQFX_PARAM_COUNT,
    SEQFX_PATTERN_COUNT,
    SEQFX_STATE_KEY,
    SEQFX_STEP_COUNT,
    assertSeqFxStateValuesInRange,
    normalizeSeqFxState,
    serializeSeqFxState,
    type SeqFxState,
} from "./seqfx-state";
import type { SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertBoolean(value: unknown, label: string) {
    if (typeof value !== "boolean") {
        throw new Error(`${label} must be boolean.`);
    }
}

function assertFiniteNumber(value: unknown, label: string) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${label} must be finite number.`);
    }
}

function assertEffectType(value: unknown, label: string) {
    assertFiniteNumber(value, label);
    if (!Number.isInteger(value) || value < SEQFX_EFFECT_TYPES.empty || value > SEQFX_EFFECT_TYPES.stutter) {
        throw new Error(`${label} must be a known SeqFX effect type.`);
    }
}

function parseStateCandidate(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        throw new Error("SeqFX preset state must be valid JSON.");
    }
}

function assertStrictSeqFxState(value: unknown): asserts value is SeqFxState {
    if (!isPlainObject(value) || (value.version !== 1 && value.version !== 2) || !Array.isArray(value.patterns)) {
        throw new Error("SeqFX preset state must contain version 1 or version 2 patterns.");
    }

    const requiresEffectType = value.version === 2;

    if (value.patterns.length !== SEQFX_PATTERN_COUNT) {
        throw new Error(`SeqFX preset state patterns must contain ${SEQFX_PATTERN_COUNT} patterns.`);
    }

    value.patterns.forEach((pattern, patternIndex) => {
        if (!isPlainObject(pattern) || typeof pattern.revision !== "number" || !Array.isArray(pattern.lanes)) {
            throw new Error(`SeqFX pattern ${patternIndex} is invalid.`);
        }

        if (pattern.lanes.length !== SEQFX_LANE_COUNT) {
            throw new Error(`SeqFX pattern ${patternIndex} must contain ${SEQFX_LANE_COUNT} lanes.`);
        }

        pattern.lanes.forEach((lane, laneIndex) => {
            if (!isPlainObject(lane) || !Array.isArray(lane.steps)) {
                throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} is invalid.`);
            }

            if (lane.steps.length !== SEQFX_STEP_COUNT) {
                throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} must contain ${SEQFX_STEP_COUNT} steps.`);
            }

            lane.steps.forEach((step, stepIndex) => {
                if (!isPlainObject(step) || !Array.isArray(step.params)) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} is invalid.`);
                }

                assertBoolean(step.active, `SeqFX step ${stepIndex} active`);
                assertBoolean(step.trigger, `SeqFX step ${stepIndex} trigger`);
                assertFiniteNumber(step.mix, `SeqFX step ${stepIndex} mix`);

                if (requiresEffectType) {
                    if (!Object.prototype.hasOwnProperty.call(step, "effectType")) {
                        throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} must contain effectType.`);
                    }

                    assertEffectType(step.effectType, `SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} effectType`);
                }

                if (step.params.length !== SEQFX_PARAM_COUNT) {
                    throw new Error(`SeqFX step ${stepIndex} must contain ${SEQFX_PARAM_COUNT} params.`);
                }

                step.params.forEach((param, paramIndex) => {
                    assertFiniteNumber(param, `SeqFX step ${stepIndex} param ${paramIndex}`);
                });
            });
        });
    });
}

export function createSeqFxPresetStateAdapter({
    bridge,
    patchConnection: _patchConnection,
}: {
    bridge: SeqFxRuntimeBridge;
    patchConnection: PatchConnectionLike;
}): EffectStoredStateAdapter {
    return {
        key: SEQFX_STATE_KEY,
        schemaVersion: 2,
        getContract() {
            return {
                key: SEQFX_STATE_KEY,
                schemaVersion: 2,
                required: true,
            };
        },
        capture() {
            return serializeSeqFxState(bridge.getState());
        },
        normalizeForPreset(value: unknown) {
            const parsed = parseStateCandidate(value);
            assertStrictSeqFxState(parsed);
            assertSeqFxStateValuesInRange(parsed);
            return serializeSeqFxState(normalizeSeqFxState(parsed));
        },
        serializeForPreset(value: unknown) {
            const parsed = parseStateCandidate(value);
            assertStrictSeqFxState(parsed);
            assertSeqFxStateValuesInRange(parsed);
            return serializeSeqFxState(normalizeSeqFxState(parsed));
        },
        apply(value: unknown) {
            const parsed = parseStateCandidate(value);
            assertStrictSeqFxState(parsed);
            assertSeqFxStateValuesInRange(parsed);
            bridge.replaceStateFromPreset(normalizeSeqFxState(parsed));
        },
        subscribe(listener: () => void) {
            return bridge.subscribe(() => listener());
        },
    };
}
