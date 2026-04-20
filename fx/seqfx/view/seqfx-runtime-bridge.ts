import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import {
    SEQFX_STATE_KEY,
    applySeqFxBlockAuxCurveEdit,
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
    applySeqFxBlockResize,
    applySeqFxBlockSelectionDelete,
    applySeqFxBlockSelectionCopy,
    applySeqFxBlockSelectionMixEdit,
    applySeqFxBlockSelectionMove,
    applySeqFxBlockSelectionParamEdit,
    applySeqFxCellToggle,
    applySeqFxMixEdit,
    applySeqFxParamEdit,
    applySeqFxStepValuePaste,
    createDefaultSeqFxState,
    getSeqFxStepValueSnapshot,
    normalizeSeqFxState,
    parseStrictSeqFxStateV3,
    serializeSeqFxState,
    type SeqFxBlockAuxCurveEdit,
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
    type SeqFxBlockResizeEdit,
    type SeqFxBlockSelectionEditTarget,
    type SeqFxBlockSelectionCopyEdit,
    type SeqFxBlockSelectionCopyResult,
    type SeqFxBlockSelectionMixEdit,
    type SeqFxBlockSelectionMoveEdit,
    type SeqFxBlockSelectionMoveResult,
    type SeqFxBlockSelectionParamEdit,
    type SeqFxCellToggleEdit,
    type SeqFxMixEdit,
    type SeqFxParamEdit,
    type SeqFxState,
    type SeqFxStepValuePasteEdit,
    type SeqFxStepValueSnapshot,
    type SeqFxStepValueSnapshotTarget,
} from "./seqfx-state";

export const SEQFX_ENDPOINTS = {
    patternUpload: "patternUpload",
    patternSelect: "patternSelect",
    rate: "rate",
    monitorOut: "monitorOut",
    internalPlay: "internalPlay",
    internalReset: "internalReset",
} as const;

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type BridgeListener = (state: SeqFxState) => void;
type MonitorListener = (value: unknown) => void;
type RateListener = (rateIndex: number) => void;

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

export class SeqFxRuntimeBridge {
    private state: SeqFxState = createDefaultSeqFxState();
    private selectedPatternIndex = 0;
    private rateIndex = 1;
    private readonly stateListeners = new Set<BridgeListener>();
    private readonly monitorListeners = new Set<MonitorListener>();
    private readonly rateListeners = new Set<RateListener>();
    private readonly pendingStoredEchoes = new Map<string, number>();
    private attached = false;
    private bootStoredStatePending = false;

    private readonly handleStoredStateValue = (message: unknown) => {
        const stored = message as StoredStateMessage;

        if (stored?.key !== SEQFX_STATE_KEY) {
            return;
        }

        if (this.consumeStoredEcho(stored.value)) {
            return;
        }

        const isBootResponse = this.bootStoredStatePending;
        this.bootStoredStatePending = false;
        this.applyStoredState(stored.value);

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
        this.notifyRateListeners();
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
        this.patchConnection.addParameterListener?.(SEQFX_ENDPOINTS.rate, this.handleRate);
        this.patchConnection.addEndpointListener?.(SEQFX_ENDPOINTS.monitorOut, this.handleMonitor);
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.attached = false;
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.patternSelect, this.handlePatternSelect);
        this.patchConnection.removeParameterListener?.(SEQFX_ENDPOINTS.rate, this.handleRate);
        this.patchConnection.removeEndpointListener?.(SEQFX_ENDPOINTS.monitorOut, this.handleMonitor);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                const storedValue = getFullStoredStateValue(storedState, SEQFX_STATE_KEY);

                if (storedValue.found) {
                    this.bootStoredStatePending = false;
                    this.applyStoredState(storedValue.value);
                    this.requestRuntimeValuesAfterBootState();
                    return;
                }

                if (typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.bootStoredStatePending = true;
                    this.patchConnection.requestStoredStateValue(SEQFX_STATE_KEY);
                    return;
                }

                this.bootStoredStatePending = false;
                this.applyStoredState(undefined);
                this.requestRuntimeValuesAfterBootState();
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.bootStoredStatePending = true;
            this.patchConnection.requestStoredStateValue(SEQFX_STATE_KEY);
            return;
        }

        this.bootStoredStatePending = false;
        this.applyStoredState(undefined);
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

    getState() {
        return this.state;
    }

    getSelectedPatternIndex() {
        return this.selectedPatternIndex;
    }

    getRateIndex() {
        return this.rateIndex;
    }

    replaceStateFromPreset(nextState: SeqFxState) {
        this.state = parseStrictSeqFxStateV3(nextState);
        this.persistState();
        this.notifyStateListeners();
    }

    selectPattern(patternIndex: number) {
        const nextPatternIndex = resolvePatternIndex(patternIndex);
        this.selectedPatternIndex = nextPatternIndex;
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.patternSelect, nextPatternIndex);
        this.notifyStateListeners();
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

    setBlockAuxCurve(edit: SeqFxBlockAuxCurveEdit) {
        this.commitState(applySeqFxBlockAuxCurveEdit(this.state, edit), edit.patternIndex);
    }

    setBlockAuxTargetEnabled(edit: SeqFxBlockAuxTargetToggleEdit) {
        this.commitState(applySeqFxBlockAuxTargetToggle(this.state, edit), edit.patternIndex);
    }

    setBlockAuxTargetEnd(edit: SeqFxBlockAuxTargetEndEdit) {
        this.commitState(applySeqFxBlockAuxTargetEndEdit(this.state, edit), edit.patternIndex);
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

    private commitState(nextState: SeqFxState, _editedPatternIndex: number) {
        this.state = normalizeSeqFxState(nextState);
        this.persistState();
        this.notifyStateListeners();
    }

    private applyStoredState(rawState: unknown) {
        const nextState = rawState === undefined
            ? createDefaultSeqFxState()
            : parseStrictSeqFxStateV3(rawState);

        this.state = nextState;
        this.notifyStateListeners();
    }

    private persistState() {
        const serialized = serializeSeqFxState(this.state);
        this.rememberStoredEcho(serialized);
        this.patchConnection.sendStoredStateValue?.(SEQFX_STATE_KEY, serialized);
    }

    private requestRuntimeValuesAfterBootState() {
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.patternSelect);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.rate);
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
}
