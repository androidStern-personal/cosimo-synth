/**
 * Sparse three-oscillator articulation storage (`articulations.v4`) and its
 * fixed-size runtime upload.
 *
 * Decision record: docs/ADR-014-sparse-articulation-storage.md. Storage is
 * sparse. The runtime upload preserves that sparsity with presence masks so
 * absent values inherit live Cmajor state when a note starts. Values are
 * engine units throughout; the
 * descriptor layer owns any normalized conversion. This module is a pure
 * Domain Module: no I/O, no engine access, no UI types.
 */

import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_ROUTE_AMOUNT_INHERIT,
    ARTICULATION_ROUTE_AMOUNT_MAX_ABS,
    ARTICULATION_UNASSIGNED_RUNTIME_SLOT,
    type ArticulationTriggerConfig,
    type ArticulationSnapshotRuntimeUpload,
    type ArticulationTriggerMode,
} from "./articulations";
import { MODULATION_ARTICULATION_ROUTE_CELL_COUNT } from "./modulation-runtime-program";
import { OSCILLATOR_IDS, type OscillatorID } from "./modulation-targets";
import { err, ok, type Result } from "./result";

/** Sole stored-state key for the hard-forked three-oscillator articulation bank. */
export const ARTICULATIONS_V4_STATE_KEY = "articulations.v4";

/**
 * Every scalar an articulation may override, named after the runtime upload's
 * fields (ADR-014: the upload's voice surface IS the overridable surface).
 * Envelope ADSR and MSEG morph fields are flat keys here because the product
 * model (diff inventory, per-parameter reset, override counts) treats all
 * overrides uniformly.
 */
export const OSCILLATOR_ARTICULATION_PARAMETER_IDS = [
    "framePosition",
    "pan",
    "octave",
    "semitone",
    "fineCents",
    "phase",
    "phaseRandom",
    "retrigger",
    "volumeDb",
    "mute",
    "solo",
    "warpMode",
    "warpAmount",
    "unisonVoices",
    "unisonDetune",
    "unisonBlend",
    "unisonWidth",
    "unisonDetuneMode",
    "unisonStackMode",
    "unisonWavetablePositionSpread",
    "unisonWarpSpread",
] as const;

export const SHARED_ARTICULATION_VOICE_PARAMETER_IDS = [
    "filterMode",
    "filterCutoffHz",
    "filterQ",
    "msegMorph1",
    "msegMorph2",
    "msegMorph3",
    "env1.attackSeconds",
    "env1.decaySeconds",
    "env1.sustain",
    "env1.releaseSeconds",
    "env2.attackSeconds",
    "env2.decaySeconds",
    "env2.sustain",
    "env2.releaseSeconds",
    "env3.attackSeconds",
    "env3.decaySeconds",
    "env3.sustain",
    "env3.releaseSeconds",
] as const;

export type OscillatorArticulationParameterId =
    (typeof OSCILLATOR_ARTICULATION_PARAMETER_IDS)[number];
export type SharedArticulationVoiceParameterId =
    (typeof SHARED_ARTICULATION_VOICE_PARAMETER_IDS)[number];
export type ArticulationVoiceParameterId =
    | `osc${OscillatorID}.${OscillatorArticulationParameterId}`
    | SharedArticulationVoiceParameterId;

export const ARTICULATION_VOICE_PARAMETER_IDS: ReadonlyArray<ArticulationVoiceParameterId> = [
    ...OSCILLATOR_IDS.flatMap((oscillatorID) => (
        OSCILLATOR_ARTICULATION_PARAMETER_IDS.map(
            (parameterID) => `osc${oscillatorID}.${parameterID}` as const,
        )
    )),
    ...SHARED_ARTICULATION_VOICE_PARAMETER_IDS,
];

/** An inclusive integer range over 0..127 (velocity or chain position). */
export type ArticulationRange = {
    readonly min: number;
    readonly max: number;
};

/**
 * One stored articulation. `runtimeSlot` is the engine selector (stable for
 * the slot's lifetime, 0..127); `id` is the product identity and never moves
 * engine data. `overrides` and `routeAmounts` are sparse: absent keys inherit
 * the patch base.
 */
export type ArticulationSlotV4 = {
    readonly id: string;
    readonly runtimeSlot: number;
    readonly name: string;
    /** Semantic identity color token (ledger: reserved for articulation marking). */
    readonly color: string;
    /** Keyswitch MIDI note. */
    readonly key: number;
    readonly velRange: ArticulationRange;
    readonly chainRange: ArticulationRange;
    readonly overrides: Readonly<Partial<Record<ArticulationVoiceParameterId, number>>>;
    /** Route-amount overrides keyed by route id, engine units. */
    readonly routeAmounts: Readonly<Record<string, number>>;
};

/** The complete v4 three-oscillator articulation bank. */
export type ArticulationsState = {
    readonly format: "cosimo.articulations";
    readonly version: 4;
    readonly selectedSlotId: string | null;
    readonly activeTriggerMode: ArticulationTriggerMode;
    readonly slots: ReadonlyArray<ArticulationSlotV4>;
};

/** Why a stored payload failed to parse as articulations.v4. */
export class ArticulationsParseError extends Error {
    readonly _tag = "ArticulationsParseError" as const;

    /**
     * `reason` distinguishes the deliberate hard cut from other malformed input;
     * `detail` names the offending field or slot.
     */
    constructor(
        readonly reason: "unsupported-version" | "malformed",
        readonly detail: string,
    ) {
        super(`articulations.v4 parse failed (${reason}): ${detail}`);
    }
}

function malformed<T>(detail: string): Result<T, ArticulationsParseError> {
    return err(new ArticulationsParseError("malformed", detail));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findExactShapeOffense(
    value: Record<string, unknown>,
    expectedKeys: ReadonlyArray<string>,
    label: string,
): string | null {
    const expected = new Set(expectedKeys);

    for (const key of expectedKeys) {
        if (!Object.hasOwn(value, key)) {
            return `${label} is missing field "${key}"`;
        }
    }

    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") {
            return `${label} has a non-string field key`;
        }

        if (!expected.has(key)) {
            return `${label} has unexpected field "${key}"`;
        }
    }

    return null;
}

function isMidiInteger(value: unknown): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0
        && value < ARTICULATION_MAX_SLOTS;
}

function isTriggerMode(value: unknown): value is ArticulationTriggerMode {
    return value === "chain" || value === "key" || value === "vel";
}

function isVoiceParameterId(value: string): value is ArticulationVoiceParameterId {
    return ARTICULATION_VOICE_PARAMETER_IDS.some((parameterId) => parameterId === value);
}

function parseRange(
    input: unknown,
    label: string,
): Result<ArticulationRange, ArticulationsParseError> {
    if (!isObjectRecord(input)) {
        return malformed(`${label} must be an object`);
    }

    const shapeOffense = findExactShapeOffense(input, ["min", "max"], label);
    if (shapeOffense !== null) {
        return malformed(shapeOffense);
    }

    if (!isMidiInteger(input.min)) {
        return malformed(`${label}.min must be an integer in 0..127`);
    }

    if (!isMidiInteger(input.max)) {
        return malformed(`${label}.max must be an integer in 0..127`);
    }

    if (input.min > input.max) {
        return malformed(`${label}.min must be less than or equal to ${label}.max`);
    }

    return ok({ min: input.min, max: input.max });
}

function parseOverrides(
    input: unknown,
    label: string,
): Result<Readonly<Partial<Record<ArticulationVoiceParameterId, number>>>, ArticulationsParseError> {
    if (!isObjectRecord(input)) {
        return malformed(`${label} must be an object`);
    }

    const overrides: Partial<Record<ArticulationVoiceParameterId, number>> = {};

    for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== "string") {
            return malformed(`${label} has a non-string parameter id`);
        }

        if (!isVoiceParameterId(key)) {
            return malformed(`${label} has unknown parameter id "${key}"`);
        }

        const value = input[key];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return malformed(`${label}.${key} must be a finite number`);
        }

        overrides[key] = value;
    }

    return ok(overrides);
}

// defineProperty (not assignment) so a stored route id of "__proto__" becomes a
// harmless own property. The record keeps Object.prototype: strict deep-equality
// against ordinary object literals is part of the parse/serialize contract.
function defineOwnNumber(target: Record<string, number>, key: string, value: number): void {
    Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
    });
}

function createRouteAmountRecord(): Record<string, number> {
    return {};
}

function parseRouteAmounts(
    input: unknown,
    label: string,
    acceptedRouteIds: ReadonlySet<string>,
): Result<Readonly<Record<string, number>>, ArticulationsParseError> {
    if (!isObjectRecord(input)) {
        return malformed(`${label} must be an object`);
    }

    const routeAmounts = createRouteAmountRecord();

    for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== "string") {
            return malformed(`${label} has a non-string route id`);
        }

        const value = input[key];
        if (typeof value !== "number"
            || !Number.isFinite(value)
            || Math.abs(value) > ARTICULATION_ROUTE_AMOUNT_MAX_ABS) {
            return malformed(
                `${label}.${key} must be a finite route amount within ±${ARTICULATION_ROUTE_AMOUNT_MAX_ABS}`,
            );
        }
        if (!acceptedRouteIds.has(key)) {
            return malformed(`${label}.${key} does not name a current articulable mapping`);
        }

        defineOwnNumber(routeAmounts, key, value);
    }

    return ok(routeAmounts);
}

function parseSlot(
    input: unknown,
    index: number,
    acceptedRouteIds: ReadonlySet<string>,
): Result<ArticulationSlotV4, ArticulationsParseError> {
    const label = `slots[${index}]`;
    if (!isObjectRecord(input)) {
        return malformed(`${label} must be an object`);
    }

    const shapeOffense = findExactShapeOffense(
        input,
        ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
        label,
    );
    if (shapeOffense !== null) {
        return malformed(shapeOffense);
    }

    if (typeof input.id !== "string") {
        return malformed(`${label}.id must be a string`);
    }

    if (!isMidiInteger(input.runtimeSlot)) {
        return malformed(`${label}.runtimeSlot must be an integer in 0..127`);
    }

    if (typeof input.name !== "string") {
        return malformed(`${label}.name must be a string`);
    }

    if (typeof input.color !== "string") {
        return malformed(`${label}.color must be a string`);
    }

    if (!isMidiInteger(input.key)) {
        return malformed(`${label}.key must be an integer in 0..127`);
    }

    const velRange = parseRange(input.velRange, `${label}.velRange`);
    if (velRange._tag === "err") {
        return velRange;
    }

    const chainRange = parseRange(input.chainRange, `${label}.chainRange`);
    if (chainRange._tag === "err") {
        return chainRange;
    }

    const overrides = parseOverrides(input.overrides, `${label}.overrides`);
    if (overrides._tag === "err") {
        return overrides;
    }

    const routeAmounts = parseRouteAmounts(
        input.routeAmounts,
        `${label}.routeAmounts`,
        acceptedRouteIds,
    );
    if (routeAmounts._tag === "err") {
        return routeAmounts;
    }

    return ok({
        id: input.id,
        runtimeSlot: input.runtimeSlot,
        name: input.name,
        color: input.color,
        key: input.key,
        velRange: velRange.value,
        chainRange: chainRange.value,
        overrides: overrides.value,
        routeAmounts: routeAmounts.value,
    });
}

function copyOverrides(
    source: Readonly<Partial<Record<ArticulationVoiceParameterId, number>>>,
): Readonly<Partial<Record<ArticulationVoiceParameterId, number>>> {
    const copy: Partial<Record<ArticulationVoiceParameterId, number>> = {};

    for (const parameterId of ARTICULATION_VOICE_PARAMETER_IDS) {
        if (!Object.hasOwn(source, parameterId)) {
            continue;
        }

        const value = source[parameterId];
        if (value !== undefined) {
            copy[parameterId] = value;
        }
    }

    return copy;
}

function copyRouteAmounts(source: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
    const copy = createRouteAmountRecord();

    for (const [routeId, amount] of Object.entries(source)) {
        defineOwnNumber(copy, routeId, amount);
    }

    return copy;
}

const OSCILLATOR_OVERRIDE_BITS = Object.fromEntries(
    OSCILLATOR_ARTICULATION_PARAMETER_IDS.map((parameterID, index) => [parameterID, 2 ** index]),
) as Readonly<Record<OscillatorArticulationParameterId, number>>;

const SHARED_OVERRIDE_BITS = Object.fromEntries(
    SHARED_ARTICULATION_VOICE_PARAMETER_IDS.map((parameterID, index) => [parameterID, 2 ** index]),
) as Readonly<Record<SharedArticulationVoiceParameterId, number>>;

function sparseOverrideValue(
    slot: ArticulationSlotV4,
    parameterID: ArticulationVoiceParameterId,
): number {
    return Object.hasOwn(slot.overrides, parameterID)
        ? slot.overrides[parameterID] ?? 0
        : 0;
}

function oscillatorOverrideMask(slot: ArticulationSlotV4, oscillatorID: OscillatorID): number {
    return OSCILLATOR_ARTICULATION_PARAMETER_IDS.reduce((mask, parameterID) => (
        Object.hasOwn(slot.overrides, `osc${oscillatorID}.${parameterID}`)
            ? mask | OSCILLATOR_OVERRIDE_BITS[parameterID]
            : mask
    ), 0);
}

function sharedOverrideMask(slot: ArticulationSlotV4): number {
    return SHARED_ARTICULATION_VOICE_PARAMETER_IDS.reduce((mask, parameterID) => (
        Object.hasOwn(slot.overrides, parameterID)
            ? mask | SHARED_OVERRIDE_BITS[parameterID]
            : mask
    ), 0);
}

/** Compile sparse overrides; absent values are inherited inside Cmajor at note start. */
export function compileArticulationOverrideImage(
    slot: ArticulationSlotV4,
    routeCells: Readonly<Record<string, number>>,
): ArticulationSnapshotRuntimeUpload {
    const oscillatorValue = (
        oscillatorID: OscillatorID,
        parameterID: OscillatorArticulationParameterId,
    ) => sparseOverrideValue(slot, `osc${oscillatorID}.${parameterID}`);
    const sharedValue = (parameterID: SharedArticulationVoiceParameterId) => (
        sparseOverrideValue(slot, parameterID)
    );
    const routeAmounts = Array.from(
        { length: MODULATION_ARTICULATION_ROUTE_CELL_COUNT },
        () => ARTICULATION_ROUTE_AMOUNT_INHERIT,
    );
    for (const [routeID, amount] of Object.entries(slot.routeAmounts)) {
        const cellIndex = routeCells[routeID];
        if (cellIndex !== undefined) {
            routeAmounts[cellIndex] = amount;
        }
    }

    return {
        selectorA: slot.runtimeSlot,
        enabled: true,
        oscillatorOverrideMasks: OSCILLATOR_IDS.map((id) => oscillatorOverrideMask(slot, id)),
        sharedOverrideMask: sharedOverrideMask(slot),
        framePositions: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "framePosition")),
        pans: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "pan")),
        octaves: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "octave")),
        semitones: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "semitone")),
        fineCents: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "fineCents")),
        phases: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "phase")),
        phaseRandoms: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "phaseRandom")),
        retriggers: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "retrigger")),
        volumeDbs: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "volumeDb")),
        mutes: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "mute")),
        solos: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "solo")),
        warpModes: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "warpMode")),
        warpAmounts: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "warpAmount")),
        filterMode: sharedValue("filterMode"),
        filterCutoffHz: sharedValue("filterCutoffHz"),
        filterQ: sharedValue("filterQ"),
        unisonVoices: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonVoices")),
        unisonDetunes: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonDetune")),
        unisonBlends: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonBlend")),
        unisonWidths: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonWidth")),
        unisonDetuneModes: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonDetuneMode")),
        unisonStackModes: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonStackMode")),
        unisonWavetablePositionSpreads: OSCILLATOR_IDS.map((id) => (
            oscillatorValue(id, "unisonWavetablePositionSpread")
        )),
        unisonWarpSpreads: OSCILLATOR_IDS.map((id) => oscillatorValue(id, "unisonWarpSpread")),
        msegMorphs: [
            sharedValue("msegMorph1"),
            sharedValue("msegMorph2"),
            sharedValue("msegMorph3"),
        ],
        routeAmounts,
        envelopeAttackSeconds: [
            sharedValue("env1.attackSeconds"),
            sharedValue("env2.attackSeconds"),
            sharedValue("env3.attackSeconds"),
        ],
        envelopeDecaySeconds: [
            sharedValue("env1.decaySeconds"),
            sharedValue("env2.decaySeconds"),
            sharedValue("env3.decaySeconds"),
        ],
        envelopeSustain: [
            sharedValue("env1.sustain"),
            sharedValue("env2.sustain"),
            sharedValue("env3.sustain"),
        ],
        envelopeReleaseSeconds: [
            sharedValue("env1.releaseSeconds"),
            sharedValue("env2.releaseSeconds"),
            sharedValue("env3.releaseSeconds"),
        ],
    };
}

export function compileArticulationOverrideImages(
    state: ArticulationsState,
    routeCells: Readonly<Record<string, number>>,
): ReadonlyArray<ArticulationSnapshotRuntimeUpload> {
    return state.slots.map((slot) => compileArticulationOverrideImage(slot, routeCells));
}

/**
 * Parse untrusted stored state into the v4 articulation bank.
 *
 * Strict, fail-fast: `format`/`version` must match exactly. Every earlier
 * articulation format is rejected; there is no migration or fallback.
 * every slot needs a unique id, a unique in-range `runtimeSlot`, finite
 * numbers, integer ranges with `min <= max` inside 0..127, and override keys
 * drawn from `ARTICULATION_VOICE_PARAMETER_IDS` (unknown keys are malformed,
 * never dropped).
 *
 * @param input - Untrusted stored-state value.
 * @returns The parsed bank, or a tagged parse error.
 */
export function parseArticulationsV4(
    input: unknown,
    acceptedRouteIds: ReadonlySet<string>,
): Result<ArticulationsState, ArticulationsParseError> {
    if (!isObjectRecord(input)) {
        return malformed("payload must be an object");
    }

    if (input.format !== "cosimo.articulations") {
        return malformed('format must be exactly "cosimo.articulations"');
    }

    if (input.version !== 4) {
        return err(new ArticulationsParseError(
            "unsupported-version",
            "version must be exactly 4; earlier articulation formats are deliberately unsupported",
        ));
    }

    const shapeOffense = findExactShapeOffense(
        input,
        ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
        "payload",
    );
    if (shapeOffense !== null) {
        return malformed(shapeOffense);
    }

    if (input.selectedSlotId !== null && typeof input.selectedSlotId !== "string") {
        return malformed("selectedSlotId must be null or a string");
    }

    if (!isTriggerMode(input.activeTriggerMode)) {
        return malformed('activeTriggerMode must be "chain", "key", or "vel"');
    }

    if (!Array.isArray(input.slots)) {
        return malformed("slots must be an array");
    }

    if (input.slots.length > ARTICULATION_MAX_SLOTS) {
        return malformed(`slots must contain at most ${ARTICULATION_MAX_SLOTS} entries`);
    }

    const slots: Array<ArticulationSlotV4> = [];
    const slotIds = new Set<string>();
    const runtimeSlots = new Set<number>();

    for (let index = 0; index < input.slots.length; index += 1) {
        const parsedSlot = parseSlot(input.slots[index], index, acceptedRouteIds);
        if (parsedSlot._tag === "err") {
            return parsedSlot;
        }

        const slot = parsedSlot.value;
        if (slotIds.has(slot.id)) {
            return malformed(`slots[${index}].id duplicates "${slot.id}"`);
        }

        if (runtimeSlots.has(slot.runtimeSlot)) {
            return malformed(`slots[${index}].runtimeSlot duplicates ${slot.runtimeSlot}`);
        }

        slotIds.add(slot.id);
        runtimeSlots.add(slot.runtimeSlot);
        slots.push(slot);
    }

    if (input.selectedSlotId !== null && !slotIds.has(input.selectedSlotId)) {
        return malformed(`selectedSlotId "${input.selectedSlotId}" does not identify an existing slot`);
    }

    return ok({
        format: input.format,
        version: input.version,
        selectedSlotId: input.selectedSlotId,
        activeTriggerMode: input.activeTriggerMode,
        slots,
    });
}

/**
 * Project a v4 bank to a JSON-safe plain value such that
 * `parseArticulationsV4(serializeArticulationsV4(state))` is identity.
 *
 * @param state - The bank to serialize.
 * @returns A JSON-safe deep copy.
 */
export function serializeArticulationsV4(state: ArticulationsState): unknown {
    return {
        format: state.format,
        version: state.version,
        selectedSlotId: state.selectedSlotId,
        activeTriggerMode: state.activeTriggerMode,
        slots: state.slots.map((slot) => ({
            id: slot.id,
            runtimeSlot: slot.runtimeSlot,
            name: slot.name,
            color: slot.color,
            key: slot.key,
            velRange: { min: slot.velRange.min, max: slot.velRange.max },
            chainRange: { min: slot.chainRange.min, max: slot.chainRange.max },
            overrides: copyOverrides(slot.overrides),
            routeAmounts: copyRouteAmounts(slot.routeAmounts),
        })),
    };
}

/**
 * The empty bank a fresh patch starts with.
 *
 * @returns A valid state with no slots, chain trigger mode, nothing selected.
 */
export function createEmptyArticulationsState(): ArticulationsState {
    return {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [],
    };
}

/** Compile the v4 slot-owned key and range assignments for the native voice dispatcher. */
export function buildArticulationTriggerConfigV4(state: ArticulationsState): ArticulationTriggerConfig {
    const chain = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
    const key = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
    const velocity = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);

    for (const slot of state.slots) {
        if (key[slot.key] === ARTICULATION_UNASSIGNED_RUNTIME_SLOT) {
            key[slot.key] = slot.runtimeSlot;
        }
        for (let value = slot.chainRange.min; value <= slot.chainRange.max; value += 1) {
            if (chain[value] === ARTICULATION_UNASSIGNED_RUNTIME_SLOT) {
                chain[value] = slot.runtimeSlot;
            }
        }
        for (let value = slot.velRange.min; value <= slot.velRange.max; value += 1) {
            if (velocity[value] === ARTICULATION_UNASSIGNED_RUNTIME_SLOT) {
                velocity[value] = slot.runtimeSlot;
            }
        }
    }

    velocity[0] = ARTICULATION_UNASSIGNED_RUNTIME_SLOT;
    return {
        format: "cosimo.articulation.triggerConfig",
        version: 1,
        activeMode: state.activeTriggerMode,
        chain,
        key,
        velocity,
    };
}

/**
 * Lowest engine selector not owned by any slot, for slot creation.
 *
 * @param state - The current bank.
 * @returns The lowest free selector in 0..127, or null when all 128 are taken.
 */
export function lowestFreeRuntimeSlot(state: ArticulationsState): number | null {
    const owned = new Set(state.slots.map((slot) => slot.runtimeSlot));

    for (let candidate = 0; candidate < ARTICULATION_MAX_SLOTS; candidate += 1) {
        if (!owned.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

// Re-exported so compiler consumers size and interpret positional arrays without extra imports.
export {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_ROUTE_AMOUNT_INHERIT,
    MODULATION_ARTICULATION_ROUTE_CELL_COUNT,
};
