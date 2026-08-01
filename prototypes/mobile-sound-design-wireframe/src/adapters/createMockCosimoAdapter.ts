import {
    ArticulationSlotsExhausted,
    MappingAlreadyExists,
    ROUTE_BUDGET,
    RouteBudgetExceeded,
    SourceSlotsExhausted,
    type ArticulationLayerBackup,
    type ArticulationView,
    type AuditionState,
    type CompoundSetting,
    type CosimoAdapterPort,
    type CosimoCommands,
    type EditLayer,
    type ModulationMapping,
    type ModulationSource,
    type PatchSnapshot,
    type SourceState,
    type SourceType,
} from "../../../../ui/shared/cosimo-adapter-port";
import {
    clampNormalizedValue,
    makeMappingId,
    type ArticulationId,
    type MappingId,
    type NormalizedValue,
    type SourceId,
    type TargetId,
} from "../../../../ui/shared/cosimo-ids";
import type { ModulationEnvelope, ModulationMsegSlot } from "../../../../ui/shared/modulation";
import type { MsegPlayback, MsegShape } from "../../../../ui/shared/mseg";
import { err, ok } from "../../../../ui/shared/result";
import {
    allTargetDescriptors,
    getTargetDescriptor,
    parseTargetId,
    type EffectModuleId,
} from "../../../../ui/shared/target-descriptor";
import { FIXED_SOURCES } from "../domain/catalog.js";
import { createInitialMockCosimoState } from "../domain/fixtures.js";
import {
    clampArticulationRange,
    createMapping,
    createSourceIdentity,
    duplicateArticulationIdentity,
    firstAvailableSourceSlot,
    nextArticulationIdentity,
    SOURCE_LIMITS,
    walkArticulationKey,
} from "../domain/policies.js";
import { mockCosimoReducer } from "./mockCosimoReducer.js";

const ARTICULATION_SLOT_LIMIT = 128;

type PrototypeEditLayer =
    | { readonly kind: "patchBase" }
    | { readonly kind: "articulationOverride"; readonly articulationId: string };

type PrototypeSourceState =
    | { readonly _tag: "macro"; readonly value: number; readonly name: string }
    | { readonly _tag: "envelope"; readonly envelope: ModulationEnvelope }
    | { readonly _tag: "mseg"; readonly slot: ModulationMsegSlot }
    | { readonly _tag: "fixed" };

type PrototypeSource = {
    readonly id: string;
    readonly type: SourceType;
    readonly slot: number | null;
    readonly label: string;
};

type PrototypeMapping = {
    readonly id: string;
    readonly targetKey: string;
    readonly sourceId: string;
    readonly amount: number;
    readonly polarity: "Unipolar" | "Bipolar";
    readonly reducer: "Max" | "Mean";
    readonly enabled: boolean;
};

type PrototypeArticulation = {
    readonly id: string;
    readonly label: string;
    readonly color: string;
    readonly icon: string;
    readonly selector: number;
    readonly key: number;
    readonly vel: ReadonlyArray<number>;
    readonly chain: ReadonlyArray<number>;
};

type PrototypeCaptureCandidate = {
    readonly targetKey: string;
    readonly layer: string;
    readonly articulation: string;
};

type PrototypeState = {
    readonly patch: {
        readonly parameterValues: Readonly<Record<string, number>>;
        readonly mappings: ReadonlyArray<PrototypeMapping>;
        readonly sources: ReadonlyArray<PrototypeSource>;
        readonly sourceStates: Readonly<Record<string, PrototypeSourceState>>;
        readonly effectOrder: ReadonlyArray<string>;
        readonly effectEnabled: Readonly<Record<string, boolean>>;
        readonly compoundSettings: Readonly<Record<string, CompoundSetting>>;
        readonly articulations: ReadonlyArray<PrototypeArticulation>;
        readonly articulationTriggerMode: "chain" | "key" | "vel";
        readonly articulationOverrides: Readonly<Record<string, Readonly<Record<string, number>>>>;
        readonly articulationMappingAmounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
    };
    readonly audition: {
        readonly articulation: string;
        readonly note: string;
        readonly repeat: boolean;
        readonly latch: boolean;
        readonly triggerActive: boolean;
        readonly captureCandidate: PrototypeCaptureCandidate | null;
        readonly status: string;
    };
    readonly undo: unknown;
};

type PrototypeAction = Readonly<{
    type: string;
    [field: string]: unknown;
}>;

type CreateInitialPrototypeState = typeof createInitialMockCosimoState;

type CreateMockCosimoAdapterOptions = {
    readonly createInitialState?: CreateInitialPrototypeState;
};

function initialPrototypeState(createInitialState: CreateInitialPrototypeState): PrototypeState {
    // SAFETY: this option accepts only the repository's reducer-state fixture
    // factories. PrototypeState narrows the JS constructors to the fields and
    // finite variants consumed by this adapter boundary.
    return createInitialState() as PrototypeState;
}

function reducePrototypeState(state: PrototypeState, action: PrototypeAction): PrototypeState {
    // SAFETY: mockCosimoReducer preserves the state shape constructed by
    // createInitialMockCosimoState; actions are private to this adapter.
    return mockCosimoReducer(state, action) as PrototypeState;
}

function requireTargetId(rawTargetId: string): TargetId {
    const parsed = parseTargetId(rawTargetId);
    if (parsed._tag === "err") {
        throw new Error(`Prototype target is absent from the port catalog: ${rawTargetId}`);
    }
    return parsed.value;
}

function knownTargetId(rawTargetId: string): TargetId | null {
    const parsed = parseTargetId(rawTargetId);
    return parsed._tag === "ok" ? parsed.value : null;
}

function sourceIdFromKnownIdentity(rawSourceId: string): SourceId {
    // SAFETY: callers use this helper only for identities found in the
    // authoritative prototype source collection or minted by its slot policy.
    return rawSourceId as SourceId;
}

function articulationIdFromKnownIdentity(rawArticulationId: string): ArticulationId {
    // SAFETY: callers use this helper only for identities found in the
    // authoritative articulation bank or minted by its identity policy.
    return rawArticulationId as ArticulationId;
}

function requireEffectModuleId(rawEffectId: string): EffectModuleId {
    switch (rawEffectId) {
        case "filter":
        case "drive":
        case "ott":
        case "chorus":
        case "flanger":
        case "phaser":
        case "delay":
        case "reverb":
            return rawEffectId;
        default:
            throw new Error(`Unknown effect id: ${rawEffectId}`);
    }
}

function requireSourceType(rawSourceType: string): SourceType {
    switch (rawSourceType) {
        case "macro":
        case "envelope":
        case "mseg":
        case "fixed":
            return rawSourceType;
        default:
            throw new Error(`Unknown source type: ${rawSourceType}`);
    }
}

function requireSource(state: PrototypeState, sourceId: SourceId | string): PrototypeSource {
    const rawSourceId = String(sourceId);
    const source = [...state.patch.sources, ...FIXED_SOURCES]
        .find((candidate) => candidate.id === rawSourceId);
    if (!source) {
        throw new Error(`Unknown source id: ${rawSourceId}`);
    }
    return {
        id: source.id,
        type: requireSourceType(source.type),
        slot: source.slot,
        label: source.label,
    };
}

function requireSourceState(
    state: PrototypeState,
    sourceId: SourceId,
    expectedTag: PrototypeSourceState["_tag"],
): PrototypeSourceState {
    const source = requireSource(state, sourceId);
    const sourceState = state.patch.sourceStates[source.id];
    if (!sourceState || sourceState._tag !== expectedTag) {
        throw new Error(`Source ${source.id} does not have ${expectedTag} state`);
    }
    return sourceState;
}

function requireMapping(state: PrototypeState, mappingId: MappingId | string): PrototypeMapping {
    const rawMappingId = String(mappingId);
    const mapping = state.patch.mappings.find((candidate) => candidate.id === rawMappingId);
    if (!mapping) {
        throw new Error(`Unknown mapping id: ${rawMappingId}`);
    }
    return mapping;
}

function requireArticulation(
    state: PrototypeState,
    articulationId: ArticulationId | string,
): PrototypeArticulation {
    const rawArticulationId = String(articulationId);
    const articulation = state.patch.articulations
        .find((candidate) => candidate.id === rawArticulationId);
    if (!articulation) {
        throw new Error(`Unknown articulation id: ${rawArticulationId}`);
    }
    return articulation;
}

function toPrototypeLayer(state: PrototypeState, layer: EditLayer): PrototypeEditLayer {
    if (layer._tag === "patchBase") return { kind: "patchBase" };
    const articulation = requireArticulation(state, layer.articulationId);
    return { kind: "articulationOverride", articulationId: articulation.id };
}

function internalPercentage(value: NormalizedValue): number {
    return Number(value) * 100;
}

function projectSourceState(sourceState: PrototypeSourceState): SourceState {
    switch (sourceState._tag) {
        case "macro":
            return {
                _tag: "macro",
                value: clampNormalizedValue(sourceState.value),
                name: sourceState.name,
            };
        case "envelope":
            return {
                _tag: "envelope",
                envelope: {
                    name: sourceState.envelope.name,
                    attackSeconds: sourceState.envelope.attackSeconds,
                    decaySeconds: sourceState.envelope.decaySeconds,
                    sustain: sourceState.envelope.sustain,
                    releaseSeconds: sourceState.envelope.releaseSeconds,
                },
            };
        case "mseg":
            return {
                _tag: "mseg",
                slot: sourceState.slot,
            };
        case "fixed":
            return { _tag: "fixed" };
    }
}

function projectParameterValues(
    parameterValues: Readonly<Record<string, number>>,
    includeCatalogDefaults = false,
): Readonly<Record<TargetId, NormalizedValue>> {
    const projected = new Map<TargetId, NormalizedValue>();
    if (includeCatalogDefaults) {
        for (const descriptor of allTargetDescriptors()) {
            projected.set(descriptor.targetId, descriptor.initialValue);
        }
    }
    for (const [rawTargetId, value] of Object.entries(parameterValues)) {
        const targetId = knownTargetId(rawTargetId);
        if (targetId !== null) {
            projected.set(targetId, clampNormalizedValue(value / 100));
        }
    }
    return Object.fromEntries(projected);
}

function projectArticulationOverrides(
    state: PrototypeState,
    articulationIds: ReadonlyMap<string, ArticulationId>,
): PatchSnapshot["patch"]["articulationOverrides"] {
    return Object.fromEntries(
        Object.entries(state.patch.articulationOverrides).map(([rawArticulationId, values]) => {
            const articulationId = articulationIds.get(rawArticulationId);
            if (!articulationId) {
                throw new Error(`Override layer has unknown articulation: ${rawArticulationId}`);
            }
            return [articulationId, projectParameterValues(values)];
        }),
    );
}

function projectArticulationMappingAmounts(
    state: PrototypeState,
    articulationIds: ReadonlyMap<string, ArticulationId>,
    mappingIds: ReadonlyMap<string, MappingId>,
): PatchSnapshot["patch"]["articulationMappingAmounts"] {
    return Object.fromEntries(
        Object.entries(state.patch.articulationMappingAmounts)
            .map(([rawArticulationId, amounts]) => {
                const articulationId = articulationIds.get(rawArticulationId);
                if (!articulationId) {
                    throw new Error(`Mapping layer has unknown articulation: ${rawArticulationId}`);
                }
                const projectedAmounts = Object.fromEntries(
                    Object.entries(amounts).map(([rawMappingId, amount]) => {
                        const mappingId = mappingIds.get(rawMappingId);
                        if (!mappingId) {
                            throw new Error(`Mapping layer has orphaned mapping: ${rawMappingId}`);
                        }
                        return [mappingId, amount];
                    }),
                );
                return [articulationId, projectedAmounts];
            }),
    );
}

function projectCompoundSettings(
    compoundSettings: Readonly<Record<string, CompoundSetting>>,
): PatchSnapshot["patch"]["compoundSettings"] {
    const projected: Array<readonly [TargetId, CompoundSetting]> = [];
    for (const [rawTargetId, setting] of Object.entries(compoundSettings)) {
        const targetId = knownTargetId(rawTargetId);
        if (targetId !== null) {
            projected.push([targetId, { mode: setting.mode, division: setting.division }]);
        }
    }
    return Object.fromEntries(projected);
}

function projectEffectEnabled(
    effectEnabled: Readonly<Record<string, boolean>>,
): PatchSnapshot["patch"]["effectEnabled"] {
    const requireEnabled = (effectId: EffectModuleId): boolean => {
        const enabled = effectEnabled[effectId];
        if (typeof enabled !== "boolean") {
            throw new Error(`Effect ${effectId} has no enabled state`);
        }
        return enabled;
    };
    return {
        filter: requireEnabled("filter"),
        drive: requireEnabled("drive"),
        ott: requireEnabled("ott"),
        chorus: requireEnabled("chorus"),
        flanger: requireEnabled("flanger"),
        phaser: requireEnabled("phaser"),
        delay: requireEnabled("delay"),
        reverb: requireEnabled("reverb"),
    };
}

function projectArticulationRange(range: ReadonlyArray<number>): { readonly min: number; readonly max: number } {
    const min = range[0];
    const max = range[1];
    if (min === undefined || max === undefined) {
        throw new Error("Articulation range must contain min and max values");
    }
    return { min, max };
}

function projectSnapshot(state: PrototypeState): PatchSnapshot {
    const sourceIds = new Map<string, SourceId>();
    const sources: Array<ModulationSource> = [];
    for (const source of [...state.patch.sources, ...FIXED_SOURCES]) {
        const sourceId = sourceIdFromKnownIdentity(source.id);
        const sourceType = requireSourceType(source.type);
        const sourceState = state.patch.sourceStates[source.id];
        if (!sourceState) {
            throw new Error(`Source ${source.id} has no source state`);
        }
        sourceIds.set(source.id, sourceId);
        sources.push({
            id: sourceId,
            type: sourceType,
            slot: source.slot,
            label: source.label,
            state: projectSourceState(sourceState),
        });
    }

    const mappings: Array<ModulationMapping> = [];
    const mappingIds = new Map<string, MappingId>();
    for (const mapping of state.patch.mappings) {
        const targetId = requireTargetId(mapping.targetKey);
        const sourceId = sourceIds.get(mapping.sourceId);
        if (!sourceId) {
            throw new Error(`Mapping ${mapping.id} has unknown source ${mapping.sourceId}`);
        }
        const mappingId = makeMappingId(targetId, sourceId);
        if (String(mappingId) !== mapping.id) {
            throw new Error(`Mapping id does not match its pair: ${mapping.id}`);
        }
        mappingIds.set(mapping.id, mappingId);
        mappings.push({
            id: mappingId,
            targetId,
            sourceId,
            amount: mapping.amount,
            polarity: mapping.polarity,
            reducer: mapping.reducer,
            enabled: mapping.enabled,
        });
    }

    const articulationIds = new Map<string, ArticulationId>();
    const articulations: Array<ArticulationView> = state.patch.articulations.map((articulation) => {
        const articulationId = articulationIdFromKnownIdentity(articulation.id);
        articulationIds.set(articulation.id, articulationId);
        return {
            id: articulationId,
            label: articulation.label,
            color: articulation.color,
            icon: articulation.icon,
            selector: articulation.selector,
            key: articulation.key,
            velRange: projectArticulationRange(articulation.vel),
            chainRange: projectArticulationRange(articulation.chain),
        };
    });

    let auditionArticulation: ArticulationId | "Default";
    if (state.audition.articulation === "Default") {
        auditionArticulation = "Default";
    } else {
        const articulationId = articulationIds.get(state.audition.articulation);
        if (!articulationId) {
            throw new Error(`Audition has unknown articulation: ${state.audition.articulation}`);
        }
        auditionArticulation = articulationId;
    }

    const captureCandidate = state.audition.captureCandidate === null
        ? null
        : {
              targetId: requireTargetId(state.audition.captureCandidate.targetKey),
              sourceId: null,
          };
    const audition: AuditionState = {
        articulation: auditionArticulation,
        note: state.audition.note,
        repeat: state.audition.repeat,
        latch: state.audition.latch,
        triggerActive: state.audition.triggerActive,
        captureCandidate,
        status: state.audition.status,
    };

    return {
        connection: { _tag: "ready" },
        patch: {
            parameterValues: projectParameterValues(state.patch.parameterValues, true),
            mappings,
            sources,
            effectOrder: state.patch.effectOrder.map(requireEffectModuleId),
            effectEnabled: projectEffectEnabled(state.patch.effectEnabled),
            compoundSettings: projectCompoundSettings(state.patch.compoundSettings),
            articulations,
            articulationTriggerMode: state.patch.articulationTriggerMode,
            articulationOverrides: projectArticulationOverrides(state, articulationIds),
            articulationMappingAmounts: projectArticulationMappingAmounts(
                state,
                articulationIds,
                mappingIds,
            ),
        },
        audition,
    };
}

function availableArticulationSelector(
    articulations: ReadonlyArray<PrototypeArticulation>,
    preferred: number,
): number | null {
    const occupied = new Set(articulations.map((articulation) => articulation.selector));
    if (preferred >= 0 && preferred < ARTICULATION_SLOT_LIMIT && !occupied.has(preferred)) {
        return preferred;
    }
    for (let selector = 0; selector < ARTICULATION_SLOT_LIMIT; selector += 1) {
        if (!occupied.has(selector)) return selector;
    }
    return null;
}

/**
 * Create the framework-free in-memory implementation of the Cosimo adapter port.
 *
 * State transitions remain owned by the prototype reducer; this boundary owns
 * port policy, branded identities, real-unit projection, caching, and subscriptions.
 */
export function createMockCosimoAdapter({
    createInitialState = createInitialMockCosimoState,
}: CreateMockCosimoAdapterOptions = {}): CosimoAdapterPort {
    let state = initialPrototypeState(createInitialState);
    let snapshot = projectSnapshot(state);
    const listeners = new Set<() => void>();

    const dispatch = (action: PrototypeAction): void => {
        const nextState = reducePrototypeState(state, action);
        if (nextState === state) return;
        state = nextState;
        snapshot = projectSnapshot(state);
        for (const listener of listeners) listener();
    };

    const commands: CosimoCommands = {
        setParameter({ targetId, value, layer }) {
            const knownTargetId = requireTargetId(String(targetId));
            dispatch({
                type: "SET_PARAMETER",
                targetId: String(knownTargetId),
                value: internalPercentage(value),
                layer: toPrototypeLayer(state, layer),
            });
        },

        addMapping(input) {
            const targetId = requireTargetId(String(input.targetId));
            const source = requireSource(state, input.sourceId);
            if (state.patch.mappings.length >= ROUTE_BUDGET) {
                return err(new RouteBudgetExceeded(ROUTE_BUDGET));
            }
            const sourceId = sourceIdFromKnownIdentity(source.id);
            const mappingId = makeMappingId(targetId, sourceId);
            if (state.patch.mappings.some((mapping) => mapping.id === String(mappingId))) {
                return err(new MappingAlreadyExists(mappingId));
            }
            const amountSpec = getTargetDescriptor(targetId).modAmount;
            const requestedAmount = input.amount
                ?? Math.max(Math.abs(amountSpec.min), Math.abs(amountSpec.max)) * 0.25;
            const amount = Math.min(amountSpec.max, Math.max(amountSpec.min, requestedAmount));
            const mapping = createMapping(
                String(targetId),
                source.id,
                amount,
                input.polarity ?? "Unipolar",
                input.reducer ?? "Max",
            );
            dispatch({ type: "ADD_MAPPING", mapping });
            return ok(mappingId);
        },

        removeMapping(mappingId) {
            const mapping = requireMapping(state, mappingId);
            dispatch({ type: "REMOVE_MAPPING", mappingId: mapping.id });
        },

        setMappingAmount(mappingId, amount, layer) {
            const mapping = requireMapping(state, mappingId);
            dispatch({
                type: "SET_PORT_MAPPING_AMOUNT",
                mappingId: mapping.id,
                amount,
                layer: toPrototypeLayer(state, layer),
            });
        },

        setMappingEnabled(mappingId, enabled) {
            const mapping = requireMapping(state, mappingId);
            dispatch({
                type: "SET_MAPPING_FIELD",
                mappingId: mapping.id,
                field: "enabled",
                value: enabled,
            });
        },

        setMappingPolarity(mappingId, polarity) {
            const mapping = requireMapping(state, mappingId);
            dispatch({
                type: "SET_MAPPING_FIELD",
                mappingId: mapping.id,
                field: "polarity",
                value: polarity,
            });
        },

        setMappingReducer(mappingId, reducer) {
            const mapping = requireMapping(state, mappingId);
            dispatch({
                type: "SET_MAPPING_FIELD",
                mappingId: mapping.id,
                field: "reducer",
                value: reducer,
            });
        },

        createSource(type) {
            const slot = firstAvailableSourceSlot(state.patch.sources, type);
            if (slot === null) {
                return err(new SourceSlotsExhausted(type, SOURCE_LIMITS[type]));
            }
            const source = createSourceIdentity(type, slot);
            if (!source) {
                throw new Error(`Could not mint ${type} source in slot ${slot}`);
            }
            dispatch({ type: "CREATE_SOURCE", source });
            return ok(sourceIdFromKnownIdentity(source.id));
        },

        deleteSource(sourceId) {
            const source = requireSource(state, sourceId);
            dispatch({ type: "DELETE_SOURCE", sourceId: source.id });
        },

        undoDeleteSource() {
            dispatch({ type: "UNDO_DELETE_SOURCE" });
        },

        setMacroValue(sourceId, value) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "macro");
            dispatch({ type: "SET_MACRO_VALUE", sourceId: source.id, value: Number(value) });
        },

        renameMacro(sourceId, name) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "macro");
            dispatch({ type: "RENAME_MACRO", sourceId: source.id, name });
        },

        setEnvelope(sourceId, envelope) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "envelope");
            dispatch({ type: "SET_ENVELOPE", sourceId: source.id, envelope });
        },

        setMsegShape({ sourceId, shapeIndex, shape }) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "mseg");
            dispatch({ type: "SET_MSEG_SHAPE", sourceId: source.id, shapeIndex, shape });
        },

        setMsegMorph({ sourceId, morph, layer }) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "mseg");
            dispatch({
                type: "SET_MSEG_MORPH",
                sourceId: source.id,
                morph: Number(morph),
                layer: toPrototypeLayer(state, layer),
            });
        },

        setMsegPlayback({ sourceId, playback }) {
            const source = requireSource(state, sourceId);
            requireSourceState(state, sourceId, "mseg");
            dispatch({ type: "SET_MSEG_PLAYBACK", sourceId: source.id, playback });
        },

        addArticulation() {
            const identity = nextArticulationIdentity(state.patch.articulations);
            const selector = availableArticulationSelector(state.patch.articulations, identity.selector);
            if (selector === null) {
                return err(new ArticulationSlotsExhausted(ARTICULATION_SLOT_LIMIT));
            }
            const articulation = { ...identity, selector };
            dispatch({ type: "ADD_ARTICULATION", articulation });
            return ok(articulationIdFromKnownIdentity(articulation.id));
        },

        duplicateArticulation(articulationId) {
            const source = requireArticulation(state, articulationId);
            const identity = duplicateArticulationIdentity(state.patch.articulations, source);
            const selector = availableArticulationSelector(state.patch.articulations, identity.selector);
            if (selector === null) {
                return err(new ArticulationSlotsExhausted(ARTICULATION_SLOT_LIMIT));
            }
            const articulation = { ...identity, selector };
            dispatch({
                type: "ADD_ARTICULATION",
                articulation,
                copyOverridesFrom: source.id,
            });
            return ok(articulationIdFromKnownIdentity(articulation.id));
        },

        deleteArticulation(articulationId) {
            const articulation = requireArticulation(state, articulationId);
            dispatch({ type: "DELETE_ARTICULATION", articulationId: articulation.id });
        },

        setArticulationKey(articulationId, wantKey) {
            const articulation = requireArticulation(state, articulationId);
            const outcome = walkArticulationKey(
                state.patch.articulations,
                articulation.id,
                wantKey,
            );
            if (!outcome) {
                throw new Error(`Could not walk articulation key: ${articulation.id}`);
            }
            dispatch({
                type: "SET_ARTICULATION_KEY",
                articulationId: articulation.id,
                key: outcome.key,
            });
            return {
                key: outcome.key,
                touching: outcome.touching,
                neighborId: outcome.neighborId === null
                    ? null
                    : articulationIdFromKnownIdentity(
                          requireArticulation(state, outcome.neighborId).id,
                      ),
            };
        },

        setArticulationRange(articulationId, mode, bound, value) {
            const articulation = requireArticulation(state, articulationId);
            const prototypeBound = bound === "min" ? "lo" : "hi";
            const outcome = clampArticulationRange(
                state.patch.articulations,
                articulation.id,
                mode,
                prototypeBound,
                value,
            );
            if (!outcome) {
                throw new Error(`Could not clamp articulation range: ${articulation.id}`);
            }
            dispatch({
                type: "SET_ARTICULATION_RANGE",
                articulationId: articulation.id,
                mode,
                bound: prototypeBound,
                value: outcome.value,
            });
            return {
                value: outcome.value,
                touching: outcome.touching,
                neighborId: outcome.neighborId === null
                    ? null
                    : articulationIdFromKnownIdentity(
                          requireArticulation(state, outcome.neighborId).id,
                      ),
            };
        },

        setArticulationTriggerMode(mode) {
            dispatch({ type: "SET_ARTICULATION_TRIGGER_MODE", mode });
        },

        clearArticulationOverride(targetId, articulationId) {
            const target = requireTargetId(String(targetId));
            const articulation = requireArticulation(state, articulationId);
            dispatch({
                type: "CLEAR_ARTICULATION_OVERRIDE",
                targetId: String(target),
                articulationId: articulation.id,
            });
        },

        clearArticulationBaseOverride(targetId, articulationId) {
            const target = requireTargetId(String(targetId));
            const articulation = requireArticulation(state, articulationId);
            dispatch({
                type: "CLEAR_ARTICULATION_BASE_OVERRIDE",
                targetId: String(target),
                articulationId: articulation.id,
            });
        },

        clearArticulationMappingAmount(mappingId, articulationId) {
            const mapping = requireMapping(state, mappingId);
            const articulation = requireArticulation(state, articulationId);
            dispatch({
                type: "CLEAR_ARTICULATION_MAPPING_AMOUNT",
                mappingId: mapping.id,
                articulationId: articulation.id,
            });
        },

        restoreArticulationLayer(articulationId, backup) {
            const articulation = requireArticulation(state, articulationId);
            const overrides = Object.fromEntries(
                Object.entries(backup.overrides).map(([rawTargetId, value]) => [
                    String(requireTargetId(rawTargetId)),
                    internalPercentage(value),
                ]),
            );
            const mappingAmounts = Object.fromEntries(
                Object.entries(backup.mappingAmounts).map(([rawMappingId, amount]) => {
                    const mapping = requireMapping(state, rawMappingId);
                    return [mapping.id, amount];
                }),
            );
            dispatch({
                type: "RESTORE_ARTICULATION_LAYER",
                articulationId: articulation.id,
                overrides,
                mappingAmounts,
            });
        },

        setEffectEnabled(effectId, enabled) {
            const knownEffectId = requireEffectModuleId(effectId);
            dispatch({ type: "SET_EFFECT_ENABLED", effectId: knownEffectId, enabled });
        },

        reorderEffect(effectId, overEffectId) {
            const knownEffectId = requireEffectModuleId(effectId);
            const knownOverEffectId = requireEffectModuleId(overEffectId);
            dispatch({
                type: "REORDER_EFFECT",
                effectId: knownEffectId,
                overEffectId: knownOverEffectId,
            });
        },

        restoreEffectOrder(effectOrder) {
            dispatch({
                type: "RESTORE_EFFECT_ORDER",
                effectOrder: effectOrder.map(requireEffectModuleId),
            });
        },

        setCompoundSetting(targetId, patch) {
            const target = requireTargetId(String(targetId));
            dispatch({ type: "SET_COMPOUND_SETTING", targetId: String(target), patch });
        },

        setAuditionArticulation(articulationId) {
            if (articulationId === "Default") {
                dispatch({ type: "SET_AUDITION_ARTICULATION", articulationId });
                return;
            }
            const articulation = requireArticulation(state, articulationId);
            dispatch({ type: "SET_AUDITION_ARTICULATION", articulationId: articulation.id });
        },

        setAuditionNote(note) {
            dispatch({ type: "SET_AUDITION_NOTE", note });
        },

        setRepeatEnabled(enabled) {
            dispatch({ type: "SET_REPEAT", enabled });
        },

        setLatchEnabled(enabled) {
            dispatch({ type: "SET_LATCH", enabled });
        },

        beginTrigger() {
            dispatch({ type: "BEGIN_TRIGGER" });
        },

        endTrigger() {
            dispatch({ type: "END_TRIGGER" });
        },

        cancelTrigger() {
            dispatch({ type: "CANCEL_TRIGGER" });
        },

        captureMotion() {
            const candidate = state.audition.captureCandidate;
            if (!candidate) return null;
            const slot = firstAvailableSourceSlot(state.patch.sources, "mseg");
            const source = createSourceIdentity("mseg", slot);
            const targetId = requireTargetId(candidate.targetKey);
            const amount = getTargetDescriptor(targetId).modAmount.max;
            dispatch({ type: "CAPTURE_MOTION", source, amount });
            return source === null ? null : sourceIdFromKnownIdentity(source.id);
        },

        reset() {
            // Reset returns to THIS adapter's initial state (the composition
            // root decides what a fresh patch is), not the reducer's baked
            // demo fixture.
            state = initialPrototypeState(createInitialState);
            snapshot = projectSnapshot(state);
            for (const listener of listeners) listener();
        },
    };

    return {
        getSnapshot: () => snapshot,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        commands,
    };
}
