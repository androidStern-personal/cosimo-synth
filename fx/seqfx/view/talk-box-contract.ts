export const TALK_BOX_VOWELS = ["A", "E", "I", "O", "U"] as const;

export type TalkBoxVowel = typeof TALK_BOX_VOWELS[number];

export type TalkBoxFormants = Readonly<{
    firstHz: number;
    secondHz: number;
}>;

// Adult-male F1/F2 means selected from Peterson and Barney (1952):
// A=/ɑ/, E=/ɛ/, I=/i/, O=/ɔ/, U=/u/.
export const TALK_BOX_FORMANTS_HZ: readonly TalkBoxFormants[] = [
    { firstHz: 730, secondHz: 1_090 },
    { firstHz: 530, secondHz: 1_840 },
    { firstHz: 270, secondHz: 2_290 },
    { firstHz: 570, secondHz: 840 },
    { firstHz: 300, secondHz: 870 },
];

function clampVowelIndex(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(TALK_BOX_VOWELS.length - 1, Math.max(0, Math.round(value)));
}

function clampUnit(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function logInterpolate(start: number, end: number, amount: number) {
    return Math.exp(Math.log(start) + ((Math.log(end) - Math.log(start)) * amount));
}

export function resolveTalkBoxFormants(fromVowel: number, toVowel: number, morph: number): TalkBoxFormants {
    const from = TALK_BOX_FORMANTS_HZ[clampVowelIndex(fromVowel)]!;
    const to = TALK_BOX_FORMANTS_HZ[clampVowelIndex(toVowel)]!;
    const amount = clampUnit(morph);
    return {
        firstHz: logInterpolate(from.firstHz, to.firstHz, amount),
        secondHz: logInterpolate(from.secondHz, to.secondHz, amount),
    };
}

export function formatTalkBoxVowelPair(fromVowel: number, toVowel: number) {
    const from = TALK_BOX_VOWELS[clampVowelIndex(fromVowel)]!;
    const to = TALK_BOX_VOWELS[clampVowelIndex(toVowel)]!;
    return from === to ? from : `${from}>${to}`;
}
