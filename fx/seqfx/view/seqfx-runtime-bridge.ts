import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import {
    SEQFX_STATE_KEY,
    applySeqFxBlockCreate,
    applySeqFxBlockCopy,
    applySeqFxBlockDelete,
    applySeqFxBlockMixEdit,
    applySeqFxBlockMove,
    applySeqFxBlockParamEdit,
    applySeqFxBlockResize,
    applySeqFxCellToggle,
    applySeqFxMixEdit,
    applySeqFxParamEdit,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    normalizeSeqFxState,
    serializeSeqFxState,
    type SeqFxBlockCreateEdit,
    type SeqFxBlockCopyEdit,
    type SeqFxBlockDeleteEdit,
    type SeqFxBlockMixEdit,
    type SeqFxBlockMoveEdit,
    type SeqFxBlockParamEdit,
    type SeqFxBlockResizeEdit,
    type SeqFxCellToggleEdit,
    type SeqFxMixEdit,
    type SeqFxParamEdit,
    type SeqFxState,
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
    private patternSelectResolvedDuringRequest = false;

    private readonly handleStoredStateValue = (message: unknown) => {
        const stored = message as StoredStateMessage;

        if (stored?.key !== SEQFX_STATE_KEY) {
            return;
        }

        if (this.consumeStoredEcho(stored.value)) {
            return;
        }

        this.applyStoredState(stored.value, true);
    };

    private readonly handlePatternSelect = (value: unknown) => {
        this.patternSelectResolvedDuringRequest = true;
        this.selectedPatternIndex = resolvePatternIndex(value);
        this.uploadSelectedPattern(true);
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
        let sawFullState = false;

        this.patchConnection.requestFullStoredState?.((storedState) => {
            sawFullState = true;
            this.applyStoredState(storedState?.[SEQFX_STATE_KEY], false);
        });

        if (!sawFullState) {
            this.applyStoredState(undefined, false);
        }

        this.patternSelectResolvedDuringRequest = false;
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.patternSelect);
        this.patchConnection.requestParameterValue?.(SEQFX_ENDPOINTS.rate);

        if (!this.patternSelectResolvedDuringRequest) {
            this.uploadSelectedPattern(true);
        }

        if (!sawFullState) {
            this.patchConnection.requestStoredStateValue?.(SEQFX_STATE_KEY);
        }
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

    selectPattern(patternIndex: number) {
        const nextPatternIndex = resolvePatternIndex(patternIndex);
        this.selectedPatternIndex = nextPatternIndex;
        this.patchConnection.sendEventOrValue?.(SEQFX_ENDPOINTS.patternSelect, nextPatternIndex);
        this.uploadSelectedPattern(true);
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

    moveBlock(edit: SeqFxBlockMoveEdit) {
        this.commitState(applySeqFxBlockMove(this.state, edit), edit.patternIndex);
    }

    copyBlock(edit: SeqFxBlockCopyEdit) {
        this.commitState(applySeqFxBlockCopy(this.state, edit), edit.patternIndex);
    }

    deleteBlock(edit: SeqFxBlockDeleteEdit) {
        this.commitState(applySeqFxBlockDelete(this.state, edit), edit.patternIndex);
    }

    setBlockMix(edit: SeqFxBlockMixEdit) {
        this.commitState(applySeqFxBlockMixEdit(this.state, edit), edit.patternIndex);
    }

    setBlockParam(edit: SeqFxBlockParamEdit) {
        this.commitState(applySeqFxBlockParamEdit(this.state, edit), edit.patternIndex);
    }

    setStepMix(edit: SeqFxMixEdit) {
        this.commitState(applySeqFxMixEdit(this.state, edit), edit.patternIndex);
    }

    setStepParam(edit: SeqFxParamEdit) {
        this.commitState(applySeqFxParamEdit(this.state, edit), edit.patternIndex);
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

    private commitState(nextState: SeqFxState, editedPatternIndex: number) {
        this.state = normalizeSeqFxState(nextState);
        this.persistState();

        if (resolvePatternIndex(editedPatternIndex) === this.selectedPatternIndex) {
            this.uploadSelectedPattern(false);
        }

        this.notifyStateListeners();
    }

    private applyStoredState(rawState: unknown, uploadAuthoritative: boolean) {
        const nextState = normalizeSeqFxState(rawState ?? createDefaultSeqFxState());
        const nextSerialized = serializeSeqFxState(nextState);
        const rawSerialized = typeof rawState === "string" ? rawState : undefined;

        this.state = nextState;

        if (rawSerialized !== nextSerialized) {
            this.rememberStoredEcho(nextSerialized);
            this.patchConnection.sendStoredStateValue?.(SEQFX_STATE_KEY, nextSerialized);
        }

        if (uploadAuthoritative) {
            this.uploadSelectedPattern(true);
        }

        this.notifyStateListeners();
    }

    private persistState() {
        const serialized = serializeSeqFxState(this.state);
        this.rememberStoredEcho(serialized);
        this.patchConnection.sendStoredStateValue?.(SEQFX_STATE_KEY, serialized);
    }

    private uploadSelectedPattern(authoritative: boolean) {
        this.patchConnection.sendEventOrValue?.(
            SEQFX_ENDPOINTS.patternUpload,
            buildSeqPatternUpload(this.state, {
                patternIndex: this.selectedPatternIndex,
                authoritative,
            }),
        );
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
