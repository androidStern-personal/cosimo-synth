export type CrusherPreviewInput = {
    bits: number;
    holdFrames: number;
    driveDb: number;
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
    holdMarkerPhases: number[];
};

export const CRUSHER_BITS_MIN = 4;
export const CRUSHER_BITS_MAX = 16;
export const CRUSHER_HOLD_FRAMES_MIN = 1;
export const CRUSHER_HOLD_FRAMES_MAX = 64;
export const CRUSHER_DRIVE_DB_MIN = 0;
export const CRUSHER_DRIVE_DB_MAX = 36;

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function quantizeLikeSeqFxCrusher(sample: number, levels: number) {
    const scaled = sample * levels;

    if (scaled >= 0) {
        return Math.floor(scaled + 0.5) / levels;
    }

    return -Math.floor(-scaled + 0.5) / levels;
}

export function clampCrusherBits(value: number) {
    return Math.round(clamp(value, CRUSHER_BITS_MIN, CRUSHER_BITS_MAX));
}

export function clampCrusherHoldFrames(value: number) {
    return Math.round(clamp(value, CRUSHER_HOLD_FRAMES_MIN, CRUSHER_HOLD_FRAMES_MAX));
}

export function clampCrusherDriveDb(value: number) {
    return clamp(value, CRUSHER_DRIVE_DB_MIN, CRUSHER_DRIVE_DB_MAX);
}

export function sampleCrusherPreview({
    bits,
    holdFrames,
    driveDb,
    mix,
    pointCount = 240,
}: CrusherPreviewInput): CrusherPreview {
    const resolvedBits = clampCrusherBits(bits);
    const resolvedHoldFrames = clampCrusherHoldFrames(holdFrames);
    const resolvedDriveDb = clampCrusherDriveDb(driveDb);
    const resolvedMix = clamp(mix, 0, 1);
    const resolvedPointCount = Math.max(2, Math.round(pointCount));
    const driveGain = 10 ** (resolvedDriveDb / 20);
    const quantizationLevels = (2 ** (resolvedBits - 1)) - 1;
    const samples: CrusherPreviewSample[] = [];
    const holdMarkerPhases: number[] = [];
    let heldSample = 0;
    let holdCounter = 0;
    let needsRecapture = true;

    for (let index = 0; index < resolvedPointCount; index += 1) {
        const phase = index / (resolvedPointCount - 1);
        const dry = Math.sin(Math.PI * 2 * phase);
        const clipped = clamp(clamp(dry, -1, 1) * driveGain, -1, 1);

        if (needsRecapture || holdCounter <= 0) {
            heldSample = clipped;
            needsRecapture = false;
            holdCounter = resolvedHoldFrames;
            if (index > 0) {
                holdMarkerPhases.push(phase);
            }
        }

        holdCounter -= 1;

        const quantized = quantizeLikeSeqFxCrusher(heldSample, quantizationLevels);
        const wet = dry + ((quantized - dry) * resolvedMix);
        samples.push({ phase, dry, wet });
    }

    return {
        samples,
        holdMarkerPhases,
    };
}
