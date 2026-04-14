import { useEffect, useMemo, useState, type PointerEvent } from "react";

import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    SEQFX_LANES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    isSeqFxTriggerLatchedParam,
    type SeqFxState,
} from "./seqfx-state";
import { SEQFX_ENDPOINTS, SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

type SelectedCell = {
    lane: number;
    step: number;
};

type Selection = {
    lane: number;
    steps: number[];
};

type ParamDefinition = {
    index: number;
    label: string;
    min: number;
    max: number;
    step: number;
    kind?: "select";
    options?: string[];
};

const PARAM_DEFINITIONS: Record<number, ParamDefinition[]> = {
    [SEQFX_LANES.filter]: [
        { index: 0, label: "Mode", min: 0, max: 2, step: 1, kind: "select", options: ["Lowpass", "Highpass", "Bandpass"] },
        { index: 1, label: "Start cutoff", min: 20, max: 20000, step: 1 },
        { index: 2, label: "End cutoff", min: 20, max: 20000, step: 1 },
        { index: 3, label: "Resonance", min: 0.1, max: 20, step: 0.01 },
        { index: 4, label: "Curve", min: 0.25, max: 4, step: 0.01 },
    ],
    [SEQFX_LANES.crusher]: [
        { index: 0, label: "Bits", min: 4, max: 16, step: 1 },
        { index: 1, label: "Hold frames", min: 1, max: 64, step: 1 },
        { index: 2, label: "Drive", min: 0, max: 36, step: 0.1 },
    ],
    [SEQFX_LANES.tapeStop]: [
        { index: 0, label: "Duration", min: 0.05, max: 4, step: 0.01 },
        { index: 1, label: "Curve", min: 0.25, max: 4, step: 0.01 },
        { index: 2, label: "End", min: 0, max: 1, step: 1, kind: "select", options: ["Fade", "Hold"] },
        { index: 3, label: "Release", min: 1, max: 250, step: 1 },
    ],
    [SEQFX_LANES.stutter]: [
        { index: 0, label: "Slice", min: 0, max: 5, step: 1, kind: "select", options: ["1/64", "1/32", "1/16", "1/8", "1/4", "Block"] },
        { index: 1, label: "Speed", min: 0.5, max: 2, step: 0.01 },
        { index: 2, label: "Retrigger", min: 0, max: 1, step: 1, kind: "select", options: ["Block", "Every cell"] },
    ],
};

function buildStepNumbers() {
    return Array.from({ length: SEQFX_STEP_COUNT }, (_unused, index) => index);
}

const STEP_NUMBERS = buildStepNumbers();

function formatValue(value: number) {
    if (Math.abs(value) >= 100) {
        return String(Math.round(value));
    }

    return Number(value.toFixed(3)).toString();
}

function selectionFromCell(cell: SelectedCell | null): Selection | null {
    return cell ? { lane: cell.lane, steps: [cell.step] } : null;
}

function mergeRangeSelection(anchor: SelectedCell, target: SelectedCell): Selection {
    const start = Math.min(anchor.step, target.step);
    const end = Math.max(anchor.step, target.step);

    return {
        lane: anchor.lane,
        steps: Array.from({ length: end - start + 1 }, (_unused, index) => start + index),
    };
}

function getSelectionLabel(selection: Selection | null) {
    if (!selection) {
        return "Select a cell";
    }

    if (selection.steps.length === 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} step ${selection.steps[0] + 1}`;
    }

    return `${SEQFX_LANE_NAMES[selection.lane]} steps ${selection.steps[0] + 1}-${selection.steps.at(-1)! + 1}`;
}

export function SeqFxPatchView({ patchConnection }: { patchConnection: PatchConnectionLike }) {
    const bridge = useMemo(() => new SeqFxRuntimeBridge(patchConnection), [patchConnection]);
    const [state, setState] = useState<SeqFxState>(() => bridge.getState());
    const [selectedPattern, setSelectedPattern] = useState(() => bridge.getSelectedPatternIndex());
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [paintState, setPaintState] = useState<{ lane: number; active: boolean } | null>(null);

    useEffect(() => {
        bridge.attach();
        const unsubscribeState = bridge.subscribe((nextState) => {
            setState(nextState);
            setSelectedPattern(bridge.getSelectedPatternIndex());
        });
        const unsubscribeMonitor = bridge.subscribeMonitor((monitor) => {
            const stepIndex = Number((monitor as { stepIndex?: unknown })?.stepIndex);
            setPlayheadStep(Number.isFinite(stepIndex) ? stepIndex : null);
        });
        bridge.requestBootState();

        return () => {
            unsubscribeState();
            unsubscribeMonitor();
            bridge.detach();
        };
    }, [bridge]);

    useEffect(() => {
        if (!paintState) {
            return undefined;
        }

        const stopPainting = () => setPaintState(null);
        window.addEventListener("pointerup", stopPainting);
        window.addEventListener("pointercancel", stopPainting);

        return () => {
            window.removeEventListener("pointerup", stopPainting);
            window.removeEventListener("pointercancel", stopPainting);
        };
    }, [paintState]);

    const selectedPatternState = state.patterns[selectedPattern];
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? selectedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setSelectedCell(null);
        setSelection(null);
    }

    function toggleCell(lane: number, step: number, active: boolean | undefined = undefined) {
        bridge.toggleCell({
            patternIndex: selectedPattern,
            lane,
            step,
            active,
        });
    }

    function handleCellPointerDown(event: PointerEvent<HTMLButtonElement>, lane: number, step: number) {
        const stepState = selectedPatternState.lanes[lane].steps[step];
        const nextActive = !stepState.active;

        if (event.shiftKey && selectedCell && selectedCell.lane === lane) {
            const nextSelection = mergeRangeSelection(selectedCell, { lane, step });
            setSelection(nextSelection);
            return;
        }

        setSelectedCell({ lane, step });
        setSelection(null);
        setPaintState({ lane, active: nextActive });
        toggleCell(lane, step, nextActive);
    }

    function handleCellPointerEnter(lane: number, step: number) {
        if (!paintState || paintState.lane !== lane) {
            return;
        }

        toggleCell(lane, step, paintState.active);
    }

    function setMix(value: number) {
        if (!activeSelection) {
            return;
        }

        bridge.setStepMix({
            patternIndex: selectedPattern,
            lane: activeSelection.lane,
            steps: activeSelection.steps,
            value,
        });
    }

    function setParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        bridge.setStepParam({
            patternIndex: selectedPattern,
            lane: activeSelection.lane,
            steps: activeSelection.steps,
            paramIndex,
            value,
        });
    }

    return (
        <main className="seqfx-root" data-role="seqfx-root">
            <section className="seqfx-topbar" aria-label="SeqFX transport and pattern controls">
                <div className="seqfx-title">
                    <span className="seqfx-kicker">Cosimo</span>
                    <h1>SeqFX</h1>
                </div>
                <div className="seqfx-patterns" role="group" aria-label="Patterns">
                    {Array.from({ length: SEQFX_PATTERN_COUNT }, (_unused, index) => (
                        <button
                            className={index === selectedPattern ? "seqfx-pattern is-selected" : "seqfx-pattern"}
                            key={index}
                            type="button"
                            aria-pressed={index === selectedPattern}
                            onClick={() => selectPattern(index)}
                            data-role="seqfx-pattern"
                            data-pattern={index}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
                <div className="seqfx-transport" role="group" aria-label="Internal clock">
                    <button type="button" onClick={() => bridge.playInternal()}>Play</button>
                    <button type="button" onClick={() => bridge.stopInternal()}>Stop</button>
                    <button type="button" onClick={() => bridge.resetInternal()}>Reset</button>
                </div>
            </section>

            <section className="seqfx-workspace">
                <div className="seqfx-grid-shell" aria-label="Effect sequence grid">
                    <div className="seqfx-step-header">
                        <div className="seqfx-lane-spacer" />
                        {STEP_NUMBERS.map((step) => (
                            <div
                                className={playheadStep === step ? "seqfx-step-number is-playhead" : "seqfx-step-number"}
                                key={step}
                            >
                                {step + 1}
                            </div>
                        ))}
                    </div>
                    {SEQFX_LANE_NAMES.map((laneName, lane) => (
                        <div className="seqfx-lane-row" key={laneName}>
                            <div className="seqfx-lane-label">{laneName}</div>
                            {STEP_NUMBERS.map((step) => {
                                const cell = selectedPatternState.lanes[lane].steps[step];
                                const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                const className = [
                                    "seqfx-cell",
                                    cell.active ? "is-active" : "",
                                    cell.trigger ? "is-trigger" : "",
                                    selected ? "is-selected" : "",
                                    playheadStep === step ? "is-playhead" : "",
                                ].filter(Boolean).join(" ");

                                return (
                                    <button
                                        aria-label={`${laneName} step ${step + 1}`}
                                        aria-pressed={cell.active}
                                        className={className}
                                        data-role="seqfx-cell"
                                        data-lane={lane}
                                        data-step={step}
                                        key={step}
                                        onPointerDown={(event) => handleCellPointerDown(event, lane, step)}
                                        onPointerEnter={() => handleCellPointerEnter(lane, step)}
                                        type="button"
                                    >
                                        <span />
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <aside className="seqfx-inspector" data-role="seqfx-inspector">
                    <div className="seqfx-inspector-heading">
                        <span>Inspector</span>
                        <strong>{getSelectionLabel(activeSelection)}</strong>
                    </div>
                    {!inspectedCell || inspectedLane === null ? (
                        <p className="seqfx-empty">Choose a lane cell to edit its mix and effect settings.</p>
                    ) : (
                        <>
                            <label className="seqfx-field">
                                <span>Mix</span>
                                <input
                                    data-role="seqfx-mix"
                                    max={1}
                                    min={0}
                                    onChange={(event) => setMix(Number(event.currentTarget.value))}
                                    step={0.01}
                                    type="range"
                                    value={inspectedCell.mix}
                                />
                                <output>{formatValue(inspectedCell.mix)}</output>
                            </label>
                            {PARAM_DEFINITIONS[inspectedLane].map((definition) => {
                                const triggerLatched = isSeqFxTriggerLatchedParam(inspectedLane, definition.index);
                                const disabled = triggerLatched && (activeSelection?.steps.length ?? 0) > 1;
                                const value = inspectedCell.params[definition.index];

                                return (
                                    <label className="seqfx-field" key={definition.index}>
                                        <span>
                                            {definition.label}
                                            {triggerLatched ? <em>Trigger</em> : null}
                                        </span>
                                        {definition.kind === "select" ? (
                                            <select
                                                data-role="seqfx-param"
                                                data-param={definition.index}
                                                disabled={disabled}
                                                onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                value={Math.round(value)}
                                            >
                                                {definition.options!.map((option, index) => (
                                                    <option key={option} value={index}>{option}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                data-role="seqfx-param"
                                                data-param={definition.index}
                                                disabled={disabled}
                                                max={definition.max}
                                                min={definition.min}
                                                onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                step={definition.step}
                                                type="number"
                                                value={formatValue(value)}
                                            />
                                        )}
                                        <small>
                                            {disabled ? "Select one cell to edit this trigger." : `${definition.min} to ${definition.max}`}
                                        </small>
                                    </label>
                                );
                            })}
                        </>
                    )}
                    <div className="seqfx-chain" aria-label="Fixed signal path">
                        <span>Filter</span>
                        <span>Crusher</span>
                        <span>Tape</span>
                        <span>Stutter</span>
                        <span>Mix</span>
                    </div>
                </aside>
            </section>

            <pre className="seqfx-debug" data-role="seqfx-debug">
                {JSON.stringify({
                    selectedPattern,
                    selectedCell,
                    selection,
                    lastUploadEndpoint: SEQFX_ENDPOINTS.patternUpload,
                })}
            </pre>
        </main>
    );
}
