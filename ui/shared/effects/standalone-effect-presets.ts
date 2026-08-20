import type { PatchConnectionLike } from "../cmajor-react";
import {
    buildPluginStateContract,
    canonicalJSONStringify,
    clonePluginStateContract,
    type EffectParameterContract,
    type EffectParameterValue,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import {
    applyEffectPresetV2,
    captureEffectPresetV2,
    cloneEffectPresetV2,
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    normalizeEffectPresetV2,
    parseEffectPresetV2Text,
    type EffectPresetMigration,
    type EffectPresetV2,
    type EffectStoredStateContext,
    type EffectStoredStateAdapter,
} from "./effect-preset-v2";
import {
    EFFECT_FACTORY_PRESETS,
} from "./effect-preset-descriptors";
import type { EffectPreset } from "./effect-preset-schema";
import {
    createActivePresetMetadataFromPresetV2,
    EffectPresetRuntimeBridgeV2,
    type EffectPresetStateV2,
} from "./effect-preset-store-v2";

export type StandaloneEffectPresetSource = "factory" | "user";
export type StandaloneEffectPresetSourceFilter = "all" | StandaloneEffectPresetSource;

export type StandaloneEffectPresetFilter = {
    query: string;
    source: StandaloneEffectPresetSourceFilter;
};

export type StandaloneEffectPresetListItem = {
    presetKey: string;
    presetID: string;
    label: string;
    effectID: string;
    source: StandaloneEffectPresetSource;
    preset: EffectPresetV2;
    isActive: boolean;
    dirty: boolean;
    canApply: boolean;
    canRename: boolean;
    canOverwrite: boolean;
    canDelete: boolean;
    canExport: boolean;
};

export type StandaloneEffectPresetState = {
    effectID: string;
    ready: boolean;
    filter: StandaloneEffectPresetFilter;
    presets: StandaloneEffectPresetListItem[];
    visiblePresets: StandaloneEffectPresetListItem[];
    factoryPresets: StandaloneEffectPresetListItem[];
    userPresets: StandaloneEffectPresetListItem[];
    activePreset: {
        presetID: string;
        label: string;
        dirty: boolean;
    } | null;
    activePresetID: string | null;
    activeLabel: string;
    dirty: boolean;
    currentValues: Record<string, EffectParameterValue>;
    missingCurrentValueEndpointIDs: string[];
    currentContract: EffectPluginStateContract | null;
    lastError: string | null;
    supportsInit: boolean;
    pendingSoundReplacement: StandaloneEffectPendingSoundReplacement | null;
};

export type StandaloneEffectPresetMutationResult<T> = {
    ok: true;
    value: T;
    message: string;
} | {
    ok: false;
    error: Error;
    message: string;
} | {
    ok: false;
    actionRequired: "confirm-sound-replacement" | "save-as-for-sound-replacement";
    message: string;
};

/** Public identity of a sound replacement waiting for the unsaved-work decision. */
export type StandaloneEffectPendingSoundReplacement =
    | { readonly kind: "init" }
    | { readonly kind: "preset"; readonly presetKey: string }
    | { readonly kind: "import"; readonly presetID: string };

export type StandaloneEffectFactoryPreset = EffectPresetV2 | EffectPreset;

/** One sound-owned document absent from the ordinary preset contract but required by Init. */
export type StandaloneEffectInitOnlyStateAdapter = {
    readonly key: string;
    capture: () => unknown;
    createDefaultValue: () => unknown;
    normalizeForTransaction: (value: unknown, context?: EffectStoredStateContext) => unknown;
    serializeForTransaction: (value: unknown, context?: EffectStoredStateContext) => unknown;
    apply: (value: unknown, context?: EffectStoredStateContext) => void;
    subscribe?: (listener: () => void) => () => void;
};

/** Synth-only policy that enables canonical Init and guarded sound replacement. */
export type StandaloneEffectPresetSynthOptions = {
    createCanonicalStoredState: (currentContract: EffectPluginStateContract) => Readonly<Record<string, unknown>>;
    initOnlyStateAdapters?: ReadonlyArray<StandaloneEffectInitOnlyStateAdapter>;
};

export type StandaloneEffectPresetControllerOptions = {
    effectID: string;
    patchConnection: PatchConnectionLike;
    factoryPresets?: Record<string, StandaloneEffectFactoryPreset[]>;
    storedStateAdapters?: EffectStoredStateAdapter[];
    /**
     * Contract migrations for stored presets. The function form derives them
     * from the live contract, for migrations whose source hash is only
     * computable once the current parameter manifest is known (e.g. an
     * appended parameter whose legacy contract is the current one minus it).
     */
    presetMigrations?:
        | EffectPresetMigration[]
        | ((currentContract: EffectPluginStateContract) => EffectPresetMigration[]);
    createPresetID?: (context: {
        effectID: string;
        label: string;
        attempt: number;
    }) => string;
    readClipboardText?: () => string | Promise<string>;
    writeClipboardText?: (text: string) => void | Promise<void>;
    synth?: StandaloneEffectPresetSynthOptions;

    // Kept only so older callers fail by behavior, not by TypeScript shape.
    descriptorRegistry?: unknown;
};

export type StandaloneEffectPresetImportOptions = {
    applyAfterImport?: boolean;
    overwriteExisting?: boolean;
    copyOnIDConflict?: boolean;
};

type StandaloneEffectPresetStateListener = (state: StandaloneEffectPresetState) => void;

type ResolvedPreset = {
    source: StandaloneEffectPresetSource;
    preset: EffectPresetV2;
};

type PreparedSoundReplacement = {
    readonly pending: StandaloneEffectPendingSoundReplacement;
    readonly successMessage: string;
    readonly apply: () => EffectPresetV2;
};

type PreparedInitOnlyStateValue = {
    readonly adapter: StandaloneEffectInitOnlyStateAdapter;
    readonly serialized: unknown;
    readonly value: unknown;
};

type SoundRollbackOperation =
    | { readonly kind: "parameter"; readonly endpointID: string }
    | { readonly kind: "stored-state"; readonly key: string; readonly adapter?: EffectStoredStateAdapter }
    | { readonly kind: "init-only"; readonly adapter: StandaloneEffectInitOnlyStateAdapter };

type SuppressedParameterValue = {
    readonly generation: number;
    readonly value: EffectParameterValue;
};

type ApplyPresetValuesOptions = {
    readonly generation: number;
    readonly beforeParameterWrite?: (endpointID: string) => void;
    readonly beforeStoredStateWrite?: (key: string, adapter?: EffectStoredStateAdapter) => void;
};

const defaultFilter: StandaloneEffectPresetFilter = {
    query: "",
    source: "all",
};

const SYNTH_INIT_TRANSACTION_PRESET_ID = "cosimo.init.current";

function errorFromUnknown(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function defaultCreatePresetID({
    effectID,
    attempt,
}: {
    effectID: string;
    label: string;
    attempt: number;
}) {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const attemptSuffix = attempt === 0 ? "" : `-${attempt + 1}`;

    return `user.${effectID}.${timestamp}-${randomSuffix}${attemptSuffix}`;
}

function valuesEqual(left: EffectParameterValue | undefined, right: EffectParameterValue) {
    return Object.is(left, right);
}

function storedStateValuesEqual(left: unknown, right: unknown) {
    return canonicalJSONStringify(left) === canonicalJSONStringify(right);
}

function presetKeyFor(source: StandaloneEffectPresetSource, presetID: string) {
    return `${source}:${presetID}`;
}

function normalizeLabel(label: string) {
    const trimmed = label.trim();

    if (!trimmed) {
        throw new Error("Preset label must not be empty.");
    }

    return trimmed;
}

function ensureStoredStateWriter(patchConnection: PatchConnectionLike, operation: string) {
    if (typeof patchConnection.sendStoredStateValue !== "function") {
        throw new Error(`Cannot ${operation} because Cmajor stored state writes are unavailable.`);
    }
}

function ensureParameterWriter(patchConnection: PatchConnectionLike, operation: string) {
    if (typeof patchConnection.sendEventOrValue !== "function") {
        throw new Error(`Cannot ${operation} because the patch connection cannot write parameter values.`);
    }
}

function defaultParameterValues(contract: EffectPluginStateContract) {
    const values: Record<string, EffectParameterValue> = {};

    for (const parameter of contract.parameters) {
        values[parameter.endpointID] = parameter.defaultValue;
    }

    return values;
}

function normalizeRuntimeParameterValue(parameter: EffectParameterContract, value: unknown): EffectParameterValue {
    if (parameter.type === "boolean") {
        if (typeof value === "boolean") {
            return value;
        }

        if (value === 0 || value === 1) {
            return value === 1;
        }

        throw new Error(`${parameter.endpointID} must be a boolean.`);
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        throw new Error(`${parameter.endpointID} must be a finite number.`);
    }

    if (parameter.type === "integer" && !Number.isInteger(numericValue)) {
        throw new Error(`${parameter.endpointID} must be an integer.`);
    }

    if (typeof parameter.min === "number" && numericValue < parameter.min) {
        throw new Error(`${parameter.endpointID} value ${numericValue} is below minimum ${parameter.min}.`);
    }

    if (typeof parameter.max === "number" && numericValue > parameter.max) {
        throw new Error(`${parameter.endpointID} value ${numericValue} is above maximum ${parameter.max}.`);
    }

    return numericValue;
}

function legacyFactoryPresetToV2(
    preset: EffectPreset,
    currentContract: EffectPluginStateContract,
    storedStateAdapters: EffectStoredStateAdapter[],
) {
    if (currentContract.storedState.length > 0) {
        throw new Error(`Factory preset "${preset.presetID}" must be a v2 preset because "${currentContract.effectID}" has non-parameter state.`);
    }

    return normalizeEffectPresetV2({
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID: preset.effectID,
        presetID: preset.presetID,
        label: preset.label,
        contract: clonePluginStateContract(currentContract),
        parameters: {
            ...defaultParameterValues(currentContract),
            ...preset.values,
        },
        storedState: {},
    }, { currentContract, storedStateAdapters });
}

function factoryPresetToV2(
    preset: StandaloneEffectFactoryPreset,
    currentContract: EffectPluginStateContract,
    storedStateAdapters: EffectStoredStateAdapter[],
    presetMigrations: EffectPresetMigration[],
) {
    if (preset.version === EFFECT_PRESET_V2_SCHEMA_VERSION && "parameters" in preset) {
        return normalizeEffectPresetV2(preset, {
            currentContract,
            storedStateAdapters,
            migrations: presetMigrations,
        });
    }

    return legacyFactoryPresetToV2(preset as EffectPreset, currentContract, storedStateAdapters);
}

export class StandaloneEffectPresetController {
    private readonly bridge: EffectPresetRuntimeBridgeV2;
    private readonly factoryPresetRegistry: Record<string, StandaloneEffectFactoryPreset[]>;
    private readonly storedStateAdapters: EffectStoredStateAdapter[];
    private readonly presetMigrationsOption: NonNullable<StandaloneEffectPresetControllerOptions["presetMigrations"]>;
    private resolvedPresetMigrations: { contractHash: string; migrations: EffectPresetMigration[] } | null = null;
    private readonly createPresetID: NonNullable<StandaloneEffectPresetControllerOptions["createPresetID"]>;
    private readonly readClipboardText?: StandaloneEffectPresetControllerOptions["readClipboardText"];
    private readonly writeClipboardText?: StandaloneEffectPresetControllerOptions["writeClipboardText"];
    private readonly listeners = new Set<StandaloneEffectPresetStateListener>();
    private readonly currentValues = new Map<string, EffectParameterValue>();
    private readonly hydratingEndpointIDs = new Set<string>();
    private readonly suppressedParameterValues = new Map<string, SuppressedParameterValue[]>();
    private readonly latestParameterLoadGeneration = new Map<string, number>();
    private readonly parameterListenerCleanups: Array<() => void> = [];
    private readonly storedStateListenerCleanups: Array<() => void> = [];
    private readonly handleBridgeStateBound: (state: EffectPresetStateV2) => void;
    private readonly handleBridgeErrorBound: (error: Error) => void;
    private readonly handleStatusBound: (status: unknown) => void;

    private bridgeState: EffectPresetStateV2;
    private currentContract: EffectPluginStateContract | null = null;
    private filter: StandaloneEffectPresetFilter = { ...defaultFilter };
    private attached = false;
    private ready = false;
    private applyingPresetValuesDepth = 0;
    private loadGeneration = 0;
    private synthInitBaseline: EffectPresetV2 | null = null;
    private synthCleanInitOnlyState = new Map<string, unknown>();
    private unnamedSynthDirty = false;
    private pendingSoundReplacement: PreparedSoundReplacement | null = null;
    private lastError: string | null = null;

    constructor(private readonly options: StandaloneEffectPresetControllerOptions) {
        if (typeof options.effectID !== "string" || options.effectID.trim().length === 0) {
            throw new Error("Effect preset controller effectID must be a non-empty string.");
        }

        this.factoryPresetRegistry = options.factoryPresets ?? EFFECT_FACTORY_PRESETS;
        this.storedStateAdapters = options.storedStateAdapters ?? [];
        this.presetMigrationsOption = options.presetMigrations ?? [];
        this.createPresetID = options.createPresetID ?? defaultCreatePresetID;
        this.readClipboardText = options.readClipboardText;
        this.writeClipboardText = options.writeClipboardText;
        this.bridge = new EffectPresetRuntimeBridgeV2(options.patchConnection, {
            fileStoreEffectID: options.effectID,
        });
        this.bridgeState = this.bridge.getState();
        this.handleBridgeStateBound = this.handleBridgeState.bind(this);
        this.handleBridgeErrorBound = this.handleBridgeError.bind(this);
        this.handleStatusBound = this.handleStatus.bind(this);
    }

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.bridge.subscribe(this.handleBridgeStateBound);
        this.bridge.subscribeErrors(this.handleBridgeErrorBound);
        this.bridge.attach();
        this.bridge.requestBootState();
        this.attachStoredStateListeners();
        this.options.patchConnection.addStatusListener?.(this.handleStatusBound);
        this.options.patchConnection.requestStatusUpdate?.();
        this.notify();
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.detachParameterListeners();
        this.detachStoredStateListeners();
        this.bridge.unsubscribe(this.handleBridgeStateBound);
        this.bridge.unsubscribeErrors(this.handleBridgeErrorBound);
        this.bridge.detach();
        this.options.patchConnection.removeStatusListener?.(this.handleStatusBound);
        this.attached = false;
        this.ready = false;
        this.notify();
    }

    subscribe(listener: StandaloneEffectPresetStateListener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getState(): StandaloneEffectPresetState {
        const factoryPresets = this.buildPresetItems("factory", this.getFactoryPresets());
        const userPresets = this.buildPresetItems("user", this.getUserPresets());
        const presets = [...factoryPresets, ...userPresets];
        const visiblePresets = presets.filter((preset) => this.presetMatchesFilter(preset));
        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID] ?? null;

        return {
            effectID: this.options.effectID,
            ready: this.ready,
            filter: { ...this.filter },
            presets,
            visiblePresets,
            factoryPresets,
            userPresets,
            activePreset: activePreset ? { ...activePreset } : null,
            activePresetID: activePreset?.presetID ?? null,
            activeLabel: activePreset?.label ?? (this.options.synth ? "INIT" : ""),
            dirty: activePreset?.dirty ?? (this.options.synth ? this.unnamedSynthDirty : false),
            currentValues: this.getCurrentValuesRecord(),
            missingCurrentValueEndpointIDs: this.getMissingCurrentValueEndpointIDs(),
            currentContract: this.currentContract ? clonePluginStateContract(this.currentContract) : null,
            lastError: this.lastError,
            supportsInit: this.options.synth !== undefined,
            pendingSoundReplacement: this.pendingSoundReplacement
                ? { ...this.pendingSoundReplacement.pending }
                : null,
        };
    }

    getMutations() {
        const mutations = {
            setFilter: this.setFilter.bind(this),
            clearLastError: this.clearLastError.bind(this),
            refreshCurrentValues: this.refreshCurrentValues.bind(this),
            applyPreset: this.applyPreset.bind(this),
            reapplyActivePreset: this.reapplyActivePreset.bind(this),
            saveCurrentAsNewPreset: this.saveCurrentAsNewPreset.bind(this),
            overwriteUserPreset: this.overwriteUserPreset.bind(this),
            renamePreset: this.renamePreset.bind(this),
            deletePreset: this.deletePreset.bind(this),
            duplicatePresetAsUserPreset: this.duplicatePresetAsUserPreset.bind(this),
            exportPresetText: this.exportPresetText.bind(this),
            importPresetText: this.importPresetText.bind(this),
            copyPresetToClipboard: this.copyPresetToClipboard.bind(this),
            pastePresetFromClipboard: this.pastePresetFromClipboard.bind(this),
        };

        return mutations;
    }

    getSynthMutations() {
        if (!this.options.synth) {
            return null;
        }

        return {
            initSound: this.initSound.bind(this),
            cancelSoundReplacement: this.cancelSoundReplacement.bind(this),
            discardAndContinueSoundReplacement: this.discardAndContinueSoundReplacement.bind(this),
            saveAndContinueSoundReplacement: this.saveAndContinueSoundReplacement.bind(this),
            saveCurrentAsNewPresetAndContinueSoundReplacement: this.saveCurrentAsNewPresetAndContinueSoundReplacement.bind(this),
        };
    }

    setFilter(filter: Partial<StandaloneEffectPresetFilter>) {
        this.filter = {
            query: filter.query ?? this.filter.query,
            source: filter.source ?? this.filter.source,
        };
        this.notify();
    }

    clearLastError() {
        this.lastError = null;
        this.notify();
    }

    refreshCurrentValues(): StandaloneEffectPresetMutationResult<string[]> {
        return this.runMutation(() => {
            this.requestCurrentParameterValues();
            return this.getMissingCurrentValueEndpointIDs();
        }, "Current parameter values refreshed.");
    }

    initSound(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            return this.requestSoundReplacement(this.prepareInitSoundReplacement());
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    cancelSoundReplacement(): StandaloneEffectPresetMutationResult<undefined> {
        return this.runMutation(() => {
            this.pendingSoundReplacement = null;
            return undefined;
        }, "Sound replacement cancelled.");
    }

    discardAndContinueSoundReplacement(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        const replacement = this.pendingSoundReplacement;

        if (!replacement) {
            return this.fail(new Error("No sound replacement is waiting for confirmation."));
        }

        return this.runMutation(() => {
            const value = replacement.apply();
            this.pendingSoundReplacement = null;
            return value;
        }, replacement.successMessage);
    }

    saveAndContinueSoundReplacement(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        if (!this.pendingSoundReplacement) {
            return this.fail(new Error("No sound replacement is waiting for confirmation."));
        }

        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
        const writablePreset = activePreset
            ? this.getUserPresets().find((preset) => preset.presetID === activePreset.presetID)
            : undefined;

        if (!writablePreset) {
            return {
                ok: false,
                actionRequired: "save-as-for-sound-replacement",
                message: "Save the current sound as a new preset before continuing.",
            };
        }

        const saveResult = this.overwriteUserPreset(presetKeyFor("user", writablePreset.presetID));
        if (!saveResult.ok) {
            return saveResult;
        }

        return this.discardAndContinueSoundReplacement();
    }

    saveCurrentAsNewPresetAndContinueSoundReplacement(
        label: string,
    ): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        if (!this.pendingSoundReplacement) {
            return this.fail(new Error("No sound replacement is waiting for confirmation."));
        }

        const saveResult = this.saveCurrentAsNewPreset(label);
        if (!saveResult.ok) {
            return saveResult;
        }

        return this.discardAndContinueSoundReplacement();
    }

    applyPreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            ensureStoredStateWriter(this.options.patchConnection, "apply effect presets");
            ensureParameterWriter(this.options.patchConnection, "apply effect presets");

            const { preset } = this.resolvePreset(presetKey);
            const normalizedPreset = this.normalizePresetForCurrentContract(preset);
            return this.requestSoundReplacement({
                pending: { kind: "preset", presetKey },
                successMessage: "Preset applied.",
                apply: () => {
                    this.commitActivePresetAndApply(normalizedPreset);
                    return cloneEffectPresetV2(normalizedPreset);
                },
            });
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    reapplyActivePreset(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        if (!this.bridgeState.activePresetByEffect[this.options.effectID] && this.options.synth) {
            try {
                const replacement = this.prepareInitSoundReplacement();
                return this.runMutation(replacement.apply, "Preset reapplied.");
            } catch (error) {
                return this.fail(errorFromUnknown(error));
            }
        }

        return this.runMutation(() => {
            const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

            if (!activePreset) {
                throw new Error("No active preset is available to reapply.");
            }

            ensureStoredStateWriter(this.options.patchConnection, "reapply effect presets");
            ensureParameterWriter(this.options.patchConnection, "reapply effect presets");

            const preset = this.findPresetByID(activePreset.presetID);

            if (!preset) {
                throw new Error(`Active preset "${activePreset.presetID}" is not available.`);
            }

            const normalizedPreset = this.normalizePresetForCurrentContract(preset);
            this.commitActivePresetAndApply(normalizedPreset);

            return cloneEffectPresetV2(normalizedPreset);
        }, "Preset reapplied.");
    }

    saveCurrentAsNewPreset(label: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "save effect presets");

            const normalizedLabel = normalizeLabel(label);
            const presetID = this.createUniqueUserPresetID(normalizedLabel);
            const preset = this.captureCurrentPreset(presetID, normalizedLabel);

            this.bridge.saveUserPreset(preset, { activate: true });
            this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(preset);
            return cloneEffectPresetV2(preset);
        }, "Preset saved.");
    }

    overwriteUserPreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "overwrite effect presets");

            const { source, preset } = this.resolvePreset(presetKey);

            if (source !== "user") {
                throw new Error("Factory presets cannot be overwritten.");
            }

            const nextPreset = this.captureCurrentPreset(preset.presetID, preset.label);
            this.bridge.saveUserPreset(nextPreset, { activate: true });
            this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(nextPreset);

            return cloneEffectPresetV2(nextPreset);
        }, "Preset overwritten.");
    }

    renamePreset(presetKey: string, label: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "rename effect presets");

            const { source, preset } = this.resolvePreset(presetKey);

            if (source !== "user") {
                throw new Error("Factory presets cannot be renamed.");
            }

            const nextPreset = this.normalizePresetForCurrentContract({
                ...preset,
                label: normalizeLabel(label),
            });
            const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
            const nextActivePreset = activePreset?.presetID === preset.presetID
                ? { ...activePreset, label: nextPreset.label }
                : undefined;

            this.bridge.setUserPresetsForEffect(
                this.options.effectID,
                this.getUserPresets().map((candidate) => (
                    candidate.presetID === preset.presetID ? nextPreset : candidate
                )),
                nextActivePreset,
            );

            return cloneEffectPresetV2(nextPreset);
        }, "Preset renamed.");
    }

    deletePreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "delete effect presets");

            const { source, preset } = this.resolvePreset(presetKey);

            if (source !== "user") {
                throw new Error("Factory presets cannot be deleted.");
            }

            const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
            const nextActivePreset = activePreset?.presetID === preset.presetID ? null : undefined;

            this.bridge.setUserPresetsForEffect(
                this.options.effectID,
                this.getUserPresets().filter((candidate) => candidate.presetID !== preset.presetID),
                nextActivePreset,
            );

            return cloneEffectPresetV2(preset);
        }, "Preset deleted.");
    }

    duplicatePresetAsUserPreset(presetKey: string, label: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "duplicate effect presets");

            const { preset } = this.resolvePreset(presetKey);
            const normalizedLabel = normalizeLabel(label);
            const nextPreset = this.normalizePresetForCurrentContract({
                ...preset,
                presetID: this.createUniqueUserPresetID(normalizedLabel),
                label: normalizedLabel,
            });

            this.bridge.saveUserPreset(nextPreset);
            return cloneEffectPresetV2(nextPreset);
        }, "Preset duplicated.");
    }

    exportPresetText(presetKey: string): StandaloneEffectPresetMutationResult<string> {
        return this.runMutation(() => {
            const { preset } = this.resolvePreset(presetKey);
            return JSON.stringify(this.normalizePresetForCurrentContract(preset), null, 2);
        }, "Preset exported.");
    }

    importPresetText(
        text: string,
        options: StandaloneEffectPresetImportOptions = {},
    ): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            ensureStoredStateWriter(this.options.patchConnection, "import effect presets");

            const preset = this.prepareImportedPreset(
                this.parseImportText(text),
                options.overwriteExisting === true,
                options.copyOnIDConflict === true,
            );

            if (options.applyAfterImport) {
                ensureParameterWriter(this.options.patchConnection, "import and apply effect presets");
                return this.requestSoundReplacement({
                    pending: { kind: "import", presetID: preset.presetID },
                    successMessage: "Preset imported.",
                    apply: () => {
                        this.commitImportedPresetAndApply(preset);
                        return cloneEffectPresetV2(preset);
                    },
                });
            }

            return this.runMutation(() => {
                this.bridge.saveUserPreset(preset);
                return cloneEffectPresetV2(preset);
            }, "Preset imported.");
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    async copyPresetToClipboard(presetKey: string): Promise<StandaloneEffectPresetMutationResult<string>> {
        const exported = this.exportPresetText(presetKey);

        if (!exported.ok) {
            return exported;
        }

        try {
            const writeClipboardText = this.writeClipboardText ?? globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard);

            if (!writeClipboardText) {
                throw new Error("Clipboard write API is unavailable.");
            }

            await writeClipboardText(exported.value);
            this.lastError = null;
            this.notify();

            return {
                ok: true,
                value: exported.value,
                message: "Preset copied.",
            };
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    async pastePresetFromClipboard(
        options: StandaloneEffectPresetImportOptions = {},
    ): Promise<StandaloneEffectPresetMutationResult<EffectPresetV2>> {
        try {
            const readClipboardText = this.readClipboardText ?? globalThis.navigator?.clipboard?.readText?.bind(globalThis.navigator.clipboard);

            if (!readClipboardText) {
                throw new Error("Clipboard read API is unavailable.");
            }

            const text = await readClipboardText();
            return this.importPresetText(text, {
                ...options,
                copyOnIDConflict: options.copyOnIDConflict ?? true,
            });
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    private handleBridgeState(state: EffectPresetStateV2) {
        this.bridgeState = state;
        this.notify();
    }

    private handleBridgeError(error: Error) {
        this.lastError = error.message;
        this.notify();
    }

    private handleStatus(status: unknown) {
        const nextContract = buildPluginStateContract({
            effectID: this.options.effectID,
            status,
            storedState: this.storedStateAdapters,
        });

        if (this.currentContract?.hash === nextContract.hash) {
            return;
        }

        this.currentContract = nextContract;
        this.ready = true;
        this.currentValues.clear();
        this.detachParameterListeners();
        this.attachParameterListeners();
        this.notify();
    }

    private attachParameterListeners() {
        const contract = this.requireCurrentContract();

        for (const parameter of contract.parameters) {
            const endpointID = parameter.endpointID;
            this.hydratingEndpointIDs.add(endpointID);

            const listener = (value: unknown) => this.handleParameterValue(endpointID, value);
            this.options.patchConnection.addParameterListener?.(endpointID, listener);
            this.parameterListenerCleanups.push(() => {
                this.options.patchConnection.removeParameterListener?.(endpointID, listener);
            });
        }

        this.requestCurrentParameterValues();
    }

    private detachParameterListeners() {
        for (const cleanup of this.parameterListenerCleanups) {
            cleanup();
        }

        this.parameterListenerCleanups.length = 0;
        this.hydratingEndpointIDs.clear();
        this.suppressedParameterValues.clear();
        this.latestParameterLoadGeneration.clear();
    }

    private attachStoredStateListeners() {
        for (const adapter of this.storedStateAdapters) {
            if (typeof adapter.subscribe !== "function") {
                continue;
            }

            const cleanup = adapter.subscribe(() => this.handleStoredStateAdapterChange(adapter));
            this.storedStateListenerCleanups.push(cleanup);
        }

        for (const adapter of this.options.synth?.initOnlyStateAdapters ?? []) {
            if (typeof adapter.subscribe !== "function") {
                continue;
            }

            const cleanup = adapter.subscribe(() => this.handleInitOnlyStateAdapterChange(adapter));
            this.storedStateListenerCleanups.push(cleanup);
        }
    }

    private detachStoredStateListeners() {
        for (const cleanup of this.storedStateListenerCleanups) {
            cleanup();
        }

        this.storedStateListenerCleanups.length = 0;
    }

    private requestCurrentParameterValues() {
        for (const parameter of this.currentContract?.parameters ?? []) {
            this.options.patchConnection.requestParameterValue?.(parameter.endpointID);
        }
    }

    private handleParameterValue(endpointID: string, value: unknown) {
        let normalizedValue: EffectParameterValue;

        try {
            normalizedValue = this.normalizeEndpointValue(endpointID, value);
        } catch (error) {
            this.lastError = errorFromUnknown(error).message;
            this.notify();
            return;
        }

        if (this.hydratingEndpointIDs.delete(endpointID)) {
            this.currentValues.set(endpointID, normalizedValue);
            this.notify();
            return;
        }

        const suppressedValue = this.consumeSuppressedParameterValue(endpointID, normalizedValue);

        if (suppressedValue) {
            if (this.latestParameterLoadGeneration.get(endpointID) === suppressedValue.generation) {
                this.currentValues.set(endpointID, normalizedValue);
            }
            this.notify();
            return;
        }

        // The load writes as one synchronous burst, so UI input can only arrive after
        // that burst. Apply and dirty any unqueued callback; advancing the generation
        // keeps older, delayed load echoes from replacing that genuine edit.
        this.latestParameterLoadGeneration.set(endpointID, this.nextLoadGeneration());
        this.currentValues.set(endpointID, normalizedValue);
        this.markActivePresetDirtyIfNeeded(endpointID, normalizedValue);
        this.notify();
    }

    private normalizeEndpointValue(endpointID: string, value: unknown) {
        const parameter = this.currentContract?.parameters.find((candidate) => candidate.endpointID === endpointID);

        if (!parameter) {
            throw new Error(`Unknown parameter "${endpointID}".`);
        }

        return normalizeRuntimeParameterValue(parameter, value);
    }

    private markActivePresetDirtyIfNeeded(endpointID: string, value: EffectParameterValue) {
        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

        if (!activePreset) {
            if (
                this.options.synth
                && !this.unnamedSynthDirty
                && this.synthInitBaseline
                && !valuesEqual(this.synthInitBaseline.parameters[endpointID], value)
            ) {
                this.unnamedSynthDirty = true;
            }
            return;
        }

        if (activePreset.dirty) {
            return;
        }

        const activePresetPayload = this.findPresetByID(activePreset.presetID);

        if (activePresetPayload && valuesEqual(activePresetPayload.parameters[endpointID], value)) {
            return;
        }

        this.bridge.setActivePresetMetadata(this.options.effectID, {
            ...activePreset,
            dirty: true,
        });
    }

    private handleStoredStateAdapterChange(adapter: EffectStoredStateAdapter) {
        if (this.applyingPresetValuesDepth > 0) {
            return;
        }

        try {
            this.markActivePresetDirtyForStoredStateIfNeeded(adapter);
        } catch (error) {
            this.lastError = errorFromUnknown(error).message;
        }

        this.notify();
    }

    private markActivePresetDirtyForStoredStateIfNeeded(adapter: EffectStoredStateAdapter) {
        if (typeof adapter.capture !== "function") {
            return;
        }

        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

        if (activePreset?.dirty) {
            return;
        }

        // Fresh instances and the post-Init INIT identity have NO active
        // preset; the payload lookup belongs to the active-preset branch only.
        const activePresetPayload = activePreset ? this.findPresetByID(activePreset.presetID) : null;
        const capturedStoredState: Record<string, unknown> = {};

        for (const currentAdapter of this.storedStateAdapters) {
            if (typeof currentAdapter.capture === "function") {
                capturedStoredState[currentAdapter.key] = currentAdapter.capture();
            }
        }

        const context = {
            parameters: this.getCurrentValuesRecord(),
            storedState: capturedStoredState,
        };
        const currentStoredState = adapter.serializeForPreset(
            adapter.normalizeForPreset(capturedStoredState[adapter.key], context),
            context,
        );

        if (!activePreset) {
            if (
                this.options.synth
                && this.synthInitBaseline
                && !this.unnamedSynthDirty
                && !storedStateValuesEqual(this.synthInitBaseline.storedState[adapter.key], currentStoredState)
            ) {
                this.unnamedSynthDirty = true;
            }
            return;
        }

        if (activePresetPayload && storedStateValuesEqual(activePresetPayload.storedState[adapter.key], currentStoredState)) {
            return;
        }

        this.bridge.setActivePresetMetadata(this.options.effectID, {
            ...activePreset,
            dirty: true,
        });
    }

    private handleInitOnlyStateAdapterChange(adapter: StandaloneEffectInitOnlyStateAdapter) {
        if (this.applyingPresetValuesDepth > 0) {
            return;
        }

        try {
            const baseline = this.synthCleanInitOnlyState.get(adapter.key);
            const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

            if (activePreset?.dirty) {
                return;
            }

            const currentPreset = this.captureCurrentPreset("cosimo.compare.current", "Compare");
            const context: EffectStoredStateContext = {
                parameters: currentPreset.parameters,
                storedState: currentPreset.storedState,
            };
            const currentValue = adapter.serializeForTransaction(
                adapter.normalizeForTransaction(adapter.capture(), context),
                context,
            );

            if (baseline !== undefined && storedStateValuesEqual(baseline, currentValue)) {
                return;
            }

            if (!activePreset) {
                if (this.synthInitBaseline && !this.unnamedSynthDirty) {
                    this.unnamedSynthDirty = true;
                }
                return;
            }

            this.bridge.setActivePresetMetadata(this.options.effectID, {
                ...activePreset,
                dirty: true,
            });
        } catch (error) {
            this.lastError = errorFromUnknown(error).message;
        }

        this.notify();
    }

    private requireCurrentContract() {
        if (!this.currentContract) {
            throw new Error("Cannot use effect presets until the Cmajor status contract is available.");
        }

        return this.currentContract;
    }

    private getFactoryPresets() {
        if (!this.currentContract) {
            return [];
        }

        return (this.factoryPresetRegistry[this.options.effectID] ?? []).map((preset) => (
            factoryPresetToV2(
                preset,
                this.currentContract as EffectPluginStateContract,
                this.storedStateAdapters,
                this.resolvePresetMigrations(this.currentContract as EffectPluginStateContract),
            )
        ));
    }

    private getUserPresets() {
        return (this.bridgeState.userPresets[this.options.effectID] ?? []).map(cloneEffectPresetV2);
    }

    private buildPresetItems(source: StandaloneEffectPresetSource, presets: EffectPresetV2[]) {
        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

        return presets.map((preset): StandaloneEffectPresetListItem => {
            const isActive = activePreset?.presetID === preset.presetID;
            const isUser = source === "user";
            const canApply = this.canApplyPreset(preset);

            return {
                presetKey: presetKeyFor(source, preset.presetID),
                presetID: preset.presetID,
                label: preset.label,
                effectID: preset.effectID,
                source,
                preset: cloneEffectPresetV2(preset),
                isActive,
                dirty: Boolean(isActive && activePreset?.dirty),
                canApply,
                canRename: isUser,
                canOverwrite: isUser,
                canDelete: isUser,
                canExport: canApply,
            };
        });
    }

    private canApplyPreset(preset: EffectPresetV2) {
        if (!this.currentContract) {
            return false;
        }

        try {
            this.normalizePresetForCurrentContract(preset);
            return true;
        } catch {
            return false;
        }
    }

    private presetMatchesFilter(preset: StandaloneEffectPresetListItem) {
        if (this.filter.source !== "all" && preset.source !== this.filter.source) {
            return false;
        }

        const query = this.filter.query.trim().toLowerCase();

        if (!query) {
            return true;
        }

        return preset.label.toLowerCase().includes(query)
            || preset.presetID.toLowerCase().includes(query);
    }

    private getCurrentValuesRecord() {
        const values: Record<string, EffectParameterValue> = {};

        for (const parameter of this.currentContract?.parameters ?? []) {
            if (this.currentValues.has(parameter.endpointID)) {
                values[parameter.endpointID] = this.currentValues.get(parameter.endpointID) as EffectParameterValue;
            }
        }

        return values;
    }

    private getMissingCurrentValueEndpointIDs() {
        return (this.currentContract?.parameters ?? [])
            .filter((parameter) => !this.currentValues.has(parameter.endpointID))
            .map((parameter) => parameter.endpointID);
    }

    private createUniqueUserPresetID(label: string) {
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const presetID = this.createPresetID({
                effectID: this.options.effectID,
                label,
                attempt,
            }).trim();

            if (!presetID) {
                continue;
            }

            if (!this.findPresetByID(presetID)) {
                return presetID;
            }
        }

        throw new Error("Could not create a unique preset ID.");
    }

    private captureCurrentPreset(presetID: string, label: string) {
        return captureEffectPresetV2({
            effectID: this.options.effectID,
            presetID,
            label,
            currentContract: this.requireCurrentContract(),
            currentParameterValues: this.getCurrentValuesRecord(),
            storedStateAdapters: this.storedStateAdapters,
        });
    }

    private resolvePreset(presetKeyOrID: string): ResolvedPreset {
        if (presetKeyOrID.startsWith("factory:")) {
            const presetID = presetKeyOrID.slice("factory:".length);
            const preset = this.getFactoryPresets().find((candidate) => candidate.presetID === presetID);

            if (!preset) {
                throw new Error(`Factory preset "${presetID}" was not found.`);
            }

            return { source: "factory", preset };
        }

        if (presetKeyOrID.startsWith("user:")) {
            const presetID = presetKeyOrID.slice("user:".length);
            const preset = this.getUserPresets().find((candidate) => candidate.presetID === presetID);

            if (!preset) {
                throw new Error(`User preset "${presetID}" was not found.`);
            }

            return { source: "user", preset };
        }

        const matches = [
            ...this.getFactoryPresets().map((preset) => ({ source: "factory" as const, preset })),
            ...this.getUserPresets().map((preset) => ({ source: "user" as const, preset })),
        ].filter(({ preset }) => preset.presetID === presetKeyOrID);

        if (matches.length === 1) {
            return matches[0];
        }

        if (matches.length > 1) {
            throw new Error(`Preset ID "${presetKeyOrID}" is ambiguous; use a presetKey.`);
        }

        throw new Error(`Preset "${presetKeyOrID}" was not found.`);
    }

    private findPresetByID(presetID: string) {
        return this.getUserPresets().find((preset) => preset.presetID === presetID)
            ?? this.getFactoryPresets().find((preset) => preset.presetID === presetID)
            ?? null;
    }

    private parseImportText(text: string) {
        if (typeof text !== "string") {
            throw new Error("Preset import text must be a string.");
        }

        const parsed = parseEffectPresetV2Text(text);
        const preset = this.normalizePresetForCurrentContract(parsed);

        if (preset.effectID !== this.options.effectID) {
            throw new Error(`Cannot import ${preset.effectID} preset into ${this.options.effectID}.`);
        }

        return preset;
    }

    private assertUserPresetIDCanBeStored(presetID: string, overwriteExisting: boolean) {
        if (this.getFactoryPresets().some((preset) => preset.presetID === presetID)) {
            throw new Error(`Preset ID "${presetID}" conflicts with a factory preset.`);
        }

        if (!overwriteExisting && this.getUserPresets().some((preset) => preset.presetID === presetID)) {
            throw new Error(`User preset "${presetID}" already exists.`);
        }
    }

    private prepareImportedPreset(preset: EffectPresetV2, overwriteExisting: boolean, copyOnIDConflict: boolean) {
        if (overwriteExisting) {
            this.assertUserPresetIDCanBeStored(preset.presetID, true);
            return preset;
        }

        if (!this.findPresetByID(preset.presetID)) {
            return preset;
        }

        if (!copyOnIDConflict) {
            this.assertUserPresetIDCanBeStored(preset.presetID, false);
        }

        return this.normalizePresetForCurrentContract({
            ...preset,
            presetID: this.createUniqueUserPresetID(normalizeLabel(preset.label)),
        });
    }

    private normalizePresetForCurrentContract(preset: unknown) {
        const currentContract = this.requireCurrentContract();
        return normalizeEffectPresetV2(preset, {
            currentContract,
            storedStateAdapters: this.storedStateAdapters,
            migrations: this.resolvePresetMigrations(currentContract),
        });
    }

    private resolvePresetMigrations(currentContract: EffectPluginStateContract): EffectPresetMigration[] {
        if (typeof this.presetMigrationsOption !== "function") {
            return this.presetMigrationsOption;
        }

        if (this.resolvedPresetMigrations?.contractHash !== currentContract.hash) {
            this.resolvedPresetMigrations = {
                contractHash: currentContract.hash,
                migrations: this.presetMigrationsOption(currentContract),
            };
        }

        return this.resolvedPresetMigrations.migrations;
    }

    private commitActivePresetAndApply(preset: EffectPresetV2) {
        if (!this.options.synth) {
            const previousState = this.bridge.getState();
            this.bridge.setActivePresetMetadata(
                this.options.effectID,
                createActivePresetMetadataFromPresetV2(preset),
            );

            try {
                this.applyPresetValuesOutsideTransaction(preset);
            } catch (error) {
                this.restoreBridgeStateAfterApplyFailure(previousState, error);
            }
            return;
        }

        this.applySoundTransaction({
            preset,
            commit: () => {
                this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(preset);
                this.bridge.setActivePresetMetadata(
                    this.options.effectID,
                    createActivePresetMetadataFromPresetV2(preset),
                );
            },
        });
    }

    private commitImportedPresetAndApply(preset: EffectPresetV2) {
        if (!this.options.synth) {
            const previousState = this.bridge.getState();
            this.bridge.saveUserPreset(preset, { activate: true });

            try {
                this.applyPresetValuesOutsideTransaction(preset);
            } catch (error) {
                this.restoreBridgeStateAfterApplyFailure(previousState, error);
            }
            return;
        }

        this.applySoundTransaction({
            preset,
            commit: () => {
                this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(preset);
                this.bridge.saveUserPreset(preset, { activate: true });
            },
        });
    }

    private restoreBridgeStateAfterApplyFailure(previousState: EffectPresetStateV2, originalError: unknown): never {
        try {
            this.bridge.replaceState(previousState);
        } catch (rollbackError) {
            const original = errorFromUnknown(originalError);
            const rollback = errorFromUnknown(rollbackError);
            throw new Error(`${original.message}; failed to restore previous preset metadata: ${rollback.message}`);
        }

        throw errorFromUnknown(originalError);
    }

    private applyPresetValuesOutsideTransaction(preset: EffectPresetV2) {
        this.applyingPresetValuesDepth += 1;

        try {
            this.applyPresetValuesToPatch(preset, {
                generation: this.nextLoadGeneration(),
            });
        } catch (error) {
            this.suppressedParameterValues.clear();
            throw error;
        } finally {
            this.applyingPresetValuesDepth -= 1;
        }
    }

    private applySoundTransaction({
        preset,
        initOnlyValues = [],
        commit,
    }: {
        preset: EffectPresetV2;
        initOnlyValues?: ReadonlyArray<PreparedInitOnlyStateValue>;
        commit: () => void;
    }) {
        const previousPreset = this.captureCurrentPreset("cosimo.rollback.current", "Rollback");
        const previousInitOnlyValues = this.captureInitOnlyStateValues(previousPreset);
        const previousBridgeState = this.bridge.getState();
        const previousInitBaseline = this.synthInitBaseline
            ? cloneEffectPresetV2(this.synthInitBaseline)
            : null;
        const previousCleanInitOnlyState = new Map(this.synthCleanInitOnlyState);
        const previousUnnamedDirty = this.unnamedSynthDirty;
        const operations: SoundRollbackOperation[] = [];
        const generation = this.nextLoadGeneration();
        let commitStarted = false;

        this.applyingPresetValuesDepth += 1;

        try {
            this.applyPresetValuesToPatch(preset, {
                generation,
                beforeParameterWrite: (endpointID) => {
                    operations.push({ kind: "parameter", endpointID });
                },
                beforeStoredStateWrite: (key, adapter) => {
                    operations.push({ kind: "stored-state", key, adapter });
                },
            });

            const context: EffectStoredStateContext = {
                parameters: preset.parameters,
                storedState: preset.storedState,
            };

            for (const entry of initOnlyValues) {
                operations.push({ kind: "init-only", adapter: entry.adapter });
                entry.adapter.apply(entry.value, context);
            }

            commitStarted = true;
            commit();
        } catch (error) {
            const rollbackErrors = this.rollbackSoundOperations(
                operations,
                previousPreset,
                previousInitOnlyValues,
            );

            if (commitStarted) {
                try {
                    this.bridge.replaceState(previousBridgeState);
                } catch (rollbackError) {
                    rollbackErrors.push(errorFromUnknown(rollbackError));
                }
            }

            this.synthInitBaseline = previousInitBaseline;
            this.synthCleanInitOnlyState = previousCleanInitOnlyState;
            this.unnamedSynthDirty = previousUnnamedDirty;

            const original = errorFromUnknown(error);

            if (rollbackErrors.length > 0) {
                throw new Error(
                    `${original.message}; failed to restore the previous sound: ${rollbackErrors.map((entry) => entry.message).join("; ")}`,
                );
            }

            throw original;
        } finally {
            this.applyingPresetValuesDepth -= 1;
        }
    }

    private captureInitOnlyStateValues(preset: EffectPresetV2) {
        const context: EffectStoredStateContext = {
            parameters: preset.parameters,
            storedState: preset.storedState,
        };

        return (this.options.synth?.initOnlyStateAdapters ?? []).map((adapter): PreparedInitOnlyStateValue => {
            const normalized = adapter.normalizeForTransaction(adapter.capture(), context);
            const serialized = adapter.serializeForTransaction(normalized, context);

            return {
                adapter,
                serialized,
                value: adapter.normalizeForTransaction(serialized, context),
            };
        });
    }

    private captureSerializedInitOnlyState(preset: EffectPresetV2) {
        return new Map(
            this.captureInitOnlyStateValues(preset).map((entry) => [entry.adapter.key, entry.serialized]),
        );
    }

    private rollbackSoundOperations(
        operations: ReadonlyArray<SoundRollbackOperation>,
        previousPreset: EffectPresetV2,
        previousInitOnlyValues: ReadonlyArray<PreparedInitOnlyStateValue>,
    ) {
        const rollbackErrors: Error[] = [];
        const generation = this.nextLoadGeneration();
        const context: EffectStoredStateContext = {
            parameters: previousPreset.parameters,
            storedState: previousPreset.storedState,
        };
        const previousInitOnlyByKey = new Map(
            previousInitOnlyValues.map((entry) => [entry.adapter.key, entry]),
        );
        const parameterEndpointIDs = new Set(
            operations.flatMap((operation) => operation.kind === "parameter" ? [operation.endpointID] : []),
        );
        const storedStateOperations = new Map<
            string,
            Extract<SoundRollbackOperation, { kind: "stored-state" }>
        >();
        for (const operation of operations) {
            if (operation.kind === "stored-state") {
                storedStateOperations.set(operation.key, operation);
            }
        }
        const initOnlyKeys = new Set(
            operations.flatMap((operation) => operation.kind === "init-only" ? [operation.adapter.key] : []),
        );

        const attemptRollback = (rollback: () => void) => {
            try {
                rollback();
            } catch (rollbackError) {
                rollbackErrors.push(errorFromUnknown(rollbackError));
            }
        };

        for (const parameter of this.requireCurrentContract().parameters) {
            if (!parameterEndpointIDs.has(parameter.endpointID)) {
                continue;
            }

            attemptRollback(() => this.restoreParameterValue(
                parameter.endpointID,
                previousPreset.parameters[parameter.endpointID],
                generation,
            ));
        }

        const restoreStoredState = (operation: Extract<SoundRollbackOperation, { kind: "stored-state" }>) => {
            const value = previousPreset.storedState[operation.key];

            if (operation.adapter?.apply) {
                operation.adapter.apply(
                    operation.adapter.normalizeForPreset(value, context),
                    context,
                );
                return;
            }

            this.options.patchConnection.sendStoredStateValue?.(operation.key, value);
        };

        for (const adapter of this.storedStateAdapters) {
            const operation = storedStateOperations.get(adapter.key);

            if (operation) {
                attemptRollback(() => restoreStoredState(operation));
                storedStateOperations.delete(adapter.key);
            }
        }

        for (const entry of this.requireCurrentContract().storedState) {
            const operation = storedStateOperations.get(entry.key);

            if (operation) {
                attemptRollback(() => restoreStoredState(operation));
                storedStateOperations.delete(entry.key);
            }
        }

        for (const adapter of this.options.synth?.initOnlyStateAdapters ?? []) {
            if (!initOnlyKeys.has(adapter.key)) {
                continue;
            }

            attemptRollback(() => {
                const previousValue = previousInitOnlyByKey.get(adapter.key);

                if (!previousValue) {
                    throw new Error(`Missing rollback value for ${adapter.key}.`);
                }

                adapter.apply(previousValue.value, context);
            });
        }

        return rollbackErrors;
    }

    private restoreParameterValue(
        endpointID: string,
        value: EffectParameterValue,
        generation: number,
    ) {
        const sendEventOrValue = this.options.patchConnection.sendEventOrValue;

        if (typeof sendEventOrValue !== "function") {
            throw new Error(`Cannot restore parameter "${endpointID}" because parameter writes are unavailable.`);
        }

        const suppression = this.queueSuppressedParameterValue(endpointID, value, generation);
        this.options.patchConnection.sendParameterGestureStart?.(endpointID);

        try {
            sendEventOrValue.call(this.options.patchConnection, endpointID, value);
            this.currentValues.set(endpointID, value);
        } catch (error) {
            this.removeSuppressedParameterValue(endpointID, suppression);
            throw error;
        } finally {
            this.options.patchConnection.sendParameterGestureEnd?.(endpointID);
        }
    }

    private applyPresetValuesToPatch(preset: EffectPresetV2, options: ApplyPresetValuesOptions) {
        const sendEventOrValue = this.options.patchConnection.sendEventOrValue;
        const currentContract = this.requireCurrentContract();

        if (typeof sendEventOrValue !== "function") {
            throw new Error("Cannot apply effect presets because the patch connection cannot write parameter values.");
        }

        const transactionalAdapters = this.storedStateAdapters.map((adapter): EffectStoredStateAdapter => ({
            ...adapter,
            apply: adapter.apply
                ? (value, context) => {
                    options.beforeStoredStateWrite?.(adapter.key, adapter);
                    adapter.apply?.(value, context);
                }
                : undefined,
        }));

        applyEffectPresetV2({
            patchConnection: {
                sendParameterGestureStart: this.options.patchConnection.sendParameterGestureStart?.bind(this.options.patchConnection),
                sendEventOrValue: (endpointID, value) => {
                    const normalizedValue = this.normalizeEndpointValue(endpointID, value);
                    const suppression = this.queueSuppressedParameterValue(
                        endpointID,
                        normalizedValue,
                        options.generation,
                    );
                    options.beforeParameterWrite?.(endpointID);

                    try {
                        sendEventOrValue.call(this.options.patchConnection, endpointID, value);
                        this.currentValues.set(endpointID, normalizedValue);
                    } catch (error) {
                        this.removeSuppressedParameterValue(endpointID, suppression);
                        throw error;
                    }
                },
                sendParameterGestureEnd: this.options.patchConnection.sendParameterGestureEnd?.bind(this.options.patchConnection),
                sendStoredStateValue: (key, value) => {
                    options.beforeStoredStateWrite?.(key);
                    this.options.patchConnection.sendStoredStateValue?.(key, value);
                },
            },
            preset,
            currentContract,
            storedStateAdapters: transactionalAdapters,
            migrations: this.resolvePresetMigrations(currentContract),
        });
    }

    private nextLoadGeneration() {
        this.loadGeneration += 1;
        return this.loadGeneration;
    }

    private queueSuppressedParameterValue(
        endpointID: string,
        value: EffectParameterValue,
        generation: number,
    ): SuppressedParameterValue {
        const suppression = { generation, value };
        const queue = this.suppressedParameterValues.get(endpointID) ?? [];
        queue.push(suppression);
        this.suppressedParameterValues.set(endpointID, queue);
        this.latestParameterLoadGeneration.set(endpointID, generation);
        return suppression;
    }

    private removeSuppressedParameterValue(endpointID: string, suppression: SuppressedParameterValue) {
        const queue = this.suppressedParameterValues.get(endpointID);

        if (!queue) {
            return;
        }

        const index = queue.indexOf(suppression);

        if (index !== -1) {
            queue.splice(index, 1);
        }

        if (queue.length === 0) {
            this.suppressedParameterValues.delete(endpointID);
        }
    }

    private consumeSuppressedParameterValue(endpointID: string, value: EffectParameterValue) {
        const queue = this.suppressedParameterValues.get(endpointID);

        if (!queue || queue.length === 0) {
            return null;
        }

        const matchIndex = queue.findIndex((candidate) => valuesEqual(candidate.value, value));

        if (matchIndex === -1) {
            return null;
        }

        const [suppression] = queue.splice(matchIndex, 1);

        if (queue.length === 0) {
            this.suppressedParameterValues.delete(endpointID);
        }

        return suppression;
    }

    private prepareInitSoundReplacement(): PreparedSoundReplacement {
        const synth = this.options.synth;

        if (!synth) {
            throw new Error("Init is only available for synth preset controllers.");
        }

        ensureStoredStateWriter(this.options.patchConnection, "initialize the synth sound");
        ensureParameterWriter(this.options.patchConnection, "initialize the synth sound");

        const currentContract = this.requireCurrentContract();
        const initPreset = this.normalizePresetForCurrentContract({
            kind: EFFECT_PRESET_V2_KIND,
            version: EFFECT_PRESET_V2_SCHEMA_VERSION,
            effectID: this.options.effectID,
            presetID: SYNTH_INIT_TRANSACTION_PRESET_ID,
            label: "INIT",
            contract: clonePluginStateContract(currentContract),
            parameters: defaultParameterValues(currentContract),
            storedState: synth.createCanonicalStoredState(currentContract),
        });
        const context: EffectStoredStateContext = {
            parameters: initPreset.parameters,
            storedState: initPreset.storedState,
        };
        const initOnlyValues = (synth.initOnlyStateAdapters ?? []).map((adapter): PreparedInitOnlyStateValue => {
            const value = adapter.normalizeForTransaction(adapter.createDefaultValue(), context);

            return {
                adapter,
                serialized: adapter.serializeForTransaction(value, context),
                value,
            };
        });

        return {
            pending: { kind: "init" },
            successMessage: "Synth initialized.",
            apply: () => {
                this.applySoundTransaction({
                    preset: initPreset,
                    initOnlyValues,
                    commit: () => {
                        this.synthInitBaseline = cloneEffectPresetV2(initPreset);
                        this.synthCleanInitOnlyState = new Map(
                            initOnlyValues.map((entry) => [entry.adapter.key, entry.serialized]),
                        );
                        this.unnamedSynthDirty = false;
                        this.bridge.setActivePresetMetadata(this.options.effectID, null);
                    },
                });

                return cloneEffectPresetV2(initPreset);
            },
        };
    }

    private requestSoundReplacement(
        replacement: PreparedSoundReplacement,
    ): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        if (this.options.synth && this.getState().dirty) {
            this.pendingSoundReplacement = replacement;
            this.lastError = null;
            this.notify();

            return {
                ok: false,
                actionRequired: "confirm-sound-replacement",
                message: "The current sound has unsaved changes.",
            };
        }

        return this.runMutation(replacement.apply, replacement.successMessage);
    }

    private runMutation<T>(
        mutation: () => T,
        message: string,
    ): StandaloneEffectPresetMutationResult<T> {
        try {
            const value = mutation();
            this.lastError = null;
            this.notify();

            return {
                ok: true,
                value,
                message,
            };
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    private fail<T = never>(error: Error): StandaloneEffectPresetMutationResult<T> {
        this.lastError = error.message;
        this.notify();

        return {
            ok: false,
            error,
            message: error.message,
        };
    }

    private notify() {
        const state = this.getState();

        for (const listener of this.listeners) {
            listener(state);
        }
    }
}

export function createStandaloneEffectPresetController(options: StandaloneEffectPresetControllerOptions) {
    return new StandaloneEffectPresetController(options);
}
