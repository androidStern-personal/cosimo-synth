export const STUTTER_SLICES_MIN = 2;
export const STUTTER_SLICES_MAX = 32;
export const STUTTER_SPEED_MIN = 0.5;
export const STUTTER_SPEED_MAX = 2;
export const STUTTER_SPEED_STEP = 0.05;
export const STUTTER_DEFAULT_SLICES = 8;
export const STUTTER_DEFAULT_SPEED = 1;
export const STUTTER_DEFAULT_GATE = 0.68;

export const STUTTER_SHAPE_STOPS = [
    { name: "Gate", stopLabel: "Gate", chipLabel: "Gate" },
    { name: "Triangle", stopLabel: "Triangle", chipLabel: "Tri" },
    { name: "Bell", stopLabel: "Bell", chipLabel: "Bell" },
    { name: "Ramp Down", stopLabel: "Down", chipLabel: "Down" },
    { name: "Ramp Up", stopLabel: "Up", chipLabel: "Up" },
] as const;
export const STUTTER_SHAPE_NAMES = STUTTER_SHAPE_STOPS.map((shape) => shape.name);
export const STUTTER_SHAPE_STOP_LABELS = STUTTER_SHAPE_STOPS.map((shape) => shape.stopLabel);
export const STUTTER_SHAPE_CHIP_LABELS = STUTTER_SHAPE_STOPS.map((shape) => shape.chipLabel);

const STUTTER_SHAPE_SEGMENT_COUNT = STUTTER_SHAPE_STOPS.length - 1;
// Keep the default in the same audible neighborhood as the old six-stop model:
// late in the Triangle -> Bell segment, not at an anchor.
const STUTTER_DEFAULT_SHAPE_SEGMENT_INDEX = 1;
const STUTTER_DEFAULT_SHAPE_SEGMENT_PHASE = 0.75;
export const STUTTER_DEFAULT_SHAPE = (
    STUTTER_DEFAULT_SHAPE_SEGMENT_INDEX + STUTTER_DEFAULT_SHAPE_SEGMENT_PHASE
) / STUTTER_SHAPE_SEGMENT_COUNT;

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

function gateToTriangleShape(u: number, amount: number) {
    const t = clamp(amount, 0, 1);
    const distance = Math.abs(clamp(u, 0, 1) - 0.5);
    const plateauHalfWidth = 0.5 * (1 - t);
    const slopeWidth = 0.5 - plateauHalfWidth;

    if (distance <= plateauHalfWidth) {
        return 1;
    }

    if (slopeWidth <= 0.000001) {
        return 1;
    }

    return clamp(1 - ((distance - plateauHalfWidth) / slopeWidth), 0, 1);
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
    const shapePosition = clampStutterShape(shape) * STUTTER_SHAPE_SEGMENT_COUNT;
    const index = Math.min(STATIC_SHAPES.length - 2, Math.max(0, Math.floor(shapePosition)));
    const amount = shapePosition - index;

    if (index === 0) {
        return gateToTriangleShape(u, amount);
    }

    if (index === 1) {
        return ((1 - amount) * tentShape(u, 0.5)) + (amount * smoothBellShape(u, 0.5));
    }

    if (index === 2) {
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
    const shapePosition = clampedShape * STUTTER_SHAPE_SEGMENT_COUNT;
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
