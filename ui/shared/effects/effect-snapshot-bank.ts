import type { PatchConnectionLike } from "../cmajor-react";
import {
    buildPluginStateContract,
    clonePluginStateContract,
    type EffectParameterValue,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import {
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    type EffectPresetV2,
    type EffectStoredStateAdapter,
} from "./effect-preset-v2";
import {
    EFFECT_SNAPSHOT_KIND,
    EFFECT_SNAPSHOT_SCHEMA_VERSION,
    applyEffectSnapshot,
    captureEffectSnapshot,
    normalizeEffectSnapshot,
    parseEffectSnapshotText,
    type EffectSnapshot,
    type EffectSnapshotMigration,
} from "./effect-snapshots";

export const EFFECT_SNAPSHOT_BANK_KIND = "cosimo.effectSnapshotBank";
export const EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION = 1;
export const DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export type EffectSnapshotSlotID = typeof DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS[number] | string;

export type EffectSnapshotBank = {
    kind: typeof EFFECT_SNAPSHOT_BANK_KIND;
    version: typeof EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION;
    effectID: string;
    activeSlotID: string | null;
    slots: Record<string, EffectSnapshot | null>;
};

export type EffectSnapshotBankState = EffectSnapshotBank & {
    ready: boolean;
    slotIDs: string[];
    currentContract: EffectPluginStateContract | null;
    currentValues: Record<string, EffectParameterValue>;
    lastMessage: string | null;
    lastError: string | null;
};

export type EffectSnapshotBankMutationResult<T> = {
    ok: true;
    value: T;
    message: string;
} | {
    ok: false;
    error: Error;
    message: string;
};

export type EffectSnapshotBankControllerOptions = {
    effectID: string;
    patchConnection: PatchConnectionLike;
    storedStateKey?: string;
    slotIDs?: readonly string[];
    storedStateAdapters?: EffectStoredStateAdapter[];
    snapshotMigrations?: EffectSnapshotMigration[];
    legacyBankProvider?: (context: { fullStoredState?: Record<string, unknown> }) => unknown | null | undefined;
    readClipboardText?: () => string | Promise<string>;
    writeClipboardText?: (text: string) => void | Promise<void>;
};

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type SnapshotBankListener = (state: EffectSnapshotBankState) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneSnapshot(snapshot: EffectSnapshot): EffectSnapshot {
    return {
        kind: snapshot.kind,
        version: snapshot.version,
        effectID: snapshot.effectID,
        slotID: snapshot.slotID,
        label: snapshot.label,
        contract: clonePluginStateContract(snapshot.contract),
        parameters: { ...snapshot.parameters },
        storedState: { ...snapshot.storedState },
    };
}

function cloneBank(bank: EffectSnapshotBank): EffectSnapshotBank {
    return {
        kind: EFFECT_SNAPSHOT_BANK_KIND,
        version: EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION,
        effectID: bank.effectID,
        activeSlotID: bank.activeSlotID,
        slots: Object.fromEntries(
            Object.entries(bank.slots).map(([slotID, snapshot]) => [
                slotID,
                snapshot ? cloneSnapshot(snapshot) : null,
            ]),
        ),
    };
}

function cloneCurrentValues(values: Map<string, EffectParameterValue>) {
    return Object.fromEntries(values.entries());
}

function errorFromUnknown(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function storedStateToken(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function requireString(value: unknown, label: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${label} must be a non-empty string.`);
    }

    return value.trim();
}

function createSlots(slotIDs: readonly string[]) {
    return Object.fromEntries(slotIDs.map((slotID) => [slotID, null])) as Record<string, EffectSnapshot | null>;
}

function normalizeSlotID(slotIDs: readonly string[], value: unknown) {
    return typeof value === "string" && slotIDs.includes(value) ? value : null;
}

function presetToSnapshot(preset: EffectPresetV2, slotID: string): EffectSnapshot {
    return {
        kind: EFFECT_SNAPSHOT_KIND,
        version: EFFECT_SNAPSHOT_SCHEMA_VERSION,
        effectID: preset.effectID,
        slotID,
        label: preset.label,
        contract: preset.contract,
        parameters: { ...preset.parameters },
        storedState: { ...preset.storedState },
    };
}

function parseBankShape(payload: unknown) {
    if (!isPlainObject(payload)) {
        throw new Error("Snapshot bank must be an object.");
    }

    if (payload.kind !== EFFECT_SNAPSHOT_BANK_KIND) {
        throw new Error(`Snapshot bank kind must be "${EFFECT_SNAPSHOT_BANK_KIND}".`);
    }

    if (payload.version !== EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION) {
        throw new Error(`Snapshot bank version must be ${EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION}.`);
    }

    if (!isPlainObject(payload.slots)) {
        throw new Error("Snapshot bank slots must be an object.");
    }

    return {
        effectID: requireString(payload.effectID, "Snapshot bank effectID"),
        activeSlotID: payload.activeSlotID,
        slots: payload.slots,
    };
}

export function snapshotBankStoredStateKey(effectID: string) {
    return `cosimo.effectSnapshotBank.${effectID}.v1`;
}

export function createEmptyEffectSnapshotBank({
    effectID,
    slotIDs = DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS,
}: {
    effectID: string;
    slotIDs?: readonly string[];
}): EffectSnapshotBank {
    return {
        kind: EFFECT_SNAPSHOT_BANK_KIND,
        version: EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION,
        effectID,
        activeSlotID: null,
        slots: createSlots(slotIDs),
    };
}

export function normalizeEffectSnapshotBank(
    payload: unknown,
    {
        effectID,
        slotIDs = DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS,
        currentContract,
        storedStateAdapters = [],
        snapshotMigrations = [],
    }: {
        effectID: string;
        slotIDs?: readonly string[];
        currentContract: EffectPluginStateContract;
        storedStateAdapters?: EffectStoredStateAdapter[];
        snapshotMigrations?: EffectSnapshotMigration[];
    },
): EffectSnapshotBank {
    const parsed = parseBankShape(payload);

    if (parsed.effectID !== effectID) {
        throw new Error(`Cannot load ${parsed.effectID} snapshot bank into ${effectID}.`);
    }

    const slots = createSlots(slotIDs);

    for (const slotID of slotIDs) {
        const snapshot = parsed.slots[slotID];

        if (snapshot === null || snapshot === undefined) {
            slots[slotID] = null;
            continue;
        }

        slots[slotID] = normalizeEffectSnapshot({
            ...(snapshot as EffectSnapshot),
            slotID,
        }, {
            currentContract,
            storedStateAdapters,
            migrations: snapshotMigrations,
        });
    }

    const activeSlotID = normalizeSlotID(slotIDs, parsed.activeSlotID);

    return {
        kind: EFFECT_SNAPSHOT_BANK_KIND,
        version: EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION,
        effectID,
        activeSlotID: activeSlotID && slots[activeSlotID] ? activeSlotID : null,
        slots,
    };
}

export class EffectSnapshotBankController {
    private readonly effectID: string;
    private readonly patchConnection: PatchConnectionLike;
    private readonly storedStateKey: string;
    private readonly slotIDs: readonly string[];
    private readonly storedStateAdapters: EffectStoredStateAdapter[];
    private readonly snapshotMigrations: EffectSnapshotMigration[];
    private readonly listeners = new Set<SnapshotBankListener>();
    private readonly parameterListenerCleanups: Array<() => void> = [];
    private readonly storedAdapterCleanups: Array<() => void> = [];
    private readonly currentValues = new Map<string, EffectParameterValue>();
    private readonly hydratingEndpointIDs = new Set<string>();
    private readonly readClipboardText?: EffectSnapshotBankControllerOptions["readClipboardText"];
    private readonly writeClipboardText?: EffectSnapshotBankControllerOptions["writeClipboardText"];
    private readonly handleStatusBound: (status: unknown) => void;
    private readonly handleStoredStateValueBound: (message: unknown) => void;
    private currentContract: EffectPluginStateContract | null = null;
    private bank: EffectSnapshotBank;
    private attached = false;
    private ready = false;
    private lastMessage: string | null = null;
    private lastError: string | null = null;
    private rawStoredBank: unknown = undefined;
    private hasRawStoredBank = false;
    private bootFullStoredState: Record<string, unknown> | undefined;
    private localRevision = 0;
    private pendingStoredStateValueRevision: number | null = null;
    private readonly pendingStoredEchoes = new Map<string, number>();
    private suppressActiveSlotCaptureDepth = 0;

    constructor(private readonly options: EffectSnapshotBankControllerOptions) {
        this.effectID = requireString(options.effectID, "Snapshot bank controller effectID");
        this.patchConnection = options.patchConnection;
        this.storedStateKey = options.storedStateKey ?? snapshotBankStoredStateKey(this.effectID);
        this.slotIDs = options.slotIDs ?? DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS;
        this.storedStateAdapters = options.storedStateAdapters ?? [];
        this.snapshotMigrations = options.snapshotMigrations ?? [];
        this.readClipboardText = options.readClipboardText;
        this.writeClipboardText = options.writeClipboardText;
        this.bank = createEmptyEffectSnapshotBank({ effectID: this.effectID, slotIDs: this.slotIDs });
        this.handleStatusBound = this.handleStatus.bind(this);
        this.handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
    }

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.patchConnection.addStatusListener?.(this.handleStatusBound);
        this.attachStoredStateAdapterListeners();
        this.requestBootState();
        this.patchConnection.requestStatusUpdate?.();
        this.notify();
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.detachParameterListeners();
        this.detachStoredStateAdapterListeners();
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.patchConnection.removeStatusListener?.(this.handleStatusBound);
        this.attached = false;
        this.ready = false;
        this.notify();
    }

    subscribe(listener: SnapshotBankListener) {
        this.listeners.add(listener);
        listener(this.getState());

        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): EffectSnapshotBankState {
        return {
            ...cloneBank(this.bank),
            ready: this.ready,
            slotIDs: [...this.slotIDs],
            currentContract: this.currentContract ? clonePluginStateContract(this.currentContract) : null,
            currentValues: cloneCurrentValues(this.currentValues),
            lastMessage: this.lastMessage,
            lastError: this.lastError,
        };
    }

    getMutations() {
        return {
            selectSlot: this.selectSlot.bind(this),
            updateActiveSlotLabel: this.updateActiveSlotLabel.bind(this),
            updateActiveSlotFromPreset: this.updateActiveSlotFromPreset.bind(this),
            exportSnapshotText: this.exportSnapshotText.bind(this),
            importSnapshotText: this.importSnapshotText.bind(this),
            copySnapshotToClipboard: this.copySnapshotToClipboard.bind(this),
            pasteSnapshotFromClipboard: this.pasteSnapshotFromClipboard.bind(this),
            clearLastMessage: this.clearLastMessage.bind(this),
        };
    }

    clearLastMessage() {
        this.lastMessage = null;
        this.lastError = null;
        this.notify();
    }

    selectSlot(slotID: string): EffectSnapshotBankMutationResult<EffectSnapshot> {
        return this.runMutation(() => {
            this.requireKnownSlot(slotID);
            const existing = this.bank.slots[slotID];

            if (existing) {
                return this.recallSlot(slotID, existing);
            }

            const snapshot = this.captureCurrentSnapshot(slotID, "");
            const nextBank = {
                ...this.bank,
                activeSlotID: slotID,
                slots: {
                    ...this.bank.slots,
                    [slotID]: snapshot,
                },
            };
            this.commitBank(nextBank);
            return cloneSnapshot(snapshot);
        }, `Active ${slotID}.`);
    }

    updateActiveSlotLabel(label: string): EffectSnapshotBankMutationResult<EffectSnapshot | null> {
        return this.runMutation(() => {
            const slotID = this.bank.activeSlotID;

            if (!slotID) {
                return null;
            }

            const snapshot = this.bank.slots[slotID] ?? this.captureCurrentSnapshot(slotID, label);
            const nextSnapshot = {
                ...snapshot,
                label,
            };
            const nextBank = this.bankWithSlot(slotID, nextSnapshot);
            this.commitBank(nextBank);
            return cloneSnapshot(nextBank.slots[slotID]!);
        }, "Snapshot label updated.");
    }

    updateActiveSlotFromPreset(preset: EffectPresetV2): EffectSnapshotBankMutationResult<EffectSnapshot | null> {
        return this.runMutation(() => {
            const slotID = this.bank.activeSlotID;

            if (!slotID) {
                return null;
            }

            if (preset.kind !== EFFECT_PRESET_V2_KIND || preset.version !== EFFECT_PRESET_V2_SCHEMA_VERSION) {
                throw new Error("Active snapshot can only be updated from a v2 effect preset.");
            }

            const snapshot = this.normalizeSnapshotForCurrentContract(presetToSnapshot(preset, slotID));
            const nextBank = this.bankWithSlot(slotID, snapshot);
            this.commitBank(nextBank);
            return cloneSnapshot(nextBank.slots[slotID]!);
        }, "Active snapshot updated.");
    }

    exportSnapshotText(slotID: string): EffectSnapshotBankMutationResult<string> {
        return this.runMutation(() => {
            this.requireKnownSlot(slotID);
            const snapshot = this.bank.slots[slotID];

            if (!snapshot) {
                throw new Error(`Snapshot ${slotID} is empty.`);
            }

            return JSON.stringify(snapshot, null, 2);
        }, `Copied ${slotID}.`);
    }

    importSnapshotText(slotID: string, text: string): EffectSnapshotBankMutationResult<EffectSnapshot> {
        return this.runMutation(() => {
            this.requireKnownSlot(slotID);
            const parsed = parseEffectSnapshotText(text);
            const snapshot = normalizeEffectSnapshot({
                ...(parsed as EffectSnapshot),
                slotID,
            }, {
                currentContract: this.requireCurrentContract(),
                storedStateAdapters: this.storedStateAdapters,
                migrations: this.snapshotMigrations,
            });

            const previousBank = this.bank;
            const previousSoundSnapshot = this.captureCurrentSnapshot(slotID, "");
            const nextBank = {
                ...this.bank,
                activeSlotID: slotID,
                slots: {
                    ...this.bank.slots,
                    [slotID]: snapshot,
                },
            };
            this.commitBank(nextBank);

            try {
                this.applySnapshotToPatch(snapshot);
            } catch (error) {
                this.restoreBankAndSoundAfterApplyFailure(previousBank, previousSoundSnapshot, error);
            }

            return cloneSnapshot(snapshot);
        }, `Pasted into ${slotID}.`);
    }

    async copySnapshotToClipboard(slotID: string): Promise<EffectSnapshotBankMutationResult<string>> {
        const exported = this.exportSnapshotText(slotID);

        if (!exported.ok) {
            return exported;
        }

        try {
            const writeClipboardText = this.writeClipboardText ?? globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard);

            if (!writeClipboardText) {
                throw new Error("Clipboard write API is unavailable.");
            }

            await writeClipboardText(exported.value);
            return this.succeed(exported.value, `Copied ${slotID}.`);
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    async pasteSnapshotFromClipboard(slotID: string): Promise<EffectSnapshotBankMutationResult<EffectSnapshot>> {
        try {
            const readClipboardText = this.readClipboardText ?? globalThis.navigator?.clipboard?.readText?.bind(globalThis.navigator.clipboard);

            if (!readClipboardText) {
                throw new Error("Clipboard read API is unavailable.");
            }

            return this.importSnapshotText(slotID, await readClipboardText());
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    private recallSlot(slotID: string, snapshot: EffectSnapshot) {
        const previousBank = this.bank;
        const normalizedSnapshot = this.normalizeSnapshotForCurrentContract({
            ...snapshot,
            slotID,
        });
        const previousSoundSnapshot = this.captureCurrentSnapshot(slotID, "");
        const nextBank = this.bankWithSlot(slotID, normalizedSnapshot);

        try {
            this.commitBank(nextBank);
        } catch (error) {
            throw error;
        }

        try {
            this.applySnapshotToPatch(normalizedSnapshot);
        } catch (error) {
            this.restoreBankAndSoundAfterApplyFailure(previousBank, previousSoundSnapshot, error);
        }

        const appliedSnapshot = this.bank.slots[slotID] ?? normalizedSnapshot;
        return cloneSnapshot(appliedSnapshot);
    }

    private captureCurrentSnapshot(slotID: string, label: string) {
        return captureEffectSnapshot({
            slotID,
            currentContract: this.requireCurrentContract(),
            currentParameterValues: cloneCurrentValues(this.currentValues),
            storedStateAdapters: this.storedStateAdapters,
            label,
        });
    }

    private bankWithSlot(slotID: string, snapshot: EffectSnapshot) {
        const normalizedSnapshot = normalizeEffectSnapshot({
            ...snapshot,
            slotID,
        }, {
            currentContract: this.requireCurrentContract(),
            storedStateAdapters: this.storedStateAdapters,
            migrations: this.snapshotMigrations,
        });
        return {
            ...this.bank,
            activeSlotID: slotID,
            slots: {
                ...this.bank.slots,
                [slotID]: normalizedSnapshot,
            },
        };
    }

    private handleStatus(status: unknown) {
        const nextContract = buildPluginStateContract({
            effectID: this.effectID,
            status,
            storedState: this.storedStateAdapters,
        });

        const sameContract = this.currentContract?.hash === nextContract.hash;
        const hasActiveParameterListeners = nextContract.parameters.length === 0 || this.parameterListenerCleanups.length > 0;

        if (sameContract && this.ready && hasActiveParameterListeners) {
            return;
        }

        this.currentContract = sameContract && this.currentContract ? this.currentContract : nextContract;
        this.ready = true;
        this.currentValues.clear();
        this.detachParameterListeners();
        this.attachParameterListeners();
        this.applyDeferredStoredBankIfAvailable();
        this.notify();
    }

    private attachParameterListeners() {
        const contract = this.requireCurrentContract();

        for (const parameter of contract.parameters) {
            const endpointID = parameter.endpointID;
            const listener = (value: unknown) => this.handleParameterValue(endpointID, value);
            this.hydratingEndpointIDs.add(endpointID);
            this.patchConnection.addParameterListener?.(endpointID, listener);
            this.parameterListenerCleanups.push(() => {
                this.patchConnection.removeParameterListener?.(endpointID, listener);
            });
        }

        for (const parameter of contract.parameters) {
            this.patchConnection.requestParameterValue?.(parameter.endpointID);
        }
    }

    private detachParameterListeners() {
        for (const cleanup of this.parameterListenerCleanups) {
            cleanup();
        }

        this.parameterListenerCleanups.length = 0;
        this.hydratingEndpointIDs.clear();
    }

    private handleParameterValue(endpointID: string, value: unknown) {
        const parameter = this.currentContract?.parameters.find((candidate) => candidate.endpointID === endpointID);

        if (!parameter) {
            return;
        }

        const normalizedValue = parameter.type === "boolean" ? value === true || value === 1 : Number(value);
        this.currentValues.set(endpointID, normalizedValue as EffectParameterValue);

        if (this.hydratingEndpointIDs.delete(endpointID)) {
            this.notify();
            return;
        }

        if (this.suppressActiveSlotCaptureDepth > 0) {
            this.notify();
            return;
        }

        this.updateActiveSlotFromCurrentState();
    }

    private attachStoredStateAdapterListeners() {
        for (const adapter of this.storedStateAdapters) {
            const unsubscribe = adapter.subscribe?.(() => this.updateActiveSlotFromCurrentState());

            if (unsubscribe) {
                this.storedAdapterCleanups.push(unsubscribe);
            }
        }
    }

    private detachStoredStateAdapterListeners() {
        for (const cleanup of this.storedAdapterCleanups) {
            cleanup();
        }

        this.storedAdapterCleanups.length = 0;
    }

    private updateActiveSlotFromCurrentState() {
        if (this.suppressActiveSlotCaptureDepth > 0) {
            this.notify();
            return;
        }

        const slotID = this.bank.activeSlotID;

        if (!slotID) {
            this.notify();
            return;
        }

        try {
            const previous = this.bank.slots[slotID];
            const snapshot = this.captureCurrentSnapshot(slotID, previous?.label ?? "");
            const nextBank = {
                ...this.bank,
                slots: {
                    ...this.bank.slots,
                    [slotID]: snapshot,
                },
            };
            this.commitBank(nextBank, { notify: false });
            this.lastError = null;
        } catch (error) {
            this.lastError = errorFromUnknown(error).message;
        }

        this.notify();
    }

    private requestBootState() {
        const requestRevision = this.localRevision;

        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                if (requestRevision !== this.localRevision) {
                    return;
                }

                this.bootFullStoredState = isPlainObject(storedState) ? { ...storedState } : undefined;

                if (isPlainObject(storedState) && Object.prototype.hasOwnProperty.call(storedState, this.storedStateKey)) {
                    this.applyStoredBankValue(storedState[this.storedStateKey]);
                    return;
                }

                if (typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.pendingStoredStateValueRevision = requestRevision;
                    this.patchConnection.requestStoredStateValue(this.storedStateKey);
                    return;
                }

                this.applyStoredBankValue(undefined);
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.pendingStoredStateValueRevision = requestRevision;
            this.patchConnection.requestStoredStateValue(this.storedStateKey);
            return;
        }

        this.applyStoredBankValue(undefined);
    }

    private handleStoredStateValue(message: unknown) {
        const stored = message as StoredStateMessage;

        if (stored?.key !== this.storedStateKey) {
            return;
        }

        if (this.consumeStoredEcho(stored.value)) {
            return;
        }

        if (this.pendingStoredStateValueRevision !== null) {
            const pendingRevision = this.pendingStoredStateValueRevision;
            this.pendingStoredStateValueRevision = null;

            if (pendingRevision !== this.localRevision) {
                return;
            }
        }

        this.applyStoredBankValue(stored.value);
    }

    private applyStoredBankValue(value: unknown) {
        this.rawStoredBank = value;
        this.hasRawStoredBank = true;
        this.applyDeferredStoredBankIfAvailable();
    }

    private applyDeferredStoredBankIfAvailable() {
        if (!this.currentContract || !this.hasRawStoredBank) {
            return;
        }

        try {
            if (this.rawStoredBank === undefined || this.rawStoredBank === null) {
                const legacyBank = this.options.legacyBankProvider?.({
                    fullStoredState: this.bootFullStoredState,
                });

                if (legacyBank !== undefined && legacyBank !== null) {
                    this.commitBank(this.normalizeBank(legacyBank), { notify: false });
                } else {
                    this.bank = createEmptyEffectSnapshotBank({ effectID: this.effectID, slotIDs: this.slotIDs });
                }
            } else {
                this.bank = this.normalizeBank(this.rawStoredBank);
            }

            this.lastError = null;
        } catch (error) {
            this.bank = createEmptyEffectSnapshotBank({ effectID: this.effectID, slotIDs: this.slotIDs });
            this.lastError = errorFromUnknown(error).message;
        }

        this.notify();
    }

    private normalizeBank(payload: unknown) {
        return normalizeEffectSnapshotBank(payload, {
            effectID: this.effectID,
            slotIDs: this.slotIDs,
            currentContract: this.requireCurrentContract(),
            storedStateAdapters: this.storedStateAdapters,
            snapshotMigrations: this.snapshotMigrations,
        });
    }

    private normalizeSnapshotForCurrentContract(snapshot: EffectSnapshot) {
        return normalizeEffectSnapshot(snapshot, {
            currentContract: this.requireCurrentContract(),
            storedStateAdapters: this.storedStateAdapters,
            migrations: this.snapshotMigrations,
        });
    }

    private applySnapshotToPatch(snapshot: EffectSnapshot) {
        this.suppressActiveSlotCaptureDepth += 1;

        try {
            return applyEffectSnapshot({
                snapshot,
                currentContract: this.requireCurrentContract(),
                patchConnection: this.patchConnection,
                storedStateAdapters: this.storedStateAdapters,
                migrations: this.snapshotMigrations,
            });
        } finally {
            this.suppressActiveSlotCaptureDepth = Math.max(0, this.suppressActiveSlotCaptureDepth - 1);
        }
    }

    private restoreBankAndSoundAfterApplyFailure(
        previousBank: EffectSnapshotBank,
        previousSoundSnapshot: EffectSnapshot,
        originalError: unknown,
    ): never {
        const failures = [errorFromUnknown(originalError).message];

        try {
            this.applySnapshotToPatch(previousSoundSnapshot);
        } catch (soundRollbackError) {
            failures.push(`failed to restore previous sound state: ${errorFromUnknown(soundRollbackError).message}`);
        }

        try {
            this.commitBank(previousBank, { notify: false });
        } catch (rollbackError) {
            failures.push(`failed to restore previous snapshot bank: ${errorFromUnknown(rollbackError).message}`);
        }

        throw new Error(failures.join("; "));
    }

    private commitBank(nextBank: EffectSnapshotBank, { notify = true } = {}) {
        const previousBank = this.bank;
        const previousRevision = this.localRevision;
        const previousEchoes = new Map(this.pendingStoredEchoes);

        this.bank = cloneBank(nextBank);

        try {
            this.persistBank({ notify });
        } catch (error) {
            this.bank = previousBank;
            this.localRevision = previousRevision;
            this.pendingStoredEchoes.clear();

            for (const [token, count] of previousEchoes) {
                this.pendingStoredEchoes.set(token, count);
            }

            throw error;
        }
    }

    private persistBank({ notify = true } = {}) {
        const sendStoredStateValue = this.requireStoredStateWriter();
        this.localRevision += 1;
        const nextBank = cloneBank(this.bank);
        this.rememberStoredEcho(nextBank);
        sendStoredStateValue(this.storedStateKey, nextBank);

        if (notify) {
            this.notify();
        }
    }

    private requireStoredStateWriter() {
        const sendStoredStateValue = this.patchConnection.sendStoredStateValue?.bind(this.patchConnection);

        if (!sendStoredStateValue) {
            throw new Error("Cannot update snapshots because stored-state writes are unavailable.");
        }

        return sendStoredStateValue;
    }

    private rememberStoredEcho(value: unknown) {
        const token = storedStateToken(value);
        this.pendingStoredEchoes.set(token, (this.pendingStoredEchoes.get(token) ?? 0) + 1);
    }

    private consumeStoredEcho(value: unknown) {
        const token = storedStateToken(value);
        const count = this.pendingStoredEchoes.get(token) ?? 0;

        if (count <= 0) {
            return false;
        }

        if (count === 1) {
            this.pendingStoredEchoes.delete(token);
        } else {
            this.pendingStoredEchoes.set(token, count - 1);
        }

        return true;
    }

    private requireCurrentContract() {
        if (!this.currentContract) {
            throw new Error("Cannot use snapshots until the Cmajor status contract is available.");
        }

        return this.currentContract;
    }

    private requireKnownSlot(slotID: string) {
        if (!this.slotIDs.includes(slotID)) {
            throw new Error(`Unknown snapshot slot "${slotID}".`);
        }
    }

    private runMutation<T>(
        mutation: () => T,
        message: string,
    ): EffectSnapshotBankMutationResult<T> {
        try {
            const value = mutation();
            return this.succeed(value, message);
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    private succeed<T>(value: T, message: string): EffectSnapshotBankMutationResult<T> {
        this.lastMessage = message;
        this.lastError = null;
        this.notify();

        return {
            ok: true,
            value,
            message,
        };
    }

    private fail(error: Error): EffectSnapshotBankMutationResult<never> {
        this.lastError = error.message;
        this.lastMessage = error.message;
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
