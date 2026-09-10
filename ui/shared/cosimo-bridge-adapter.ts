import {
    ArticulationSlotsExhausted,
    MappingAlreadyExists,
    SourceSlotsExhausted,
    StateEditRefused,
    TargetNotModulatable,
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
    ARTICULATIONS_V4_STATE_KEY,
    createEmptyArticulationsState,
    lowestFreeRuntimeSlot,
    parseArticulationsV4,
    serializeArticulationsV4,
    type ArticulationSlotV4,
    type ArticulationsState,
    type ArticulationVoiceParameterId,
} from "./articulation-image";
import {
    ARTICULATION_MAX_SLOTS,
    createDefaultArticulationName,
} from "./articulations";
import type { PatchConnectionLike } from "./cmajor-react";
import type { PluginStateClientResult } from "../../kit/ui/plugin-state-client";
import type { PluginStateHistoryEntry, PluginStateScope } from "../../kit/ui/plugin-state-session";
import { acquireSynthViewState } from "./synth-state-client";
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
    createDefaultEnvelope,
    createDefaultModulationState,
    getModulationAmountBounds,
    modulationRoutePairKey,
    normalizeEnvelope,
    type ModulationEnvelope,
    type ModulationRoute,
    type ModulationSourceKind,
    type ModulationState,
    type ModulationTargetKind,
} from "./modulation";
import { getModulationArticulationCellIndex } from "./modulation-runtime-program";
import { err, ok } from "./result";
import {
    EFFECT_ID_TO_LANE_TYPE,
    LANE_STATE_KEY,
    LANE_TYPE_TO_EFFECT_ID,
    RACK_EFFECT_ORDER,
    sendLaneParamValue,
} from "./lane-state";
import {
    commitLaneStateV2,
    createDefaultLaneStateV2,
    findLaneDevicePath,
    getLaneDeviceEnabled,
    listLaneChainDeviceIds,
    moveLaneDevice,
    parseLaneInstanceId,
    parseLaneStateV2,
    serializeLaneStateV2,
    setLaneDeviceEnabled,
    setLaneDeviceParam,
    type LaneStateV2,
} from "./lane-state-v2";
import { getRackParameterDescriptor } from "./rack-parameter-descriptors";
import {
    allTargetDescriptors,
    getTargetDescriptor,
    parseTargetId,
    type EffectModuleId,
    type ModAmountSpec,
    type TargetDescriptor,
} from "./target-descriptor";

const ARTICULATION_COLORS = [
    "#d2a128",
    "#d76a4a",
    "#5aa7a7",
    "#8f7bd8",
    "#8fae4d",
    "#d48bac",
] as const;

const INITIAL_VISIBLE_SOURCE_IDS = ["macro-1", "envelope-1", "mseg-1", "amp-envelope"] as const;
const MSEG_MORPH_ENDPOINT_IDS = ["mseg1Morph", "mseg2Morph", "mseg3Morph"] as const;

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

type ParseOutcome<T> =
    | { readonly _tag: "ok"; readonly value: T }
    | { readonly _tag: "err"; readonly message: string };

type DeletedSourceBackup = {
    readonly definition: SourceDefinition;
    readonly scope: PluginStateScope;
    readonly historyEntry: PluginStateHistoryEntry | undefined;
    readonly historyHead: PluginStateHistoryEntry | undefined;
    readonly version: number;
    readonly envelopeValue: ModulationEnvelope | null;
    readonly macroValue: NormalizedValue | null;
    readonly msegMorphValue: NormalizedValue | null;
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
        const isAmpEnvelope = option.value === "amp-envelope";
        const idRaw = option.sourceKind === "env"
            ? isAmpEnvelope ? option.value : `envelope-${option.sourceSlot ?? 0}`
            : option.value;
        const label = option.sourceKind === "env"
            ? isAmpEnvelope ? "Amp Envelope" : `Envelope ${option.sourceSlot ?? 0}`
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

function articulationIdFromSlot(slot: ArticulationSlotV4): ArticulationId {
    // SAFETY: the slot was either accepted by parseArticulationsV4 or minted by
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
    return clampSpecAmount(spec, magnitude * 0.25);
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

function buildParameterOwnedEnvelope(
    parameterValues: Readonly<Record<string, NormalizedValue>>,
    envelopeName: string,
    slotIndex: number,
): ModulationEnvelope {
    const isAmpEnvelope = slotIndex === 3;
    const fallback = isAmpEnvelope
        ? { name: "Amp Envelope", attackSeconds: 0.01, decaySeconds: 0.001, sustain: 1, releaseSeconds: 0.2 }
        : createDefaultEnvelope(slotIndex);
    const prefix = isAmpEnvelope ? "ampEnvelope" : `env${slotIndex + 1}`;
    const readEngineValue = (field: "attack" | "decay" | "sustain" | "release", fallbackValue: number) => {
        const descriptor = allTargetDescriptors().find((candidate) => candidate.targetId === `${prefix}.${field}`);
        if (descriptor?.binding._tag !== "endpoint") return fallbackValue;
        const value = parameterValues[descriptor.targetId] ?? descriptor.initialValue;
        return descriptor.binding.toEngine(value);
    };
    return {
        name: isAmpEnvelope ? "Amp Envelope" : envelopeName,
        attackSeconds: readEngineValue("attack", fallback.attackSeconds),
        decaySeconds: readEngineValue("decay", fallback.decaySeconds),
        sustain: readEngineValue("sustain", fallback.sustain),
        releaseSeconds: readEngineValue("release", fallback.releaseSeconds),
    };
}

function createInitialLaneState(): LaneStateV2 {
    return createDefaultLaneStateV2();
}

/** The host surface speaks effect ids; the document speaks instance ids.
    Until the add/remove UX, every host-visible device is instance #1. */
function laneDeviceIdForEffect(effectId: EffectModuleId): string {
    return `${EFFECT_ID_TO_LANE_TYPE[effectId]}#1`;
}

function requireEffectId(input: string): EffectModuleId {
    const effectId = RACK_EFFECT_ORDER.find((candidate) => candidate === input);
    if (effectId === undefined) {
        throw new Error(`Unknown effect id: ${input}`);
    }
    return effectId;
}

function parseStoredArticulations(
    input: unknown,
    acceptedRouteIds: ReadonlySet<string>,
): ParseOutcome<ArticulationsState> {
    const document = parseJsonDocument(input, ARTICULATIONS_V4_STATE_KEY);
    if (document._tag === "err") {
        return document;
    }
    const parsed = parseArticulationsV4(document.value, acceptedRouteIds);
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
    private readonly stateLease: ReturnType<typeof acquireSynthViewState>;
    private readonly modulationBridge: ReturnType<typeof acquireSynthViewState>["modulation"];
    private readonly removeStateListener: () => void;
    private pendingHydration: { readonly value: unknown } | undefined;
    private hydrationRequest = 0;
    private documentScope: PluginStateScope | null = null;
    private confirmedMappingIds: ReadonlySet<string> = new Set();
    private parameterValues = createInitialParameterValues();
    private laneParamDeliverySerial = 0;
    private articulations = createEmptyArticulationsState();
    // lane.v1 is desired state. effectiveRackState has no intent correlation and
    // therefore cannot safely become the base for a later editor command.
    private rackState: LaneStateV2 = createInitialLaneState();
    private compoundSettings: Readonly<Record<TargetId, CompoundSetting>> = {};
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
    private readonly msegMorphValues: Array<NormalizedValue> = Array.from(
        { length: MSEG_MORPH_ENDPOINT_IDS.length },
        () => clampNormalizedValue(0),
    );
    private readonly visibleSourceIds = new Set<string>(INITIAL_VISIBLE_SOURCE_IDS);
    private readonly routeReducers = new Map<string, MappingReducer>();
    private mappingCreationOrder: Array<string> = [];
    private readonly listeners = new Set<() => void>();
    private readonly pendingStoredStateEchoes = new Map<string, Map<string, number>>();
    private readonly parameterListenerCleanups: Array<() => void> = [];
    private deletedSourceBackup: DeletedSourceBackup | null = null;
    private activeMidiNote: number | null = null;
    private projectedModulationState = createDefaultModulationState();
    private snapshot: PatchSnapshot;
    private commandDepth = 0;
    private snapshotDirty = false;
    private hydrationComplete = false;
    private disposed = false;

    private readonly handleModulationState = (state: ModulationState | null): void => {
        if (this.disposed) {
            return;
        }
        if (state === null || !this.hydrationComplete) {
            this.markSnapshotDirty();
            return;
        }
        const validRoutes = this.collectValidRoutes(state);
        const snapshot = this.stateLease.client.getSnapshot();
        const confirmed = snapshot.kind === "ready" && !snapshot.pendingFields.includes(MODULATION_STATE_KEY);
        if (confirmed && validRoutes.length !== state.routes.length) {
            this.detach(`${MODULATION_STATE_KEY} contains a mapping without its canonical current identity`);
            return;
        }
        this.projectedModulationState = state;
        if (confirmed) {
            this.confirmedMappingIds = this.collectArticulationMappingIds(validRoutes);
            this.adoptValidRoutes(validRoutes);
        } else this.markSnapshotDirty();
    };

    private readonly handleStateSnapshot = (): void => {
        if (this.disposed) return;
        const snapshot = this.stateLease.client.getSnapshot();
        if (snapshot.kind !== "ready") {
            this.connectionState = snapshot.kind === "connecting" ? { _tag: "connecting" }
                : { _tag: "detached", reason: snapshot.kind === "failed" ? snapshot.reason : "State client closed." };
            this.markSnapshotDirty();
            return;
        }
        const scope = snapshot.state.scope;
        const changedDocument = scope && this.documentScope && !this.sameDocument(this.documentScope);
        this.documentScope = scope;
        if (changedDocument) {
            this.deletedSourceBackup = null;
            this.hydrationComplete = false;
            this.requestHydration();
        }
        const field = snapshot.state.fields[MODULATION_STATE_KEY];
        if (field.readiness.kind === "failed") {
            this.detach(field.readiness.reason === "invalid-state"
                ? `${MODULATION_STATE_KEY} does not match the current modulation schema`
                : `${MODULATION_STATE_KEY}: ${field.readiness.reason}`);
            return;
        }
        if (snapshot.pendingFields.includes(MODULATION_STATE_KEY)) return;
        if (this.pendingHydration) this.hydrate(this.pendingHydration.value);
        else this.handleModulationState(this.modulationBridge.getState());
    };

    private sameDocument(scope: PluginStateScope): boolean {
        const current = this.stateLease.client.getSnapshot();
        return !this.disposed && current.kind === "ready"
            && current.state.scope?.owner === scope.owner && current.state.scope.document === scope.document;
    }

    private requestHydration(): void {
        const request = ++this.hydrationRequest;
        const receive = (storedState: unknown) => {
            if (this.disposed || request !== this.hydrationRequest) return;
            this.hydrate(storedState);
        };
        if (typeof this.connection.requestFullStoredState === "function") this.connection.requestFullStoredState(receive);
        else receive({});
    }

    private adoptValidRoutes(validRoutes: ReadonlyArray<ValidRoute>): void {
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
            if (message.key === LANE_STATE_KEY) {
                const parsed = parseLaneStateV2(message.value);
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                this.rackState = parsed.value;
                this.refreshLaneParameterValues();
                commitLaneStateV2(this.connection, this.rackState);
                this.markSnapshotDirty();
                return;
            }
            if (message.key === ARTICULATIONS_V4_STATE_KEY) {
                const parsed = parseStoredArticulations(
                    message.value,
                    this.confirmedMappingIds,
                );
                if (parsed._tag === "err") {
                    this.detach(parsed.message);
                    return;
                }
                this.articulations = parsed.value;
                this.markSnapshotDirty();
            }
        });
    };

    constructor(connection: PatchConnectionLike) {
        this.connection = connection;
        this.stateLease = acquireSynthViewState(connection);
        this.modulationBridge = this.stateLease.modulation;
        this.snapshot = this.buildSnapshot();
        this.modulationBridge.subscribe(this.handleModulationState);
        this.handleModulationState(this.modulationBridge.getState());
        this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
        this.installParameterListeners();

        this.removeStateListener = this.stateLease.client.subscribe(this.handleStateSnapshot);
        this.handleStateSnapshot();
        this.requestHydration();
    }

    // Bound arrows: useSyncExternalStore detaches these from the instance
    // (port.getSnapshot passed by value), so prototype methods would lose
    // `this`. The contract suite calls via property access and cannot catch
    // that — the harness did.
    readonly getSnapshot = (): PatchSnapshot => this.snapshot;

    readonly subscribe = (onChange: () => void): (() => void) => {
        this.listeners.add(onChange);
        return () => this.listeners.delete(onChange);
    };

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
            this.consumeStateEdit(this.modulationBridge.setMsegSlotShape(this.slotIndex(definition), input.shapeIndex, input.shape));
        }),
        setMsegMorph: (input) => this.runCommand(() => this.setMsegMorph(input)),
        setMsegPlayback: (input) => this.runCommand(() => {
            const definition = this.requireSource(input.sourceId, "mseg");
            this.consumeStateEdit(this.modulationBridge.setMsegSlotPlayback(this.slotIndex(definition), input.playback));
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
            const next = setLaneDeviceEnabled(
                this.rackState, laneDeviceIdForEffect(knownEffectId), enabled);
            if (next === null) {
                throw new Error(`Rack is missing effect ${knownEffectId}`);
            }
            this.rackState = next;
            commitLaneStateV2(this.connection, this.rackState);
            this.persistLaneState();
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
        for (const cleanup of this.parameterListenerCleanups) {
            cleanup();
        }
        this.parameterListenerCleanups.length = 0;
        this.modulationBridge.unsubscribe(this.handleModulationState);
        this.removeStateListener();
        this.stateLease.release();
        this.listeners.clear();
    }

    /** The host's ordered effect list: the document's dispatch-order walk.
        Groups flatten branch by branch — the serial case is unchanged. */
    private projectEffectOrder(): EffectModuleId[] {
        return listLaneChainDeviceIds(this.rackState).flatMap((deviceId) => {
            const parsed = parseLaneInstanceId(deviceId);
            const effectId = parsed === null ? undefined : LANE_TYPE_TO_EFFECT_ID.get(parsed.deviceType);
            return effectId === undefined || parsed?.instanceNumber !== 1 ? [] : [effectId];
        });
    }

    private projectEffectEnabled(): Record<EffectModuleId, boolean> {
        return Object.fromEntries(RACK_EFFECT_ORDER.map((effectId) => [
            effectId,
            getLaneDeviceEnabled(this.rackState, laneDeviceIdForEffect(effectId)) ?? false,
        ])) as Record<EffectModuleId, boolean>;
    }

    /** Mirror the lane document's parameter values into target-id space. */
    private refreshLaneParameterValues(): void {
        let nextValues = this.parameterValues;
        for (const descriptor of allTargetDescriptors()) {
            if (descriptor.binding._tag !== "endpoint") {
                continue;
            }
            const laneParameter = getRackParameterDescriptor(descriptor.binding.endpointId);
            if (laneParameter === null) {
                continue;
            }
            const engineValue = this.rackState
                .devices[laneDeviceIdForEffect(laneParameter.effectId)]?.params[laneParameter.endpointID];
            if (typeof engineValue !== "number") {
                continue;
            }
            nextValues = {
                ...nextValues,
                [descriptor.targetId]: descriptor.binding.fromEngine(engineValue),
            };
        }
        this.parameterValues = nextValues;
    }

    private installParameterListeners(): void {
        for (const descriptor of allTargetDescriptors()) {
            const binding = descriptor.binding;
            if (binding._tag !== "endpoint") {
                continue;
            }
            if (getRackParameterDescriptor(binding.endpointId) !== null) {
                // Lane parameters have no host endpoint to listen on; the
                // lane document refresh mirrors their values instead.
                continue;
            }
            const endpointID = binding.endpointId;
            const listener = (rawValue: unknown) => {
                if (this.disposed || typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
                    return;
                }
                let normalizedValue: NormalizedValue;
                try {
                    normalizedValue = binding.fromEngine(rawValue);
                } catch {
                    return;
                }
                this.parameterValues = {
                    ...this.parameterValues,
                    [descriptor.targetId]: normalizedValue,
                };
                this.markSnapshotDirty();
            };
            this.connection.addParameterListener?.(endpointID, listener);
            this.parameterListenerCleanups.push(() => {
                this.connection.removeParameterListener?.(endpointID, listener);
            });
            this.connection.requestParameterValue?.(endpointID);
        }

        for (let slotIndex = 0; slotIndex < MSEG_MORPH_ENDPOINT_IDS.length; slotIndex += 1) {
            const endpointID = MSEG_MORPH_ENDPOINT_IDS[slotIndex];
            const listener = (rawValue: unknown) => {
                if (this.disposed || typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
                    return;
                }
                this.msegMorphValues[slotIndex] = clampNormalizedValue(rawValue);
                this.markSnapshotDirty();
            };
            this.connection.addParameterListener?.(endpointID, listener);
            this.parameterListenerCleanups.push(() => {
                this.connection.removeParameterListener?.(endpointID, listener);
            });
            this.connection.requestParameterValue?.(endpointID);
        }
    }

    private hydrate(storedState: unknown): void {
        if (this.disposed) {
            return;
        }

        const rawArticulations = readFullStoredStateValue(storedState, ARTICULATIONS_V4_STATE_KEY);
        const rawRackState = readFullStoredStateValue(storedState, LANE_STATE_KEY);
        this.pendingHydration = { value: storedState };
        const clientSnapshot = this.stateLease.client.getSnapshot();
        const restoredModulationState = this.modulationBridge.getState();
        if (!restoredModulationState || !this.modulationBridge.isReady()
            || clientSnapshot.kind !== "ready" || clientSnapshot.pendingFields.includes(MODULATION_STATE_KEY)) return;
        const validRoutes = this.collectValidRoutes(restoredModulationState);
        if (validRoutes.length !== restoredModulationState.routes.length) {
            this.detach(`${MODULATION_STATE_KEY} contains a mapping without its canonical current identity`);
            return;
        }

        const parsedArticulations = rawArticulations === undefined
            ? { _tag: "ok", value: createEmptyArticulationsState() } as const
            : parseStoredArticulations(rawArticulations, this.collectArticulationMappingIds(validRoutes));
        if (parsedArticulations._tag === "err") {
            this.detach(parsedArticulations.message);
            return;
        }

        const parsedRackState = rawRackState === undefined
            ? { _tag: "ok", value: createInitialLaneState() } as const
            : parseLaneStateV2(rawRackState);
        if (parsedRackState._tag === "err") {
            this.detach(parsedRackState.message);
            return;
        }

        this.runCommand(() => {
            this.projectedModulationState = restoredModulationState;
            this.confirmedMappingIds = this.collectArticulationMappingIds(validRoutes);
            this.pendingHydration = undefined;
            this.articulations = parsedArticulations.value;
            this.rackState = parsedRackState.value;
            this.refreshLaneParameterValues();
            this.connectionState = { _tag: "ready" };
            this.visibleSourceIds.clear();
            for (const sourceId of INITIAL_VISIBLE_SOURCE_IDS) {
                this.visibleSourceIds.add(sourceId);
            }
            this.hydrationComplete = true;
            this.adoptValidRoutes(validRoutes);
            commitLaneStateV2(this.connection, this.rackState);
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
        const validRoutes = this.collectValidRoutes(this.projectedModulationState);
        const mappings = this.projectMappingsInCreationOrder(validRoutes);
        const articulationRouteById = new Map(validRoutes.flatMap((validRoute) => (
            getModulationArticulationCellIndex(validRoute.route) === null
                ? []
                : [[validRoute.route.id, validRoute] as const]
        )));
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
            for (const [mappingId, routeAmount] of Object.entries(slot.routeAmounts)) {
                const validRoute = articulationRouteById.get(mappingId);
                if (validRoute !== undefined) {
                    mappingAmounts[mappingId] = routeAmountToSpecAmount(
                        validRoute.descriptor.modAmount,
                        validRoute.route.targetKind,
                        routeAmount,
                    );
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
                effectOrder: this.projectEffectOrder(),
                effectEnabled: this.projectEffectEnabled(),
                compoundSettings: { ...this.compoundSettings },
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
        const state = this.projectedModulationState;
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
                const envelopeSlot = state.envelopeSlots[slotIndex];
                sources.push({
                    id: sourceId,
                    type: "envelope",
                    slot: definition.slot,
                    label: definition.label,
                    state: {
                        _tag: "envelope",
                        envelope: buildParameterOwnedEnvelope(
                            this.parameterValues,
                            envelopeSlot?.name ?? createDefaultEnvelope(slotIndex).name,
                            slotIndex,
                        ),
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
                state: {
                    _tag: "mseg",
                    slot: {
                        ...msegSlot,
                        morph: this.msegMorphValues[slotIndex] ?? clampNormalizedValue(0),
                    },
                },
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
            reducer: validRoute.route.reducer === "mean" ? "Mean" : "Max",
            enabled: validRoute.route.enabled,
        };
    }

    private synchronizeMappingCreationOrder(validRoutes: ReadonlyArray<ValidRoute>): void {
        const activeMappingIds = new Set(validRoutes.map((validRoute) => validRoute.route.id));
        this.mappingCreationOrder = this.mappingCreationOrder.filter((mappingId) => activeMappingIds.has(mappingId));
        const orderedMappingIds = new Set(this.mappingCreationOrder);
        for (const validRoute of validRoutes) {
            if (!orderedMappingIds.has(validRoute.route.id)) {
                this.mappingCreationOrder.push(validRoute.route.id);
                orderedMappingIds.add(validRoute.route.id);
            }
        }
    }

    private setParameter(input: Parameters<CosimoCommands["setParameter"]>[0]): void {
        const descriptor = getTargetDescriptor(input.targetId);
        if (input.layer._tag === "patchBase") {
            this.parameterValues = { ...this.parameterValues, [descriptor.targetId]: input.value };
            if (descriptor.binding._tag === "endpoint") {
                const laneParameter = getRackParameterDescriptor(descriptor.binding.endpointId);
                if (laneParameter !== null) {
                    // Effect parameters have no host endpoints since the
                    // parameter cut: the lane document owns the value and the
                    // field upload is the audible path.
                    const engineValue = descriptor.binding.toEngine(input.value);
                    const next = setLaneDeviceParam(
                        this.rackState,
                        laneDeviceIdForEffect(laneParameter.effectId),
                        laneParameter.endpointID,
                        engineValue,
                    );
                    if (next === null) {
                        throw new Error(`Rack is missing effect ${laneParameter.effectId}`);
                    }
                    this.rackState = next;
                    this.laneParamDeliverySerial += 1;
                    sendLaneParamValue(
                        this.connection,
                        laneParameter.effectId,
                        laneParameter.endpointID,
                        engineValue,
                        this.laneParamDeliverySerial,
                    );
                    this.persistLaneState();
                } else {
                    this.connection.sendEventOrValue?.(
                        descriptor.binding.endpointId,
                        descriptor.binding.toEngine(input.value),
                    );
                }
            }
        } else {
            const slot = this.requireArticulation(input.layer.articulationId);
            const parameterId = descriptor.articulationParameterId;
            if (parameterId === null || descriptor.binding._tag !== "endpoint") {
                throw new Error(`Target ${descriptor.targetId} cannot be articulation-overridden`);
            }
            const nextSlot: ArticulationSlotV4 = {
                ...slot,
                overrides: {
                    ...slot.overrides,
                    [parameterId]: descriptor.binding.toEngine(input.value),
                },
            };
            this.replaceArticulationSlot(nextSlot);
            this.persistArticulations();
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

    private mappingRoute(input: Parameters<CosimoCommands["addMapping"]>[0], source: SourceDefinition) {
        const descriptor = getTargetDescriptor(input.targetId);
        const targetKind = descriptor.modulationTargetKind;
        if (targetKind === null) {
            return err(new TargetNotModulatable(descriptor.targetId));
        }
        const routes = this.collectValidRoutes(this.projectedModulationState);
        const sourceId = sourceIdFromDefinition(source);
        const mappingId = makeMappingId(descriptor.targetId, sourceId);
        if (routes.some((validRoute) => validRoute.route.id === mappingId)) {
            return err(new MappingAlreadyExists(mappingId));
        }

        const amount = input.amount ?? defaultSpecAmount(descriptor.modAmount);
        const route: ModulationRoute = {
            id: mappingId,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: input.polarity === "Bipolar" ? "bipolar" : "unipolar",
            targetKind,
            amount: specAmountToRouteAmount(descriptor.modAmount, targetKind, amount),
            reducer: input.reducer === "Mean" ? "mean" : "max",
        };
        const rawRoutes = this.projectedModulationState.routes;
        if (rawRoutes.some((candidate) => (
            candidate.id === mappingId
            || modulationRoutePairKey(candidate) === modulationRoutePairKey(route)
        ))) {
            return err(new MappingAlreadyExists(mappingId));
        }

        return ok({ mappingId, route });
    }

    private async addMapping(input: Parameters<CosimoCommands["addMapping"]>[0]): ReturnType<CosimoCommands["addMapping"]> {
        const parsed = this.mappingRoute(input, this.requireSource(input.sourceId));
        if (parsed._tag === "err") return parsed;
        const accepted = await this.editBank({ ...this.projectedModulationState, routes: [...this.projectedModulationState.routes, parsed.value.route] });
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        this.routeReducers.set(parsed.value.mappingId, input.reducer ?? "Max");
        return ok(parsed.value.mappingId);
    }

    private async removeMapping(mappingId: MappingId): ReturnType<CosimoCommands["removeMapping"]> {
        const mapping = this.requireMapping(mappingId);
        const accepted = await this.editBank({ ...this.projectedModulationState,
            routes: this.projectedModulationState.routes.filter(route => route.id !== mapping.route.id),
        });
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        this.runCommand(() => {
            this.routeReducers.delete(mappingId);
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
            this.markSnapshotDirty();
        });
        return ok(undefined);
    }

    private setMappingAmount(
        mappingId: MappingId,
        amount: number,
        layer: Parameters<CosimoCommands["setMappingAmount"]>[2],
    ): void {
        const mapping = this.requireMapping(mappingId);
        const routeAmount = specAmountToRouteAmount(
            mapping.descriptor.modAmount,
            mapping.route.targetKind,
            amount,
        );
        if (layer._tag === "patchBase") {
            this.consumeStateEdit(this.modulationBridge.setRouteAmountById(mapping.route.id, routeAmount));
            return;
        }

        if (!this.confirmedMappingIds.has(mapping.route.id)
            || getModulationArticulationCellIndex(mapping.route) === null) {
            return;
        }

        const slot = this.requireArticulation(layer.articulationId);
        this.replaceArticulationSlot({
            ...slot,
            routeAmounts: { ...slot.routeAmounts, [mappingId]: routeAmount },
        });
        this.persistArticulations();
        this.markSnapshotDirty();
    }

    private setMappingEnabled(mappingId: MappingId, enabled: boolean): void {
        const mapping = this.requireMapping(mappingId);
        this.consumeStateEdit(this.modulationBridge.setRoute(mapping.routeIndex, { ...mapping.route, enabled }));
    }

    private setMappingPolarity(
        mappingId: MappingId,
        polarity: ModulationMapping["polarity"],
    ): void {
        const mapping = this.requireMapping(mappingId);
        this.consumeStateEdit(this.modulationBridge.setRoute(mapping.routeIndex, {
            ...mapping.route,
            polarity: polarity === "Bipolar" ? "bipolar" : "unipolar",
        }));
    }

    private setMappingReducer(mappingId: MappingId, reducer: MappingReducer): void {
        const mapping = this.requireMapping(mappingId);
        this.consumeStateEdit(this.modulationBridge.setRoute(mapping.routeIndex, {
            ...mapping.route,
            reducer: reducer === "Mean" ? "mean" : "max",
        }));
    }

    private async createSource(type: Exclude<SourceType, "fixed">): ReturnType<CosimoCommands["createSource"]> {
        const definitions = SOURCE_DEFINITIONS.filter((definition) => (
            definition.type === type && definition.idRaw !== "amp-envelope"
        ));
        const definition = definitions.find((candidate) => !this.visibleSourceIds.has(candidate.idRaw));
        if (definition === undefined) {
            return err(new SourceSlotsExhausted(type, definitions.length));
        }
        const accepted = await this.editBank(this.resetSourceBank(this.projectedModulationState, definition));
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        this.runCommand(() => {
            this.visibleSourceIds.add(definition.idRaw);
            this.resetSourceParameters(definition);
            this.deletedSourceBackup = null;
            this.markSnapshotDirty();
        });
        return ok(sourceIdFromDefinition(definition));
    }

    private consumeStateEdit(completion: Promise<PluginStateClientResult>): void {
        const snapshot = this.stateLease.client.getSnapshot();
        const scope = snapshot.kind === "ready" ? snapshot.state.scope : null;
        void completion.then(result => {
            if (this.disposed || !scope || !this.sameDocument(scope) || result.kind === "accepted") return;
            this.audition = { ...this.audition, status: new StateEditRefused(result).message };
            this.markSnapshotDirty();
        }, error => {
            if (this.disposed || (scope && !this.sameDocument(scope))) return;
            console.error("Cosimo adapter state edit failed", error);
            this.detach("State edit failed unexpectedly.");
        });
    }

    // Callers also check the returned scope immediately before dependent
    // effects: their await introduces another turn in which a reset can arrive.
    private async editBank(value: ModulationState) {
        const current = this.stateLease.client.getSnapshot();
        if (this.disposed) return err(new StateEditRefused({ kind: "rejected", reason: "service-closed" }));
        const field = current.kind === "ready" ? current.state.fields[MODULATION_STATE_KEY] : undefined;
        if (current.kind === "ready" && field && "gesture" in field && field.gesture?.client === current.client)
            return err(new StateEditRefused({ kind: "rejected", reason: "busy" }));
        const scope = current.kind === "ready" ? current.state.scope : null;
        const result = await this.modulationBridge.setState(value);
        if (result.kind !== "accepted" || !scope || !this.sameDocument(scope)) return err(new StateEditRefused(result));
        return ok({ receipt: result, scope });
    }

    private resetSourceBank(state: ModulationState, definition: SourceDefinition): ModulationState {
        const index = this.slotIndex(definition);
        const defaults = createDefaultModulationState();
        if (definition.type === "envelope") return { ...state,
            envelopeSlots: state.envelopeSlots.map((slot, slotIndex) => slotIndex === index ? defaults.envelopeSlots[index]! : slot),
        };
        if (definition.type === "mseg") return { ...state,
            msegSlots: state.msegSlots.map((slot, slotIndex) => slotIndex === index ? defaults.msegSlots[index]! : slot),
        };
        return state;
    }

    private resetSourceParameters(definition: SourceDefinition): void {
        const index = this.slotIndex(definition);
        if (definition.type === "macro") this.macroValues[index] = clampNormalizedValue(0);
        else if (definition.type === "envelope") this.writeEnvelopeParameters(definition, createDefaultEnvelope(index));
        else if (definition.type === "mseg") {
            this.msegMorphValues[index] = clampNormalizedValue(0);
            this.connection.sendEventOrValue?.(MSEG_MORPH_ENDPOINT_IDS[index], 0);
        }
    }

    private async deleteSource(sourceId: SourceId): ReturnType<CosimoCommands["deleteSource"]> {
        const definition = SOURCE_DEFINITION_BY_ID.get(String(sourceId));
        if (!definition) throw new Error(`Unknown source id: ${sourceId}`);
        if (definition.type === "fixed" || definition.idRaw === "amp-envelope") return ok(undefined);
        this.requireSource(sourceId);
        const state = this.projectedModulationState;
        const removedMappingIds = new Set(this.collectValidRoutes(state)
            .filter(route => route.sourceId === sourceId).map(route => route.route.id));
        const metadata = {
            definition,
            envelopeValue: definition.type === "envelope"
                ? buildParameterOwnedEnvelope(this.parameterValues, state.envelopeSlots[this.slotIndex(definition)]?.name ?? definition.label, this.slotIndex(definition)) : null,
            macroValue: definition.type === "macro" ? this.macroValues[this.slotIndex(definition)] ?? clampNormalizedValue(0) : null,
            msegMorphValue: definition.type === "mseg" ? this.msegMorphValues[this.slotIndex(definition)] ?? clampNormalizedValue(0) : null,
            mappingCreationOrder: [...this.mappingCreationOrder],
            articulationRouteAmounts: Object.fromEntries(this.articulations.slots.map(slot => [slot.id,
                Object.fromEntries(Object.entries(slot.routeAmounts).filter(([id]) => removedMappingIds.has(id))),
            ])),
        };
        const next = this.resetSourceBank({ ...state, routes: state.routes.filter(route => !removedMappingIds.has(route.id)) }, definition);
        const accepted = await this.editBank(next);
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        const current = this.stateLease.client.getSnapshot();
        if (current.kind !== "ready") return err(new StateEditRefused(accepted.value.receipt));
        this.runCommand(() => {
            this.deletedSourceBackup = { ...metadata, scope: accepted.value.scope,
                historyEntry: accepted.value.receipt.historyEntry, historyHead: current.state.history.undoEntry,
                version: accepted.value.receipt.version ?? 0,
            };
            this.mappingCreationOrder = this.mappingCreationOrder.filter(id => !removedMappingIds.has(id));
            this.articulations = { ...this.articulations, slots: this.articulations.slots.map(slot => ({ ...slot,
                routeAmounts: Object.fromEntries(Object.entries(slot.routeAmounts).filter(([id]) => !removedMappingIds.has(id))),
            })) };
            this.resetSourceParameters(definition);
            this.visibleSourceIds.delete(definition.idRaw);
            this.persistArticulations();
            this.markSnapshotDirty();
        });
        return ok(undefined);
    }

    private async undoDeleteSource(): ReturnType<CosimoCommands["undoDeleteSource"]> {
        const backup = this.deletedSourceBackup;
        if (!backup) return ok(undefined);
        if (!this.sameDocument(backup.scope)) return err(new StateEditRefused({ kind: "rejected", reason: "stale-scope" }));
        if (backup.historyEntry) {
            const result = await this.stateLease.client.dispatch({ kind: "undo", expectedEntry: backup.historyEntry });
            if (result.kind !== "accepted" || !this.sameDocument(backup.scope)) return err(new StateEditRefused(result));
        } else {
            const current = this.stateLease.client.getSnapshot();
            if (current.kind === "ready" && (current.pendingFields.length > 0
                || Object.values(current.state.fields).some(field => "gesture" in field && field.gesture !== undefined)))
                return err(new StateEditRefused({ kind: "rejected", reason: "busy" }));
            const field = current.kind === "ready" ? current.state.fields[MODULATION_STATE_KEY] : undefined;
            if (current.kind !== "ready" || !field || !("version" in field) || field.version !== backup.version
                || JSON.stringify(current.state.history.undoEntry) !== JSON.stringify(backup.historyHead))
                return err(new StateEditRefused({ kind: "rejected", reason: "stale-history" }));
        }
        this.runCommand(() => {
            this.visibleSourceIds.add(backup.definition.idRaw);
            const index = this.slotIndex(backup.definition);
            if (backup.macroValue !== null) {
                this.macroValues[index] = backup.macroValue;
                this.connection.sendEventOrValue?.(`macro${index + 1}`, backup.macroValue);
            } else if (backup.envelopeValue !== null) this.writeEnvelopeParameters(backup.definition, backup.envelopeValue);
            else if (backup.msegMorphValue !== null) this.setMsegMorph({ sourceId: sourceIdFromDefinition(backup.definition), morph: backup.msegMorphValue, layer: { _tag: "patchBase" } });
            const restoredIds = new Set(this.projectedModulationState.routes.map(route => route.id));
            this.mappingCreationOrder = backup.mappingCreationOrder.filter(id => restoredIds.has(id));
            this.articulations = { ...this.articulations, slots: this.articulations.slots.map(slot => ({ ...slot,
                routeAmounts: { ...slot.routeAmounts, ...Object.fromEntries(Object.entries(backup.articulationRouteAmounts[slot.id] ?? {}).filter(([id]) => restoredIds.has(id))) },
            })) };
            this.deletedSourceBackup = null;
            this.persistArticulations();
            this.markSnapshotDirty();
        });
        return ok(undefined);
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
        const state = this.projectedModulationState;
        const macroNames = [...state.macroNames];
        macroNames[slotIndex] = name.trim().length === 0 ? definition.label : name.trim();
        this.consumeStateEdit(this.modulationBridge.setState({ ...state, macroNames }));
    }

    private async setEnvelope(sourceId: SourceId, envelope: ModulationEnvelope): ReturnType<CosimoCommands["setEnvelope"]> {
        const definition = this.requireSource(sourceId, "envelope");
        const slotIndex = this.slotIndex(definition);
        const isAmpEnvelope = slotIndex === 3;
        const baseEnvelope = normalizeEnvelope(
            isAmpEnvelope
                ? {
                    ...envelope,
                    name: "Amp Envelope",
                }
                : envelope,
            slotIndex,
        );
        const normalizedEnvelope = isAmpEnvelope
            ? { ...baseEnvelope, name: "Amp Envelope", releaseSeconds: Math.max(0.005, baseEnvelope.releaseSeconds) }
            : baseEnvelope;
        if (!isAmpEnvelope) {
            const accepted = await this.editBank({ ...this.projectedModulationState,
                envelopeSlots: this.projectedModulationState.envelopeSlots.map((slot, index) => index === slotIndex ? { name: normalizedEnvelope.name } : slot),
            });
            if (accepted._tag === "err") return accepted;
            if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        }

        this.runCommand(() => this.writeEnvelopeParameters(definition, normalizedEnvelope));
        return ok(undefined);
    }

    private writeEnvelopeParameters(definition: SourceDefinition, normalizedEnvelope: ModulationEnvelope): void {
        const slotIndex = this.slotIndex(definition);
        const isAmpEnvelope = slotIndex === 3;
        const parameterValues = [
            ["attack", normalizedEnvelope.attackSeconds],
            ["decay", normalizedEnvelope.decaySeconds],
            ["sustain", normalizedEnvelope.sustain],
            ["release", normalizedEnvelope.releaseSeconds],
        ] as const;
        for (const [field, engineValue] of parameterValues) {
            const parsedTarget = parseTargetId(`${isAmpEnvelope ? "ampEnvelope" : `env${slotIndex + 1}`}.${field}`);
            if (parsedTarget._tag === "err") {
                throw parsedTarget.error;
            }
            const descriptor = getTargetDescriptor(parsedTarget.value);
            if (descriptor.binding._tag !== "endpoint") {
                throw new Error(`Envelope target ${descriptor.targetId} has no engine endpoint`);
            }
            this.setParameter({
                targetId: parsedTarget.value,
                value: descriptor.binding.fromEngine(engineValue),
                layer: { _tag: "patchBase" },
            });
        }
    }

    private setMsegMorph(input: Parameters<CosimoCommands["setMsegMorph"]>[0]): void {
        const definition = this.requireSource(input.sourceId, "mseg");
        if (input.layer._tag === "articulationOverride") {
            throw new Error("deferred: per-articulation MSEG morph overrides");
        }
        const slotIndex = this.slotIndex(definition);
        this.msegMorphValues[slotIndex] = clampNormalizedValue(input.morph);
        this.connection.sendEventOrValue?.(`mseg${slotIndex + 1}Morph`, input.morph);
        this.markSnapshotDirty();
    }

    private addArticulation(): ReturnType<CosimoCommands["addArticulation"]> {
        const runtimeSlot = lowestFreeRuntimeSlot(this.articulations);
        if (runtimeSlot === null) {
            return err(new ArticulationSlotsExhausted(ARTICULATION_MAX_SLOTS));
        }
        const usedIds = new Set(this.articulations.slots.map((slot) => slot.id));
        const id = this.uniqueArticulationId(`articulation-${runtimeSlot}`, usedIds);
        const slot: ArticulationSlotV4 = {
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
        this.persistArticulations();
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
        const slot: ArticulationSlotV4 = {
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
        this.persistArticulations();
        this.markSnapshotDirty();
        return ok(articulationIdFromSlot(slot));
    }

    private deleteArticulation(articulationId: ArticulationId): void {
        const slot = this.requireArticulation(articulationId);
        this.articulations = {
            ...this.articulations,
            selectedSlotId: this.articulations.selectedSlotId === slot.id ? null : this.articulations.selectedSlotId,
            slots: this.articulations.slots.filter((candidate) => candidate.id !== slot.id),
        };
        if (this.audition.articulation === articulationId) {
            this.audition = { ...this.audition, articulation: "Default" };
        }
        this.persistArticulations();
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
        this.persistArticulations();
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
        let neighbor: ArticulationSlotV4 | undefined;

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
        this.persistArticulations();
        this.markSnapshotDirty();
        return {
            value,
            touching: neighbor !== undefined,
            neighborId: neighbor === undefined ? null : articulationIdFromSlot(neighbor),
        };
    }

    private setArticulationTriggerMode(mode: ArticulationTriggerMode): void {
        this.articulations = { ...this.articulations, activeTriggerMode: mode };
        this.persistArticulations();
        this.markSnapshotDirty();
    }

    private clearArticulationOverride(targetId: TargetId, articulationId: ArticulationId): void {
        const descriptor = getTargetDescriptor(targetId);
        const slot = this.requireArticulation(articulationId);
        const parameterId = descriptor.articulationParameterId;
        const targetRouteIds = new Set(
            this.collectValidRoutes(this.projectedModulationState)
                .filter((validRoute) => validRoute.targetId === targetId)
                .map((validRoute) => validRoute.route.id),
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
            routeAmounts[mapping.route.id] = specAmountToRouteAmount(
                mapping.descriptor.modAmount,
                mapping.route.targetKind,
                amount,
            );
        }
        this.replaceArticulationSlot({ ...slot, overrides, routeAmounts });
        this.persistArticulations();
        this.markSnapshotDirty();
    }

    private reorderEffect(effectId: EffectModuleId, overEffectId: EffectModuleId): void {
        const knownEffectId = requireEffectId(effectId);
        const knownOverEffectId = requireEffectId(overEffectId);
        const overPath = findLaneDevicePath(
            this.rackState, laneDeviceIdForEffect(knownOverEffectId));
        if (overPath === null) {
            throw new Error(`Rack is missing effect ${knownOverEffectId}`);
        }
        const next = moveLaneDevice(
            this.rackState, laneDeviceIdForEffect(knownEffectId), overPath);
        if (next === null) {
            throw new Error(`Rack is missing effect ${knownEffectId}`);
        }
        this.rackState = next;
        commitLaneStateV2(this.connection, this.rackState);
        this.persistLaneState();
        this.markSnapshotDirty();
    }

    private restoreEffectOrder(effectOrder: ReadonlyArray<EffectModuleId>): void {
        const order = effectOrder.map((effectId) => requireEffectId(effectId));
        // A full-order restore is a serial statement over the DOCUMENT'S own
        // devices (the starter default is a trio, so eight is no longer the
        // universal count): the restored list must restate exactly the
        // devices this document places, in any order.
        const current = this.projectEffectOrder();
        if (order.length !== current.length
                || new Set(order).size !== order.length
                || [...order].sort().join(",") !== [...current].sort().join(",")) {
            throw new Error("Effect order must restate exactly the rack's devices");
        }
        // A full-order restore is a SERIAL statement: any groups dissolve
        // into the stated order, enables and params riding along.
        this.rackState = {
            ...this.rackState,
            chain: order.map((restoredEffectId) => ({
                kind: "device",
                deviceId: laneDeviceIdForEffect(restoredEffectId),
                enabled: getLaneDeviceEnabled(
                    this.rackState, laneDeviceIdForEffect(restoredEffectId)) ?? false,
            })),
        };
        commitLaneStateV2(this.connection, this.rackState);
        this.persistLaneState();
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
        const previous = this.compoundSettings[targetId] ?? { mode: "Free", division: "1/8" };
        const next: CompoundSetting = {
            mode: patch.mode ?? previous.mode,
            division: patch.division ?? previous.division,
        };
        this.compoundSettings = { ...this.compoundSettings, [targetId]: next };
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

    private async captureMotion(): ReturnType<CosimoCommands["captureMotion"]> {
        const candidate = this.audition.captureCandidate;
        if (!candidate) return ok(null);
        const descriptor = getTargetDescriptor(candidate.targetId);
        const definition = SOURCE_DEFINITIONS.find(entry => entry.type === "mseg" && !this.visibleSourceIds.has(entry.idRaw));
        if (!definition) return ok(null);
        const sourceId = sourceIdFromDefinition(definition);
        const parsed = this.mappingRoute({ targetId: descriptor.targetId, sourceId, amount: descriptor.modAmount.max }, definition);
        if (parsed._tag === "err") return parsed;
        const reset = this.resetSourceBank(this.projectedModulationState, definition);
        const accepted = await this.editBank({ ...reset, routes: [...reset.routes, parsed.value.route] });
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        this.runCommand(() => {
            this.visibleSourceIds.add(definition.idRaw);
            this.resetSourceParameters(definition);
            this.routeReducers.set(parsed.value.mappingId, "Max");
            if (this.audition.captureCandidate === candidate) this.audition = {
                ...this.audition, triggerActive: false, captureCandidate: null,
                status: `Captured · ${descriptor.label} · ${definition.label}`,
            };
            this.markSnapshotDirty();
        });
        return ok(sourceId);
    }

    private async reset(): ReturnType<CosimoCommands["reset"]> {
        const modulationState = createDefaultModulationState();
        const accepted = await this.editBank({ ...modulationState, routes: [] });
        if (accepted._tag === "err") return accepted;
        if (!this.sameDocument(accepted.value.scope)) return err(new StateEditRefused(accepted.value.receipt));
        this.runCommand(() => {
            this.parameterValues = createInitialParameterValues();
            this.articulations = createEmptyArticulationsState();
            this.rackState = createInitialLaneState();
            this.compoundSettings = {};
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
            for (let index = 0; index < this.msegMorphValues.length; index += 1) {
                this.msegMorphValues[index] = clampNormalizedValue(0);
                this.connection.sendEventOrValue?.(MSEG_MORPH_ENDPOINT_IDS[index], 0);
            }
            this.routeReducers.clear();
            this.mappingCreationOrder = [];
            this.deletedSourceBackup = null;
            this.persistLaneState();
            commitLaneStateV2(this.connection, this.rackState);
            this.persistArticulations();
            this.uploadAllBoundBaseValues();
            this.markSnapshotDirty();
        });
        return ok(undefined);
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

    private requireMapping(mappingId: MappingId | string): ValidRoute {
        const validRoute = this.collectValidRoutes(this.projectedModulationState)
            .find((candidate) => candidate.route.id === mappingId);
        if (validRoute !== undefined) {
            return validRoute;
        }
        throw new Error(`Unknown mapping id: ${mappingId}`);
    }

    private requireArticulation(articulationId: ArticulationId): ArticulationSlotV4 {
        const slot = this.articulations.slots.find((candidate) => candidate.id === articulationId);
        if (slot === undefined) {
            throw new Error(`Unknown articulation id: ${articulationId}`);
        }
        return slot;
    }

    private replaceArticulationSlot(nextSlot: ArticulationSlotV4): void {
        this.articulations = {
            ...this.articulations,
            slots: this.articulations.slots.map((slot) => slot.id === nextSlot.id ? nextSlot : slot),
        };
    }

    private collectArticulationMappingIds(
        validRoutes = this.collectValidRoutes(this.projectedModulationState),
    ): ReadonlySet<string> {
        return new Set(validRoutes.flatMap((validRoute) => (
            getModulationArticulationCellIndex(validRoute.route) === null
                ? []
                : [validRoute.route.id]
        )));
    }

    private slotIndex(definition: SourceDefinition): number {
        if (definition.slot === null) {
            throw new Error(`Fixed source ${definition.idRaw} has no slot index`);
        }
        return definition.slot - 1;
    }

    private uploadAllBoundBaseValues(): void {
        for (const descriptor of allTargetDescriptors()) {
            if (descriptor.binding._tag !== "endpoint") {
                continue;
            }
            if (getRackParameterDescriptor(descriptor.binding.endpointId) !== null) {
                // Effect parameters have no host endpoints: their values ride
                // the lane document's record uploads (commitLaneState).
                continue;
            }
            const value = this.parameterValues[descriptor.targetId];
            if (value === undefined) {
                throw new Error(`Patch base is missing target ${descriptor.targetId}`);
            }
            this.connection.sendEventOrValue?.(descriptor.binding.endpointId, descriptor.binding.toEngine(value));
        }
    }

    private persistArticulations(): void {
        this.sendStoredStateValue(
            ARTICULATIONS_V4_STATE_KEY,
            JSON.stringify(serializeArticulationsV4(this.articulations)),
        );
    }

    private persistLaneState(): void {
        this.sendStoredStateValue(LANE_STATE_KEY, serializeLaneStateV2(this.rackState));
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
