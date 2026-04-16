import type { PatchConnectionLike } from "../cmajor-react";
import {
    cloneEffectPresetV2,
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    type EffectPresetV2,
} from "./effect-preset-v2";
import {
    type EffectPresetActiveMetadata,
} from "./effect-preset-schema";

export const EFFECT_PRESETS_V2_STATE_KEY = "effects.presets.v2";
export const EFFECT_PRESET_V2_STATE_KIND = "cosimo.effectPresetState";
export const EFFECT_PRESET_V2_STATE_SCHEMA_VERSION = 2;

export type EffectPresetStateV2 = {
    kind: typeof EFFECT_PRESET_V2_STATE_KIND;
    version: typeof EFFECT_PRESET_V2_STATE_SCHEMA_VERSION;
    userPresets: Record<string, EffectPresetV2[]>;
    activePresetByEffect: Record<string, EffectPresetActiveMetadata>;
};

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type ChocUserFiles = {
    list: (scope: string) => Promise<string[]>;
    read: (scope: string, fileName: string) => Promise<string>;
    write: (scope: string, fileName: string, contents: string) => Promise<unknown>;
    delete: (scope: string, fileName: string) => Promise<unknown>;
};

type EffectPresetStateV2Listener = (state: EffectPresetStateV2) => void;
type EffectPresetStateV2ErrorListener = (error: Error) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
}

function requireBoolean(value: unknown, fieldName: string) {
    if (typeof value !== "boolean") {
        throw new Error(`${fieldName} must be a boolean.`);
    }

    return value;
}

function cloneActivePresetMetadata(metadata: EffectPresetActiveMetadata): EffectPresetActiveMetadata {
    return {
        presetID: metadata.presetID,
        label: metadata.label,
        dirty: metadata.dirty,
    };
}

function normalizeActivePresetMetadata(effectID: string, payload: unknown): EffectPresetActiveMetadata {
    if (!isPlainObject(payload)) {
        throw new Error(`Active preset metadata for "${effectID}" must be an object.`);
    }

    return {
        presetID: requireString(payload.presetID, `activePresetByEffect.${effectID}.presetID`),
        label: requireString(payload.label, `activePresetByEffect.${effectID}.label`),
        dirty: requireBoolean(payload.dirty, `activePresetByEffect.${effectID}.dirty`),
    };
}

function normalizePresetShape(payload: unknown): EffectPresetV2 {
    if (!isPlainObject(payload)) {
        throw new Error("Effect preset payload must be an object.");
    }

    if (payload.kind !== EFFECT_PRESET_V2_KIND) {
        throw new Error(`Effect preset kind must be "${EFFECT_PRESET_V2_KIND}".`);
    }

    if (payload.version !== EFFECT_PRESET_V2_SCHEMA_VERSION) {
        throw new Error(`Unsupported effect preset version "${String(payload.version)}".`);
    }

    if (!isPlainObject(payload.contract) || typeof payload.contract.hash !== "string") {
        throw new Error("Effect preset contract with hash is required.");
    }

    if (!isPlainObject(payload.parameters)) {
        throw new Error("Effect preset parameters must be an object.");
    }

    if (!isPlainObject(payload.storedState)) {
        throw new Error("Effect preset storedState must be an object.");
    }

    return cloneEffectPresetV2({
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID: requireString(payload.effectID, "effectID"),
        presetID: requireString(payload.presetID, "presetID"),
        label: requireString(payload.label, "label"),
        contract: payload.contract as EffectPresetV2["contract"],
        parameters: { ...payload.parameters } as EffectPresetV2["parameters"],
        storedState: { ...payload.storedState },
    });
}

function cloneState(state: EffectPresetStateV2): EffectPresetStateV2 {
    return {
        kind: state.kind,
        version: state.version,
        userPresets: Object.fromEntries(Object.entries(state.userPresets).map(([effectID, presets]) => [
            effectID,
            presets.map(cloneEffectPresetV2),
        ])),
        activePresetByEffect: Object.fromEntries(Object.entries(state.activePresetByEffect).map(([effectID, metadata]) => [
            effectID,
            cloneActivePresetMetadata(metadata),
        ])),
    };
}

function storedStateEchoToken(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function errorFromUnknown(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function replacePresetInBank(bank: EffectPresetV2[], preset: EffectPresetV2) {
    const nextBank = bank.filter((candidate) => candidate.presetID !== preset.presetID);
    nextBank.push(cloneEffectPresetV2(preset));
    return nextBank;
}

function getChocUserFiles(): ChocUserFiles | null {
    const candidate = (globalThis as typeof globalThis & {
        chocUserFiles?: ChocUserFiles;
        window?: { chocUserFiles?: ChocUserFiles };
    }).chocUserFiles ?? (globalThis as typeof globalThis & {
        window?: { chocUserFiles?: ChocUserFiles };
    }).window?.chocUserFiles;

    if (!candidate) {
        return null;
    }

    if (
        typeof candidate.list !== "function"
        || typeof candidate.read !== "function"
        || typeof candidate.write !== "function"
        || typeof candidate.delete !== "function"
    ) {
        throw new Error("window.chocUserFiles is missing list, read, write, or delete.");
    }

    return candidate;
}

function userPresetFileName(presetID: string) {
    return `${presetID}.json`;
}

export function createDefaultEffectPresetStateV2(): EffectPresetStateV2 {
    return {
        kind: EFFECT_PRESET_V2_STATE_KIND,
        version: EFFECT_PRESET_V2_STATE_SCHEMA_VERSION,
        userPresets: {},
        activePresetByEffect: {},
    };
}

export function createActivePresetMetadataFromPresetV2(preset: EffectPresetV2): EffectPresetActiveMetadata {
    return {
        presetID: preset.presetID,
        label: preset.label,
        dirty: false,
    };
}

export function normalizeEffectPresetStateV2(payload: unknown): EffectPresetStateV2 {
    if (!isPlainObject(payload)) {
        throw new Error("Effect preset state payload must be an object.");
    }

    if (payload.kind !== EFFECT_PRESET_V2_STATE_KIND) {
        throw new Error(`Effect preset state kind must be "${EFFECT_PRESET_V2_STATE_KIND}".`);
    }

    if (payload.version !== EFFECT_PRESET_V2_STATE_SCHEMA_VERSION) {
        throw new Error(`Unsupported effect preset state version "${String(payload.version)}".`);
    }

    if (!isPlainObject(payload.userPresets)) {
        throw new Error("Effect preset state userPresets must be an object.");
    }

    if (!isPlainObject(payload.activePresetByEffect)) {
        throw new Error("Effect preset state activePresetByEffect must be an object.");
    }

    const userPresets: Record<string, EffectPresetV2[]> = {};
    const activePresetByEffect: Record<string, EffectPresetActiveMetadata> = {};

    for (const [effectID, rawPresets] of Object.entries(payload.userPresets)) {
        if (!Array.isArray(rawPresets)) {
            throw new Error(`Effect preset bank "${effectID}" must be an array.`);
        }

        userPresets[effectID] = rawPresets.map((rawPreset) => {
            const preset = normalizePresetShape(rawPreset);

            if (preset.effectID !== effectID) {
                throw new Error(`Effect preset bank "${effectID}" contains preset "${preset.presetID}" for effect "${preset.effectID}".`);
            }

            return preset;
        });
    }

    for (const [effectID, rawMetadata] of Object.entries(payload.activePresetByEffect)) {
        activePresetByEffect[effectID] = normalizeActivePresetMetadata(effectID, rawMetadata);
    }

    return {
        kind: EFFECT_PRESET_V2_STATE_KIND,
        version: EFFECT_PRESET_V2_STATE_SCHEMA_VERSION,
        userPresets,
        activePresetByEffect,
    };
}

export function serializeEffectPresetStateV2(state: EffectPresetStateV2) {
    return JSON.stringify(normalizeEffectPresetStateV2(state));
}

export function deserializeEffectPresetStateV2(rawValue: unknown) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return createDefaultEffectPresetStateV2();
    }

    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    return normalizeEffectPresetStateV2(parsed);
}

export class EffectPresetRuntimeBridgeV2 {
    private state: EffectPresetStateV2;
    private attached = false;
    private readonly listeners = new Set<EffectPresetStateV2Listener>();
    private readonly errorListeners = new Set<EffectPresetStateV2ErrorListener>();
    private readonly pendingStoredStateEchoes = new Map<string, number>();
    private readonly handleStoredStateValueBound: (message: unknown) => void;
    private readonly userFiles: ChocUserFiles | null;

    constructor(
        private readonly patchConnection: PatchConnectionLike,
        private readonly options: { fileStoreEffectID?: string } = {},
    ) {
        this.state = createDefaultEffectPresetStateV2();
        this.handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
        this.userFiles = getChocUserFiles();
    }

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.attached = false;
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                const value = storedState?.[EFFECT_PRESETS_V2_STATE_KEY];

                if (value === undefined && typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.patchConnection.requestStoredStateValue(EFFECT_PRESETS_V2_STATE_KEY);
                    void this.loadUserPresetFiles();
                    return;
                }

                this.applyStoredState(value);
                void this.loadUserPresetFiles();
            });
            return;
        }

        this.patchConnection.requestStoredStateValue?.(EFFECT_PRESETS_V2_STATE_KEY);
        void this.loadUserPresetFiles();
    }

    getState() {
        return cloneState(this.state);
    }

    subscribe(listener: EffectPresetStateV2Listener) {
        this.listeners.add(listener);
    }

    unsubscribe(listener: EffectPresetStateV2Listener) {
        this.listeners.delete(listener);
    }

    subscribeErrors(listener: EffectPresetStateV2ErrorListener) {
        this.errorListeners.add(listener);
    }

    unsubscribeErrors(listener: EffectPresetStateV2ErrorListener) {
        this.errorListeners.delete(listener);
    }

    saveUserPreset(preset: EffectPresetV2, options: { activate?: boolean } = {}) {
        const normalizedPreset = normalizePresetShape(preset);
        const currentBank = this.state.userPresets[normalizedPreset.effectID] ?? [];
        const nextActivePresetByEffect = options.activate
            ? {
                ...this.state.activePresetByEffect,
                [normalizedPreset.effectID]: createActivePresetMetadataFromPresetV2(normalizedPreset),
            }
            : this.state.activePresetByEffect;

        this.commitState({
            ...this.state,
            userPresets: {
                ...this.state.userPresets,
                [normalizedPreset.effectID]: replacePresetInBank(currentBank, normalizedPreset),
            },
            activePresetByEffect: nextActivePresetByEffect,
        });

        this.writeUserPresetFile(normalizedPreset);

        return normalizedPreset;
    }

    setUserPresetsForEffect(
        effectID: string,
        presets: EffectPresetV2[],
        activePresetMetadata?: EffectPresetActiveMetadata | null,
    ) {
        const activePresetByEffect = { ...this.state.activePresetByEffect };

        if (activePresetMetadata === null) {
            delete activePresetByEffect[effectID];
        } else if (activePresetMetadata !== undefined) {
            activePresetByEffect[effectID] = cloneActivePresetMetadata(activePresetMetadata);
        }

        const nextState = this.commitState({
            ...this.state,
            userPresets: {
                ...this.state.userPresets,
                [effectID]: presets.map(normalizePresetShape),
            },
            activePresetByEffect,
        });

        this.syncUserPresetFilesForEffect(effectID, nextState.userPresets[effectID] ?? []);

        return nextState.userPresets[effectID] ?? [];
    }

    setActivePresetMetadata(effectID: string, metadata: EffectPresetActiveMetadata) {
        this.commitState({
            ...this.state,
            activePresetByEffect: {
                ...this.state.activePresetByEffect,
                [effectID]: cloneActivePresetMetadata(metadata),
            },
        });
    }

    replaceState(state: EffectPresetStateV2) {
        const nextState = this.commitState(state);

        for (const [effectID, presets] of Object.entries(nextState.userPresets)) {
            this.syncUserPresetFilesForEffect(effectID, presets);
        }

        return nextState;
    }

    private applyStoredState(rawValue: unknown) {
        try {
            const storedState = deserializeEffectPresetStateV2(rawValue);
            this.setState(this.userFiles ? {
                ...storedState,
                userPresets: this.state.userPresets,
            } : storedState);
        } catch (error) {
            this.notifyError(errorFromUnknown(error));
        }
    }

    private handleStoredStateValue(message: unknown) {
        const nextMessage = message as StoredStateMessage;

        if (nextMessage?.key !== EFFECT_PRESETS_V2_STATE_KEY) {
            return;
        }

        if (this.consumePendingStoredStateEcho(nextMessage.value)) {
            return;
        }

        this.applyStoredState(nextMessage.value);
    }

    private setState(nextState: EffectPresetStateV2) {
        this.state = cloneState(nextState);
        this.notify();
    }

    private notify() {
        const snapshot = this.getState();

        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    private notifyError(error: Error) {
        for (const listener of this.errorListeners) {
            listener(error);
        }
    }

    private commitState(nextState: EffectPresetStateV2) {
        const normalizedState = normalizeEffectPresetStateV2(nextState);
        const storedState = this.userFiles ? {
            ...normalizedState,
            userPresets: {},
        } : normalizedState;
        const serializedState = serializeEffectPresetStateV2(storedState);
        const sendStoredStateValue = this.patchConnection.sendStoredStateValue?.bind(this.patchConnection);

        if (sendStoredStateValue) {
            this.rememberPendingStoredStateEcho(serializedState);

            try {
                sendStoredStateValue(EFFECT_PRESETS_V2_STATE_KEY, serializedState);
            } catch (error) {
                this.consumePendingStoredStateEcho(serializedState);
                throw error;
            }
        }

        this.setState(normalizedState);

        return this.getState();
    }

    private async loadUserPresetFiles() {
        if (!this.userFiles || !this.options.fileStoreEffectID) {
            return;
        }

        try {
            const effectID = this.options.fileStoreEffectID;
            const fileNames = (await this.userFiles.list(effectID)).filter((fileName) => fileName.endsWith(".json"));
            const presets: EffectPresetV2[] = [];

            for (const fileName of fileNames) {
                const preset = normalizePresetShape(JSON.parse(await this.userFiles.read(effectID, fileName)));

                if (preset.effectID !== effectID) {
                    throw new Error(`Preset file "${fileName}" contains effect "${preset.effectID}" instead of "${effectID}".`);
                }

                presets.push(preset);
            }

            this.setState({
                ...this.state,
                userPresets: {
                    ...this.state.userPresets,
                    [effectID]: presets,
                },
            });
        } catch (error) {
            this.notifyError(errorFromUnknown(error));
        }
    }

    private writeUserPresetFile(preset: EffectPresetV2) {
        if (!this.userFiles || !this.options.fileStoreEffectID || preset.effectID !== this.options.fileStoreEffectID) {
            return;
        }

        void this.userFiles
            .write(preset.effectID, userPresetFileName(preset.presetID), JSON.stringify(normalizePresetShape(preset), null, 2))
            .catch((error: unknown) => this.notifyError(errorFromUnknown(error)));
    }

    private syncUserPresetFilesForEffect(effectID: string, presets: EffectPresetV2[]) {
        if (!this.userFiles || effectID !== this.options.fileStoreEffectID) {
            return;
        }

        void this.syncUserPresetFilesForEffectAsync(effectID, presets)
            .catch((error: unknown) => this.notifyError(errorFromUnknown(error)));
    }

    private async syncUserPresetFilesForEffectAsync(effectID: string, presets: EffectPresetV2[]) {
        if (!this.userFiles) {
            return;
        }

        const nextFileNames = new Set(presets.map((preset) => userPresetFileName(preset.presetID)));
        const existingFileNames = (await this.userFiles.list(effectID)).filter((fileName) => fileName.endsWith(".json"));

        await Promise.all(presets.map((preset) => (
            this.userFiles!.write(effectID, userPresetFileName(preset.presetID), JSON.stringify(normalizePresetShape(preset), null, 2))
        )));

        await Promise.all(existingFileNames
            .filter((fileName) => !nextFileNames.has(fileName))
            .map((fileName) => this.userFiles!.delete(effectID, fileName)));
    }

    private rememberPendingStoredStateEcho(value: unknown) {
        const token = storedStateEchoToken(value);
        this.pendingStoredStateEchoes.set(token, (this.pendingStoredStateEchoes.get(token) ?? 0) + 1);
    }

    private consumePendingStoredStateEcho(value: unknown) {
        const token = storedStateEchoToken(value);
        const count = this.pendingStoredStateEchoes.get(token);

        if (!count) {
            return false;
        }

        if (count <= 1) {
            this.pendingStoredStateEchoes.delete(token);
        } else {
            this.pendingStoredStateEchoes.set(token, count - 1);
        }

        return true;
    }
}
