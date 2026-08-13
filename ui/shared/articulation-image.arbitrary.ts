/**
 * fast-check arbitraries for articulation-image domain values.
 *
 * Each factory takes the fast-check module as an argument because the test
 * loader (tests/helpers/load_ui_module.mjs) bundles this file into a data-URL
 * module — importing fast-check here would inline a second copy whose
 * Arbitrary instances the test runner's copy may not accept.
 */

import {
    ARTICULATION_VOICE_PARAMETER_IDS,
    MODULATION_ARTICULATION_ROUTE_CELL_COUNT,
    type ArticulationBaseChange,
    type ArticulationRange,
    type ArticulationSlotV4,
    type ArticulationsState,
    type ArticulationVoiceParameterId,
    type PatchVoiceBase,
} from "./articulation-image";

type FastCheck = typeof import("fast-check");
type Arbitrary<T> = import("fast-check").Arbitrary<T>;

const ROUTE_ID_POOL = Array.from(
    { length: MODULATION_ARTICULATION_ROUTE_CELL_COUNT },
    (_, index) => `route-${index}`,
) as [string, ...string[]];

/**
 * A finite engine-unit scalar.
 *
 * @param fc - The fast-check module.
 * @returns Arbitrary finite doubles in a realistic engine-unit span.
 */
export function engineValueArbitrary(fc: FastCheck): Arbitrary<number> {
    // -0 is normalized away: JSON.stringify collapses it to 0, which would make
    // serialize→JSON→parse roundtrip assertions fail on a distinction no engine
    // unit carries.
    return fc
        .double({ min: -20000, max: 20000, noNaN: true, noDefaultInfinity: true })
        .map((value) => (Object.is(value, -0) ? 0 : value));
}

function routeAmountArbitrary(fc: FastCheck): Arbitrary<number> {
    return fc
        .double({ min: -48, max: 48, noNaN: true, noDefaultInfinity: true })
        .map((value) => (Object.is(value, -0) ? 0 : value));
}

/**
 * An inclusive integer range with min <= max inside 0..127.
 *
 * @param fc - The fast-check module.
 * @returns Arbitrary well-formed articulation ranges.
 */
export function articulationRangeArbitrary(fc: FastCheck): Arbitrary<ArticulationRange> {
    return fc
        .tuple(fc.integer({ min: 0, max: 127 }), fc.integer({ min: 0, max: 127 }))
        .map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) }));
}

/**
 * A sparse override map over the known voice-parameter ids.
 *
 * @param fc - The fast-check module.
 * @returns Arbitrary subsets of parameter ids mapped to finite values.
 */
export function overridesArbitrary(
    fc: FastCheck,
): Arbitrary<Partial<Record<ArticulationVoiceParameterId, number>>> {
    return fc
        .uniqueArray(fc.constantFrom(...ARTICULATION_VOICE_PARAMETER_IDS), { maxLength: ARTICULATION_VOICE_PARAMETER_IDS.length })
        .chain((keys) =>
            fc.tuple(...keys.map(() => engineValueArbitrary(fc))).map((values) =>
                Object.fromEntries(keys.map((key, index) => [key, values[index]])),
            ),
        );
}

/**
 * One articulation slot; id and runtimeSlot uniqueness is the state
 * arbitrary's responsibility.
 *
 * @param fc - The fast-check module.
 * @param id - The slot id to use.
 * @param runtimeSlot - The engine selector to use.
 * @returns Arbitrary well-formed slots with the given identity.
 */
export function articulationSlotArbitrary(
    fc: FastCheck,
    id: string,
    runtimeSlot: number,
): Arbitrary<ArticulationSlotV4> {
    return fc
        .record({
            name: fc.string({ minLength: 1, maxLength: 24 }),
            color: fc.constantFrom("var(--art-1)", "var(--art-2)", "var(--art-3)", "#d2a128"),
            key: fc.integer({ min: 0, max: 127 }),
            velRange: articulationRangeArbitrary(fc),
            chainRange: articulationRangeArbitrary(fc),
            overrides: overridesArbitrary(fc),
            // Plain prototypes only: stored banks are ordinary JSON objects, and
            // fc.dictionary's adversarial null-prototype default would fail
            // strict deep-equality for a distinction the domain doesn't carry.
            routeAmounts: fc.dictionary(fc.constantFrom(...ROUTE_ID_POOL), routeAmountArbitrary(fc), {
                maxKeys: ROUTE_ID_POOL.length,
                noNullPrototype: true,
            }),
        })
        .map((rest) => ({ id, runtimeSlot, ...rest }));
}

/**
 * A complete, well-formed v4 bank with unique slot ids and selectors.
 *
 * @param fc - The fast-check module.
 * @returns Arbitrary valid ArticulationsState values (0..8 slots).
 */
export function articulationsStateArbitrary(fc: FastCheck): Arbitrary<ArticulationsState> {
    return fc
        .uniqueArray(fc.integer({ min: 0, max: 127 }), { maxLength: 8 })
        .chain((selectors) =>
            fc
                .tuple(...selectors.map((selector, index) => articulationSlotArbitrary(fc, `slot-${index}-${selector}`, selector)))
                .chain((slots) =>
                    fc
                        .record({
                            activeTriggerMode: fc.constantFrom("chain", "key", "vel"),
                            selectedSlotId: slots.length === 0
                                ? fc.constant(null)
                                : fc.option(fc.constantFrom(...slots.map((slot) => slot.id)), { nil: null }),
                        })
                        .map(({ activeTriggerMode, selectedSlotId }) => ({
                            format: "cosimo.articulations" as const,
                            version: 4 as const,
                            selectedSlotId,
                            activeTriggerMode,
                            slots,
                        })),
                ),
        );
}

/**
 * A complete patch base: EVERY voice parameter present, a route order of
 * unique ids, deterministic runtime cells, and base amounts for those routes.
 *
 * @param fc - The fast-check module.
 * @returns Arbitrary complete PatchVoiceBase values.
 */
export function patchVoiceBaseArbitrary(fc: FastCheck): Arbitrary<PatchVoiceBase> {
    return fc
        .tuple(
            fc.tuple(...ARTICULATION_VOICE_PARAMETER_IDS.map(() => engineValueArbitrary(fc))),
            fc.uniqueArray(fc.constantFrom(...ROUTE_ID_POOL), { maxLength: ROUTE_ID_POOL.length }),
        )
        .chain(([values, routeOrder]) =>
            fc.tuple(...routeOrder.map(() => engineValueArbitrary(fc))).map((amounts) => ({
                parameters: Object.fromEntries(
                    ARTICULATION_VOICE_PARAMETER_IDS.map((id, index) => [id, values[index]]),
                ) as Record<ArticulationVoiceParameterId, number>,
                routeAmounts: Object.fromEntries(routeOrder.map((routeId, index) => [routeId, amounts[index]])),
                routeOrder,
                routeCells: Object.fromEntries(routeOrder.map((routeId, index) => [routeId, index])),
            })),
        );
}

/**
 * A base change applicable to a given base (route changes pick real routes).
 *
 * @param fc - The fast-check module.
 * @param base - The base the change applies to.
 * @returns Arbitrary ArticulationBaseChange values valid for that base.
 */
export function baseChangeArbitrary(fc: FastCheck, base: PatchVoiceBase): Arbitrary<ArticulationBaseChange> {
    const voiceChange = fc
        .constantFrom(...ARTICULATION_VOICE_PARAMETER_IDS)
        .map((parameterId): ArticulationBaseChange => ({ kind: "voiceParameter", parameterId }));

    if (base.routeOrder.length === 0) {
        return voiceChange;
    }

    return fc.oneof(
        voiceChange,
        fc.constantFrom(...base.routeOrder).map((routeId): ArticulationBaseChange => ({ kind: "routeAmount", routeId })),
        fc.constant({ kind: "routeOrder" } as const),
    );
}
