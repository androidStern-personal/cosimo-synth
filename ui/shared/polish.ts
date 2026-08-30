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

/** Read-only post-trim peak and momentary-loudness telemetry endpoint. */
export const POLISH_METER_ENDPOINT_ID = "polishMeter";

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
});

export const POLISH_PEAK_HOLD_MS = 1_000;
export const POLISH_PEAK_DECAY_DB_PER_SECOND = 24;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a Cmajor event payload without allowing malformed telemetry into UI state. */
export function normalizePolishMeterMessage(value: unknown): PolishMeterFrame | null {
    const candidate = isRecord(value) && "event" in value ? value.event : value;
    if (!isRecord(candidate)) {
        return null;
    }

    const peakDbfs = candidate.peakDbfs;
    const loudnessDbfs = candidate.loudnessDbfs;
    if (typeof peakDbfs !== "number" || !Number.isFinite(peakDbfs)
            || typeof loudnessDbfs !== "number" || !Number.isFinite(loudnessDbfs)) {
        return null;
    }

    return { peakDbfs, loudnessDbfs };
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
