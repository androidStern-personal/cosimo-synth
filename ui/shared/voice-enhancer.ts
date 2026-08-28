/**
 * T62's one-band per-voice Enhancer contract.
 *
 * This is the shared authority for host IDs, base ranges, display scales, and
 * modulation identities. The DSP owns one instance per allocated voice; the
 * UI/state layer owns only these shared settings.
 */

export const VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID = "voiceEnhancerFrequency";
export const VOICE_ENHANCER_Q_ENDPOINT_ID = "voiceEnhancerQ";
export const VOICE_ENHANCER_AMOUNT_ENDPOINT_ID = "voiceEnhancerAmount";
export const VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID = "voiceEnhancerKeyTrackEnabled";
export const VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID = "voiceEnhancerKeyTrackOffsetSemitones";

export const VOICE_ENHANCER_FREQUENCY_TARGET_KIND = "voiceEnhancerFrequencyOctaves";
export const VOICE_ENHANCER_Q_TARGET_KIND = "voiceEnhancerQ";
export const VOICE_ENHANCER_AMOUNT_TARGET_KIND = "voiceEnhancerAmount";
export const VOICE_ENHANCER_KEY_TRACK_CONTROL_ID = "voice.enhancerFrequency";

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

export function normalizeVoiceEnhancerValue(
    descriptor: VoiceEnhancerParameterDescriptor,
    value: number,
): number {
    const clamped = Math.min(descriptor.max, Math.max(descriptor.min, value));
    return descriptor.scale === "log"
        ? Math.log(clamped / descriptor.min) / Math.log(descriptor.max / descriptor.min)
        : (clamped - descriptor.min) / (descriptor.max - descriptor.min);
}

export function denormalizeVoiceEnhancerValue(
    descriptor: VoiceEnhancerParameterDescriptor,
    normalizedValue: number,
): number {
    const clamped = Math.min(1, Math.max(0, normalizedValue));
    return descriptor.scale === "log"
        ? descriptor.min * ((descriptor.max / descriptor.min) ** clamped)
        : descriptor.min + ((descriptor.max - descriptor.min) * clamped);
}
