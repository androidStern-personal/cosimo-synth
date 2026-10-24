import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { ParameterKnobArtwork } from "../../../ui/shared/parameter-knob-artwork";
import type { SeqFxGlobalControlKey, SeqFxGlobalControls } from "./seqfx-session";

type GlobalControlKey = Exclude<SeqFxGlobalControlKey, "enabled" | "loopStart" | "loopLength">;

const CLOCK_OPTIONS = ["Host", "Internal", "Manual"] as const;
const RATE_OPTIONS = ["1/8", "1/16", "1/32"] as const;
function clampInteger(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Math.round(value)));
}

function CompactIntegerInput({
    dataRole,
    label,
    max,
    min,
    onBlur,
    onCommit,
    onFocus,
    value,
}: {
    dataRole: string;
    label: string;
    max: number;
    min: number;
    onBlur: () => void;
    onCommit: (value: number) => void;
    onFocus: () => void;
    value: number;
}) {
    const [draft, setDraft] = useState<string | null>(null);

    function commitKeyboardEdit(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
        }
    }

    return (
        <label className="seqfx-loop__bound">
            <span>{label}</span>
            <input
                data-role={dataRole}
                inputMode="numeric"
                max={max}
                min={min}
                onBlur={() => {
                    if (draft !== null && draft !== "") {
                        const parsed = Number(draft);
                        if (Number.isFinite(parsed)) {
                            onCommit(clampInteger(parsed, min, max));
                        }
                    }
                    setDraft(null);
                    onBlur();
                }}
                onChange={(event) => {
                    setDraft(event.currentTarget.value);
                }}
                onFocus={() => {
                    setDraft(String(value));
                    onFocus();
                }}
                onKeyDown={commitKeyboardEdit}
                step={1}
                type="number"
                value={draft ?? String(value)}
            />
        </label>
    );
}

function CompactBpmInput({
    disabled,
    onBlur,
    onCommit,
    onFocus,
    value,
}: {
    disabled: boolean;
    onBlur: () => void;
    onCommit: (value: number) => void;
    onFocus: () => void;
    value: number;
}) {
    const [draft, setDraft] = useState<string | null>(null);

    return (
        <label
            className="seqfx-global__number"
            data-role="seqfx-manual-bpm-control"
            title={disabled ? "The host supplies tempo in Host mode." : "Manual tempo"}
        >
            <span>BPM</span>
            <input
                aria-label="BPM"
                data-role="seqfx-manual-bpm"
                disabled={disabled}
                inputMode="decimal"
                max={300}
                min={20}
                onBlur={() => {
                    if (draft !== null && draft !== "") {
                        const parsed = Number(draft);
                        if (Number.isFinite(parsed)) {
                            onCommit(Math.min(300, Math.max(20, Math.round(parsed * 10) / 10)));
                        }
                    }
                    setDraft(null);
                    onBlur();
                }}
                onChange={(event) => {
                    setDraft(event.currentTarget.value);
                }}
                onFocus={() => {
                    setDraft(String(value));
                    onFocus();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                }}
                step={0.1}
                type="number"
                value={draft ?? String(value)}
            />
        </label>
    );
}

function CompactKnob({
    dataControl,
    dataRole,
    label,
    max,
    min,
    onBlur,
    onChange,
    onLostPointerCapture,
    onPointerCancel,
    onPointerDown,
    onPointerUp,
    outputDataRole,
    step,
    value,
}: {
    dataControl: string;
    dataRole: string;
    label: string;
    max: number;
    min: number;
    onBlur: () => void;
    onChange: (value: number) => void;
    onLostPointerCapture: (event: PointerEvent<HTMLInputElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLInputElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLInputElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLInputElement>) => void;
    outputDataRole: string;
    step: number;
    value: number;
}) {
    const normalized = (value - min) / (max - min);

    return (
        <label className="seqfx-global__knob-field" data-control={dataControl}>
            <span>{label}</span>
            <span className="seqfx-global__knob">
                <ParameterKnobArtwork
                    baseNormalized={normalized}
                    baseOriginNormalized={0}
                    className="seqfx-global__knob-art"
                    emphasis="none"
                    modRing={{ kind: "hidden" }}
                    ownerAccent="#6f9c7d"
                    sourceAccent="#6f9c7d"
                />
                <input
                    aria-label={label}
                    data-role={dataRole}
                    max={max}
                    min={min}
                    onBlur={onBlur}
                    onChange={(event) => onChange(Number(event.currentTarget.value))}
                    onLostPointerCapture={onLostPointerCapture}
                    onPointerCancel={onPointerCancel}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    step={step}
                    type="range"
                    value={value}
                />
            </span>
            <output data-role={outputDataRole}>{Math.round(value * 100)}%</output>
        </label>
    );
}

export function SeqFxGlobalControlSurface({
    controls,
    internalRunning,
    canUndo,
    canRedo,
    onGlobalControl,
    onGlobalGestureStart,
    onGlobalGestureEnd,
    onLoopRangeGestureStart,
    onLoopRangeGestureEnd,
    onLoopRangeChange,
    onInternalTransport,
    onReset,
    onUndo,
    onRedo,
}: {
    controls: SeqFxGlobalControls;
    internalRunning: boolean;
    canUndo: boolean;
    canRedo: boolean;
    /** Inside an open gesture the value joins it; otherwise it is one Undo entry. */
    onGlobalControl: (key: GlobalControlKey, value: number) => void;
    onGlobalGestureStart: (key: GlobalControlKey) => void;
    onGlobalGestureEnd: (key: GlobalControlKey) => void;
    onLoopRangeGestureStart: () => void;
    onLoopRangeGestureEnd: () => void;
    onLoopRangeChange: (startStep: number, endStepExclusive: number) => void;
    onInternalTransport: (running: boolean) => void;
    onReset: () => void;
    onUndo: () => void;
    onRedo: () => void;
}) {
    const loopEndExclusive = Math.min(32, controls.loopStart + controls.loopLength);
    const loopGestureActiveRef = useRef(false);
    const activeGestureKeysRef = useRef(new Set<GlobalControlKey>());
    const pointerGestureOwnersRef = useRef(new Map<GlobalControlKey, number>());
    const globalGestureStartRef = useRef(onGlobalGestureStart);
    const globalGestureEndRef = useRef(onGlobalGestureEnd);
    const loopRangeGestureStartRef = useRef(onLoopRangeGestureStart);
    const loopRangeGestureEndRef = useRef(onLoopRangeGestureEnd);
    globalGestureStartRef.current = onGlobalGestureStart;
    globalGestureEndRef.current = onGlobalGestureEnd;
    loopRangeGestureStartRef.current = onLoopRangeGestureStart;
    loopRangeGestureEndRef.current = onLoopRangeGestureEnd;

    function beginLoopGesture() {
        if (loopGestureActiveRef.current) {
            return;
        }

        loopGestureActiveRef.current = true;
        loopRangeGestureStartRef.current();
    }

    function endLoopGesture() {
        if (!loopGestureActiveRef.current) {
            return;
        }

        loopGestureActiveRef.current = false;
        loopRangeGestureEndRef.current();
    }

    useEffect(() => {
        const endPointerInteraction = (event: globalThis.PointerEvent) => {
            for (const [key, pointerId] of [...pointerGestureOwnersRef.current]) {
                if (pointerId === event.pointerId) {
                    endPointerGesture(key, pointerId);
                }
            }
        };
        const endAllInteractions = () => {
            endLoopGesture();
            for (const key of [...activeGestureKeysRef.current]) {
                endGesture(key);
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

    function beginGesture(key: GlobalControlKey) {
        if (activeGestureKeysRef.current.has(key)) {
            return;
        }
        activeGestureKeysRef.current.add(key);
        globalGestureStartRef.current(key);
    }

    function endGesture(key: GlobalControlKey) {
        if (!activeGestureKeysRef.current.delete(key)) {
            return;
        }
        globalGestureEndRef.current(key);
    }

    function beginPointerGesture(key: GlobalControlKey, event: PointerEvent<HTMLInputElement>) {
        if (pointerGestureOwnersRef.current.has(key)) {
            return;
        }

        pointerGestureOwnersRef.current.set(key, event.pointerId);
        beginGesture(key);
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointers still close through the window-level owner listener.
        }
    }

    function endPointerGesture(key: GlobalControlKey, pointerId?: number) {
        const ownerPointerId = pointerGestureOwnersRef.current.get(key);
        if (ownerPointerId === undefined || (pointerId !== undefined && ownerPointerId !== pointerId)) {
            return;
        }

        pointerGestureOwnersRef.current.delete(key);
        endGesture(key);
    }

    const clockOwnsTransport = controls.clockMode === 1;
    const manualTempoAvailable = controls.clockMode !== 0;

    return (
        <section className="seqfx-global" data-role="seqfx-global-controls" aria-label="SeqFX global controls">
            <div className="seqfx-global__controls">
                <CompactIntegerInput
                    dataRole="seqfx-loop-start"
                    label="Start"
                    max={32}
                    min={1}
                    onBlur={endLoopGesture}
                    onCommit={(value) => onLoopRangeChange(Math.min(value, loopEndExclusive) - 1, loopEndExclusive)}
                    onFocus={beginLoopGesture}
                    value={controls.loopStart + 1}
                />
                <CompactIntegerInput
                    dataRole="seqfx-loop-stop"
                    label="Stop"
                    max={32}
                    min={1}
                    onBlur={endLoopGesture}
                    onCommit={(value) => onLoopRangeChange(controls.loopStart, Math.max(value, controls.loopStart + 1))}
                    onFocus={beginLoopGesture}
                    value={loopEndExclusive}
                />

                <CompactKnob
                    dataControl="seqfx-global-mix-knob"
                    dataRole="seqfx-global-mix"
                    label="Mix"
                    max={1}
                    min={0}
                    onBlur={() => endPointerGesture("mix")}
                    onChange={(value) => onGlobalControl("mix", value)}
                    onLostPointerCapture={(event) => endPointerGesture("mix", event.pointerId)}
                    onPointerCancel={(event) => endPointerGesture("mix", event.pointerId)}
                    onPointerDown={(event) => beginPointerGesture("mix", event)}
                    onPointerUp={(event) => endPointerGesture("mix", event.pointerId)}
                    outputDataRole="seqfx-global-mix-value"
                    step={0.01}
                    value={controls.globalMix}
                />

                <label className="seqfx-global__field">
                    <span>Clock</span>
                    <select
                        aria-label="Clock source"
                        data-role="seqfx-clock-mode"
                        onChange={(event) => onGlobalControl("clock", Number(event.currentTarget.value))}
                        value={controls.clockMode}
                    >
                        {CLOCK_OPTIONS.map((option, index) => <option key={option} value={index}>{option}</option>)}
                    </select>
                </label>

                <CompactBpmInput
                    disabled={!manualTempoAvailable}
                    onBlur={() => endGesture("manualBpm")}
                    onCommit={(value) => onGlobalControl("manualBpm", value)}
                    onFocus={() => beginGesture("manualBpm")}
                    value={controls.manualBpm}
                />

                <label className="seqfx-global__field">
                    <span>Rate</span>
                    <select
                        aria-label="Sequence rate"
                        data-role="seqfx-rate"
                        onChange={(event) => onGlobalControl("rate", Number(event.currentTarget.value))}
                        value={controls.rateIndex}
                    >
                        {RATE_OPTIONS.map((option, index) => <option key={option} value={index}>{option}</option>)}
                    </select>
                </label>

                <CompactKnob
                    dataControl="seqfx-swing-knob"
                    dataRole="seqfx-swing"
                    label="Swing"
                    max={0.45}
                    min={0}
                    onBlur={() => endPointerGesture("swing")}
                    onChange={(value) => onGlobalControl("swing", value)}
                    onLostPointerCapture={(event) => endPointerGesture("swing", event.pointerId)}
                    onPointerCancel={(event) => endPointerGesture("swing", event.pointerId)}
                    onPointerDown={(event) => beginPointerGesture("swing", event)}
                    onPointerUp={(event) => endPointerGesture("swing", event.pointerId)}
                    outputDataRole="seqfx-swing-value"
                    step={0.01}
                    value={controls.swing}
                />

                <div
                    className="seqfx-global__actions"
                    data-role="seqfx-transport-history-actions"
                    role="group"
                    aria-label="Transport and edit actions"
                >
                    <button
                        aria-label={internalRunning ? "Stop internal clock" : "Play internal clock"}
                        className={internalRunning && clockOwnsTransport ? "is-active" : undefined}
                        data-role="seqfx-internal-transport"
                        disabled={!clockOwnsTransport}
                        onClick={() => onInternalTransport(!internalRunning)}
                        title={clockOwnsTransport ? "Start or stop the internal clock." : "Choose Internal clock to control transport here."}
                        type="button"
                    >
                        <span aria-hidden="true">{internalRunning && clockOwnsTransport ? "■" : "▶"}</span>
                    </button>
                    <button aria-label="Reset internal clock" data-role="seqfx-reset" onClick={onReset} title="Reset internal clock." type="button"><span aria-hidden="true">↺</span></button>
                    <button aria-label="Undo edit" data-role="seqfx-undo" disabled={!canUndo} onClick={onUndo} title="Undo the last edit." type="button"><span aria-hidden="true">↶</span></button>
                    <button aria-label="Redo edit" data-role="seqfx-redo" disabled={!canRedo} onClick={onRedo} title="Redo the last undone edit." type="button"><span aria-hidden="true">↷</span></button>
                </div>
            </div>
        </section>
    );
}
