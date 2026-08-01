import type { EffectModuleId } from "./target-descriptor";

/** One choice exposed by a discrete rack parameter. */
export type RackParameterChoice = {
    readonly value: number;
    readonly label: string;
};

/** Authoritative UI/DSP contract for one rack parameter. */
export type RackParameterDescriptor = {
    readonly id: string;
    readonly effectId: EffectModuleId;
    readonly endpointID: string;
    readonly label: string;
    readonly shortLabel: string;
    readonly min: number;
    readonly max: number;
    readonly initial: number;
    readonly step: number;
    readonly scale: "linear" | "log";
    readonly unit: "" | "%" | "Hz" | "ms" | "dB" | "deg" | "st";
    readonly choices?: ReadonlyArray<RackParameterChoice>;
    readonly quick: boolean;
    readonly modulationTargetIndex: number | null;
};

/** Stable identity information for a rack module. Icons are vendored fontaudio SVGs. */
export type RackEffectDescriptor = {
    readonly id: EffectModuleId;
    readonly label: string;
    readonly summary: string;
    readonly iconUrl: string;
    readonly parameters: ReadonlyArray<RackParameterDescriptor>;
};

const choice = (label: string, value: number): RackParameterChoice => ({ label, value });

function vendoredIconUrl(resolveUrl: () => string, fallback: string) {
    try {
        return resolveUrl();
    } catch {
        // The plain-node contract-test loader evaluates modules from data: URLs.
        return fallback;
    }
}

const RACK_ICON_URLS: Readonly<Record<EffectModuleId, string>> = Object.freeze({
    filter: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-filter-lowpass.svg", import.meta.url).href,
        "../assets/fontaudio/fad-filter-lowpass.svg",
    ),
    drive: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-softclipcurve.svg", import.meta.url).href,
        "../assets/fontaudio/fad-softclipcurve.svg",
    ),
    ott: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-arrows-vert.svg", import.meta.url).href,
        "../assets/fontaudio/fad-arrows-vert.svg",
    ),
    chorus: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-modsine.svg", import.meta.url).href,
        "../assets/fontaudio/fad-modsine.svg",
    ),
    flanger: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-phase.svg", import.meta.url).href,
        "../assets/fontaudio/fad-phase.svg",
    ),
    phaser: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-filter-notch.svg", import.meta.url).href,
        "../assets/fontaudio/fad-filter-notch.svg",
    ),
    delay: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-repeat.svg", import.meta.url).href,
        "../assets/fontaudio/fad-repeat.svg",
    ),
    reverb: vendoredIconUrl(
        () => new URL("../assets/fontaudio/fad-stereo.svg", import.meta.url).href,
        "../assets/fontaudio/fad-stereo.svg",
    ),
});

const p = (
    effectId: EffectModuleId,
    endpointID: string,
    label: string,
    shortLabel: string,
    min: number,
    max: number,
    initial: number,
    options: Partial<Omit<RackParameterDescriptor, "id" | "effectId" | "endpointID" | "label" | "shortLabel" | "min" | "max" | "initial">> = {},
): RackParameterDescriptor => ({
    id: `${effectId}.${endpointID}`,
    effectId,
    endpointID,
    label,
    shortLabel,
    min,
    max,
    initial,
    step: options.step ?? (max - min) / 1000,
    scale: options.scale ?? "linear",
    unit: options.unit ?? "",
    choices: options.choices,
    quick: options.quick ?? false,
    modulationTargetIndex: options.modulationTargetIndex ?? null,
});

const PHASER_DIVISIONS = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"];
const DELAY_DIVISIONS = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"];

const definitions: ReadonlyArray<Omit<RackEffectDescriptor, "parameters"> & { readonly parameters: ReadonlyArray<RackParameterDescriptor> }> = [
    {
        id: "filter",
        label: "Global Filter",
        summary: "Final tone shaping for the complete voice mix.",
        iconUrl: RACK_ICON_URLS.filter,
        parameters: [
            p("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 0, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(choice), quick: true }),
            p("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 20_000, 20_000, { unit: "Hz", scale: "log", quick: true, modulationTargetIndex: 0 }),
            p("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1 }),
            p("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
        ],
    },
    {
        id: "drive",
        label: "Distortion",
        summary: "Classic clipping or harmonic-residue saturation.",
        iconUrl: RACK_ICON_URLS.drive,
        parameters: [
            p("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [choice("Classic", 0), choice("Harmonics", 1)] }),
            p("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: true, modulationTargetIndex: 3 }),
            p("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
            p("drive", "distortionWet", "Mix", "Mix", 0, 1, 0, { quick: true, modulationTargetIndex: 5 }),
            p("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4_000, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6 }),
            p("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 20_000, 18_000, { unit: "Hz", scale: "log", modulationTargetIndex: 7 }),
        ],
    },
    {
        id: "ott",
        label: "OTT",
        summary: "Upward/downward multiband dynamics with envelope matching.",
        iconUrl: RACK_ICON_URLS.ott,
        parameters: [
            p("ott", "ottMix", "Mix", "Mix", 0, 100, 100, { unit: "%", quick: true, modulationTargetIndex: 8 }),
            p("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: true, modulationTargetIndex: 9 }),
            p("ott", "ottTimePercent", "Time", "Time", 10, 1_000, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
            p("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
            p("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
        ],
    },
    {
        id: "chorus",
        label: "Chorus",
        summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
        iconUrl: RACK_ICON_URLS.chorus,
        parameters: [
            p("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide Slow", "Classic", "Fast Light"].map(choice) }),
            p("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Small+Shimmer", "Large+Shimmer"].map(choice) }),
            p("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: true, modulationTargetIndex: 13 }),
            p("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
            p("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
            p("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
            p("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(choice) }),
            p("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 }),
        ],
    },
    {
        id: "flanger",
        label: "Flanger",
        summary: "Short swept comb delay with signed feedback.",
        iconUrl: RACK_ICON_URLS.flanger,
        parameters: [
            p("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: true, modulationTargetIndex: 18 }),
            p("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: true, modulationTargetIndex: 19 }),
            p("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
            p("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 21 }),
        ],
    },
    {
        id: "phaser",
        label: "Phaser",
        summary: "Eight-pole swept all-pass network with Free/Sync rate.",
        iconUrl: RACK_ICON_URLS.phaser,
        parameters: [
            p("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [choice("Free", 0), choice("Sync", 1)] }),
            p("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: true, modulationTargetIndex: 22 }),
            p("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: PHASER_DIVISIONS.map(choice) }),
            p("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
            p("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8_000, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24 }),
            p("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
            p("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
            p("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0, { quick: true, modulationTargetIndex: 27 }),
        ],
    },
    {
        id: "delay",
        label: "Delay",
        summary: "Tape-gliding stereo delay with Free/Sync timing.",
        iconUrl: RACK_ICON_URLS.delay,
        parameters: [
            p("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [choice("Free", 0), choice("Sync", 1)] }),
            p("delay", "delayTime", "Time", "Time", 1, 2_000, 375, { unit: "ms", scale: "log", quick: true, modulationTargetIndex: 28 }),
            p("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: DELAY_DIVISIONS.map(choice) }),
            p("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
            p("delay", "delayFilter", "Filter", "Filt", 200, 18_000, 6_000, { unit: "Hz", scale: "log", modulationTargetIndex: 30 }),
            p("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: true, modulationTargetIndex: 31 }),
        ],
    },
    {
        id: "reverb",
        label: "Reverb",
        summary: "Modulated early reflections into a four-line stereo tank.",
        iconUrl: RACK_ICON_URLS.reverb,
        parameters: [
            p("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: true, modulationTargetIndex: 32 }),
            p("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: true, modulationTargetIndex: 33 }),
            p("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
            p("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 }),
        ],
    },
];

/** Complete ordered rack catalog. */
export const RACK_EFFECT_DESCRIPTORS: ReadonlyArray<RackEffectDescriptor> = definitions;

/** Look up a stable rack module or fail at the catalog boundary. */
export function getRackEffectDescriptor(effectId: EffectModuleId): RackEffectDescriptor {
    const descriptor = RACK_EFFECT_DESCRIPTORS.find((candidate) => candidate.id === effectId);
    if (descriptor === undefined) {
        throw new Error(`Unknown rack effect: ${effectId}`);
    }
    return descriptor;
}

/** Complete parameter list used by UI, modulation binding, and contract tests. */
export function allRackParameterDescriptors(): ReadonlyArray<RackParameterDescriptor> {
    return RACK_EFFECT_DESCRIPTORS.flatMap((effect) => effect.parameters);
}

/** Format a raw engine value with the descriptor's unit and scale vocabulary. */
export function formatRackParameterValue(descriptor: RackParameterDescriptor, value: number): string {
    if (descriptor.choices !== undefined) {
        return descriptor.choices.find((item) => item.value === Math.round(value))?.label ?? String(Math.round(value));
    }
    if (descriptor.unit === "%") return `${Math.round(value)}%`;
    if (descriptor.unit === "Hz") return value >= 1_000 ? `${(value / 1_000).toFixed(value >= 10_000 ? 1 : 2)}kHz` : `${Math.round(value)}Hz`;
    if (descriptor.unit === "ms") return `${Math.round(value)}ms`;
    if (descriptor.unit === "dB") return `${value.toFixed(1)}dB`;
    if (descriptor.unit === "deg") return `${Math.round(value)}°`;
    if (descriptor.unit === "st") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}st`;
    return `${Math.round(value * 100)}%`;
}
