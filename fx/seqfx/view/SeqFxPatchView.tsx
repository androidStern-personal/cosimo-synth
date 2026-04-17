import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { createPresetBar } from "../../../ui/shared/effects/preset-bar";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets";
import {
    SEQFX_LANES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    getSeqFxBlockAtStep,
    getSeqFxLaneBlocks,
    isSeqFxTriggerLatchedParam,
    type SeqFxPattern,
    type SeqFxState,
} from "./seqfx-state";
import { createSeqFxPresetStateAdapter } from "./seqfx-preset-adapter";
import { SEQFX_ENDPOINTS, SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

type SelectedCell = {
    lane: number;
    step: number;
};

type Selection = {
    lane: number;
    steps: number[];
    blockStartSteps?: number[];
};

type ResizeGesture = {
    mode: "resize";
    lane: number;
    startStep: number;
};

type MoveGesture = {
    mode: "move";
    lane: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    lastStartStep: number;
};

type BlockSelectionMoveGesture = {
    mode: "selectionMove";
    lane: number;
    blockStartSteps: number[];
    anchorStartStep: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
};

type CopyGesture = {
    mode: "copy";
    lane: number;
    sourceStartStep: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    previewTargetStartStep: number | null;
};

type BlockGesture = ResizeGesture | MoveGesture | BlockSelectionMoveGesture | CopyGesture;

type CopyPreview = {
    patternIndex: number;
    lane: number;
    sourceStartStep: number;
    targetStartStep: number;
    copiedStartSteps: number[];
    state: SeqFxState;
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
const SEQFX_NORMAL_GAP_PX = 5;
const SEQFX_BEAT_GAP_PX = 9;
const SEQFX_MIN_CELL_SIZE_PX = 22;
const SEQFX_RATE_CELLS_PER_BEAT = [2, 4, 8] as const;
const SEQFX_BEATS_PER_BAR = 4;

function cellsPerBeatForRateIndex(rateIndex: number) {
    return SEQFX_RATE_CELLS_PER_BEAT[Math.min(2, Math.max(0, Math.round(rateIndex)))] ?? 4;
}

function gapAfterStep(step: number, cellsPerBeat: number, stepCount = SEQFX_STEP_COUNT) {
    if (step >= stepCount - 1) {
        return 0;
    }

    return (step + 1) % cellsPerBeat === 0 ? SEQFX_BEAT_GAP_PX : SEQFX_NORMAL_GAP_PX;
}

function totalGapWidthFor(cellsPerBeat: number, stepCount = SEQFX_STEP_COUNT) {
    let total = 0;
    for (let step = 0; step < stepCount - 1; step += 1) {
        total += gapAfterStep(step, cellsPerBeat, stepCount);
    }
    return total;
}

function cellSizeFromTrackWidth(width: number, cellsPerBeat: number) {
    if (!Number.isFinite(width) || width <= 0) {
        return SEQFX_MIN_CELL_SIZE_PX;
    }

    const availableCellWidth = width - totalGapWidthFor(cellsPerBeat);
    const cellSize = availableCellWidth / SEQFX_STEP_COUNT;

    return Math.max(SEQFX_MIN_CELL_SIZE_PX, Number(cellSize.toFixed(4)));
}

function createGridGeometry(cellSize: number, cellsPerBeat: number) {
    const cellsPerBar = cellsPerBeat * SEQFX_BEATS_PER_BAR;
    const stepLefts: number[] = [];
    let cursor = 0;

    for (let step = 0; step < SEQFX_STEP_COUNT; step += 1) {
        stepLefts.push(Number(cursor.toFixed(4)));
        cursor += cellSize + gapAfterStep(step, cellsPerBeat);
    }

    const trackWidth = (cellSize * SEQFX_STEP_COUNT) + totalGapWidthFor(cellsPerBeat);

    const leftForStep = (step: number) => stepLefts[Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step))] ?? 0;

    const stepAtClientX = (bounds: DOMRect, clientX: number) => {
        const localX = clientX - bounds.left;
        if (localX <= 0) {
            return 0;
        }

        for (let step = 0; step < SEQFX_STEP_COUNT; step += 1) {
            const left = leftForStep(step);
            const right = left + cellSize;

            if (localX >= left && localX <= right) {
                return step;
            }

            if (step < SEQFX_STEP_COUNT - 1) {
                const nextLeft = leftForStep(step + 1);
                if (localX > right && localX < nextLeft) {
                    const midpoint = right + ((nextLeft - right) / 2);
                    return localX < midpoint ? step : step + 1;
                }
            }
        }

        return SEQFX_STEP_COUNT - 1;
    };

    const cellStyle = (step: number): CSSProperties => ({
        left: `${leftForStep(step)}px`,
        width: `${cellSize}px`,
        height: `${cellSize}px`,
    });

    const blockStyle = (startStep: number, length: number): CSSProperties => {
        const lastStep = Math.min(SEQFX_STEP_COUNT - 1, startStep + length - 1);
        const left = leftForStep(startStep);
        const right = leftForStep(lastStep) + cellSize;

        return {
            left: `${left}px`,
            width: `${right - left}px`,
            height: `${cellSize}px`,
        };
    };

    const stepNumberStyle = (step: number): CSSProperties => ({
        left: `${leftForStep(step)}px`,
        width: `${cellSize}px`,
    });

    return {
        cellSize,
        cellsPerBar,
        trackWidth: Number(trackWidth.toFixed(4)),
        stepLefts,
        leftForStep,
        stepAtClientX,
        cellStyle,
        blockStyle,
        stepNumberStyle,
        isAltBar: (step: number) => Math.floor(step / cellsPerBar) % 2 === 1,
    };
}

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

function selectionFromBlockStarts(pattern: SeqFxPattern, lane: number, blockStartSteps: number[]): Selection | null {
    const starts = [...new Set(blockStartSteps)].sort((left, right) => left - right);
    const steps = new Set<number>();
    const resolvedStarts: number[] = [];

    for (const startStep of starts) {
        const block = getSeqFxBlockAtStep(pattern, lane, startStep);
        if (!block || block.startStep !== startStep) {
            continue;
        }

        resolvedStarts.push(block.startStep);
        for (let step = block.startStep; step <= block.endStep; step += 1) {
            steps.add(step);
        }
    }

    if (resolvedStarts.length === 0) {
        return null;
    }

    return {
        lane,
        steps: [...steps].sort((left, right) => left - right),
        blockStartSteps: resolvedStarts,
    };
}

function blockStartsBetween(pattern: SeqFxPattern, lane: number, startStep: number, endStep: number): number[] {
    const rangeStart = Math.min(startStep, endStep);
    const rangeEnd = Math.max(startStep, endStep);

    return getSeqFxLaneBlocks(pattern, lane)
        .filter((block) => block.startStep >= rangeStart && block.startStep <= rangeEnd)
        .map((block) => block.startStep);
}

function getSelectionLabel(selection: Selection | null) {
    if (!selection) {
        return "Select a cell";
    }

    const blockStartSteps = selection.blockStartSteps ?? [];
    if (blockStartSteps.length > 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} blocks ${blockStartSteps.map((step) => step + 1).join(", ")}`;
    }

    if (selection.steps.length === 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} step ${selection.steps[0] + 1}`;
    }

    return `${SEQFX_LANE_NAMES[selection.lane]} steps ${selection.steps[0] + 1}-${selection.steps.at(-1)! + 1}`;
}

function clampBlockStart(startStep: number, length: number) {
    return Math.min(SEQFX_STEP_COUNT - length, Math.max(0, startStep));
}

function SeqFxPresetBarHost({
    bridge,
    patchConnection,
}: {
    bridge: SeqFxRuntimeBridge;
    patchConnection: PatchConnectionLike;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const storedStateAdapter = useMemo(() => createSeqFxPresetStateAdapter({
        bridge,
        patchConnection,
    }), [bridge, patchConnection]);
    const presetController = useMemo(() => createStandaloneEffectPresetController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
    }), [patchConnection, storedStateAdapter]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const presetBar = createPresetBar();
        presetBar.controller = presetController;
        host.replaceChildren(presetBar);
        presetController.attach();

        return () => {
            presetController.detach();
            presetBar.controller = null;
            presetBar.remove();
        };
    }, [presetController]);

    return <div className="seqfx-preset-row" ref={hostRef} />;
}

export function SeqFxPatchView({ patchConnection }: { patchConnection: PatchConnectionLike }) {
    const bridge = useMemo(() => new SeqFxRuntimeBridge(patchConnection), [patchConnection]);
    const [state, setState] = useState<SeqFxState>(() => bridge.getState());
    const [selectedPattern, setSelectedPattern] = useState(() => bridge.getSelectedPatternIndex());
    const [rateIndex, setRateIndex] = useState(() => bridge.getRateIndex());
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [gestureState, setGestureState] = useState<BlockGesture | null>(null);
    const [copyPreview, setCopyPreview] = useState<CopyPreview | null>(null);
    const [cellSize, setCellSize] = useState(SEQFX_MIN_CELL_SIZE_PX);
    const cellsPerBeat = useMemo(() => cellsPerBeatForRateIndex(rateIndex), [rateIndex]);
    const gridGeometry = useMemo(() => createGridGeometry(cellSize, cellsPerBeat), [cellSize, cellsPerBeat]);
    const measureTrackRef = useRef<HTMLDivElement | null>(null);
    const laneTrackRefs = useRef(new Map<number, HTMLDivElement>());
    const gestureRef = useRef<BlockGesture | null>(null);
    const optionKeyRef = useRef(false);
    const gridGeometryRef = useRef(gridGeometry);
    const rateIndexRef = useRef(rateIndex);
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);

    gridGeometryRef.current = gridGeometry;
    rateIndexRef.current = rateIndex;
    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;

    const trackWidth = gridGeometry.trackWidth;
    const stepTrackStyle = useMemo<CSSProperties>(() => ({
        minWidth: `${trackWidth}px`,
        height: "12px",
    }), [trackWidth]);
    const laneTrackStyle = useMemo<CSSProperties>(() => ({
        minWidth: `${trackWidth}px`,
        height: `${cellSize}px`,
    }), [cellSize, trackWidth]);

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
        const unsubscribeRate = bridge.subscribeRate((nextRateIndex) => {
            if (rateIndexRef.current !== nextRateIndex) {
                gestureRef.current = null;
                setGestureState(null);
                setCopyPreview(null);
            }
            rateIndexRef.current = nextRateIndex;
            setRateIndex(nextRateIndex);
        });
        bridge.requestBootState();

        return () => {
            unsubscribeState();
            unsubscribeMonitor();
            unsubscribeRate();
            bridge.detach();
        };
    }, [bridge]);

    useEffect(() => {
        let animationFrame: number | null = null;
        let observer: ResizeObserver | null = null;

        const updateCellSize = () => {
            const track = measureTrackRef.current;
            if (!track) {
                return;
            }

            const nextCellSize = cellSizeFromTrackWidth(track.getBoundingClientRect().width, cellsPerBeat);
            setCellSize((currentCellSize) => (
                Math.abs(currentCellSize - nextCellSize) < 0.01 ? currentCellSize : nextCellSize
            ));
        };

        const scheduleCellSizeUpdate = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame = window.requestAnimationFrame(updateCellSize);
        };

        scheduleCellSizeUpdate();

        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(scheduleCellSizeUpdate);
            if (measureTrackRef.current) {
                observer.observe(measureTrackRef.current);
            }
        }

        window.addEventListener("resize", scheduleCellSizeUpdate);

        return () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }
            observer?.disconnect();
            window.removeEventListener("resize", scheduleCellSizeUpdate);
        };
    }, [cellsPerBeat]);

    useEffect(() => {
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = true;
            }
        };
        const handleKeyUp = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = false;
            }
        };
        const clearOptionKey = () => {
            optionKeyRef.current = false;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", clearOptionKey);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", clearOptionKey);
        };
    }, []);

    useEffect(() => {
        const pointerStepForLane = (lane: number, event: globalThis.PointerEvent) => {
            const track = laneTrackRefs.current.get(lane);
            if (!track) {
                return null;
            }

            const bounds = track.getBoundingClientRect();
            return gridGeometryRef.current.stepAtClientX(bounds, event.clientX);
        };

        const selectBlockRange = (lane: number, startStep: number, length: number) => {
            setSelectedCell({ lane, step: startStep });
            setSelection({
                lane,
                steps: Array.from({ length }, (_unused, index) => startStep + index),
                blockStartSteps: [startStep],
            });
        };

        const targetStartFromPointer = (gesture: MoveGesture | CopyGesture, event: globalThis.PointerEvent) => {
            const pointerStep = pointerStepForLane(gesture.lane, event);
            if (pointerStep === null) {
                return null;
            }

            return clampBlockStart(pointerStep - gesture.grabOffset, gesture.length);
        };

        const targetAnchorStartFromPointer = (gesture: BlockSelectionMoveGesture, event: globalThis.PointerEvent) => {
            const pointerStep = pointerStepForLane(gesture.lane, event);
            if (pointerStep === null) {
                return null;
            }

            return Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, pointerStep - gesture.grabOffset));
        };

        const gestureMovedEnough = (gesture: MoveGesture | CopyGesture | BlockSelectionMoveGesture, event: globalThis.PointerEvent) => {
            const deltaX = event.clientX - gesture.pointerStartX;
            const deltaY = event.clientY - gesture.pointerStartY;
            return (deltaX * deltaX) + (deltaY * deltaY) >= 16;
        };

        const handlePointerMove = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            event.preventDefault();

            if (gesture.mode === "resize") {
                const rawStep = pointerStepForLane(gesture.lane, event);
                if (rawStep === null) {
                    return;
                }

                const endStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(gesture.startStep, rawStep));
                const length = endStep - gesture.startStep + 1;

                try {
                    bridge.resizeBlock({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.startStep,
                        length,
                    });
                    selectBlockRange(gesture.lane, gesture.startStep, length);
                } catch {
                    // Overlap attempts are ignored so the gesture stops at the last valid length.
                }
                return;
            }

            if (!gesture.hasMoved && !gestureMovedEnough(gesture, event)) {
                return;
            }

            gesture.hasMoved = true;

            if (gesture.mode === "selectionMove") {
                const targetAnchorStartStep = targetAnchorStartFromPointer(gesture, event);
                if (targetAnchorStartStep === null || targetAnchorStartStep === gesture.anchorStartStep) {
                    return;
                }

                try {
                    const result = bridge.moveBlockSelection({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetAnchorStartStep,
                    });
                    gesture.blockStartSteps = result.movedStartSteps;
                    gesture.anchorStartStep = targetAnchorStartStep;
                    selectBlockStartsFromPattern(
                        result.state.patterns[selectedPatternRef.current],
                        gesture.lane,
                        result.movedStartSteps,
                        targetAnchorStartStep,
                    );
                } catch {
                    // Invalid group targets, such as collisions, keep the selection at its last valid position.
                }
                return;
            }

            const targetStartStep = targetStartFromPointer(gesture, event);
            if (targetStartStep === null) {
                return;
            }

            if (gesture.mode === "move") {
                if (targetStartStep === gesture.lastStartStep) {
                    return;
                }

                try {
                    bridge.moveBlock({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.lastStartStep,
                        targetStartStep,
                    });
                    gesture.lastStartStep = targetStartStep;
                    selectBlockRange(gesture.lane, targetStartStep, gesture.length);
                } catch {
                    // Invalid targets, such as overlaps, keep the block at its last valid start.
                }
                return;
            }

            try {
                const preview = bridge.previewBlockCopyPaint({
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    startStep: gesture.sourceStartStep,
                    targetStartStep,
                });
                gesture.previewTargetStartStep = targetStartStep;
                setCopyPreview(preview.copiedStartSteps.length > 0 ? {
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    sourceStartStep: gesture.sourceStartStep,
                    targetStartStep,
                    copiedStartSteps: preview.copiedStartSteps,
                    state: preview.state,
                } : null);
            } catch {
                setCopyPreview(null);
            }
        };

        const stopGesture = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.mode === "move" && gesture.hasMoved) {
                selectBlockRange(gesture.lane, gesture.lastStartStep, gesture.length);
            } else if (gesture.mode === "selectionMove" && gesture.hasMoved) {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            } else if (gesture.mode === "copy" && gesture.hasMoved) {
                const targetStartStep = targetStartFromPointer(gesture, event) ?? gesture.previewTargetStartStep;
                if (targetStartStep !== null && targetStartStep !== gesture.sourceStartStep) {
                    try {
                        const result = bridge.copyBlockPaint({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetStartStep,
                        });
                        const selectedStartStep = result.copiedStartSteps.at(-1);
                        if (selectedStartStep !== undefined) {
                            selectBlockRange(gesture.lane, selectedStartStep, gesture.length);
                        }
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            }

            gestureRef.current = null;
            setGestureState(null);
            setCopyPreview(null);
        };

        const cancelGesture = () => {
            if (!gestureRef.current) {
                return;
            }

            gestureRef.current = null;
            setGestureState(null);
            setCopyPreview(null);
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", stopGesture);
        window.addEventListener("pointercancel", cancelGesture);
        window.addEventListener("blur", cancelGesture);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopGesture);
            window.removeEventListener("pointercancel", cancelGesture);
            window.removeEventListener("blur", cancelGesture);
        };
    }, [bridge]);

    function beginGesture(gesture: BlockGesture) {
        gestureRef.current = gesture;
        setGestureState(gesture);
    }

    function selectBlockRange(lane: number, startStep: number, length: number) {
        setSelectedCell({ lane, step: startStep });
        setSelection({
            lane,
            steps: Array.from({ length }, (_unused, index) => startStep + index),
            blockStartSteps: [startStep],
        });
    }

    function selectBlockStartsFromPattern(
        pattern: SeqFxPattern,
        lane: number,
        blockStartSteps: number[],
        anchorStartStep = blockStartSteps[0],
    ) {
        const nextSelection = selectionFromBlockStarts(pattern, lane, blockStartSteps);
        if (!nextSelection) {
            return;
        }

        setSelectedCell({ lane, step: anchorStartStep });
        setSelection(nextSelection);
    }

    function pointerGrabOffset(lane: number, startStep: number, length: number, clientX: number) {
        const track = laneTrackRefs.current.get(lane);
        if (!track) {
            return 0;
        }

        const bounds = track.getBoundingClientRect();
        const pointerStep = gridGeometryRef.current.stepAtClientX(bounds, clientX);

        return Math.min(length - 1, Math.max(0, pointerStep - startStep));
    }

    function deleteBlockAt(lane: number, step: number) {
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const block = getSeqFxBlockAtStep(pattern, lane, step);
        if (!block) {
            return;
        }

        const selectedStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        if (selectedStarts.includes(block.startStep)) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPatternRef.current,
                lane,
                blockStartSteps: selectedStarts,
            });
            setSelectedCell(null);
            setSelection(null);
            gestureRef.current = null;
            setGestureState(null);
            setCopyPreview(null);
            return;
        }

        bridge.deleteBlock({
            patternIndex: selectedPatternRef.current,
            lane: block.lane,
            startStep: block.startStep,
        });
        setSelectedCell(null);
        setSelection(null);
        gestureRef.current = null;
        setGestureState(null);
        setCopyPreview(null);
    }

    const selectedPatternState = state.patterns[selectedPattern];
    const renderedPatternState = copyPreview?.patternIndex === selectedPattern
        ? copyPreview.state.patterns[selectedPattern]
        : selectedPatternState;
    const copyPreviewStartSteps = useMemo(() => (
        copyPreview?.patternIndex === selectedPattern
            ? new Set(copyPreview.copiedStartSteps)
            : new Set<number>()
    ), [copyPreview, selectedPattern]);
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? selectedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;
    const inspectedBlock = inspectedLane !== null && inspectedStep !== null
        ? getSeqFxBlockAtStep(selectedPatternState, inspectedLane, inspectedStep)
        : null;
    const selectedBlockStartSteps = activeSelection?.blockStartSteps ?? [];
    const selectedBlockGroup = selectedBlockStartSteps.length > 0;
    const selectedWholeBlock = Boolean(
        activeSelection
        && inspectedBlock
        && selectedBlockStartSteps.length <= 1
        && activeSelection.lane === inspectedBlock.lane
        && activeSelection.steps.length === inspectedBlock.length
        && activeSelection.steps[0] === inspectedBlock.startStep,
    );

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setCopyPreview(null);
        setSelectedCell(null);
        setSelection(null);
    }

    function activateCell(lane: number, step: number, shiftKey: boolean) {
        if (shiftKey && selectedCell && selectedCell.lane === lane) {
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
        setSelection({ lane, steps: [step], blockStartSteps: [step] });
    }

    function handleCellPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, step: number) {
        if (event.button !== 0) {
            return;
        }

        activateCell(lane, step, event.shiftKey);
    }

    function isKeyboardActivation(event: ReactKeyboardEvent<HTMLDivElement>) {
        return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
    }

    function handleCellKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, step: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        activateCell(lane, step, event.shiftKey);
    }

    function handleBlockPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
        if (event.button !== 0) {
            return;
        }

        event.stopPropagation();
        const grabOffset = pointerGrabOffset(lane, startStep, length, event.clientX);
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const activeBlockStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        const clickedSelectedBlock = activeBlockStarts.includes(startStep);

        if (event.shiftKey) {
            const anchorBlock = selectedCell?.lane === lane
                ? getSeqFxBlockAtStep(pattern, lane, selectedCell.step)
                : null;
            const blockStartSteps = anchorBlock
                ? blockStartsBetween(pattern, lane, anchorBlock.startStep, startStep)
                : [startStep];

            selectBlockStartsFromPattern(pattern, lane, blockStartSteps, anchorBlock?.startStep ?? startStep);
            return;
        }

        if (event.altKey || event.getModifierState("Alt") || optionKeyRef.current) {
            selectBlockRange(lane, startStep, length);
            beginGesture({
                mode: "copy",
                lane,
                sourceStartStep: startStep,
                length,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
                previewTargetStartStep: null,
            });
            return;
        }

        if (clickedSelectedBlock && activeBlockStarts.length > 1) {
            beginGesture({
                mode: "selectionMove",
                lane,
                blockStartSteps: [...activeBlockStarts],
                anchorStartStep: startStep,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
            });
            return;
        }

        selectBlockRange(lane, startStep, length);
        beginGesture({
            mode: "move",
            lane,
            length,
            grabOffset,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            hasMoved: false,
            lastStartStep: startStep,
        });
    }

    function handleBlockKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        selectBlockRange(lane, startStep, length);
    }

    function handleBlockDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, startStep);
    }

    function handleCellDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, step: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, step);
    }

    function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        beginGesture({ mode: "resize", lane, startStep });
    }

    function setMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
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

        if (selectedBlockGroup) {
            bridge.setBlockSelectionParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
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
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
            });
        } else if (inspectedBlock) {
            bridge.deleteBlock({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
            });
        }
        setSelectedCell(null);
        setSelection(null);
        setCopyPreview(null);
    }

    return (
        <main className={gestureState ? "seqfx-root is-dragging" : "seqfx-root"} data-role="seqfx-root">
            <SeqFxPresetBarHost bridge={bridge} patchConnection={patchConnection} />

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
                        <div className="seqfx-step-track" ref={measureTrackRef} style={stepTrackStyle}>
                            {STEP_NUMBERS.map((step) => (
                                <div
                                    className={playheadStep === step ? "seqfx-step-number is-playhead" : "seqfx-step-number"}
                                    key={step}
                                    style={gridGeometry.stepNumberStyle(step)}
                                >
                                    {step + 1}
                                </div>
                            ))}
                        </div>
                    </div>
                    {SEQFX_LANE_NAMES.map((laneName, lane) => {
                        const laneBlocks = getSeqFxLaneBlocks(renderedPatternState, lane);

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
                                    style={laneTrackStyle}
                                >
                                    {STEP_NUMBERS.map((step) => {
                                        const cell = renderedPatternState.lanes[lane].steps[step];
                                        const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                        const className = [
                                            "seqfx-cell",
                                            gridGeometry.isAltBar(step) ? "is-alt-bar" : "",
                                            cell.active ? "is-covered" : "",
                                            selected ? "is-selected" : "",
                                            playheadStep === step ? "is-playhead" : "",
                                        ].filter(Boolean).join(" ");

                                        return (
                                            <div
                                                aria-label={`${laneName} step ${step + 1}`}
                                                aria-pressed={cell.active}
                                                className={className}
                                                data-role="seqfx-cell"
                                                data-lane={lane}
                                                data-step={step}
                                                key={step}
                                                onDoubleClick={(event) => handleCellDoubleClick(event, lane, step)}
                                                onKeyDown={(event) => handleCellKeyDown(event, lane, step)}
                                                onPointerDown={(event) => handleCellPointerDown(event, lane, step)}
                                                role="button"
                                                style={gridGeometry.cellStyle(step)}
                                                tabIndex={0}
                                            >
                                                <span />
                                            </div>
                                        );
                                    })}
                                    {laneBlocks.map((block) => {
                                        const blockIsPreview = copyPreview?.patternIndex === selectedPattern
                                            && copyPreview.lane === lane
                                            && copyPreviewStartSteps.has(block.startStep);
                                        const selected = activeSelection?.lane === lane
                                            && (
                                                activeSelection.blockStartSteps?.includes(block.startStep)
                                                || (
                                                    activeSelection.steps[0] === block.startStep
                                                    && activeSelection.steps.length === block.length
                                                )
                                            );
                                        const className = [
                                            "seqfx-block",
                                            blockIsPreview ? "is-copy-preview" : "",
                                            selected ? "is-selected" : "",
                                            playheadStep !== null && playheadStep >= block.startStep && playheadStep <= block.endStep ? "is-playhead" : "",
                                        ].filter(Boolean).join(" ");
                                        const ariaLabel = block.length === 1
                                            ? `${laneName} block ${block.startStep + 1}`
                                            : `${laneName} block ${block.startStep + 1}-${block.endStep + 1}`;

                                        return (
                                            <div
                                                aria-label={ariaLabel}
                                                className={className}
                                                data-role="seqfx-block"
                                                data-lane={lane}
                                                data-preview={blockIsPreview ? "true" : undefined}
                                                data-start={block.startStep}
                                                key={`${lane}:${block.startStep}`}
                                                onDoubleClick={(event) => handleBlockDoubleClick(event, lane, block.startStep)}
                                                onKeyDown={(event) => handleBlockKeyDown(event, lane, block.startStep, block.length)}
                                                onPointerDown={(event) => handleBlockPointerDown(event, lane, block.startStep, block.length)}
                                                role="button"
                                                style={gridGeometry.blockStyle(block.startStep, block.length)}
                                                tabIndex={0}
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
                                            </div>
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
                                const disabled = triggerLatched && !selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1;
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
                            {selectedBlockGroup || (selectedWholeBlock && inspectedBlock) ? (
                                <button
                                    className="seqfx-delete-block"
                                    data-role="seqfx-delete-block"
                                    onClick={deleteSelectedBlock}
                                    type="button"
                                >
                                    {selectedBlockStartSteps.length > 1 ? "Delete Selection" : "Delete Block"}
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
                    rateIndex,
                    selectedCell,
                    selection,
                    lastUploadEndpoint: SEQFX_ENDPOINTS.patternUpload,
                })}
            </pre>
        </main>
    );
}
