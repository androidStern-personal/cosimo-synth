import {
    STUTTER_DEFAULT_GATE,
    STUTTER_DEFAULT_SHAPE,
    STUTTER_DEFAULT_SLICES,
    STUTTER_DEFAULT_SPEED,
    STUTTER_SLICES_MAX,
    STUTTER_SLICES_MIN,
    STUTTER_SPEED_MAX,
    STUTTER_SPEED_MIN,
} from "./stutter-envelope";
import { TALK_BOX_VOWELS } from "./talk-box-contract";

export const SEQFX_PARAM_COUNT = 8;

export const SEQFX_EFFECT_TYPES = {
    empty: 0,
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
    pitch: 5,
    comb: 6,
    ring: 7,
    reverse: 8,
    talkBox: 9,
    vibro: 10,
    flange: 11,
    dirty: 12,
} as const;

export type SeqFxEffectType = typeof SEQFX_EFFECT_TYPES[keyof typeof SEQFX_EFFECT_TYPES];
export type SeqFxEffectLifecycle = "gated" | "captured" | "gesture" | "tail" | "modulatedDelay";
export type SeqFxParameterScale = "linear" | "log";
export type SeqFxParameterLatch = "continuous" | "trigger";
export type SeqFxParameterSection = "primary" | "advanced";

export type SeqFxParameterDefinition = {
    id: string;
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    step: number;
    unit: "" | "%" | "bits" | "cents" | "dB" | "degrees" | "Hz" | "ms" | "Q" | "s" | "semitones" | "x";
    scale: SeqFxParameterScale;
    latch: SeqFxParameterLatch;
    auxEligible: boolean;
    integer: boolean;
    section: SeqFxParameterSection;
    hint?: string;
    options?: readonly string[];
};

export type SeqFxFactoryEffectPreset = {
    id: string;
    name: string;
    description: string;
    mix: number;
    params: readonly number[];
};

export type SeqFxEffectDefinition = {
    id: SeqFxEffectType;
    key: string;
    name: string;
    shortName: string;
    fontaudioIcon: string;
    lifecycle: SeqFxEffectLifecycle;
    parameters: readonly SeqFxParameterDefinition[];
    factoryPresets: readonly SeqFxFactoryEffectPreset[];
};

const parameter = (
    id: string,
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    step: number,
    options: Partial<Omit<SeqFxParameterDefinition, "id" | "label" | "min" | "max" | "defaultValue" | "step">> = {},
): SeqFxParameterDefinition => ({
    id,
    label,
    min,
    max,
    defaultValue,
    step,
    unit: "",
    scale: "linear",
    latch: "continuous",
    auxEligible: true,
    integer: false,
    section: "primary",
    ...options,
});

function decimalPlacesForStep(step: number, maximum = 3) {
    if (!Number.isFinite(step) || step >= 1) {
        return 0;
    }

    return Math.min(maximum, Math.max(0, Math.ceil(-Math.log10(step))));
}

function compactNumber(value: number, decimals: number) {
    const normalized = Math.abs(value) < 0.0000001 ? 0 : value;
    return Number(normalized.toFixed(decimals)).toString();
}

/** Formats the physical value stored in SeqFX state without hiding its unit or scale. */
export function formatSeqFxParameterValue(definition: SeqFxParameterDefinition, value: number): string {
    const safeValue = Number.isFinite(value) ? value : definition.defaultValue;
    const option = definition.options?.[Math.round(safeValue)];
    if (option !== undefined) {
        return option;
    }

    const decimals = definition.integer ? 0 : decimalPlacesForStep(definition.step);
    switch (definition.unit) {
        case "%":
            return `${compactNumber(safeValue * 100, decimalPlacesForStep(definition.step * 100, 1))}%`;
        case "bits":
            return `${compactNumber(safeValue, 0)} bits`;
        case "cents":
            return `${compactNumber(safeValue, decimals)} cents`;
        case "dB":
            return `${compactNumber(safeValue, decimals)} dB`;
        case "degrees":
            return `${compactNumber(safeValue, decimals)}\u00b0`;
        case "Hz": {
            const displayHz = Number(safeValue.toFixed(decimals));
            if (Math.abs(displayHz) >= 1_000) {
                return `${compactNumber(displayHz / 1_000, Math.abs(displayHz) >= 10_000 ? 1 : 2)} kHz`;
            }
            return `${compactNumber(displayHz, decimals)} Hz`;
        }
        case "ms":
            if (Math.abs(safeValue) >= 1_000) {
                return `${compactNumber(safeValue / 1_000, 2)} s`;
            }
            return `${compactNumber(safeValue, decimals)} ms`;
        case "Q":
            return `Q ${compactNumber(safeValue, decimals)}`;
        case "s":
            return `${compactNumber(safeValue, decimals)} s`;
        case "semitones":
            return `${compactNumber(safeValue, decimals)} semitones`;
        case "x":
            return `${compactNumber(safeValue, decimals)}\u00d7`;
        case "":
        default:
            return compactNumber(safeValue, decimals);
    }
}

export function formatSeqFxParameterRange(definition: SeqFxParameterDefinition): string {
    return `${formatSeqFxParameterValue(definition, definition.min)} to ${formatSeqFxParameterValue(definition, definition.max)}`;
}

const definitions = [
    {
        id: SEQFX_EFFECT_TYPES.empty,
        key: "empty",
        name: "Empty",
        shortName: "",
        fontaudioIcon: "",
        lifecycle: "gated",
        parameters: [],
        factoryPresets: [],
    },
    {
        id: SEQFX_EFFECT_TYPES.filter,
        key: "filter",
        name: "Filter",
        shortName: "FLT",
        fontaudioIcon: "fad-filter-lowpass",
        lifecycle: "gated",
        parameters: [
            parameter("mode", "Mode", 0, 2, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Low Pass", "High Pass", "Band Pass"] }),
            parameter("cutoff", "Cutoff", 20, 20_000, 2_000, 1, { unit: "Hz", scale: "log", hint: "Start frequency for the authored filter move." }),
            parameter("legacyEndCutoff", "End Cutoff", 20, 20_000, 500, 1, { unit: "Hz", scale: "log", auxEligible: false, section: "advanced", hint: "Stored end point edited by the filter range surface." }),
            parameter("resonance", "Resonance", 0.1, 20, 0.707, 0.001, { unit: "Q", scale: "log" }),
            parameter("durationScale", "Duration", 0.25, 4, 1, 0.01, { unit: "x", auxEligible: false, section: "advanced", hint: "Legacy timing scale retained for state compatibility." }),
        ],
        factoryPresets: [
            { id: "warm-low-pass", name: "Warm Low Pass", description: "Softly removes the top without hollowing the source.", mix: 0.72, params: [0, 1_250, 1_250, 0.82, 1] },
            { id: "telephone-band", name: "Telephone Band", description: "Focused mid-band for vocal and drum punctuation.", mix: 0.82, params: [2, 1_350, 1_350, 2.4, 1] },
            { id: "air-cut", name: "Air Cut", description: "High-pass utility move with restrained resonance.", mix: 0.68, params: [1, 5_800, 5_800, 0.9, 1] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.crusher,
        key: "crush",
        name: "Crush",
        shortName: "CRSH",
        fontaudioIcon: "fad-digital0",
        lifecycle: "gated",
        parameters: [
            parameter("bits", "Bits", 2, 16, 8, 1, { unit: "bits", integer: true }),
            parameter("rateHz", "Rate", 200, 48_000, 48_000, 1, { unit: "Hz", scale: "log", hint: "Converter sample rate; lower values produce wider steps and more aliasing." }),
            parameter("drive", "Drive", 0, 36, 0, 0.1, { unit: "dB" }),
            parameter("character", "Character", 0, 3, 1, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["Original", "Classic", "Smooth", "Progressive"],
            }),
            parameter("adcQuality", "ADC Q", 0, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Pre-converter anti-alias filtering." }),
            parameter("dacQuality", "DAC Q", 0, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Post-converter reconstruction filtering." }),
            parameter("dither", "Dither", 0, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Deterministic TPDF dither at the quantizer." }),
        ],
        factoryPresets: [
            { id: "dusty-12-bit", name: "Dusty 12-bit", description: "Gentle converter grain with a stable top end.", mix: 0.58, params: [12, 22_050, 4, 2, 0.35, 0.25, 0.18] },
            { id: "console-game", name: "Console Game", description: "Audible low-rate crunch without maximum alias stress.", mix: 0.74, params: [7, 8_000, 8, 1, 0.12, 0.18, 0.08] },
            { id: "broken-converter", name: "Broken Converter", description: "Progressive conversion damage for short fills.", mix: 0.66, params: [5, 3_200, 14, 3, 0.7, 0.62, 0.22] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.tapeStop,
        key: "tapeStop",
        name: "Tape Stop",
        shortName: "TAPE",
        fontaudioIcon: "fad-stop",
        lifecycle: "gesture",
        parameters: [
            parameter("stopDivision", "Stop Time", 0, 8, 8, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "4 Beats", "8 Beats", "16 Beats", "1 Cell"],
                hint: "How long the motor takes to stop; it may outlive the block.",
            }),
            parameter("curve", "Curve", -1, 1, 0, 0.01, { latch: "trigger", auxEligible: false, hint: "Center is linear speed; left and right move the braking weight." }),
            parameter("returnMode", "Return", 0, 1, 0, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["Crossfade to Live", "Spin Up"],
                hint: "Crossfade to Live hands off in 10 ms; Spin Up restarts the captured motor over Start Time, then hands off without chasing the live timeline.",
            }),
            parameter("startDivision", "Start Time", 0, 8, 1, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                section: "advanced",
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "4 Beats", "8 Beats", "16 Beats", "1 Cell"],
            }),
            parameter("character", "Character", 0, 1, 0, 0.01, { unit: "%", latch: "trigger", auxEligible: false, section: "advanced", hint: "Adds bounded high-frequency loss and saturation as the tape slows." }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                section: "advanced",
                options: ["Sync", "Free"],
            }),
            parameter("freeStopMs", "Free Stop", 20, 8_000, 500, 1, {
                unit: "ms",
                scale: "log",
                latch: "trigger",
                auxEligible: false,
                section: "advanced",
                hint: "Absolute stop time used when Timing is Free.",
            }),
            parameter("freeStartMs", "Free Start", 20, 8_000, 125, 1, {
                unit: "ms",
                scale: "log",
                latch: "trigger",
                auxEligible: false,
                section: "advanced",
                hint: "Absolute Spin Up return time used when Timing is Free.",
            }),
        ],
        factoryPresets: [
            { id: "one-cell-brake", name: "One-cell Brake", description: "The central authored gesture: one cell triggers a clear stop and quick handoff to live input.", mix: 1, params: [8, 0.1, 0, 1, 0.18, 0, 500, 125] },
            { id: "slow-vinyl-stop", name: "Slow Vinyl Stop", description: "Long curved slowdown with a spun-up return.", mix: 1, params: [4, 0.58, 1, 3, 0.42, 0, 1_000, 500] },
            { id: "free-brake-750", name: "Free Brake 750", description: "Absolute-time brake for material that must ignore tempo changes.", mix: 1, params: [8, -0.22, 0, 1, 0.28, 1, 750, 160] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.stutter,
        key: "stutter",
        name: "Stutter",
        shortName: "STUT",
        fontaudioIcon: "fad-repeat",
        lifecycle: "captured",
        parameters: [
            parameter("slices", "Slices", STUTTER_SLICES_MIN, STUTTER_SLICES_MAX, STUTTER_DEFAULT_SLICES, 1, { latch: "trigger", integer: true, hint: "Divide the block, capture its first slice up to one second, then repeat it." }),
            parameter("speed", "Speed", STUTTER_SPEED_MIN, STUTTER_SPEED_MAX, STUTTER_DEFAULT_SPEED, 0.01, { unit: "x", hint: "1\u00d7 keeps the captured pitch." }),
            parameter("shape", "Shape", 0, 1, STUTTER_DEFAULT_SHAPE, 0.01, { hint: "Morphs the per-cut envelope." }),
            parameter("gate", "Gate", 0, 1, STUTTER_DEFAULT_GATE, 0.01, { unit: "%", hint: "Audible portion of each cut." }),
        ],
        factoryPresets: [
            { id: "tight-eighths", name: "Tight Eighths", description: "Clean repeat fill with a short gated envelope.", mix: 0.82, params: [8, 1, 0.2, 0.72] },
            { id: "triplet-ratchet", name: "Triplet Ratchet", description: "Fast ratchet whose tail stays controlled.", mix: 0.76, params: [12, 1.25, 0.52, 0.58] },
            { id: "falling-chop", name: "Falling Chop", description: "Slower repeats with a shaped exit for transitions.", mix: 0.84, params: [6, 0.75, 0.82, 0.88] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.pitch,
        key: "pitch",
        name: "Pitch",
        shortName: "PTCH",
        fontaudioIcon: "fad-arrows-vert",
        lifecycle: "captured",
        parameters: [
            parameter("semitones", "Pitch", -24, 24, 0, 1, { unit: "semitones", integer: true, hint: "Semitone shift; direct edits snap while modulation follows a smoothed continuous path." }),
            parameter("cents", "Fine", -100, 100, 0, 1, { unit: "cents", integer: true, hint: "Fine pitch offset in cents." }),
            parameter("grainMs", "Grain", 10, 120, 48, 0.1, { unit: "ms", scale: "log", latch: "trigger", auxEligible: false, hint: "Trigger-latched grain window; longer values trade transient detail for smoother sustained sound." }),
            parameter("jitter", "Jitter", 0, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Seeded grain-birth pitch and position variation." }),
            parameter("spread", "Spread", 0, 1, 0.35, 0.01, { unit: "%", section: "advanced", hint: "Symmetric left/right source-position offset; zero remains dual mono." }),
        ],
        factoryPresets: [
            { id: "octave-up", name: "Octave Up", description: "Focused octave lift with a medium stable grain.", mix: 0.78, params: [12, 0, 52, 0, 0.18] },
            { id: "octave-down", name: "Octave Down", description: "Weighty octave drop for bass and transitions.", mix: 0.82, params: [-12, 0, 68, 0, 0.12] },
            { id: "detuned-cloud", name: "Detuned Cloud", description: "Subtle stereo micro-pitch for sustained harmony.", mix: 0.55, params: [0, -11, 74, 0.08, 0.72] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.comb,
        key: "comb",
        name: "Comb",
        shortName: "COMB",
        fontaudioIcon: "fad-filter-notch",
        lifecycle: "tail",
        parameters: [
            parameter("tuneHz", "Tune", 30, 8_000, 220, 0.01, { unit: "Hz", scale: "log", hint: "Center frequency of the conventional and dispersed resonances." }),
            parameter("decaySeconds", "Decay", 0.02, 8, 1.4, 0.01, { unit: "s", scale: "log", hint: "Time for the feedback loop to fall by 60 dB." }),
            parameter("polarity", "Polarity", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Positive", "Negative"] }),
            parameter("dispersion", "Dispersion", 0, 1, 0.55, 0.01, { unit: "%", hint: "Morphs from the reference comb into compensated coupled modes." }),
            parameter("dampingHz", "Damping", 500, 20_000, 20_000, 1, { unit: "Hz", scale: "log", section: "advanced", hint: "Lowers this ceiling to shorten high-frequency feedback decay." }),
            parameter("motion", "Motion", 0, 1, 0.12, 0.01, { unit: "%", section: "advanced", hint: "Adds deterministic phase-offset motion to the dispersed modes." }),
            parameter("drive", "Drive", 0, 1, 0.18, 0.01, { unit: "%", section: "advanced", hint: "Adds unity-small-signal saturation inside the feedback network." }),
            parameter("width", "Width", 0, 1, 0.65, 0.01, { unit: "%", section: "advanced", hint: "Moves from a mono-safe center to complementary stereo projection." }),
        ],
        factoryPresets: [
            { id: "wooden-string", name: "Wooden String", description: "Recognizably tuned resonance with restrained dispersion.", mix: 0.64, params: [220, 1.8, 0, 0.22, 6_800, 0.05, 0.12, 0.42] },
            { id: "vector-bells", name: "Vector Bells", description: "Wide dispersive modes for melodic percussion.", mix: 0.7, params: [440, 2.8, 0, 0.72, 9_500, 0.16, 0.24, 0.82] },
            { id: "negative-metal", name: "Negative Metal", description: "Darker negative-polarity resonance with slow motion.", mix: 0.62, params: [110, 3.6, 1, 0.62, 4_200, 0.22, 0.2, 0.6] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.ring,
        key: "ring",
        name: "Ring",
        shortName: "RING",
        fontaudioIcon: "fad-modsine",
        lifecycle: "gated",
        parameters: [
            parameter("frequencyHz", "Frequency", 0.1, 12_000, 180, 0.01, { unit: "Hz", scale: "log", hint: "Carrier frequency; sine creates exact sum and difference sidebands." }),
            parameter("waveform", "Wave", 0, 3, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sine", "Triangle", "Square", "Noise"] }),
            parameter("motion", "Motion", 0, 1, 0, 0.01, { unit: "%", hint: "Adds a phase-continuous one-octave carrier sweep." }),
            parameter("rateHz", "Rate", 0.02, 20, 0.5, 0.01, { unit: "Hz", scale: "log", section: "advanced", hint: "Free-running motion rate." }),
            parameter("spread", "Spread", 0, 1, 0.08, 0.01, { unit: "%", section: "advanced", hint: "Small opposite left/right carrier detunes, up to 25 cents per channel." }),
            parameter("bias", "Bias", -1, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Moves ring modulation toward positive or inverted dry signal." }),
            parameter("rectify", "Rectify", -1, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Morphs the carrier toward positive or negative full-wave rectification." }),
        ],
        factoryPresets: [
            { id: "soft-tremolo", name: "Soft Tremolo", description: "Low-frequency sine ring for a musical pulse.", mix: 0.56, params: [5.5, 0, 0.08, 0.24, 0.08, 0.34, 0.18] },
            { id: "sideband-chime", name: "Sideband Chime", description: "Clear pitched sidebands with gentle stereo spread.", mix: 0.72, params: [440, 0, 0, 0.5, 0.2, 0, 0] },
            { id: "robot-square", name: "Robot Square", description: "Square carrier and motion for short vocal blocks.", mix: 0.64, params: [96, 2, 0.38, 2.2, 0.12, 0.08, 0.32] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.reverse,
        key: "reverse",
        name: "Reverse",
        shortName: "REV",
        fontaudioIcon: "fad-backward",
        lifecycle: "captured",
        parameters: [
            parameter("division", "Length", 0, 4, 4, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/32", "1/16", "1/8", "1/4", "1 Cell"],
                hint: "Trigger-latched rolling-lookback length.",
            }),
            parameter("crossfade", "Crossfade", 0, 0.25, 0.08, 0.001, { unit: "%", hint: "Proportion of each window used to blend into the next captured lookback." }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sync", "Free"] }),
            parameter("freeMs", "Free Length", 20, 4_000, 250, 1, {
                unit: "ms",
                scale: "log",
                latch: "trigger",
                auxEligible: false,
                section: "advanced",
                hint: "Absolute window length used when Timing is Free.",
            }),
            parameter("decay", "Decay", 0, 1, 1, 0.01, { unit: "%", section: "advanced", hint: "Where the reversed loop fades back to dry inside the block." }),
        ],
        factoryPresets: [
            { id: "one-cell-turn", name: "One-cell Turn", description: "Immediate rolling lookback with a clean cell boundary.", mix: 0.86, params: [4, 0.08, 0, 250, 1] },
            { id: "eighth-echo", name: "Eighth Echo", description: "Short repeated reverse with a soft decay.", mix: 0.74, params: [2, 0.12, 0, 250, 0.72] },
            { id: "free-voice-420", name: "Free Voice 420", description: "Absolute window tuned for phrases and spoken words.", mix: 0.82, params: [4, 0.1, 1, 420, 0.86] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.talkBox,
        key: "talkBox",
        name: "Talk Box",
        shortName: "TALK",
        fontaudioIcon: "fad-microphone",
        lifecycle: "gated",
        parameters: [
            parameter("fromVowel", "From", 0, 4, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: TALK_BOX_VOWELS, hint: "Starting vowel, latched when the block triggers." }),
            parameter("toVowel", "To", 0, 4, 3, 1, { latch: "trigger", auxEligible: false, integer: true, options: TALK_BOX_VOWELS, hint: "Destination vowel, latched when the block triggers." }),
            parameter("morph", "Morph", 0, 1, 0, 0.01, { unit: "%", hint: "Moves both formants between the selected vowels on a perceptual frequency scale." }),
            parameter("resonance", "Resonance", 1, 20, 6, 0.01, { unit: "Q", scale: "log", hint: "Controls the strength and width of both vocal resonances." }),
            parameter("lows", "Lows", 0, 1, 0.3, 0.01, { unit: "%", section: "advanced", hint: "Restores source signal below the formants." }),
            parameter("highs", "Highs", 0, 1, 0.15, 0.01, { unit: "%", section: "advanced", hint: "Restores source brightness above the formants." }),
            parameter("driveDb", "Drive", 0, 12, 0, 0.1, { unit: "dB", section: "advanced", hint: "Adds bounded excitation before the formant filters." }),
        ],
        factoryPresets: [
            { id: "a-to-o", name: "A to O", description: "Broad open-vowel morph for sustained source material.", mix: 0.76, params: [0, 3, 0.48, 6.5, 0.3, 0.14, 2] },
            { id: "ee-whisper", name: "Ee Whisper", description: "Bright focused formants with low passthrough.", mix: 0.68, params: [1, 2, 0.72, 9, 0.12, 0.26, 1] },
            { id: "robot-vowels", name: "Robot Vowels", description: "Narrow U-to-I scan with controlled saturation.", mix: 0.8, params: [4, 2, 0.36, 12, 0.2, 0.18, 5] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.vibro,
        key: "vibro",
        name: "Vibro",
        shortName: "VIB",
        fontaudioIcon: "fad-modtri",
        lifecycle: "modulatedDelay",
        parameters: [
            parameter("rateHz", "Rate", 0.05, 12, 4.5, 0.01, { unit: "Hz", scale: "log", hint: "Free-mode cycle rate; Sync derives the rate from Division and host tempo." }),
            parameter("depthCents", "Depth", 0, 100, 28, 0.1, { unit: "cents", hint: "Exact half peak-to-peak Doppler pitch span." }),
            parameter("waveform", "Wave", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sine", "Triangle"] }),
            parameter("spreadDegrees", "Spread", 0, 180, 90, 1, { unit: "degrees", section: "advanced", hint: "Right-channel phase offset; 0\u00b0 is mono-safe and 180\u00b0 is opposite motion." }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, section: "advanced", options: ["Sync", "Free"] }),
            parameter("division", "Division", 0, 5, 2, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                section: "advanced",
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar"],
            }),
        ],
        factoryPresets: [
            { id: "gentle-wobble", name: "Gentle Wobble", description: "Measured shallow Doppler movement for utility width.", mix: 0.54, params: [4.2, 16, 0, 72, 1, 2] },
            { id: "tape-warble", name: "Tape Warble", description: "Slow triangle drift with moderate pitch depth.", mix: 0.66, params: [0.72, 36, 1, 38, 1, 4] },
            { id: "wide-chirp", name: "Wide Chirp", description: "Fast wide modulation for short rhythmic blocks.", mix: 0.62, params: [7.8, 54, 0, 150, 1, 1] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.flange,
        key: "flange",
        name: "Flange",
        shortName: "FLNG",
        fontaudioIcon: "fad-phase",
        lifecycle: "modulatedDelay",
        parameters: [
            parameter("delayMs", "Delay", 0.2, 10, 1.2, 0.01, { unit: "ms", scale: "log", hint: "Minimum delay before modulation is added." }),
            parameter("depthMs", "Depth", 0, 10, 3.5, 0.01, { unit: "ms", hint: "Delay excursion added above the minimum." }),
            parameter("rateHz", "Rate", 0.02, 10, 0.28, 0.01, { unit: "Hz", scale: "log", hint: "Free-mode sweep rate; Sync derives the rate from Division and host tempo." }),
            parameter("feedback", "Feedback", 0, 0.95, 0.55, 0.01, { unit: "%", hint: "Wet signal returned to the short delay." }),
            parameter("spreadDegrees", "Spread", 0, 180, 120, 1, { unit: "degrees", section: "advanced", hint: "Right-channel modulation phase offset; 0\u00b0 stays dual mono." }),
            parameter("polarity", "Polarity", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, section: "advanced", options: ["Normal", "Inverse"] }),
            parameter("timingMode", "Timing", 0, 1, 1, 1, { latch: "trigger", auxEligible: false, integer: true, section: "advanced", options: ["Sync", "Free"] }),
            parameter("division", "Division", 0, 6, 5, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                section: "advanced",
                options: ["1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars"],
            }),
        ],
        factoryPresets: [
            { id: "silk-flange", name: "Silk Flange", description: "Shallow slow comb movement with modest feedback.", mix: 0.52, params: [1.4, 2.2, 0.18, 0.32, 82, 0, 1, 5] },
            { id: "jet-pass", name: "Jet Pass", description: "Classic pronounced sweep for transition blocks.", mix: 0.68, params: [0.65, 5.8, 0.42, 0.66, 128, 0, 1, 4] },
            { id: "hollow-inverse", name: "Hollow Inverse", description: "Inverse-loop coloration with restrained feedback.", mix: 0.6, params: [2.4, 3.8, 0.3, 0.48, 160, 1, 1, 5] },
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.dirty,
        key: "dirty",
        name: "Dirty",
        shortName: "DIRT",
        fontaudioIcon: "fad-hardclipcurve",
        lifecycle: "gated",
        parameters: [
            parameter("driveDb", "Drive", 0, 36, 12, 0.1, { unit: "dB", hint: "Level into the fixed 4\u00d7 oversampled nonlinear stage." }),
            parameter("character", "Character", 0, 3, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Soft", "Hard", "Fold", "Bias"] }),
            parameter("bias", "Bias", -1, 1, 0, 0.01, { unit: "%", section: "advanced", hint: "Offsets the transfer curve for even-harmonic asymmetry." }),
            parameter("dynamics", "Dynamics", 0, 1, 0.65, 0.01, { unit: "%", hint: "Restores the source signal's level contrast after saturation." }),
            parameter("toneHz", "Tone", 500, 20_000, 12_000, 1, { unit: "Hz", scale: "log", hint: "Low-passes only the nonlinear residue, preserving the dry fundamental." }),
            parameter("trimDb", "Trim", -18, 6, -6, 0.1, { unit: "dB", section: "advanced", hint: "Output gain after dynamics compensation." }),
        ],
        factoryPresets: [
            { id: "warm-grit", name: "Warm Grit", description: "Level-conscious soft drive that keeps the source dynamic.", mix: 0.58, params: [10, 0, 0, 0.78, 9_500, -5] },
            { id: "hard-punch", name: "Hard Punch", description: "Harder transient edge with output compensation.", mix: 0.64, params: [17, 1, 0, 0.58, 13_000, -8] },
            { id: "folded-bias", name: "Folded Bias", description: "Asymmetric folded color for short accents.", mix: 0.56, params: [21, 2, 0.24, 0.42, 7_200, -10] },
        ],
    },
] as const satisfies readonly SeqFxEffectDefinition[];

export const SEQFX_EFFECT_DEFINITIONS: readonly SeqFxEffectDefinition[] = definitions;
export const SEQFX_EFFECT_IDS = definitions.map((definition) => definition.id) as readonly SeqFxEffectType[];
export const SEQFX_SELECTABLE_EFFECT_IDS = SEQFX_EFFECT_IDS.filter(
    (effectType) => effectType !== SEQFX_EFFECT_TYPES.empty,
);

const definitionByID = new Map<SeqFxEffectType, SeqFxEffectDefinition>(
    definitions.map((definition) => [definition.id, definition]),
);

export const SEQFX_EFFECT_TYPE_NAMES = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.name]),
) as Record<SeqFxEffectType, string>;

export const SEQFX_EFFECT_TYPE_SHORT_NAMES = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.shortName]),
) as Record<SeqFxEffectType, string>;

export function isSeqFxEffectType(value: unknown): value is SeqFxEffectType {
    return typeof value === "number" && Number.isInteger(value) && definitionByID.has(value as SeqFxEffectType);
}

export function getSeqFxEffectDefinition(effectType: number): SeqFxEffectDefinition {
    return definitionByID.get(effectType as SeqFxEffectType) ?? definitionByID.get(SEQFX_EFFECT_TYPES.empty)!;
}

export function getSeqFxDefaultParams(effectType: number): number[] {
    const definition = getSeqFxEffectDefinition(effectType);
    return Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, index) => (
        definition.parameters[index]?.defaultValue ?? 0
    ));
}

export function getSeqFxParamLimits(effectType: number, paramIndex: number): readonly [number, number] {
    const definition = getSeqFxEffectDefinition(effectType);
    const parameterDefinition = definition.parameters[paramIndex];
    return parameterDefinition
        ? [parameterDefinition.min, parameterDefinition.max]
        : [0, 0];
}

export function isSeqFxIntegerParam(effectType: number, paramIndex: number): boolean {
    return getSeqFxEffectDefinition(effectType).parameters[paramIndex]?.integer ?? false;
}

export function isSeqFxTriggerLatchedDefinition(effectType: number, paramIndex: number): boolean {
    return getSeqFxEffectDefinition(effectType).parameters[paramIndex]?.latch === "trigger";
}
