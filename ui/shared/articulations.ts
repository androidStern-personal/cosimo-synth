import {
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    createDefaultEnvelope,
    normalizeEnvelope,
    type ModulationEnvelope,
} from "./modulation";
import { MODULATION_ARTICULATION_ROUTE_CELL_COUNT } from "./modulation-runtime-program";
import { OSCILLATOR_IDS } from "./modulation-targets";
import {
    OSCILLATOR_DEFAULT_VOLUME_DB,
    OSCILLATOR_VOLUME_MAX_DB,
    OSCILLATOR_VOLUME_MIN_DB,
} from "./oscillator-defaults";

export const ARTICULATION_SNAPSHOT_ENDPOINT_ID = "articulationSnapshot";
export const ARTICULATION_MAX_SLOTS = 128;
/** Largest legal absolute route amount in Cosimo's target domain. */
export const ARTICULATION_ROUTE_AMOUNT_MAX_ABS = 48;
/** Runtime sentinel: resolve this articulation cell from the current base mapping at note latch. */
export const ARTICULATION_ROUTE_AMOUNT_INHERIT = 1_000_000;
export const ARTICULATION_UNASSIGNED_RUNTIME_SLOT = -1;

const ARTICULATION_DEFAULT_NAMES = [
    "Bow Forte",
    "Bow Pianissimo",
    "Pluck Round",
    "Pluck Snap",
    "Hammer",
    "Air Pad",
    "Bell Strike",
    "Choke",
    "Tape Hum",
    "Curl Lift",
    "Chatter",
    "Tug Sustain",
    "Velvet Pop",
    "Chrome Bloom",
    "Tin Halo",
    "Sugar Gate",
];

export type ArticulationTriggerMode = "chain" | "key" | "vel";

export type ArticulationParameterSnapshot = {
    wavetablePosition: number;
    pan: number;
    octave: number;
    semitone: number;
    fineCents: number;
    volumeDb: number;
    mute: number;
    solo: number;
    warpMode: number;
    warpAmount: number;
    filterMode: number;
    filterCutoff: number;
    filterQ: number;
    unisonVoices: number;
    unisonDetune: number;
    unisonBlend: number;
    unisonWidth: number;
    unisonPhase: number;
    unisonRandom: number;
    unisonPhaseMode: number;
    unisonDetuneMode: number;
    unisonStackMode: number;
    unisonWavetablePositionSpread: number;
    unisonWarpSpread: number;
    msegMorphs: [number, number, number];
};

export type ArticulationRouteAmountSnapshot = {
    routeId: string;
    amount: number;
};

export type ArticulationSnapshot = {
    format: "cosimo.articulation.snapshot";
    version: 1;
    parameters: ArticulationParameterSnapshot;
    envelopes: ModulationEnvelope[];
    modRouteAmounts: ArticulationRouteAmountSnapshot[];
};

export type ArticulationSlot = {
    id: string;
    runtimeSlot: number;
    name: string;
    snapshot: ArticulationSnapshot;
};

export type ArticulationKeyAssignment = {
    note: number;
    articulationId: string;
};

export type ArticulationRangeAssignment = {
    id: string;
    articulationId: string;
    min: number;
    max: number;
};

export type ArticulationRangeEditEdge = "min" | "max";
export type ArticulationInsertPreserveSide = "lower" | "upper";

/** Transient desktop editing view retained until the v4 presentation migration. */
export type ArticulationEditorState = {
    selectedSlotId: string | null;
    activeTriggerMode: ArticulationTriggerMode;
    slots: ArticulationSlot[];
    chainAssignments: ArticulationRangeAssignment[];
    keyAssignments: ArticulationKeyAssignment[];
    velocityAssignments: ArticulationRangeAssignment[];
};

export type ArticulationTriggerConfig = {
    format: "cosimo.articulation.triggerConfig";
    version: 1;
    activeMode: ArticulationTriggerMode;
    chain: number[];
    key: number[];
    velocity: number[];
};

export type ArticulationSnapshotRuntimeUpload = {
    selectorA: number;
    enabled: boolean;
    oscillatorOverrideMasks: number[];
    sharedOverrideMask: number;
    framePositions: number[];
    pans: number[];
    octaves: number[];
    semitones: number[];
    fineCents: number[];
    phases: number[];
    phaseRandoms: number[];
    retriggers: number[];
    volumeDbs: number[];
    mutes: number[];
    solos: number[];
    warpModes: number[];
    warpAmounts: number[];
    filterMode: number;
    filterCutoffHz: number;
    filterQ: number;
    unisonVoices: number[];
    unisonDetunes: number[];
    unisonBlends: number[];
    unisonWidths: number[];
    unisonDetuneModes: number[];
    unisonStackModes: number[];
    unisonWavetablePositionSpreads: number[];
    unisonWarpSpreads: number[];
    msegMorphs: number[];
    routeAmounts: number[];
    envelopeAttackSeconds: number[];
    envelopeDecaySeconds: number[];
    envelopeSustain: number[];
    envelopeReleaseSeconds: number[];
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number) {
    return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function normalizeNumber(value: unknown, fallback: number, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
    const numericValue = Number(value);
    return clamp(Number.isFinite(numericValue) ? numericValue : fallback, min, max);
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
    return clamp(Math.round(normalizeNumber(value, fallback)), min, max);
}

function cloneJson<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
}

function normalizeTriggerMode(value: unknown): ArticulationTriggerMode {
    return value === "key" || value === "vel" || value === "chain" ? value : "chain";
}

function createUnassignedRuntimeMap() {
    return Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
}

export function createDefaultArticulationName(runtimeSlot: number) {
    const safeRuntimeSlot = normalizeInteger(runtimeSlot, 0, 0, ARTICULATION_MAX_SLOTS - 1);
    const baseName = ARTICULATION_DEFAULT_NAMES[safeRuntimeSlot % ARTICULATION_DEFAULT_NAMES.length];
    const cycleIndex = Math.floor(safeRuntimeSlot / ARTICULATION_DEFAULT_NAMES.length);

    return cycleIndex === 0 ? baseName : `${baseName} ${cycleIndex + 1}`;
}

function createUniqueArticulationId(usedIds: Set<string>, runtimeSlot: number) {
    const baseId = `articulation-${runtimeSlot}`;

    if (!usedIds.has(baseId)) {
        return baseId;
    }

    for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
        const candidate = `${baseId}-${suffix}`;

        if (!usedIds.has(candidate)) {
            return candidate;
        }
    }

    return `${baseId}-${Date.now().toString(36)}`;
}

function createUniqueAssignmentId(
    assignments: ArticulationRangeAssignment[],
    prefix: string,
    articulationId: string,
    position: number,
) {
    const usedIds = new Set(assignments.map((assignment) => assignment.id));
    const baseId = `${prefix}-${articulationId}-${position}`;

    if (!usedIds.has(baseId)) {
        return baseId;
    }

    for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
        const candidate = `${baseId}-${suffix}`;

        if (!usedIds.has(candidate)) {
            return candidate;
        }
    }

    return `${baseId}-${Date.now().toString(36)}`;
}

function createUniqueCopiedName(slots: ArticulationSlot[], sourceName: string) {
    const usedNames = new Set(slots.map((slot) => slot.name));
    const baseName = `${sourceName} Copy`;

    if (!usedNames.has(baseName)) {
        return baseName;
    }

    for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
        const candidate = `${baseName} ${suffix}`;

        if (!usedNames.has(candidate)) {
            return candidate;
        }
    }

    return baseName;
}

export function createDefaultArticulationParameterSnapshot(): ArticulationParameterSnapshot {
    return {
        wavetablePosition: 0,
        pan: 0,
        octave: 0,
        semitone: 0,
        fineCents: 0,
        volumeDb: OSCILLATOR_DEFAULT_VOLUME_DB,
        mute: 0,
        solo: 0,
        warpMode: 0,
        warpAmount: 0,
        filterMode: 0,
        filterCutoff: 1000,
        filterQ: 0.707107,
        unisonVoices: 1,
        unisonDetune: 0.1,
        unisonBlend: 0.75,
        unisonWidth: 1,
        unisonPhase: 0,
        unisonRandom: 0,
        unisonPhaseMode: 0,
        unisonDetuneMode: 0,
        unisonStackMode: 0,
        unisonWavetablePositionSpread: 0,
        unisonWarpSpread: 0,
        msegMorphs: [0, 0, 0],
    };
}

export function normalizeArticulationParameterSnapshot(value: unknown): ArticulationParameterSnapshot {
    const defaults = createDefaultArticulationParameterSnapshot();
    const nextValue = value && typeof value === "object"
        ? value as Partial<ArticulationParameterSnapshot>
        : {};
    const msegMorphs = Array.isArray(nextValue.msegMorphs) ? nextValue.msegMorphs : [];

    return {
        wavetablePosition: normalizeNumber(nextValue.wavetablePosition, defaults.wavetablePosition, 0, 1),
        pan: normalizeNumber(nextValue.pan, defaults.pan, -1, 1),
        octave: normalizeInteger(nextValue.octave, defaults.octave, -4, 4),
        semitone: normalizeInteger(nextValue.semitone, defaults.semitone, -12, 12),
        fineCents: normalizeNumber(nextValue.fineCents, defaults.fineCents, -100, 100),
        volumeDb: normalizeNumber(
            nextValue.volumeDb,
            defaults.volumeDb,
            OSCILLATOR_VOLUME_MIN_DB,
            OSCILLATOR_VOLUME_MAX_DB,
        ),
        mute: normalizeInteger(nextValue.mute, defaults.mute, 0, 1),
        solo: normalizeInteger(nextValue.solo, defaults.solo, 0, 1),
        warpMode: normalizeInteger(nextValue.warpMode, defaults.warpMode, 0, 4),
        warpAmount: normalizeNumber(nextValue.warpAmount, defaults.warpAmount, 0, 1),
        filterMode: normalizeInteger(nextValue.filterMode, defaults.filterMode, 0, 5),
        filterCutoff: normalizeNumber(nextValue.filterCutoff, defaults.filterCutoff, 20, 20_000),
        filterQ: normalizeNumber(nextValue.filterQ, defaults.filterQ, 0.1, 20),
        unisonVoices: normalizeInteger(nextValue.unisonVoices, defaults.unisonVoices, 1, 8),
        unisonDetune: normalizeNumber(nextValue.unisonDetune, defaults.unisonDetune, 0, 1),
        unisonBlend: normalizeNumber(nextValue.unisonBlend, defaults.unisonBlend, 0, 1),
        unisonWidth: normalizeNumber(nextValue.unisonWidth, defaults.unisonWidth, 0, 1),
        unisonPhase: normalizeNumber(nextValue.unisonPhase, defaults.unisonPhase, 0, 1),
        unisonRandom: normalizeNumber(nextValue.unisonRandom, defaults.unisonRandom, 0, 1),
        unisonPhaseMode: normalizeInteger(nextValue.unisonPhaseMode, defaults.unisonPhaseMode, 0, 1),
        unisonDetuneMode: normalizeInteger(nextValue.unisonDetuneMode, defaults.unisonDetuneMode, 0, 4),
        unisonStackMode: normalizeInteger(nextValue.unisonStackMode, defaults.unisonStackMode, 0, 4),
        unisonWavetablePositionSpread: normalizeNumber(
            nextValue.unisonWavetablePositionSpread,
            defaults.unisonWavetablePositionSpread,
            0,
            1,
        ),
        unisonWarpSpread: normalizeNumber(nextValue.unisonWarpSpread, defaults.unisonWarpSpread, 0, 1),
        msegMorphs: [
            clamp01(Number(msegMorphs[0])),
            clamp01(Number(msegMorphs[1])),
            clamp01(Number(msegMorphs[2])),
        ],
    };
}

export function normalizeArticulationRouteAmountSnapshot(value: unknown): ArticulationRouteAmountSnapshot | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const nextValue = value as Partial<ArticulationRouteAmountSnapshot>;
    const routeId = typeof nextValue.routeId === "string" ? nextValue.routeId.trim() : "";

    if (!routeId) {
        return null;
    }

    return {
        routeId,
        amount: normalizeNumber(nextValue.amount, 0, -48, 48),
    };
}

export function createDefaultArticulationSnapshot(): ArticulationSnapshot {
    return {
        format: "cosimo.articulation.snapshot",
        version: 1,
        parameters: createDefaultArticulationParameterSnapshot(),
        envelopes: [0, 1, 2].map((slotIndex) => createDefaultEnvelope(slotIndex)),
        modRouteAmounts: [],
    };
}

export function normalizeArticulationSnapshot(value: unknown): ArticulationSnapshot {
    const nextValue = value && typeof value === "object"
        ? value as Partial<ArticulationSnapshot>
        : {};
    const routeAmounts = Array.isArray(nextValue.modRouteAmounts)
        ? nextValue.modRouteAmounts
            .map(normalizeArticulationRouteAmountSnapshot)
            .filter((entry): entry is ArticulationRouteAmountSnapshot => entry !== null)
        : [];
    const routeAmountById = new Map<string, ArticulationRouteAmountSnapshot>();

    for (const routeAmount of routeAmounts) {
        routeAmountById.set(routeAmount.routeId, routeAmount);
    }

    return {
        format: "cosimo.articulation.snapshot",
        version: 1,
        parameters: normalizeArticulationParameterSnapshot(nextValue.parameters),
        envelopes: [0, 1, 2].map((slotIndex) => normalizeEnvelope(
            Array.isArray(nextValue.envelopes) ? nextValue.envelopes[slotIndex] : undefined,
            slotIndex,
        )),
        modRouteAmounts: [...routeAmountById.values()],
    };
}

export function normalizeArticulationSlot(value: unknown, fallbackRuntimeSlot: number): ArticulationSlot | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const nextValue = value as Partial<ArticulationSlot>;
    const runtimeSlot = normalizeInteger(nextValue.runtimeSlot, fallbackRuntimeSlot, 0, ARTICULATION_MAX_SLOTS - 1);
    const id = typeof nextValue.id === "string" && nextValue.id.trim()
        ? nextValue.id.trim()
        : `articulation-${runtimeSlot}`;
    const name = typeof nextValue.name === "string" && nextValue.name.trim()
        ? nextValue.name.trim()
        : createDefaultArticulationName(runtimeSlot);

    return {
        id,
        runtimeSlot,
        name,
        snapshot: normalizeArticulationSnapshot(nextValue.snapshot),
    };
}

function normalizeKeyAssignment(value: unknown, validArticulationIds: Set<string>): ArticulationKeyAssignment | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const nextValue = value as Partial<ArticulationKeyAssignment>;
    const articulationId = typeof nextValue.articulationId === "string" ? nextValue.articulationId.trim() : "";

    if (!validArticulationIds.has(articulationId)) {
        return null;
    }

    return {
        note: normalizeInteger(nextValue.note, 0, 0, ARTICULATION_MAX_SLOTS - 1),
        articulationId,
    };
}

function normalizeRangeAssignment(
    value: unknown,
    validArticulationIds: Set<string>,
    assignmentIndex: number,
    idPrefix: string,
    minAllowed: number,
): ArticulationRangeAssignment | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const nextValue = value as Partial<ArticulationRangeAssignment>;
    const articulationId = typeof nextValue.articulationId === "string" ? nextValue.articulationId.trim() : "";

    if (!validArticulationIds.has(articulationId)) {
        return null;
    }

    let min = normalizeInteger(nextValue.min, minAllowed, minAllowed, ARTICULATION_MAX_SLOTS - 1);
    let max = normalizeInteger(nextValue.max, min, minAllowed, ARTICULATION_MAX_SLOTS - 1);

    if (max < min) {
        [min, max] = [max, min];
    }

    const id = typeof nextValue.id === "string" && nextValue.id.trim()
        ? nextValue.id.trim()
        : `${idPrefix}-${assignmentIndex}`;

    return {
        id,
        articulationId,
        min,
        max,
    };
}

function normalizeRangeAssignments(
    value: unknown,
    validArticulationIds: Set<string>,
    idPrefix: string,
    minAllowed: number,
) {
    const inputAssignments = Array.isArray(value) ? value : [];
    const usedIds = new Set<string>();
    const assignments: ArticulationRangeAssignment[] = [];

    for (let assignmentIndex = 0; assignmentIndex < inputAssignments.length; assignmentIndex += 1) {
        const assignment = normalizeRangeAssignment(
            inputAssignments[assignmentIndex],
            validArticulationIds,
            assignmentIndex,
            idPrefix,
            minAllowed,
        );

        if (!assignment || usedIds.has(assignment.id)) {
            continue;
        }

        usedIds.add(assignment.id);
        assignments.push(assignment);
    }

    return assignments;
}

function normalizeKeyAssignments(value: unknown, validArticulationIds: Set<string>) {
    const inputAssignments = Array.isArray(value) ? value : [];
    const usedNotes = new Set<number>();
    const assignments: ArticulationKeyAssignment[] = [];

    for (const inputAssignment of inputAssignments) {
        const assignment = normalizeKeyAssignment(inputAssignment, validArticulationIds);

        if (!assignment || usedNotes.has(assignment.note)) {
            continue;
        }

        usedNotes.add(assignment.note);
        assignments.push(assignment);
    }

    return assignments;
}

export function createDefaultArticulationEditorState(): ArticulationEditorState {
    return {
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [],
        chainAssignments: [],
        keyAssignments: [],
        velocityAssignments: [],
    };
}

export function normalizeArticulationEditorState(value: unknown): ArticulationEditorState {
    const nextValue = value && typeof value === "object"
        ? value as Partial<ArticulationEditorState>
        : {};
    const inputSlots = Array.isArray(nextValue.slots) ? nextValue.slots : [];
    const usedRuntimeSlots = new Set<number>();
    const usedIds = new Set<string>();
    const slots: ArticulationSlot[] = [];

    for (let slotIndex = 0; slotIndex < inputSlots.length && slots.length < ARTICULATION_MAX_SLOTS; slotIndex += 1) {
        const slot = normalizeArticulationSlot(inputSlots[slotIndex], slotIndex);

        if (!slot || usedRuntimeSlots.has(slot.runtimeSlot) || usedIds.has(slot.id)) {
            continue;
        }

        usedRuntimeSlots.add(slot.runtimeSlot);
        usedIds.add(slot.id);
        slots.push(slot);
    }

    const selectedSlotId = typeof nextValue.selectedSlotId === "string"
        && slots.some((slot) => slot.id === nextValue.selectedSlotId)
        ? nextValue.selectedSlotId
        : null;
    const validArticulationIds = new Set(slots.map((slot) => slot.id));

    return {
        selectedSlotId,
        activeTriggerMode: normalizeTriggerMode(nextValue.activeTriggerMode),
        slots,
        chainAssignments: normalizeRangeAssignments(nextValue.chainAssignments, validArticulationIds, "chain", 0),
        keyAssignments: normalizeKeyAssignments(nextValue.keyAssignments, validArticulationIds),
        velocityAssignments: normalizeRangeAssignments(nextValue.velocityAssignments, validArticulationIds, "velocity", 1),
    };
}

function serializeArticulationEditorState(value: unknown) {
    return JSON.stringify(normalizeArticulationEditorState(value));
}

export function articulationEditorStatesEqual(left: ArticulationEditorState, right: ArticulationEditorState) {
    return serializeArticulationEditorState(left) === serializeArticulationEditorState(right);
}

export function articulationSnapshotsEqual(left: ArticulationSnapshot, right: ArticulationSnapshot) {
    return JSON.stringify(normalizeArticulationSnapshot(left)) === JSON.stringify(normalizeArticulationSnapshot(right));
}

export function createArticulationSlotFromSnapshot(
    bankValue: unknown,
    snapshotValue: unknown,
): ArticulationSlot | null {
    const bank = normalizeArticulationEditorState(bankValue);
    const usedRuntimeSlots = new Set(bank.slots.map((slot) => slot.runtimeSlot));
    const usedIds = new Set(bank.slots.map((slot) => slot.id));
    let runtimeSlot = -1;

    for (let candidate = 0; candidate < ARTICULATION_MAX_SLOTS; candidate += 1) {
        if (!usedRuntimeSlots.has(candidate)) {
            runtimeSlot = candidate;
            break;
        }
    }

    if (runtimeSlot < 0) {
        return null;
    }

    return {
        id: createUniqueArticulationId(usedIds, runtimeSlot),
        runtimeSlot,
        name: createDefaultArticulationName(runtimeSlot),
        snapshot: cloneJson(normalizeArticulationSnapshot(snapshotValue)),
    };
}

function findFirstUnassignedIndex(assignedValues: Set<number>, minAllowed: number) {
    for (let candidate = minAllowed; candidate < ARTICULATION_MAX_SLOTS; candidate += 1) {
        if (!assignedValues.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

function collectRangeAssignedValues(assignments: ArticulationRangeAssignment[]) {
    const assignedValues = new Set<number>();

    for (const assignment of assignments) {
        for (let value = assignment.min; value <= assignment.max; value += 1) {
            assignedValues.add(value);
        }
    }

    return assignedValues;
}

export function assignArticulationToNextAvailableTrigger(
    bankValue: unknown,
    articulationId: string,
    modeValue?: ArticulationTriggerMode,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const mode = normalizeTriggerMode(modeValue ?? bank.activeTriggerMode);

    if (!bank.slots.some((slot) => slot.id === articulationId)) {
        return bank;
    }

    if (mode === "chain") {
        const nextSelector = findFirstUnassignedIndex(collectRangeAssignedValues(bank.chainAssignments), 0);

        if (nextSelector === null) {
            return bank;
        }

        return normalizeArticulationEditorState({
            ...bank,
            chainAssignments: [
                ...bank.chainAssignments,
                {
                    id: `chain-${articulationId}-${nextSelector}`,
                    articulationId,
                    min: nextSelector,
                    max: nextSelector,
                },
            ],
        });
    }

    if (mode === "key") {
        const usedNotes = new Set(bank.keyAssignments.map((assignment) => assignment.note));
        const nextNote = findFirstUnassignedIndex(usedNotes, 0);

        if (nextNote === null) {
            return bank;
        }

        return normalizeArticulationEditorState({
            ...bank,
            keyAssignments: [
                ...bank.keyAssignments,
                {
                    note: nextNote,
                    articulationId,
                },
            ],
        });
    }

    const nextVelocity = findFirstUnassignedIndex(collectRangeAssignedValues(bank.velocityAssignments), 1);

    if (nextVelocity === null) {
        return bank;
    }

    return normalizeArticulationEditorState({
        ...bank,
        velocityAssignments: [
            ...bank.velocityAssignments,
            {
                id: `velocity-${articulationId}-${nextVelocity}`,
                articulationId,
                min: nextVelocity,
                max: nextVelocity,
            },
        ],
    });
}

export function addCapturedArticulationToBank(
    bankValue: unknown,
    snapshotValue: unknown,
    options: { autoAssign?: boolean } = {},
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const nextSlot = createArticulationSlotFromSnapshot(bank, snapshotValue);

    if (!nextSlot) {
        return bank;
    }

    const nextBank = normalizeArticulationEditorState({
        ...bank,
        selectedSlotId: nextSlot.id,
        slots: [...bank.slots, nextSlot],
    });

    if (options.autoAssign === false) {
        return nextBank;
    }

    return assignArticulationToNextAvailableTrigger(nextBank, nextSlot.id, bank.activeTriggerMode);
}

export function upsertSelectedArticulationSnapshot(
    bankValue: unknown,
    slotId: string,
    snapshotValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const snapshot = normalizeArticulationSnapshot(snapshotValue);
    const slots = bank.slots.map((slot) => (
        slot.id === slotId
            ? { ...slot, snapshot }
            : slot
    ));

    return normalizeArticulationEditorState({
        ...bank,
        slots,
    });
}

export function setArticulationTriggerMode(
    bankValue: unknown,
    modeValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);

    return normalizeArticulationEditorState({
        ...bank,
        activeTriggerMode: normalizeTriggerMode(modeValue),
    });
}

export function renameArticulationSlot(
    bankValue: unknown,
    slotId: string,
    nextNameValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const nextName = typeof nextNameValue === "string" ? nextNameValue.trim() : "";

    if (!nextName) {
        return bank;
    }

    return normalizeArticulationEditorState({
        ...bank,
        slots: bank.slots.map((slot) => (
            slot.id === slotId
                ? { ...slot, name: nextName }
                : slot
        )),
    });
}

export function duplicateArticulationSlot(
    bankValue: unknown,
    slotId: string,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const sourceSlot = bank.slots.find((slot) => slot.id === slotId);

    if (!sourceSlot) {
        return bank;
    }

    const nextSlot = createArticulationSlotFromSnapshot(bank, sourceSlot.snapshot);

    if (!nextSlot) {
        return bank;
    }

    return normalizeArticulationEditorState({
        ...bank,
        selectedSlotId: nextSlot.id,
        slots: [
            ...bank.slots,
            {
                ...nextSlot,
                name: createUniqueCopiedName(bank.slots, sourceSlot.name),
            },
        ],
    });
}

export function deleteArticulationSlot(
    bankValue: unknown,
    slotId: string,
) {
    const bank = normalizeArticulationEditorState(bankValue);

    if (bank.slots.length <= 1 || !bank.slots.some((slot) => slot.id === slotId)) {
        return bank;
    }

    const slots = bank.slots.filter((slot) => slot.id !== slotId);

    return normalizeArticulationEditorState({
        ...bank,
        selectedSlotId: bank.selectedSlotId === slotId ? (slots[0]?.id ?? null) : bank.selectedSlotId,
        slots,
        chainAssignments: bank.chainAssignments.filter((assignment) => assignment.articulationId !== slotId),
        keyAssignments: bank.keyAssignments.filter((assignment) => assignment.articulationId !== slotId),
        velocityAssignments: bank.velocityAssignments.filter((assignment) => assignment.articulationId !== slotId),
    });
}

export function assignArticulationToKey(
    bankValue: unknown,
    noteValue: unknown,
    articulationId: string,
) {
    const bank = normalizeArticulationEditorState(bankValue);

    if (!bank.slots.some((slot) => slot.id === articulationId)) {
        return bank;
    }

    const note = normalizeInteger(noteValue, 0, 0, ARTICULATION_MAX_SLOTS - 1);

    return normalizeArticulationEditorState({
        ...bank,
        keyAssignments: [
            ...bank.keyAssignments.filter((assignment) => assignment.note !== note),
            { note, articulationId },
        ].sort((left, right) => left.note - right.note),
    });
}

function getRangeAssignmentField(mode: ArticulationTriggerMode) {
    if (mode === "vel") {
        return {
            field: "velocityAssignments" as const,
            minAllowed: 1,
            prefix: "velocity",
        };
    }

    return {
        field: "chainAssignments" as const,
        minAllowed: 0,
        prefix: "chain",
    };
}

function sortRangeAssignments(assignments: ArticulationRangeAssignment[]) {
    return [...assignments].sort((left, right) => left.min - right.min || left.max - right.max);
}

function keyAssignmentsToRangeAssignments(assignments: ArticulationKeyAssignment[]): ArticulationRangeAssignment[] {
    const sortedAssignments = [...assignments].sort((left, right) => left.note - right.note);
    const ranges: ArticulationRangeAssignment[] = [];

    for (const assignment of sortedAssignments) {
        const previous = ranges[ranges.length - 1];

        if (
            previous
            && previous.articulationId === assignment.articulationId
            && previous.max + 1 === assignment.note
        ) {
            previous.max = assignment.note;
            previous.id = `key-${previous.articulationId}-${previous.min}-${previous.max}`;
            continue;
        }

        ranges.push({
            id: `key-${assignment.articulationId}-${assignment.note}-${assignment.note}`,
            articulationId: assignment.articulationId,
            min: assignment.note,
            max: assignment.note,
        });
    }

    return ranges;
}

function rangeAssignmentsToKeyAssignments(assignments: ArticulationRangeAssignment[]): ArticulationKeyAssignment[] {
    const usedNotes = new Set<number>();
    const keyAssignments: ArticulationKeyAssignment[] = [];

    for (const assignment of sortRangeAssignments(assignments)) {
        for (let note = assignment.min; note <= assignment.max; note += 1) {
            if (usedNotes.has(note)) {
                continue;
            }

            usedNotes.add(note);
            keyAssignments.push({ note, articulationId: assignment.articulationId });
        }
    }

    return keyAssignments;
}

function getTriggerLaneInfo(bank: ArticulationEditorState, modeValue: unknown) {
    const mode = normalizeTriggerMode(modeValue);

    if (mode === "key") {
        return {
            mode,
            minAllowed: 0,
            maxAllowed: ARTICULATION_MAX_SLOTS - 1,
            prefix: "key",
            assignments: keyAssignmentsToRangeAssignments(bank.keyAssignments),
        };
    }

    const { field, minAllowed, prefix } = getRangeAssignmentField(mode);

    return {
        mode,
        minAllowed,
        maxAllowed: ARTICULATION_MAX_SLOTS - 1,
        prefix,
        assignments: bank[field],
    };
}

function setTriggerLaneAssignments(
    bank: ArticulationEditorState,
    mode: ArticulationTriggerMode,
    assignments: ArticulationRangeAssignment[],
) {
    const sortedAssignments = sortRangeAssignments(assignments);

    if (mode === "key") {
        return normalizeArticulationEditorState({
            ...bank,
            keyAssignments: rangeAssignmentsToKeyAssignments(sortedAssignments),
        });
    }

    const { field } = getRangeAssignmentField(mode);

    return normalizeArticulationEditorState({
        ...bank,
        [field]: sortedAssignments,
    });
}

function findRangeAssignmentAt(assignments: ArticulationRangeAssignment[], position: number) {
    return assignments.find((assignment) => position >= assignment.min && position <= assignment.max) ?? null;
}

function removeOtherAssignmentsForArticulation(
    assignments: ArticulationRangeAssignment[],
    articulationId: string,
    keepAssignmentId: string | null = null,
) {
    return assignments.filter((assignment) => (
        assignment.articulationId !== articulationId
        || (keepAssignmentId !== null && assignment.id === keepAssignmentId)
    ));
}

function findEmptyRangeGap(
    assignments: ArticulationRangeAssignment[],
    position: number,
    minAllowed: number,
    maxAllowed: number,
) {
    let gapMin = minAllowed;

    for (const assignment of sortRangeAssignments(assignments)) {
        if (position < assignment.min) {
            return {
                min: gapMin,
                max: Math.min(maxAllowed, assignment.min - 1),
            };
        }

        gapMin = Math.max(gapMin, assignment.max + 1);
    }

    return {
        min: gapMin,
        max: maxAllowed,
    };
}

function findMatchingRangeAssignment(
    assignments: ArticulationRangeAssignment[],
    segmentValue: unknown,
) {
    if (!segmentValue || typeof segmentValue !== "object") {
        return null;
    }

    const segment = segmentValue as Partial<ArticulationRangeAssignment>;
    const id = typeof segment.id === "string" ? segment.id : "";
    const articulationId = typeof segment.articulationId === "string" ? segment.articulationId : "";
    const min = Number(segment.min);
    const max = Number(segment.max);

    return assignments.find((assignment) => (
        (id && assignment.id === id)
        || (
            assignment.articulationId === articulationId
            && assignment.min === min
            && assignment.max === max
        )
    )) ?? null;
}

function carveAssignmentAroundRange(
    assignment: ArticulationRangeAssignment,
    carvedMin: number,
    carvedMax: number,
) {
    if (assignment.max < carvedMin || assignment.min > carvedMax) {
        return [assignment];
    }

    if (carvedMin <= assignment.min && carvedMax >= assignment.max) {
        return [];
    }

    if (carvedMin <= assignment.min) {
        const min = carvedMax + 1;
        return min <= assignment.max ? [{ ...assignment, min }] : [];
    }

    if (carvedMax >= assignment.max) {
        const max = carvedMin - 1;
        return max >= assignment.min ? [{ ...assignment, max }] : [];
    }

    const left = { ...assignment, max: carvedMin - 1 };
    const right = { ...assignment, min: carvedMax + 1 };
    const leftWidth = left.max - left.min + 1;
    const rightWidth = right.max - right.min + 1;

    return leftWidth >= rightWidth ? [left] : [right];
}

export function assignArticulationToRangePosition(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
    positionValue: unknown,
    articulationId: string,
) {
    const bank = normalizeArticulationEditorState(bankValue);

    if (!bank.slots.some((slot) => slot.id === articulationId)) {
        return bank;
    }

    const { mode, minAllowed, maxAllowed, prefix, assignments } = getTriggerLaneInfo(bank, modeValue);
    const position = normalizeInteger(positionValue, minAllowed, minAllowed, maxAllowed);
    const occupiedAssignment = assignments.find((assignment) => (
        position >= assignment.min && position <= assignment.max
    ));
    const nextAssignments = occupiedAssignment
        ? removeOtherAssignmentsForArticulation(
            assignments.map((assignment) => (
                assignment.id === occupiedAssignment.id
                    ? { ...assignment, articulationId }
                    : assignment
            )),
            articulationId,
            occupiedAssignment.id,
        )
        : (() => {
            const nextAssignmentsWithoutSameArticulation = removeOtherAssignmentsForArticulation(assignments, articulationId);
            const gap = findEmptyRangeGap(nextAssignmentsWithoutSameArticulation, position, minAllowed, maxAllowed);

            if (gap.max < gap.min) {
                return assignments;
            }

            return [
                ...nextAssignmentsWithoutSameArticulation,
                {
                    id: createUniqueAssignmentId(nextAssignmentsWithoutSameArticulation, prefix, articulationId, gap.min),
                    articulationId,
                    min: gap.min,
                    max: gap.max,
                },
            ];
        })();

    return setTriggerLaneAssignments(bank, mode, nextAssignments);
}

export function insertArticulationRangeAtPosition(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
    positionValue: unknown,
    articulationId: string,
    preserveSide?: ArticulationInsertPreserveSide,
) {
    const bank = normalizeArticulationEditorState(bankValue);

    if (!bank.slots.some((slot) => slot.id === articulationId)) {
        return bank;
    }

    const { mode, minAllowed, maxAllowed, prefix, assignments } = getTriggerLaneInfo(bank, modeValue);
    const position = normalizeInteger(positionValue, minAllowed, minAllowed, maxAllowed);
    const occupiedAssignment = findRangeAssignmentAt(assignments, position);
    let nextAssignments = assignments;

    if (occupiedAssignment) {
        if (occupiedAssignment.articulationId === articulationId) {
            return bank;
        }

        if (occupiedAssignment.min === occupiedAssignment.max) {
            return bank;
        }

        const trimFromMin = preserveSide === "upper"
            || (
                preserveSide !== "lower"
                && position - occupiedAssignment.min <= occupiedAssignment.max - position
            );
        nextAssignments = assignments.flatMap((assignment) => {
            if (assignment.id !== occupiedAssignment.id) {
                return [assignment];
            }

            if (trimFromMin) {
                const min = position + 1;
                return min <= assignment.max ? [{ ...assignment, min }] : [];
            }

            const max = position - 1;
            return max >= assignment.min ? [{ ...assignment, max }] : [];
        });
    }

    nextAssignments = removeOtherAssignmentsForArticulation(nextAssignments, articulationId);

    if (findRangeAssignmentAt(nextAssignments, position)) {
        return bank;
    }

    return setTriggerLaneAssignments(bank, mode, [
        ...nextAssignments,
        {
            id: createUniqueAssignmentId(nextAssignments, prefix, articulationId, position),
            articulationId,
            min: position,
            max: position,
        },
    ]);
}

export function moveArticulationRangeAssignment(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
    segmentValue: unknown,
    targetPositionValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const { mode, minAllowed, maxAllowed, assignments } = getTriggerLaneInfo(bank, modeValue);
    const target = findMatchingRangeAssignment(assignments, segmentValue);

    if (!target) {
        return bank;
    }

    const width = target.max - target.min + 1;
    const nextMin = normalizeInteger(
        Number(targetPositionValue) - Math.floor(width / 2),
        target.min,
        minAllowed,
        Math.max(minAllowed, maxAllowed - width + 1),
    );
    const nextTarget = {
        ...target,
        min: nextMin,
        max: nextMin + width - 1,
    };
    const otherAssignments = assignments
        .filter((assignment) => assignment.id !== target.id)
        .flatMap((assignment) => carveAssignmentAroundRange(assignment, nextTarget.min, nextTarget.max));

    if (
        nextTarget.min === target.min
        && nextTarget.max === target.max
        && otherAssignments.length === assignments.length - 1
    ) {
        return bank;
    }

    return setTriggerLaneAssignments(bank, mode, [...otherAssignments, nextTarget]);
}

export function resizeArticulationRangeAssignment(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
    segmentValue: unknown,
    edge: ArticulationRangeEditEdge,
    positionValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const { mode, minAllowed, maxAllowed, assignments } = getTriggerLaneInfo(bank, modeValue);
    const target = findMatchingRangeAssignment(assignments, segmentValue);

    if (!target) {
        return bank;
    }

    const position = normalizeInteger(positionValue, edge === "min" ? target.min : target.max, minAllowed, maxAllowed);
    const nextTarget = edge === "min"
        ? { ...target, min: clamp(position, minAllowed, target.max) }
        : { ...target, max: clamp(position, target.min, maxAllowed) };

    if (nextTarget.min === target.min && nextTarget.max === target.max) {
        return bank;
    }

    const otherAssignments = sortRangeAssignments(assignments.filter((assignment) => assignment.id !== target.id))
        .flatMap((assignment) => {
            if (edge === "min" && assignment.max >= nextTarget.min && assignment.max < target.min) {
                const max = nextTarget.min - 1;
                return assignment.min <= max ? [{ ...assignment, max }] : [];
            }

            if (edge === "max" && assignment.min <= nextTarget.max && assignment.min > target.max) {
                const min = nextTarget.max + 1;
                return min <= assignment.max ? [{ ...assignment, min }] : [];
            }

            return [assignment];
        });

    return setTriggerLaneAssignments(bank, mode, [...otherAssignments, nextTarget]);
}

export function clearArticulationRangeAssignment(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
    segmentValue: unknown,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const { mode, assignments } = getTriggerLaneInfo(bank, modeValue);
    const target = findMatchingRangeAssignment(assignments, segmentValue);

    if (!target) {
        return bank;
    }

    return setTriggerLaneAssignments(
        bank,
        mode,
        assignments.filter((assignment) => assignment.id !== target.id),
    );
}

export function clearArticulationTriggerAssignments(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const mode = normalizeTriggerMode(modeValue);

    return setTriggerLaneAssignments(bank, mode, []);
}

export function distributeArticulationRanges(
    bankValue: unknown,
    modeValue: ArticulationTriggerMode,
) {
    const bank = normalizeArticulationEditorState(bankValue);
    const { mode, minAllowed, maxAllowed, prefix, assignments } = getTriggerLaneInfo(bank, modeValue);
    const firstAssignmentByArticulation = new Map<string, ArticulationRangeAssignment>();

    for (const assignment of [...assignments].sort((left, right) => left.min - right.min)) {
        if (!firstAssignmentByArticulation.has(assignment.articulationId)) {
            firstAssignmentByArticulation.set(assignment.articulationId, assignment);
        }
    }

    const uniqueAssignments = [...firstAssignmentByArticulation.values()];

    if (uniqueAssignments.length === 0) {
        return bank;
    }

    const rangeLength = maxAllowed - minAllowed + 1;
    const nextAssignments = uniqueAssignments.map((assignment, assignmentIndex) => {
        const min = minAllowed + Math.floor((assignmentIndex * rangeLength) / uniqueAssignments.length);
        const max = assignmentIndex === uniqueAssignments.length - 1
            ? maxAllowed
            : minAllowed + Math.floor(((assignmentIndex + 1) * rangeLength) / uniqueAssignments.length) - 1;

        return {
            id: `${prefix}-${assignment.articulationId}-${min}`,
            articulationId: assignment.articulationId,
            min,
            max: Math.max(min, max),
        };
    });

    return setTriggerLaneAssignments(bank, mode, nextAssignments);
}

export function createDisabledArticulationRuntimeUpload(selectorA: number): ArticulationSnapshotRuntimeUpload {
    const perOscillator = (value: number) => OSCILLATOR_IDS.map(() => value);
    return {
        selectorA,
        enabled: false,
        oscillatorOverrideMasks: perOscillator(0),
        sharedOverrideMask: 0,
        framePositions: perOscillator(0),
        pans: perOscillator(0),
        octaves: perOscillator(0),
        semitones: perOscillator(0),
        fineCents: perOscillator(0),
        phases: perOscillator(0),
        phaseRandoms: perOscillator(0),
        retriggers: perOscillator(1),
        volumeDbs: perOscillator(OSCILLATOR_DEFAULT_VOLUME_DB),
        mutes: perOscillator(0),
        solos: perOscillator(0),
        warpModes: perOscillator(0),
        warpAmounts: perOscillator(0),
        filterMode: 0,
        filterCutoffHz: 1000,
        filterQ: 0.707107,
        unisonVoices: perOscillator(1),
        unisonDetunes: perOscillator(0.1),
        unisonBlends: perOscillator(0.75),
        unisonWidths: perOscillator(1),
        unisonDetuneModes: perOscillator(0),
        unisonStackModes: perOscillator(0),
        unisonWavetablePositionSpreads: perOscillator(0),
        unisonWarpSpreads: perOscillator(0),
        msegMorphs: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, () => 0),
        routeAmounts: Array.from({ length: MODULATION_ARTICULATION_ROUTE_CELL_COUNT }, () => 0),
        envelopeAttackSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).attackSeconds),
        envelopeDecaySeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).decaySeconds),
        envelopeSustain: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).sustain),
        envelopeReleaseSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).releaseSeconds),
    };
}

function fillRangeTriggerMap(
    target: number[],
    assignments: ArticulationRangeAssignment[],
    runtimeSlotByArticulationId: Map<string, number>,
) {
    for (const assignment of assignments) {
        const runtimeSlot = runtimeSlotByArticulationId.get(assignment.articulationId);

        if (runtimeSlot === undefined) {
            continue;
        }

        for (let value = assignment.min; value <= assignment.max; value += 1) {
            if (target[value] === ARTICULATION_UNASSIGNED_RUNTIME_SLOT) {
                target[value] = runtimeSlot;
            }
        }
    }
}

export function buildArticulationTriggerConfig(bankValue: unknown): ArticulationTriggerConfig {
    const bank = normalizeArticulationEditorState(bankValue);
    const runtimeSlotByArticulationId = new Map(bank.slots.map((slot) => [slot.id, slot.runtimeSlot]));
    const chain = createUnassignedRuntimeMap();
    const key = createUnassignedRuntimeMap();
    const velocity = createUnassignedRuntimeMap();

    fillRangeTriggerMap(chain, bank.chainAssignments, runtimeSlotByArticulationId);
    fillRangeTriggerMap(velocity, bank.velocityAssignments, runtimeSlotByArticulationId);

    for (const assignment of bank.keyAssignments) {
        const runtimeSlot = runtimeSlotByArticulationId.get(assignment.articulationId);

        if (runtimeSlot === undefined || key[assignment.note] !== ARTICULATION_UNASSIGNED_RUNTIME_SLOT) {
            continue;
        }

        key[assignment.note] = runtimeSlot;
    }

    velocity[0] = ARTICULATION_UNASSIGNED_RUNTIME_SLOT;

    return {
        format: "cosimo.articulation.triggerConfig",
        version: 1,
        activeMode: bank.activeTriggerMode,
        chain,
        key,
        velocity,
    };
}

export function serializeArticulationTriggerConfig(value: unknown) {
    const config = value && typeof value === "object" && (value as Partial<ArticulationTriggerConfig>).format === "cosimo.articulation.triggerConfig"
        ? value as ArticulationTriggerConfig
        : buildArticulationTriggerConfig(value);

    return JSON.stringify({
        format: "cosimo.articulation.triggerConfig",
        version: 1,
        activeMode: normalizeTriggerMode(config.activeMode),
        chain: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, index) => (
            normalizeInteger(config.chain?.[index], ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_MAX_SLOTS - 1)
        )),
        key: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, index) => (
            normalizeInteger(config.key?.[index], ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_MAX_SLOTS - 1)
        )),
        velocity: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, index) => (
            index === 0
                ? ARTICULATION_UNASSIGNED_RUNTIME_SLOT
                : normalizeInteger(config.velocity?.[index], ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_UNASSIGNED_RUNTIME_SLOT, ARTICULATION_MAX_SLOTS - 1)
        )),
    });
}

export function sendNativeArticulationTriggerConfig(configValue: unknown, patchConnection?: {
    sendNativeArticulationTriggerConfig?: (serializedConfig: string) => void;
}) {
    const serializedConfig = serializeArticulationTriggerConfig(configValue);
    patchConnection?.sendNativeArticulationTriggerConfig?.(serializedConfig);

    const globalObject = globalThis as typeof globalThis & {
        cosimo_set_articulation_trigger_config?: (serializedConfig: string) => unknown;
    };

    if (typeof globalObject.cosimo_set_articulation_trigger_config === "function") {
        globalObject.cosimo_set_articulation_trigger_config(serializedConfig);
    }
}
