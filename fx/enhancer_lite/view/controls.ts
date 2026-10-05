/** The two nonlinear characters: Tube and Solid. */
export const ENHANCER_CURVES = ["tube", "solid"] as const;

/** The band's routing: both channels together, or mid and side separately. */
export const ENHANCER_MODES = ["stereo", "mid-side"] as const;

/** The two saturation intensities. */
export const ENHANCER_SATURATION_MODES = ["subtle", "medium"] as const;

/** The band's selection shapes. */
export const ENHANCER_LITE_SHAPES = ["low", "bell", "high"] as const;

/** A band selection shape. */
export type EnhancerLiteShape = typeof ENHANCER_LITE_SHAPES[number];

type ChoiceDescriptor<Kind extends string, Choices extends ReadonlyArray<string>> = {
    readonly kind: Kind;
    readonly id: string;
    readonly dspEndpointID: string;
    readonly initial: Choices[number];
    readonly choices: Choices;
};

/**
 * One control of the plugin: its DSP endpoint, its range or choices and its
 * initial value. Choice controls send the index of the selected choice.
 */
export type EnhancerLiteSettingDescriptor =
    | {
        readonly kind: "number";
        readonly id: string;
        readonly dspEndpointID: string;
        readonly min: number;
        readonly max: number;
        readonly initial: number;
        readonly unit: "Hz" | "";
    }
    | ChoiceDescriptor<"mode", typeof ENHANCER_MODES>
    | ChoiceDescriptor<"curve", typeof ENHANCER_CURVES>
    | ChoiceDescriptor<"saturation-mode", typeof ENHANCER_SATURATION_MODES>
    | ChoiceDescriptor<"shape", typeof ENHANCER_LITE_SHAPES>;

/** Every control the view draws and the browser preview simulates. */
export const ENHANCER_LITE_SETTING_DESCRIPTORS = [
    { kind: "number", id: "freqHz", dspEndpointID: "freqHzIn", min: 20, max: 20_000, initial: 130, unit: "Hz" },
    { kind: "number", id: "q", dspEndpointID: "qIn", min: 0.1, max: 10, initial: 0.71, unit: "" },
    { kind: "mode", id: "mode", dspEndpointID: "modeIn", initial: "stereo", choices: ENHANCER_MODES },
    { kind: "number", id: "midAmount", dspEndpointID: "midAmountIn", min: 0, max: 1, initial: 0, unit: "" },
    { kind: "number", id: "sideAmount", dspEndpointID: "sideAmountIn", min: 0, max: 1, initial: 0, unit: "" },
    { kind: "curve", id: "curve", dspEndpointID: "curveIn", initial: "solid", choices: ENHANCER_CURVES },
    { kind: "saturation-mode", id: "saturationMode", dspEndpointID: "saturationModeIn", initial: "subtle", choices: ENHANCER_SATURATION_MODES },
    { kind: "shape", id: "shape", dspEndpointID: "shapeIn", initial: "bell", choices: ENHANCER_LITE_SHAPES },
] as const satisfies ReadonlyArray<EnhancerLiteSettingDescriptor>;
