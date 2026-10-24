import type { PluginStateCodec } from "../../../kit/index";

/** The DSP keeps a strength for each of the first 64 harmonics. */
export const PARTIAL_COUNT = 64;
/** How many harmonics a new instance resonates. */
export const DEFAULT_ACTIVE_PARTIALS = 32;
/** The active-harmonic counts the editor offers. */
export const PARTIAL_COUNT_CHOICES = [16, 32, 64] as const;

/** The named harmonic shapes the editor can start from. */
export const PARTIAL_TEMPLATES = ["flat", "saw", "square", "triangle", "organ", "nasal", "air", "pluck"] as const;
export type PartialTemplate = typeof PARTIAL_TEMPLATES[number];

/**
 * How strongly each held note's harmonics resonate. `count` harmonics are
 * active; strengths past it are kept so raising the count restores them.
 * `template` names the shape the strengths came from, or "custom" once edited.
 */
export interface PartialShape {
    readonly count: number;
    readonly strengths: readonly number[];
    readonly template: PartialTemplate | "custom";
}

/** The payload of the DSP's `partialShapeUpload` event. */
export interface PartialShapeUpload {
    readonly count: number;
    readonly strengths: readonly number[];
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const clampStrength = (value: number) => clamp(value, 0, 1);

function shape(count: number, strengths: readonly number[], template: PartialShape["template"]): PartialShape {
    return Object.freeze({ count, strengths: Object.freeze([...strengths]), template });
}

function templateStrength(template: PartialTemplate, index: number): number {
    const harmonic = index + 1;
    switch (template) {
        case "flat": return 1;
        case "saw": return 1 / harmonic;
        case "square": return harmonic % 2 === 1 ? 1 / harmonic : 0;
        case "triangle": return harmonic % 2 === 1 ? 1 / (harmonic * harmonic) : 0;
        case "organ": {
            const drawbars = [1, 0.25, 0.75, 0.5, 0.18, 0.34, 0.08, 0.2, 0.12, 0.05, 0.03, 0.04, 0.02, 0.015, 0.012, 0.01];
            return drawbars[index] ?? 0;
        }
        case "nasal": {
            const peak = Math.exp(-0.5 * ((harmonic - 5) / 1.6) ** 2) * 0.95;
            return clampStrength(peak + (harmonic % 2 === 1 ? 0.11 / harmonic : 0.03 / harmonic));
        }
        case "air": {
            const low = Math.exp(-0.5 * ((harmonic - 2) / 1.4) ** 2) * 0.12;
            const high = Math.exp(-0.5 * ((harmonic - 18) / 7) ** 2) * 0.74;
            return clampStrength(low + high);
        }
        case "pluck": return clampStrength(Math.exp(-harmonic / 8) * (0.8 + 0.2 * Math.cos(harmonic * 1.7)));
    }
}

/** A template's 64 strengths, scaled so the strongest harmonic is 1. */
export function templateStrengths(template: PartialTemplate): readonly number[] {
    const raw = Array.from({ length: PARTIAL_COUNT }, (_unused, index) => templateStrength(template, index));
    const loudest = Math.max(0.000001, ...raw);
    return raw.map(value => clampStrength(value / loudest));
}

/** A new instance's shape: the first 32 harmonics of a saw. */
export const defaultPartialShape: PartialShape = shape(DEFAULT_ACTIVE_PARTIALS, templateStrengths("saw"), "saw");

/** Replace every strength with a template's, keeping the active count. */
export function withTemplate(current: PartialShape, template: PartialTemplate): PartialShape {
    return shape(current.count, templateStrengths(template), template);
}

/** Set one harmonic's strength. */
export function withStrength(current: PartialShape, index: number, strength: number): PartialShape {
    const strengths = [...current.strengths];
    strengths[Math.round(clamp(index, 0, PARTIAL_COUNT - 1))] = clampStrength(strength);
    return shape(current.count, strengths, "custom");
}

/** Change how many harmonics are active. */
export function withCount(current: PartialShape, count: number): PartialShape {
    return shape(Math.round(clamp(count, 1, PARTIAL_COUNT)), current.strengths, "custom");
}

/** Apply `transform` to the active strengths only. */
function mapActive(current: PartialShape, transform: (strength: number, index: number) => number): PartialShape {
    const strengths = current.strengths.map((strength, index) => index < current.count ? clampStrength(transform(strength, index)) : strength);
    return shape(current.count, strengths, "custom");
}

/** Blur each active strength with its neighbours (1-2-1 weights). */
export function smoothed(current: PartialShape): PartialShape {
    const { strengths, count } = current;
    return mapActive(current, (strength, index) =>
        (strengths[Math.max(0, index - 1)] + strength * 2 + strengths[Math.min(count - 1, index + 1)]) / 4);
}

/** Scale the active strengths so the strongest is 1. */
export function normalized(current: PartialShape): PartialShape {
    const loudest = Math.max(0.000001, ...current.strengths.slice(0, current.count));
    return mapActive(current, strength => strength / loudest);
}

/** Flip each active strength (s becomes 1 - s). */
export function inverted(current: PartialShape): PartialShape {
    return mapActive(current, strength => 1 - strength);
}

/** Silence every active harmonic. */
export function cleared(current: PartialShape): PartialShape {
    return mapActive(current, () => 0);
}

/** The DSP event payload for a shape. */
export function partialShapeUpload(current: PartialShape): PartialShapeUpload {
    return { count: current.count, strengths: [...current.strengths] };
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isTemplate = (value: unknown): value is PartialShape["template"] =>
    value === "custom" || PARTIAL_TEMPLATES.some(template => template === value);

/** Saves a partial shape as `{ count, strengths, template }` and refuses anything else. */
export const partialShapeCodec: PluginStateCodec<PartialShape> = {
    parse(input) {
        if (!isRecord(input)) return { kind: "error", message: "The partial shape must be an object." };
        const { count, strengths, template } = input;
        if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > PARTIAL_COUNT)
            return { kind: "error", message: `The partial count must be a whole number from 1 to ${PARTIAL_COUNT}.` };
        if (!Array.isArray(strengths) || strengths.length !== PARTIAL_COUNT
            || !strengths.every(strength => typeof strength === "number" && strength >= 0 && strength <= 1))
            return { kind: "error", message: `The partial shape needs ${PARTIAL_COUNT} strengths, each from 0 to 1.` };
        if (!isTemplate(template))
            return { kind: "error", message: `"${String(template)}" is not a partial template.` };
        return { kind: "ok", value: shape(count, strengths, template) };
    },
    encode(value) {
        return { count: value.count, strengths: [...value.strengths], template: value.template };
    },
    equals(left, right) {
        return left.count === right.count && left.template === right.template
            && left.strengths.every((strength, index) => strength === right.strengths[index]);
    },
};
