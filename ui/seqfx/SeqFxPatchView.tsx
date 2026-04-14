import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    SEQFX_LANES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    getSeqFxBlockAtStep,
    getSeqFxLaneBlocks,
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
    hint?: string;
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
        { index: 0, label: "Slices", min: 2, max: 32, step: 1, hint: "Record slice 1; repeat the rest." },
        { index: 1, label: "Speed", min: 0.5, max: 2, step: 0.01, hint: "1.00 keeps the captured pitch." },
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
    const [resizeState, setResizeState] = useState<{ lane: number; startStep: number } | null>(null);
    const laneTrackRefs = useRef(new Map<number, HTMLDivElement>());
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);

    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;

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
        if (!resizeState) {
            return undefined;
        }

        const resizeFromPointer = (event: globalThis.PointerEvent) => {
            const track = laneTrackRefs.current.get(resizeState.lane);
            if (!track) {
                return;
            }

            const bounds = track.getBoundingClientRect();
            const cellWidth = bounds.width / SEQFX_STEP_COUNT;
            const rawStep = Math.floor((event.clientX - bounds.left) / Math.max(1, cellWidth));
            const endStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(resizeState.startStep, rawStep));
            const length = endStep - resizeState.startStep + 1;

            try {
                bridge.resizeBlock({
                    patternIndex: selectedPatternRef.current,
                    lane: resizeState.lane,
                    startStep: resizeState.startStep,
                    length,
                });
                setSelectedCell({ lane: resizeState.lane, step: resizeState.startStep });
                setSelection({
                    lane: resizeState.lane,
                    steps: Array.from({ length }, (_unused, index) => resizeState.startStep + index),
                });
            } catch {
                // Overlap attempts are ignored so the gesture stops at the last valid length.
            }
        };
        const stopResizing = () => setResizeState(null);

        window.addEventListener("pointermove", resizeFromPointer);
        window.addEventListener("pointerup", stopResizing);
        window.addEventListener("pointercancel", stopResizing);

        return () => {
            window.removeEventListener("pointermove", resizeFromPointer);
            window.removeEventListener("pointerup", stopResizing);
            window.removeEventListener("pointercancel", stopResizing);
        };
    }, [bridge, resizeState]);

    const selectedPatternState = state.patterns[selectedPattern];
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? selectedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;
    const inspectedBlock = inspectedLane !== null && inspectedStep !== null
        ? getSeqFxBlockAtStep(selectedPatternState, inspectedLane, inspectedStep)
        : null;
    const selectedWholeBlock = Boolean(
        activeSelection
        && inspectedBlock
        && activeSelection.lane === inspectedBlock.lane
        && activeSelection.steps.length === inspectedBlock.length
        && activeSelection.steps[0] === inspectedBlock.startStep,
    );

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setSelectedCell(null);
        setSelection(null);
    }

    function handleCellPointerDown(event: PointerEvent<HTMLButtonElement>, lane: number, step: number) {
        if (event.shiftKey && selectedCell && selectedCell.lane === lane) {
            const nextSelection = mergeRangeSelection(selectedCell, { lane, step });
            setSelection(nextSelection);
            return;
        }

        bridge.createBlock({
            patternIndex: selectedPattern,
            lane,
            startStep: step,
            length: 1,
        });
        setSelectedCell({ lane, step });
        setSelection({ lane, steps: [step] });
    }

    function handleBlockPointerDown(event: PointerEvent<HTMLButtonElement>, lane: number, startStep: number, length: number) {
        event.stopPropagation();
        setSelectedCell({ lane, step: startStep });
        setSelection({
            lane,
            steps: Array.from({ length }, (_unused, index) => startStep + index),
        });
    }

    function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        setResizeState({ lane, startStep });
    }

    function setMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockMix({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                value,
            });
        } else {
            bridge.setStepMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                value,
            });
        }
    }

    function setParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockParam({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                paramIndex,
                value,
            });
        } else {
            bridge.setStepParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                paramIndex,
                value,
            });
        }
    }

    function deleteSelectedBlock() {
        if (!inspectedBlock) {
            return;
        }

        bridge.deleteBlock({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
        });
        setSelectedCell(null);
        setSelection(null);
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
                        <div className="seqfx-step-track">
                            {STEP_NUMBERS.map((step) => (
                                <div
                                    className={playheadStep === step ? "seqfx-step-number is-playhead" : "seqfx-step-number"}
                                    key={step}
                                    style={{ gridColumn: step + 1 }}
                                >
                                    {step + 1}
                                </div>
                            ))}
                        </div>
                    </div>
                    {SEQFX_LANE_NAMES.map((laneName, lane) => {
                        const laneBlocks = getSeqFxLaneBlocks(selectedPatternState, lane);

                        return (
                            <div className="seqfx-lane-row" key={laneName}>
                                <div className="seqfx-lane-label">{laneName}</div>
                                <div
                                    className="seqfx-lane-track"
                                    ref={(node) => {
                                        if (node) {
                                            laneTrackRefs.current.set(lane, node);
                                        } else {
                                            laneTrackRefs.current.delete(lane);
                                        }
                                    }}
                                >
                                    {STEP_NUMBERS.map((step) => {
                                        const cell = selectedPatternState.lanes[lane].steps[step];
                                        const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                        const className = [
                                            "seqfx-cell",
                                            cell.active ? "is-covered" : "",
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
                                                style={{ gridColumn: step + 1, gridRow: 1 }}
                                                type="button"
                                            >
                                                <span />
                                            </button>
                                        );
                                    })}
                                    {laneBlocks.map((block) => {
                                        const selected = activeSelection?.lane === lane
                                            && activeSelection.steps[0] === block.startStep
                                            && activeSelection.steps.length === block.length;
                                        const className = [
                                            "seqfx-block",
                                            selected ? "is-selected" : "",
                                            playheadStep !== null && playheadStep >= block.startStep && playheadStep <= block.endStep ? "is-playhead" : "",
                                        ].filter(Boolean).join(" ");
                                        const ariaLabel = block.length === 1
                                            ? `${laneName} block ${block.startStep + 1}`
                                            : `${laneName} block ${block.startStep + 1}-${block.endStep + 1}`;

                                        return (
                                            <button
                                                aria-label={ariaLabel}
                                                className={className}
                                                data-role="seqfx-block"
                                                data-lane={lane}
                                                data-start={block.startStep}
                                                key={`${lane}:${block.startStep}`}
                                                onPointerDown={(event) => handleBlockPointerDown(event, lane, block.startStep, block.length)}
                                                style={{ gridColumn: `${block.startStep + 1} / span ${block.length}`, gridRow: 1 }}
                                                type="button"
                                            >
                                                <span className="seqfx-block-fill" />
                                                <span
                                                    aria-hidden="true"
                                                    className="seqfx-block-resize"
                                                    data-role="seqfx-block-resize"
                                                    data-lane={lane}
                                                    data-start={block.startStep}
                                                    onPointerDown={(event) => handleResizePointerDown(event, lane, block.startStep)}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
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
                                const disabled = triggerLatched && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1;
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
                                            {disabled
                                                ? "Select one cell to edit this trigger."
                                                : definition.hint ?? `${definition.min} to ${definition.max}`}
                                        </small>
                                    </label>
                                );
                            })}
                            {selectedWholeBlock && inspectedBlock ? (
                                <button
                                    className="seqfx-delete-block"
                                    data-role="seqfx-delete-block"
                                    onClick={deleteSelectedBlock}
                                    type="button"
                                >
                                    Delete Block
                                </button>
                            ) : null}
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
