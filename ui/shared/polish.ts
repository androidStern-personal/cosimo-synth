import { enhancerBellResponseDb } from "./enhancer-spectrum";

/** Public host endpoint for the fixed Polish Enhancer macro. */
export const POLISH_ENHANCER_AMOUNT_ENDPOINT_ID = "polishEnhancerAmount";

/** Public host endpoint for the fixed Polish compressor/clipper macro. */
export const POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID = "polishCompressionClipAmount";

/** Public host endpoint for the final Polish output trim. */
export const POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID = "polishOutputTrimDb";

/** Public host endpoint for the fixed Safe Bass treatment strength. */
export const POLISH_SAFE_BASS_AMOUNT_ENDPOINT_ID = "polishSafeBassAmount";

/** Public host endpoint for Safe Bass's independent bypass. */
export const POLISH_SAFE_BASS_BYPASS_ENDPOINT_ID = "polishSafeBassBypass";

/** Public host endpoint for the fixed Enhancer's independent bypass. */
export const POLISH_ENHANCER_BYPASS_ENDPOINT_ID = "polishEnhancerBypass";

/** Public host endpoint for the compressor-plus-soft-clip macro's bypass. */
export const POLISH_COMPRESSION_CLIP_BYPASS_ENDPOINT_ID = "polishCompressionClipBypass";

/** Public host endpoint for Output Trim's independent bypass. */
export const POLISH_OUTPUT_TRIM_BYPASS_ENDPOINT_ID = "polishOutputTrimBypass";

/** Read-only post-trim meter and post-Safe-Bass/pre-Enhancer spectrum endpoint. */
export const POLISH_METER_ENDPOINT_ID = "polishMeter";

/** Hidden presentation lifecycle event; never host, saved, or modulatable sound state. */
export const POLISH_ANALYZER_ENABLED_ENDPOINT_ID = "polishAnalyzerEnabledIn";

/** The complete public Polish parameter contract, in append-only host order. */
export const POLISH_PARAMETER_ENDPOINT_IDS = Object.freeze([
    POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
    POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
    POLISH_SAFE_BASS_AMOUNT_ENDPOINT_ID,
    POLISH_SAFE_BASS_BYPASS_ENDPOINT_ID,
    POLISH_ENHANCER_BYPASS_ENDPOINT_ID,
    POLISH_COMPRESSION_CLIP_BYPASS_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_BYPASS_ENDPOINT_ID,
] as const);

export type PolishMeterFrame = {
    readonly peakDbfs: number;
    readonly loudnessDbfs: number;
    readonly compressorGainReductionDb?: number;
};

export type PolishPeakDisplayState = {
    readonly peakDbfs: number;
    readonly heldUntilMs: number;
    readonly updatedAtMs: number;
};

/** The DSP's finite silence floor, shared with the compact UI presentation. */
export const SILENT_POLISH_METER_FRAME: PolishMeterFrame = Object.freeze({
    peakDbfs: -120,
    loudnessDbfs: -120,
    compressorGainReductionDb: 0,
});

export const POLISH_PEAK_HOLD_MS = 1_000;
export const POLISH_PEAK_DECAY_DB_PER_SECOND = 24;

const polishCompressorThresholdDb = 0;
const polishCompressorKneeDb = 6;
const polishSoftClipKnee = 0.7079457843841379;
const polishSafeBassCutoffHz = 120;
const polishSafeBassQ = 0.7071067811865475;
const polishResponseReferenceSampleRateHz = 48_000;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampPolishAmount(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/**
 * Evaluate the exact Safe Bass side-channel blend at the UI's 48 kHz
 * reference rate. The cutoff and Butterworth Q match the production biquad;
 * Amount 0 is identity and Amount 1 is the tuned high-pass response.
 */
export function polishSafeBassMagnitudeDb(
    frequencyHz: number,
    amount: number,
): number {
    const omega0 = 2 * Math.PI * polishSafeBassCutoffHz
        / polishResponseReferenceSampleRateHz;
    const alpha = Math.sin(omega0) / (2 * polishSafeBassQ);
    const cosine0 = Math.cos(omega0);
    const a0 = 1 + alpha;
    const b0 = ((1 + cosine0) * 0.5) / a0;
    const b1 = -(1 + cosine0) / a0;
    const b2 = b0;
    const a1 = (-2 * cosine0) / a0;
    const a2 = (1 - alpha) / a0;
    const omega = 2 * Math.PI * Math.min(20_000, Math.max(20, frequencyHz))
        / polishResponseReferenceSampleRateHz;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = b0 + b1 * z1Real + b2 * z2Real;
    const numeratorImaginary = b1 * z1Imaginary + b2 * z2Imaginary;
    const denominatorReal = 1 + a1 * z1Real + a2 * z2Real;
    const denominatorImaginary = a1 * z1Imaginary + a2 * z2Imaginary;
    const denominatorPower = denominatorReal * denominatorReal
        + denominatorImaginary * denominatorImaginary;
    const responseReal = (
        numeratorReal * denominatorReal + numeratorImaginary * denominatorImaginary
    ) / denominatorPower;
    const responseImaginary = (
        numeratorImaginary * denominatorReal - numeratorReal * denominatorImaginary
    ) / denominatorPower;
    const amount01 = clampPolishAmount(amount);
    const blendedReal = 1 + amount01 * (responseReal - 1);
    const blendedImaginary = amount01 * responseImaginary;
    return 10 * Math.log10(Math.max(
        blendedReal * blendedReal + blendedImaginary * blendedImaginary,
        1e-12,
    ));
}

/** Evaluate the accepted fixed Polish Enhancer control response for Mid or Side. */
export function polishEnhancerResponseDb(
    frequencyHz: number,
    amount: number,
    lane: "mid" | "side",
): number {
    const amount01 = clampPolishAmount(amount);
    // Band 1 is Stereo, so its primary 0.70 law applies equally to Mid and Side.
    // Band 2 is Mid/Side and uses the accepted 0.35 Mid / 0.70 Side law.
    return enhancerBellResponseDb(frequencyHz, 130, 0.71, 0.70 * amount01)
        + enhancerBellResponseDb(
            frequencyHz,
            9_000,
            0.71,
            (lane === "mid" ? 0.35 : 0.70) * amount01,
        );
}

/** Evaluate the accepted Polish compressor transfer curve in decibels. */
export function polishCompressorOutputDb(inputDb: number, amount: number): number {
    const amount01 = clampPolishAmount(amount);
    if (amount01 === 0) {
        return inputDb;
    }

    const ratio = 1 + 3 * amount01;
    const slope = 1 - 1 / ratio;
    const distance = inputDb - polishCompressorThresholdDb;
    const halfKnee = polishCompressorKneeDb * 0.5;
    if (distance <= -halfKnee) {
        return inputDb;
    }
    if (distance >= halfKnee) {
        return inputDb - slope * distance;
    }

    const kneeDistance = distance + halfKnee;
    const reductionDb = -slope * kneeDistance * kneeDistance
        / (2 * polishCompressorKneeDb);
    return inputDb + reductionDb;
}

/** Evaluate the accepted Polish soft clip and its normalized Comp macro blend. */
export function polishSoftClipOutput(input: number, amount: number): number {
    const magnitude = Math.abs(input);
    let clipped = input;
    if (magnitude > polishSoftClipKnee) {
        const span = 1 - polishSoftClipKnee;
        const shapedMagnitude = polishSoftClipKnee + span * Math.tanh(
            (magnitude - polishSoftClipKnee) / span,
        );
        clipped = input < 0 ? -shapedMagnitude : shapedMagnitude;
    }

    return input + (clipped - input) * clampPolishAmount(amount);
}

/** Parse a Cmajor event payload without allowing malformed telemetry into UI state. */
export function normalizePolishMeterMessage(value: unknown): PolishMeterFrame | null {
    const candidate = isRecord(value) && "event" in value ? value.event : value;
    if (!isRecord(candidate)) {
        return null;
    }

    const peakDbfs = candidate.peakDbfs;
    const loudnessDbfs = candidate.loudnessDbfs;
    const compressorGainReductionDb = candidate.compressorGainReductionDb;
    if (typeof peakDbfs !== "number" || !Number.isFinite(peakDbfs)
            || typeof loudnessDbfs !== "number" || !Number.isFinite(loudnessDbfs)
            || (compressorGainReductionDb !== undefined
                && (typeof compressorGainReductionDb !== "number"
                    || !Number.isFinite(compressorGainReductionDb)))) {
        return null;
    }

    return compressorGainReductionDb === undefined
        ? { peakDbfs, loudnessDbfs }
        : { peakDbfs, loudnessDbfs, compressorGainReductionDb };
}

/** Create the UI-owned held-peak state from one valid telemetry frame. */
export function createPolishPeakDisplayState(
    frame: PolishMeterFrame = SILENT_POLISH_METER_FRAME,
    nowMs = 0,
): PolishPeakDisplayState {
    return {
        peakDbfs: frame.peakDbfs,
        heldUntilMs: nowMs,
        updatedAtMs: nowMs,
    };
}

/**
 * Apply the locked peak law: higher samples write immediately and restart a
 * one-second hold; after it expires the display falls at 24 dB/s, never below
 * the newest DSP interval peak.
 */
export function advancePolishPeakDisplay(
    current: PolishPeakDisplayState,
    frame: PolishMeterFrame,
    nowMs: number,
): PolishPeakDisplayState {
    if (!Number.isFinite(nowMs) || nowMs < current.updatedAtMs) {
        return current;
    }

    if (frame.peakDbfs > current.peakDbfs) {
        return {
            peakDbfs: frame.peakDbfs,
            heldUntilMs: nowMs + POLISH_PEAK_HOLD_MS,
            updatedAtMs: nowMs,
        };
    }

    const decayStartedAtMs = Math.max(current.updatedAtMs, current.heldUntilMs);
    const elapsedDecayMs = Math.max(0, nowMs - decayStartedAtMs);
    const decayedPeak = current.peakDbfs
        - (elapsedDecayMs * POLISH_PEAK_DECAY_DB_PER_SECOND / 1_000);

    return {
        peakDbfs: Math.max(frame.peakDbfs, decayedPeak),
        heldUntilMs: current.heldUntilMs,
        updatedAtMs: nowMs,
    };
}

/** Fixed-width compact peak text; extreme values saturate instead of widening the capsule. */
export function formatPolishPeakDbfs(value: number): string {
    if (value <= -100) {
        return "-120";
    }
    if (value >= 100) {
        return ">99";
    }
    const normalized = Math.abs(value) < 0.05 ? 0 : value;
    return normalized.toFixed(1);
}

/** Fixed-width compact momentary-loudness text. */
export function formatPolishLoudnessDbfs(value: number): string {
    if (value <= -100) {
        return "-120";
    }
    if (value >= 100) {
        return ">99";
    }
    return String(Math.round(value));
}
