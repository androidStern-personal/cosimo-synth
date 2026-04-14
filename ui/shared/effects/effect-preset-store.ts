import type { PatchConnectionLike } from "../cmajor-react";
import {
    applyEffectPreset,
    assertNoDuplicateJsonKeys,
    createActivePresetMetadataFromPreset,
    createDefaultEffectPresetState,
    deserializeEffectPresetState,
    normalizeEffectPreset,
    normalizeEffectPresetState,
    serializeEffectPresetState,
    type EffectPreset,
    type EffectPresetActiveMetadata,
    type EffectPresetDescriptorRegistry,
    type EffectPresetState,
} from "./effect-preset-schema";
import { EFFECT_PRESET_DESCRIPTORS } from "./effect-preset-descriptors";

export {
    createDefaultEffectPresetState,
    deserializeEffectPresetState,
    serializeEffectPresetState,
};

export const EFFECT_PRESETS_STATE_KEY = "effects.presets.v1";

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type EffectPresetStateListener = (state: EffectPresetState) => void;

function cloneState(state: EffectPresetState): EffectPresetState {
    return {
        kind: state.kind,
        version: state.version,
        userPresets: Object.fromEntries(Object.entries(state.userPresets).map(([effectID, presets]) => [
            effectID,
            presets.map((preset) => ({
                ...preset,
                values: { ...preset.values },
            })),
        ])),
        activePresetByEffect: Object.fromEntries(Object.entries(state.activePresetByEffect).map(([effectID, activePreset]) => [
            effectID,
            { ...activePreset },
        ])),
    };
}

function storedStateEchoToken(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function replacePresetInBank(bank: EffectPreset[], preset: EffectPreset) {
    const nextBank = bank.filter((candidate) => candidate.presetID !== preset.presetID);
    nextBank.push(preset);
    return nextBank;
}

export class EffectPresetRuntimeBridge {
    private state: EffectPresetState;
    private attached = false;
    private readonly listeners = new Set<EffectPresetStateListener>();
    private readonly pendingStoredStateEchoes = new Map<string, number>();
    private readonly handleStoredStateValueBound: (message: unknown) => void;

    constructor(
        private readonly patchConnection: PatchConnectionLike,
        private readonly descriptorRegistry: EffectPresetDescriptorRegistry = EFFECT_PRESET_DESCRIPTORS,
    ) {
        this.state = createDefaultEffectPresetState();
        this.handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
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
                const value = storedState?.[EFFECT_PRESETS_STATE_KEY];

                if (value === undefined && typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.patchConnection.requestStoredStateValue(EFFECT_PRESETS_STATE_KEY);
                    return;
                }

                this.applyStoredState(value);
            });
            return;
        }

        this.patchConnection.requestStoredStateValue?.(EFFECT_PRESETS_STATE_KEY);
    }

    getState() {
        return cloneState(this.state);
    }

    subscribe(listener: EffectPresetStateListener) {
        this.listeners.add(listener);
    }

    unsubscribe(listener: EffectPresetStateListener) {
        this.listeners.delete(listener);
    }

    saveUserPreset(preset: unknown, options: { activate?: boolean } = {}) {
        const normalizedPreset = normalizeEffectPreset(preset, this.descriptorRegistry);
        const currentBank = this.state.userPresets[normalizedPreset.effectID] ?? [];
        const nextActivePresetByEffect = options.activate
            ? {
                ...this.state.activePresetByEffect,
                [normalizedPreset.effectID]: createActivePresetMetadataFromPreset(normalizedPreset),
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

        return normalizedPreset;
    }

    setUserPresetsForEffect(
        effectID: string,
        presets: unknown[],
        activePresetMetadata?: EffectPresetActiveMetadata | null,
    ) {
        const activePresetByEffect = { ...this.state.activePresetByEffect };

        if (activePresetMetadata === null) {
            delete activePresetByEffect[effectID];
        } else if (activePresetMetadata !== undefined) {
            activePresetByEffect[effectID] = activePresetMetadata;
        }

        const nextState = this.commitState({
            ...this.state,
            userPresets: {
                ...this.state.userPresets,
                [effectID]: presets,
            },
            activePresetByEffect,
        });

        return nextState.userPresets[effectID] ?? [];
    }

    applyPreset(preset: unknown) {
        if (typeof this.patchConnection.sendEventOrValue !== "function") {
            throw new Error("Cannot apply effect preset because the patch connection cannot write parameter values.");
        }

        const normalizedPreset = normalizeEffectPreset(preset, this.descriptorRegistry);

        this.commitState({
            ...this.state,
            activePresetByEffect: {
                ...this.state.activePresetByEffect,
                [normalizedPreset.effectID]: createActivePresetMetadataFromPreset(normalizedPreset),
            },
        });

        applyEffectPreset({
            patchConnection: {
                sendParameterGestureStart: this.patchConnection.sendParameterGestureStart?.bind(this.patchConnection),
                sendEventOrValue: this.patchConnection.sendEventOrValue.bind(this.patchConnection),
                sendParameterGestureEnd: this.patchConnection.sendParameterGestureEnd?.bind(this.patchConnection),
            },
            preset: normalizedPreset,
            descriptorRegistry: this.descriptorRegistry,
        });

        return normalizedPreset;
    }

    setActivePresetMetadata(effectID: string, metadata: EffectPresetActiveMetadata) {
        this.commitState({
            ...this.state,
            activePresetByEffect: {
                ...this.state.activePresetByEffect,
                [effectID]: metadata,
            },
        });
    }

    importPresetText(text: string) {
        if (typeof text !== "string") {
            throw new Error("Preset import text must be a string.");
        }

        assertNoDuplicateJsonKeys(text);
        const parsed = JSON.parse(text);
        const preset = normalizeEffectPreset(parsed, this.descriptorRegistry);
        this.saveUserPreset(preset);
        return preset;
    }

    private applyStoredState(rawValue: unknown) {
        try {
            this.setState(deserializeEffectPresetState(rawValue, this.descriptorRegistry));
        } catch {
            this.setState(createDefaultEffectPresetState());
        }
    }

    private handleStoredStateValue(message: unknown) {
        const nextMessage = message as StoredStateMessage;

        if (nextMessage?.key !== EFFECT_PRESETS_STATE_KEY) {
            return;
        }

        if (this.consumePendingStoredStateEcho(nextMessage.value)) {
            return;
        }

        this.applyStoredState(nextMessage.value);
    }

    private setState(nextState: EffectPresetState) {
        this.state = cloneState(nextState);
        this.notify();
    }

    private notify() {
        const snapshot = this.getState();

        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    private commitState(nextState: unknown) {
        const normalizedState = normalizeEffectPresetState(nextState, this.descriptorRegistry);
        const serializedState = serializeEffectPresetState(normalizedState, this.descriptorRegistry);
        const sendStoredStateValue = this.patchConnection.sendStoredStateValue?.bind(this.patchConnection);

        if (sendStoredStateValue) {
            this.rememberPendingStoredStateEcho(serializedState);

            try {
                sendStoredStateValue(EFFECT_PRESETS_STATE_KEY, serializedState);
            } catch (error) {
                this.consumePendingStoredStateEcho(serializedState);
                throw error;
            }
        }

        this.setState(normalizedState);

        return this.getState();
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

type SharedEffectPresetBridgeEntry = {
    bridge: EffectPresetRuntimeBridge;
    references: number;
};

const sharedEffectPresetRuntimeBridges = new WeakMap<PatchConnectionLike, SharedEffectPresetBridgeEntry>();

export function acquireEffectPresetRuntimeBridge(patchConnection: PatchConnectionLike) {
    const existingEntry = sharedEffectPresetRuntimeBridges.get(patchConnection);

    if (existingEntry) {
        existingEntry.references += 1;
        return existingEntry.bridge;
    }

    const bridge = new EffectPresetRuntimeBridge(patchConnection);
    bridge.attach();
    bridge.requestBootState();

    sharedEffectPresetRuntimeBridges.set(patchConnection, {
        bridge,
        references: 1,
    });

    return bridge;
}

export function releaseEffectPresetRuntimeBridge(patchConnection: PatchConnectionLike) {
    const entry = sharedEffectPresetRuntimeBridges.get(patchConnection);

    if (!entry) {
        return;
    }

    entry.references -= 1;

    if (entry.references > 0) {
        return;
    }

    entry.bridge.detach();
    sharedEffectPresetRuntimeBridges.delete(patchConnection);
}
