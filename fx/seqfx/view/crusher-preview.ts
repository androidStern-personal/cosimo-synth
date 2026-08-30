export type CrusherCharacter = 0 | 1 | 2 | 3;

export type CrusherPreviewInput = {
    bits: number;
    rateHz: number;
    driveDb: number;
    character: number;
    adcQuality: number;
    dacQuality: number;
    dither: number;
    mix: number;
    pointCount?: number;
};

export type CrusherPreviewSample = {
    phase: number;
    dry: number;
    wet: number;
};

export type CrusherPreview = {
    samples: CrusherPreviewSample[];
    captureMarkerPhases: number[];
};

export const CRUSHER_BITS_MIN = 2;
export const CRUSHER_BITS_MAX = 16;
export const CRUSHER_RATE_HZ_MIN = 200;
export const CRUSHER_RATE_HZ_MAX = 48_000;
export const CRUSHER_DRIVE_DB_MIN = 0;
export const CRUSHER_DRIVE_DB_MAX = 36;
export const CRUSHER_CHARACTER_MIN = 0;
export const CRUSHER_CHARACTER_MAX = 3;
export const CRUSHER_QUALITY_MIN = 0;
export const CRUSHER_QUALITY_MAX = 1;
export const CRUSHER_PREVIEW_SAMPLE_RATE = 48_000;

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function quantizeLikeSeqFxCrusher(sample: number, levels: number) {
    const scaled = sample * levels;
    return scaled >= 0
        ? Math.floor(scaled + 0.5) / levels
        : -Math.floor(-scaled + 0.5) / levels;
}

function smoothStep01(value: number) {
    const phase = clamp(value, 0, 1);
    return phase * phase * (3 - (2 * phase));
}

function createDeterministicNoise() {
    let state = 0x6d2b79f5;
    return () => {
        state = Math.imul(state ^ (state >>> 15), state | 1);
        state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
        return (((state ^ (state >>> 14)) >>> 0) / 0xffff_ffff) * 2 - 1;
    };
}

export function clampCrusherBits(value: number) {
    return Math.round(clamp(value, CRUSHER_BITS_MIN, CRUSHER_BITS_MAX));
}

export function clampCrusherRateHz(value: number) {
    return clamp(value, CRUSHER_RATE_HZ_MIN, CRUSHER_RATE_HZ_MAX);
}

export function clampCrusherDriveDb(value: number) {
    return clamp(value, CRUSHER_DRIVE_DB_MIN, CRUSHER_DRIVE_DB_MAX);
}

export function clampCrusherCharacter(value: number): CrusherCharacter {
    switch (Math.round(clamp(value, CRUSHER_CHARACTER_MIN, CRUSHER_CHARACTER_MAX))) {
        case 1: return 1;
        case 2: return 2;
        case 3: return 3;
        default: return 0;
    }
}

export function clampCrusherQuality(value: number) {
    return clamp(value, CRUSHER_QUALITY_MIN, CRUSHER_QUALITY_MAX);
}

export function crusherRateToNormalized(value: number) {
    const rateHz = clampCrusherRateHz(value);
    return Math.log(rateHz / CRUSHER_RATE_HZ_MIN) / Math.log(CRUSHER_RATE_HZ_MAX / CRUSHER_RATE_HZ_MIN);
}

export function crusherRateFromNormalized(value: number) {
    const phase = clamp(value, 0, 1);
    return clampCrusherRateHz(CRUSHER_RATE_HZ_MIN * ((CRUSHER_RATE_HZ_MAX / CRUSHER_RATE_HZ_MIN) ** phase));
}

export function sampleCrusherPreview({
    bits,
    rateHz,
    driveDb,
    character,
    adcQuality,
    dacQuality,
    dither,
    mix,
    pointCount = 240,
}: CrusherPreviewInput): CrusherPreview {
    const resolvedBits = clampCrusherBits(bits);
    const resolvedRateHz = clampCrusherRateHz(rateHz);
    const resolvedDriveDb = clampCrusherDriveDb(driveDb);
    const resolvedCharacter = clampCrusherCharacter(character);
    const resolvedAdcQuality = clampCrusherQuality(adcQuality);
    const resolvedDacQuality = clampCrusherQuality(dacQuality);
    const resolvedDither = clampCrusherQuality(dither);
    const resolvedMix = clamp(mix, 0, 1);
    const resolvedPointCount = Math.max(2, Math.round(pointCount));
    const driveGain = 10 ** (resolvedDriveDb / 20);
    const levels = (2 ** (resolvedBits - 1)) - 1;
    const samples: CrusherPreviewSample[] = [];
    const captureMarkerPhases: number[] = [];
    const nextNoise = createDeterministicNoise();

    let held = 0;
    let previousHeld = 0;
    let previousCapture = 0;
    let progressiveOutput = 0;
    let adcState = 0;
    let dacState = 0;
    let dcPreviousInput = 0;
    let dcPreviousOutput = 0;
    let capturePhase = 0;
    let needsRecapture = true;

    const converterCutoff = Math.max(
        20,
        Math.min(CRUSHER_PREVIEW_SAMPLE_RATE * 0.45, resolvedRateHz * 0.45),
    );
    const converterCoefficient = 1 - Math.exp(
        (-2 * Math.PI * converterCutoff) / CRUSHER_PREVIEW_SAMPLE_RATE,
    );

    for (let index = 0; index < resolvedPointCount; index += 1) {
        const phase = index / (resolvedPointCount - 1);
        const dry = Math.sin(Math.PI * 2 * phase);
        let crushed = 0;

        if (resolvedCharacter === 0) {
            const legacyDriven = clamp(dry, -1, 1) * driveGain;
            const legacyClipped = clamp(legacyDriven, -1, 1);
            let shouldCapture = needsRecapture;
            if (!shouldCapture) {
                capturePhase += resolvedRateHz / CRUSHER_PREVIEW_SAMPLE_RATE;
                shouldCapture = capturePhase >= 1;
            }

            if (shouldCapture) {
                held = legacyClipped;
                needsRecapture = false;
                capturePhase = capturePhase >= 1 ? capturePhase - 1 : 0;
                if (index > 0) {
                    captureMarkerPhases.push(phase);
                }
            }

            crushed = quantizeLikeSeqFxCrusher(held, levels);
        } else {
            const driven = clamp(dry * driveGain, -1, 1);
            adcState += (driven - adcState) * converterCoefficient;
            const convertedInput = driven + ((adcState - driven) * resolvedAdcQuality);
            capturePhase += resolvedRateHz / CRUSHER_PREVIEW_SAMPLE_RATE;

            if (needsRecapture || capturePhase >= 1) {
                previousHeld = held;
                const ditherScale = resolvedDither * 0.5 / levels;
                const ditherNoise = (nextNoise() + nextNoise()) * ditherScale;

                if (resolvedCharacter === 3) {
                    const delta = convertedInput - previousCapture;
                    progressiveOutput = clamp(
                        progressiveOutput + quantizeLikeSeqFxCrusher(delta + ditherNoise, levels),
                        -1,
                        1,
                    );
                    held = progressiveOutput;
                } else {
                    held = quantizeLikeSeqFxCrusher(convertedInput + ditherNoise, levels);
                    progressiveOutput = held;
                }

                previousCapture = convertedInput;
                needsRecapture = false;
                capturePhase = capturePhase >= 1 ? capturePhase - 1 : 0;
                if (index > 0) {
                    captureMarkerPhases.push(phase);
                }
            }

            crushed = resolvedCharacter === 2
                ? previousHeld + ((held - previousHeld) * smoothStep01(capturePhase))
                : held;
            dacState += (crushed - dacState) * converterCoefficient;
            crushed += (dacState - crushed) * resolvedDacQuality;

            if (resolvedCharacter === 3) {
                const dcBlocked = crushed - dcPreviousInput + (dcPreviousOutput * 0.99935);
                dcPreviousInput = crushed;
                dcPreviousOutput = dcBlocked;
                crushed = dcBlocked;
            }

            crushed = clamp(crushed, -1.2, 1.2);
        }

        const wet = dry + ((crushed - dry) * resolvedMix);
        samples.push({ phase, dry, wet });
    }

    return { samples, captureMarkerPhases };
}
