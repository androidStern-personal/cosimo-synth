import {
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MAX_ROUTES,
    MODULATION_MSEG_SLOT_COUNT,
    clampModulationRouteAmount,
    createDefaultEnvelope,
    normalizeEnvelope,
    normalizeRoute,
    type ModulationEnvelope,
    type ModulationRoute,
} from "./modulation";

export const ARTICULATION_STATE_KEY = "articulations.v2";
export const ARTICULATION_TRIGGER_CONFIG_STATE_KEY = "articulationTriggerConfig.v1";
export const ARTICULATION_SNAPSHOT_ENDPOINT_ID = "articulationSnapshot";
export const ARTICULATION_MAX_SLOTS = 128;
export const ARTICULATION_UNASSIGNED_RUNTIME_SLOT = -1;

export type ArticulationTriggerMode = "chain" | "key" | "vel";

export type ArticulationParameterSnapshot = {
    wavetablePosition: number;
    playMode: number;
    glideTime: number;
    pan: number;
    warpMode: number;
    warpAmount: number;
    filterMode: number;
    filterCutoff: number;
    filterQ: number;
    msegMorphs: [number, number, number];
    distortionMode: number;
    distortionDriveDb: number;
    distortionKnee: number;
    distortionWet: number;
    distortionWetHPHz: number;
    distortionWetLPHz: number;
    chorusEnabled: number;
    chorusMix: number;
    chorusMotionMode: number;
    chorusBloomMode: number;
    chorusTone: number;
    chorusFeedback: number;
    chorusRingAmount: number;
    chorusRingOffsetMode: number;
    chorusRingFineSemitones: number;
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

export type ArticulationBank = {
    format: "cosimo.articulations";
    version: 2;
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
    framePosition: number;
    pan: number;
    warpMode: number;
    warpAmount: number;
    filterMode: number;
    filterCutoffHz: number;
    filterQ: number;
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

export function createDefaultArticulationParameterSnapshot(): ArticulationParameterSnapshot {
    return {
        wavetablePosition: 0,
        playMode: 0,
        glideTime: 0,
        pan: 0,
        warpMode: 0,
        warpAmount: 0,
        filterMode: 0,
        filterCutoff: 1000,
        filterQ: 0.707107,
        msegMorphs: [0, 0, 0],
        distortionMode: 0,
        distortionDriveDb: 12,
        distortionKnee: 0.35,
        distortionWet: 0,
        distortionWetHPHz: 40,
        distortionWetLPHz: 18_000,
        chorusEnabled: 0,
        chorusMix: 0,
        chorusMotionMode: 1,
        chorusBloomMode: 0,
        chorusTone: 0.5,
        chorusFeedback: 0.42,
        chorusRingAmount: 0,
        chorusRingOffsetMode: 0,
        chorusRingFineSemitones: 0,
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
        playMode: normalizeInteger(nextValue.playMode, defaults.playMode, 0, 2),
        glideTime: normalizeNumber(nextValue.glideTime, defaults.glideTime, 0, 2),
        pan: normalizeNumber(nextValue.pan, defaults.pan, -1, 1),
        warpMode: normalizeInteger(nextValue.warpMode, defaults.warpMode, 0, 4),
        warpAmount: normalizeNumber(nextValue.warpAmount, defaults.warpAmount, 0, 1),
        filterMode: normalizeInteger(nextValue.filterMode, defaults.filterMode, 0, 5),
        filterCutoff: normalizeNumber(nextValue.filterCutoff, defaults.filterCutoff, 20, 20_000),
        filterQ: normalizeNumber(nextValue.filterQ, defaults.filterQ, 0.1, 20),
        msegMorphs: [
            clamp01(Number(msegMorphs[0])),
            clamp01(Number(msegMorphs[1])),
            clamp01(Number(msegMorphs[2])),
        ],
        distortionMode: normalizeInteger(nextValue.distortionMode, defaults.distortionMode, 0, 1),
        distortionDriveDb: normalizeNumber(nextValue.distortionDriveDb, defaults.distortionDriveDb, 0, 36),
        distortionKnee: normalizeNumber(nextValue.distortionKnee, defaults.distortionKnee, 0, 1),
        distortionWet: normalizeNumber(nextValue.distortionWet, defaults.distortionWet, 0, 1),
        distortionWetHPHz: normalizeNumber(nextValue.distortionWetHPHz, defaults.distortionWetHPHz, 20, 4_000),
        distortionWetLPHz: normalizeNumber(nextValue.distortionWetLPHz, defaults.distortionWetLPHz, 20, 20_000),
        chorusEnabled: normalizeInteger(nextValue.chorusEnabled, defaults.chorusEnabled, 0, 1),
        chorusMix: normalizeNumber(nextValue.chorusMix, defaults.chorusMix, 0, 1),
        chorusMotionMode: normalizeInteger(nextValue.chorusMotionMode, defaults.chorusMotionMode, 0, 3),
        chorusBloomMode: normalizeInteger(nextValue.chorusBloomMode, defaults.chorusBloomMode, 0, 4),
        chorusTone: normalizeNumber(nextValue.chorusTone, defaults.chorusTone, 0, 1),
        chorusFeedback: normalizeNumber(nextValue.chorusFeedback, defaults.chorusFeedback, 0, 0.95),
        chorusRingAmount: normalizeNumber(nextValue.chorusRingAmount, defaults.chorusRingAmount, 0, 1),
        chorusRingOffsetMode: normalizeInteger(nextValue.chorusRingOffsetMode, defaults.chorusRingOffsetMode, 0, 3),
        chorusRingFineSemitones: normalizeNumber(nextValue.chorusRingFineSemitones, defaults.chorusRingFineSemitones, -2, 2),
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
        : `Art ${runtimeSlot + 1}`;

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

export function createDefaultArticulationBank(): ArticulationBank {
    return {
        format: "cosimo.articulations",
        version: 2,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [],
        chainAssignments: [],
        keyAssignments: [],
        velocityAssignments: [],
    };
}

export function normalizeArticulationBank(value: unknown): ArticulationBank {
    let parsedValue = value;

    if (typeof parsedValue === "string" && parsedValue.trim()) {
        try {
            parsedValue = JSON.parse(parsedValue);
        } catch {
            parsedValue = null;
        }
    }

    const nextValue = parsedValue && typeof parsedValue === "object"
        ? parsedValue as Partial<ArticulationBank>
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
        format: "cosimo.articulations",
        version: 2,
        selectedSlotId,
        activeTriggerMode: normalizeTriggerMode(nextValue.activeTriggerMode),
        slots,
        chainAssignments: normalizeRangeAssignments(nextValue.chainAssignments, validArticulationIds, "chain", 0),
        keyAssignments: normalizeKeyAssignments(nextValue.keyAssignments, validArticulationIds),
        velocityAssignments: normalizeRangeAssignments(nextValue.velocityAssignments, validArticulationIds, "velocity", 1),
    };
}

export function serializeArticulationBank(value: unknown) {
    return JSON.stringify(normalizeArticulationBank(value));
}

export function articulationBanksEqual(left: ArticulationBank, right: ArticulationBank) {
    return serializeArticulationBank(left) === serializeArticulationBank(right);
}

export function articulationSnapshotsEqual(left: ArticulationSnapshot, right: ArticulationSnapshot) {
    return JSON.stringify(normalizeArticulationSnapshot(left)) === JSON.stringify(normalizeArticulationSnapshot(right));
}

export function createArticulationSlotFromSnapshot(
    bankValue: unknown,
    snapshotValue: unknown,
): ArticulationSlot | null {
    const bank = normalizeArticulationBank(bankValue);
    const usedRuntimeSlots = new Set(bank.slots.map((slot) => slot.runtimeSlot));
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
        id: `articulation-${runtimeSlot}`,
        runtimeSlot,
        name: `Art ${runtimeSlot + 1}`,
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
    const bank = normalizeArticulationBank(bankValue);
    const mode = normalizeTriggerMode(modeValue ?? bank.activeTriggerMode);

    if (!bank.slots.some((slot) => slot.id === articulationId)) {
        return bank;
    }

    if (mode === "chain") {
        const nextSelector = findFirstUnassignedIndex(collectRangeAssignedValues(bank.chainAssignments), 0);

        if (nextSelector === null) {
            return bank;
        }

        return normalizeArticulationBank({
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

        return normalizeArticulationBank({
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

    return normalizeArticulationBank({
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

export function addCapturedArticulationToBank(bankValue: unknown, snapshotValue: unknown) {
    const bank = normalizeArticulationBank(bankValue);
    const nextSlot = createArticulationSlotFromSnapshot(bank, snapshotValue);

    if (!nextSlot) {
        return bank;
    }

    return assignArticulationToNextAvailableTrigger({
        ...bank,
        selectedSlotId: nextSlot.id,
        slots: [...bank.slots, nextSlot],
    }, nextSlot.id, bank.activeTriggerMode);
}

export function upsertSelectedArticulationSnapshot(
    bankValue: unknown,
    slotId: string,
    snapshotValue: unknown,
) {
    const bank = normalizeArticulationBank(bankValue);
    const snapshot = normalizeArticulationSnapshot(snapshotValue);
    const slots = bank.slots.map((slot) => (
        slot.id === slotId
            ? { ...slot, snapshot }
            : slot
    ));

    return normalizeArticulationBank({
        ...bank,
        slots,
    });
}

function createDisabledRuntimeUpload(selectorA: number): ArticulationSnapshotRuntimeUpload {
    return {
        selectorA,
        enabled: false,
        framePosition: 0,
        pan: 0,
        warpMode: 0,
        warpAmount: 0,
        filterMode: 0,
        filterCutoffHz: 1000,
        filterQ: 0.707107,
        msegMorphs: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, () => 0),
        routeAmounts: Array.from({ length: MODULATION_MAX_ROUTES }, () => 0),
        envelopeAttackSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).attackSeconds),
        envelopeDecaySeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).decaySeconds),
        envelopeSustain: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).sustain),
        envelopeReleaseSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex).releaseSeconds),
    };
}

function normalizeRuntimeRoutes(routesValue: unknown): ModulationRoute[] {
    return Array.isArray(routesValue)
        ? routesValue.slice(0, MODULATION_MAX_ROUTES).map((route, routeIndex) => normalizeRoute(route, routeIndex))
        : [];
}

export function buildArticulationRuntimeUploads(
    bankValue: unknown,
    currentRoutesValue: unknown = [],
): ArticulationSnapshotRuntimeUpload[] {
    const bank = normalizeArticulationBank(bankValue);
    const currentRoutes = normalizeRuntimeRoutes(currentRoutesValue);
    const slotByRuntimeSlot = new Map(bank.slots.map((slot) => [slot.runtimeSlot, slot]));

    return Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, selectorA) => {
        const slot = slotByRuntimeSlot.get(selectorA);

        if (!slot) {
            return createDisabledRuntimeUpload(selectorA);
        }

        const snapshot = normalizeArticulationSnapshot(slot.snapshot);
        const parameters = snapshot.parameters;
        const routeAmountById = new Map(snapshot.modRouteAmounts.map((routeAmount) => [
            routeAmount.routeId,
            routeAmount.amount,
        ]));

        return {
            selectorA,
            enabled: true,
            framePosition: parameters.wavetablePosition,
            pan: parameters.pan,
            warpMode: parameters.warpMode,
            warpAmount: parameters.warpAmount,
            filterMode: parameters.filterMode,
            filterCutoffHz: parameters.filterCutoff,
            filterQ: parameters.filterQ,
            msegMorphs: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => (
                parameters.msegMorphs[slotIndex] ?? 0
            )),
            routeAmounts: Array.from({ length: MODULATION_MAX_ROUTES }, (_, routeIndex) => {
                const route = currentRoutes[routeIndex];

                if (!route) {
                    return 0;
                }

                if (!routeAmountById.has(route.id)) {
                    return route.amount;
                }

                return clampModulationRouteAmount(
                    route.targetKind,
                    Number(routeAmountById.get(route.id)),
                );
            }),
            envelopeAttackSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                snapshot.envelopes[slotIndex]?.attackSeconds ?? createDefaultEnvelope(slotIndex).attackSeconds
            )),
            envelopeDecaySeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                snapshot.envelopes[slotIndex]?.decaySeconds ?? createDefaultEnvelope(slotIndex).decaySeconds
            )),
            envelopeSustain: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                snapshot.envelopes[slotIndex]?.sustain ?? createDefaultEnvelope(slotIndex).sustain
            )),
            envelopeReleaseSeconds: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                snapshot.envelopes[slotIndex]?.releaseSeconds ?? createDefaultEnvelope(slotIndex).releaseSeconds
            )),
        };
    });
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
    const bank = normalizeArticulationBank(bankValue);
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
