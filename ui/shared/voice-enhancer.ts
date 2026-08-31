/**
 * T62's one-band per-voice Enhancer contract.
 *
 * This is the shared authority for host IDs, base ranges, display scales, and
 * modulation identities. The DSP owns one instance per allocated voice; the
 * UI/state layer owns only these shared settings.
 */

import {
    advanceEnhancerSpectrum,
    type EnhancerSpectrumDisplay,
} from "./enhancer-spectrum";

export const VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID = "voiceEnhancerFrequency";
export const VOICE_ENHANCER_Q_ENDPOINT_ID = "voiceEnhancerQ";
export const VOICE_ENHANCER_AMOUNT_ENDPOINT_ID = "voiceEnhancerAmount";
export const VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID = "voiceEnhancerKeyTrackEnabled";
export const VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID = "voiceEnhancerKeyTrackOffsetSemitones";
/** Read-only union endpoint for the exact input spectrum and active responses. */
export const VOICE_ENHANCER_SPECTRUM_ENDPOINT_ID = "voiceEnhancerSpectrum";

export const VOICE_ENHANCER_FREQUENCY_TARGET_KIND = "voiceEnhancerFrequencyOctaves";
export const VOICE_ENHANCER_Q_TARGET_KIND = "voiceEnhancerQ";
export const VOICE_ENHANCER_AMOUNT_TARGET_KIND = "voiceEnhancerAmount";
export const VOICE_ENHANCER_KEY_TRACK_CONTROL_ID = "voice.enhancerFrequency";
export const VOICE_ENHANCER_RATIO_MIN_SEMITONES = -12;
export const VOICE_ENHANCER_RATIO_MAX_SEMITONES = 60;

/** One DSP-owned effective response projected for the editor. */
export type VoiceEnhancerResponseDisplay = {
    readonly voiceIndex: number;
    readonly frequencyHz: number;
    readonly q: number;
    readonly amount: number;
};

/** Retained display state folded from the response/spectrum union endpoint. */
export type VoiceEnhancerTelemetryDisplay = {
    readonly spectrum: EnhancerSpectrumDisplay | null;
    readonly responses: ReadonlyArray<VoiceEnhancerResponseDisplay>;
};

const voiceEnhancerResponseVoiceCapacity = 16;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapEvent(value: unknown): unknown {
    return isRecord(value) && Object.hasOwn(value, "event") ? value.event : value;
}

/** Decode one DSP-owned active-voice frame without synthesising missing values. */
function normalizeVoiceEnhancerResponseMessage(
    value: unknown,
): ReadonlyArray<VoiceEnhancerResponseDisplay> | null {
    const candidate = unwrapEvent(value);
    if (!isRecord(candidate)) {
        return null;
    }

    const responseCount = candidate.responseCount;
    const voiceIndices = candidate.voiceIndices;
    const frequenciesHz = candidate.frequenciesHz;
    const qValues = candidate.qValues;
    const amounts = candidate.amounts;
    if (typeof responseCount !== "number"
            || !Number.isInteger(responseCount)
            || responseCount < 0
            || responseCount > voiceEnhancerResponseVoiceCapacity
            || !Array.isArray(voiceIndices)
            || !Array.isArray(frequenciesHz)
            || !Array.isArray(qValues)
            || !Array.isArray(amounts)
            || voiceIndices.length < responseCount
            || frequenciesHz.length < responseCount
            || qValues.length < responseCount
            || amounts.length < responseCount) {
        return null;
    }

    const responses: VoiceEnhancerResponseDisplay[] = [];
    let previousVoiceIndex = -1;
    for (let index = 0; index < responseCount; index += 1) {
        const voiceIndex = voiceIndices[index];
        const frequencyHz = frequenciesHz[index];
        const q = qValues[index];
        const amount = amounts[index];
        if (typeof voiceIndex !== "number"
                || !Number.isInteger(voiceIndex)
                || voiceIndex <= previousVoiceIndex
                || voiceIndex >= voiceEnhancerResponseVoiceCapacity
                || typeof frequencyHz !== "number"
                || !Number.isFinite(frequencyHz)
                || frequencyHz < VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency.min
                || typeof q !== "number"
                || !Number.isFinite(q)
                || q < VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.min
                || q > VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.max
                || typeof amount !== "number"
                || !Number.isFinite(amount)
                || amount < VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.min
                || amount > VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.max) {
            return null;
        }

        previousVoiceIndex = voiceIndex;
        responses.push({
            voiceIndex,
            frequencyHz,
            q,
            amount,
        });
    }

    return responses;
}

/** Create the disconnected state for the response/spectrum union endpoint. */
export function createVoiceEnhancerTelemetryDisplay(): VoiceEnhancerTelemetryDisplay {
    return { spectrum: null, responses: [] };
}

/** Fold alternating analyzer and response events without losing either view. */
export function advanceVoiceEnhancerTelemetryDisplay(
    current: VoiceEnhancerTelemetryDisplay,
    message: unknown | null,
    timestampMs: number,
): VoiceEnhancerTelemetryDisplay {
    if (message === null) {
        return createVoiceEnhancerTelemetryDisplay();
    }

    const responses = normalizeVoiceEnhancerResponseMessage(message);
    if (responses !== null) {
        return { spectrum: current.spectrum, responses };
    }

    const spectrum = advanceEnhancerSpectrum(message, current.spectrum, timestampMs);
    return spectrum === current.spectrum
        ? current
        : { spectrum, responses: current.responses };
}

export type VoiceEnhancerParameterKey = "frequency" | "q" | "amount";

export type VoiceEnhancerParameterDescriptor = {
    readonly key: VoiceEnhancerParameterKey;
    readonly endpointID:
        | typeof VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID
        | typeof VOICE_ENHANCER_Q_ENDPOINT_ID
        | typeof VOICE_ENHANCER_AMOUNT_ENDPOINT_ID;
    readonly targetKind:
        | typeof VOICE_ENHANCER_FREQUENCY_TARGET_KIND
        | typeof VOICE_ENHANCER_Q_TARGET_KIND
        | typeof VOICE_ENHANCER_AMOUNT_TARGET_KIND;
    readonly label: "Frequency" | "Q" | "Amount";
    readonly shortLabel: "Freq" | "Q" | "Amt";
    readonly min: number;
    readonly max: number;
    readonly initial: number;
    readonly step: number;
    readonly scale: "linear" | "log";
    readonly unit: "Hz" | "Q" | "%";
    readonly modulationApplication: "linear" | "octaves";
};

export const VOICE_ENHANCER_PARAMETER_DESCRIPTORS: Readonly<
Record<VoiceEnhancerParameterKey, VoiceEnhancerParameterDescriptor>
> = Object.freeze({
    frequency: Object.freeze({
        key: "frequency",
        endpointID: VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID,
        targetKind: VOICE_ENHANCER_FREQUENCY_TARGET_KIND,
        label: "Frequency",
        shortLabel: "Freq",
        min: 20,
        max: 20_000,
        initial: 130,
        step: 1,
        scale: "log",
        unit: "Hz",
        modulationApplication: "octaves",
    }),
    q: Object.freeze({
        key: "q",
        endpointID: VOICE_ENHANCER_Q_ENDPOINT_ID,
        targetKind: VOICE_ENHANCER_Q_TARGET_KIND,
        label: "Q",
        shortLabel: "Q",
        min: 0.1,
        max: 10,
        initial: 0.71,
        step: 0.01,
        scale: "log",
        unit: "Q",
        modulationApplication: "linear",
    }),
    amount: Object.freeze({
        key: "amount",
        endpointID: VOICE_ENHANCER_AMOUNT_ENDPOINT_ID,
        targetKind: VOICE_ENHANCER_AMOUNT_TARGET_KIND,
        label: "Amount",
        shortLabel: "Amt",
        min: 0,
        max: 1,
        initial: 0,
        step: 0.01,
        scale: "linear",
        unit: "%",
        modulationApplication: "linear",
    }),
});

/** Convert the stored semitone offset to the product's visible Ratio value. */
export function voiceEnhancerRatioFromSemitones(semitones: number): number {
    return 2 ** (semitones / 12);
}

/** Format the continuous 0.5x..32x Key Track value without hiding precision. */
export function formatVoiceEnhancerRatio(semitones: number): string {
    const ratio = voiceEnhancerRatioFromSemitones(semitones);
    const digits = ratio < 10 ? 2 : 1;
    return `${Number(ratio.toFixed(digits))}×`;
}

/** Project the locked Ratio span onto the graph's horizontal axis. */
export function normalizeVoiceEnhancerRatio(semitones: number): number {
    const clamped = Math.min(
        VOICE_ENHANCER_RATIO_MAX_SEMITONES,
        Math.max(VOICE_ENHANCER_RATIO_MIN_SEMITONES, semitones),
    );
    return (clamped - VOICE_ENHANCER_RATIO_MIN_SEMITONES)
        / (VOICE_ENHANCER_RATIO_MAX_SEMITONES - VOICE_ENHANCER_RATIO_MIN_SEMITONES);
}

/** Invert the graph axis back to the endpoint's continuous semitone storage. */
export function voiceEnhancerRatioSemitonesFromNormalized(normalized: number): number {
    const clamped = Math.min(1, Math.max(0, normalized));
    return VOICE_ENHANCER_RATIO_MIN_SEMITONES
        + (clamped * (VOICE_ENHANCER_RATIO_MAX_SEMITONES
            - VOICE_ENHANCER_RATIO_MIN_SEMITONES));
}

/** Project one parameter's engine value onto its authored display scale. */
export function normalizeVoiceEnhancerValue(
    descriptor: VoiceEnhancerParameterDescriptor,
    value: number,
): number {
    const clamped = Math.min(descriptor.max, Math.max(descriptor.min, value));
    return descriptor.scale === "log"
        ? Math.log(clamped / descriptor.min) / Math.log(descriptor.max / descriptor.min)
        : (clamped - descriptor.min) / (descriptor.max - descriptor.min);
}

/** Invert one parameter's authored display scale to its engine value. */
export function denormalizeVoiceEnhancerValue(
    descriptor: VoiceEnhancerParameterDescriptor,
    normalizedValue: number,
): number {
    const clamped = Math.min(1, Math.max(0, normalizedValue));
    return descriptor.scale === "log"
        ? descriptor.min * ((descriptor.max / descriptor.min) ** clamped)
        : descriptor.min + ((descriptor.max - descriptor.min) * clamped);
}
