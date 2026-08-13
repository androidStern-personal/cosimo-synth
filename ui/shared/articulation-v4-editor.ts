import {
    ARTICULATION_MAX_SLOTS,
    type ArticulationTriggerMode,
} from "./articulations";
import {
    ARTICULATION_VOICE_PARAMETER_IDS,
    lowestFreeRuntimeSlot,
    type ArticulationRange,
    type ArticulationSlotV4,
    type ArticulationVoiceParameterId,
    type ArticulationsState,
} from "./articulation-image";

export type ArticulationRangeSegment = {
    id: string;
    articulationId: string;
    min: number;
    max: number;
};

export type ArticulationRangeEditEdge = "min" | "max";
export type ArticulationInsertPreserveSide = "lower" | "upper";

export type CapturedArticulationLayer = {
    overrides: Readonly<Partial<Record<ArticulationVoiceParameterId, number>>>;
    routeAmounts: Readonly<Record<string, number>>;
};

/**
 * Return only visible values that differ from the complete patch base.
 * Explicit zero remains an override whenever the inherited value is non-zero.
 */
export function diffCapturedArticulationLayerV4(
    current: CapturedArticulationLayer,
    base: CapturedArticulationLayer,
): CapturedArticulationLayer {
    const overrides: Partial<Record<ArticulationVoiceParameterId, number>> = {};
    for (const parameterId of ARTICULATION_VOICE_PARAMETER_IDS) {
        const value = current.overrides[parameterId];
        if (value === undefined) continue;
        const baseValue = base.overrides[parameterId];
        if (baseValue === undefined || value !== baseValue) {
            overrides[parameterId] = value;
        }
    }

    const routeAmounts: Record<string, number> = {};
    for (const [routeId, amount] of Object.entries(current.routeAmounts)) {
        const baseAmount = base.routeAmounts[routeId];
        if (baseAmount === undefined || amount !== baseAmount) {
            routeAmounts[routeId] = amount;
        }
    }

    return { overrides, routeAmounts };
}

/**
 * Replace the fields owned by today's visible editor while retaining every
 * unrepresented A/B/C value and route in the authoritative v4 slot.
 */
export function replaceVisibleArticulationLayerV4(
    state: ArticulationsState,
    slotId: string,
    layer: CapturedArticulationLayer,
    visibleParameterIds: ReadonlySet<ArticulationVoiceParameterId>,
    visibleRouteIds: ReadonlySet<string>,
): ArticulationsState {
    return updateSlot(state, slotId, (slot) => {
        const overrides: Partial<Record<ArticulationVoiceParameterId, number>> = {};
        for (const parameterId of ARTICULATION_VOICE_PARAMETER_IDS) {
            const value = slot.overrides[parameterId];
            if (value !== undefined && !visibleParameterIds.has(parameterId)) {
                overrides[parameterId] = value;
            }
        }
        Object.assign(overrides, layer.overrides);

        const routeAmounts: Record<string, number> = {};
        for (const [routeId, amount] of Object.entries(slot.routeAmounts)) {
            if (!visibleRouteIds.has(routeId)) {
                routeAmounts[routeId] = amount;
            }
        }
        Object.assign(routeAmounts, layer.routeAmounts);

        return { ...slot, overrides, routeAmounts };
    });
}

const ARTICULATION_COLORS = [
    "var(--articulation-1, #67e8f9)",
    "var(--articulation-2, #fbbf24)",
    "var(--articulation-3, #a78bfa)",
    "var(--articulation-4, #fb7185)",
    "var(--articulation-5, #34d399)",
] as const;

const ARTICULATION_DEFAULT_NAMES = [
    "Bow Forte",
    "Bow Pianissimo",
    "Pluck Round",
    "Pluck Snap",
    "Hammer",
    "Air Pad",
    "Bell Strike",
    "Choke",
] as const;

function clampInteger(value: unknown, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

function laneBounds(mode: ArticulationTriggerMode): { min: number; max: number } {
    return { min: mode === "vel" ? 1 : 0, max: ARTICULATION_MAX_SLOTS - 1 };
}

function slotRange(slot: ArticulationSlotV4, mode: ArticulationTriggerMode): ArticulationRange {
    if (mode === "key") return { min: slot.key, max: slot.key };
    return mode === "vel" ? slot.velRange : slot.chainRange;
}

function withSlotRange(
    slot: ArticulationSlotV4,
    mode: ArticulationTriggerMode,
    range: ArticulationRange,
): ArticulationSlotV4 {
    if (mode === "key") return { ...slot, key: range.min };
    return mode === "vel" ? { ...slot, velRange: range } : { ...slot, chainRange: range };
}

function updateSlot(
    state: ArticulationsState,
    slotId: string,
    update: (slot: ArticulationSlotV4) => ArticulationSlotV4,
): ArticulationsState {
    if (!state.slots.some((slot) => slot.id === slotId)) return state;
    return {
        ...state,
        slots: state.slots.map((slot) => slot.id === slotId ? update(slot) : slot),
    };
}

function usedPoints(state: ArticulationsState, mode: ArticulationTriggerMode): Set<number> {
    const used = new Set<number>();
    for (const slot of state.slots) {
        const range = slotRange(slot, mode);
        for (let value = range.min; value <= range.max; value += 1) used.add(value);
    }
    return used;
}

function firstFreePoint(state: ArticulationsState, mode: ArticulationTriggerMode): number {
    const bounds = laneBounds(mode);
    const used = usedPoints(state, mode);
    for (let value = bounds.min; value <= bounds.max; value += 1) {
        if (!used.has(value)) return value;
    }
    return bounds.min;
}

function uniqueId(state: ArticulationsState, runtimeSlot: number): string {
    const used = new Set(state.slots.map((slot) => slot.id));
    const base = `articulation-${runtimeSlot}`;
    if (!used.has(base)) return base;
    for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
        const candidate = `${base}-${suffix}`;
        if (!used.has(candidate)) return candidate;
    }
    throw new Error("Articulation id space is exhausted.");
}

function uniqueCopyName(state: ArticulationsState, sourceName: string): string {
    const names = new Set(state.slots.map((slot) => slot.name));
    const base = `${sourceName} Copy`;
    if (!names.has(base)) return base;
    for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
        const candidate = `${base} ${suffix}`;
        if (!names.has(candidate)) return candidate;
    }
    return base;
}

export function addCapturedArticulationV4(
    state: ArticulationsState,
    layer: CapturedArticulationLayer,
): ArticulationsState {
    const runtimeSlot = lowestFreeRuntimeSlot(state);
    if (runtimeSlot === null) return state;
    const key = firstFreePoint(state, "key");
    const velocity = firstFreePoint(state, "vel");
    const chain = firstFreePoint(state, "chain");
    const slot: ArticulationSlotV4 = {
        id: uniqueId(state, runtimeSlot),
        runtimeSlot,
        name: ARTICULATION_DEFAULT_NAMES[runtimeSlot % ARTICULATION_DEFAULT_NAMES.length] ?? `Articulation ${runtimeSlot + 1}`,
        color: ARTICULATION_COLORS[runtimeSlot % ARTICULATION_COLORS.length] ?? ARTICULATION_COLORS[0],
        key,
        velRange: { min: velocity, max: velocity },
        chainRange: { min: chain, max: chain },
        overrides: { ...layer.overrides },
        routeAmounts: { ...layer.routeAmounts },
    };
    return { ...state, selectedSlotId: slot.id, slots: [...state.slots, slot] };
}

export function replaceArticulationLayerV4(
    state: ArticulationsState,
    slotId: string,
    layer: CapturedArticulationLayer,
): ArticulationsState {
    return updateSlot(state, slotId, (slot) => ({
        ...slot,
        overrides: { ...layer.overrides },
        routeAmounts: { ...layer.routeAmounts },
    }));
}

export function selectArticulationV4(state: ArticulationsState, slotId: string): ArticulationsState {
    return state.slots.some((slot) => slot.id === slotId)
        ? { ...state, selectedSlotId: slotId }
        : state;
}

export function setArticulationTriggerModeV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
): ArticulationsState {
    return state.activeTriggerMode === mode ? state : { ...state, activeTriggerMode: mode };
}

export function renameArticulationV4(
    state: ArticulationsState,
    slotId: string,
    name: string,
): ArticulationsState {
    const trimmed = name.trim();
    return trimmed ? updateSlot(state, slotId, (slot) => ({ ...slot, name: trimmed })) : state;
}

export function duplicateArticulationV4(state: ArticulationsState, slotId: string): ArticulationsState {
    const source = state.slots.find((slot) => slot.id === slotId);
    const runtimeSlot = lowestFreeRuntimeSlot(state);
    if (!source || runtimeSlot === null) return state;
    const slot: ArticulationSlotV4 = {
        ...source,
        id: uniqueId(state, runtimeSlot),
        runtimeSlot,
        name: uniqueCopyName(state, source.name),
        key: firstFreePoint(state, "key"),
        velRange: (() => {
            const value = firstFreePoint(state, "vel");
            return { min: value, max: value };
        })(),
        chainRange: (() => {
            const value = firstFreePoint(state, "chain");
            return { min: value, max: value };
        })(),
        overrides: { ...source.overrides },
        routeAmounts: { ...source.routeAmounts },
    };
    return { ...state, selectedSlotId: slot.id, slots: [...state.slots, slot] };
}

export function deleteArticulationV4(state: ArticulationsState, slotId: string): ArticulationsState {
    if (state.slots.length <= 1 || !state.slots.some((slot) => slot.id === slotId)) return state;
    const slots = state.slots.filter((slot) => slot.id !== slotId);
    return {
        ...state,
        selectedSlotId: state.selectedSlotId === slotId ? (slots[0]?.id ?? null) : state.selectedSlotId,
        slots,
    };
}

export function articulationSegmentsV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
): ReadonlyArray<ArticulationRangeSegment> {
    return state.slots.map((slot) => {
        const range = slotRange(slot, mode);
        return {
            id: `${mode}-${slot.id}`,
            articulationId: slot.id,
            min: range.min,
            max: range.max,
        };
    }).sort((left, right) => left.min - right.min || left.max - right.max);
}

function findSlotForSegment(
    state: ArticulationsState,
    segment: ArticulationRangeSegment,
): ArticulationSlotV4 | undefined {
    return state.slots.find((slot) => slot.id === segment.articulationId);
}

function gapContaining(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    position: number,
    excludingSlotId: string,
): ArticulationRange | null {
    const bounds = laneBounds(mode);
    const occupied = state.slots
        .filter((slot) => slot.id !== excludingSlotId)
        .map((slot) => slotRange(slot, mode))
        .sort((left, right) => left.min - right.min);
    const blocking = occupied.find((range) => position >= range.min && position <= range.max);
    if (blocking) return null;
    const below = occupied.filter((range) => range.max < position).at(-1);
    const above = occupied.find((range) => range.min > position);
    return {
        min: Math.max(bounds.min, (below?.max ?? (bounds.min - 1)) + 1),
        max: Math.min(bounds.max, (above?.min ?? (bounds.max + 1)) - 1),
    };
}

export function assignArticulationPositionV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    positionValue: number,
    slotId: string,
): ArticulationsState {
    const target = state.slots.find((slot) => slot.id === slotId);
    if (!target) return state;
    const bounds = laneBounds(mode);
    const position = clampInteger(positionValue, bounds.min, bounds.max);
    const occupant = state.slots.find((slot) => {
        if (slot.id === slotId) return false;
        const range = slotRange(slot, mode);
        return position >= range.min && position <= range.max;
    });
    if (occupant) {
        const targetRange = slotRange(target, mode);
        const occupantRange = slotRange(occupant, mode);
        return {
            ...state,
            slots: state.slots.map((slot) => {
                if (slot.id === target.id) return withSlotRange(slot, mode, occupantRange);
                if (slot.id === occupant.id) return withSlotRange(slot, mode, targetRange);
                return slot;
            }),
        };
    }
    if (mode === "key") {
        return updateSlot(state, slotId, (slot) => withSlotRange(
            slot,
            mode,
            { min: position, max: position },
        ));
    }
    const gap = gapContaining(state, mode, position, slotId);
    return gap ? updateSlot(state, slotId, (slot) => withSlotRange(slot, mode, gap)) : state;
}

export function insertArticulationPositionV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    positionValue: number,
    slotId: string,
    preserveSide?: ArticulationInsertPreserveSide,
): ArticulationsState {
    if (mode === "key") return assignArticulationPositionV4(state, mode, positionValue, slotId);
    const target = state.slots.find((slot) => slot.id === slotId);
    if (!target) return state;
    const bounds = laneBounds(mode);
    const position = clampInteger(positionValue, bounds.min, bounds.max);
    const occupant = state.slots.find((slot) => {
        if (slot.id === slotId) return false;
        const range = slotRange(slot, mode);
        return position >= range.min && position <= range.max;
    });
    if (!occupant) {
        return updateSlot(state, slotId, (slot) => withSlotRange(slot, mode, { min: position, max: position }));
    }
    const occupiedRange = slotRange(occupant, mode);
    if (occupiedRange.min === occupiedRange.max) return state;
    const canKeepLower = position > occupiedRange.min;
    const canKeepUpper = position < occupiedRange.max;
    const keepUpper = !canKeepLower
        || (canKeepUpper && (
            preserveSide === "upper"
            || (preserveSide !== "lower" && position - occupiedRange.min <= occupiedRange.max - position)
        ));
    const trimmed = keepUpper
        ? { min: position + 1, max: occupiedRange.max }
        : { min: occupiedRange.min, max: position - 1 };
    return {
        ...state,
        slots: state.slots.map((slot) => {
            if (slot.id === slotId) return withSlotRange(slot, mode, { min: position, max: position });
            if (slot.id === occupant.id) return withSlotRange(slot, mode, trimmed);
            return slot;
        }),
    };
}

function freeIntervals(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    excludingSlotId: string,
): ReadonlyArray<ArticulationRange> {
    const bounds = laneBounds(mode);
    const occupied = state.slots
        .filter((slot) => slot.id !== excludingSlotId)
        .map((slot) => slotRange(slot, mode))
        .sort((left, right) => left.min - right.min);
    const intervals: ArticulationRange[] = [];
    let start = bounds.min;
    for (const range of occupied) {
        if (start < range.min) intervals.push({ min: start, max: range.min - 1 });
        start = Math.max(start, range.max + 1);
    }
    if (start <= bounds.max) intervals.push({ min: start, max: bounds.max });
    return intervals;
}

export function moveArticulationSegmentV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    segment: ArticulationRangeSegment,
    targetPosition: number,
): ArticulationsState {
    const slot = findSlotForSegment(state, segment);
    if (!slot) return state;
    if (mode === "key") return assignArticulationPositionV4(state, mode, targetPosition, slot.id);
    const current = slotRange(slot, mode);
    const width = current.max - current.min + 1;
    const candidates = freeIntervals(state, mode, slot.id).filter((range) => range.max - range.min + 1 >= width);
    if (candidates.length === 0) return state;
    const desiredMin = Math.round(targetPosition) - Math.floor(width / 2);
    const placements = candidates.map((range) => {
        const min = Math.min(range.max - width + 1, Math.max(range.min, desiredMin));
        return { min, max: min + width - 1 };
    }).sort((left, right) => Math.abs(left.min - desiredMin) - Math.abs(right.min - desiredMin));
    const placement = placements[0];
    return placement === undefined
        ? state
        : updateSlot(state, slot.id, (candidate) => withSlotRange(candidate, mode, placement));
}

export function resizeArticulationSegmentV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    segment: ArticulationRangeSegment,
    edge: ArticulationRangeEditEdge,
    positionValue: number,
): ArticulationsState {
    const slot = findSlotForSegment(state, segment);
    if (!slot || mode === "key") return state;
    const current = slotRange(slot, mode);
    const bounds = laneBounds(mode);
    const others = state.slots.filter((candidate) => candidate.id !== slot.id).map((candidate) => slotRange(candidate, mode));
    if (edge === "min") {
        const floor = Math.max(bounds.min, ...others.filter((range) => range.max < current.max).map((range) => range.max + 1));
        const min = clampInteger(positionValue, floor, current.max);
        return updateSlot(state, slot.id, (candidate) => withSlotRange(candidate, mode, { min, max: current.max }));
    }
    const ceilings = others.filter((range) => range.min > current.min).map((range) => range.min - 1);
    const ceiling = Math.min(bounds.max, ...(ceilings.length > 0 ? ceilings : [bounds.max]));
    const max = clampInteger(positionValue, current.min, ceiling);
    return updateSlot(state, slot.id, (candidate) => withSlotRange(candidate, mode, { min: current.min, max }));
}

export function collapseArticulationSegmentV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
    segment: ArticulationRangeSegment,
): ArticulationsState {
    const slot = findSlotForSegment(state, segment);
    if (!slot) return state;
    const range = slotRange(slot, mode);
    return updateSlot(state, slot.id, (candidate) => withSlotRange(candidate, mode, { min: range.min, max: range.min }));
}

export function collapseAllArticulationSegmentsV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
): ArticulationsState {
    const bounds = laneBounds(mode);
    return {
        ...state,
        slots: state.slots.map((slot, index) => {
            const value = Math.min(bounds.max, bounds.min + index);
            return withSlotRange(slot, mode, { min: value, max: value });
        }),
    };
}

export function distributeArticulationSegmentsV4(
    state: ArticulationsState,
    mode: ArticulationTriggerMode,
): ArticulationsState {
    if (state.slots.length === 0) return state;
    if (mode === "key") return collapseAllArticulationSegmentsV4(state, mode);
    const bounds = laneBounds(mode);
    const sorted = [...state.slots].sort((left, right) => {
        const leftRange = slotRange(left, mode);
        const rightRange = slotRange(right, mode);
        return leftRange.min - rightRange.min || left.runtimeSlot - right.runtimeSlot;
    });
    const span = bounds.max - bounds.min + 1;
    const ranges = new Map(sorted.map((slot, index) => {
        const min = bounds.min + Math.floor((index * span) / sorted.length);
        const max = index === sorted.length - 1
            ? bounds.max
            : bounds.min + Math.floor(((index + 1) * span) / sorted.length) - 1;
        return [slot.id, { min, max }] as const;
    }));
    return {
        ...state,
        slots: state.slots.map((slot) => {
            const range = ranges.get(slot.id);
            return range === undefined ? slot : withSlotRange(slot, mode, range);
        }),
    };
}
