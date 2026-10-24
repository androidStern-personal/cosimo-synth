import { useState, useSyncExternalStore } from "react";

import {
    usePatchConnection,
    usePluginHistory,
    usePluginState,
    type PatchConnectionLike,
    type PluginStateControl,
    type PluginStateEditor,
    type PluginStateHistory,
} from "../../../kit/index";
import definition from "../state";
import {
    applySeqFxFactoryPattern,
    applySeqFxSafeLoopVariation,
    getSeqFxFactoryPattern,
} from "./seqfx-factory-content";
import {
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    applySeqFxBlockAuxSourceEdit,
    applySeqFxBlockAuxTargetEndEdit,
    applySeqFxBlockAuxTargetToggle,
    applySeqFxBlockCopyPaint,
    applySeqFxBlockCreate,
    applySeqFxBlockDelete,
    applySeqFxBlockEffectEdit,
    applySeqFxBlockMixEdit,
    applySeqFxBlockMove,
    applySeqFxBlockParamEdit,
    applySeqFxBlockPresetEdit,
    applySeqFxBlockResize,
    applySeqFxBlockSelectionAuxTargetEndEdit,
    applySeqFxBlockSelectionAuxTargetToggle,
    applySeqFxBlockSelectionCopy,
    applySeqFxBlockSelectionDelete,
    applySeqFxBlockSelectionMixEdit,
    applySeqFxBlockSelectionMove,
    applySeqFxBlockSelectionParamEdit,
    applySeqFxLoopClear,
    applySeqFxLoopPaste,
    applySeqFxMixEdit,
    applySeqFxParamEdit,
    applySeqFxPatternInit,
    applySeqFxStepValuePaste,
    copySeqFxLoop,
    getSeqFxStepValueSnapshot,
    seqFxPatternsCodec,
    type SeqFxBlockAuxSourceEdit,
    type SeqFxBlockAuxTargetEndEdit,
    type SeqFxBlockAuxTargetToggleEdit,
    type SeqFxBlockCopyPaintEdit,
    type SeqFxBlockCopyPaintResult,
    type SeqFxBlockCreateEdit,
    type SeqFxBlockDeleteEdit,
    type SeqFxBlockEffectEdit,
    type SeqFxBlockMixEdit,
    type SeqFxBlockMoveEdit,
    type SeqFxBlockParamEdit,
    type SeqFxBlockPresetEdit,
    type SeqFxBlockResizeEdit,
    type SeqFxBlockSelectionAuxTargetEndEdit,
    type SeqFxBlockSelectionAuxTargetToggleEdit,
    type SeqFxBlockSelectionCopyEdit,
    type SeqFxBlockSelectionCopyResult,
    type SeqFxBlockSelectionEditTarget,
    type SeqFxBlockSelectionMixEdit,
    type SeqFxBlockSelectionMoveEdit,
    type SeqFxBlockSelectionMoveResult,
    type SeqFxBlockSelectionParamEdit,
    type SeqFxLoopClipboard,
    type SeqFxMixEdit,
    type SeqFxParamEdit,
    type SeqFxState,
    type SeqFxStepValuePasteEdit,
    type SeqFxStepValueSnapshot,
    type SeqFxStepValueSnapshotTarget,
} from "./seqfx-state";

/** The automatable controls above the grid, keyed by their field in state.ts. */
export type SeqFxGlobalControlKey = "enabled" | "mix" | "clock" | "manualBpm" | "rate" | "swing" | "loopStart" | "loopLength";

/** The global controls as the view shows them. */
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

type SeqFxMonitorVector = readonly [number, number, number, number];

/** A frame from the DSP's `monitorOut` event. */
export type SeqFxMonitorEvent = {
    readonly stepIndex: number | null;
    readonly stepDurationMs: number | null;
    readonly transportRunning: boolean;
    readonly auxCyclePhase: SeqFxMonitorVector | null;
    readonly auxAmount: SeqFxMonitorVector | null;
    readonly auxDurationMs: SeqFxMonitorVector | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseTransportRunning(value: unknown): boolean | null {
    if (value === true || value === 1 || value === "1" || value === "true") {
        return true;
    }
    if (value === false || value === 0 || value === "0" || value === "false") {
        return false;
    }
    return null;
}

function parseFiniteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseMonitorVector(value: unknown, minimum: number, maximum: number): SeqFxMonitorVector | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const values: readonly unknown[] = value;
    const entry = (index: number) => Math.min(maximum, Math.max(minimum, parseFiniteNumber(values[index]) ?? 0));
    return [entry(0), entry(1), entry(2), entry(3)];
}

/**
 * Parse a monitor frame, sent directly or inside Cmajor's `{ event }` envelope.
 * A frame without a readable transport flag is ignored, so the view keeps what it last showed.
 */
export function parseSeqFxMonitorEvent(value: unknown): SeqFxMonitorEvent | null {
    const candidate = isRecord(value) ? value.event ?? value : null;
    if (!isRecord(candidate)) {
        return null;
    }
    const transportRunning = parseTransportRunning(candidate.transportRunning);
    if (transportRunning === null) {
        return null;
    }
    return {
        stepIndex: parseFiniteNumber(candidate.stepIndex),
        stepDurationMs: parseFiniteNumber(candidate.stepDurationMs),
        transportRunning,
        auxCyclePhase: parseMonitorVector(candidate.auxCyclePhase, 0, 1),
        auxAmount: parseMonitorVector(candidate.auxAmount, 0, 1),
        auxDurationMs: parseMonitorVector(candidate.auxDurationMs, 0, Number.POSITIVE_INFINITY),
    };
}

type SeqFxDefinition = typeof definition;
type GlobalControls = Readonly<Record<SeqFxGlobalControlKey | "selectedPattern", PluginStateControl<number>>>;

/** The controls of the current render. Event handlers always act on the newest ones. */
type Rendered = {
    readonly patterns: PluginStateControl<SeqFxState>;
    readonly controls: GlobalControls;
    readonly editor: PluginStateEditor<SeqFxDefinition>;
    readonly history: PluginStateHistory;
    readonly connection: PatchConnectionLike;
    readonly state: SeqFxState;
};

function numberValue(control: PluginStateControl<number>, fallback: number): number {
    return "value" in control.state ? control.state.value : fallback;
}

/**
 * SeqFX's editing surface over the kit's plugin state: every pattern edit, global
 * control, Undo and Redo goes through the same state owner as presets and snapshots.
 * One instance lives for the life of the view; `useSeqFxSession` refreshes it each render.
 */
export class SeqFxSession {
    private latest: Rendered | null = null;
    private state: SeqFxState | null = null;
    /** Edits made in the current event, sent together as one change once the event finishes. */
    private unsent = false;
    /** Counts local edits, so the view redraws within the event that made them. */
    private edits = 0;
    private readonly editListeners = new Set<() => void>();

    readonly subscribeToEdits = (listener: () => void) => {
        this.editListeners.add(listener);
        return () => {
            this.editListeners.delete(listener);
        };
    };

    readonly editCount = () => this.edits;
    private loopClipboard: SeqFxLoopClipboard | null = null;
    private variationIndex = 0;
    private liveEditActive = false;
    private loopRangeGestureActive = false;

    /** Adopt this render's controls and the value it shows. */
    render(rendered: Rendered) {
        this.latest = rendered;
        if (!this.unsent) {
            this.state = rendered.state;
        }
    }

    private get rendered(): Rendered {
        if (!this.latest) {
            throw new Error("The SeqFX session is used before its first render.");
        }
        return this.latest;
    }

    getState(): SeqFxState {
        return this.state ?? this.rendered.state;
    }

    getSelectedPatternIndex(): number {
        return Math.min(SEQFX_PATTERN_COUNT - 1, Math.max(0, Math.round(numberValue(this.rendered.controls.selectedPattern, 0))));
    }

    getGlobalControls(): SeqFxGlobalControls {
        const { controls } = this.rendered;
        const loopStart = Math.round(numberValue(controls.loopStart, 0));
        return {
            enabled: numberValue(controls.enabled, 1) >= 0.5,
            globalMix: numberValue(controls.mix, 1),
            clockMode: Math.round(numberValue(controls.clock, 0)),
            manualBpm: numberValue(controls.manualBpm, 120),
            rateIndex: Math.round(numberValue(controls.rate, 1)),
            swing: numberValue(controls.swing, 0),
            loopStart,
            loopLength: Math.min(SEQFX_STEP_COUNT - loopStart, Math.round(numberValue(controls.loopLength, SEQFX_STEP_COUNT))),
        };
    }

    canUndo() {
        return this.rendered.history.canUndo;
    }

    canRedo() {
        return this.rendered.history.canRedo;
    }

    undo() {
        this.send();
        void this.rendered.history.undo();
    }

    redo() {
        this.send();
        void this.rendered.history.redo();
    }

    selectPattern(patternIndex: number) {
        void this.rendered.controls.selectedPattern.setValue(patternIndex);
    }

    /** Set a global control: inside its gesture while one is open, otherwise as one Undo entry. */
    setGlobalControl(key: SeqFxGlobalControlKey, value: number) {
        void this.rendered.controls[key].setValue(this.limitGlobalControl(key, value));
    }

    beginGlobalGesture(key: SeqFxGlobalControlKey) {
        void this.rendered.controls[key].beginGesture();
    }

    endGlobalGesture(key: SeqFxGlobalControlKey) {
        void this.rendered.controls[key].endGesture();
    }

    /** Loop start and length move together: one gesture, one Undo entry. */
    beginLoopRangeGesture() {
        if (!this.loopRangeGestureActive) {
            this.loopRangeGestureActive = true;
            void this.rendered.editor.beginGesture(["loopStart", "loopLength"]);
        }
    }

    endLoopRangeGesture() {
        if (this.loopRangeGestureActive) {
            this.loopRangeGestureActive = false;
            void this.rendered.editor.endGesture();
        }
    }

    setLoopRange(startStep: number, endStepExclusive: number) {
        const loopStart = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, Math.round(startStep)));
        const loopEnd = Math.min(SEQFX_STEP_COUNT, Math.max(loopStart + 1, Math.round(endStepExclusive)));
        void this.rendered.editor.edit({ loopStart, loopLength: loopEnd - loopStart });
    }

    playInternal() {
        this.rendered.connection.sendEventOrValue?.("internalPlay", 1);
    }

    stopInternal() {
        this.rendered.connection.sendEventOrValue?.("internalPlay", 0);
    }

    resetInternal() {
        this.rendered.connection.sendEventOrValue?.("internalReset", 1);
    }

    /** Listen to the DSP's playhead and modulation monitor until the returned function is called. */
    subscribeMonitor(listener: (event: SeqFxMonitorEvent) => void): () => void {
        const { connection } = this.rendered;
        const receive = (value: unknown) => {
            const event = parseSeqFxMonitorEvent(value);
            if (event) {
                listener(event);
            }
        };
        connection.addEndpointListener?.("monitorOut", receive);
        return () => connection.removeEndpointListener?.("monitorOut", receive);
    }

    /** Group the pattern edits of one drag into a single Undo entry. */
    beginLiveEdit() {
        this.send();
        if (!this.liveEditActive) {
            this.liveEditActive = true;
            void this.rendered.patterns.beginGesture();
        }
    }

    commitLiveEdit() {
        this.send();
        if (this.liveEditActive) {
            this.liveEditActive = false;
            void this.rendered.patterns.endGesture();
        }
    }

    createBlock(edit: SeqFxBlockCreateEdit) {
        this.commit(applySeqFxBlockCreate(this.getState(), edit));
    }

    resizeBlock(edit: SeqFxBlockResizeEdit) {
        this.commit(applySeqFxBlockResize(this.getState(), edit));
    }

    previewBlockResize(edit: SeqFxBlockResizeEdit): SeqFxState {
        return applySeqFxBlockResize(this.getState(), edit);
    }

    moveBlock(edit: SeqFxBlockMoveEdit) {
        this.commit(applySeqFxBlockMove(this.getState(), edit));
    }

    previewBlockMove(edit: SeqFxBlockMoveEdit): SeqFxState {
        return applySeqFxBlockMove(this.getState(), edit);
    }

    moveBlockSelection(edit: SeqFxBlockSelectionMoveEdit): SeqFxBlockSelectionMoveResult {
        const result = applySeqFxBlockSelectionMove(this.getState(), edit);
        this.commit(result.state);
        return result;
    }

    previewBlockSelectionMove(edit: SeqFxBlockSelectionMoveEdit): SeqFxBlockSelectionMoveResult {
        return applySeqFxBlockSelectionMove(this.getState(), edit);
    }

    copyBlockSelection(edit: SeqFxBlockSelectionCopyEdit): SeqFxBlockSelectionCopyResult {
        const result = applySeqFxBlockSelectionCopy(this.getState(), edit);
        if (result.copiedStartSteps.length > 0) {
            this.commit(result.state);
        }
        return result;
    }

    previewBlockSelectionCopy(edit: SeqFxBlockSelectionCopyEdit): SeqFxBlockSelectionCopyResult {
        return applySeqFxBlockSelectionCopy(this.getState(), edit);
    }

    previewBlockCopyPaint(edit: SeqFxBlockCopyPaintEdit): SeqFxBlockCopyPaintResult {
        return applySeqFxBlockCopyPaint(this.getState(), edit);
    }

    copyBlockPaint(edit: SeqFxBlockCopyPaintEdit): SeqFxBlockCopyPaintResult {
        const result = applySeqFxBlockCopyPaint(this.getState(), edit);
        if (result.copiedStartSteps.length > 0) {
            this.commit(result.state);
        }
        return result;
    }

    deleteBlock(edit: SeqFxBlockDeleteEdit) {
        this.commit(applySeqFxBlockDelete(this.getState(), edit));
    }

    deleteBlockSelection(edit: SeqFxBlockSelectionEditTarget) {
        this.commit(applySeqFxBlockSelectionDelete(this.getState(), edit));
    }

    setBlockMix(edit: SeqFxBlockMixEdit) {
        this.commit(applySeqFxBlockMixEdit(this.getState(), edit));
    }

    setBlockSelectionMix(edit: SeqFxBlockSelectionMixEdit) {
        this.commit(applySeqFxBlockSelectionMixEdit(this.getState(), edit));
    }

    setBlockParam(edit: SeqFxBlockParamEdit) {
        this.commit(applySeqFxBlockParamEdit(this.getState(), edit));
    }

    applyBlockPreset(edit: SeqFxBlockPresetEdit) {
        this.commit(applySeqFxBlockPresetEdit(this.getState(), edit));
    }

    setBlockAuxSource(edit: SeqFxBlockAuxSourceEdit) {
        this.commit(applySeqFxBlockAuxSourceEdit(this.getState(), edit));
    }

    setBlockAuxTargetEnabled(edit: SeqFxBlockAuxTargetToggleEdit) {
        this.commit(applySeqFxBlockAuxTargetToggle(this.getState(), edit));
    }

    setBlockAuxTargetEnd(edit: SeqFxBlockAuxTargetEndEdit) {
        this.commit(applySeqFxBlockAuxTargetEndEdit(this.getState(), edit));
    }

    setBlockSelectionAuxTargetEnabled(edit: SeqFxBlockSelectionAuxTargetToggleEdit) {
        this.commit(applySeqFxBlockSelectionAuxTargetToggle(this.getState(), edit));
    }

    setBlockSelectionAuxTargetEnd(edit: SeqFxBlockSelectionAuxTargetEndEdit) {
        this.commit(applySeqFxBlockSelectionAuxTargetEndEdit(this.getState(), edit));
    }

    setBlockEffect(edit: SeqFxBlockEffectEdit) {
        this.commit(applySeqFxBlockEffectEdit(this.getState(), edit));
    }

    setBlockSelectionParam(edit: SeqFxBlockSelectionParamEdit) {
        this.commit(applySeqFxBlockSelectionParamEdit(this.getState(), edit));
    }

    setStepMix(edit: SeqFxMixEdit) {
        this.commit(applySeqFxMixEdit(this.getState(), edit));
    }

    setStepParam(edit: SeqFxParamEdit) {
        this.commit(applySeqFxParamEdit(this.getState(), edit));
    }

    copyStepValues(target: SeqFxStepValueSnapshotTarget): SeqFxStepValueSnapshot {
        return getSeqFxStepValueSnapshot(this.getState(), target);
    }

    pasteStepValues(edit: SeqFxStepValuePasteEdit) {
        this.commit(applySeqFxStepValuePaste(this.getState(), edit));
    }

    canPasteLoop() {
        return this.loopClipboard !== null;
    }

    copyLoop() {
        this.loopClipboard = copySeqFxLoop(this.getState(), this.loopTarget());
    }

    clearLoop() {
        this.commit(applySeqFxLoopClear(this.getState(), this.loopTarget()));
    }

    pasteLoop() {
        if (this.loopClipboard) {
            this.commit(applySeqFxLoopPaste(this.getState(), this.loopTarget(), this.loopClipboard));
        }
    }

    initPattern() {
        this.commit(applySeqFxPatternInit(this.getState(), this.getSelectedPatternIndex()));
    }

    loadFactoryPattern(patternId: string) {
        const factoryPattern = getSeqFxFactoryPattern(patternId);
        if (factoryPattern) {
            this.commit(applySeqFxFactoryPattern(this.getState(), this.getSelectedPatternIndex(), factoryPattern));
        }
    }

    varyLoop() {
        this.variationIndex += 1;
        this.commit(applySeqFxSafeLoopVariation(this.getState(), this.loopTarget(), this.variationIndex));
    }

    private loopTarget() {
        const { loopStart, loopLength } = this.getGlobalControls();
        return { patternIndex: this.getSelectedPatternIndex(), startStep: loopStart, length: loopLength };
    }

    private limitGlobalControl(key: SeqFxGlobalControlKey, value: number): number {
        return key === "loopLength" ? Math.min(value, SEQFX_STEP_COUNT - this.getGlobalControls().loopStart) : value;
    }

    /**
     * Keep the edited patterns for the next edit in this event, then hand them to the state owner,
     * which saves them, sends them to the DSP and records Undo. One user action that makes several
     * edits, such as moving both ends of a filter range, becomes one change.
     */
    private commit(next: SeqFxState) {
        if (seqFxPatternsCodec.equals(this.getState(), next)) {
            return;
        }
        this.state = next;
        this.edits += 1;
        if (!this.unsent) {
            this.unsent = true;
            queueMicrotask(() => this.send());
        }
        // A controlled input restores its old value after the event unless the view redraws now.
        for (const listener of this.editListeners) {
            listener();
        }
    }

    private send() {
        if (this.unsent) {
            this.unsent = false;
            void this.rendered.patterns.setValue(this.getState());
        }
    }
}

/**
 * The view's SeqFX session, or null until the patterns and every global control
 * have their values. Call it from a component inside `createStatefulPatchView`.
 */
export function useSeqFxSession(): SeqFxSession | null {
    const patterns = usePluginState(definition.patterns);
    const controls: GlobalControls = {
        enabled: usePluginState(definition.enabled),
        mix: usePluginState(definition.mix),
        selectedPattern: usePluginState(definition.selectedPattern),
        clock: usePluginState(definition.clock),
        manualBpm: usePluginState(definition.manualBpm),
        rate: usePluginState(definition.rate),
        swing: usePluginState(definition.swing),
        loopStart: usePluginState(definition.loopStart),
        loopLength: usePluginState(definition.loopLength),
    };
    const editor = usePluginState(definition);
    const history = usePluginHistory();
    const connection = usePatchConnection();
    const ready = "value" in patterns.state && Object.values(controls).every((control) => "value" in control.state);
    const rendered = ready && "value" in patterns.state
        ? { patterns, controls, editor, history, connection, state: patterns.state.value }
        : null;
    const [session] = useState(() => new SeqFxSession());
    useSyncExternalStore(session.subscribeToEdits, session.editCount);
    if (!rendered) {
        return null;
    }
    session.render(rendered);
    return session;
}
