import {
    FILTER_Q_MAX,
    FILTER_Q_MIN,
    normalizedToFilterQ,
} from "./filter-response";

export type CurveCoefficientDefinition = {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    formatValue?: (value: number) => string;
};

export type CurveFamilyDefinition = {
    id: string;
    label: string;
    equation: string;
    description: string;
    coefficients: CurveCoefficientDefinition[];
    evaluate: (normalizedInput: number, coefficients: Record<string, number>) => number;
};

export type CurveTargetDefinition = {
    id: string;
    label: string;
    description: string;
    defaultFamilyId: string;
    defaultProfile?: CurveProfile;
    allowedFamilyIds: string[];
    previewRangeLabel?: string;
    formatOutput?: (normalizedOutput: number) => string;
};

export type CurveProfile = {
    familyId: string;
    coefficients: Record<string, number>;
};

export type CurveLabState = {
    isOpen: boolean;
    activeTargetId: string;
    profiles: Record<string, CurveProfile>;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function formatQValue(value: number) {
    const qValue = normalizedToFilterQ(value);
    return `${qValue >= 10 ? qValue.toFixed(1) : qValue.toFixed(2)} Q`;
}

function smoothstep(value: number) {
    const clampedValue = clamp(value, 0, 1);
    return clampedValue * clampedValue * (3 - (2 * clampedValue));
}

function smootherstep(value: number) {
    const clampedValue = clamp(value, 0, 1);
    return clampedValue * clampedValue * clampedValue * (clampedValue * ((clampedValue * 6) - 15) + 10);
}

function evaluateBalancedPower(normalizedInput: number, coefficients: Record<string, number>) {
    const x = clamp(normalizedInput, 0, 1);
    const power = clamp(Number(coefficients.power) || 2.25, 0.35, 6);

    if (x <= 0.5) {
        return 0.5 * Math.pow(x * 2, power);
    }

    return 1 - (0.5 * Math.pow((1 - x) * 2, power));
}

function evaluateSmoothstepBlend(normalizedInput: number, coefficients: Record<string, number>) {
    const x = clamp(normalizedInput, 0, 1);
    const blend = clamp(Number(coefficients.blend) || 0.65, 0, 1);
    const shaping = clamp(Number(coefficients.shaping) || 0.6, 0, 1);
    const curved = (smoothstep(x) * (1 - shaping)) + (smootherstep(x) * shaping);
    return clamp((x * (1 - blend)) + (curved * blend), 0, 1);
}

function evaluateSigmoid(normalizedInput: number, coefficients: Record<string, number>) {
    const x = clamp(normalizedInput, 0, 1);
    const slope = clamp(Number(coefficients.slope) || 7, 0.5, 20);
    const center = clamp(Number(coefficients.center) || 0.5, 0.08, 0.92);
    const logistic = (sample: number) => 1 / (1 + Math.exp(-slope * (sample - center)));
    const low = logistic(0);
    const high = logistic(1);
    const span = Math.max(1e-9, high - low);
    return clamp((logistic(x) - low) / span, 0, 1);
}

export const CURVE_FAMILY_DEFINITIONS: CurveFamilyDefinition[] = [
    {
        id: "linear",
        label: "Linear",
        equation: "y = x",
        description: "Direct 1:1 motion with no shaping.",
        coefficients: [],
        evaluate: (normalizedInput) => clamp(normalizedInput, 0, 1),
    },
    {
        id: "balanced-power",
        label: "Balanced Power",
        equation: "Piecewise power S-curve",
        description: "Slower near the floor and ceiling, quicker through the middle.",
        coefficients: [
            {
                key: "power",
                label: "Power",
                min: 0.35,
                max: 6,
                step: 0.01,
                defaultValue: 2.25,
                formatValue: (value) => value.toFixed(2),
            },
        ],
        evaluate: evaluateBalancedPower,
    },
    {
        id: "smoothstep-blend",
        label: "Smoothstep Blend",
        equation: "mix(x, smoothstep(x), blend)",
        description: "Gentle S-curve that can stay close to linear or lean into a softer middle.",
        coefficients: [
            {
                key: "blend",
                label: "Blend",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.65,
                formatValue: formatPercent,
            },
            {
                key: "shaping",
                label: "Shape",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.6,
                formatValue: formatPercent,
            },
        ],
        evaluate: evaluateSmoothstepBlend,
    },
    {
        id: "sigmoid",
        label: "Sigmoid",
        equation: "Normalized logistic curve",
        description: "Lets you move the center and tighten or loosen the middle response.",
        coefficients: [
            {
                key: "slope",
                label: "Slope",
                min: 0.5,
                max: 20,
                step: 0.1,
                defaultValue: 7,
                formatValue: (value) => value.toFixed(1),
            },
            {
                key: "center",
                label: "Center",
                min: 0.08,
                max: 0.92,
                step: 0.01,
                defaultValue: 0.5,
                formatValue: (value) => `${Math.round(value * 100)}%`,
            },
        ],
        evaluate: evaluateSigmoid,
    },
];

export const CURVE_TARGET_DEFINITIONS: CurveTargetDefinition[] = [
    {
        id: "filter-resonance-handle",
        label: "Filter Resonance Drag",
        description: "Controls how the filter graph handle and resonance drag field translate vertical travel into resonance.",
        defaultFamilyId: "sigmoid",
        defaultProfile: {
            familyId: "sigmoid",
            coefficients: {
                slope: 11.1,
                center: 0.84,
            },
        },
        allowedFamilyIds: [
            "linear",
            "balanced-power",
            "smoothstep-blend",
            "sigmoid",
        ],
        previewRangeLabel: `${FILTER_Q_MIN.toFixed(1)} Q -> ${FILTER_Q_MAX.toFixed(0)} Q`,
        formatOutput: formatQValue,
    },
];

function getFamilyDefinitionInternal(familyId: string) {
    return CURVE_FAMILY_DEFINITIONS.find((candidate) => candidate.id === familyId) ?? CURVE_FAMILY_DEFINITIONS[0];
}

function getTargetDefinitionInternal(targetId: string) {
    return CURVE_TARGET_DEFINITIONS.find((candidate) => candidate.id === targetId) ?? CURVE_TARGET_DEFINITIONS[0];
}

export function getCurveFamilyDefinition(familyId: string) {
    return getFamilyDefinitionInternal(familyId);
}

export function getCurveTargetDefinition(targetId: string) {
    return getTargetDefinitionInternal(targetId);
}

export function createDefaultCurveProfile(targetId: string): CurveProfile {
    const target = getTargetDefinitionInternal(targetId);
    const requestedFamilyId = typeof target.defaultProfile?.familyId === "string"
        ? target.defaultProfile.familyId
        : target.defaultFamilyId;
    const family = target.allowedFamilyIds.includes(requestedFamilyId)
        ? getFamilyDefinitionInternal(requestedFamilyId)
        : getFamilyDefinitionInternal(target.defaultFamilyId);

    return {
        familyId: family.id,
        coefficients: Object.fromEntries(
            family.coefficients.map((coefficient) => {
                const requestedValue = target.defaultProfile?.coefficients?.[coefficient.key];
                const resolvedValue = Number.isFinite(Number(requestedValue))
                    ? Number(requestedValue)
                    : coefficient.defaultValue;
                return [
                    coefficient.key,
                    clamp(resolvedValue, coefficient.min, coefficient.max),
                ];
            }),
        ),
    };
}

export function createDefaultCurveLabState(): CurveLabState {
    const activeTarget = CURVE_TARGET_DEFINITIONS[0];

    return {
        isOpen: false,
        activeTargetId: activeTarget.id,
        profiles: Object.fromEntries(
            CURVE_TARGET_DEFINITIONS.map((target) => [target.id, createDefaultCurveProfile(target.id)]),
        ),
    };
}

export function sanitizeCurveProfile(targetId: string, profile: CurveProfile | null | undefined): CurveProfile {
    const target = getTargetDefinitionInternal(targetId);
    const fallback = createDefaultCurveProfile(target.id);
    const requestedFamilyId = typeof profile?.familyId === "string"
        ? profile.familyId
        : fallback.familyId;
    const family = target.allowedFamilyIds.includes(requestedFamilyId)
        ? getFamilyDefinitionInternal(requestedFamilyId)
        : getFamilyDefinitionInternal(fallback.familyId);
    const coefficients = Object.fromEntries(
        family.coefficients.map((definition) => {
            const rawValue = profile?.coefficients?.[definition.key];
            const resolvedValue = Number.isFinite(Number(rawValue))
                ? Number(rawValue)
                : definition.defaultValue;
            return [
                definition.key,
                clamp(resolvedValue, definition.min, definition.max),
            ];
        }),
    );

    return {
        familyId: family.id,
        coefficients,
    };
}

export function sanitizeCurveLabState(state: CurveLabState | null | undefined): CurveLabState {
    const fallback = createDefaultCurveLabState();
    const activeTargetId = CURVE_TARGET_DEFINITIONS.some((target) => target.id === state?.activeTargetId)
        ? state!.activeTargetId
        : fallback.activeTargetId;

    return {
        isOpen: state?.isOpen === true,
        activeTargetId,
        profiles: Object.fromEntries(
            CURVE_TARGET_DEFINITIONS.map((target) => [
                target.id,
                sanitizeCurveProfile(target.id, state?.profiles?.[target.id]),
            ]),
        ),
    };
}

export function evaluateCurveProfile(targetId: string, profile: CurveProfile, normalizedInput: number) {
    const target = getTargetDefinitionInternal(targetId);
    const sanitizedProfile = sanitizeCurveProfile(target.id, profile);
    const family = getFamilyDefinitionInternal(sanitizedProfile.familyId);
    return clamp(family.evaluate(normalizedInput, sanitizedProfile.coefficients), 0, 1);
}

export function invertCurveProfile(targetId: string, profile: CurveProfile, normalizedOutput: number) {
    const target = getTargetDefinitionInternal(targetId);
    const sanitizedProfile = sanitizeCurveProfile(target.id, profile);
    const desiredOutput = clamp(normalizedOutput, 0, 1);

    if (desiredOutput <= 0) {
        return 0;
    }

    if (desiredOutput >= 1) {
        return 1;
    }

    let low = 0;
    let high = 1;

    for (let iteration = 0; iteration < 32; iteration += 1) {
        const mid = (low + high) * 0.5;
        const sample = evaluateCurveProfile(target.id, sanitizedProfile, mid);

        if (sample < desiredOutput) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return (low + high) * 0.5;
}

export function sampleCurveProfile(targetId: string, profile: CurveProfile, sampleCount = 64) {
    const safeSampleCount = Math.max(2, Math.round(sampleCount));
    return Array.from({ length: safeSampleCount }, (_, index) => {
        const normalizedInput = index / Math.max(1, safeSampleCount - 1);
        return {
            normalizedInput,
            normalizedOutput: evaluateCurveProfile(targetId, profile, normalizedInput),
        };
    });
}

export function formatCurveTargetOutput(targetId: string, normalizedOutput: number) {
    const target = getTargetDefinitionInternal(targetId);
    return target.formatOutput?.(normalizedOutput) ?? `${Math.round(clamp(normalizedOutput, 0, 1) * 100)}%`;
}

export function getCurveTargetSummary(targetId: string, profile: CurveProfile) {
    const target = getCurveTargetDefinition(targetId);
    const family = getCurveFamilyDefinition(profile.familyId);
    return {
        target,
        family,
    };
}
