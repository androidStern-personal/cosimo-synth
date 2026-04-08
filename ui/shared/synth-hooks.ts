import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";

import {
    usePatchConnection,
    usePatchEndpoint,
    useResourceClient,
} from "./cmajor-react";
import {
    usePatchEventTrigger,
    usePatchParameterBinding,
    type PatchControlBinding,
} from "./patch-controls";
import {
    deriveMsegSegmentCurvePower,
    clampMsegRateSeconds,
    findMsegPointHitIndex,
    findMsegSegmentHitIndex,
    msegEditorCoordinatesToPoint,
    type MsegSurfaceOrientation,
    type MsegState,
} from "./mseg";
import {
    acquireModulationRuntimeBridge,
    buildDisplayedMsegState,
    createDefaultEnvelope,
    createDefaultRoute,
    releaseModulationRuntimeBridge,
    type ModulationEnvelope,
    type ModulationRoute,
    type ModulationState,
    type MsegEditorControllerLike,
} from "./modulation";
import {
    clampDisplayPosition,
    describeRuntimeTableFailureDetails,
    mapDisplayDragToPosition,
    normalizeRuntimeTableState,
    resolveRuntimeTablePresentation,
    selectObservedEffectiveFilterState,
    selectObservedEffectiveWarpState,
    selectObservedWavetablePositionState,
    type EffectiveFilterState,
    type EffectiveWarpState,
    type RuntimeTablePresentation,
} from "./runtime-table-state";
import {
    normalizeFilterSpectrumMessage,
    type FilterSpectrumFrame,
} from "./filter-spectrum";
import {
    DISTORTION_SCOPE_ENDPOINT_ID,
    normalizeDistortionScopeMessage,
    type DistortionScopeFrame,
} from "./distortion-visualization";
import {
    useSynthInputRouter,
    type ArrowStepDirection,
    type SynthFocusBindings,
    type SynthKeyboardLike,
} from "./synth-input-router";
import {
    loadFactoryBankCatalog,
    loadFactoryBankFrames,
    type FactoryBankCatalog,
} from "./wavetable-bank";

export const EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID = "effectiveWavetablePosition";
export const EFFECTIVE_WARP_STATE_ENDPOINT_ID = "effectiveWarpState";
export const EFFECTIVE_FILTER_STATE_ENDPOINT_ID = "effectiveFilterState";
export const FILTER_SPECTRUM_ENDPOINT_ID = "filterSpectrum";
export const DISPLAY_SWIPE_THRESHOLD_PX = 2;
export const MSEG_DRAG_THRESHOLD_PX = 8;
const WAVETABLE_POSITION_ENDPOINT_ID = "wavetablePosition";
const WAVETABLE_SELECT_ENDPOINT_ID = "wavetableSelect";
const PLAY_MODE_ENDPOINT_ID = "playMode";
const GLIDE_TIME_ENDPOINT_ID = "glideTime";
const PAN_ENDPOINT_ID = "pan";
const WARP_MODE_ENDPOINT_ID = "warpMode";
const WARP_AMOUNT_ENDPOINT_ID = "warpAmount";
const FILTER_MODE_ENDPOINT_ID = "filterMode";
const FILTER_CUTOFF_ENDPOINT_ID = "filterCutoff";
const FILTER_Q_ENDPOINT_ID = "filterQ";
const DISTORTION_DRIVE_DB_ENDPOINT_ID = "distortionDriveDb";
const DISTORTION_KNEE_ENDPOINT_ID = "distortionKnee";
const DISTORTION_WET_ENDPOINT_ID = "distortionWet";
const DISTORTION_WET_HP_HZ_ENDPOINT_ID = "distortionWetHPHz";
const DISTORTION_WET_LP_HZ_ENDPOINT_ID = "distortionWetLPHz";
const RUNTIME_SYNC_REQUEST_ENDPOINT_ID = "runtimeSyncRequest";
const RUNTIME_STATE_ENDPOINT_ID = "runtimeState";
const RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID = "retryDesiredTableRequest";
const GLIDE_TIME_MIN_SECONDS = 0;
const GLIDE_TIME_MAX_SECONDS = 2;
const GLIDE_TIME_STEP_SECONDS = 0.001;

type ActiveMsegPointPointerState = {
    kind: "point-drag";
    pointerId: number;
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    deleteOnRelease: boolean;
};

type ActiveMsegPendingSegmentPointerState = {
    kind: "pending-segment";
    pointerId: number;
    segmentIndex: number;
    startClientX: number;
    startClientY: number;
    holdTimeoutId: number | null;
};

type ActiveMsegCurvePointerState = {
    kind: "curve-drag";
    pointerId: number;
    segmentIndex: number;
};

type ActiveMsegPointerState =
    | ActiveMsegPointPointerState
    | ActiveMsegPendingSegmentPointerState
    | ActiveMsegCurvePointerState;

export type CatalogLoadState = {
    catalog: FactoryBankCatalog | null;
    error: string | null;
};

export type FrameLoadState = {
    frames: Float32Array[] | null;
    error: string | null;
};

export type SynthTextEntryFocusTarget = {
    onActivate: () => void;
    onBeginTextEntry: () => void;
    onEndTextEntry: () => void;
};

export type SynthKeyboardRoutingBindings = {
    wavetableFocusBindings: SynthFocusBindings;
    playModeFocusBindings: SynthFocusBindings;
    msegRateFocusBindings: SynthFocusBindings;
    glideFocusTarget: SynthTextEntryFocusTarget;
};

export type SynthPatchViewModel = {
    frames: Float32Array[] | null;
    catalogError: string | null;
    frameError: string | null;
    observedPosition: number;
    topStatus: string;
    failureDetail: string | null;
    runtimePresentation: RuntimeTablePresentation;
    displayedTableIndex: number;
    displayedTableName: string;
    displayedFrameCount: number;
    desiredTableIndex: number;
    desiredTableName: string;
    tableOptions: FactoryBankCatalog["tables"];
    canRetryDesiredTableLoad: boolean;
    wavetablePosition: PatchControlBinding<number>;
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
    pan: PatchControlBinding<number>;
    warpMode: PatchControlBinding<number>;
    warpAmount: PatchControlBinding<number>;
    filterMode: PatchControlBinding<number>;
    filterCutoff: PatchControlBinding<number>;
    filterQ: PatchControlBinding<number>;
    distortionDriveDb: PatchControlBinding<number>;
    distortionKnee: PatchControlBinding<number>;
    distortionWet: PatchControlBinding<number>;
    distortionWetHPHz: PatchControlBinding<number>;
    distortionWetLPHz: PatchControlBinding<number>;
    observedFilterState: EffectiveFilterState;
    observedFilterSpectrum: FilterSpectrumFrame | null;
    observedDistortionScope: DistortionScopeFrame | null;
    observedWarpState: EffectiveWarpState;
    modulationState: ModulationState | null;
    selectedMsegSlot: number;
    selectedEnvelopeSlot: number;
    selectedEnvelope: ModulationEnvelope | null;
    routes: ModulationRoute[];
    msegState: MsegState | null;
    handleSelectMsegSlot: (slotIndex: number) => void;
    handleSelectEnvelopeSlot: (slotIndex: number) => void;
    handleEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    handleAddRoute: () => void;
    handleRemoveRoute: (routeIndex: number) => void;
    handleRouteChange: (routeIndex: number, nextRoute: ModulationRoute) => void;
    handleSelectWavetable: (nextValue: number) => void;
    handleRetryLoad: () => void;
    handleMsegRateChange: (nextValue: number) => void;
    handleToggleMsegLoop: () => void;
    stageBindings: {
        handleStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
        handleStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
        handleStagePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    };
    msegEditor: ReturnType<typeof useMsegEditorInteractions>;
    keyboardRouting: SynthKeyboardRoutingBindings;
};

function describeErrorMessage(error: unknown) {
    if (error && typeof error === "object") {
        const maybeError = error as { stack?: string; message?: string };
        return maybeError.stack || maybeError.message || String(error);
    }

    return String(error);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function useFactoryBankCatalog(): CatalogLoadState {
    const resourceClient = useResourceClient();
    const [state, setState] = useState<CatalogLoadState>({
        catalog: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        void loadFactoryBankCatalog(resourceClient)
            .then((catalog) => {
                if (!cancelled) {
                    setState({
                        catalog,
                        error: null,
                    });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        catalog: null,
                        error: describeErrorMessage(error),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [resourceClient]);

    return state;
}

export function useFactoryTableFrames(tableIndex: number): FrameLoadState {
    const resourceClient = useResourceClient();
    const [state, setState] = useState<FrameLoadState>({
        frames: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        void loadFactoryBankFrames(resourceClient, { tableIndex })
            .then((nextFrames) => {
                if (!cancelled) {
                    setState({
                        frames: nextFrames.frames,
                        error: null,
                    });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        frames: null,
                        error: describeErrorMessage(error),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [resourceClient, tableIndex]);

    return state;
}

export function useObservedDisplayPosition(parameterPosition: number) {
    const message = usePatchEndpoint<unknown | null>(EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState(() => ({
        voiceGeneration: -1,
        position: parameterPosition,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedWavetablePositionState(previousState, message));
    }, [message]);

    return message ? observedState.position : parameterPosition;
}

export function useObservedFilterState({
    filterMode,
    filterCutoff,
    filterQ,
}: {
    filterMode: number;
    filterCutoff: number;
    filterQ: number;
}) {
    const message = usePatchEndpoint<unknown | null>(EFFECTIVE_FILTER_STATE_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<EffectiveFilterState>(() => ({
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(filterMode) || 0,
        cutoffHz: Number(filterCutoff) || 1000,
        q: Number(filterQ) || 0.707107,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedEffectiveFilterState(previousState, message));
    }, [message]);

    useEffect(() => {
        if (message) {
            return;
        }

        setObservedState({
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(filterMode) || 0,
            cutoffHz: Number(filterCutoff) || 1000,
            q: Number(filterQ) || 0.707107,
        });
    }, [filterCutoff, filterMode, filterQ, message]);

    if (!message) {
        return {
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(filterMode) || 0,
            cutoffHz: Number(filterCutoff) || 1000,
            q: Number(filterQ) || 0.707107,
        };
    }

    return observedState ?? {
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(filterMode) || 0,
        cutoffHz: Number(filterCutoff) || 1000,
        q: Number(filterQ) || 0.707107,
    };
}

export function useObservedFilterSpectrum() {
    const message = usePatchEndpoint<unknown | null>(FILTER_SPECTRUM_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<FilterSpectrumFrame | null>(null);

    useEffect(() => {
        if (!message) {
            return;
        }

        const normalizedState = normalizeFilterSpectrumMessage(message);
        if (!normalizedState) {
            return;
        }

        setObservedState(normalizedState);
    }, [message]);

    return observedState;
}

export function useObservedDistortionScope() {
    const message = usePatchEndpoint<unknown | null>(DISTORTION_SCOPE_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<DistortionScopeFrame | null>(null);

    useEffect(() => {
        if (!message) {
            return;
        }

        const normalizedState = normalizeDistortionScopeMessage(message);
        if (!normalizedState) {
            return;
        }

        setObservedState(normalizedState);
    }, [message]);

    return observedState;
}

export function useObservedWarpState({
    warpMode,
    warpAmount,
}: {
    warpMode: number;
    warpAmount: number;
}) {
    const message = usePatchEndpoint<unknown | null>(EFFECTIVE_WARP_STATE_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<EffectiveWarpState>(() => ({
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(warpMode) || 0,
        amount: Number(warpAmount) || 0,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedEffectiveWarpState(previousState, message));
    }, [message]);

    useEffect(() => {
        if (message) {
            return;
        }

        setObservedState({
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(warpMode) || 0,
            amount: Number(warpAmount) || 0,
        });
    }, [message, warpAmount, warpMode]);

    if (!message) {
        return {
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(warpMode) || 0,
            amount: Number(warpAmount) || 0,
        };
    }

    return observedState ?? {
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(warpMode) || 0,
        amount: Number(warpAmount) || 0,
    };
}

export function useModulationState() {
    const patchConnection = usePatchConnection();
    const [state, setState] = useState<ModulationState | null>(null);
    const bridgeRef = useRef<ReturnType<typeof acquireModulationRuntimeBridge> | null>(null);

    useEffect(() => {
        const bridge = acquireModulationRuntimeBridge(patchConnection);
        bridgeRef.current = bridge;
        setState(bridge.getState());
        bridge.subscribe(setState);

        return () => {
            bridge.unsubscribe(setState);
            releaseModulationRuntimeBridge(patchConnection);
            bridgeRef.current = null;
        };
    }, [patchConnection]);

    return {
        state,
        bridge: bridgeRef,
    };
}

export function useMsegState() {
    const { state, bridge } = useModulationState();
    const controllerRef = useRef<MsegEditorControllerLike | null>(null);

    controllerRef.current = bridge.current?.getMsegSlotController(0) ?? null;

    return {
        state: state && bridge.current
            ? buildDisplayedMsegState(bridge.current, 0)
            : null,
        controller: controllerRef,
    };
}

export function useStagePositionDrag({
    stageRef,
    observedPosition,
    binding,
}: {
    stageRef: RefObject<HTMLDivElement | null>;
    observedPosition: number;
    binding: PatchControlBinding<number>;
}) {
    const [activeDisplayDrag, setActiveDisplayDrag] = useState<{
        pointerId: number;
        startPosition: number;
        startClientY: number;
    } | null>(null);

    const beginPositionGesture = useCallback(() => {
        binding.beginGesture();
    }, [binding]);

    const endPositionGesture = useCallback(() => {
        binding.endGesture();
    }, [binding]);

    const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        if ((event.target as HTMLElement | null)?.closest?.("select, button, input")) {
            return;
        }

        beginPositionGesture();
        setActiveDisplayDrag({
            pointerId: event.pointerId,
            startPosition: observedPosition,
            startClientY: event.clientY,
        });
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [beginPositionGesture, observedPosition]);

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId || !stageRef.current) {
            return;
        }

        if (Math.abs(event.clientY - activeDisplayDrag.startClientY) < DISPLAY_SWIPE_THRESHOLD_PX) {
            return;
        }

        const bounds = stageRef.current.getBoundingClientRect();
        const nextPosition = mapDisplayDragToPosition(
            activeDisplayDrag.startPosition,
            activeDisplayDrag.startClientY,
            event.clientY,
            bounds.height,
        );
        binding.setValue(nextPosition);
    }, [activeDisplayDrag, binding, stageRef]);

    const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setActiveDisplayDrag(null);
        endPositionGesture();
    }, [activeDisplayDrag, endPositionGesture]);

    return {
        handleStagePointerDown,
        handleStagePointerMove,
        handleStagePointerUp,
    };
}

export function useMsegEditorInteractions({
    msegState,
    msegController,
    surfaceRef,
    orientation = "horizontal",
    curveEditActivationMode = "immediate",
    curveEditHoldDelayMs = 350,
    onCurveEditHoldActivated = null,
}: {
    msegState: MsegState | null;
    msegController: RefObject<MsegEditorControllerLike | null>;
    surfaceRef: RefObject<SVGSVGElement | null>;
    orientation?: MsegSurfaceOrientation;
    curveEditActivationMode?: "immediate" | "hold-or-drag";
    curveEditHoldDelayMs?: number;
    onCurveEditHoldActivated?: (() => void) | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPointIndex, setSelectedPointIndex] = useState(0);
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(-1);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
    const activePointerRef = useRef<ActiveMsegPointerState | null>(null);

    const clearPendingSegmentTimer = useCallback((pointerState: ActiveMsegPointerState | null) => {
        if (pointerState?.kind === "pending-segment" && pointerState.holdTimeoutId !== null) {
            window.clearTimeout(pointerState.holdTimeoutId);
            pointerState.holdTimeoutId = null;
        }
    }, []);

    useEffect(() => {
        if (!msegState) {
            return;
        }

        setSelectedPointIndex((previousIndex) => clamp(
            previousIndex,
            0,
            Math.max(0, msegState.shape.points.length - 1),
        ));
    }, [msegState]);

    const resolvePointerLocation = useCallback((clientX: number, clientY: number) => {
        if (!msegState || !surfaceRef.current) {
            return null;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const localX = clientX - bounds.left;
        const localY = clientY - bounds.top;
        const currentShape = msegController.current?.getState().shape ?? msegState.shape;
        const pointIndex = findMsegPointHitIndex(
            currentShape,
            localX,
            localY,
            bounds.width,
            bounds.height,
            undefined,
            { orientation },
        );
        const segmentIndex = pointIndex >= 0
            ? -1
            : findMsegSegmentHitIndex(
                currentShape,
                localX,
                localY,
                bounds.width,
                bounds.height,
                undefined,
                { orientation },
            );

        return {
            bounds,
            localX,
            localY,
            pointIndex,
            segmentIndex,
        };
    }, [msegController, msegState, orientation, surfaceRef]);

    const updateHoveredSegmentIndex = useCallback((clientX: number, clientY: number) => {
        const pointerLocation = resolvePointerLocation(clientX, clientY);
        setHoveredSegmentIndex(pointerLocation?.segmentIndex ?? -1);
        return pointerLocation;
    }, [resolvePointerLocation]);

    useEffect(() => {
        if (!isOpen) {
            clearPendingSegmentTimer(activePointerRef.current);
            activePointerRef.current = null;
            setHoveredSegmentIndex(-1);
            setActiveSegmentIndex(-1);
            return;
        }

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleEscapeKey);
        return () => {
            window.removeEventListener("keydown", handleEscapeKey);
        };
    }, [clearPendingSegmentTimer, isOpen]);

    const openEditor = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeEditor = useCallback(() => {
        setIsOpen(false);
        clearPendingSegmentTimer(activePointerRef.current);
        activePointerRef.current = null;
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
    }, [clearPendingSegmentTimer]);

    const applyCurveEditFromClientCoordinates = useCallback((segmentIndex: number, clientX: number, clientY: number) => {
        if (!surfaceRef.current || !msegController.current) {
            return;
        }

        const currentShape = msegController.current.getState().shape ?? msegState?.shape;
        if (!currentShape) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            clientX - bounds.left,
            clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        const curvePower = deriveMsegSegmentCurvePower(currentShape, segmentIndex, point.x, point.y);
        msegController.current.setSegmentCurvePower(segmentIndex, curvePower);
    }, [msegController, msegState?.shape, orientation, surfaceRef]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || !msegState || !surfaceRef.current) {
            return;
        }

        const pointerLocation = updateHoveredSegmentIndex(event.clientX, event.clientY);
        if (!pointerLocation) {
            return;
        }

        if (pointerLocation.pointIndex >= 0) {
            setSelectedPointIndex(pointerLocation.pointIndex);
            setActiveSegmentIndex(-1);
            activePointerRef.current = {
                kind: "point-drag",
                pointerId: event.pointerId,
                pointIndex: pointerLocation.pointIndex,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
                deleteOnRelease:
                    pointerLocation.pointIndex > 0 &&
                    pointerLocation.pointIndex < msegState.shape.points.length - 1,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            return;
        }

        if (pointerLocation.segmentIndex >= 0) {
            setActiveSegmentIndex(pointerLocation.segmentIndex);
            setHoveredSegmentIndex(pointerLocation.segmentIndex);
            if (curveEditActivationMode === "immediate") {
                activePointerRef.current = {
                    kind: "curve-drag",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                };
            } else {
                const holdTimeoutId = window.setTimeout(() => {
                    const activePointer = activePointerRef.current;
                    if (
                        !activePointer
                        || activePointer.kind !== "pending-segment"
                        || activePointer.pointerId !== event.pointerId
                    ) {
                        return;
                    }

                    activePointerRef.current = {
                        kind: "curve-drag",
                        pointerId: activePointer.pointerId,
                        segmentIndex: activePointer.segmentIndex,
                    };
                    setActiveSegmentIndex(activePointer.segmentIndex);
                    setHoveredSegmentIndex(activePointer.segmentIndex);
                    onCurveEditHoldActivated?.();
                }, curveEditHoldDelayMs);

                activePointerRef.current = {
                    kind: "pending-segment",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    holdTimeoutId,
                };
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            return;
        }

        const point = msegEditorCoordinatesToPoint(
            pointerLocation.localX,
            pointerLocation.localY,
            pointerLocation.bounds.width,
            pointerLocation.bounds.height,
            { orientation },
        );
        msegController.current?.addPoint(point.x, point.y);
        const points = msegController.current?.getState().shape.points ?? [];
        const nextPointIndex = points.findIndex(
            (nextPoint: { x: number; y: number }) =>
                Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                Math.abs(nextPoint.y - point.y) <= 1e-6,
        );

            if (nextPointIndex >= 0) {
            setSelectedPointIndex(nextPointIndex);
        }

        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        curveEditActivationMode,
        curveEditHoldDelayMs,
        msegController,
        msegState,
        onCurveEditHoldActivated,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId || !surfaceRef.current) {
            updateHoveredSegmentIndex(event.clientX, event.clientY);
            return;
        }

        if (activePointer.kind === "curve-drag") {
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            event.preventDefault();
            return;
        }

        if (activePointer.kind === "pending-segment") {
            const movementDistance = Math.hypot(
                event.clientX - activePointer.startClientX,
                event.clientY - activePointer.startClientY,
            );

            if (movementDistance < MSEG_DRAG_THRESHOLD_PX) {
                return;
            }

            clearPendingSegmentTimer(activePointer);
            activePointerRef.current = {
                kind: "curve-drag",
                pointerId: activePointer.pointerId,
                segmentIndex: activePointer.segmentIndex,
            };
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            event.preventDefault();
            return;
        }

        const movementDistance = Math.hypot(
            event.clientX - activePointer.startClientX,
            event.clientY - activePointer.startClientY,
        );

        if (!activePointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        if (!activePointer.moved) {
            activePointerRef.current = {
                ...activePointer,
                moved: true,
            };
        }
        msegController.current?.movePoint(activePointer.pointIndex, point.x, point.y);
        setSelectedPointIndex(activePointer.pointIndex);
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        applyCurveEditFromClientCoordinates,
        clearPendingSegmentTimer,
        msegController,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerLeave = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (activePointerRef.current?.pointerId === event.pointerId) {
            return;
        }

        setHoveredSegmentIndex(-1);
    }, []);

    const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const pointerState = activePointer;
        activePointerRef.current = null;
        setActiveSegmentIndex(-1);

        if (pointerState.kind === "pending-segment") {
            clearPendingSegmentTimer(pointerState);
            if (surfaceRef.current) {
                const bounds = surfaceRef.current.getBoundingClientRect();
                const point = msegEditorCoordinatesToPoint(
                    event.clientX - bounds.left,
                    event.clientY - bounds.top,
                    bounds.width,
                    bounds.height,
                    { orientation },
                );
                msegController.current?.addPoint(point.x, point.y);
                const points = msegController.current?.getState().shape.points ?? [];
                const nextPointIndex = points.findIndex(
                    (nextPoint: { x: number; y: number }) =>
                        Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                        Math.abs(nextPoint.y - point.y) <= 1e-6,
                );

                if (nextPointIndex >= 0) {
                    setSelectedPointIndex(nextPointIndex);
                }
            }
            event.preventDefault();
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            return;
        }

        if (pointerState.kind === "curve-drag") {
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            event.preventDefault();
            return;
        }

        if (!pointerState.moved && pointerState.deleteOnRelease && msegController.current) {
            msegController.current.deletePoint(pointerState.pointIndex);
            const pointCount = msegController.current.getState().shape.points.length;
            setSelectedPointIndex(clamp(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
        }

        setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
        event.preventDefault();
    }, [
        clearPendingSegmentTimer,
        msegController,
        orientation,
        resolvePointerLocation,
        surfaceRef,
    ]);

    return {
        isOpen,
        selectedPointIndex,
        hoveredSegmentIndex,
        activeSegmentIndex,
        openEditor,
        closeEditor,
        handlePointerDown,
        handlePointerMove,
        handlePointerLeave,
        handlePointerUp,
    };
}

function useStableArrowTarget(targetID: string, onArrowStep: (direction: ArrowStepDirection) => void) {
    const onArrowStepRef = useRef(onArrowStep);

    useEffect(() => {
        onArrowStepRef.current = onArrowStep;
    }, [onArrowStep]);

    return useMemo(() => ({
        id: targetID,
        onArrowStep: (direction: ArrowStepDirection) => {
            onArrowStepRef.current(direction);
        },
    }), [targetID]);
}

export function useSynthKeyboardRouting({
    keyboardRef,
    onStepWavetable,
    onStepPlayMode,
    onStepMsegRate,
    onStepGlideTime,
    onKeyboardOctaveDown,
    onKeyboardOctaveUp,
}: {
    keyboardRef: RefObject<SynthKeyboardLike | null>;
    onStepWavetable: (direction: ArrowStepDirection) => void;
    onStepPlayMode: (direction: ArrowStepDirection) => void;
    onStepMsegRate: (direction: ArrowStepDirection) => void;
    onStepGlideTime: (direction: ArrowStepDirection) => void;
    onKeyboardOctaveDown?: () => boolean;
    onKeyboardOctaveUp?: () => boolean;
}): SynthKeyboardRoutingBindings {
    const synthInputRouter = useSynthInputRouter(keyboardRef, {
        handleKeyboardOctaveDown: onKeyboardOctaveDown,
        handleKeyboardOctaveUp: onKeyboardOctaveUp,
    });
    const wavetableTarget = useStableArrowTarget("wavetable-select", onStepWavetable);
    const playModeTarget = useStableArrowTarget("play-mode", onStepPlayMode);
    const msegRateTarget = useStableArrowTarget("mseg-rate", onStepMsegRate);
    const glideTarget = useStableArrowTarget("glide-time", onStepGlideTime);

    return useMemo(() => ({
        wavetableFocusBindings: synthInputRouter.bindArrowTarget(wavetableTarget),
        playModeFocusBindings: synthInputRouter.bindArrowTarget(playModeTarget),
        msegRateFocusBindings: synthInputRouter.bindArrowTarget(msegRateTarget),
        glideFocusTarget: {
            onActivate: () => synthInputRouter.activateArrowTarget(glideTarget),
            onBeginTextEntry: () => synthInputRouter.beginTextEntry(glideTarget),
            onEndTextEntry: () => synthInputRouter.endTextEntry(),
        },
    }), [
        glideTarget,
        msegRateTarget,
        playModeTarget,
        synthInputRouter,
        wavetableTarget,
    ]);
}

export function useSynthPatchViewModel({
    stageRef,
    msegEditorSurfaceRef,
    keyboardRef,
    voiceModeCount,
    msegSurfaceOrientation = "horizontal",
    msegCurveEditActivationMode = "immediate",
    onMsegCurveEditHoldActivated = null,
    onKeyboardOctaveDown,
    onKeyboardOctaveUp,
}: {
    stageRef: RefObject<HTMLDivElement | null>;
    msegEditorSurfaceRef: RefObject<SVGSVGElement | null>;
    keyboardRef: RefObject<SynthKeyboardLike | null>;
    voiceModeCount: number;
    msegSurfaceOrientation?: MsegSurfaceOrientation;
    msegCurveEditActivationMode?: "immediate" | "hold-or-drag";
    onMsegCurveEditHoldActivated?: (() => void) | null;
    onKeyboardOctaveDown?: () => boolean;
    onKeyboardOctaveUp?: () => boolean;
}): SynthPatchViewModel {
    const runtimeStateMessage = usePatchEndpoint<unknown | null>(RUNTIME_STATE_ENDPOINT_ID, null);
    const normalizedRuntimeState = useMemo(
        () => normalizeRuntimeTableState(runtimeStateMessage),
        [runtimeStateMessage],
    );
    const { catalog, error: catalogError } = useFactoryBankCatalog();
    const wavetablePosition = usePatchParameterBinding<number>({
        endpointID: WAVETABLE_POSITION_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clampDisplayPosition(value),
    });
    const wavetableSelect = usePatchParameterBinding<number>({
        endpointID: WAVETABLE_SELECT_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => Math.max(0, Math.trunc(Number(value) || 0)),
    });
    const playMode = usePatchParameterBinding<number>({
        endpointID: PLAY_MODE_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, Math.max(0, voiceModeCount - 1)),
    });
    const glideTime = usePatchParameterBinding<number>({
        endpointID: GLIDE_TIME_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, GLIDE_TIME_MIN_SECONDS, GLIDE_TIME_MAX_SECONDS),
    });
    const pan = usePatchParameterBinding<number>({
        endpointID: PAN_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, -1, 1),
    });
    const warpMode = usePatchParameterBinding<number>({
        endpointID: WARP_MODE_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 4),
    });
    const warpAmount = usePatchParameterBinding<number>({
        endpointID: WARP_AMOUNT_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const filterMode = usePatchParameterBinding<number>({
        endpointID: FILTER_MODE_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 5),
    });
    const filterCutoff = usePatchParameterBinding<number>({
        endpointID: FILTER_CUTOFF_ENDPOINT_ID,
        initialValue: 1000,
        coerce: (value) => clamp(Number(value) || 0, 20, 20_000),
    });
    const filterQ = usePatchParameterBinding<number>({
        endpointID: FILTER_Q_ENDPOINT_ID,
        initialValue: 0.707107,
        coerce: (value) => clamp(Number(value) || 0, 0.1, 20),
    });
    const distortionDriveDb = usePatchParameterBinding<number>({
        endpointID: DISTORTION_DRIVE_DB_ENDPOINT_ID,
        initialValue: 12,
        coerce: (value) => clamp(Number(value) || 0, 0, 36),
    });
    const distortionKnee = usePatchParameterBinding<number>({
        endpointID: DISTORTION_KNEE_ENDPOINT_ID,
        initialValue: 0.35,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const distortionWet = usePatchParameterBinding<number>({
        endpointID: DISTORTION_WET_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const distortionWetHPHz = usePatchParameterBinding<number>({
        endpointID: DISTORTION_WET_HP_HZ_ENDPOINT_ID,
        initialValue: 40,
        coerce: (value) => clamp(Number(value) || 0, 20, 4_000),
    });
    const distortionWetLPHz = usePatchParameterBinding<number>({
        endpointID: DISTORTION_WET_LP_HZ_ENDPOINT_ID,
        initialValue: 18_000,
        coerce: (value) => clamp(Number(value) || 0, 20, 20_000),
    });
    const requestRuntimeSync = usePatchEventTrigger<number>(RUNTIME_SYNC_REQUEST_ENDPOINT_ID);
    const retryDesiredTableLoad = usePatchEventTrigger<number>(RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID);
    const observedPosition = useObservedDisplayPosition(Number(wavetablePosition.value) || 0);
    const observedWarpState = useObservedWarpState({
        warpMode: warpMode.value,
        warpAmount: warpAmount.value,
    });
    const observedFilterState = useObservedFilterState({
        filterMode: filterMode.value,
        filterCutoff: filterCutoff.value,
        filterQ: filterQ.value,
    });
    const observedFilterSpectrum = useObservedFilterSpectrum();
    const observedDistortionScope = useObservedDistortionScope();
    const runtimePresentation = useMemo(
        () => resolveRuntimeTablePresentation(runtimeStateMessage, Number(wavetableSelect.value) || 0),
        [runtimeStateMessage, wavetableSelect.value],
    );
    const presentedTableIndex = runtimePresentation.presentedTableIndex ?? 0;
    const desiredTableIndex = runtimePresentation.desiredTableIndex ?? 0;
    const { frames, error: frameError } = useFactoryTableFrames(presentedTableIndex);
    const { state: modulationState, bridge: modulationBridge } = useModulationState();
    const [selectedMsegSlot, setSelectedMsegSlot] = useState(0);
    const [selectedEnvelopeSlot, setSelectedEnvelopeSlot] = useState(0);
    const displayedMsegControllerRef = useRef<MsegEditorControllerLike | null>(null);
    displayedMsegControllerRef.current = modulationBridge.current?.getMsegSlotController(selectedMsegSlot) ?? null;
    const routes = modulationState?.routes ?? [];
    const msegState = useMemo(() => {
        if (!modulationState || !modulationBridge.current) {
            return null;
        }
        return buildDisplayedMsegState(modulationBridge.current, selectedMsegSlot);
    }, [modulationBridge, modulationState, selectedMsegSlot]);
    const selectedEnvelope = modulationState?.envelopeSlots[selectedEnvelopeSlot] ?? null;
    const stageBindings = useStagePositionDrag({
        stageRef,
        observedPosition,
        binding: wavetablePosition,
    });
    const msegEditor = useMsegEditorInteractions({
        msegState,
        msegController: displayedMsegControllerRef,
        surfaceRef: msegEditorSurfaceRef,
        orientation: msegSurfaceOrientation,
        curveEditActivationMode: msegCurveEditActivationMode,
        onCurveEditHoldActivated: onMsegCurveEditHoldActivated,
    });
    const displayedTable = catalog?.tables?.[presentedTableIndex] ?? null;
    const desiredTable = catalog?.tables?.[desiredTableIndex] ?? displayedTable;
    const displayedFrameCount = displayedTable?.frameCount ?? frames?.length ?? 1;
    const failureDetail = describeRuntimeTableFailureDetails(
        runtimePresentation.isRetryableFailure ? normalizedRuntimeState : null,
        desiredTable?.name ?? "Requested wavetable",
    );
    const topStatus = runtimePresentation.failureMessage
        ?? (runtimePresentation.isPendingSelection && desiredTable ? `Loading ${desiredTable.name}…` : null)
        ?? (catalogError ? "Could not load the factory bank." : null)
        ?? (frameError ? "Could not render the current wavetable." : null)
        ?? "Ready";

    useEffect(() => {
        requestRuntimeSync(1);
    }, [requestRuntimeSync]);

    const handleSelectWavetable = useCallback((nextValue: number) => {
        wavetableSelect.commitValue(nextValue);
    }, [wavetableSelect]);

    const handleStepWavetable = useCallback((direction: ArrowStepDirection) => {
        const maxTableIndex = Math.max(0, (catalog?.tables?.length ?? 1) - 1);
        wavetableSelect.commitValue(clamp(desiredTableIndex + direction, 0, maxTableIndex));
    }, [catalog?.tables?.length, desiredTableIndex, wavetableSelect]);

    const handleRetryLoad = useCallback(() => {
        retryDesiredTableLoad(1);
    }, [retryDesiredTableLoad]);

    const handleSelectMsegSlot = useCallback((slotIndex: number) => {
        setSelectedMsegSlot(clamp(Math.round(slotIndex), 0, 2));
    }, []);

    const handleSelectEnvelopeSlot = useCallback((slotIndex: number) => {
        setSelectedEnvelopeSlot(clamp(Math.round(slotIndex), 0, 2));
    }, []);

    const handleMsegRateChange = useCallback((nextValue: number) => {
        if (!msegState) {
            return;
        }

        displayedMsegControllerRef.current?.setPlayback({
            ...msegState.playback,
            rate: {
                kind: "seconds",
                seconds: nextValue,
            },
        });
    }, [msegState]);

    const handleStepMsegRate = useCallback((direction: ArrowStepDirection) => {
        if (!msegState) {
            return;
        }

        const nextRateSeconds = clampMsegRateSeconds(msegState.playback.rate.seconds + (direction * 0.001));
        displayedMsegControllerRef.current?.setPlayback({
            ...msegState.playback,
            rate: {
                kind: "seconds",
                seconds: nextRateSeconds,
            },
        });
    }, [msegState]);

    const handleToggleMsegLoop = useCallback(() => {
        if (!msegState) {
            return;
        }

        displayedMsegControllerRef.current?.setPlayback({
            ...msegState.playback,
            loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
            noteOffPolicy: "finish_loop",
        });
    }, [msegState]);

    const handleEnvelopeChange = useCallback((
        field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds",
        nextValue: number,
    ) => {
        if (!selectedEnvelope) {
            return;
        }

        const currentEnvelope = modulationBridge.current?.getState().envelopeSlots[selectedEnvelopeSlot]
            ?? selectedEnvelope;

        modulationBridge.current?.setEnvelope(selectedEnvelopeSlot, {
            ...currentEnvelope,
            [field]: nextValue,
        });
    }, [modulationBridge, selectedEnvelope, selectedEnvelopeSlot]);

    const handleAddRoute = useCallback(() => {
        modulationBridge.current?.addRoute(createDefaultRoute());
    }, [modulationBridge]);

    const handleRemoveRoute = useCallback((routeIndex: number) => {
        modulationBridge.current?.removeRoute(routeIndex);
    }, [modulationBridge]);

    const handleRouteChange = useCallback((routeIndex: number, nextRoute: ModulationRoute) => {
        modulationBridge.current?.setRoute(routeIndex, nextRoute);
    }, [modulationBridge]);

    const handleStepPlayMode = useCallback((direction: ArrowStepDirection) => {
        playMode.commitValue(
            clamp(playMode.value + direction, 0, Math.max(0, voiceModeCount - 1)),
        );
    }, [playMode, voiceModeCount]);

    const handleStepGlideTime = useCallback((direction: ArrowStepDirection) => {
        glideTime.commitValue(clamp(
            glideTime.value + (direction * GLIDE_TIME_STEP_SECONDS),
            GLIDE_TIME_MIN_SECONDS,
            GLIDE_TIME_MAX_SECONDS,
        ));
    }, [glideTime]);

    const keyboardRouting = useSynthKeyboardRouting({
        keyboardRef,
        onStepWavetable: handleStepWavetable,
        onStepPlayMode: handleStepPlayMode,
        onStepMsegRate: handleStepMsegRate,
        onStepGlideTime: handleStepGlideTime,
        onKeyboardOctaveDown,
        onKeyboardOctaveUp,
    });

    return {
        frames,
        catalogError,
        frameError,
        observedPosition,
        topStatus,
        failureDetail,
        runtimePresentation,
        displayedTableIndex: presentedTableIndex,
        displayedTableName: displayedTable?.name ?? "Factory bank",
        displayedFrameCount,
        desiredTableIndex,
        desiredTableName: desiredTable?.name ?? displayedTable?.name ?? "Factory bank",
        tableOptions: catalog?.tables ?? [],
        canRetryDesiredTableLoad: runtimePresentation.isRetryableFailure,
        wavetablePosition,
        playMode,
        glideTime,
        pan,
        warpMode,
        warpAmount,
        filterMode,
        filterCutoff,
        filterQ,
        distortionDriveDb,
        distortionKnee,
        distortionWet,
        distortionWetHPHz,
        distortionWetLPHz,
        observedFilterState,
        observedFilterSpectrum,
        observedDistortionScope,
        observedWarpState,
        modulationState,
        selectedMsegSlot,
        selectedEnvelopeSlot,
        selectedEnvelope,
        routes,
        msegState,
        handleSelectMsegSlot,
        handleSelectEnvelopeSlot,
        handleEnvelopeChange,
        handleAddRoute,
        handleRemoveRoute,
        handleRouteChange,
        handleSelectWavetable,
        handleRetryLoad,
        handleMsegRateChange,
        handleToggleMsegLoop,
        stageBindings,
        msegEditor,
        keyboardRouting,
    };
}
