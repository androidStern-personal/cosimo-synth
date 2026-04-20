export const STUTTER_SLICES_MIN = 2;
export const STUTTER_SLICES_MAX = 32;
export const STUTTER_SPEED_MIN = 0.5;
export const STUTTER_SPEED_MAX = 2;
export const STUTTER_SPEED_STEP = 0.05;
export const STUTTER_DEFAULT_SLICES = 8;
export const STUTTER_DEFAULT_SPEED = 1;
export const STUTTER_DEFAULT_SHAPE = 0.55;
export const STUTTER_DEFAULT_GATE = 0.68;

export const STUTTER_SHAPE_NAMES = [
    "Gate",
    "Eased",
    "Triangle",
    "Bell",
    "Ramp Down",
    "Ramp Up",
] as const;

const EASED_EDGE = 0.12;
const RAMP_MAX_EXTRA_CONCAVITY = 4;

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

export function clampStutterSlices(value: number) {
    return Math.round(clamp(value, STUTTER_SLICES_MIN, STUTTER_SLICES_MAX));
}

export function clampStutterSpeed(value: number) {
    return clamp(value, STUTTER_SPEED_MIN, STUTTER_SPEED_MAX);
}

export function clampStutterShape(value: number) {
    return clamp(value, 0, 1);
}

export function clampStutterGate(value: number) {
    return clamp(value, 0, 1);
}

function smoothStep(value: number) {
    const x = clamp(value, 0, 1);
    return x * x * (3 - (2 * x));
}

function gateShape(_u: number) {
    return 1;
}

function easedShape(u: number) {
    if (u < EASED_EDGE) {
        return smoothStep(u / EASED_EDGE);
    }

    if (u > 1 - EASED_EDGE) {
        return smoothStep((1 - u) / EASED_EDGE);
    }

    return 1;
}

function triangleShape(u: number) {
    return u < 0.5 ? 2 * u : 2 * (1 - u);
}

function tentShape(u: number, peak: number) {
    if (peak <= 0.000001) {
        return 1 - u;
    }

    if (peak >= 0.999999) {
        return u;
    }

    if (u <= peak) {
        return u / peak;
    }

    return (1 - u) / (1 - peak);
}

function smoothBellShape(u: number, peak: number) {
    return smoothStep(tentShape(u, peak));
}

function bellShape(u: number) {
    return smoothBellShape(u, 0.5);
}

function rampDownShape(u: number) {
    return 1 - u;
}

function rampUpShape(u: number) {
    return u;
}

const STATIC_SHAPES = [
    gateShape,
    easedShape,
    triangleShape,
    bellShape,
    rampDownShape,
    rampUpShape,
] as const;

export function evaluateStutterEnvelope(phase: number, shape: number, gate: number) {
    const clampedGate = clampStutterGate(gate);
    const clampedPhase = clamp(phase, 0, 1);

    if (clampedGate <= 0 || clampedPhase >= clampedGate) {
        return 0;
    }

    const u = clampedPhase / clampedGate;
    const shapePosition = clampStutterShape(shape) * (STATIC_SHAPES.length - 1);
    const index = Math.min(STATIC_SHAPES.length - 2, Math.max(0, Math.floor(shapePosition)));
    const amount = shapePosition - index;

    if (index < 2) {
        return ((1 - amount) * STATIC_SHAPES[index](u)) + (amount * STATIC_SHAPES[index + 1](u));
    }

    if (index === 2) {
        return ((1 - amount) * tentShape(u, 0.5)) + (amount * smoothBellShape(u, 0.5));
    }

    if (index === 3) {
        const peak = 0.5 * (1 - amount);
        const roundness = 1 - amount;
        return (roundness * smoothBellShape(u, peak)) + ((1 - roundness) * tentShape(u, peak));
    }

    if (amount <= 0.5) {
        const exponent = 1 + (2 * amount * RAMP_MAX_EXTRA_CONCAVITY);
        return (1 - u) ** exponent;
    }

    const exponent = 1 + (2 * (1 - amount) * RAMP_MAX_EXTRA_CONCAVITY);
    return u ** exponent;
}

export function sampleStutterEnvelope(shape: number, gate: number, pointCount: number) {
    const count = Math.max(2, Math.round(pointCount));
    return Array.from({ length: count }, (_unused, index) => {
        const phase = index / (count - 1);
        return {
            phase,
            value: evaluateStutterEnvelope(phase, shape, gate),
        };
    });
}

export function formatStutterShapeLabel(shape: number) {
    const clampedShape = clampStutterShape(shape);
    const shapePosition = clampedShape * (STUTTER_SHAPE_NAMES.length - 1);
    const index = Math.min(STUTTER_SHAPE_NAMES.length - 1, Math.max(0, Math.floor(shapePosition)));
    const amount = shapePosition - index;

    if (amount < 0.04 || index >= STUTTER_SHAPE_NAMES.length - 1) {
        return `${STUTTER_SHAPE_NAMES[index]} (${clampedShape.toFixed(2)})`;
    }

    if (amount > 0.96) {
        return `${STUTTER_SHAPE_NAMES[index + 1]} (${clampedShape.toFixed(2)})`;
    }

    return `${STUTTER_SHAPE_NAMES[index]} -> ${STUTTER_SHAPE_NAMES[index + 1]} (${clampedShape.toFixed(2)})`;
}
