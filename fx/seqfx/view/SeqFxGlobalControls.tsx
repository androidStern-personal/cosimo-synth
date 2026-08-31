import { useEffect, useRef, type PointerEvent } from "react";

import { EditorTickSlider } from "../../../ui/shared/editor-tick-slider";
import { parameterEntrySpecForScalar } from "../../../ui/shared/parameter-value-entry";
import { SEQFX_FACTORY_PATTERNS } from "./seqfx-factory-content";
import {
    SEQFX_ENDPOINTS,
    type SeqFxGlobalControls,
} from "./seqfx-runtime-bridge";

type GlobalControlEndpoint =
    | typeof SEQFX_ENDPOINTS.enabled
    | typeof SEQFX_ENDPOINTS.globalMix
    | typeof SEQFX_ENDPOINTS.clockMode
    | typeof SEQFX_ENDPOINTS.manualBpm
    | typeof SEQFX_ENDPOINTS.rate
    | typeof SEQFX_ENDPOINTS.swing
    | typeof SEQFX_ENDPOINTS.loopStart
    | typeof SEQFX_ENDPOINTS.loopLength;

type LoopDragEdge = "start" | "end";

const CLOCK_OPTIONS = ["Host", "Internal", "Manual"] as const;
const RATE_OPTIONS = ["1/8", "1/16", "1/32"] as const;
const MANUAL_BPM_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: 20,
    max: 300,
    step: 0.1,
    unit: "BPM",
    digits: 1,
});

function loopStepEntrySpec(min: number, max: number) {
    return parameterEntrySpecForScalar({ min, max, step: 1, unit: "", digits: 0 });
}

function clampStep(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Math.round(value)));
}

function nearestLoopEdge(step: number, loopStart: number, loopEndExclusive: number): LoopDragEdge {
    return Math.abs(step - loopStart) <= Math.abs(step - (loopEndExclusive - 1)) ? "start" : "end";
}

function nearestLoopStepFromPointer(ruler: HTMLDivElement, clientX: number, clientY: number) {
    const exactTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-loop-step]");
    const exactStep = Number(exactTarget?.dataset.loopStep);
    if (exactTarget && ruler.contains(exactTarget) && Number.isInteger(exactStep)) {
        return exactStep;
    }

    let nearestStep = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const button of ruler.querySelectorAll<HTMLElement>("[data-loop-step]")) {
        const step = Number(button.dataset.loopStep);
        if (!Number.isInteger(step)) {
            continue;
        }
        const rect = button.getBoundingClientRect();
        const distanceX = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const distanceY = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const distance = (distanceX * distanceX) + (distanceY * distanceY);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestStep = step;
        }
    }
    return nearestStep;
}

export function SeqFxGlobalControlSurface({
    controls,
    internalRunning,
    playheadStep,
    canUndo,
    canRedo,
    hasLoopClipboard,
    onGlobalControl,
    onGlobalControlCommit,
    onGlobalGestureStart,
    onGlobalGestureEnd,
    onLoopRangeChange,
    onInternalTransport,
    onReset,
    onUndo,
    onRedo,
    onInitPattern,
    onClearLoop,
    onCopyLoop,
    onPasteLoop,
    onLoadFactoryPattern,
    onVaryLoop,
}: {
    controls: SeqFxGlobalControls;
    internalRunning: boolean;
    playheadStep: number | null;
    canUndo: boolean;
    canRedo: boolean;
    hasLoopClipboard: boolean;
    onGlobalControl: (endpointID: GlobalControlEndpoint, value: number) => void;
    onGlobalControlCommit: (endpointID: GlobalControlEndpoint, value: number) => void;
    onGlobalGestureStart: (endpointID: GlobalControlEndpoint) => void;
    onGlobalGestureEnd: (endpointID: GlobalControlEndpoint) => void;
    onLoopRangeChange: (startStep: number, endStepExclusive: number) => void;
    onInternalTransport: (running: boolean) => void;
    onReset: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onInitPattern: () => void;
    onClearLoop: () => void;
    onCopyLoop: () => void;
    onPasteLoop: () => void;
    onLoadFactoryPattern: (patternId: string) => void;
    onVaryLoop: () => void;
}) {
    const loopEndExclusive = Math.min(32, controls.loopStart + controls.loopLength);
    const loopRulerRef = useRef<HTMLDivElement | null>(null);
    const dragEdgeRef = useRef<LoopDragEdge | null>(null);
    const loopPointerIdRef = useRef<number | null>(null);
    const loopGestureActiveRef = useRef(false);
    const activeGestureEndpointsRef = useRef(new Set<GlobalControlEndpoint>());
    const pointerGestureOwnersRef = useRef(new Map<GlobalControlEndpoint, number>());
    const globalGestureStartRef = useRef(onGlobalGestureStart);
    const globalGestureEndRef = useRef(onGlobalGestureEnd);
    globalGestureStartRef.current = onGlobalGestureStart;
    globalGestureEndRef.current = onGlobalGestureEnd;

    function beginLoopGesture() {
        if (loopGestureActiveRef.current) {
            return;
        }

        loopGestureActiveRef.current = true;
        beginGesture(SEQFX_ENDPOINTS.loopStart);
        beginGesture(SEQFX_ENDPOINTS.loopLength);
    }

    function endLoopGesture() {
        if (!loopGestureActiveRef.current) {
            return;
        }

        loopGestureActiveRef.current = false;
        endGesture(SEQFX_ENDPOINTS.loopStart);
        endGesture(SEQFX_ENDPOINTS.loopLength);
    }

    useEffect(() => {
        const endPointerInteraction = (event: globalThis.PointerEvent) => {
            endLoopPointerInteraction(event.pointerId);
            for (const [endpointID, pointerId] of [...pointerGestureOwnersRef.current]) {
                if (pointerId === event.pointerId) {
                    endPointerGesture(endpointID, pointerId);
                }
            }
        };
        const endAllInteractions = () => {
            dragEdgeRef.current = null;
            loopPointerIdRef.current = null;
            endLoopGesture();
            for (const endpointID of [...activeGestureEndpointsRef.current]) {
                endGesture(endpointID);
            }
            pointerGestureOwnersRef.current.clear();
        };
        window.addEventListener("pointerup", endPointerInteraction);
        window.addEventListener("pointercancel", endPointerInteraction);
        window.addEventListener("blur", endAllInteractions);
        return () => {
            window.removeEventListener("pointerup", endPointerInteraction);
            window.removeEventListener("pointercancel", endPointerInteraction);
            window.removeEventListener("blur", endAllInteractions);
            endAllInteractions();
        };
    }, []);

    function changeLoopEdge(edge: LoopDragEdge, step: number) {
        if (edge === "start") {
            onLoopRangeChange(clampStep(step, 0, loopEndExclusive - 1), loopEndExclusive);
            return;
        }

        onLoopRangeChange(controls.loopStart, clampStep(step + 1, controls.loopStart + 1, 32));
    }

    function handleLoopPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (loopPointerIdRef.current !== null) {
            return;
        }

        if (!(event.target instanceof Element)) {
            return;
        }

        const target = event.target.closest<HTMLElement>("[data-loop-step]");
        const step = Number(target?.dataset.loopStep);
        if (!Number.isInteger(step)) {
            return;
        }

        const edge = nearestLoopEdge(step, controls.loopStart, loopEndExclusive);
        dragEdgeRef.current = edge;
        loopPointerIdRef.current = event.pointerId;
        beginLoopGesture();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic and capture-loss paths retain window-level owner cleanup.
        }
        changeLoopEdge(edge, step);
    }

    function handleLoopPointerMove(event: PointerEvent<HTMLDivElement>) {
        const edge = dragEdgeRef.current;
        const ruler = loopRulerRef.current;
        if (
            !edge
            || !ruler
            || event.pointerId !== loopPointerIdRef.current
            || (event.pointerType === "mouse" && event.buttons === 0)
        ) {
            return;
        }

        const step = nearestLoopStepFromPointer(ruler, event.clientX, event.clientY);
        changeLoopEdge(edge, step);
    }

    function endLoopPointerInteraction(pointerId: number) {
        if (loopPointerIdRef.current !== pointerId) {
            return;
        }

        loopPointerIdRef.current = null;
        dragEdgeRef.current = null;
        endLoopGesture();
    }

    function beginGesture(endpointID: GlobalControlEndpoint) {
        if (activeGestureEndpointsRef.current.has(endpointID)) {
            return;
        }
        activeGestureEndpointsRef.current.add(endpointID);
        globalGestureStartRef.current(endpointID);
    }

    function endGesture(endpointID: GlobalControlEndpoint) {
        if (!activeGestureEndpointsRef.current.delete(endpointID)) {
            return;
        }
        globalGestureEndRef.current(endpointID);
    }

    function beginPointerGesture(endpointID: GlobalControlEndpoint, event: PointerEvent<HTMLInputElement>) {
        if (pointerGestureOwnersRef.current.has(endpointID)) {
            return;
        }

        pointerGestureOwnersRef.current.set(endpointID, event.pointerId);
        beginGesture(endpointID);
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointers still close through the window-level owner listener.
        }
    }

    function endPointerGesture(endpointID: GlobalControlEndpoint, pointerId?: number) {
        const ownerPointerId = pointerGestureOwnersRef.current.get(endpointID);
        if (ownerPointerId === undefined || (pointerId !== undefined && ownerPointerId !== pointerId)) {
            return;
        }

        pointerGestureOwnersRef.current.delete(endpointID);
        endGesture(endpointID);
    }

    const clockOwnsTransport = controls.clockMode === 1;
    const manualTempoAvailable = controls.clockMode !== 0;

    return (
        <section className="seqfx-global" data-role="seqfx-global-controls" aria-label="SeqFX global controls">
            <div className="seqfx-global__controls">
                <button
                    aria-checked={controls.enabled}
                    className={controls.enabled ? "seqfx-global__on is-on" : "seqfx-global__on"}
                    data-role="seqfx-enabled"
                    onClick={() => onGlobalControlCommit(SEQFX_ENDPOINTS.enabled, controls.enabled ? 0 : 1)}
                    role="switch"
                    type="button"
                >
                    <span aria-hidden="true" />
                    SeqFX {controls.enabled ? "On" : "Off"}
                </button>

                <label className="seqfx-global__field seqfx-global__field--mix">
                    <span>Mix</span>
                    <input
                        aria-label="SeqFX global mix"
                        data-role="seqfx-global-mix"
                        max="1"
                        min="0"
                        onBlur={() => endPointerGesture(SEQFX_ENDPOINTS.globalMix)}
                        onChange={(event) => onGlobalControl(SEQFX_ENDPOINTS.globalMix, Number(event.currentTarget.value))}
                        onLostPointerCapture={(event) => endPointerGesture(SEQFX_ENDPOINTS.globalMix, event.pointerId)}
                        onPointerCancel={(event) => endPointerGesture(SEQFX_ENDPOINTS.globalMix, event.pointerId)}
                        onPointerDown={(event) => beginPointerGesture(SEQFX_ENDPOINTS.globalMix, event)}
                        onPointerUp={(event) => endPointerGesture(SEQFX_ENDPOINTS.globalMix, event.pointerId)}
                        step="0.01"
                        type="range"
                        value={controls.globalMix}
                    />
                    <output>{Math.round(controls.globalMix * 100)}%</output>
                </label>

                <label className="seqfx-global__field">
                    <span>Clock</span>
                    <select
                        aria-label="Clock source"
                        data-role="seqfx-clock-mode"
                        onChange={(event) => onGlobalControlCommit(SEQFX_ENDPOINTS.clockMode, Number(event.currentTarget.value))}
                        value={controls.clockMode}
                    >
                        {CLOCK_OPTIONS.map((option, index) => <option key={option} value={index}>{option}</option>)}
                    </select>
                </label>

                <div
                    className="seqfx-global__segmented seqfx-global__segmented--bpm"
                    title={manualTempoAvailable ? "Manual tempo" : "The host supplies tempo in Host mode."}
                >
                    <EditorTickSlider
                        dataRole="seqfx-manual-bpm-control"
                        disabled={!manualTempoAvailable}
                        entrySpec={MANUAL_BPM_ENTRY_SPEC}
                        formatValue={(value) => `${Number(value.toFixed(1))} BPM`}
                        inputDataRole="seqfx-manual-bpm"
                        label="BPM"
                        max={300}
                        min={20}
                        onChange={(value) => onGlobalControl(SEQFX_ENDPOINTS.manualBpm, value)}
                        onGestureEnd={() => endGesture(SEQFX_ENDPOINTS.manualBpm)}
                        onGestureStart={() => beginGesture(SEQFX_ENDPOINTS.manualBpm)}
                        step={0.1}
                        tickCount={12}
                        value={controls.manualBpm}
                        valueDataRole="seqfx-manual-bpm-value"
                    />
                </div>

                <label className="seqfx-global__field">
                    <span>Rate</span>
                    <select
                        aria-label="Sequence rate"
                        data-role="seqfx-rate"
                        onChange={(event) => onGlobalControlCommit(SEQFX_ENDPOINTS.rate, Number(event.currentTarget.value))}
                        value={controls.rateIndex}
                    >
                        {RATE_OPTIONS.map((option, index) => <option key={option} value={index}>{option}</option>)}
                    </select>
                </label>

                <label className="seqfx-global__field seqfx-global__field--swing">
                    <span>Swing</span>
                    <input
                        aria-label="Swing"
                        data-role="seqfx-swing"
                        max="0.45"
                        min="0"
                        onBlur={() => endPointerGesture(SEQFX_ENDPOINTS.swing)}
                        onChange={(event) => onGlobalControl(SEQFX_ENDPOINTS.swing, Number(event.currentTarget.value))}
                        onLostPointerCapture={(event) => endPointerGesture(SEQFX_ENDPOINTS.swing, event.pointerId)}
                        onPointerCancel={(event) => endPointerGesture(SEQFX_ENDPOINTS.swing, event.pointerId)}
                        onPointerDown={(event) => beginPointerGesture(SEQFX_ENDPOINTS.swing, event)}
                        onPointerUp={(event) => endPointerGesture(SEQFX_ENDPOINTS.swing, event.pointerId)}
                        step="0.01"
                        type="range"
                        value={controls.swing}
                    />
                    <output>{Math.round(controls.swing * 100)}%</output>
                </label>

                <div className="seqfx-global__actions" role="group" aria-label="Transport and edit actions">
                    <button
                        aria-label={internalRunning ? "Stop internal clock" : "Play internal clock"}
                        className={internalRunning && clockOwnsTransport ? "is-active" : undefined}
                        data-role="seqfx-internal-transport"
                        disabled={!clockOwnsTransport}
                        onClick={() => onInternalTransport(!internalRunning)}
                        title={clockOwnsTransport ? "Start or stop the internal clock." : "Choose Internal clock to control transport here."}
                        type="button"
                    >
                        {internalRunning && clockOwnsTransport ? "Stop" : "Play"}
                    </button>
                    <button data-role="seqfx-reset" onClick={onReset} type="button">Reset</button>
                    <button aria-label="Undo edit" data-role="seqfx-undo" disabled={!canUndo} onClick={onUndo} type="button">Undo</button>
                    <button aria-label="Redo edit" data-role="seqfx-redo" disabled={!canRedo} onClick={onRedo} type="button">Redo</button>
                </div>
            </div>

            <div className="seqfx-loop">
                <div className="seqfx-loop__meta">
                    <strong>Loop</strong>
                    <div className="seqfx-loop__segmented">
                        <EditorTickSlider
                            dataRole="seqfx-loop-start-control"
                            discrete
                            entrySpec={loopStepEntrySpec(1, loopEndExclusive)}
                            formatValue={(value) => String(Math.round(value))}
                            inputDataRole="seqfx-loop-start"
                            label="Start"
                            max={loopEndExclusive}
                            min={1}
                            onChange={(value) => onLoopRangeChange(value - 1, loopEndExclusive)}
                            onGestureEnd={endLoopGesture}
                            onGestureStart={beginLoopGesture}
                            step={1}
                            tickCount={Math.min(16, loopEndExclusive)}
                            value={controls.loopStart + 1}
                            valueDataRole="seqfx-loop-start-value"
                        />
                    </div>
                    <div className="seqfx-loop__segmented">
                        <EditorTickSlider
                            dataRole="seqfx-loop-end-control"
                            discrete
                            entrySpec={loopStepEntrySpec(controls.loopStart + 1, 32)}
                            formatValue={(value) => String(Math.round(value))}
                            inputDataRole="seqfx-loop-end"
                            label="End"
                            max={32}
                            min={controls.loopStart + 1}
                            onChange={(value) => onLoopRangeChange(controls.loopStart, value)}
                            onGestureEnd={endLoopGesture}
                            onGestureStart={beginLoopGesture}
                            step={1}
                            tickCount={Math.min(16, 32 - controls.loopStart)}
                            value={loopEndExclusive}
                            valueDataRole="seqfx-loop-end-value"
                        />
                    </div>
                    <output>{controls.loopLength} steps</output>
                    <div className="seqfx-loop__actions" role="group" aria-label="Loop edit actions">
                        <button data-role="seqfx-init-pattern" onClick={onInitPattern} title="Clear this pattern. Undo restores it." type="button">Init</button>
                        <button data-role="seqfx-clear-loop" onClick={onClearLoop} title="Clear blocks touching the loop. Undo restores them." type="button">Clear</button>
                        <button data-role="seqfx-copy-loop" onClick={onCopyLoop} type="button">Copy</button>
                        <button data-role="seqfx-paste-loop" disabled={!hasLoopClipboard} onClick={onPasteLoop} type="button">Paste</button>
                        <button
                            data-role="seqfx-vary-loop"
                            onClick={onVaryLoop}
                            title="Vary only the blocks touching this loop, using qualified factory-preset values. Undo restores them."
                            type="button"
                        >
                            Vary
                        </button>
                    </div>
                    <label className="seqfx-loop__factory">
                        <span>Factory</span>
                        <select
                            aria-label="Load factory pattern"
                            data-role="seqfx-factory-pattern"
                            defaultValue=""
                            onChange={(event) => {
                                if (event.currentTarget.value) {
                                    onLoadFactoryPattern(event.currentTarget.value);
                                    event.currentTarget.value = "";
                                }
                            }}
                            title="Replace the current pattern. Undo restores it."
                        >
                            <option value="">Load pattern…</option>
                            {SEQFX_FACTORY_PATTERNS.map((pattern) => (
                                <option key={pattern.id} value={pattern.id}>{pattern.category} · {pattern.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="seqfx-loop__scroll">
                    <div
                        aria-label={`Loop range steps ${controls.loopStart + 1} through ${loopEndExclusive}`}
                        className="seqfx-loop__ruler"
                        data-role="seqfx-loop-ruler"
                        onPointerDown={handleLoopPointerDown}
                        onPointerMove={handleLoopPointerMove}
                        onPointerUp={(event) => endLoopPointerInteraction(event.pointerId)}
                        onPointerCancel={(event) => endLoopPointerInteraction(event.pointerId)}
                        ref={loopRulerRef}
                        role="group"
                    >
                        {Array.from({ length: 32 }, (_unused, step) => {
                            const inLoop = step >= controls.loopStart && step < loopEndExclusive;
                            return (
                                <button
                                    aria-current={playheadStep === step ? "step" : undefined}
                                    aria-label={`Loop step ${step + 1}, ${inLoop ? "inside" : "outside"} range`}
                                    className={[
                                        inLoop ? "is-in-loop" : "",
                                        step === controls.loopStart ? "is-start" : "",
                                        step === loopEndExclusive - 1 ? "is-end" : "",
                                        playheadStep === step ? "is-playhead" : "",
                                    ].filter(Boolean).join(" ")}
                                    data-in-loop={inLoop}
                                    data-loop-step={step}
                                    data-role="seqfx-loop-step"
                                    key={step}
                                    onClick={(event) => {
                                        if (event.detail !== 0) {
                                            return;
                                        }
                                        beginLoopGesture();
                                        changeLoopEdge(nearestLoopEdge(step, controls.loopStart, loopEndExclusive), step);
                                        endLoopGesture();
                                    }}
                                    type="button"
                                >
                                    {step + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
