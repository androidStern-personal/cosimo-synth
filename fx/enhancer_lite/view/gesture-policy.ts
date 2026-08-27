/** Fixed drag sensitivities shared by every Enhancer Lite control surface. */
export const ENHANCER_LITE_GESTURE_POLICY = {
    frequencyPixelsPerOctave: 80,
    amountPixelsPerUnit: 240,
    qPixelsPerOctave: 40,
    frequencyKeyboardOctavesPerStep: 1 / 12,
    amountKeyboardStep: 0.01,
    qKeyboardOctavesPerStep: 1 / 6,
} as const;

/** Project horizontal pointer travel onto the logarithmic Frequency domain. */
export function enhancerLiteFrequencyFromHorizontalPixels(
    originFrequencyHz: number,
    horizontalPixels: number,
): number {
    return originFrequencyHz * Math.pow(
        2,
        horizontalPixels / ENHANCER_LITE_GESTURE_POLICY.frequencyPixelsPerOctave,
    );
}

/** Project upward pointer travel onto the normalized 0..1 Amount domain. */
export function enhancerLiteAmountFromUpwardPixels(
    originAmount: number,
    upwardPixels: number,
): number {
    return originAmount + upwardPixels / ENHANCER_LITE_GESTURE_POLICY.amountPixelsPerUnit;
}

/** Project upward pointer travel onto the logarithmic Q domain. */
export function enhancerLiteQFromUpwardPixels(originQ: number, upwardPixels: number): number {
    return originQ * Math.pow(
        2,
        upwardPixels / ENHANCER_LITE_GESTURE_POLICY.qPixelsPerOctave,
    );
}
