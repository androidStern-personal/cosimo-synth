import type { PatchConnectionLike } from "../cmajor-react";
import {
    buildPluginStateContract,
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
};

export type StandaloneEffectPresetMutationResult<T> = {
    ok: true;
    value: T;
    message: string;
} | {
    ok: false;
    error: Error;
    message: string;
};

export type StandaloneEffectFactoryPreset = EffectPresetV2 | EffectPreset;

export type StandaloneEffectPresetControllerOptions = {
    effectID: string;
    patchConnection: PatchConnectionLike;
    factoryPresets?: Record<string, StandaloneEffectFactoryPreset[]>;
    storedStateAdapters?: EffectStoredStateAdapter[];
    presetMigrations?: EffectPresetMigration[];
    createPresetID?: (context: {
        effectID: string;
        label: string;
        attempt: number;
    }) => string;
    readClipboardText?: () => string | Promise<string>;
    writeClipboardText?: (text: string) => void | Promise<void>;

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

const defaultFilter: StandaloneEffectPresetFilter = {
    query: "",
    source: "all",
};

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
    private readonly presetMigrations: EffectPresetMigration[];
    private readonly createPresetID: NonNullable<StandaloneEffectPresetControllerOptions["createPresetID"]>;
    private readonly readClipboardText?: StandaloneEffectPresetControllerOptions["readClipboardText"];
    private readonly writeClipboardText?: StandaloneEffectPresetControllerOptions["writeClipboardText"];
    private readonly listeners = new Set<StandaloneEffectPresetStateListener>();
    private readonly currentValues = new Map<string, EffectParameterValue>();
    private readonly hydratingEndpointIDs = new Set<string>();
    private readonly suppressedParameterValues = new Map<string, EffectParameterValue[]>();
    private readonly parameterListenerCleanups: Array<() => void> = [];
    private readonly handleBridgeStateBound: (state: EffectPresetStateV2) => void;
    private readonly handleBridgeErrorBound: (error: Error) => void;
    private readonly handleStatusBound: (status: unknown) => void;

    private bridgeState: EffectPresetStateV2;
    private currentContract: EffectPluginStateContract | null = null;
    private filter: StandaloneEffectPresetFilter = { ...defaultFilter };
    private attached = false;
    private ready = false;
    private lastError: string | null = null;

    constructor(private readonly options: StandaloneEffectPresetControllerOptions) {
        if (typeof options.effectID !== "string" || options.effectID.trim().length === 0) {
            throw new Error("Effect preset controller effectID must be a non-empty string.");
        }

        this.factoryPresetRegistry = options.factoryPresets ?? EFFECT_FACTORY_PRESETS;
        this.storedStateAdapters = options.storedStateAdapters ?? [];
        this.presetMigrations = options.presetMigrations ?? [];
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
        this.options.patchConnection.addStatusListener?.(this.handleStatusBound);
        this.options.patchConnection.requestStatusUpdate?.();
        this.notify();
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.detachParameterListeners();
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
            activeLabel: activePreset?.label ?? "",
            dirty: activePreset?.dirty ?? false,
            currentValues: this.getCurrentValuesRecord(),
            missingCurrentValueEndpointIDs: this.getMissingCurrentValueEndpointIDs(),
            currentContract: this.currentContract ? clonePluginStateContract(this.currentContract) : null,
            lastError: this.lastError,
        };
    }

    getMutations() {
        return {
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

    applyPreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "apply effect presets");
            ensureParameterWriter(this.options.patchConnection, "apply effect presets");

            const { preset } = this.resolvePreset(presetKey);
            const normalizedPreset = this.normalizePresetForCurrentContract(preset);
            this.commitActivePresetAndApply(normalizedPreset);

            return cloneEffectPresetV2(normalizedPreset);
        }, "Preset applied.");
    }

    reapplyActivePreset(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
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
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "import effect presets");

            const preset = this.prepareImportedPreset(
                this.parseImportText(text),
                options.overwriteExisting === true,
                options.copyOnIDConflict === true,
            );

            if (options.applyAfterImport) {
                ensureParameterWriter(this.options.patchConnection, "import and apply effect presets");
                this.commitImportedPresetAndApply(preset);
            } else {
                this.bridge.saveUserPreset(preset);
            }

            return cloneEffectPresetV2(preset);
        }, "Preset imported.");
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

        this.currentValues.set(endpointID, normalizedValue);

        if (this.hydratingEndpointIDs.delete(endpointID)) {
            this.notify();
            return;
        }

        if (this.consumeSuppressedParameterValue(endpointID, normalizedValue)) {
            this.notify();
            return;
        }

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

        if (!activePreset || activePreset.dirty) {
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
                this.presetMigrations,
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
        return normalizeEffectPresetV2(preset, {
            currentContract: this.requireCurrentContract(),
            storedStateAdapters: this.storedStateAdapters,
            migrations: this.presetMigrations,
        });
    }

    private commitActivePresetAndApply(preset: EffectPresetV2) {
        const previousState = this.bridge.getState();

        this.bridge.setActivePresetMetadata(this.options.effectID, createActivePresetMetadataFromPresetV2(preset));

        try {
            this.applyPresetValuesToPatch(preset);
        } catch (error) {
            this.restoreBridgeStateAfterApplyFailure(previousState, error);
        }
    }

    private commitImportedPresetAndApply(preset: EffectPresetV2) {
        const previousState = this.bridge.getState();

        this.bridge.saveUserPreset(preset, { activate: true });

        try {
            this.applyPresetValuesToPatch(preset);
        } catch (error) {
            this.restoreBridgeStateAfterApplyFailure(previousState, error);
        }
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

    private applyPresetValuesToPatch(preset: EffectPresetV2) {
        const sendEventOrValue = this.options.patchConnection.sendEventOrValue;

        if (typeof sendEventOrValue !== "function") {
            throw new Error("Cannot apply effect presets because the patch connection cannot write parameter values.");
        }

        this.queueSuppressedPresetValues(preset);

        try {
            applyEffectPresetV2({
                patchConnection: {
                    sendParameterGestureStart: this.options.patchConnection.sendParameterGestureStart?.bind(this.options.patchConnection),
                    sendEventOrValue: sendEventOrValue.bind(this.options.patchConnection),
                    sendParameterGestureEnd: this.options.patchConnection.sendParameterGestureEnd?.bind(this.options.patchConnection),
                    sendStoredStateValue: this.options.patchConnection.sendStoredStateValue?.bind(this.options.patchConnection),
                },
                preset,
                currentContract: this.requireCurrentContract(),
                storedStateAdapters: this.storedStateAdapters,
                migrations: this.presetMigrations,
            });
        } catch (error) {
            this.suppressedParameterValues.clear();
            throw error;
        }
    }

    private queueSuppressedPresetValues(preset: EffectPresetV2) {
        for (const [endpointID, value] of Object.entries(preset.parameters)) {
            const queue = this.suppressedParameterValues.get(endpointID) ?? [];
            queue.push(value);
            this.suppressedParameterValues.set(endpointID, queue);
        }
    }

    private consumeSuppressedParameterValue(endpointID: string, value: EffectParameterValue) {
        const queue = this.suppressedParameterValues.get(endpointID);

        if (!queue || queue.length === 0) {
            return false;
        }

        const matchIndex = queue.findIndex((candidate) => valuesEqual(candidate, value));

        if (matchIndex === -1) {
            this.suppressedParameterValues.delete(endpointID);
            return false;
        }

        queue.splice(matchIndex, 1);

        if (queue.length === 0) {
            this.suppressedParameterValues.delete(endpointID);
        }

        return true;
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
