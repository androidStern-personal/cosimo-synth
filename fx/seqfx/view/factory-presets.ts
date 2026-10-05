import type { FactoryPreset } from "../../../kit/index";
import { SEQFX_FACTORY_PATTERNS, applySeqFxFactoryPattern } from "./seqfx-factory-content";
import { createDefaultSeqFxState } from "./seqfx-state";

/**
 * One factory preset per factory pattern: the pattern fills the first of the twelve
 * slots, the other slots are empty, and the global controls are at their defaults.
 */
export const factoryPresets: readonly FactoryPreset[] = SEQFX_FACTORY_PATTERNS.map((pattern) => ({
    id: pattern.id,
    name: pattern.name,
    values: {
        enabled: 1,
        mix: 1,
        selectedPattern: 0,
        clock: 0,
        manualBpm: 120,
        rate: 1,
        swing: 0,
        loopStart: 0,
        loopLength: 32,
        patterns: applySeqFxFactoryPattern(createDefaultSeqFxState(), 0, pattern),
    },
}));
