import {
    ArticulationSlotsExhausted,
    MappingAlreadyExists,
    ROUTE_BUDGET,
    RouteBudgetExceeded,
    SourceSlotsExhausted,
    type ArticulationTriggerMode,
    type AuditionState,
    type CompoundSetting,
    type CosimoAdapterPort,
    type CosimoCommands,
    type MappingReducer,
    type ModulationMapping,
    type ModulationSource,
    type PatchSnapshot,
    type RangeClampOutcome,
    type SourceType,
} from "./cosimo-adapter-port";
import {
    affectedSelectors,
    createEmptyArticulationsState,
    lowestFreeRuntimeSlot,
    parseArticulationsV3,
    resolveArticulationImage,
    resolveArticulationImages,
    serializeArticulationsV3,
    type ArticulationSlotV3,
    type ArticulationsState,
    type ArticulationVoiceParameterId,
    type PatchVoiceBase,
} from "./articulation-image";
import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ARTICULATION_TRIGGER_CONFIG_STATE_KEY,
    ARTICULATION_UNASSIGNED_RUNTIME_SLOT,
    createDefaultArticulationName,
    serializeArticulationTriggerConfig,
    type ArticulationSnapshotRuntimeUpload,
    type ArticulationTriggerConfig,
} from "./articulations";
import type { PatchConnectionLike } from "./cmajor-react";
import {
    clampNormalizedValue,
    makeMappingId,
    parseNormalizedValue,
    splitMappingId,
    type ArticulationId,
    type MappingId,
    type NormalizedValue,
    type SourceId,
    type TargetId,
} from "./cosimo-ids";
import {
    MODULATION_MACRO_SLOT_COUNT,
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    acquireModulationRuntimeBridge,
    createDefaultEnvelope,
    createDefaultModulationState,
    getModulationAmountBounds,
    releaseModulationRuntimeBridge,
    type ModulationEnvelope,
    type ModulationRoute,
    type ModulationRuntimeBridge,
    type ModulationSourceKind,
    type ModulationState,
    type ModulationTargetKind,
} from "./modulation";
import { createDefaultMsegPlayback, createDefaultMsegShape } from "./mseg";
import { err, ok } from "./result";
import {
    allTargetDescriptors,
    getTargetDescriptor,
    parseTargetId,
    type EffectModuleId,
    type ModAmountSpec,
    type TargetDescriptor,
} from "./target-descriptor";

const UI_PATCH_VALUES_STATE_KEY = "uiPatchValues.v1";
const UI_MAPPINGS_STATE_KEY = "uiMappings.v1";
const RACK_STATE_KEY = "rackState.v1";

const EFFECT_ORDER: ReadonlyArray<EffectModuleId> = [
    "filter",
    "drive",
    "ott",
    "chorus",
    "flanger",
    "phaser",
    "delay",
    "reverb",
];

const ARTICULATION_COLORS = [
    "#d2a128",
    "#d76a4a",
    "#5aa7a7",
    "#8f7bd8",
    "#8fae4d",
    "#d48bac",
] as const;

const INITIAL_VISIBLE_SOURCE_IDS = ["macro-1", "envelope-1", "mseg-1"] as const;

type SourceDefinition = {
    readonly idRaw: string;
    readonly type: SourceType;
    readonly slot: number | null;
    readonly label: string;
    readonly sourceKind: ModulationSourceKind;
    readonly sourceSlot: number | null;
};

type ValidRoute = {
    readonly route: ModulationRoute;
    readonly routeIndex: number;
    readonly targetId: TargetId;
    readonly sourceId: SourceId;
    readonly descriptor: TargetDescriptor;
};

type PendingUiMapping = ModulationMapping;

type MappingReference =
    | { readonly _tag: "engine"; readonly validRoute: ValidRoute }
    | {
          readonly _tag: "ui";
          readonly mapping: PendingUiMapping;
          readonly descriptor: TargetDescriptor;
      };

type StoredUiMapping = {
    readonly targetId: TargetId;
    readonly sourceId: SourceId;
    readonly amount: number;
    readonly polarity: ModulationMapping["polarity"];
    readonly reducer: MappingReducer;
    readonly enabled: boolean;
};

type RackState = {
    readonly order: ReadonlyArray<EffectModuleId>;
    readonly enabled: Readonly<Record<EffectModuleId, boolean>>;
    readonly compound: Readonly<Record<TargetId, CompoundSetting>>;
};

type ParseOutcome<T> =
    | { readonly _tag: "ok"; readonly value: T }
    | { readonly _tag: "err"; readonly message: string };

type DeletedSourceBackup = {
    readonly definition: SourceDefinition;
    readonly modulationState: ModulationState;
    readonly macroValue: NormalizedValue | null;
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly uiMappings: ReadonlyArray<PendingUiMapping>;
    readonly mappingCreationOrder: ReadonlyArray<string>;
    readonly articulationRouteAmounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseError<T>(message: string): ParseOutcome<T> {
    return { _tag: "err", message };
}

function parseJsonDocument(input: unknown, label: string): ParseOutcome<unknown> {
    if (typeof input !== "string") {
        return { _tag: "ok", value: input };
    }

    if (input.trim().length === 0) {
        return parseError(`${label} must not be an empty string`);
    }

    try {
        const parsed: unknown = JSON.parse(input);
        return { _tag: "ok", value: parsed };
    } catch (cause: unknown) {
        const detail = cause instanceof Error ? cause.message : "unknown JSON parse failure";
        return parseError(`${label} is not valid JSON: ${detail}`);
    }
}

function readFullStoredStateValue(storedState: unknown, key: string): unknown {
    if (!isRecord(storedState)) {
        return undefined;
    }

    const nestedValues = isRecord(storedState.values) ? storedState.values : null;
    if (nestedValues !== null && Object.hasOwn(nestedValues, key)) {
        return nestedValues[key];
    }

    return Object.hasOwn(storedState, key) ? storedState[key] : undefined;
}

function createSourceDefinitions(): ReadonlyArray<SourceDefinition> {
    return MODULATION_SOURCE_OPTIONS.map((option) => {
        const type: SourceType = option.sourceKind === "env"
            ? "envelope"
            : option.sourceKind === "velocity" || option.sourceKind === "pressure" || option.sourceKind === "slide"
                ? "fixed"
                : option.sourceKind;
        const idRaw = option.sourceKind === "env"
            ? `envelope-${option.sourceSlot ?? 0}`
            : option.value;
        const label = option.sourceKind === "env"
            ? `Envelope ${option.sourceSlot ?? 0}`
            : option.label;

        return {
            idRaw,
            type,
            slot: option.sourceSlot,
            label,
            sourceKind: option.sourceKind,
            sourceSlot: option.sourceSlot,
        };
    });
}

const SOURCE_DEFINITIONS = createSourceDefinitions();
const SOURCE_DEFINITION_BY_ID = new Map(SOURCE_DEFINITIONS.map((definition) => [definition.idRaw, definition]));

function sourceIdFromDefinition(definition: SourceDefinition): SourceId {
    // SAFETY: SOURCE_DEFINITIONS is the bridge's closed product-source catalog;
    // every definition has a canonical product-shaped id.
    return definition.idRaw as SourceId;
}

function articulationIdFromSlot(slot: ArticulationSlotV3): ArticulationId {
    // SAFETY: the slot was either accepted by parseArticulationsV3 or minted by
    // this adapter after uniqueness was checked against the authoritative bank.
    return slot.id as ArticulationId;
}

function mappingIdFromRoute(route: ModulationRoute): MappingId {
    // SAFETY: callers invoke this only after requireValidRoute has proved that
    // route.id equals makeMappingId for validated target and source identities.
    return route.id as MappingId;
}

function finiteClamp(value: number, min: number, max: number): number {
    const finite = Number.isFinite(value) ? value : 0;
    return Math.min(max, Math.max(min, finite));
}

function clampSpecAmount(spec: ModAmountSpec, amount: number): number {
    return finiteClamp(amount, spec.min, spec.max);
}

function defaultSpecAmount(spec: ModAmountSpec): number {
    const magnitude = Math.max(Math.abs(spec.min), Math.abs(spec.max));
    return clampSpecAmount(spec, Math.round(magnitude * 2.5) / 10);
}

function specAmountToRouteAmount(
    spec: ModAmountSpec,
    targetKind: ModulationTargetKind,
    amount: number,
): number {
    const normalizedAmount = clampSpecAmount(spec, amount);
    const routeBounds = getModulationAmountBounds(targetKind);

    if (normalizedAmount < 0) {
        const specSpan = Math.abs(spec.min);
        return specSpan === 0 ? 0 : (Math.abs(routeBounds.min) * normalizedAmount) / specSpan;
    }

    if (normalizedAmount > 0) {
        return spec.max === 0 ? 0 : (routeBounds.max * normalizedAmount) / spec.max;
    }

    return 0;
}

function routeAmountToSpecAmount(
    spec: ModAmountSpec,
    targetKind: ModulationTargetKind,
    amount: number,
): number {
    const routeBounds = getModulationAmountBounds(targetKind);
    const normalizedAmount = finiteClamp(amount, routeBounds.min, routeBounds.max);

    if (normalizedAmount < 0) {
        const routeSpan = Math.abs(routeBounds.min);
        return routeSpan === 0 ? 0 : (Math.abs(spec.min) * normalizedAmount) / routeSpan;
    }

    if (normalizedAmount > 0) {
        return routeBounds.max === 0 ? 0 : (spec.max * normalizedAmount) / routeBounds.max;
    }

    return 0;
}

function createInitialParameterValues(): Record<string, NormalizedValue> {
    return Object.fromEntries(
        allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor.initialValue]),
    );
}

function createInitialRackState(): RackState {
    const enabled: Record<EffectModuleId, boolean> = {
        filter: true,
        drive: true,
        ott: true,
        chorus: true,
        flanger: true,
        phaser: true,
        delay: true,
        reverb: true,
    };
    return {
        order: [...EFFECT_ORDER],
        enabled,
        compound: {},
    };
}

function parseUiPatchValues(input: unknown): ParseOutcome<Record<string, NormalizedValue>> {
    const document = parseJsonDocument(input, UI_PATCH_VALUES_STATE_KEY);
    if (document._tag === "err") {
        return document;
    }

    if (!isRecord(document.value)) {
        return parseError(`${UI_PATCH_VALUES_STATE_KEY} must be a flat object`);
    }

    const descriptors = allTargetDescriptors();
    const descriptorIds = new Set(descriptors.map((descriptor) => String(descriptor.targetId)));
    for (const key of Reflect.ownKeys(document.value)) {
        if (typeof key !== "string" || !descriptorIds.has(key)) {
            return parseError(`${UI_PATCH_VALUES_STATE_KEY} has unknown target "${String(key)}"`);
        }
    }

    const values: Record<string, NormalizedValue> = {};
    for (const descriptor of descriptors) {
        if (!Object.hasOwn(document.value, descriptor.targetId)) {
            return parseError(`${UI_PATCH_VALUES_STATE_KEY} is missing target "${descriptor.targetId}"`);
        }

        const rawValue = document.value[descriptor.targetId];
        if (typeof rawValue !== "number") {
            return parseError(`${UI_PATCH_VALUES_STATE_KEY}.${descriptor.targetId} must be a number`);
        }

        const parsedValue = parseNormalizedValue(rawValue);
        if (parsedValue._tag === "err") {
            return parseError(`${UI_PATCH_VALUES_STATE_KEY}.${descriptor.targetId}: ${parsedValue.error.message}`);
        }
        values[descriptor.targetId] = parsedValue.value;
    }

    return { _tag: "ok", value: values };
}

function requireEffectId(input: string): EffectModuleId {
    const effectId = EFFECT_ORDER.find((candidate) => candidate === input);
    if (effectId === undefined) {
        throw new Error(`Unknown effect id: ${input}`);
    }
    return effectId;
}

function parseCompoundSettings(input: unknown): ParseOutcome<Readonly<Record<TargetId, CompoundSetting>>> {
    if (input === undefined) {
        return { _tag: "ok", value: {} };
    }

    if (!isRecord(input)) {
        return parseError(`${RACK_STATE_KEY}.compound must be an object`);
    }

    const compound: Record<string, CompoundSetting> = {};
    for (const [targetIdRaw, rawSetting] of Object.entries(input)) {
        const parsedTarget = parseTargetId(targetIdRaw);
        if (parsedTarget._tag === "err") {
            return parseError(`${RACK_STATE_KEY}.compound has unknown target "${targetIdRaw}"`);
        }
        const descriptor = getTargetDescriptor(parsedTarget.value);
        if (descriptor.compound !== "sync") {
            return parseError(`${RACK_STATE_KEY}.compound target "${targetIdRaw}" is not compound`);
        }
        if (!isRecord(rawSetting)) {
            return parseError(`${RACK_STATE_KEY}.compound.${targetIdRaw} must be an object`);
        }
        const keys = Reflect.ownKeys(rawSetting);
        if (keys.length !== 2 || !Object.hasOwn(rawSetting, "mode") || !Object.hasOwn(rawSetting, "division")) {
            return parseError(`${RACK_STATE_KEY}.compound.${targetIdRaw} must contain mode and division`);
        }
        if (rawSetting.mode !== "Free" && rawSetting.mode !== "Sync") {
            return parseError(`${RACK_STATE_KEY}.compound.${targetIdRaw}.mode must be Free or Sync`);
        }
        if (typeof rawSetting.division !== "string" || rawSetting.division.length === 0) {
            return parseError(`${RACK_STATE_KEY}.compound.${targetIdRaw}.division must be a non-empty string`);
        }
        compound[parsedTarget.value] = {
            mode: rawSetting.mode,
            division: rawSetting.division,
        };
    }

    return { _tag: "ok", value: compound };
}

function parseRackState(input: unknown): ParseOutcome<RackState> {
    const document = parseJsonDocument(input, RACK_STATE_KEY);
    if (document._tag === "err") {
        return document;
    }
    if (!isRecord(document.value)) {
        return parseError(`${RACK_STATE_KEY} must be an object`);
    }

    const allowedKeys = new Set(["order", "enabled", "compound"]);
    for (const key of Reflect.ownKeys(document.value)) {
        if (typeof key !== "string" || !allowedKeys.has(key)) {
            return parseError(`${RACK_STATE_KEY} has unexpected field "${String(key)}"`);
        }
    }

    if (!Array.isArray(document.value.order) || document.value.order.length !== EFFECT_ORDER.length) {
        return parseError(`${RACK_STATE_KEY}.order must contain every effect exactly once`);
    }
    const order: Array<EffectModuleId> = [];
    const seenEffects = new Set<EffectModuleId>();
    for (const rawEffectId of document.value.order) {
        if (typeof rawEffectId !== "string") {
            return parseError(`${RACK_STATE_KEY}.order entries must be strings`);
        }
        let effectId: EffectModuleId;
        try {
            effectId = requireEffectId(rawEffectId);
        } catch {
            return parseError(`${RACK_STATE_KEY}.order has unknown effect "${rawEffectId}"`);
        }
        if (seenEffects.has(effectId)) {
            return parseError(`${RACK_STATE_KEY}.order duplicates "${effectId}"`);
        }
        seenEffects.add(effectId);
        order.push(effectId);
    }

    if (!isRecord(document.value.enabled)) {
        return parseError(`${RACK_STATE_KEY}.enabled must be an object`);
    }
    const enabledKeys = Reflect.ownKeys(document.value.enabled);
    if (enabledKeys.length !== EFFECT_ORDER.length) {
        return parseError(`${RACK_STATE_KEY}.enabled must contain every effect exactly once`);
    }
    const enabled: Record<EffectModuleId, boolean> = {
        filter: false,
        drive: false,
        ott: false,
        chorus: false,
        flanger: false,
        phaser: false,
        delay: false,
        reverb: false,
    };
    for (const effectId of EFFECT_ORDER) {
        const rawEnabled = document.value.enabled[effectId];
        if (typeof rawEnabled !== "boolean") {
            return parseError(`${RACK_STATE_KEY}.enabled.${effectId} must be boolean`);
        }
        enabled[effectId] = rawEnabled;
    }

    const compound = parseCompoundSettings(document.value.compound);
    if (compound._tag === "err") {
        return compound;
    }

    return {
        _tag: "ok",
        value: { order, enabled, compound: compound.value },
    };
}

function parseUiMappings(input: unknown): ParseOutcome<Map<MappingId, PendingUiMapping>> {
    const document = parseJsonDocument(input, UI_MAPPINGS_STATE_KEY);
    if (document._tag === "err") {
        return document;
    }
    if (!isRecord(document.value)) {
        return parseError(`${UI_MAPPINGS_STATE_KEY} must be an object`);
    }

    const mappings = new Map<MappingId, PendingUiMapping>();
    const requiredFields = new Set(["targetId", "sourceId", "amount", "polarity", "reducer", "enabled"]);
    for (const mappingKey of Reflect.ownKeys(document.value)) {
        if (typeof mappingKey !== "string") {
            return parseError(`${UI_MAPPINGS_STATE_KEY} has a non-string mapping id`);
        }

        const rawMapping = document.value[mappingKey];
        if (!isRecord(rawMapping)) {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} must be an object`);
        }
        const mappingFields = Reflect.ownKeys(rawMapping);
        if (mappingFields.length !== requiredFields.size) {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} must contain exactly targetId, sourceId, amount, polarity, reducer, enabled`);
        }
        for (const field of mappingFields) {
            if (typeof field !== "string" || !requiredFields.has(field)) {
                return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} has unexpected field "${String(field)}"`);
            }
        }

        if (typeof rawMapping.targetId !== "string") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey}.targetId must be a string`);
        }
        const parsedTarget = parseTargetId(rawMapping.targetId);
        if (parsedTarget._tag === "err") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} has unknown target "${rawMapping.targetId}"`);
        }
        const descriptor = getTargetDescriptor(parsedTarget.value);
        if (descriptor.modulationTargetKind !== null) {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} target must be engine-gapped`);
        }

        if (typeof rawMapping.sourceId !== "string") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey}.sourceId must be a string`);
        }
        const definition = SOURCE_DEFINITION_BY_ID.get(rawMapping.sourceId);
        if (definition === undefined) {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} has unknown source "${rawMapping.sourceId}"`);
        }
        const sourceId = sourceIdFromDefinition(definition);
        const mappingId = makeMappingId(parsedTarget.value, sourceId);
        if (String(mappingId) !== mappingKey) {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey} is not the canonical id for its target and source`);
        }

        if (typeof rawMapping.amount !== "number"
            || !Number.isFinite(rawMapping.amount)
            || rawMapping.amount < descriptor.modAmount.min
            || rawMapping.amount > descriptor.modAmount.max) {
            return parseError(
                `${UI_MAPPINGS_STATE_KEY}.${mappingKey}.amount must be within [${descriptor.modAmount.min}, ${descriptor.modAmount.max}]`,
            );
        }
        if (rawMapping.polarity !== "Unipolar" && rawMapping.polarity !== "Bipolar") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey}.polarity must be Unipolar or Bipolar`);
        }
        if (rawMapping.reducer !== "Max" && rawMapping.reducer !== "Mean") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey}.reducer must be Max or Mean`);
        }
        if (typeof rawMapping.enabled !== "boolean") {
            return parseError(`${UI_MAPPINGS_STATE_KEY}.${mappingKey}.enabled must be boolean`);
        }

        mappings.set(mappingId, {
            id: mappingId,
            targetId: parsedTarget.value,
            sourceId,
            amount: rawMapping.amount,
            polarity: rawMapping.polarity,
            reducer: rawMapping.reducer,
            enabled: rawMapping.enabled,
        });
    }

    if (mappings.size > ROUTE_BUDGET) {
        return parseError(`${UI_MAPPINGS_STATE_KEY} exceeds the shared route budget of ${ROUTE_BUDGET}`);
    }
    return { _tag: "ok", value: mappings };
}

function parseStoredArticulations(input: unknown): ParseOutcome<ArticulationsState> {
    const document = parseJsonDocument(input, "articulations.v3");
    if (document._tag === "err") {
        return document;
    }
    const parsed = parseArticulationsV3(document.value);
    return parsed._tag === "ok"
        ? { _tag: "ok", value: parsed.value }
        : parseError(parsed.error.message);
}

function stableToken(value: unknown): string {
    try {
        return `${typeof value}:${JSON.stringify(value)}`;
    } catch {
        return `${typeof value}:${String(value)}`;
    }
}

function midiNoteNumber(note: string): number {
    const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim());
    if (match === null) {
        throw new Error(`Invalid audition note: ${note}`);
    }
    const letter = match[1];
    const accidental = match[2];
    const octaveRaw = match[3];
    if (letter === undefined || accidental === undefined || octaveRaw === undefined) {
        throw new Error(`Invalid audition note: ${note}`);
    }
    const naturalOffsets: Readonly<Record<string, number>> = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11,
    };
    const naturalOffset = naturalOffsets[letter.toUpperCase()];
    if (naturalOffset === undefined) {
        throw new Error(`Invalid audition note: ${note}`);
    }
    const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
    const noteNumber = (Number(octaveRaw) + 2) * 12 + naturalOffset + accidentalOffset;
    if (!Number.isInteger(noteNumber) || noteNumber < 0 || noteNumber > 127) {
        throw new Error(`Audition note is outside MIDI range: ${note}`);
    }
    return noteNumber;
}

function noteOnCode(noteNumber: number): number {
    return (0x90 << 16) | (noteNumber << 8) | 100;
}

function noteOffCode(noteNumber: number): number {
    return (0x80 << 16) | (noteNumber << 8);
}

function clampMidiValue(value: number): number {
    return Math.min(127, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

class CosimoBridgeAdapter implements CosimoAdapterPort {
    private readonly connection: PatchConnectionLike;
    private readonly modulationBridge: ModulationRuntimeBridge;
    private parameterValues = createInitialParameterValues();
    private articulations = createEmptyArticulationsState();
    private rackState = createInitialRackState();
    private connectionState: PatchSnapshot["connection"] = { _tag: "connecting" };
    private audition: AuditionState = {
        articulation: "Default",
        note: "C3",
        repeat: false,
        latch: false,
        triggerActive: false,
        captureCandidate: null,
        status: "Waiting for note",
    };
    private readonly macroValues: Array<NormalizedValue> = Array.from(
        { length: MODULATION_MACRO_SLOT_COUNT },
        () => clampNormalizedValue(0),
    );
    private readonly visibleSourceIds = new Set<string>(INITIAL_VISIBLE_SOURCE_IDS);
    private readonly routeReducers = new Map<string, MappingReducer>();
    private uiMappings = new Map<MappingId, PendingUiMapping>();
    private mappingCreationOrder: Array<string> = [];
    private readonly listeners = new Set<() => void>();
    private readonly pendingStoredStateEchoes = new Map<string, Map<string, number>>();
    private deletedSourceBackup: DeletedSourceBackup | null = null;
    private activeMidiNote: number | null = null;
    private snapshot: PatchSnapshot;
    private commandDepth = 0;
    private snapshotDirty = false;
    private hydrationComplete = false;
    private disposed = false;

    private readonly handleModulationState = (state: ModulationState): void => {
        if (this.disposed) {
            return;
        }
        if (!this.hydrationComplete) {
            this.markSnapshotDirty();
            return;
        }
        const validRoutes = this.collectValidRoutes(state);
        if (validRoutes.length !== state.routes.length) {
            this.modulationBridge.replaceRoutes(validRoutes.map(({ route }) => route));
            return;
        }
        this.adoptValidRoutes(validRoutes);
    };

    private adoptValidRoutes(validRoutes: ReadonlyArray<ValidRoute>): void {
        if (validRoutes.length + this.uiMappings.size > ROUTE_BUDGET) {
            this.detach(`Stored mappings exceed the shared route budget of ${ROUTE_BUDGET}`);
            return;
        }
        for (const validRoute of validRoutes) {
            const definition = SOURCE_DEFINITION_BY_ID.get(String(validRoute.sourceId));
            if (definition !== undefined && definition.type !== "fixed") {
                this.visibleSourceIds.add(definition.idRaw);
            }
            if (!this.routeReducers.has(validRoute.route.id)) {
                this.routeReducers.set(validRoute.route.id, "Max");
            }
        }
        this.synchronizeMappingCreationOrder(validRoutes);
        this.markSnapshotDirty();
    }

    private readonly handleStoredStateValue = (message: unknown): void => {
        if (this.disposed || !isRecord(message) || typeof message.key !== "string") {
            return;
        }
        if (this.consumePendingStoredStateEcho(message.key, message.value)) {
            return;
        }

        this.runCommand(() => {
            if (message.key === UI_PATCH_VALUES_STATE_KEY) {
                const parsed = parseUiPatchValues(message.value);
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                this.parameterValues = parsed.value;
                this.uploadAllBoundBaseValues();
                this.uploadAllArticulationImages();
                this.markSnapshotDirty();
                return;
            }
            if (message.key === RACK_STATE_KEY) {
                const parsed = parseRackState(message.value);
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                this.rackState = parsed.value;
                this.markSnapshotDirty();
                return;
            }
            if (message.key === UI_MAPPINGS_STATE_KEY) {
                const parsed = parseUiMappings(message.value);
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                const validRoutes = this.collectValidRoutes(this.modulationBridge.getState());
                if (validRoutes.length + parsed.value.size > ROUTE_BUDGET) {
                    this.detach(`Stored mappings exceed the shared route budget of ${ROUTE_BUDGET}`);
                    return;
                }
                this.uiMappings = parsed.value;
                this.revealMappedSources(this.uiMappings.values());
                this.synchronizeMappingCreationOrder(validRoutes);
                this.markSnapshotDirty();
                return;
            }
            if (message.key === "articulations.v3") {
                const parsed = parseStoredArticulations(message.value);
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                this.articulations = parsed.value;
                this.uploadAllArticulationImages();
                this.sendNativeTriggerConfig();
                this.markSnapshotDirty();
            }
        });
    };

    constructor(connection: PatchConnectionLike) {
        this.connection = connection;
        this.modulationBridge = acquireModulationRuntimeBridge(connection);
        this.snapshot = this.buildSnapshot();
        this.modulationBridge.subscribe(this.handleModulationState);
        this.handleModulationState(this.modulationBridge.getState());
        this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);

        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => this.hydrate(storedState));
        } else {
            this.hydrate({});
        }
    }

    getSnapshot(): PatchSnapshot {
        return this.snapshot;
    }

    subscribe(onChange: () => void): () => void {
        this.listeners.add(onChange);
        return () => this.listeners.delete(onChange);
    }

    readonly commands: CosimoCommands = {
        setParameter: (input) => this.runCommand(() => this.setParameter(input)),
        addMapping: (input) => this.runCommand(() => this.addMapping(input)),
        removeMapping: (mappingId) => this.runCommand(() => this.removeMapping(mappingId)),
        setMappingAmount: (mappingId, amount, layer) => this.runCommand(
            () => this.setMappingAmount(mappingId, amount, layer),
        ),
        setMappingEnabled: (mappingId, enabled) => this.runCommand(
            () => this.setMappingEnabled(mappingId, enabled),
        ),
        setMappingPolarity: (mappingId, polarity) => this.runCommand(
            () => this.setMappingPolarity(mappingId, polarity),
        ),
        setMappingReducer: (mappingId, reducer) => this.runCommand(
            () => this.setMappingReducer(mappingId, reducer),
        ),
        createSource: (type) => this.runCommand(() => this.createSource(type)),
        deleteSource: (sourceId) => this.runCommand(() => this.deleteSource(sourceId)),
        undoDeleteSource: () => this.runCommand(() => this.undoDeleteSource()),
        setMacroValue: (sourceId, value) => this.runCommand(() => this.setMacroValue(sourceId, value)),
        renameMacro: (sourceId, name) => this.runCommand(() => this.renameMacro(sourceId, name)),
        setEnvelope: (sourceId, envelope) => this.runCommand(() => this.setEnvelope(sourceId, envelope)),
        setMsegShape: (input) => this.runCommand(() => {
            const definition = this.requireSource(input.sourceId, "mseg");
            this.modulationBridge.setMsegSlotShape(this.slotIndex(definition), input.shapeIndex, input.shape);
        }),
        setMsegMorph: (input) => this.runCommand(() => this.setMsegMorph(input)),
        setMsegPlayback: (input) => this.runCommand(() => {
            const definition = this.requireSource(input.sourceId, "mseg");
            this.modulationBridge.setMsegSlotPlayback(this.slotIndex(definition), input.playback);
        }),
        addArticulation: () => this.runCommand(() => this.addArticulation()),
        duplicateArticulation: (articulationId) => this.runCommand(
            () => this.duplicateArticulation(articulationId),
        ),
        deleteArticulation: (articulationId) => this.runCommand(
            () => this.deleteArticulation(articulationId),
        ),
        setArticulationKey: (articulationId, wantKey) => this.runCommand(
            () => this.setArticulationKey(articulationId, wantKey),
        ),
        setArticulationRange: (articulationId, mode, bound, value) => this.runCommand(
            () => this.setArticulationRange(articulationId, mode, bound, value),
        ),
        setArticulationTriggerMode: (mode) => this.runCommand(
            () => this.setArticulationTriggerMode(mode),
        ),
        clearArticulationOverride: (targetId, articulationId) => this.runCommand(
            () => this.clearArticulationOverride(targetId, articulationId),
        ),
        clearArticulationBaseOverride: (targetId, articulationId) => this.runCommand(
            () => this.clearArticulationBaseOverride(targetId, articulationId),
        ),
        clearArticulationMappingAmount: (mappingId, articulationId) => this.runCommand(
            () => this.clearArticulationMappingAmount(mappingId, articulationId),
        ),
        restoreArticulationLayer: (articulationId, backup) => this.runCommand(
            () => this.restoreArticulationLayer(articulationId, backup),
        ),
        setEffectEnabled: (effectId, enabled) => this.runCommand(() => {
            const knownEffectId = requireEffectId(effectId);
            this.rackState = {
                ...this.rackState,
                enabled: { ...this.rackState.enabled, [knownEffectId]: enabled },
            };
            this.persistRackState();
            this.markSnapshotDirty();
        }),
        reorderEffect: (effectId, overEffectId) => this.runCommand(
            () => this.reorderEffect(effectId, overEffectId),
        ),
        restoreEffectOrder: (effectOrder) => this.runCommand(
            () => this.restoreEffectOrder(effectOrder),
        ),
        setCompoundSetting: (targetId, patch) => this.runCommand(
            () => this.setCompoundSetting(targetId, patch),
        ),
        setAuditionArticulation: (articulationId) => this.runCommand(() => {
            if (articulationId !== "Default") {
                this.requireArticulation(articulationId);
            }
            // TODO(COSIMO_ADAPTER_COMMAND_MAP): audition selector forcing is an
            // open engine path; retain the requested articulation locally only.
            this.audition = { ...this.audition, articulation: articulationId };
            this.markSnapshotDirty();
        }),
        setAuditionNote: (note) => this.runCommand(() => {
            midiNoteNumber(note);
            this.audition = { ...this.audition, note };
            this.markSnapshotDirty();
        }),
        setRepeatEnabled: (enabled) => this.runCommand(() => {
            this.audition = { ...this.audition, repeat: enabled };
            this.markSnapshotDirty();
        }),
        setLatchEnabled: (enabled) => this.runCommand(() => {
            this.audition = { ...this.audition, latch: enabled };
            this.markSnapshotDirty();
        }),
        beginTrigger: () => this.runCommand(() => this.beginTrigger()),
        endTrigger: () => this.runCommand(() => this.endTrigger()),
        cancelTrigger: () => this.runCommand(() => this.cancelTrigger()),
        captureMotion: () => this.runCommand(() => this.captureMotion()),
        reset: () => this.runCommand(() => this.reset()),
    };

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
        this.modulationBridge.unsubscribe(this.handleModulationState);
        releaseModulationRuntimeBridge(this.connection);
        this.listeners.clear();
    }

    private hydrate(storedState: unknown): void {
        if (this.disposed) {
            return;
        }

        const rawArticulations = readFullStoredStateValue(storedState, "articulations.v3");
        const rawParameterValues = readFullStoredStateValue(storedState, UI_PATCH_VALUES_STATE_KEY);
        const rawUiMappings = readFullStoredStateValue(storedState, UI_MAPPINGS_STATE_KEY);
        const rawRackState = readFullStoredStateValue(storedState, RACK_STATE_KEY);
        const rawModulationState = readFullStoredStateValue(storedState, MODULATION_STATE_KEY);

        const parsedArticulations = rawArticulations === undefined
            ? { _tag: "ok", value: createEmptyArticulationsState() } as const
            : parseStoredArticulations(rawArticulations);
        if (parsedArticulations._tag === "err") {
            this.detach(parsedArticulations.message);
            return;
        }

        const parsedParameterValues = rawParameterValues === undefined
            ? { _tag: "ok", value: createInitialParameterValues() } as const
            : parseUiPatchValues(rawParameterValues);
        if (parsedParameterValues._tag === "err") {
            this.detach(parsedParameterValues.message);
            return;
        }

        const parsedUiMappings: ParseOutcome<Map<MappingId, PendingUiMapping>> = rawUiMappings === undefined
            ? { _tag: "ok", value: new Map<MappingId, PendingUiMapping>() }
            : parseUiMappings(rawUiMappings);
        if (parsedUiMappings._tag === "err") {
            this.detach(parsedUiMappings.message);
            return;
        }

        const parsedRackState = rawRackState === undefined
            ? { _tag: "ok", value: createInitialRackState() } as const
            : parseRackState(rawRackState);
        if (parsedRackState._tag === "err") {
            this.detach(parsedRackState.message);
            return;
        }

        const validRoutes = this.collectValidRoutes(this.modulationBridge.getState());
        if (validRoutes.length + parsedUiMappings.value.size > ROUTE_BUDGET) {
            this.detach(`Stored mappings exceed the shared route budget of ${ROUTE_BUDGET}`);
            return;
        }

        this.runCommand(() => {
            this.articulations = parsedArticulations.value;
            this.parameterValues = parsedParameterValues.value;
            this.uiMappings = parsedUiMappings.value;
            this.rackState = parsedRackState.value;
            this.connectionState = { _tag: "ready" };
            this.visibleSourceIds.clear();
            for (const sourceId of INITIAL_VISIBLE_SOURCE_IDS) {
                this.visibleSourceIds.add(sourceId);
            }
            this.revealMappedSources(this.uiMappings.values());
            this.hydrationComplete = true;
            this.adoptValidRoutes(validRoutes);
            if (rawModulationState === undefined) {
                this.modulationBridge.replaceRoutes([]);
            }
            this.uploadAllBoundBaseValues();
            this.uploadAllArticulationImages();
            this.sendNativeTriggerConfig();
            this.markSnapshotDirty();
        });
    }

    private detach(reason: string): void {
        this.connectionState = { _tag: "detached", reason };
        this.markSnapshotDirty();
    }

    private runCommand<T>(command: () => T): T {
        this.commandDepth += 1;
        try {
            return command();
        } finally {
            this.commandDepth -= 1;
            if (this.commandDepth === 0) {
                this.flushSnapshot();
            }
        }
    }

    private markSnapshotDirty(): void {
        this.snapshotDirty = true;
        if (this.commandDepth === 0) {
            this.flushSnapshot();
        }
    }

    private flushSnapshot(): void {
        if (!this.snapshotDirty || this.disposed) {
            return;
        }
        this.snapshotDirty = false;
        this.snapshot = this.buildSnapshot();
        for (const listener of this.listeners) {
            listener();
        }
    }

    private buildSnapshot(): PatchSnapshot {
        const validRoutes = this.collectValidRoutes(this.modulationBridge.getState());
        const mappings = this.projectMappingsInCreationOrder(validRoutes);
        const articulationOverrides: Record<string, Readonly<Record<string, NormalizedValue>>> = {};
        const articulationMappingAmounts: Record<string, Readonly<Record<string, number>>> = {};

        for (const slot of this.articulations.slots) {
            const overrides: Record<string, NormalizedValue> = {};
            for (const descriptor of allTargetDescriptors()) {
                const parameterId = descriptor.articulationParameterId;
                if (parameterId === null || !Object.hasOwn(slot.overrides, parameterId)) {
                    continue;
                }
                const engineValue = slot.overrides[parameterId];
                if (engineValue === undefined || descriptor.binding._tag !== "endpoint") {
                    throw new Error(`Articulation parameter ${parameterId} has no endpoint conversion`);
                }
                overrides[descriptor.targetId] = descriptor.binding.fromEngine(engineValue);
            }

            const mappingAmounts: Record<string, number> = {};
            for (const validRoute of validRoutes) {
                if (!Object.hasOwn(slot.routeAmounts, validRoute.route.id)) {
                    continue;
                }
                const routeAmount = slot.routeAmounts[validRoute.route.id];
                if (routeAmount !== undefined) {
                    mappingAmounts[validRoute.route.id] = routeAmountToSpecAmount(
                        validRoute.descriptor.modAmount,
                        validRoute.route.targetKind,
                        routeAmount,
                    );
                }
            }
            for (const mapping of this.uiMappings.values()) {
                if (!Object.hasOwn(slot.routeAmounts, mapping.id)) {
                    continue;
                }
                const routeAmount = slot.routeAmounts[mapping.id];
                if (routeAmount !== undefined) {
                    const descriptor = getTargetDescriptor(mapping.targetId);
                    mappingAmounts[mapping.id] = clampSpecAmount(descriptor.modAmount, routeAmount);
                }
            }

            articulationOverrides[slot.id] = overrides;
            articulationMappingAmounts[slot.id] = mappingAmounts;
        }

        return {
            connection: this.connectionState,
            patch: {
                parameterValues: { ...this.parameterValues },
                mappings,
                sources: this.projectSources(),
                effectOrder: [...this.rackState.order],
                effectEnabled: { ...this.rackState.enabled },
                compoundSettings: { ...this.rackState.compound },
                articulations: this.articulations.slots.map((slot) => ({
                    id: articulationIdFromSlot(slot),
                    label: slot.name,
                    color: slot.color,
                    icon: "circle",
                    selector: slot.runtimeSlot,
                    key: slot.key,
                    velRange: { min: slot.velRange.min, max: slot.velRange.max },
                    chainRange: { min: slot.chainRange.min, max: slot.chainRange.max },
                })),
                articulationTriggerMode: this.articulations.activeTriggerMode,
                articulationOverrides,
                articulationMappingAmounts,
            },
            audition: {
                ...this.audition,
                captureCandidate: this.audition.captureCandidate === null
                    ? null
                    : { ...this.audition.captureCandidate },
            },
        };
    }

    private projectMappingsInCreationOrder(
        validRoutes: ReadonlyArray<ValidRoute>,
    ): ReadonlyArray<ModulationMapping> {
        const mappingsById = new Map<string, ModulationMapping>();
        for (const validRoute of validRoutes) {
            mappingsById.set(validRoute.route.id, this.projectMapping(validRoute));
        }
        for (const mapping of this.uiMappings.values()) {
            mappingsById.set(mapping.id, mapping);
        }

        const mappings: Array<ModulationMapping> = [];
        for (const mappingId of this.mappingCreationOrder) {
            const mapping = mappingsById.get(mappingId);
            if (mapping !== undefined) {
                mappings.push(mapping);
                mappingsById.delete(mappingId);
            }
        }
        for (const mapping of mappingsById.values()) {
            mappings.push(mapping);
        }
        return mappings;
    }

    private projectSources(): ReadonlyArray<ModulationSource> {
        const state = this.modulationBridge.getState();
        const sources: Array<ModulationSource> = [];
        for (const definition of SOURCE_DEFINITIONS) {
            if (definition.type !== "fixed" && !this.visibleSourceIds.has(definition.idRaw)) {
                continue;
            }
            const sourceId = sourceIdFromDefinition(definition);
            if (definition.type === "fixed") {
                sources.push({
                    id: sourceId,
                    type: "fixed",
                    slot: null,
                    label: definition.label,
                    state: { _tag: "fixed" },
                });
                continue;
            }

            const slotIndex = this.slotIndex(definition);
            if (definition.type === "macro") {
                sources.push({
                    id: sourceId,
                    type: "macro",
                    slot: definition.slot,
                    label: definition.label,
                    state: {
                        _tag: "macro",
                        value: this.macroValues[slotIndex] ?? clampNormalizedValue(0),
                        name: state.macroNames[slotIndex] ?? definition.label,
                    },
                });
                continue;
            }
            if (definition.type === "envelope") {
                sources.push({
                    id: sourceId,
                    type: "envelope",
                    slot: definition.slot,
                    label: definition.label,
                    state: {
                        _tag: "envelope",
                        envelope: state.envelopeSlots[slotIndex] ?? createDefaultEnvelope(slotIndex),
                    },
                });
                continue;
            }
            const msegSlot = state.msegSlots[slotIndex];
            if (msegSlot === undefined) {
                throw new Error(`Modulation state is missing MSEG slot ${slotIndex + 1}`);
            }
            sources.push({
                id: sourceId,
                type: "mseg",
                slot: definition.slot,
                label: definition.label,
                state: { _tag: "mseg", slot: msegSlot },
            });
        }
        return sources;
    }

    private collectValidRoutes(state: ModulationState): ReadonlyArray<ValidRoute> {
        const validRoutes: Array<ValidRoute> = [];
        for (let routeIndex = 0; routeIndex < state.routes.length; routeIndex += 1) {
            const route = state.routes[routeIndex];
            if (route === undefined) {
                continue;
            }
            const identity = splitMappingId(route.id);
            if (identity === null) {
                continue;
            }
            const parsedTarget = parseTargetId(identity.targetIdRaw);
            if (parsedTarget._tag === "err") {
                continue;
            }
            const definition = SOURCE_DEFINITION_BY_ID.get(identity.sourceIdRaw);
            if (definition === undefined
                || definition.sourceKind !== route.sourceKind
                || definition.sourceSlot !== route.sourceSlot) {
                continue;
            }
            const descriptor = getTargetDescriptor(parsedTarget.value);
            if (descriptor.modulationTargetKind === null
                || descriptor.modulationTargetKind !== route.targetKind) {
                continue;
            }
            const sourceId = sourceIdFromDefinition(definition);
            if (String(makeMappingId(parsedTarget.value, sourceId)) !== route.id) {
                continue;
            }
            validRoutes.push({
                route,
                routeIndex,
                targetId: parsedTarget.value,
                sourceId,
                descriptor,
            });
        }
        return validRoutes;
    }

    private projectMapping(validRoute: ValidRoute): ModulationMapping {
        return {
            id: mappingIdFromRoute(validRoute.route),
            targetId: validRoute.targetId,
            sourceId: validRoute.sourceId,
            amount: routeAmountToSpecAmount(
                validRoute.descriptor.modAmount,
                validRoute.route.targetKind,
                validRoute.route.amount,
            ),
            polarity: validRoute.route.polarity === "bipolar" ? "Bipolar" : "Unipolar",
            reducer: this.routeReducers.get(validRoute.route.id) ?? "Max",
            enabled: validRoute.route.enabled,
        };
    }

    private synchronizeMappingCreationOrder(validRoutes: ReadonlyArray<ValidRoute>): void {
        const activeMappingIds = new Set<string>([
            ...validRoutes.map((validRoute) => validRoute.route.id),
            ...this.uiMappings.keys(),
        ]);
        this.mappingCreationOrder = this.mappingCreationOrder.filter((mappingId) => activeMappingIds.has(mappingId));
        const orderedMappingIds = new Set(this.mappingCreationOrder);
        for (const validRoute of validRoutes) {
            if (!orderedMappingIds.has(validRoute.route.id)) {
                this.mappingCreationOrder.push(validRoute.route.id);
                orderedMappingIds.add(validRoute.route.id);
            }
        }
        for (const mappingId of this.uiMappings.keys()) {
            if (!orderedMappingIds.has(mappingId)) {
                this.mappingCreationOrder.push(mappingId);
                orderedMappingIds.add(mappingId);
            }
        }
    }

    private revealMappedSources(mappings: Iterable<PendingUiMapping>): void {
        for (const mapping of mappings) {
            const definition = SOURCE_DEFINITION_BY_ID.get(String(mapping.sourceId));
            if (definition !== undefined && definition.type !== "fixed") {
                this.visibleSourceIds.add(definition.idRaw);
            }
        }
    }

    private setParameter(input: Parameters<CosimoCommands["setParameter"]>[0]): void {
        const descriptor = getTargetDescriptor(input.targetId);
        if (input.layer._tag === "patchBase") {
            this.parameterValues = { ...this.parameterValues, [descriptor.targetId]: input.value };
            if (descriptor.binding._tag === "endpoint") {
                this.connection.sendEventOrValue?.(
                    descriptor.binding.endpointId,
                    descriptor.binding.toEngine(input.value),
                );
            }
            this.persistParameterValues();
            if (descriptor.articulationParameterId !== null) {
                this.uploadArticulationSelectors(affectedSelectors({
                    kind: "voiceParameter",
                    parameterId: descriptor.articulationParameterId,
                }, this.articulations));
            }
        } else {
            const slot = this.requireArticulation(input.layer.articulationId);
            const parameterId = descriptor.articulationParameterId;
            if (parameterId === null || descriptor.binding._tag !== "endpoint") {
                throw new Error(`Target ${descriptor.targetId} cannot be articulation-overridden`);
            }
            const nextSlot: ArticulationSlotV3 = {
                ...slot,
                overrides: {
                    ...slot.overrides,
                    [parameterId]: descriptor.binding.toEngine(input.value),
                },
            };
            this.replaceArticulationSlot(nextSlot);
            this.persistArticulations();
            this.uploadArticulationSelectors([slot.runtimeSlot]);
        }

        if (this.audition.triggerActive) {
            this.audition = {
                ...this.audition,
                captureCandidate: { targetId: descriptor.targetId, sourceId: null },
                status: `Recording · ${descriptor.label}`,
            };
        }
        this.markSnapshotDirty();
    }

    private addMapping(input: Parameters<CosimoCommands["addMapping"]>[0]): ReturnType<CosimoCommands["addMapping"]> {
        const descriptor = getTargetDescriptor(input.targetId);
        const targetKind = descriptor.modulationTargetKind;
        const source = this.requireSource(input.sourceId);
        const routes = this.collectValidRoutes(this.modulationBridge.getState());
        if (routes.length + this.uiMappings.size >= ROUTE_BUDGET) {
            return err(new RouteBudgetExceeded(ROUTE_BUDGET));
        }
        const sourceId = sourceIdFromDefinition(source);
        const mappingId = makeMappingId(descriptor.targetId, sourceId);
        if (routes.some((validRoute) => validRoute.route.id === mappingId)
            || this.uiMappings.has(mappingId)) {
            return err(new MappingAlreadyExists(mappingId));
        }

        const amount = input.amount ?? defaultSpecAmount(descriptor.modAmount);
        if (targetKind === null) {
            const mapping: PendingUiMapping = {
                id: mappingId,
                targetId: descriptor.targetId,
                sourceId,
                amount: clampSpecAmount(descriptor.modAmount, amount),
                polarity: input.polarity ?? "Unipolar",
                reducer: input.reducer ?? "Max",
                enabled: true,
            };
            this.uiMappings.set(mappingId, mapping);
            this.mappingCreationOrder.push(mappingId);
            this.persistUiMappings();
            this.markSnapshotDirty();
            return ok(mappingId);
        }

        const route: ModulationRoute = {
            id: mappingId,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: input.polarity === "Bipolar" ? "bipolar" : "unipolar",
            targetKind,
            amount: specAmountToRouteAmount(descriptor.modAmount, targetKind, amount),
        };
        this.routeReducers.set(mappingId, input.reducer ?? "Max");
        this.modulationBridge.addRoute(route);
        this.uploadArticulationSelectors(affectedSelectors({ kind: "routeOrder" }, this.articulations));
        return ok(mappingId);
    }

    private removeMapping(mappingId: MappingId): void {
        const mapping = this.requireMapping(mappingId);
        if (mapping._tag === "engine") {
            this.modulationBridge.removeRoute(mapping.validRoute.routeIndex);
            this.routeReducers.delete(mappingId);
        } else {
            this.uiMappings.delete(mappingId);
            this.mappingCreationOrder = this.mappingCreationOrder.filter((candidate) => candidate !== mappingId);
            this.persistUiMappings();
        }
        this.articulations = {
            ...this.articulations,
            slots: this.articulations.slots.map((slot) => ({
                ...slot,
                routeAmounts: Object.fromEntries(
                    Object.entries(slot.routeAmounts).filter(([routeId]) => routeId !== mappingId),
                ),
            })),
        };
        this.persistArticulations();
        if (mapping._tag === "engine") {
            this.uploadArticulationSelectors(affectedSelectors({ kind: "routeOrder" }, this.articulations));
        }
        this.markSnapshotDirty();
    }

    private setMappingAmount(
        mappingId: MappingId,
        amount: number,
        layer: Parameters<CosimoCommands["setMappingAmount"]>[2],
    ): void {
        const mapping = this.requireMapping(mappingId);
        const routeAmount = mapping._tag === "engine"
            ? specAmountToRouteAmount(
                mapping.validRoute.descriptor.modAmount,
                mapping.validRoute.route.targetKind,
                amount,
            )
            : clampSpecAmount(mapping.descriptor.modAmount, amount);
        if (layer._tag === "patchBase") {
            if (mapping._tag === "engine") {
                this.modulationBridge.setRoute(mapping.validRoute.routeIndex, {
                    ...mapping.validRoute.route,
                    amount: routeAmount,
                });
                this.uploadArticulationSelectors(affectedSelectors({
                    kind: "routeAmount",
                    routeId: mapping.validRoute.route.id,
                }, this.articulations));
            } else {
                this.replaceUiMapping({ ...mapping.mapping, amount: routeAmount });
            }
            return;
        }

        const slot = this.requireArticulation(layer.articulationId);
        this.replaceArticulationSlot({
            ...slot,
            routeAmounts: { ...slot.routeAmounts, [mappingId]: routeAmount },
        });
        this.persistArticulations();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
    }

    private setMappingEnabled(mappingId: MappingId, enabled: boolean): void {
        const mapping = this.requireMapping(mappingId);
        if (mapping._tag === "engine") {
            this.modulationBridge.setRoute(mapping.validRoute.routeIndex, {
                ...mapping.validRoute.route,
                enabled,
            });
            return;
        }
        this.replaceUiMapping({ ...mapping.mapping, enabled });
    }

    private setMappingPolarity(
        mappingId: MappingId,
        polarity: ModulationMapping["polarity"],
    ): void {
        const mapping = this.requireMapping(mappingId);
        if (mapping._tag === "engine") {
            this.modulationBridge.setRoute(mapping.validRoute.routeIndex, {
                ...mapping.validRoute.route,
                polarity: polarity === "Bipolar" ? "bipolar" : "unipolar",
            });
            return;
        }
        this.replaceUiMapping({ ...mapping.mapping, polarity });
    }

    private setMappingReducer(mappingId: MappingId, reducer: MappingReducer): void {
        const mapping = this.requireMapping(mappingId);
        if (mapping._tag === "engine") {
            this.routeReducers.set(mappingId, reducer);
            this.markSnapshotDirty();
            return;
        }
        this.replaceUiMapping({ ...mapping.mapping, reducer });
    }

    private replaceUiMapping(mapping: PendingUiMapping): void {
        this.uiMappings.set(mapping.id, mapping);
        this.persistUiMappings();
        this.markSnapshotDirty();
    }

    private createSource(type: Exclude<SourceType, "fixed">): ReturnType<CosimoCommands["createSource"]> {
        const definitions = SOURCE_DEFINITIONS.filter((definition) => definition.type === type);
        const definition = definitions.find((candidate) => !this.visibleSourceIds.has(candidate.idRaw));
        if (definition === undefined) {
            return err(new SourceSlotsExhausted(type, definitions.length));
        }
        this.visibleSourceIds.add(definition.idRaw);
        this.resetSourceSlot(definition);
        this.deletedSourceBackup = null;
        this.markSnapshotDirty();
        return ok(sourceIdFromDefinition(definition));
    }

    private deleteSource(sourceId: SourceId): void {
        const definition = SOURCE_DEFINITION_BY_ID.get(String(sourceId));
        if (definition === undefined) {
            throw new Error(`Unknown source id: ${sourceId}`);
        }
        if (definition.type === "fixed") {
            return;
        }
        this.requireSource(sourceId);

        const state = this.modulationBridge.getState();
        const removedRoutes = state.routes.filter((route) => {
            const validRoute = this.collectValidRoutes({ ...state, routes: [route] })[0];
            return validRoute?.sourceId === sourceId;
        });
        const removedUiMappings = [...this.uiMappings.values()]
            .filter((mapping) => mapping.sourceId === sourceId);
        const removedMappingIds = new Set([
            ...removedRoutes.map((route) => route.id),
            ...removedUiMappings.map((mapping) => String(mapping.id)),
        ]);
        const articulationRouteAmounts: Record<string, Readonly<Record<string, number>>> = {};
        for (const slot of this.articulations.slots) {
            articulationRouteAmounts[slot.id] = Object.fromEntries(
                Object.entries(slot.routeAmounts).filter(([routeId]) => removedMappingIds.has(routeId)),
            );
        }
        this.deletedSourceBackup = {
            definition,
            modulationState: state,
            macroValue: definition.type === "macro"
                ? this.macroValues[this.slotIndex(definition)] ?? clampNormalizedValue(0)
                : null,
            routes: removedRoutes,
            uiMappings: removedUiMappings,
            mappingCreationOrder: [...this.mappingCreationOrder],
            articulationRouteAmounts,
        };

        this.visibleSourceIds.delete(definition.idRaw);
        for (const mapping of removedUiMappings) {
            this.uiMappings.delete(mapping.id);
        }
        this.mappingCreationOrder = this.mappingCreationOrder
            .filter((mappingId) => !removedMappingIds.has(mappingId));
        if (removedUiMappings.length > 0) {
            this.persistUiMappings();
        }
        this.modulationBridge.replaceRoutes(state.routes.filter((route) => !removedMappingIds.has(route.id)));
        this.articulations = {
            ...this.articulations,
            slots: this.articulations.slots.map((slot) => ({
                ...slot,
                routeAmounts: Object.fromEntries(
                    Object.entries(slot.routeAmounts).filter(([routeId]) => !removedMappingIds.has(routeId)),
                ),
            })),
        };
        this.resetSourceSlot(definition);
        this.persistArticulations();
        if (removedRoutes.length > 0) {
            this.uploadArticulationSelectors(affectedSelectors({ kind: "routeOrder" }, this.articulations));
        }
        this.markSnapshotDirty();
    }

    private undoDeleteSource(): void {
        const backup = this.deletedSourceBackup;
        if (backup === null) {
            return;
        }
        if (this.visibleSourceIds.has(backup.definition.idRaw)) {
            this.deletedSourceBackup = null;
            return;
        }

        this.visibleSourceIds.add(backup.definition.idRaw);
        const slotIndex = this.slotIndex(backup.definition);
        if (backup.definition.type === "macro") {
            if (backup.macroValue !== null) {
                this.macroValues[slotIndex] = backup.macroValue;
                this.connection.sendEventOrValue?.(`macro${slotIndex + 1}`, backup.macroValue);
            }
            this.modulationBridge.setState({
                ...this.modulationBridge.getState(),
                macroNames: [...backup.modulationState.macroNames],
            });
        } else if (backup.definition.type === "envelope") {
            this.modulationBridge.setEnvelope(
                slotIndex,
                backup.modulationState.envelopeSlots[slotIndex] ?? createDefaultEnvelope(slotIndex),
            );
        } else {
            const slot = backup.modulationState.msegSlots[slotIndex];
            if (slot === undefined) {
                throw new Error(`Deleted source backup is missing MSEG slot ${slotIndex + 1}`);
            }
            this.modulationBridge.setMsegSlotShape(slotIndex, 0, slot.shapeA);
            this.modulationBridge.setMsegSlotShape(slotIndex, 1, slot.shapeB);
            this.modulationBridge.setMsegSlotMorph(slotIndex, slot.morph);
            this.modulationBridge.setMsegSlotPlayback(slotIndex, slot.playback);
        }

        const currentRoutes = this.modulationBridge.getState().routes;
        const currentIds = new Set([
            ...currentRoutes.map((route) => route.id),
            ...this.uiMappings.keys(),
        ]);
        const backedUpRoutes = new Map(backup.routes.map((route) => [route.id, route]));
        const backedUpUiMappings = new Map(backup.uiMappings.map((mapping) => [String(mapping.id), mapping]));
        const availableMappingSlots = Math.max(0, ROUTE_BUDGET - currentIds.size);
        const restoredMappingIds: Array<string> = [];
        for (const mappingId of backup.mappingCreationOrder) {
            if (restoredMappingIds.length >= availableMappingSlots || currentIds.has(mappingId)) {
                continue;
            }
            if (backedUpRoutes.has(mappingId) || backedUpUiMappings.has(mappingId)) {
                restoredMappingIds.push(mappingId);
                currentIds.add(mappingId);
            }
        }
        const restoredMappingIdSet = new Set(restoredMappingIds);
        const restoredRoutes = backup.routes.filter((route) => restoredMappingIdSet.has(route.id));
        const restoredUiMappings = backup.uiMappings.filter((mapping) => restoredMappingIdSet.has(mapping.id));
        for (const mapping of restoredUiMappings) {
            this.uiMappings.set(mapping.id, mapping);
        }
        const originalMappingIds = new Set(backup.mappingCreationOrder);
        this.mappingCreationOrder = [
            ...backup.mappingCreationOrder.filter((mappingId) => currentIds.has(mappingId)),
            ...this.mappingCreationOrder.filter((mappingId) => !originalMappingIds.has(mappingId)),
        ];
        if (restoredUiMappings.length > 0) {
            this.persistUiMappings();
        }
        this.modulationBridge.replaceRoutes([...currentRoutes, ...restoredRoutes]);
        this.articulations = {
            ...this.articulations,
            slots: this.articulations.slots.map((slot) => ({
                ...slot,
                routeAmounts: {
                    ...slot.routeAmounts,
                    ...Object.fromEntries(
                        Object.entries(backup.articulationRouteAmounts[slot.id] ?? {})
                            .filter(([mappingId]) => restoredMappingIdSet.has(mappingId)),
                    ),
                },
            })),
        };
        this.deletedSourceBackup = null;
        this.persistArticulations();
        if (restoredRoutes.length > 0) {
            this.uploadArticulationSelectors(affectedSelectors({ kind: "routeOrder" }, this.articulations));
        }
        this.markSnapshotDirty();
    }

    private setMacroValue(sourceId: SourceId, value: NormalizedValue): void {
        const definition = this.requireSource(sourceId, "macro");
        const slotIndex = this.slotIndex(definition);
        this.macroValues[slotIndex] = value;
        this.connection.sendEventOrValue?.(`macro${slotIndex + 1}`, value);
        this.markSnapshotDirty();
    }

    private renameMacro(sourceId: SourceId, name: string): void {
        const definition = this.requireSource(sourceId, "macro");
        const slotIndex = this.slotIndex(definition);
        const state = this.modulationBridge.getState();
        const macroNames = [...state.macroNames];
        macroNames[slotIndex] = name.trim().length === 0 ? definition.label : name.trim();
        this.modulationBridge.setState({ ...state, macroNames });
    }

    private setEnvelope(sourceId: SourceId, envelope: ModulationEnvelope): void {
        const definition = this.requireSource(sourceId, "envelope");
        this.modulationBridge.setEnvelope(this.slotIndex(definition), envelope);
    }

    private setMsegMorph(input: Parameters<CosimoCommands["setMsegMorph"]>[0]): void {
        const definition = this.requireSource(input.sourceId, "mseg");
        if (input.layer._tag === "articulationOverride") {
            throw new Error("deferred: per-articulation MSEG morph overrides");
        }
        const slotIndex = this.slotIndex(definition);
        this.modulationBridge.setMsegSlotMorph(slotIndex, input.morph);
        this.connection.sendEventOrValue?.(`mseg${slotIndex + 1}Morph`, input.morph);
        const morphParameterIds = ["msegMorph1", "msegMorph2", "msegMorph3"] as const;
        const morphParameterId = morphParameterIds[slotIndex];
        if (morphParameterId === undefined) {
            throw new Error(`MSEG slot ${slotIndex + 1} has no articulation morph field`);
        }
        this.uploadArticulationSelectors(affectedSelectors({
            kind: "voiceParameter",
            parameterId: morphParameterId,
        }, this.articulations));
    }

    private addArticulation(): ReturnType<CosimoCommands["addArticulation"]> {
        const runtimeSlot = lowestFreeRuntimeSlot(this.articulations);
        if (runtimeSlot === null) {
            return err(new ArticulationSlotsExhausted(ARTICULATION_MAX_SLOTS));
        }
        const usedIds = new Set(this.articulations.slots.map((slot) => slot.id));
        const id = this.uniqueArticulationId(`articulation-${runtimeSlot}`, usedIds);
        const slot: ArticulationSlotV3 = {
            id,
            runtimeSlot,
            name: createDefaultArticulationName(runtimeSlot),
            color: ARTICULATION_COLORS[runtimeSlot % ARTICULATION_COLORS.length] ?? ARTICULATION_COLORS[0],
            key: this.freeArticulationKey(30),
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: {},
        };
        this.articulations = {
            ...this.articulations,
            selectedSlotId: slot.id,
            slots: [...this.articulations.slots, slot],
        };
        this.persistArticulationsAndTriggerConfig();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
        return ok(articulationIdFromSlot(slot));
    }

    private duplicateArticulation(
        articulationId: ArticulationId,
    ): ReturnType<CosimoCommands["duplicateArticulation"]> {
        const source = this.requireArticulation(articulationId);
        const runtimeSlot = lowestFreeRuntimeSlot(this.articulations);
        if (runtimeSlot === null) {
            return err(new ArticulationSlotsExhausted(ARTICULATION_MAX_SLOTS));
        }
        const usedIds = new Set(this.articulations.slots.map((slot) => slot.id));
        const id = this.uniqueArticulationId(`${source.id}-copy`, usedIds);
        const slot: ArticulationSlotV3 = {
            ...source,
            id,
            runtimeSlot,
            name: this.uniqueArticulationName(source.name),
            key: this.freeArticulationKey(source.key + 1),
            velRange: { ...source.velRange },
            chainRange: { ...source.chainRange },
            overrides: { ...source.overrides },
            routeAmounts: { ...source.routeAmounts },
        };
        this.articulations = {
            ...this.articulations,
            selectedSlotId: slot.id,
            slots: [...this.articulations.slots, slot],
        };
        this.persistArticulationsAndTriggerConfig();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
        return ok(articulationIdFromSlot(slot));
    }

    private deleteArticulation(articulationId: ArticulationId): void {
        const slot = this.requireArticulation(articulationId);
        const disabledImage: ArticulationSnapshotRuntimeUpload = {
            ...resolveArticulationImage(this.makePatchVoiceBase(), slot),
            enabled: false,
        };
        this.articulations = {
            ...this.articulations,
            selectedSlotId: this.articulations.selectedSlotId === slot.id ? null : this.articulations.selectedSlotId,
            slots: this.articulations.slots.filter((candidate) => candidate.id !== slot.id),
        };
        if (this.audition.articulation === articulationId) {
            this.audition = { ...this.audition, articulation: "Default" };
        }
        this.persistArticulationsAndTriggerConfig();
        this.connection.sendEventOrValue?.(ARTICULATION_SNAPSHOT_ENDPOINT_ID, disabledImage);
        this.markSnapshotDirty();
    }

    private setArticulationKey(articulationId: ArticulationId, wantKey: number) {
        const current = this.requireArticulation(articulationId);
        const target = clampMidiValue(wantKey);
        const others = this.articulations.slots.filter((slot) => slot.id !== current.id);
        const direction = target > current.key ? 1 : -1;
        let key = current.key;
        while (key !== target) {
            const step = key + direction;
            if (step < 0 || step > 127 || others.some((other) => other.key === step)) {
                break;
            }
            key = step;
        }
        const neighbor = others.find((other) => Math.abs(other.key - key) === 1);
        this.replaceArticulationSlot({ ...current, key });
        this.persistArticulationsAndTriggerConfig();
        this.markSnapshotDirty();
        return {
            key,
            touching: neighbor !== undefined,
            neighborId: neighbor === undefined ? null : articulationIdFromSlot(neighbor),
        };
    }

    private setArticulationRange(
        articulationId: ArticulationId,
        mode: Exclude<ArticulationTriggerMode, "key">,
        bound: "min" | "max",
        wantValue: number,
    ): RangeClampOutcome {
        const current = this.requireArticulation(articulationId);
        const range = mode === "vel" ? current.velRange : current.chainRange;
        const others = this.articulations.slots.filter((slot) => slot.id !== current.id);
        let value = clampMidiValue(wantValue);
        let neighbor: ArticulationSlotV3 | undefined;

        if (bound === "min") {
            const below = others.filter((slot) => (mode === "vel" ? slot.velRange.max : slot.chainRange.max) < range.max);
            const floor = Math.max(-1, ...below.map((slot) => mode === "vel" ? slot.velRange.max : slot.chainRange.max));
            value = Math.min(Math.max(value, floor + 1), range.max);
            neighbor = floor < 0 || value !== floor + 1
                ? undefined
                : below.find((slot) => (mode === "vel" ? slot.velRange.max : slot.chainRange.max) === floor);
        } else {
            const above = others.filter((slot) => (mode === "vel" ? slot.velRange.min : slot.chainRange.min) > range.min);
            const ceiling = Math.min(128, ...above.map((slot) => mode === "vel" ? slot.velRange.min : slot.chainRange.min));
            value = Math.max(Math.min(value, ceiling - 1), range.min);
            neighbor = ceiling > 127 || value !== ceiling - 1
                ? undefined
                : above.find((slot) => (mode === "vel" ? slot.velRange.min : slot.chainRange.min) === ceiling);
        }

        const nextRange = bound === "min"
            ? { min: value, max: range.max }
            : { min: range.min, max: value };
        this.replaceArticulationSlot(mode === "vel"
            ? { ...current, velRange: nextRange }
            : { ...current, chainRange: nextRange });
        this.persistArticulationsAndTriggerConfig();
        this.markSnapshotDirty();
        return {
            value,
            touching: neighbor !== undefined,
            neighborId: neighbor === undefined ? null : articulationIdFromSlot(neighbor),
        };
    }

    private setArticulationTriggerMode(mode: ArticulationTriggerMode): void {
        this.articulations = { ...this.articulations, activeTriggerMode: mode };
        this.persistArticulationsAndTriggerConfig();
        this.markSnapshotDirty();
    }

    private clearArticulationOverride(targetId: TargetId, articulationId: ArticulationId): void {
        const descriptor = getTargetDescriptor(targetId);
        const slot = this.requireArticulation(articulationId);
        const parameterId = descriptor.articulationParameterId;
        const targetRouteIds = new Set(
            [
                ...this.collectValidRoutes(this.modulationBridge.getState())
                    .filter((validRoute) => validRoute.targetId === targetId)
                    .map((validRoute) => validRoute.route.id),
                ...[...this.uiMappings.values()]
                    .filter((mapping) => mapping.targetId === targetId)
                    .map((mapping) => String(mapping.id)),
            ],
        );
        if (parameterId === null && targetRouteIds.size === 0) {
            throw new Error(`Target ${targetId} cannot be articulation-overridden`);
        }
        this.replaceArticulationSlot({
            ...slot,
            overrides: parameterId === null
                ? slot.overrides
                : Object.fromEntries(
                    Object.entries(slot.overrides).filter(([key]) => key !== parameterId),
                ),
            routeAmounts: Object.fromEntries(
                Object.entries(slot.routeAmounts).filter(([routeId]) => !targetRouteIds.has(routeId)),
            ),
        });
        this.persistArticulations();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
    }

    private clearArticulationBaseOverride(targetId: TargetId, articulationId: ArticulationId): void {
        const descriptor = getTargetDescriptor(targetId);
        const slot = this.requireArticulation(articulationId);
        const parameterId = descriptor.articulationParameterId;
        if (parameterId === null) {
            throw new Error(`Target ${targetId} cannot be articulation-overridden`);
        }
        this.replaceArticulationSlot({
            ...slot,
            overrides: Object.fromEntries(
                Object.entries(slot.overrides).filter(([key]) => key !== parameterId),
            ),
        });
        this.persistArticulations();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
    }

    private clearArticulationMappingAmount(mappingId: MappingId, articulationId: ArticulationId): void {
        this.requireMapping(mappingId);
        const slot = this.requireArticulation(articulationId);
        this.replaceArticulationSlot({
            ...slot,
            routeAmounts: Object.fromEntries(
                Object.entries(slot.routeAmounts).filter(([routeId]) => routeId !== mappingId),
            ),
        });
        this.persistArticulations();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
    }

    private restoreArticulationLayer(
        articulationId: ArticulationId,
        backup: Parameters<CosimoCommands["restoreArticulationLayer"]>[1],
    ): void {
        const slot = this.requireArticulation(articulationId);
        const overrides: Partial<Record<ArticulationVoiceParameterId, number>> = {};
        for (const [targetIdRaw, normalizedValue] of Object.entries(backup.overrides)) {
            const parsedTarget = parseTargetId(targetIdRaw);
            if (parsedTarget._tag === "err") {
                throw new Error(`Unknown target id in articulation backup: ${targetIdRaw}`);
            }
            const descriptor = getTargetDescriptor(parsedTarget.value);
            if (descriptor.articulationParameterId === null || descriptor.binding._tag !== "endpoint") {
                throw new Error(`Target ${targetIdRaw} cannot be articulation-overridden`);
            }
            overrides[descriptor.articulationParameterId] = descriptor.binding.toEngine(normalizedValue);
        }
        const routeAmounts: Record<string, number> = {};
        for (const [mappingIdRaw, amount] of Object.entries(backup.mappingAmounts)) {
            const mapping = this.requireMapping(mappingIdRaw);
            if (mapping._tag === "engine") {
                routeAmounts[mapping.validRoute.route.id] = specAmountToRouteAmount(
                    mapping.validRoute.descriptor.modAmount,
                    mapping.validRoute.route.targetKind,
                    amount,
                );
            } else {
                routeAmounts[mapping.mapping.id] = clampSpecAmount(mapping.descriptor.modAmount, amount);
            }
        }
        this.replaceArticulationSlot({ ...slot, overrides, routeAmounts });
        this.persistArticulations();
        this.uploadArticulationSelectors([slot.runtimeSlot]);
        this.markSnapshotDirty();
    }

    private reorderEffect(effectId: EffectModuleId, overEffectId: EffectModuleId): void {
        const knownEffectId = requireEffectId(effectId);
        const knownOverEffectId = requireEffectId(overEffectId);
        const withoutMoved = this.rackState.order.filter((candidate) => candidate !== knownEffectId);
        const overIndex = withoutMoved.indexOf(knownOverEffectId);
        if (overIndex < 0) {
            throw new Error(`Rack is missing effect ${knownOverEffectId}`);
        }
        const order = [...withoutMoved];
        order.splice(overIndex, 0, knownEffectId);
        this.rackState = { ...this.rackState, order };
        this.persistRackState();
        this.markSnapshotDirty();
    }

    private restoreEffectOrder(effectOrder: ReadonlyArray<EffectModuleId>): void {
        if (effectOrder.length !== EFFECT_ORDER.length) {
            throw new Error("Effect order must contain every rack effect");
        }
        const order = effectOrder.map((effectId) => requireEffectId(effectId));
        if (new Set(order).size !== EFFECT_ORDER.length) {
            throw new Error("Effect order contains duplicate effects");
        }
        this.rackState = { ...this.rackState, order };
        this.persistRackState();
        this.markSnapshotDirty();
    }

    private setCompoundSetting(
        targetId: TargetId,
        patch: Parameters<CosimoCommands["setCompoundSetting"]>[1],
    ): void {
        const descriptor = getTargetDescriptor(targetId);
        if (descriptor.compound !== "sync") {
            throw new Error(`Target ${targetId} is not a compound setting`);
        }
        const previous = this.rackState.compound[targetId] ?? { mode: "Free", division: "1/8" };
        const next: CompoundSetting = {
            mode: patch.mode ?? previous.mode,
            division: patch.division ?? previous.division,
        };
        this.rackState = {
            ...this.rackState,
            compound: { ...this.rackState.compound, [targetId]: next },
        };
        this.persistRackState();
        this.markSnapshotDirty();
    }

    private beginTrigger(): void {
        if (this.activeMidiNote !== null) {
            this.connection.sendMIDIInputEvent?.("midiIn", noteOffCode(this.activeMidiNote));
        }
        const noteNumber = midiNoteNumber(this.audition.note);
        this.activeMidiNote = noteNumber;
        this.connection.sendMIDIInputEvent?.("midiIn", noteOnCode(noteNumber));
        this.audition = {
            ...this.audition,
            triggerActive: true,
            captureCandidate: null,
            status: `${this.audition.note} held · move parameter`,
        };
        this.markSnapshotDirty();
    }

    private endTrigger(): void {
        const noteNumber = this.activeMidiNote ?? midiNoteNumber(this.audition.note);
        this.connection.sendMIDIInputEvent?.("midiIn", noteOffCode(noteNumber));
        this.activeMidiNote = null;
        this.audition = {
            ...this.audition,
            triggerActive: false,
            status: this.audition.captureCandidate === null ? "Waiting for note" : "Ready to capture",
        };
        this.markSnapshotDirty();
    }

    private cancelTrigger(): void {
        const noteNumber = this.activeMidiNote ?? midiNoteNumber(this.audition.note);
        this.connection.sendMIDIInputEvent?.("midiIn", noteOffCode(noteNumber));
        this.activeMidiNote = null;
        this.audition = {
            ...this.audition,
            triggerActive: false,
            status: this.audition.captureCandidate === null ? "Waiting for note" : "Ready to capture",
        };
        this.markSnapshotDirty();
    }

    private captureMotion(): SourceId | null {
        const candidate = this.audition.captureCandidate;
        if (candidate === null) {
            return null;
        }
        const descriptor = getTargetDescriptor(candidate.targetId);
        const msegDefinitions = SOURCE_DEFINITIONS.filter((definition) => definition.type === "mseg");
        const definition = msegDefinitions.find((entry) => !this.visibleSourceIds.has(entry.idRaw));
        if (definition === undefined
            || this.collectValidRoutes(this.modulationBridge.getState()).length + this.uiMappings.size >= ROUTE_BUDGET) {
            return null;
        }
        this.visibleSourceIds.add(definition.idRaw);
        this.resetSourceSlot(definition);
        const sourceId = sourceIdFromDefinition(definition);
        // Reuse the one mapping-creation path: engine route or pending
        // uiMapping is addMapping's decision. Capture commits at FULL spec
        // amount — the captured motion IS the modulation (mock parity).
        const added = this.addMapping({
            targetId: descriptor.targetId,
            sourceId,
            amount: descriptor.modAmount.max,
        });
        if (added._tag === "err") {
            throw added.error;
        }
        this.audition = {
            ...this.audition,
            triggerActive: false,
            captureCandidate: null,
            status: `Captured · ${descriptor.label} · ${definition.label}`,
        };
        this.markSnapshotDirty();
        return sourceId;
    }

    private reset(): void {
        this.parameterValues = createInitialParameterValues();
        this.articulations = createEmptyArticulationsState();
        this.rackState = createInitialRackState();
        this.connectionState = { _tag: "ready" };
        this.audition = {
            articulation: "Default",
            note: "C3",
            repeat: false,
            latch: false,
            triggerActive: false,
            captureCandidate: null,
            status: "Waiting for note",
        };
        this.activeMidiNote = null;
        this.visibleSourceIds.clear();
        for (const sourceId of INITIAL_VISIBLE_SOURCE_IDS) {
            this.visibleSourceIds.add(sourceId);
        }
        for (let index = 0; index < this.macroValues.length; index += 1) {
            this.macroValues[index] = clampNormalizedValue(0);
            this.connection.sendEventOrValue?.(`macro${index + 1}`, 0);
        }
        this.routeReducers.clear();
        this.uiMappings.clear();
        this.mappingCreationOrder = [];
        this.deletedSourceBackup = null;
        const modulationState = createDefaultModulationState();
        this.modulationBridge.setState({ ...modulationState, routes: [] });
        this.persistParameterValues();
        this.persistUiMappings();
        this.persistRackState();
        this.persistArticulationsAndTriggerConfig();
        this.uploadAllBoundBaseValues();
        this.uploadAllArticulationImages();
        this.markSnapshotDirty();
    }

    private requireSource(sourceId: SourceId, expectedType?: SourceType): SourceDefinition {
        const definition = SOURCE_DEFINITION_BY_ID.get(String(sourceId));
        if (definition === undefined
            || (definition.type !== "fixed" && !this.visibleSourceIds.has(definition.idRaw))) {
            throw new Error(`Unknown source id: ${sourceId}`);
        }
        if (expectedType !== undefined && definition.type !== expectedType) {
            throw new Error(`Source ${sourceId} is not ${expectedType}`);
        }
        return definition;
    }

    private requireMapping(mappingId: MappingId | string): MappingReference {
        const validRoute = this.collectValidRoutes(this.modulationBridge.getState())
            .find((candidate) => candidate.route.id === mappingId);
        if (validRoute !== undefined) {
            return { _tag: "engine", validRoute };
        }
        const uiMapping = [...this.uiMappings.values()]
            .find((candidate) => candidate.id === mappingId);
        if (uiMapping !== undefined) {
            return {
                _tag: "ui",
                mapping: uiMapping,
                descriptor: getTargetDescriptor(uiMapping.targetId),
            };
        }
        throw new Error(`Unknown mapping id: ${mappingId}`);
    }

    private requireArticulation(articulationId: ArticulationId): ArticulationSlotV3 {
        const slot = this.articulations.slots.find((candidate) => candidate.id === articulationId);
        if (slot === undefined) {
            throw new Error(`Unknown articulation id: ${articulationId}`);
        }
        return slot;
    }

    private replaceArticulationSlot(nextSlot: ArticulationSlotV3): void {
        this.articulations = {
            ...this.articulations,
            slots: this.articulations.slots.map((slot) => slot.id === nextSlot.id ? nextSlot : slot),
        };
    }

    private slotIndex(definition: SourceDefinition): number {
        if (definition.slot === null) {
            throw new Error(`Fixed source ${definition.idRaw} has no slot index`);
        }
        return definition.slot - 1;
    }

    private resetSourceSlot(definition: SourceDefinition): void {
        if (definition.type === "fixed") {
            return;
        }
        const slotIndex = this.slotIndex(definition);
        if (definition.type === "macro") {
            this.macroValues[slotIndex] = clampNormalizedValue(0);
            return;
        }
        if (definition.type === "envelope") {
            this.modulationBridge.setEnvelope(slotIndex, createDefaultEnvelope(slotIndex));
            return;
        }
        const label = `MSEG ${slotIndex + 1}`;
        const shape = createDefaultMsegShape(label);
        this.modulationBridge.setMsegSlotShape(slotIndex, 0, shape);
        this.modulationBridge.setMsegSlotShape(slotIndex, 1, shape);
        this.modulationBridge.setMsegSlotMorph(slotIndex, 0);
        this.modulationBridge.setMsegSlotPlayback(slotIndex, createDefaultMsegPlayback());
    }

    private makePatchVoiceBase(): PatchVoiceBase {
        const modulationState = this.modulationBridge.getState();
        const parameters: Record<ArticulationVoiceParameterId, number> = {
            framePosition: 0,
            pan: 0,
            warpMode: 0,
            warpAmount: 0,
            filterMode: 0,
            filterCutoffHz: 1000,
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
            msegMorph1: modulationState.msegSlots[0]?.morph ?? 0,
            msegMorph2: modulationState.msegSlots[1]?.morph ?? 0,
            msegMorph3: modulationState.msegSlots[2]?.morph ?? 0,
            "env1.attackSeconds": modulationState.envelopeSlots[0]?.attackSeconds ?? createDefaultEnvelope(0).attackSeconds,
            "env1.decaySeconds": modulationState.envelopeSlots[0]?.decaySeconds ?? createDefaultEnvelope(0).decaySeconds,
            "env1.sustain": modulationState.envelopeSlots[0]?.sustain ?? createDefaultEnvelope(0).sustain,
            "env1.releaseSeconds": modulationState.envelopeSlots[0]?.releaseSeconds ?? createDefaultEnvelope(0).releaseSeconds,
            "env2.attackSeconds": modulationState.envelopeSlots[1]?.attackSeconds ?? createDefaultEnvelope(1).attackSeconds,
            "env2.decaySeconds": modulationState.envelopeSlots[1]?.decaySeconds ?? createDefaultEnvelope(1).decaySeconds,
            "env2.sustain": modulationState.envelopeSlots[1]?.sustain ?? createDefaultEnvelope(1).sustain,
            "env2.releaseSeconds": modulationState.envelopeSlots[1]?.releaseSeconds ?? createDefaultEnvelope(1).releaseSeconds,
            "env3.attackSeconds": modulationState.envelopeSlots[2]?.attackSeconds ?? createDefaultEnvelope(2).attackSeconds,
            "env3.decaySeconds": modulationState.envelopeSlots[2]?.decaySeconds ?? createDefaultEnvelope(2).decaySeconds,
            "env3.sustain": modulationState.envelopeSlots[2]?.sustain ?? createDefaultEnvelope(2).sustain,
            "env3.releaseSeconds": modulationState.envelopeSlots[2]?.releaseSeconds ?? createDefaultEnvelope(2).releaseSeconds,
        };

        for (const descriptor of allTargetDescriptors()) {
            const parameterId = descriptor.articulationParameterId;
            if (parameterId === null) {
                continue;
            }
            if (descriptor.binding._tag !== "endpoint") {
                throw new Error(`Articulation-capable target ${descriptor.targetId} has no endpoint binding`);
            }
            const normalizedValue = this.parameterValues[descriptor.targetId];
            if (normalizedValue === undefined) {
                throw new Error(`Patch base is missing target ${descriptor.targetId}`);
            }
            parameters[parameterId] = descriptor.binding.toEngine(normalizedValue);
        }

        const validRoutes = this.collectValidRoutes(modulationState);
        return {
            parameters,
            routeAmounts: Object.fromEntries(validRoutes.map(({ route }) => [route.id, route.amount])),
            routeOrder: validRoutes.map(({ route }) => route.id),
        };
    }

    private uploadAllBoundBaseValues(): void {
        for (const descriptor of allTargetDescriptors()) {
            if (descriptor.binding._tag !== "endpoint") {
                continue;
            }
            const value = this.parameterValues[descriptor.targetId];
            if (value === undefined) {
                throw new Error(`Patch base is missing target ${descriptor.targetId}`);
            }
            this.connection.sendEventOrValue?.(descriptor.binding.endpointId, descriptor.binding.toEngine(value));
        }
    }

    private uploadAllArticulationImages(): void {
        const base = this.makePatchVoiceBase();
        for (const image of resolveArticulationImages(base, this.articulations)) {
            this.connection.sendEventOrValue?.(ARTICULATION_SNAPSHOT_ENDPOINT_ID, image);
        }
    }

    private uploadArticulationSelectors(selectors: ReadonlyArray<number>): void {
        if (selectors.length === 0) {
            return;
        }
        const selectorSet = new Set(selectors);
        const base = this.makePatchVoiceBase();
        for (const slot of this.articulations.slots) {
            if (selectorSet.has(slot.runtimeSlot)) {
                this.connection.sendEventOrValue?.(
                    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
                    resolveArticulationImage(base, slot),
                );
            }
        }
    }

    private buildTriggerConfig(): ArticulationTriggerConfig {
        const chain = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
        const key = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
        const velocity = Array.from({ length: ARTICULATION_MAX_SLOTS }, () => ARTICULATION_UNASSIGNED_RUNTIME_SLOT);
        for (const slot of this.articulations.slots) {
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
            activeMode: this.articulations.activeTriggerMode,
            chain,
            key,
            velocity,
        };
    }

    private sendNativeTriggerConfig(): void {
        const serialized = serializeArticulationTriggerConfig(this.buildTriggerConfig());
        this.connection.sendNativeArticulationTriggerConfig?.(serialized);
    }

    private persistArticulations(): void {
        this.sendStoredStateValue(
            "articulations.v3",
            JSON.stringify(serializeArticulationsV3(this.articulations)),
        );
    }

    private persistArticulationsAndTriggerConfig(): void {
        this.persistArticulations();
        const serialized = serializeArticulationTriggerConfig(this.buildTriggerConfig());
        this.sendStoredStateValue(ARTICULATION_TRIGGER_CONFIG_STATE_KEY, serialized);
        this.connection.sendNativeArticulationTriggerConfig?.(serialized);
    }

    private persistParameterValues(): void {
        this.sendStoredStateValue(UI_PATCH_VALUES_STATE_KEY, JSON.stringify(this.parameterValues));
    }

    private persistUiMappings(): void {
        const document: Record<string, StoredUiMapping> = {};
        for (const mapping of this.uiMappings.values()) {
            document[mapping.id] = {
                targetId: mapping.targetId,
                sourceId: mapping.sourceId,
                amount: mapping.amount,
                polarity: mapping.polarity,
                reducer: mapping.reducer,
                enabled: mapping.enabled,
            };
        }
        this.sendStoredStateValue(UI_MAPPINGS_STATE_KEY, JSON.stringify(document));
    }

    private persistRackState(): void {
        this.sendStoredStateValue(RACK_STATE_KEY, JSON.stringify({
            order: this.rackState.order,
            enabled: this.rackState.enabled,
            compound: this.rackState.compound,
        }));
    }

    private sendStoredStateValue(key: string, value: unknown): void {
        if (typeof this.connection.sendStoredStateValue !== "function") {
            return;
        }
        const token = stableToken(value);
        const pendingByToken = this.pendingStoredStateEchoes.get(key) ?? new Map<string, number>();
        pendingByToken.set(token, (pendingByToken.get(token) ?? 0) + 1);
        this.pendingStoredStateEchoes.set(key, pendingByToken);
        this.connection.sendStoredStateValue(key, value);
    }

    private consumePendingStoredStateEcho(key: string, value: unknown): boolean {
        const pendingByToken = this.pendingStoredStateEchoes.get(key);
        if (pendingByToken === undefined) {
            return false;
        }
        const token = stableToken(value);
        const count = pendingByToken.get(token) ?? 0;
        if (count === 0) {
            return false;
        }
        if (count === 1) {
            pendingByToken.delete(token);
        } else {
            pendingByToken.set(token, count - 1);
        }
        if (pendingByToken.size === 0) {
            this.pendingStoredStateEchoes.delete(key);
        }
        return true;
    }

    private freeArticulationKey(from: number): number {
        const occupied = new Set(this.articulations.slots.map((slot) => slot.key));
        const startingKey = clampMidiValue(from);
        for (let key = startingKey; key <= 127; key += 1) {
            if (!occupied.has(key)) {
                return key;
            }
        }
        for (let key = startingKey - 1; key >= 0; key -= 1) {
            if (!occupied.has(key)) {
                return key;
            }
        }
        return startingKey;
    }

    private uniqueArticulationId(baseId: string, usedIds: ReadonlySet<string>): string {
        if (!usedIds.has(baseId)) {
            return baseId;
        }
        for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
            const candidate = `${baseId}-${suffix}`;
            if (!usedIds.has(candidate)) {
                return candidate;
            }
        }
        throw new Error(`Could not mint a unique articulation id from ${baseId}`);
    }

    private uniqueArticulationName(baseName: string): string {
        const usedNames = new Set(this.articulations.slots.map((slot) => slot.name));
        for (let suffix = 2; suffix <= ARTICULATION_MAX_SLOTS; suffix += 1) {
            const candidate = `${baseName} ${suffix}`;
            if (!usedNames.has(candidate)) {
                return candidate;
            }
        }
        throw new Error(`Could not mint a unique articulation name from ${baseName}`);
    }
}

/**
 * Create the engine-backed Cosimo adapter over a Cmajor patch connection.
 *
 * The returned port owns synchronous UI state, strict stored-state hydration,
 * modulation-bridge acquisition, runtime uploads, and cleanup.
 *
 * @param input - The live patch connection used for engine events and stored state.
 * @returns The application port plus an idempotent resource-release method.
 */
export function createCosimoBridgeAdapter(input: {
    readonly connection: PatchConnectionLike;
}): CosimoAdapterPort & { dispose(): void } {
    return new CosimoBridgeAdapter(input.connection);
}
