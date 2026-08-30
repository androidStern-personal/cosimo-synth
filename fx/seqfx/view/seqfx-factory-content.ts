import {
    SEQFX_EFFECT_TYPES,
    applySeqFxBlockCreate,
    applySeqFxBlockPresetEdit,
    applySeqFxPatternInit,
    getSeqFxEffectDefinition,
    getSeqFxLaneBlocks,
    type SeqFxEffectType,
    type SeqFxLoopRangeTarget,
    type SeqFxState,
} from "./seqfx-state";

export type SeqFxFactoryPatternBlock = {
    lane: number;
    startStep: number;
    length: number;
    effectType: SeqFxEffectType;
    presetId: string;
};

export type SeqFxFactoryPattern = {
    id: string;
    name: string;
    category: "Bass" | "Drums" | "Harmony" | "Showcase" | "Subtle" | "Transitions" | "Vocals";
    description: string;
    blocks: readonly SeqFxFactoryPatternBlock[];
};

const block = (
    lane: number,
    startStep: number,
    length: number,
    effectType: SeqFxEffectType,
    presetId: string,
): SeqFxFactoryPatternBlock => ({ lane, startStep, length, effectType, presetId });

export const SEQFX_FACTORY_PATTERNS = [
    {
        id: "drum-cutter",
        name: "Drum Cutter",
        category: "Drums",
        description: "Alternating filter beds, converter accents, reverse turns, and one-step repeat fills.",
        blocks: [
            block(0, 0, 4, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 8, 4, SEQFX_EFFECT_TYPES.filter, "telephone-band"),
            block(0, 16, 4, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 24, 4, SEQFX_EFFECT_TYPES.filter, "air-cut"),
            block(1, 6, 2, SEQFX_EFFECT_TYPES.crusher, "dusty-12-bit"), block(1, 14, 2, SEQFX_EFFECT_TYPES.crusher, "console-game"),
            block(1, 22, 2, SEQFX_EFFECT_TYPES.crusher, "dusty-12-bit"), block(1, 30, 2, SEQFX_EFFECT_TYPES.crusher, "broken-converter"),
            block(2, 12, 4, SEQFX_EFFECT_TYPES.reverse, "eighth-echo"), block(2, 28, 4, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
            block(3, 7, 1, SEQFX_EFFECT_TYPES.stutter, "tight-eighths"), block(3, 15, 1, SEQFX_EFFECT_TYPES.stutter, "triplet-ratchet"),
            block(3, 23, 1, SEQFX_EFFECT_TYPES.stutter, "tight-eighths"), block(3, 31, 1, SEQFX_EFFECT_TYPES.stutter, "falling-chop"),
        ],
    },
    {
        id: "brake-and-drop",
        name: "Brake & Drop",
        category: "Transitions",
        description: "Level-conscious drive beds lead into long brakes and rolling reverse pickups.",
        blocks: [
            block(0, 0, 8, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 16, 8, SEQFX_EFFECT_TYPES.filter, "air-cut"),
            block(1, 8, 8, SEQFX_EFFECT_TYPES.dirty, "warm-grit"), block(1, 24, 4, SEQFX_EFFECT_TYPES.dirty, "hard-punch"),
            block(2, 12, 1, SEQFX_EFFECT_TYPES.tapeStop, "slow-vinyl-stop"), block(2, 28, 1, SEQFX_EFFECT_TYPES.tapeStop, "one-cell-brake"),
            block(3, 13, 3, SEQFX_EFFECT_TYPES.reverse, "eighth-echo"), block(3, 29, 3, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
        ],
    },
    {
        id: "vocal-cutups",
        name: "Vocal Cutups",
        category: "Vocals",
        description: "Formant phrases, octave throws, reverse words, and short nondestructive repeats.",
        blocks: [
            block(0, 0, 8, SEQFX_EFFECT_TYPES.talkBox, "a-to-o"), block(0, 16, 8, SEQFX_EFFECT_TYPES.talkBox, "ee-whisper"),
            block(1, 8, 4, SEQFX_EFFECT_TYPES.pitch, "octave-up"), block(1, 24, 4, SEQFX_EFFECT_TYPES.pitch, "octave-down"),
            block(2, 12, 4, SEQFX_EFFECT_TYPES.reverse, "free-voice-420"), block(2, 28, 4, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
            block(3, 6, 2, SEQFX_EFFECT_TYPES.stutter, "tight-eighths"), block(3, 14, 2, SEQFX_EFFECT_TYPES.stutter, "triplet-ratchet"),
            block(3, 22, 2, SEQFX_EFFECT_TYPES.stutter, "falling-chop"), block(3, 30, 2, SEQFX_EFFECT_TYPES.stutter, "tight-eighths"),
        ],
    },
    {
        id: "bass-vector",
        name: "Bass Vector",
        category: "Bass",
        description: "Tuned dispersive resonance and compensated drive animate bass without constant full-wet processing.",
        blocks: [
            block(0, 0, 6, SEQFX_EFFECT_TYPES.comb, "wooden-string"), block(0, 16, 6, SEQFX_EFFECT_TYPES.comb, "negative-metal"),
            block(1, 6, 6, SEQFX_EFFECT_TYPES.dirty, "warm-grit"), block(1, 22, 6, SEQFX_EFFECT_TYPES.dirty, "folded-bias"),
            block(2, 4, 4, SEQFX_EFFECT_TYPES.filter, "telephone-band"), block(2, 20, 4, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"),
            block(3, 12, 4, SEQFX_EFFECT_TYPES.ring, "soft-tremolo"), block(3, 28, 4, SEQFX_EFFECT_TYPES.ring, "sideband-chime"),
        ],
    },
    {
        id: "chord-motion",
        name: "Chord Motion",
        category: "Harmony",
        description: "Micro-pitch, pure Doppler movement, shallow flange, and bell-like resonances for held chords.",
        blocks: [
            block(0, 0, 12, SEQFX_EFFECT_TYPES.pitch, "detuned-cloud"), block(0, 16, 12, SEQFX_EFFECT_TYPES.pitch, "detuned-cloud"),
            block(1, 4, 8, SEQFX_EFFECT_TYPES.vibro, "gentle-wobble"), block(1, 20, 8, SEQFX_EFFECT_TYPES.vibro, "tape-warble"),
            block(2, 8, 8, SEQFX_EFFECT_TYPES.flange, "silk-flange"), block(2, 24, 8, SEQFX_EFFECT_TYPES.flange, "hollow-inverse"),
            block(3, 12, 4, SEQFX_EFFECT_TYPES.comb, "vector-bells"), block(3, 28, 4, SEQFX_EFFECT_TYPES.comb, "wooden-string"),
        ],
    },
    {
        id: "subtle-motion",
        name: "Subtle Motion",
        category: "Subtle",
        description: "Sparse utility filtering, shallow vibrato, and silk flange leave most of the source untouched.",
        blocks: [
            block(0, 0, 4, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 16, 4, SEQFX_EFFECT_TYPES.filter, "air-cut"),
            block(1, 6, 4, SEQFX_EFFECT_TYPES.vibro, "gentle-wobble"), block(1, 22, 4, SEQFX_EFFECT_TYPES.vibro, "gentle-wobble"),
            block(2, 12, 4, SEQFX_EFFECT_TYPES.flange, "silk-flange"), block(2, 28, 4, SEQFX_EFFECT_TYPES.flange, "silk-flange"),
            block(3, 14, 2, SEQFX_EFFECT_TYPES.pitch, "detuned-cloud"), block(3, 30, 2, SEQFX_EFFECT_TYPES.pitch, "detuned-cloud"),
        ],
    },
    {
        id: "glitch-fills",
        name: "Glitch Fills",
        category: "Drums",
        description: "Short, separated digital accents avoid turning the whole pattern into undifferentiated damage.",
        blocks: [
            block(0, 3, 1, SEQFX_EFFECT_TYPES.crusher, "console-game"), block(0, 11, 1, SEQFX_EFFECT_TYPES.crusher, "broken-converter"), block(0, 19, 1, SEQFX_EFFECT_TYPES.crusher, "console-game"), block(0, 27, 1, SEQFX_EFFECT_TYPES.crusher, "broken-converter"),
            block(1, 6, 2, SEQFX_EFFECT_TYPES.pitch, "octave-up"), block(1, 14, 2, SEQFX_EFFECT_TYPES.pitch, "octave-down"), block(1, 22, 2, SEQFX_EFFECT_TYPES.pitch, "octave-up"), block(1, 30, 2, SEQFX_EFFECT_TYPES.pitch, "octave-down"),
            block(2, 4, 2, SEQFX_EFFECT_TYPES.ring, "robot-square"), block(2, 20, 2, SEQFX_EFFECT_TYPES.ring, "sideband-chime"),
            block(3, 7, 1, SEQFX_EFFECT_TYPES.stutter, "triplet-ratchet"), block(3, 15, 1, SEQFX_EFFECT_TYPES.stutter, "falling-chop"), block(3, 23, 1, SEQFX_EFFECT_TYPES.stutter, "triplet-ratchet"), block(3, 31, 1, SEQFX_EFFECT_TYPES.stutter, "falling-chop"),
        ],
    },
    {
        id: "reverse-turnaround",
        name: "Reverse Turnaround",
        category: "Transitions",
        description: "Rolling reverse windows and a final tape brake frame a two-bar turnaround.",
        blocks: [
            block(0, 0, 8, SEQFX_EFFECT_TYPES.filter, "air-cut"), block(0, 16, 8, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"),
            block(1, 8, 8, SEQFX_EFFECT_TYPES.flange, "jet-pass"), block(1, 24, 8, SEQFX_EFFECT_TYPES.flange, "hollow-inverse"),
            block(2, 12, 4, SEQFX_EFFECT_TYPES.reverse, "eighth-echo"), block(2, 26, 6, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
            block(3, 15, 1, SEQFX_EFFECT_TYPES.tapeStop, "one-cell-brake"), block(3, 31, 1, SEQFX_EFFECT_TYPES.tapeStop, "slow-vinyl-stop"),
        ],
    },
    {
        id: "robot-vowels",
        name: "Robot Vowels",
        category: "Vocals",
        description: "Alternating vowels and ring sidebands create a sequenced robot-voice treatment without a sidechain.",
        blocks: [
            block(0, 0, 8, SEQFX_EFFECT_TYPES.talkBox, "robot-vowels"), block(0, 16, 8, SEQFX_EFFECT_TYPES.talkBox, "a-to-o"),
            block(1, 4, 4, SEQFX_EFFECT_TYPES.ring, "robot-square"), block(1, 20, 4, SEQFX_EFFECT_TYPES.ring, "sideband-chime"),
            block(2, 8, 4, SEQFX_EFFECT_TYPES.pitch, "octave-down"), block(2, 24, 4, SEQFX_EFFECT_TYPES.pitch, "octave-up"),
            block(3, 14, 2, SEQFX_EFFECT_TYPES.stutter, "falling-chop"), block(3, 30, 2, SEQFX_EFFECT_TYPES.stutter, "triplet-ratchet"),
        ],
    },
    {
        id: "metal-percussion",
        name: "Metal Percussion",
        category: "Drums",
        description: "Vectored comb tones, exact carrier sidebands, and short distortion accents turn percussion metallic.",
        blocks: [
            block(0, 0, 4, SEQFX_EFFECT_TYPES.comb, "vector-bells"), block(0, 8, 4, SEQFX_EFFECT_TYPES.comb, "negative-metal"), block(0, 16, 4, SEQFX_EFFECT_TYPES.comb, "vector-bells"), block(0, 24, 4, SEQFX_EFFECT_TYPES.comb, "wooden-string"),
            block(1, 4, 4, SEQFX_EFFECT_TYPES.ring, "sideband-chime"), block(1, 20, 4, SEQFX_EFFECT_TYPES.ring, "robot-square"),
            block(2, 6, 2, SEQFX_EFFECT_TYPES.dirty, "hard-punch"), block(2, 14, 2, SEQFX_EFFECT_TYPES.dirty, "folded-bias"), block(2, 22, 2, SEQFX_EFFECT_TYPES.dirty, "hard-punch"), block(2, 30, 2, SEQFX_EFFECT_TYPES.dirty, "folded-bias"),
            block(3, 12, 4, SEQFX_EFFECT_TYPES.flange, "hollow-inverse"), block(3, 28, 4, SEQFX_EFFECT_TYPES.flange, "jet-pass"),
        ],
    },
    {
        id: "tape-transition",
        name: "Tape Transition",
        category: "Transitions",
        description: "A restrained moving bed ends in live-crossfade and spin-up motor gestures.",
        blocks: [
            block(0, 0, 8, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 16, 8, SEQFX_EFFECT_TYPES.filter, "telephone-band"),
            block(1, 4, 8, SEQFX_EFFECT_TYPES.vibro, "tape-warble"), block(1, 20, 8, SEQFX_EFFECT_TYPES.vibro, "gentle-wobble"),
            block(2, 12, 4, SEQFX_EFFECT_TYPES.reverse, "eighth-echo"), block(2, 28, 4, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
            block(3, 15, 1, SEQFX_EFFECT_TYPES.tapeStop, "one-cell-brake"), block(3, 31, 1, SEQFX_EFFECT_TYPES.tapeStop, "slow-vinyl-stop"),
        ],
    },
    {
        id: "twelve-effect-tour",
        name: "Twelve-effect Tour",
        category: "Showcase",
        description: "Every selectable effect appears once in a readable, non-overlapping two-bar demonstration.",
        blocks: [
            block(0, 0, 2, SEQFX_EFFECT_TYPES.filter, "warm-low-pass"), block(0, 4, 2, SEQFX_EFFECT_TYPES.crusher, "dusty-12-bit"),
            block(0, 8, 1, SEQFX_EFFECT_TYPES.tapeStop, "one-cell-brake"), block(0, 12, 2, SEQFX_EFFECT_TYPES.stutter, "tight-eighths"),
            block(0, 16, 2, SEQFX_EFFECT_TYPES.pitch, "octave-up"), block(0, 20, 2, SEQFX_EFFECT_TYPES.comb, "vector-bells"),
            block(0, 24, 2, SEQFX_EFFECT_TYPES.ring, "sideband-chime"), block(0, 28, 4, SEQFX_EFFECT_TYPES.reverse, "one-cell-turn"),
            block(1, 0, 4, SEQFX_EFFECT_TYPES.talkBox, "a-to-o"), block(1, 6, 4, SEQFX_EFFECT_TYPES.vibro, "gentle-wobble"),
            block(1, 12, 4, SEQFX_EFFECT_TYPES.flange, "silk-flange"), block(1, 18, 4, SEQFX_EFFECT_TYPES.dirty, "warm-grit"),
        ],
    },
] as const satisfies readonly SeqFxFactoryPattern[];

const patternById = new Map<string, SeqFxFactoryPattern>(
    SEQFX_FACTORY_PATTERNS.map((pattern) => [pattern.id, pattern]),
);

export function getSeqFxFactoryPattern(patternId: string): SeqFxFactoryPattern | null {
    return patternById.get(patternId) ?? null;
}

function findPreset(effectType: SeqFxEffectType, presetId: string) {
    const preset = getSeqFxEffectDefinition(effectType).factoryPresets.find((candidate) => candidate.id === presetId);
    if (!preset) {
        throw new Error(`Unknown SeqFX factory preset ${presetId} for effect ${effectType}.`);
    }
    return preset;
}

export function applySeqFxFactoryPattern(
    state: SeqFxState,
    patternIndex: number,
    factoryPattern: SeqFxFactoryPattern,
): SeqFxState {
    let nextState = applySeqFxPatternInit(state, patternIndex);
    for (const recipeBlock of factoryPattern.blocks) {
        nextState = applySeqFxBlockCreate(nextState, {
            patternIndex,
            lane: recipeBlock.lane,
            startStep: recipeBlock.startStep,
            length: recipeBlock.length,
            effectType: recipeBlock.effectType,
        });
        const preset = findPreset(recipeBlock.effectType, recipeBlock.presetId);
        nextState = applySeqFxBlockPresetEdit(nextState, {
            patternIndex,
            lane: recipeBlock.lane,
            startStep: recipeBlock.startStep,
            mix: preset.mix,
            params: preset.params,
        });
    }
    return nextState;
}

export function applySeqFxSafeLoopVariation(
    state: SeqFxState,
    target: SeqFxLoopRangeTarget,
    variationIndex: number,
): SeqFxState {
    const pattern = state.patterns[target.patternIndex];
    if (!pattern) {
        return state;
    }

    const loopEnd = target.startStep + target.length - 1;
    let nextState = state;
    for (let lane = 0; lane < pattern.lanes.length; lane += 1) {
        const blocks = getSeqFxLaneBlocks(pattern, lane).filter((candidate) => (
            candidate.startStep <= loopEnd && candidate.endStep >= target.startStep
        ));
        for (const candidate of blocks) {
            const presets = getSeqFxEffectDefinition(candidate.effectType).factoryPresets;
            if (presets.length === 0) {
                continue;
            }
            const preset = presets[(variationIndex + (lane * 7) + candidate.startStep) % presets.length];
            nextState = applySeqFxBlockPresetEdit(nextState, {
                patternIndex: target.patternIndex,
                lane,
                startStep: candidate.startStep,
                mix: preset.mix,
                params: preset.params,
            });
        }
    }
    return nextState;
}
