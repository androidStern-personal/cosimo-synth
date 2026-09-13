/** Mapping between a numeric domain and the dial's normalized travel. */
export type KnobScale = "linear" | "log" | {
    readonly toPosition: (value: number) => number;
    readonly fromPosition: (position: number) => number;
};

/** Numeric bounds and optional snapping in canonical units. */
export type KnobDomain = {
    readonly min: number;
    readonly max: number;
    readonly step?: number;
    readonly scale?: KnobScale;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Validates author configuration and supplies one scale for input and artwork. */
export function knobDomain({ min, max, step, scale = "linear" }: KnobDomain) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
        throw new RangeError("Knob requires finite min < max.");
    if (step !== undefined && (!Number.isFinite(step) || step <= 0))
        throw new RangeError("Knob step must be positive and finite.");
    if (scale === "log" && min <= 0)
        throw new RangeError("A logarithmic knob requires min > 0.");
    const limit = (value: number) => clamp(value, min, max);
    const snap = (value: number) => {
        const limited = limit(value);
        // Both explicit endpoints remain reachable even if step does not divide the span.
        if (step === undefined || limited === min || limited === max) return limited;
        return limit(Number((min + Math.round((limited - min) / step) * step).toPrecision(14)));
    };
    const toPosition = (value: number) => clamp(
        typeof scale === "object" ? scale.toPosition(limit(value))
            : scale === "log" ? Math.log(limit(value) / min) / Math.log(max / min)
                : (limit(value) - min) / (max - min), 0, 1);
    const fromPosition = (position: number) => snap(
        typeof scale === "object" ? scale.fromPosition(clamp(position, 0, 1))
            : scale === "log" ? min * (max / min) ** clamp(position, 0, 1)
                : min + clamp(position, 0, 1) * (max - min));
    return { min, max, step, snap, toPosition, fromPosition };
}
