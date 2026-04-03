import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import {
    PatchConnectionProvider,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import type { ResourceClient } from "../shared/resource-client";
import {
    EditableMsegSurface,
    MsegPreview,
    VOICE_MODE_OPTIONS,
    WavetableCanvas,
} from "../shared/synth-components";
import {
    clampMsegRateSeconds,
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    type MsegSurfaceOrientation,
} from "../shared/mseg";
import {
    clampDisplayPosition,
} from "../shared/runtime-table-state";
import {
    useSynthPatchViewModel,
} from "../shared/synth-hooks";
import {
    IOSKeyboardDock,
    type IOSPianoKeyboardElement,
} from "./ios-keyboard-adapter";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const DISPLAY_GESTURE_AXIS_LOCK_PX = 12;
const DISPLAY_SWIPE_MIN_COMMIT_PX = 48;
const DISPLAY_SWIPE_COMMIT_RATIO = 0.18;

type IOSResponsiveLayout = {
    isPortrait: boolean;
    noteCount: number;
    stageMinHeight: number;
    keyboardHeight: number;
    controlHeight: number;
    keyboardNaturalNoteWidth: number;
    keyboardAccidentalWidth: number;
};

type ActiveStageGesture = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTableIndex: number;
    startPosition: number;
    dragSpanX: number;
    dragSpanY: number;
    currentDeltaX: number;
    mode: "pending" | "horizontal" | "vertical";
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatGlideTime(seconds: number) {
    return `${Number(seconds).toFixed(3)} s`;
}

function formatSeconds(seconds: number) {
    return `${clampMsegRateSeconds(seconds).toFixed(3)} s`;
}

function formatFrameReadout(position: number, frameCount: number) {
    const safeFrameCount = Math.max(1, frameCount);
    const frameIndex = Math.round(clampDisplayPosition(position) * Math.max(0, safeFrameCount - 1)) + 1;
    return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}

function formatKeyboardRangeLabel(rootNote: number, noteCount: number) {
    const startNote = Math.max(0, Math.round(Number(rootNote) || 0));
    const lastNote = startNote + Math.max(0, Math.round(Number(noteCount) || 0) - 1);
    const formatNote = (noteNumber: number) => `${NOTE_NAMES[noteNumber % 12]}${Math.floor(noteNumber / 12) - 1}`;

    return `${formatNote(startNote)} - ${formatNote(lastNote)}`;
}

function formatIOSFactoryLibraryLoadMessage(prefix: string, detail: string) {
    return `${prefix}: ${detail}. Import the factory wavetable zip from the native library bar, then reopen the patch.`;
}

function computeIOSResponsiveLayout(width: number, height: number): IOSResponsiveLayout {
    const safeWidth = Math.max(Number(width) || 0, 0);
    const safeHeight = Math.max(Number(height) || 0, 0);
    const isPortrait = safeHeight > safeWidth;
    const shortLandscape = safeHeight < 460;
    const compact = safeWidth < 760;

    return {
        isPortrait,
        noteCount: 18,
        stageMinHeight: compact ? 216 : (shortLandscape ? 180 : 252),
        controlHeight: shortLandscape ? 48 : 54,
        keyboardHeight: compact ? 94 : (shortLandscape ? 88 : 102),
        keyboardNaturalNoteWidth: compact ? 22 : (shortLandscape ? 20 : 24),
        keyboardAccidentalWidth: compact ? 12 : (shortLandscape ? 11 : 13),
    };
}

function resolveDisplayGestureAxis(deltaX: number, deltaY: number, axisLockThreshold = DISPLAY_GESTURE_AXIS_LOCK_PX) {
    const safeDeltaX = Math.abs(Number(deltaX) || 0);
    const safeDeltaY = Math.abs(Number(deltaY) || 0);

    if (Math.max(safeDeltaX, safeDeltaY) < axisLockThreshold) {
        return "pending";
    }

    return safeDeltaX > safeDeltaY ? "horizontal" : "vertical";
}

function resolveHorizontalSwipeTarget(startTableIndex: number, deltaX: number, tableCount: number) {
    const safeTableCount = Math.max(1, Math.round(Number(tableCount) || 1));
    const safeStartIndex = clamp(Math.round(Number(startTableIndex) || 0), 0, safeTableCount - 1);
    const safeDeltaX = Number(deltaX) || 0;
    const direction = safeDeltaX < 0 ? 1 : safeDeltaX > 0 ? -1 : 0;

    if (direction === 0) {
        return {
            targetTableIndex: safeStartIndex,
            hasTarget: false,
        };
    }

    const targetTableIndex = clamp(safeStartIndex + direction, 0, safeTableCount - 1);
    return {
        targetTableIndex,
        hasTarget: targetTableIndex !== safeStartIndex,
    };
}

function shouldCommitHorizontalSwipe(deltaX: number, stageWidth: number) {
    const safeStageWidth = Math.max(0, Number(stageWidth) || 0);
    const commitDistance = Math.max(DISPLAY_SWIPE_MIN_COMMIT_PX, safeStageWidth * DISPLAY_SWIPE_COMMIT_RATIO);

    return Math.abs(Number(deltaX) || 0) >= commitDistance;
}

function useIOSViewportLayout() {
    const [layout, setLayout] = useState(() => computeIOSResponsiveLayout(
        Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
        Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844,
    ));

    useEffect(() => {
        const update = () => {
            setLayout(computeIOSResponsiveLayout(
                Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
                Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844,
            ));
        };

        globalThis.visualViewport?.addEventListener?.("resize", update);
        globalThis.window?.addEventListener?.("resize", update);
        update();

        return () => {
            globalThis.visualViewport?.removeEventListener?.("resize", update);
            globalThis.window?.removeEventListener?.("resize", update);
        };
    }, []);

    return layout;
}

function IOSPatchViewBody() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardRef = useRef<IOSPianoKeyboardElement | null>(null);
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const [isMsegModalOpen, setIsMsegModalOpen] = useState(false);
    const [activeStageGesture, setActiveStageGesture] = useState<ActiveStageGesture | null>(null);
    const layout = useIOSViewportLayout();
    const msegPreviewOrientation: MsegSurfaceOrientation = "horizontal";
    const msegEditorOrientation: MsegSurfaceOrientation = layout.isPortrait ? "vertical" : "horizontal";
    const synthView = useSynthPatchViewModel({
        stageRef,
        msegEditorSurfaceRef,
        keyboardRef,
        voiceModeCount: VOICE_MODE_OPTIONS.length,
        msegSurfaceOrientation: msegEditorOrientation,
    });

    const shellStyle = useMemo(() => ({
        ["--cosimo-stage-min-height" as string]: `${layout.stageMinHeight}px`,
        ["--cosimo-keyboard-height" as string]: `${layout.keyboardHeight}px`,
        ["--cosimo-control-height" as string]: `${layout.controlHeight}px`,
    }) satisfies CSSProperties, [layout.controlHeight, layout.keyboardHeight, layout.stageMinHeight]);

    const displayStatus = useMemo(() => {
        if (synthView.frameError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable bank", synthView.frameError);
        }

        if (synthView.catalogError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable catalog", synthView.catalogError);
        }

        if (synthView.runtimePresentation.failureMessage) {
            return synthView.runtimePresentation.failureMessage;
        }

        if (
            synthView.runtimePresentation.isPendingSelection &&
            synthView.desiredTableName !== synthView.displayedTableName
        ) {
            return `Loading ${synthView.desiredTableName}…`;
        }

        if (!synthView.frames) {
            return "Loading wavetable bank…";
        }

        return `${synthView.displayedFrameCount} shapes`;
    }, [
        synthView.catalogError,
        synthView.desiredTableName,
        synthView.displayedFrameCount,
        synthView.displayedTableName,
        synthView.frameError,
        synthView.frames,
        synthView.runtimePresentation.failureMessage,
        synthView.runtimePresentation.isPendingSelection,
    ]);

    const bankReadout = useMemo(() => {
        if (synthView.frameError) {
            return "Display unavailable";
        }

        if (synthView.runtimePresentation.failureMessage) {
            if (synthView.desiredTableName !== synthView.displayedTableName) {
                return `${synthView.displayedTableName} -> ${synthView.desiredTableName} • ${synthView.runtimePresentation.failureMessage}`;
            }

            return `${synthView.displayedTableName} • ${synthView.runtimePresentation.failureMessage}`;
        }

        if (
            synthView.runtimePresentation.isPendingSelection &&
            synthView.desiredTableName !== synthView.displayedTableName
        ) {
            return `${synthView.displayedTableName} -> ${synthView.desiredTableName}`;
        }

        return synthView.displayedTableName;
    }, [
        synthView.desiredTableName,
        synthView.displayedTableName,
        synthView.frameError,
        synthView.runtimePresentation.failureMessage,
        synthView.runtimePresentation.isPendingSelection,
    ]);

    const tableErrorText = synthView.runtimePresentation.failureMessage ? synthView.failureDetail : null;
    const shouldShowOverlay = !synthView.frames || Boolean(synthView.frameError || synthView.catalogError);

    const handleSelectWavetable = useCallback((nextValue: number) => {
        synthView.handleSelectWavetable(nextValue);
    }, [synthView]);

    const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        if ((event.target as HTMLElement | null)?.closest?.(".bank-picker-trigger, select, button, input")) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        setActiveStageGesture({
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTableIndex: synthView.displayedTableIndex,
            startPosition: synthView.observedPosition,
            dragSpanX: bounds.width,
            dragSpanY: bounds.height,
            currentDeltaX: 0,
            mode: "pending",
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }, [synthView.displayedTableIndex, synthView.observedPosition]);

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - activeStageGesture.startClientX;
        const deltaY = event.clientY - activeStageGesture.startClientY;
        const gestureAxis = resolveDisplayGestureAxis(deltaX, deltaY);
        let nextGesture = activeStageGesture;

        if (activeStageGesture.mode === "pending" && gestureAxis !== "pending") {
            nextGesture = {
                ...activeStageGesture,
                mode: gestureAxis,
            };
            setActiveStageGesture(nextGesture);

            if (gestureAxis === "vertical") {
                synthView.wavetablePosition.beginGesture();
            }
        }

        if (nextGesture.mode === "horizontal") {
            setActiveStageGesture((previousGesture) => previousGesture
                ? { ...previousGesture, currentDeltaX: deltaX }
                : previousGesture);
            event.preventDefault();
            return;
        }

        if (nextGesture.mode !== "vertical") {
            return;
        }

        const nextPosition = clampDisplayPosition(
            nextGesture.startPosition + ((nextGesture.startClientY - event.clientY) / Math.max(1, nextGesture.dragSpanY)),
        );
        synthView.wavetablePosition.setValue(nextPosition);
        event.preventDefault();
    }, [activeStageGesture, synthView.wavetablePosition]);

    const endStageGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);

        if (activeStageGesture.mode === "vertical") {
            synthView.wavetablePosition.endGesture();
            setActiveStageGesture(null);
            event.preventDefault();
            return;
        }

        if (activeStageGesture.mode === "horizontal") {
            const swipeTarget = resolveHorizontalSwipeTarget(
                activeStageGesture.startTableIndex,
                activeStageGesture.currentDeltaX,
                synthView.tableOptions.length,
            );

            if (
                swipeTarget.hasTarget &&
                shouldCommitHorizontalSwipe(activeStageGesture.currentDeltaX, activeStageGesture.dragSpanX)
            ) {
                handleSelectWavetable(swipeTarget.targetTableIndex);
            }
        }

        setActiveStageGesture(null);
        event.preventDefault();
    }, [activeStageGesture, handleSelectWavetable, synthView.tableOptions.length, synthView.wavetablePosition]);

    const handleOctaveDown = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleOctaveUp = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    return (
        <div className="ios-shell" style={shellStyle}>
            <div className="ios-top-row">
                <div className="ios-main-view" style={isMsegModalOpen ? { display: "none" } : undefined}>
                    <div className="ios-scroll">
                        <div className="ios-content">
                            <div className="wavetable-panel">
                                <div
                                    ref={stageRef}
                                    className="wavetable-stage"
                                    data-state={shouldShowOverlay ? "loading" : "ready"}
                                    onPointerDown={handleStagePointerDown}
                                    onPointerMove={handleStagePointerMove}
                                    onPointerUp={endStageGesture}
                                    onPointerCancel={endStageGesture}
                                >
                                    <div className="wavetable-display-stack">
                                        <div className="wavetable-layer">
                                            <WavetableCanvas frames={synthView.frames} position={synthView.observedPosition} />
                                        </div>
                                        <div className="wavetable-layer" aria-hidden="true" />
                                    </div>
                                    <div className="display-overlay" hidden={!shouldShowOverlay}>
                                        {displayStatus}
                                    </div>
                                    <div className="stage-copy">
                                        <div className="stage-copy-row">
                                            <div className="mini-label active">Wavescan</div>
                                            <div className="display-status" data-role="display-status">{displayStatus}</div>
                                            <div className="shape-readout" data-role="hero-frame-readout">
                                                {formatFrameReadout(synthView.observedPosition, synthView.displayedFrameCount)}
                                            </div>
                                        </div>
                                        <div
                                            className="table-error-banner"
                                            data-role="table-error-banner"
                                            hidden={!tableErrorText}
                                        >
                                            {tableErrorText ?? ""}
                                        </div>
                                        <div />
                                        <div className="stage-copy-row">
                                            <label className="bank-picker-trigger">
                                                <div className="bank-readout">{bankReadout}</div>
                                                <select
                                                    className="table-select table-select-overlay"
                                                    aria-label="Select wavetable"
                                                    value={String(synthView.desiredTableIndex)}
                                                    onChange={(event) => handleSelectWavetable(Number(event.target.value))}
                                                    {...synthView.keyboardRouting.wavetableFocusBindings}
                                                >
                                                    {synthView.tableOptions.map((table, tableIndex) => (
                                                        <option key={`${table.tableId}-${tableIndex}`} value={tableIndex}>
                                                            {table.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button
                                                className="table-retry-button"
                                                type="button"
                                                hidden={!synthView.canRetryDesiredTableLoad}
                                                disabled={!synthView.canRetryDesiredTableLoad}
                                                onClick={synthView.handleRetryLoad}
                                            >
                                                Retry
                                            </button>
                                            <div className="mini-label warm" data-role="stage-gesture-hint">Swipe + Drag</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="play-panel">
                                <div className="play-grid">
                                    <label className="play-field" aria-label="Voice mode">
                                        <select
                                            className="play-select play-mode-select"
                                            aria-label="Voice mode"
                                            value={String(synthView.playMode.value)}
                                            onChange={(event) => synthView.playMode.commitValue(Number(event.target.value))}
                                            {...synthView.keyboardRouting.playModeFocusBindings}
                                        >
                                            {VOICE_MODE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="play-field" aria-label="Glide time">
                                        <div className="glide-field-body">
                                            <input
                                                className="glide-time-slider"
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.001"
                                                value={Math.min(synthView.glideTime.value, 1).toFixed(3)}
                                                aria-label="Glide time"
                                                onPointerDownCapture={synthView.keyboardRouting.glideFocusTarget.onActivate}
                                                onFocusCapture={synthView.keyboardRouting.glideFocusTarget.onActivate}
                                                onChange={(event) => synthView.glideTime.commitValue(Number(event.target.value))}
                                            />
                                            <div className="glide-time-readout" data-role="glide-time-readout">
                                                {formatGlideTime(synthView.glideTime.value)}
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="mseg-shell">
                                <div className="mseg-launcher">
                                    <div className="mseg-launcher-head">
                                        <div className="mseg-launcher-copy">
                                            <div className="mseg-eyebrow">MSEG 1</div>
                                            <strong className="mseg-route-title">Fixed Wavetable Route</strong>
                                        </div>
                                    </div>

                                    <button
                                        className="mseg-preview-button"
                                        type="button"
                                        aria-label="Open MSEG editor"
                                        onClick={() => setIsMsegModalOpen(true)}
                                    >
                                        <div className="mseg-preview-shell">
                                            {synthView.msegState ? (
                                                <MsegPreview
                                                    points={synthView.msegState.shape.points}
                                                    orientation={msegPreviewOrientation}
                                                    className="h-full w-full overflow-hidden rounded-[20px] bg-white/[0.03]"
                                                />
                                            ) : null}
                                        </div>
                                    </button>

                                    <div className="mseg-preview-footer">
                                        <div className="mseg-launcher-rate-readout" data-role="mseg-launcher-rate-readout">
                                            {synthView.msegState ? formatSeconds(synthView.msegState.playback.rate.seconds) : "1.000 s"}
                                        </div>
                                        <button
                                            className="mseg-loop-button mseg-launcher-loop-button"
                                            type="button"
                                            data-role="mseg-launcher-loop-button"
                                            aria-pressed={synthView.msegState?.playback.loop ? "true" : "false"}
                                            aria-label="Toggle full-shape loop"
                                            onClick={synthView.handleToggleMsegLoop}
                                        >
                                            Loop
                                        </button>
                                    </div>

                                    <div className="mseg-controls">
                                        <label className="mseg-depth">
                                            <span className="mseg-depth-label">Depth To Wavetable Position</span>
                                            <input
                                                className="mseg-depth-slider"
                                                type="range"
                                                min="-1"
                                                max="1"
                                                step="0.001"
                                                value={Number(synthView.msegState?.depth ?? 0).toFixed(3)}
                                                onChange={(event) => synthView.handleMsegDepthChange(Number(event.target.value))}
                                                {...synthView.keyboardRouting.msegDepthFocusBindings}
                                            />
                                        </label>
                                        <div className="mseg-depth-readout" data-role="mseg-depth-readout">
                                            {Number(synthView.msegState?.depth ?? 0).toFixed(3)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="keyboard-toolbar">
                                <div className="octave-controls">
                                    <button
                                        className="octave-button octave-down"
                                        type="button"
                                        disabled={keyboardRootNote <= KEYBOARD_ROOT_NOTE_MIN}
                                        onClick={handleOctaveDown}
                                    >
                                        Oct -
                                    </button>
                                    <div className="octave-readout" data-role="octave-readout">
                                        {formatKeyboardRangeLabel(keyboardRootNote, layout.noteCount)}
                                    </div>
                                    <button
                                        className="octave-button octave-up"
                                        type="button"
                                        disabled={keyboardRootNote >= KEYBOARD_ROOT_NOTE_MAX}
                                        onClick={handleOctaveUp}
                                    >
                                        Oct +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mseg-modal-layer" data-role="mseg-modal-layer" data-open={isMsegModalOpen ? "true" : "false"}>
                    {isMsegModalOpen ? (
                        <section
                            className="mseg-modal"
                            data-role="mseg-modal"
                            aria-hidden={isMsegModalOpen ? "false" : "true"}
                        >
                            <div className="mseg-modal-head">
                                <div className="mseg-modal-copy">
                                    <div className="mseg-eyebrow">MSEG 1</div>
                                    <strong className="mseg-route-title">Fixed Wavetable Route</strong>
                                </div>
                                <button
                                    className="mseg-modal-close"
                                    type="button"
                                    aria-label="Close MSEG editor"
                                    data-role="mseg-modal-close"
                                    onClick={() => setIsMsegModalOpen(false)}
                                >
                                    x
                                </button>
                            </div>

                            <div className="mseg-modal-stage">
                                {synthView.msegState ? (
                                    <EditableMsegSurface
                                        surfaceRef={msegEditorSurfaceRef}
                                        dataRole="mseg-modal-viewport"
                                        className="mseg-surface mseg-modal-surface"
                                        orientation={msegEditorOrientation}
                                        points={synthView.msegState.shape.points}
                                        selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                                        onPointerDown={synthView.msegEditor.handlePointerDown}
                                        onPointerMove={synthView.msegEditor.handlePointerMove}
                                        onPointerUp={synthView.msegEditor.handlePointerUp}
                                    />
                                ) : null}
                            </div>

                            <div className="mseg-modal-footer">
                                <label className="mseg-rate">
                                    <span className="mseg-depth-label">Time In Seconds</span>
                                    <input
                                        className="mseg-rate-slider"
                                        type="range"
                                        aria-label="MSEG time in seconds"
                                        min={MSEG_RATE_MIN_SECONDS.toFixed(3)}
                                        max={MSEG_RATE_MAX_SECONDS.toFixed(3)}
                                        step="0.001"
                                        value={clampMsegRateSeconds(synthView.msegState?.playback.rate.seconds ?? 1).toFixed(3)}
                                        onChange={(event) => synthView.handleMsegRateChange(Number(event.target.value))}
                                        {...synthView.keyboardRouting.msegRateFocusBindings}
                                    />
                                </label>
                                <div className="mseg-modal-footer-actions">
                                    <div className="mseg-rate-readout" data-role="mseg-rate-readout">
                                        {formatSeconds(synthView.msegState?.playback.rate.seconds ?? 1)}
                                    </div>
                                    <button
                                        className="mseg-loop-button"
                                        type="button"
                                        data-role="mseg-loop-button"
                                        aria-pressed={synthView.msegState?.playback.loop ? "true" : "false"}
                                        aria-label="Toggle full-shape loop"
                                        onClick={synthView.handleToggleMsegLoop}
                                    >
                                        Loop
                                    </button>
                                </div>
                            </div>
                        </section>
                    ) : null}
                </div>
            </div>

            <div className="keyboard-footer">
                <IOSKeyboardDock
                    rootNote={keyboardRootNote}
                    noteCount={layout.noteCount}
                    naturalNoteWidth={layout.keyboardNaturalNoteWidth}
                    accidentalWidth={layout.keyboardAccidentalWidth}
                    keyboardRef={keyboardRef}
                />
            </div>
        </div>
    );
}

export function IOSPatchView({
    patchConnection,
    resourceClient,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient: ResourceClient;
}) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
            <IOSPatchViewBody />
        </PatchConnectionProvider>
    );
}
