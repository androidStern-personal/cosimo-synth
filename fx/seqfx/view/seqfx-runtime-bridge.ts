import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import {
    applySeqFxFactoryPattern,
    applySeqFxSafeLoopVariation,
    getSeqFxFactoryPattern,
} from "./seqfx-factory-content";
import {
    SEQFX_LEGACY_STATE_KEY,
    SEQFX_STATE_KEY,
    SEQFX_STATE_VERSION,
    applySeqFxBlockAuxSourceEdit,
    applySeqFxBlockAuxTargetEndEdit,
    applySeqFxBlockAuxTargetToggle,
    applySeqFxBlockEffectEdit,
    applySeqFxBlockCreate,
    applySeqFxBlockCopy,
    applySeqFxBlockCopyPaint,
    applySeqFxBlockDelete,
    applySeqFxBlockMixEdit,
    applySeqFxBlockMove,
    applySeqFxBlockParamEdit,
    applySeqFxBlockPresetEdit,
    applySeqFxBlockResize,
    applySeqFxBlockSelectionDelete,
    applySeqFxBlockSelectionCopy,
    applySeqFxBlockSelectionAuxTargetEndEdit,
    applySeqFxBlockSelectionAuxTargetToggle,
    applySeqFxBlockSelectionMixEdit,
    applySeqFxBlockSelectionMove,
    applySeqFxBlockSelectionParamEdit,
    applySeqFxCellToggle,
    applySeqFxMixEdit,
    applySeqFxLoopClear,
    applySeqFxLoopPaste,
    applySeqFxParamEdit,
    applySeqFxPatternInit,
    applySeqFxStepValuePaste,
    buildSeqPatternUpload,
    copySeqFxLoop,
    createDefaultSeqFxState,
    getSeqFxStepValueSnapshot,
    normalizeSeqFxState,
    parseSeqFxStoredState,
    parseStrictSeqFxStateV5,
    parseStrictSeqFxStateV7,
    serializeSeqFxState,
    type SeqFxBlockAuxSourceEdit,
    type SeqFxBlockAuxTargetEndEdit,
    type SeqFxBlockAuxTargetToggleEdit,
    type SeqFxBlockCreateEdit,
    type SeqFxBlockCopyEdit,
    type SeqFxBlockCopyPaintEdit,
    type SeqFxBlockCopyPaintResult,
    type SeqFxBlockDeleteEdit,
    type SeqFxBlockEffectEdit,
    type SeqFxBlockMixEdit,
    type SeqFxBlockMoveEdit,
    type SeqFxBlockParamEdit,
    type SeqFxBlockPresetEdit,
    type SeqFxBlockResizeEdit,
    type SeqFxBlockSelectionEditTarget,
    type SeqFxBlockSelectionAuxTargetEndEdit,
    type SeqFxBlockSelectionAuxTargetToggleEdit,
    type SeqFxBlockSelectionCopyEdit,
    type SeqFxBlockSelectionCopyResult,
    type SeqFxBlockSelectionMixEdit,
    type SeqFxBlockSelectionMoveEdit,
    type SeqFxBlockSelectionMoveResult,
    type SeqFxBlockSelectionParamEdit,
    type SeqFxCellToggleEdit,
    type SeqFxMixEdit,
    type SeqFxLoopClipboard,
    type SeqFxParamEdit,
    type SeqFxState,
    type SeqFxStepValuePasteEdit,
    type SeqFxStepValueSnapshot,
    type SeqFxStepValueSnapshotTarget,
} from "./seqfx-state";

export const SEQFX_ENDPOINTS = {
    enabled: "enabled",
    globalMix: "globalMix",
    patternUpload: "patternUpload",
    patternSelect: "patternSelect",
    clockMode: "clockMode",
    manualBpm: "manualBpm",
    rate: "rate",
    swing: "swing",
    loopStart: "loopStart",
    loopLength: "loopLength",
    monitorOut: "monitorOut",
    internalPlay: "internalPlay",
    internalReset: "internalReset",
} as const;

export const SEQFX_UNDO_HISTORY_LIMIT = 100;

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type BridgeListener = (state: SeqFxState) => void;
type MonitorListener = (value: unknown) => void;
type RateListener = (rateIndex: number) => void;
export type SeqFxGlobalControls = {
    enabled: boolean;
    globalMix: number;
    clockMode: number;
    manualBpm: number;
    rateIndex: number;
    swing: number;
    loopStart: number;
    loopLength: number;
};
type GlobalControlsListener = (controls: SeqFxGlobalControls) => void;
type SeqFxGlobalEndpoint =
    | typeof SEQFX_ENDPOINTS.enabled
    | typeof SEQFX_ENDPOINTS.globalMix
    | typeof SEQFX_ENDPOINTS.clockMode
    | typeof SEQFX_ENDPOINTS.manualBpm
    | typeof SEQFX_ENDPOINTS.rate
    | typeof SEQFX_ENDPOINTS.swing
    | typeof SEQFX_ENDPOINTS.loopStart
    | typeof SEQFX_ENDPOINTS.loopLength;

const DEFAULT_GLOBAL_CONTROLS: SeqFxGlobalControls = {
    enabled: true,
    globalMix: 1,
    clockMode: 0,
    manualBpm: 120,
    rateIndex: 1,
    swing: 0,
    loopStart: 0,
    loopLength: 32,
};

function hasOwnValue(record: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(record, key);
}

function getFullStoredStateValue(storedState: unknown, key: string) {
    const fullState = storedState && typeof storedState === "object"
        ? storedState as Record<string, unknown>
        : {};
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};

    if (hasOwnValue(values, key)) {
        return {
            found: true,
            value: values[key],
        };
    }

    if (hasOwnValue(fullState, key)) {
        return {
            found: true,
            value: fullState[key],
        };
    }

    return {
        found: false,
        value: undefined,
    };
}

function toEchoToken(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function resolvePatternIndex(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.min(11, Math.max(0, Math.round(numeric)));
}

function resolveRateIndex(value: unknown): number {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
        return 1;
    }

    if (numeric === Number.POSITIVE_INFINITY) {
        return 2;
    }

    if (numeric === Number.NEGATIVE_INFINITY) {
        return 0;
    }

    if (!Number.isFinite(numeric)) {
        return 1;
    }

    return Math.min(2, Math.max(0, Math.round(numeric)));
}

function resolveFiniteNumber(value: unknown, fallback: number, min: number, max: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function resolveInteger(value: unknown, fallback: number, min: number, max: number): number {
    return Math.round(resolveFiniteNumber(value, fallback, min, max));
}

export class SeqFxRuntimeBridge {
    private state: SeqFxState = createDefaultSeqFxState();
    private selectedPatternIndex = 0;
    private rateIndex = 1;
    private globalControls: SeqFxGlobalControls = { ...DEFAULT_GLOBAL_CONTROLS };
    private readonly stateListeners = new Set<BridgeListener>();
    private readonly monitorListeners = new Set<MonitorListener>();
    private readonly rateListeners = new Set<RateListener>();
    private readonly globalControlsListeners = new Set<GlobalControlsListener>();
    private readonly pendingStoredEchoes = new Map<string, number>();
    private attached = false;
    private bootStoredStatePendingKey: string | null = null;
    private hasCurrentV7State = false;
    private liveEditActive = false;
    private liveEditDirty = false;
    private liveEditOrigin: SeqFxState | null = null;
    private pendingLiveNotify = false;
    private pendingLivePatternUpload: number | null = null;
    private pendingLiveFrame: number | null = null;
    private readonly undoStack: SeqFxState[] = [];
    private readonly redoStack: SeqFxState[] = [];
    private loopClipboard: SeqFxLoopClipboard | null = null;
    private variationIndex = 0;

    private readonly handleStoredStateValue = (message: unknown) => {
        const stored = message as StoredStateMessage;

        if (stored?.key !== SEQFX_STATE_KEY && stored?.key !== SEQFX_LEGACY_STATE_KEY) {
            return;
        }

        if (stored.key === SEQFX_STATE_KEY && this.consumeStoredEcho(stored.value)) {
            return;
        }

        const isBootResponse = this.bootStoredStatePendingKey === stored.key;
        if (isBootResponse) {
            this.bootStoredStatePendingKey = null;
        }

        if (stored.key === SEQFX_STATE_KEY && stored.value == null && isBootResponse) {
            this.requestLegacyBootState();
            return;
        }

        if (stored.key === SEQFX_LEGACY_STATE_KEY && this.hasCurrentV7State) {
            return;
        }

        this.applyStoredState(stored.value, stored.key);

        if (isBootResponse) {
            this.requestRuntimeValuesAfterBootState();
        }
    };

    private readonly handlePatternSelect = (value: unknown) => {
        this.selectedPatternIndex = resolvePatternIndex(value);
        this.notifyStateListeners();
    };

    private readonly handleRate = (value: unknown) => {
        const nextRateIndex = resolveRateIndex(value);
        if (nextRateIndex === this.rateIndex) {
            return;
        }

        this.rateIndex = nextRateIndex;
        this.globalControls = { ...this.globalControls, rateIndex: nextRateIndex };
        this.notifyRateListeners();
        this.notifyGlobalControlsListeners();
    };

    private readonly handleEnabled = (value: unknown) => {
        this.updateGlobalControls({ enabled: resolveFiniteNumber(value, 1, 0, 1) >= 0.5 });
    };

    private readonly handleGlobalMix = (value: unknown) => {
        this.updateGlobalControls({ globalMix: resolveFiniteNumber(value, 1, 0, 1) });
    };

    private readonly handleClockMode = (value: unknown) => {
        this.updateGlobalControls({ clockMode: resolveInteger(value, 0, 0, 2) });
    };

    private readonly handleManualBpm = (value: unknown) => {
        this.updateGlobalControls({ manualBpm: resolveFiniteNumber(value, 120, 20, 300) });
    };

    private readonly handleSwing = (value: unknown) => {
        this.updateGlobalControls({ swing: resolveFiniteNumber(value, 0, 0, 0.45) });
    };

    private readonly handleLoopStart = (value: unknown) => {
        const loopStart = resolveInteger(value, 0, 0, 31);
        this.updateGlobalControls({
            loopStart,
            loopLength: Math.min(this.globalControls.loopLength, 32 - loopStart),
        });
    };

    private readonly handleLoopLength = (value: unknown) => {
        this.updateGlobalControls({
            loopLength: resolveInteger(value, 32, 1, 32 - this.globalControls.loopStart),
        });
    };

    private readonly handleMonitor = (value: unknown) => {
        for (const listener of this.monitorListeners) {
            listener(value);
        }
    };

    constructor(private readonly patchConnection: PatchConnectionLike) {}

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValue);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.patternSelect, this.handlePatternSelect);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.enabled, this.handleEnabled);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.globalMix, this.handleGlobalMix);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.clockMode, this.handleClockMode);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.manualBpm, this.handleManualBpm);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.rate, this.handleRate);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.swing, this.handleSwing);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.loopStart, this.handleLoopStart);
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.loopLength, this.handleLoopLength);
        this.patchConnection.addEndpointListener?.(SEQFX_ENDPOINTS.monitorOut, this.handleMonitor);
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.commitLiveEdit();
        this.attached = false;
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.patternSelect, this.handlePatternSelect);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.enabled, this.handleEnabled);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.globalMix, this.handleGlobalMix);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.clockMode, this.handleClockMode);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.manualBpm, this.handleManualBpm);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.rate, this.handleRate);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.swing, this.handleSwing);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.loopStart, this.handleLoopStart);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.loopLength, this.handleLoopLength);
        this.patchConnection.removeEndpointListener?.(SEQFX_ENDPOINTS.monitorOut, this.handleMonitor);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                const storedValue = getFullStoredStateValue(storedState, SEQFX_STATE_KEY);
                const legacyStoredValue = getFullStoredStateValue(storedState, SEQFX_LEGACY_STATE_KEY);

                if (storedValue.found && storedValue.value != null) {
                    this.bootStoredStatePendingKey = null;
                    this.applyStoredState(storedValue.value, SEQFX_STATE_KEY);
                    this.requestRuntimeValuesAfterBootState();
                    return;
                }

                if (legacyStoredValue.found && legacyStoredValue.value != null) {
                    this.bootStoredStatePendingKey = null;
                    this.applyStoredState(legacyStoredValue.value, SEQFX_LEGACY_STATE_KEY);
                    this.requestRuntimeValuesAfterBootState();
                    return;
                }

                if (typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.bootStoredStatePendingKey = SEQFX_STATE_KEY;
                    this.patchConnection.requestStoredStateValue(SEQFX_STATE_KEY);
                    return;
                }

                this.bootStoredStatePendingKey = null;
                this.applyStoredState(undefined, SEQFX_STATE_KEY);
                this.requestRuntimeValuesAfterBootState();
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.bootStoredStatePendingKey = SEQFX_STATE_KEY;
            this.patchConnection.requestStoredStateValue(SEQFX_STATE_KEY);
            return;
        }

        this.bootStoredStatePendingKey = null;
        this.applyStoredState(undefined, SEQFX_STATE_KEY);
        this.requestRuntimeValuesAfterBootState();
    }

    subscribe(listener: BridgeListener) {
        this.stateListeners.add(listener);
        listener(this.state);

        return () => {
            this.stateListeners.delete(listener);
        };
    }

    subscribeMonitor(listener: MonitorListener) {
        this.monitorListeners.add(listener);

        return () => {
            this.monitorListeners.delete(listener);
        };
    }

    subscribeRate(listener: RateListener) {
        this.rateListeners.add(listener);
        listener(this.rateIndex);

        return () => {
            this.rateListeners.delete(listener);
        };
    }

    subscribeGlobalControls(listener: GlobalControlsListener) {
        this.globalControlsListeners.add(listener);
        listener(this.getGlobalControls());

        return () => {
            this.globalControlsListeners.delete(listener);
        };
    }

    getState() {
        return this.state;
    }

    getSelectedPatternIndex() {
        return this.selectedPatternIndex;
    }

    getRateIndex() {
        return this.rateIndex;
    }

    getGlobalControls(): SeqFxGlobalControls {
        return { ...this.globalControls };
    }

    replaceStateFromPreset(nextState: unknown) {
        const parsedState = this.parseReplacementState(nextState);
        this.cancelLiveEdit();
        this.clearHistory();
        this.state = parsedState;
        this.persistState();
        this.notifyStateListeners();
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo() {
        this.commitLiveEdit();
        const previous = this.undoStack.pop();
        if (!previous) {
            return false;
        }

        this.redoStack.push(this.cloneStateForHistory(this.state));
        this.state = previous;
        this.persistState();
        this.notifyStateListeners();
        return true;
    }

    redo() {
        this.commitLiveEdit();
        const next = this.redoStack.pop();
        if (!next) {
            return false;
        }

        this.undoStack.push(this.cloneStateForHistory(this.state));
        this.state = next;
        this.persistState();
        this.notifyStateListeners();
        return true;
    }

    selectPattern(patternIndex: number) {
        const nextPatternIndex = resolvePatternIndex(patternIndex);
        this.selectedPatternIndex = nextPatternIndex;
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.patternSelect, nextPatternIndex);
        this.notifyStateListeners();
    }

    setGlobalControl(endpointID: SeqFxGlobalEndpoint, value: unknown) {
        const normalizedValue = this.normalizeGlobalControlValue(endpointID, value);
        this.presentGlobalControlValue(endpointID, normalizedValue);
        this.patchConnection.sendEventOrValue?.(endpointID, normalizedValue);
    }

    setLoopRange(startStep: number, endStepExclusive: number) {
        const loopStart = resolveInteger(startStep, this.globalControls.loopStart, 0, 31);
        const loopEndExclusive = resolveInteger(endStepExclusive, loopStart + 1, loopStart + 1, 32);
        this.setGlobalControl(SEQFX_ENDPOINTS.loopStart, loopStart);
        this.setGlobalControl(SEQFX_ENDPOINTS.loopLength, loopEndExclusive - loopStart);
    }

    beginGlobalGesture(endpointID: SeqFxGlobalEndpoint) {
        this.patchConnection.sendParameterGestureStart?.(endpointID);
    }

    endGlobalGesture(endpointID: SeqFxGlobalEndpoint) {
        this.patchConnection.sendParameterGestureEnd?.(endpointID);
    }

    toggleCell(edit: SeqFxCellToggleEdit) {
        this.commitState(applySeqFxCellToggle(this.state, edit), edit.patternIndex);
    }

    createBlock(edit: SeqFxBlockCreateEdit) {
        this.commitState(applySeqFxBlockCreate(this.state, edit), edit.patternIndex);
    }

    resizeBlock(edit: SeqFxBlockResizeEdit) {
        this.commitState(applySeqFxBlockResize(this.state, edit), edit.patternIndex);
    }

    previewBlockResize(edit: SeqFxBlockResizeEdit): SeqFxState {
        return applySeqFxBlockResize(this.state, edit);
    }

    moveBlock(edit: SeqFxBlockMoveEdit) {
        this.commitState(applySeqFxBlockMove(this.state, edit), edit.patternIndex);
    }

    previewBlockMove(edit: SeqFxBlockMoveEdit): SeqFxState {
        return applySeqFxBlockMove(this.state, edit);
    }

    moveBlockSelection(edit: SeqFxBlockSelectionMoveEdit): SeqFxBlockSelectionMoveResult {
        const result = applySeqFxBlockSelectionMove(this.state, edit);
        this.commitState(result.state, edit.patternIndex);
        return result;
    }

    previewBlockSelectionMove(edit: SeqFxBlockSelectionMoveEdit): SeqFxBlockSelectionMoveResult {
        return applySeqFxBlockSelectionMove(this.state, edit);
    }

    copyBlockSelection(edit: SeqFxBlockSelectionCopyEdit): SeqFxBlockSelectionCopyResult {
        const result = applySeqFxBlockSelectionCopy(this.state, edit);
        if (result.copiedStartSteps.length > 0) {
            this.commitState(result.state, edit.patternIndex);
        }
        return result;
    }

    previewBlockSelectionCopy(edit: SeqFxBlockSelectionCopyEdit): SeqFxBlockSelectionCopyResult {
        return applySeqFxBlockSelectionCopy(this.state, edit);
    }

    copyBlock(edit: SeqFxBlockCopyEdit) {
        this.commitState(applySeqFxBlockCopy(this.state, edit), edit.patternIndex);
    }

    previewBlockCopyPaint(edit: SeqFxBlockCopyPaintEdit): SeqFxBlockCopyPaintResult {
        return applySeqFxBlockCopyPaint(this.state, edit);
    }

    copyBlockPaint(edit: SeqFxBlockCopyPaintEdit): SeqFxBlockCopyPaintResult {
        const result = applySeqFxBlockCopyPaint(this.state, edit);
        if (result.copiedStartSteps.length > 0) {
            this.commitState(result.state, edit.patternIndex);
        }
        return result;
    }

    deleteBlock(edit: SeqFxBlockDeleteEdit) {
        this.commitState(applySeqFxBlockDelete(this.state, edit), edit.patternIndex);
    }

    deleteBlockSelection(edit: SeqFxBlockSelectionEditTarget) {
        this.commitState(applySeqFxBlockSelectionDelete(this.state, edit), edit.patternIndex);
    }

    setBlockMix(edit: SeqFxBlockMixEdit) {
        this.commitState(applySeqFxBlockMixEdit(this.state, edit), edit.patternIndex);
    }

    setBlockSelectionMix(edit: SeqFxBlockSelectionMixEdit) {
        this.commitState(applySeqFxBlockSelectionMixEdit(this.state, edit), edit.patternIndex);
    }

    setBlockParam(edit: SeqFxBlockParamEdit) {
        this.commitState(applySeqFxBlockParamEdit(this.state, edit), edit.patternIndex);
    }

    applyBlockPreset(edit: SeqFxBlockPresetEdit) {
        this.commitState(applySeqFxBlockPresetEdit(this.state, edit), edit.patternIndex);
    }

    setBlockAuxSource(edit: SeqFxBlockAuxSourceEdit) {
        this.commitState(applySeqFxBlockAuxSourceEdit(this.state, edit), edit.patternIndex);
    }

    setBlockAuxTargetEnabled(edit: SeqFxBlockAuxTargetToggleEdit) {
        this.commitState(applySeqFxBlockAuxTargetToggle(this.state, edit), edit.patternIndex);
    }

    setBlockAuxTargetEnd(edit: SeqFxBlockAuxTargetEndEdit) {
        this.commitState(applySeqFxBlockAuxTargetEndEdit(this.state, edit), edit.patternIndex);
    }

    setBlockSelectionAuxTargetEnabled(edit: SeqFxBlockSelectionAuxTargetToggleEdit) {
        this.commitState(applySeqFxBlockSelectionAuxTargetToggle(this.state, edit), edit.patternIndex);
    }

    setBlockSelectionAuxTargetEnd(edit: SeqFxBlockSelectionAuxTargetEndEdit) {
        this.commitState(applySeqFxBlockSelectionAuxTargetEndEdit(this.state, edit), edit.patternIndex);
    }

    setBlockEffect(edit: SeqFxBlockEffectEdit) {
        this.commitState(applySeqFxBlockEffectEdit(this.state, edit), edit.patternIndex);
    }

    setBlockSelectionParam(edit: SeqFxBlockSelectionParamEdit) {
        this.commitState(applySeqFxBlockSelectionParamEdit(this.state, edit), edit.patternIndex);
    }

    setStepMix(edit: SeqFxMixEdit) {
        this.commitState(applySeqFxMixEdit(this.state, edit), edit.patternIndex);
    }

    setStepParam(edit: SeqFxParamEdit) {
        this.commitState(applySeqFxParamEdit(this.state, edit), edit.patternIndex);
    }

    copyStepValues(target: SeqFxStepValueSnapshotTarget): SeqFxStepValueSnapshot {
        return getSeqFxStepValueSnapshot(this.state, target);
    }

    pasteStepValues(edit: SeqFxStepValuePasteEdit) {
        this.commitState(applySeqFxStepValuePaste(this.state, edit), edit.patternIndex);
    }

    playInternal() {
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.internalPlay, 1);
    }

    stopInternal() {
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.internalPlay, 0);
    }

    resetInternal() {
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.internalReset, 1);
    }

    canPasteLoop() {
        return this.loopClipboard !== null;
    }

    copyLoop() {
        this.loopClipboard = copySeqFxLoop(this.state, this.currentLoopTarget());
        return this.loopClipboard.lanes.some((lane) => lane.length > 0);
    }

    clearLoop() {
        return this.commitStateIfChanged(
            applySeqFxLoopClear(this.state, this.currentLoopTarget()),
            this.selectedPatternIndex,
        );
    }

    pasteLoop() {
        if (!this.loopClipboard) {
            return false;
        }

        return this.commitStateIfChanged(
            applySeqFxLoopPaste(this.state, this.currentLoopTarget(), this.loopClipboard),
            this.selectedPatternIndex,
        );
    }

    initPattern() {
        return this.commitStateIfChanged(
            applySeqFxPatternInit(this.state, this.selectedPatternIndex),
            this.selectedPatternIndex,
        );
    }

    loadFactoryPattern(patternId: string) {
        const factoryPattern = getSeqFxFactoryPattern(patternId);
        if (!factoryPattern) {
            return false;
        }

        return this.commitStateIfChanged(
            applySeqFxFactoryPattern(this.state, this.selectedPatternIndex, factoryPattern),
            this.selectedPatternIndex,
        );
    }

    varyLoop() {
        this.variationIndex += 1;
        return this.commitStateIfChanged(
            applySeqFxSafeLoopVariation(this.state, this.currentLoopTarget(), this.variationIndex),
            this.selectedPatternIndex,
        );
    }

    beginLiveEdit() {
        if (this.liveEditActive) {
            return;
        }

        this.liveEditActive = true;
        this.liveEditDirty = false;
        this.liveEditOrigin = this.cloneStateForHistory(this.state);
    }

    commitLiveEdit() {
        if (!this.liveEditActive) {
            return;
        }

        this.flushLiveRuntimeUpdate();
        const shouldPersist = this.liveEditDirty;
        const origin = this.liveEditOrigin;
        this.liveEditActive = false;
        this.liveEditDirty = false;
        this.liveEditOrigin = null;

        if (shouldPersist) {
            if (origin) {
                this.pushUndoState(origin);
            }
            this.persistState();
        }
    }

    cancelLiveEdit() {
        if (this.pendingLiveFrame !== null && typeof globalThis.cancelAnimationFrame === "function") {
            globalThis.cancelAnimationFrame(this.pendingLiveFrame);
        }

        this.liveEditActive = false;
        this.liveEditDirty = false;
        this.liveEditOrigin = null;
        this.pendingLiveNotify = false;
        this.pendingLivePatternUpload = null;
        this.pendingLiveFrame = null;
    }

    private commitState(nextState: SeqFxState, editedPatternIndex: number) {
        const previous = this.state;
        this.state = normalizeSeqFxState(nextState);
        if (this.liveEditActive) {
            this.liveEditDirty = true;
            this.scheduleLiveRuntimeUpdate(editedPatternIndex);
            return;
        }

        this.pushUndoState(previous);
        this.persistState();
        this.notifyStateListeners();
    }

    private commitStateIfChanged(nextState: SeqFxState, editedPatternIndex: number) {
        if (serializeSeqFxState(nextState) === serializeSeqFxState(this.state)) {
            return false;
        }

        this.commitState(nextState, editedPatternIndex);
        return true;
    }

    private currentLoopTarget() {
        return {
            patternIndex: this.selectedPatternIndex,
            startStep: this.globalControls.loopStart,
            length: this.globalControls.loopLength,
        };
    }

    private applyStoredState(rawState: unknown, key: string) {
        const nextState = rawState == null
            ? createDefaultSeqFxState()
            : key === SEQFX_STATE_KEY
                ? parseStrictSeqFxStateV7(rawState)
                : parseStrictSeqFxStateV5(rawState);

        this.cancelLiveEdit();
        this.clearHistory();
        this.state = nextState;
        if (key === SEQFX_STATE_KEY) {
            this.hasCurrentV7State = rawState != null;
        } else if (rawState != null) {
            this.persistState();
        }
        this.notifyStateListeners();
    }

    private scheduleLiveRuntimeUpdate(editedPatternIndex: number) {
        this.pendingLiveNotify = true;
        const resolvedPatternIndex = resolvePatternIndex(editedPatternIndex);
        if (resolvedPatternIndex === this.selectedPatternIndex) {
            this.pendingLivePatternUpload = resolvedPatternIndex;
        }

        if (this.pendingLiveFrame !== null) {
            return;
        }

        if (typeof globalThis.requestAnimationFrame !== "function") {
            this.flushLiveRuntimeUpdate();
            return;
        }

        this.pendingLiveFrame = globalThis.requestAnimationFrame(() => {
            this.pendingLiveFrame = null;
            this.flushLiveRuntimeUpdate();
        });
    }

    private flushLiveRuntimeUpdate() {
        if (!this.pendingLiveNotify) {
            return;
        }

        if (this.pendingLiveFrame !== null && typeof globalThis.cancelAnimationFrame === "function") {
            globalThis.cancelAnimationFrame(this.pendingLiveFrame);
        }

        const patternIndex = this.pendingLivePatternUpload;
        this.pendingLiveNotify = false;
        this.pendingLivePatternUpload = null;
        this.pendingLiveFrame = null;

        if (patternIndex !== null) {
            this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.patternUpload, buildSeqPatternUpload(this.state, {
                patternIndex,
                authoritative: false,
            }));
        }

        this.notifyStateListeners();
    }

    private persistState() {
        const serialized = serializeSeqFxState(this.state);
        this.hasCurrentV7State = true;
        this.rememberStoredEcho(serialized);
        this.patchConnection.sendStoredStateValue?.(SEQFX_STATE_KEY, serialized);
    }

    private requestLegacyBootState() {
        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.bootStoredStatePendingKey = SEQFX_LEGACY_STATE_KEY;
            this.patchConnection.requestStoredStateValue(SEQFX_LEGACY_STATE_KEY);
            return;
        }

        this.bootStoredStatePendingKey = null;
        this.applyStoredState(undefined, SEQFX_STATE_KEY);
        this.requestRuntimeValuesAfterBootState();
    }

    private parseReplacementState(value: unknown): SeqFxState {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const candidate = value as { version?: unknown; patterns?: unknown };
            const firstPattern = Array.isArray(candidate.patterns) ? candidate.patterns[0] : undefined;
            if (
                candidate.version === SEQFX_STATE_VERSION
                && firstPattern
                && typeof firstPattern === "object"
                && !Array.isArray(firstPattern)
                && Array.isArray((firstPattern as { lanes?: unknown }).lanes)
            ) {
                return normalizeSeqFxState(value);
            }
        }

        return parseSeqFxStoredState(value).state;
    }

    private cloneStateForHistory(state: SeqFxState): SeqFxState {
        return normalizeSeqFxState(state);
    }

    private pushUndoState(previous: SeqFxState) {
        if (serializeSeqFxState(previous) === serializeSeqFxState(this.state)) {
            return;
        }

        this.undoStack.push(this.cloneStateForHistory(previous));
        if (this.undoStack.length > SEQFX_UNDO_HISTORY_LIMIT) {
            this.undoStack.splice(0, this.undoStack.length - SEQFX_UNDO_HISTORY_LIMIT);
        }
        this.redoStack.length = 0;
    }

    private clearHistory() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
    }

    private requestRuntimeValuesAfterBootState() {
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.patternSelect);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.enabled);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.globalMix);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.clockMode);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.manualBpm);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.rate);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.swing);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.loopStart);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.loopLength);
    }

    private normalizeGlobalControlValue(endpointID: SeqFxGlobalEndpoint, value: unknown): number {
        switch (endpointID) {
            case SEQFX_ENDPOINTS.enabled:
                return resolveFiniteNumber(value, this.globalControls.enabled ? 1 : 0, 0, 1) >= 0.5 ? 1 : 0;
            case SEQFX_ENDPOINTS.globalMix:
                return resolveFiniteNumber(value, this.globalControls.globalMix, 0, 1);
            case SEQFX_ENDPOINTS.clockMode:
                return resolveInteger(value, this.globalControls.clockMode, 0, 2);
            case SEQFX_ENDPOINTS.manualBpm:
                return resolveFiniteNumber(value, this.globalControls.manualBpm, 20, 300);
            case SEQFX_ENDPOINTS.rate:
                return resolveRateIndex(value);
            case SEQFX_ENDPOINTS.swing:
                return resolveFiniteNumber(value, this.globalControls.swing, 0, 0.45);
            case SEQFX_ENDPOINTS.loopStart:
                return resolveInteger(value, this.globalControls.loopStart, 0, 31);
            case SEQFX_ENDPOINTS.loopLength:
                return resolveInteger(value, this.globalControls.loopLength, 1, 32 - this.globalControls.loopStart);
        }
    }

    private presentGlobalControlValue(endpointID: SeqFxGlobalEndpoint, value: number) {
        switch (endpointID) {
            case SEQFX_ENDPOINTS.enabled:
                this.handleEnabled(value);
                break;
            case SEQFX_ENDPOINTS.globalMix:
                this.handleGlobalMix(value);
                break;
            case SEQFX_ENDPOINTS.clockMode:
                this.handleClockMode(value);
                break;
            case SEQFX_ENDPOINTS.manualBpm:
                this.handleManualBpm(value);
                break;
            case SEQFX_ENDPOINTS.rate:
                this.handleRate(value);
                break;
            case SEQFX_ENDPOINTS.swing:
                this.handleSwing(value);
                break;
            case SEQFX_ENDPOINTS.loopStart:
                this.handleLoopStart(value);
                break;
            case SEQFX_ENDPOINTS.loopLength:
                this.handleLoopLength(value);
                break;
        }
    }

    private updateGlobalControls(patch: Partial<SeqFxGlobalControls>) {
        const nextControls = { ...this.globalControls, ...patch };
        const changed = Object.entries(nextControls).some(([key, value]) => (
            !Object.is(this.globalControls[key as keyof SeqFxGlobalControls], value)
        ));
        if (!changed) {
            return;
        }

        this.globalControls = nextControls;
        this.notifyGlobalControlsListeners();
    }

    private rememberStoredEcho(value: unknown) {
        const token = toEchoToken(value);
        this.pendingStoredEchoes.set(token, (this.pendingStoredEchoes.get(token) ?? 0) + 1);
    }

    private consumeStoredEcho(value: unknown) {
        const token = toEchoToken(value);
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

    private notifyStateListeners() {
        for (const listener of this.stateListeners) {
            listener(this.state);
        }
    }

    private notifyRateListeners() {
        for (const listener of this.rateListeners) {
            listener(this.rateIndex);
        }
    }

    private notifyGlobalControlsListeners() {
        const controls = this.getGlobalControls();
        for (const listener of this.globalControlsListeners) {
            listener(controls);
        }
    }
}
