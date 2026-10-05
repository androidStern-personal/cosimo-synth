/** Mapping between a numeric range and a control's normalized travel (0 to 1). */
export type ValueScale = "linear" | "log" | {
    readonly toPosition: (value: number) => number;
    readonly fromPosition: (position: number) => number;
};

/** Numeric bounds and optional snapping in the value's own units. */
export type ValueRange = {
    readonly min: number;
    readonly max: number;
    readonly step?: number;
    readonly scale?: ValueScale;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Validates a control's range and supplies one mapping for input and artwork. */
export function valueDomain({ min, max, step, scale = "linear" }: ValueRange) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
        throw new RangeError("A control needs finite min < max.");
    if (step !== undefined && (!Number.isFinite(step) || step <= 0))
        throw new RangeError("A control's step must be positive and finite.");
    if (scale === "log" && min <= 0)
        throw new RangeError("A logarithmic control needs min > 0.");
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

/** Custom scale objects are often written inline, so only a change of kind counts as a new scale. */
export function scaleKind(scale: ValueScale | undefined) {
    return typeof scale === "object" ? "custom" : scale;
}
