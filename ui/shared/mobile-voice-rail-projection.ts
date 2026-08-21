/**
 * Rail and HUD range projection for the ADR-024 mobile Voice readouts.
 *
 * The rail depicts the SELECTED route only: one neutral base tick plus the
 * source-colored projected low-to-high travel of that route across its legal
 * source excursion, clamped to the target range with explicit edge markers
 * when the band clips. Voice modulation targets apply route offsets linearly
 * in parameter units, so this module owns exactly that linear law; route
 * relationship/creation semantics stay with `rack-route-presentation`.
 *
 * It also owns the explicit aggregate Tune adapter: Octave, Semitone, and
 * Fine are three base endpoints but ONE `pitchSemitones` MOD target. Their
 * rails project the shared route into each component cell's own axis, and
 * the HUD presents aggregate semitone values labeled `Tune` (ADR-024).
 */

import type { ModulationRoute } from "./modulation";

const AMOUNT_EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

export type MobileVoiceRailState =
    | "no-source"
    | "not-modulatable"
    | "unmapped"
    | "mapped-zero"
    | "mapped"
    | "bypassed";

/** Resolve the truth-table rail state for one readout cell. */
export function resolveMobileVoiceRailState(input: {
    readonly modulatable: boolean;
    readonly armed: boolean;
    readonly route: Pick<ModulationRoute, "enabled" | "amount"> | null;
}): MobileVoiceRailState {
    if (!input.modulatable) {
        return "not-modulatable";
    }
    if (!input.armed) {
        return "no-source";
    }
    if (input.route === null) {
        return "unmapped";
    }
    if (!input.route.enabled) {
        return "bypassed";
    }
    return Math.abs(input.route.amount) <= AMOUNT_EPSILON ? "mapped-zero" : "mapped";
}

/** The full legal source excursion for one route, in route-amount units. */
export function routeAmountOffsets(
    route: Pick<ModulationRoute, "amount" | "polarity">,
): readonly [number, number] {
    if (route.polarity === "bipolar") {
        const magnitude = Math.abs(route.amount);
        return [-magnitude, magnitude];
    }
    return route.amount < 0 ? [route.amount, 0] : [0, route.amount];
}

/**
 * One route's live contribution for a clamped [0,1] source value, in
 * route-amount units — the engine's law exactly: a unipolar source passes
 * through, a bipolar source maps onto [-1,+1] (so at rest it sits at -amount).
 */
export function routeLiveOffset(
    route: Pick<ModulationRoute, "amount" | "polarity">,
    sourceValue01: number,
): number {
    const s = clamp01(sourceValue01);
    return route.amount * (route.polarity === "bipolar" ? (s * 2) - 1 : s);
}

/**
 * The live light's rail position for a route whose band spans `amountSpan`
 * route-amount units across the full rail (the display domain width for
 * plain cells, the component semitone span for aggregate Tune cells).
 */
export function projectRailLiveNormalized(
    baseNormalized: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
    sourceValue01: number,
    amountSpan: number,
): number {
    if (!(amountSpan > 0)) {
        throw new Error("A rail light span must be positive");
    }
    return clamp01(clamp01(baseNormalized) + (routeLiveOffset(route, sourceValue01) / amountSpan));
}

export type MobileVoiceRailBand = {
    /** Normalized [0,1] rail position of the base tick. */
    readonly baseNormalized: number;
    /** Normalized band ends after clamping to the target range. */
    readonly lowNormalized: number;
    readonly highNormalized: number;
    /** True when the unclamped travel crossed the corresponding bound. */
    readonly clippedLow: boolean;
    readonly clippedHigh: boolean;
    /** True for a nonzero route whose visible band collapsed entirely. */
    readonly fullyClipped: boolean;
};

export type MobileVoiceTravelDomain = {
    readonly min: number;
    readonly max: number;
};

/**
 * Project one selected route's travel onto a cell rail. Voice targets apply
 * route offsets additively in the target's parameter units.
 */
export function projectMobileVoiceRailBand(
    domain: MobileVoiceTravelDomain,
    baseValue: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
): MobileVoiceRailBand {
    const range = domain.max - domain.min;
    if (!(range > 0)) {
        throw new Error("A rail domain must span a positive range");
    }
    const clampedBase = clamp(baseValue, domain.min, domain.max);
    const offsets = routeAmountOffsets(route);
    const rawLow = clampedBase + offsets[0];
    const rawHigh = clampedBase + offsets[1];
    const lowValue = clamp(rawLow, domain.min, domain.max);
    const highValue = clamp(rawHigh, domain.min, domain.max);
    const lowNormalized = (lowValue - domain.min) / range;
    const highNormalized = (highValue - domain.min) / range;
    const magnitude = Math.abs(route.amount);

    return Object.freeze({
        baseNormalized: (clampedBase - domain.min) / range,
        lowNormalized,
        highNormalized,
        clippedLow: rawLow < domain.min - AMOUNT_EPSILON,
        clippedHigh: rawHigh > domain.max + AMOUNT_EPSILON,
        fullyClipped: magnitude > AMOUNT_EPSILON
            && Math.abs(highNormalized - lowNormalized) <= AMOUNT_EPSILON,
    });
}

export type WavetableModulationShadingRange = {
    /** Normalized Index positions of the shaded travel, low <= high. */
    readonly lowPosition: number;
    readonly highPosition: number;
};

/**
 * T02C: the wavetable graphic shades the selected route's possible Index
 * travel only while that route is live — mapped with a nonzero amount. Every
 * other truth-table state (including mapped-zero and bypassed) draws nothing,
 * and the range is exactly the Index rail's clamped band.
 */
export function wavetableModulationShadingRange(
    railState: MobileVoiceRailState,
    band: MobileVoiceRailBand | null,
): WavetableModulationShadingRange | null {
    if (railState !== "mapped") {
        return null;
    }
    if (band === null) {
        throw new Error("A mapped cell must carry its projected rail band");
    }
    return { lowPosition: band.lowNormalized, highPosition: band.highNormalized };
}

/* ------------------------------------------------------------------ */
/* Aggregate Tune                                                      */
/* ------------------------------------------------------------------ */

/** Static tune domain: Octave ±4 (±48 st) + Semitone ±12 + Fine ±100 ct. */
export const AGGREGATE_TUNE_DOMAIN: MobileVoiceTravelDomain = Object.freeze({
    min: -61,
    max: 61,
});

export type AggregateTuneComponentID = "octave" | "semitone" | "fineCents";

/** Each component cell's own span expressed in semitones. */
export const TUNE_COMPONENT_SEMITONE_SPANS: Readonly<Record<AggregateTuneComponentID, number>> =
    Object.freeze({
        octave: 96,
        semitone: 24,
        fineCents: 2,
    });

/** The one static tune base shared by the three component cells. */
export function aggregateTuneBaseSemitones(
    octave: number,
    semitone: number,
    fineCents: number,
): number {
    return (octave * 12) + semitone + (fineCents / 100);
}

export type AggregateTuneTravel = {
    /** Aggregate Low/High target outputs, in semitones, after clamping. */
    readonly lowSemitones: number;
    readonly highSemitones: number;
};

/** HUD Low/High for the shared Tune route, in aggregate semitones. */
export function projectAggregateTuneTravel(
    baseSemitones: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
): AggregateTuneTravel {
    const clampedBase = clamp(baseSemitones, AGGREGATE_TUNE_DOMAIN.min, AGGREGATE_TUNE_DOMAIN.max);
    const offsets = routeAmountOffsets(route);
    return Object.freeze({
        lowSemitones: clamp(clampedBase + offsets[0], AGGREGATE_TUNE_DOMAIN.min, AGGREGATE_TUNE_DOMAIN.max),
        highSemitones: clamp(clampedBase + offsets[1], AGGREGATE_TUNE_DOMAIN.min, AGGREGATE_TUNE_DOMAIN.max),
    });
}

/**
 * Project the shared Tune route onto ONE component cell's rail. The band is
 * anchored at the component's own base tick and scaled by that component's
 * semitone span, so a ±2 st route reads wide on Fine and narrow on Octave
 * while remaining the same aggregate travel.
 */
export function projectTuneComponentBand(
    component: AggregateTuneComponentID,
    componentBaseNormalized: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
): MobileVoiceRailBand {
    const span = TUNE_COMPONENT_SEMITONE_SPANS[component];
    const base = clamp01(componentBaseNormalized);
    const offsets = routeAmountOffsets(route);
    const rawLow = base + (offsets[0] / span);
    const rawHigh = base + (offsets[1] / span);
    const lowNormalized = clamp01(rawLow);
    const highNormalized = clamp01(rawHigh);
    const magnitude = Math.abs(route.amount);

    return Object.freeze({
        baseNormalized: base,
        lowNormalized,
        highNormalized,
        clippedLow: rawLow < -AMOUNT_EPSILON,
        clippedHigh: rawHigh > 1 + AMOUNT_EPSILON,
        fullyClipped: magnitude > AMOUNT_EPSILON
            && Math.abs(highNormalized - lowNormalized) <= AMOUNT_EPSILON,
    });
}
