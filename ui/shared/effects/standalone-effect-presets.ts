import type { PatchConnectionLike } from "../cmajor-react";
import {
    applyEffectPreset,
    assertNoDuplicateJsonKeys,
    captureEffectPreset,
    createActivePresetMetadataFromPreset,
    EFFECT_PRESET_KIND,
    EFFECT_PRESET_SCHEMA_VERSION,
    normalizeEffectPreset,
    type EffectPreset,
    type EffectPresetActiveMetadata,
    type EffectPresetDescriptorRegistry,
    type EffectPresetState,
    type EffectPresetValue,
} from "./effect-preset-schema";
import {
    EFFECT_FACTORY_PRESETS,
    EFFECT_PRESET_DESCRIPTORS,
} from "./effect-preset-descriptors";
import { EffectPresetRuntimeBridge } from "./effect-preset-store";

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
    preset: EffectPreset;
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
    activePreset: EffectPresetActiveMetadata | null;
    activePresetID: string | null;
    activeLabel: string;
    dirty: boolean;
    currentValues: Record<string, EffectPresetValue>;
    missingCurrentValueEndpointIDs: string[];
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

export type StandaloneEffectPresetControllerOptions = {
    effectID: string;
    patchConnection: PatchConnectionLike;
    descriptorRegistry?: EffectPresetDescriptorRegistry;
    factoryPresets?: Record<string, EffectPreset[]>;
    createPresetID?: (context: {
        effectID: string;
        label: string;
        attempt: number;
    }) => string;
    readClipboardText?: () => string | Promise<string>;
    writeClipboardText?: (text: string) => void | Promise<void>;
};

export type StandaloneEffectPresetImportOptions = {
    applyAfterImport?: boolean;
    overwriteExisting?: boolean;
};

type StandaloneEffectPresetStateListener = (state: StandaloneEffectPresetState) => void;

type ResolvedPreset = {
    source: StandaloneEffectPresetSource;
    preset: EffectPreset;
};

const defaultFilter: StandaloneEffectPresetFilter = {
    query: "",
    source: "all",
};

function clonePreset(preset: EffectPreset): EffectPreset {
    return {
        ...preset,
        values: { ...preset.values },
    };
}

function clonePresets(presets: EffectPreset[]) {
    return presets.map(clonePreset);
}

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

function valuesEqual(left: EffectPresetValue | undefined, right: EffectPresetValue) {
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

export class StandaloneEffectPresetController {
    private readonly bridge: EffectPresetRuntimeBridge;
    private readonly descriptorRegistry: EffectPresetDescriptorRegistry;
    private readonly factoryPresetRegistry: Record<string, EffectPreset[]>;
    private readonly createPresetID: NonNullable<StandaloneEffectPresetControllerOptions["createPresetID"]>;
    private readonly readClipboardText?: StandaloneEffectPresetControllerOptions["readClipboardText"];
    private readonly writeClipboardText?: StandaloneEffectPresetControllerOptions["writeClipboardText"];
    private readonly listeners = new Set<StandaloneEffectPresetStateListener>();
    private readonly currentValues = new Map<string, EffectPresetValue>();
    private readonly hydratingEndpointIDs = new Set<string>();
    private readonly suppressedParameterValues = new Map<string, EffectPresetValue[]>();
    private readonly parameterListenerCleanups: Array<() => void> = [];
    private readonly handleBridgeStateBound: (state: EffectPresetState) => void;

    private bridgeState: EffectPresetState;
    private filter: StandaloneEffectPresetFilter = { ...defaultFilter };
    private attached = false;
    private ready = false;
    private lastError: string | null = null;

    constructor(private readonly options: StandaloneEffectPresetControllerOptions) {
        this.descriptorRegistry = options.descriptorRegistry ?? EFFECT_PRESET_DESCRIPTORS;
        this.factoryPresetRegistry = options.factoryPresets ?? EFFECT_FACTORY_PRESETS;
        this.createPresetID = options.createPresetID ?? defaultCreatePresetID;
        this.readClipboardText = options.readClipboardText;
        this.writeClipboardText = options.writeClipboardText;
        this.bridge = new EffectPresetRuntimeBridge(options.patchConnection, this.descriptorRegistry);
        this.bridgeState = this.bridge.getState();
        this.handleBridgeStateBound = this.handleBridgeState.bind(this);

        this.getDescriptor();
    }

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.bridge.subscribe(this.handleBridgeStateBound);
        this.bridge.attach();
        this.bridge.requestBootState();
        this.attachParameterListeners();
        this.ready = true;
        this.notify();
    }

    detach() {
        if (!this.attached) {
            return;
        }

        for (const cleanup of this.parameterListenerCleanups) {
            cleanup();
        }

        this.parameterListenerCleanups.length = 0;
        this.hydratingEndpointIDs.clear();
        this.suppressedParameterValues.clear();
        this.bridge.unsubscribe(this.handleBridgeStateBound);
        this.bridge.detach();
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

    applyPreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "apply effect presets");
            ensureParameterWriter(this.options.patchConnection, "apply effect presets");

            const { preset } = this.resolvePreset(presetKey);
            this.bridge.setActivePresetMetadata(this.options.effectID, createActivePresetMetadataFromPreset(preset));
            this.applyPresetValuesToPatch(preset);

            return clonePreset(preset);
        }, "Preset applied.");
    }

    reapplyActivePreset(): StandaloneEffectPresetMutationResult<EffectPreset> {
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

            this.bridge.setActivePresetMetadata(this.options.effectID, createActivePresetMetadataFromPreset(preset));
            this.applyPresetValuesToPatch(preset);

            return clonePreset(preset);
        }, "Preset reapplied.");
    }

    saveCurrentAsNewPreset(label: string): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "save effect presets");

            const normalizedLabel = normalizeLabel(label);
            const presetID = this.createUniqueUserPresetID(normalizedLabel);
            const preset = this.captureCurrentPreset(presetID, normalizedLabel);

            this.bridge.saveUserPreset(preset, { activate: true });
            return clonePreset(preset);
        }, "Preset saved.");
    }

    overwriteUserPreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "overwrite effect presets");

            const { source, preset } = this.resolvePreset(presetKey);

            if (source !== "user") {
                throw new Error("Factory presets cannot be overwritten.");
            }

            const nextPreset = this.captureCurrentPreset(preset.presetID, preset.label);
            this.bridge.saveUserPreset(nextPreset, { activate: true });

            return clonePreset(nextPreset);
        }, "Preset overwritten.");
    }

    renamePreset(presetKey: string, label: string): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "rename effect presets");

            const { source, preset } = this.resolvePreset(presetKey);

            if (source !== "user") {
                throw new Error("Factory presets cannot be renamed.");
            }

            const nextPreset = normalizeEffectPreset({
                ...preset,
                label: normalizeLabel(label),
            }, this.descriptorRegistry);
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

            return clonePreset(nextPreset);
        }, "Preset renamed.");
    }

    deletePreset(presetKey: string): StandaloneEffectPresetMutationResult<EffectPreset> {
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

            return clonePreset(preset);
        }, "Preset deleted.");
    }

    duplicatePresetAsUserPreset(presetKey: string, label: string): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "duplicate effect presets");

            const { preset } = this.resolvePreset(presetKey);
            const normalizedLabel = normalizeLabel(label);
            const nextPreset = normalizeEffectPreset({
                ...preset,
                presetID: this.createUniqueUserPresetID(normalizedLabel),
                label: normalizedLabel,
            }, this.descriptorRegistry);

            this.bridge.saveUserPreset(nextPreset);
            return clonePreset(nextPreset);
        }, "Preset duplicated.");
    }

    exportPresetText(presetKey: string): StandaloneEffectPresetMutationResult<string> {
        return this.runMutation(() => {
            const { preset } = this.resolvePreset(presetKey);
            return JSON.stringify(preset, null, 2);
        }, "Preset exported.");
    }

    importPresetText(
        text: string,
        options: StandaloneEffectPresetImportOptions = {},
    ): StandaloneEffectPresetMutationResult<EffectPreset> {
        return this.runMutation(() => {
            ensureStoredStateWriter(this.options.patchConnection, "import effect presets");

            const preset = this.parseImportText(text);
            this.assertUserPresetIDCanBeStored(preset.presetID, options.overwriteExisting === true);

            if (options.applyAfterImport) {
                ensureParameterWriter(this.options.patchConnection, "import and apply effect presets");
                this.bridge.saveUserPreset(preset, { activate: true });
                this.applyPresetValuesToPatch(preset);
            } else {
                this.bridge.saveUserPreset(preset);
            }

            return clonePreset(preset);
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
    ): Promise<StandaloneEffectPresetMutationResult<EffectPreset>> {
        try {
            const readClipboardText = this.readClipboardText ?? globalThis.navigator?.clipboard?.readText?.bind(globalThis.navigator.clipboard);

            if (!readClipboardText) {
                throw new Error("Clipboard read API is unavailable.");
            }

            const text = await readClipboardText();
            return this.importPresetText(text, options);
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    private handleBridgeState(state: EffectPresetState) {
        this.bridgeState = state;
        this.notify();
    }

    private attachParameterListeners() {
        const endpointIDs = Object.keys(this.getDescriptor().params);

        for (const endpointID of endpointIDs) {
            this.hydratingEndpointIDs.add(endpointID);

            const listener = (value: unknown) => this.handleParameterValue(endpointID, value);
            this.options.patchConnection.addParameterListener?.(endpointID, listener);
            this.parameterListenerCleanups.push(() => {
                this.options.patchConnection.removeParameterListener?.(endpointID, listener);
            });
        }

        this.requestCurrentParameterValues();
    }

    private requestCurrentParameterValues() {
        for (const endpointID of Object.keys(this.getDescriptor().params)) {
            this.options.patchConnection.requestParameterValue?.(endpointID);
        }
    }

    private handleParameterValue(endpointID: string, value: unknown) {
        let normalizedValue: EffectPresetValue;

        try {
            normalizedValue = this.normalizeEndpointValue(endpointID, value);
        } catch {
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
        const normalizedPreset = normalizeEffectPreset({
            kind: EFFECT_PRESET_KIND,
            version: EFFECT_PRESET_SCHEMA_VERSION,
            effectID: this.options.effectID,
            presetID: "current.endpoint",
            label: "Current Endpoint",
            values: {
                [endpointID]: value,
            },
        }, this.descriptorRegistry);
        const normalizedValue = normalizedPreset.values[endpointID];

        if (normalizedValue === undefined) {
            throw new Error(`No normalized value was produced for "${endpointID}".`);
        }

        return normalizedValue;
    }

    private markActivePresetDirtyIfNeeded(endpointID: string, value: EffectPresetValue) {
        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

        if (!activePreset || activePreset.dirty) {
            return;
        }

        const activePresetPayload = this.findPresetByID(activePreset.presetID);

        if (activePresetPayload && valuesEqual(activePresetPayload.values[endpointID], value)) {
            return;
        }

        this.bridge.setActivePresetMetadata(this.options.effectID, {
            ...activePreset,
            dirty: true,
        });
    }

    private getDescriptor() {
        const descriptor = this.descriptorRegistry[this.options.effectID];

        if (!descriptor) {
            throw new Error(`Unknown effectID "${this.options.effectID}".`);
        }

        return descriptor;
    }

    private getFactoryPresets() {
        return clonePresets(this.factoryPresetRegistry[this.options.effectID] ?? [])
            .map((preset) => normalizeEffectPreset(preset, this.descriptorRegistry));
    }

    private getUserPresets() {
        return clonePresets(this.bridgeState.userPresets[this.options.effectID] ?? []);
    }

    private buildPresetItems(source: StandaloneEffectPresetSource, presets: EffectPreset[]) {
        const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];

        return presets.map((preset): StandaloneEffectPresetListItem => {
            const isActive = activePreset?.presetID === preset.presetID;
            const isUser = source === "user";

            return {
                presetKey: presetKeyFor(source, preset.presetID),
                presetID: preset.presetID,
                label: preset.label,
                effectID: preset.effectID,
                source,
                preset: clonePreset(preset),
                isActive,
                dirty: Boolean(isActive && activePreset?.dirty),
                canApply: true,
                canRename: isUser,
                canOverwrite: isUser,
                canDelete: isUser,
                canExport: true,
            };
        });
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
        const values: Record<string, EffectPresetValue> = {};

        for (const endpointID of Object.keys(this.getDescriptor().params)) {
            if (this.currentValues.has(endpointID)) {
                values[endpointID] = this.currentValues.get(endpointID) as EffectPresetValue;
            }
        }

        return values;
    }

    private getMissingCurrentValueEndpointIDs() {
        return Object.keys(this.getDescriptor().params).filter((endpointID) => !this.currentValues.has(endpointID));
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
        const missingEndpointIDs = this.getMissingCurrentValueEndpointIDs();

        if (missingEndpointIDs.length > 0) {
            throw new Error(`Cannot save preset because current values are missing for ${missingEndpointIDs.join(", ")}.`);
        }

        return captureEffectPreset({
            effectID: this.options.effectID,
            presetID,
            label,
            currentValues: this.getCurrentValuesRecord(),
            descriptorRegistry: this.descriptorRegistry,
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

        assertNoDuplicateJsonKeys(text);
        const parsed = JSON.parse(text);
        const preset = normalizeEffectPreset(parsed, this.descriptorRegistry);

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

    private applyPresetValuesToPatch(preset: EffectPreset) {
        const sendEventOrValue = this.options.patchConnection.sendEventOrValue;

        if (typeof sendEventOrValue !== "function") {
            throw new Error("Cannot apply effect presets because the patch connection cannot write parameter values.");
        }

        this.queueSuppressedPresetValues(preset);

        try {
            applyEffectPreset({
                patchConnection: {
                    sendParameterGestureStart: this.options.patchConnection.sendParameterGestureStart?.bind(this.options.patchConnection),
                    sendEventOrValue: sendEventOrValue.bind(this.options.patchConnection),
                    sendParameterGestureEnd: this.options.patchConnection.sendParameterGestureEnd?.bind(this.options.patchConnection),
                },
                preset,
                descriptorRegistry: this.descriptorRegistry,
            });
        } catch (error) {
            this.suppressedParameterValues.clear();
            throw error;
        }
    }

    private queueSuppressedPresetValues(preset: EffectPreset) {
        for (const [endpointID, value] of Object.entries(preset.values)) {
            const queue = this.suppressedParameterValues.get(endpointID) ?? [];
            queue.push(value);
            this.suppressedParameterValues.set(endpointID, queue);
        }
    }

    private consumeSuppressedParameterValue(endpointID: string, value: EffectPresetValue) {
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
