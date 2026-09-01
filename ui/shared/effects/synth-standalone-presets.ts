/**
 * Synth adapter for the standalone effect preset controller: the Cosimo
 * synth's canonical Init, guarded sound replacement, sound links, bounce
 * policy, and Init-only document transactions. Everything that imports
 * bounce/, sound-share, or wavetable modules lives here so that the generic
 * controller in ./standalone-effect-presets stays host-neutral.
 */

import { BOUNCE_STATE_KEY } from "../../../bounce/document.mjs";
import {
    createSoundShareEnvelope,
    parseSoundShareEnvelope,
    type SoundShareEnvelopeV2,
} from "../sound-share-envelope";
import {
    validateSoundShareWavetables,
    type ShippedWavetableTable,
} from "../sound-share-wavetable";
import {
    clonePluginStateContract,
    type EffectParameterValue,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import {
    cloneEffectPresetV2,
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    type EffectPresetV2,
    type EffectStoredStateAdapter,
    type EffectStoredStateContext,
} from "./effect-preset-v2";
import { createActivePresetMetadataFromPresetV2 } from "./effect-preset-store-v2";
import {
    defaultParameterValues,
    ensureParameterWriter,
    ensureStoredStateWriter,
    errorFromUnknown,
    presetKeyFor,
    StandaloneEffectPresetController,
    storedStateValuesEqual,
    valuesEqual,
    type PreparedSoundReplacement,
    type StandaloneEffectPendingSoundReplacement,
    type StandaloneEffectPresetControllerOptions,
    type StandaloneEffectPresetMutationResult,
} from "./standalone-effect-presets";

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
    /** Current factory-slot ledger used to reject custom or unavailable tables. */
    getShippedWavetableTables: () => ReadonlyArray<ShippedWavetableTable>;
};

/**
 * Prefix of every preset ID the synth controller mints at runtime (the Init,
 * share, capture, compare, and rollback identities). Configurable through
 * `runtimePresetIDPrefix`; the default matches the historical hard-coded ids.
 */
export const DEFAULT_RUNTIME_PRESET_ID_PREFIX = "cosimo";

export type SynthStandaloneEffectPresetControllerOptions =
    StandaloneEffectPresetControllerOptions & {
        /** Synth policy: canonical Init documents, Init-only adapters, share validation. */
        synth: StandaloneEffectPresetSynthOptions;
        /** Prefix for runtime-minted preset ids; defaults to {@link DEFAULT_RUNTIME_PRESET_ID_PREFIX}. */
        runtimePresetIDPrefix?: string;
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

export class SynthStandaloneEffectPresetController extends StandaloneEffectPresetController {
    private readonly synth: StandaloneEffectPresetSynthOptions;
    private readonly runtimePresetIDPrefix: string;
    private synthInitBaseline: EffectPresetV2 | null = null;
    private synthCleanInitOnlyState = new Map<string, unknown>();
    private unnamedSynthLabel = "INIT";
    private unnamedSynthDirty = false;
    private pendingSoundReplacement: PreparedSoundReplacement<unknown> | null = null;

    constructor(options: SynthStandaloneEffectPresetControllerOptions) {
        super(options);
        this.synth = options.synth;
        this.runtimePresetIDPrefix = options.runtimePresetIDPrefix ?? DEFAULT_RUNTIME_PRESET_ID_PREFIX;
    }

    getSynthMutations() {
        return {
            initSound: this.initSound.bind(this),
            bounceSound: this.bounceSound.bind(this),
            captureCurrentSound: this.captureCurrentSound.bind(this),
            captureSharedSound: this.captureSharedSound.bind(this),
            loadSharedSound: this.loadSharedSound.bind(this),
            cancelSoundReplacement: this.cancelSoundReplacement.bind(this),
            discardAndContinueSoundReplacement: this.discardAndContinueSoundReplacement.bind(this),
            saveAndContinueSoundReplacement: this.saveAndContinueSoundReplacement.bind(this),
            saveCurrentAsNewPresetAndContinueSoundReplacement: this.saveCurrentAsNewPresetAndContinueSoundReplacement.bind(this),
        };
    }

    initSound(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            return this.requestSoundReplacement(this.prepareInitSoundReplacement());
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    /** Run the Bounce press through the same unsaved-sound policy as Init. */
    bounceSound(apply: () => void): StandaloneEffectPresetMutationResult<void> {
        if (typeof apply !== "function") {
            return this.fail(new TypeError("Bounce requires a continuation."));
        }
        return this.requestSoundReplacement({
            pending: { kind: "bounce" },
            successMessage: "Bounce started.",
            apply,
        });
    }

    captureSharedSound(): StandaloneEffectPresetMutationResult<SoundShareEnvelopeV2<EffectPresetV2>> {
        return this.runMutation(() => {
            const state = this.getState();
            return this.captureCurrentSoundEnvelope(
                this.runtimePresetID("share.current"),
                state.activeLabel || "Shared Sound",
                { requireShareable: true },
            );
        }, "Sound link ready.");
    }

    captureCurrentSound(): StandaloneEffectPresetMutationResult<SoundShareEnvelopeV2<EffectPresetV2>> {
        return this.runMutation(() => {
            const state = this.getState();
            return this.captureCurrentSoundEnvelope(
                this.runtimePresetID("current"),
                state.activeLabel || "Current Sound",
                { requireShareable: false },
            );
        }, "Current sound captured.");
    }

    loadSharedSound(envelopeInput: unknown): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            ensureStoredStateWriter(this.options.patchConnection, "load a shared sound");
            ensureParameterWriter(this.options.patchConnection, "load a shared sound");
            const envelope = parseSoundShareEnvelope(envelopeInput);
            if (!envelope.ok) {
                throw envelope.error;
            }
            const preset = this.normalizePresetForCurrentContract(envelope.value.preset);
            this.assertSoundCanBeShared(preset);
            const initOnlyValues = this.normalizeInitOnlyStateValues(
                preset,
                envelope.value.supplementalStoredState,
                "shared sound",
            );

            return this.requestSoundReplacement({
                pending: { kind: "share", label: preset.label },
                successMessage: "Shared sound loaded.",
                apply: () => {
                    this.applySoundTransaction({
                        preset,
                        initOnlyValues,
                        commit: () => {
                            this.synthInitBaseline = cloneEffectPresetV2(preset);
                            this.synthCleanInitOnlyState = new Map(
                                initOnlyValues.map((entry) => [entry.adapter.key, entry.serialized]),
                            );
                            this.unnamedSynthLabel = preset.label;
                            this.unnamedSynthDirty = false;
                            this.bridge.setActivePresetMetadata(this.options.effectID, null);
                        },
                    });
                    return cloneEffectPresetV2(preset);
                },
            });
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

    discardAndContinueSoundReplacement(): StandaloneEffectPresetMutationResult<unknown> {
        const replacement = this.pendingSoundReplacement;

        if (!replacement) {
            return this.fail(new Error("No sound replacement is waiting for confirmation."));
        }

        return this.runSoundReplacement(replacement, () => {
            const value = replacement.apply();
            this.pendingSoundReplacement = null;
            return value;
        });
    }

    saveAndContinueSoundReplacement(): StandaloneEffectPresetMutationResult<unknown> {
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
    ): StandaloneEffectPresetMutationResult<unknown> {
        if (!this.pendingSoundReplacement) {
            return this.fail(new Error("No sound replacement is waiting for confirmation."));
        }

        const saveResult = this.saveCurrentAsNewPreset(label);
        if (!saveResult.ok) {
            return saveResult;
        }

        return this.discardAndContinueSoundReplacement();
    }

    // ── Extension seams over the generic controller ──────────────────────

    protected override getUnnamedLabel(): string {
        return this.unnamedSynthLabel;
    }

    protected override getUnnamedDirty(): boolean {
        return this.unnamedSynthDirty;
    }

    protected override supportsInit(): boolean {
        return true;
    }

    protected override getPendingSoundReplacement(): StandaloneEffectPendingSoundReplacement | null {
        return this.pendingSoundReplacement
            ? { ...this.pendingSoundReplacement.pending }
            : null;
    }

    protected override handleUnnamedParameterEdit(endpointID: string, value: EffectParameterValue): void {
        if (
            !this.unnamedSynthDirty
            && this.synthInitBaseline
            && !valuesEqual(this.synthInitBaseline.parameters[endpointID], value)
        ) {
            this.unnamedSynthDirty = true;
        }
    }

    protected override handleUnnamedStoredStateEdit(key: string, serializedValue: unknown): void {
        if (
            this.synthInitBaseline
            && !this.unnamedSynthDirty
            && !storedStateValuesEqual(this.synthInitBaseline.storedState[key], serializedValue)
        ) {
            this.unnamedSynthDirty = true;
        }
    }

    protected override recordCleanCapturedPreset(preset: EffectPresetV2): void {
        this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(preset);
    }

    protected override attachStoredStateListeners() {
        super.attachStoredStateListeners();

        for (const adapter of this.synth.initOnlyStateAdapters ?? []) {
            if (typeof adapter.subscribe !== "function") {
                continue;
            }

            const cleanup = adapter.subscribe(() => this.handleInitOnlyStateAdapterChange(adapter));
            this.storedStateListenerCleanups.push(cleanup);
        }
    }

    protected override reapplyWithoutActivePreset(): StandaloneEffectPresetMutationResult<EffectPresetV2> {
        try {
            if (this.synthInitBaseline) {
                const preset = cloneEffectPresetV2(this.synthInitBaseline);
                const initOnlyValues = this.normalizeInitOnlyStateValues(
                    preset,
                    Object.fromEntries(this.synthCleanInitOnlyState),
                    "unnamed sound baseline",
                );
                return this.runSoundReplacement({
                    pending: { kind: "init" },
                    successMessage: "Preset reapplied.",
                    apply: () => {
                        this.applySoundTransaction({
                            preset,
                            initOnlyValues,
                            commit: () => {
                                this.unnamedSynthDirty = false;
                                this.bridge.setActivePresetMetadata(this.options.effectID, null);
                            },
                        });
                        return cloneEffectPresetV2(preset);
                    },
                });
            }
            const replacement = this.prepareInitSoundReplacement();
            return this.runSoundReplacement({ ...replacement, successMessage: "Preset reapplied." });
        } catch (error) {
            return this.fail(errorFromUnknown(error));
        }
    }

    protected override commitActivePresetAndApply(preset: EffectPresetV2) {
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

    protected override commitImportedPresetAndApply(preset: EffectPresetV2) {
        this.applySoundTransaction({
            preset,
            commit: () => {
                this.synthCleanInitOnlyState = this.captureSerializedInitOnlyState(preset);
                this.bridge.saveUserPreset(preset, { activate: true });
            },
        });
    }

    protected override requestSoundReplacement<T>(
        replacement: PreparedSoundReplacement<T>,
    ): StandaloneEffectPresetMutationResult<T> {
        if (this.getState().dirty) {
            this.pendingSoundReplacement = replacement;
            this.lastError = null;
            this.notify();

            return {
                ok: false,
                actionRequired: "confirm-sound-replacement",
                message: "The current sound has unsaved changes.",
            };
        }

        return this.runSoundReplacement(replacement);
    }

    // ── Sound-replacement transaction engine ─────────────────────────────

    private runtimePresetID(
        suffix: "init.current" | "share.current" | "current" | "compare.current" | "rollback.current",
    ) {
        return `${this.runtimePresetIDPrefix}.${suffix}`;
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

            const currentPreset = this.captureCurrentPreset(this.runtimePresetID("compare.current"), "Compare");
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

    private captureCurrentSoundEnvelope(
        presetID: string,
        label: string,
        { requireShareable }: { readonly requireShareable: boolean },
    ) {
        const preset = this.captureCurrentPreset(presetID, label);
        if (requireShareable) {
            this.assertSoundCanBeShared(preset);
        }
        const supplementalStoredState = Object.fromEntries(
            this.captureInitOnlyStateValues(preset).map((entry) => [entry.adapter.key, entry.serialized]),
        );
        return createSoundShareEnvelope({ preset, supplementalStoredState });
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
        const previousPreset = this.captureCurrentPreset(this.runtimePresetID("rollback.current"), "Rollback");
        const previousInitOnlyValues = this.captureInitOnlyStateValues(previousPreset);
        const previousBridgeState = this.bridge.getState();
        const previousInitBaseline = this.synthInitBaseline
            ? cloneEffectPresetV2(this.synthInitBaseline)
            : null;
        const previousCleanInitOnlyState = new Map(this.synthCleanInitOnlyState);
        const previousUnnamedLabel = this.unnamedSynthLabel;
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
            this.unnamedSynthLabel = previousUnnamedLabel;
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

        return (this.synth.initOnlyStateAdapters ?? []).map((adapter): PreparedInitOnlyStateValue => {
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

    private normalizeInitOnlyStateValues(
        preset: EffectPresetV2,
        rawValues: Readonly<Record<string, unknown>>,
        sourceLabel: string,
    ): PreparedInitOnlyStateValue[] {
        const adapters = this.synth.initOnlyStateAdapters ?? [];
        const expectedKeys = adapters.map((adapter) => adapter.key).sort();
        const providedKeys = Object.keys(rawValues).sort();
        const missingKeys = expectedKeys.filter((key) => !providedKeys.includes(key));
        const unknownKeys = providedKeys.filter((key) => !expectedKeys.includes(key));
        if (missingKeys.length > 0) {
            throw new Error(`${sourceLabel} is missing sound state: ${missingKeys.join(", ")}.`);
        }
        if (unknownKeys.length > 0) {
            throw new Error(`${sourceLabel} has unknown sound state: ${unknownKeys.join(", ")}.`);
        }
        const context: EffectStoredStateContext = {
            parameters: preset.parameters,
            storedState: preset.storedState,
        };
        return adapters.map((adapter): PreparedInitOnlyStateValue => {
            const normalized = adapter.normalizeForTransaction(rawValues[adapter.key], context);
            const serialized = adapter.serializeForTransaction(normalized, context);
            return {
                adapter,
                serialized,
                value: adapter.normalizeForTransaction(serialized, context),
            };
        });
    }

    private assertSoundCanBeShared(preset: EffectPresetV2) {
        const bounceState = preset.storedState[BOUNCE_STATE_KEY];
        if (
            preset.parameters.sourceMode === 1
            || (bounceState !== null && bounceState !== undefined)
        ) {
            throw new Error("Bounced sounds can't be shared by link yet");
        }

        const wavetableResult = validateSoundShareWavetables(
            preset.parameters,
            this.synth.getShippedWavetableTables() ?? [],
        );
        if (!wavetableResult.ok) {
            throw wavetableResult.error;
        }
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

        for (const adapter of this.synth.initOnlyStateAdapters ?? []) {
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

    private prepareInitSoundReplacement(): PreparedSoundReplacement<EffectPresetV2> {
        ensureStoredStateWriter(this.options.patchConnection, "initialize the synth sound");
        ensureParameterWriter(this.options.patchConnection, "initialize the synth sound");

        const currentContract = this.requireCurrentContract();
        const initPreset = this.normalizePresetForCurrentContract({
            kind: EFFECT_PRESET_V2_KIND,
            version: EFFECT_PRESET_V2_SCHEMA_VERSION,
            effectID: this.options.effectID,
            presetID: this.runtimePresetID("init.current"),
            label: "INIT",
            contract: clonePluginStateContract(currentContract),
            parameters: defaultParameterValues(currentContract),
            storedState: this.synth.createCanonicalStoredState(currentContract),
        });
        const context: EffectStoredStateContext = {
            parameters: initPreset.parameters,
            storedState: initPreset.storedState,
        };
        const initOnlyValues = (this.synth.initOnlyStateAdapters ?? []).map((adapter): PreparedInitOnlyStateValue => {
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
                        this.unnamedSynthLabel = "INIT";
                        this.unnamedSynthDirty = false;
                        this.bridge.setActivePresetMetadata(this.options.effectID, null);
                    },
                });

                return cloneEffectPresetV2(initPreset);
            },
        };
    }
}

export function createSynthStandaloneEffectPresetController(options: SynthStandaloneEffectPresetControllerOptions) {
    return new SynthStandaloneEffectPresetController(options);
}
