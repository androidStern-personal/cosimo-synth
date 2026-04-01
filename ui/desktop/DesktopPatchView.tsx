import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";

// @ts-expect-error Legacy patch GUI module has no TypeScript declarations yet.
import { loadFactoryBankCatalogFromPatch, loadFactoryBankFramesFromPatch } from "../../patch_gui/wavetable-bank.js";
// @ts-expect-error Legacy patch GUI module has no TypeScript declarations yet.
import { MsegController } from "../../patch_gui/mseg-controller.js";
// @ts-ignore Legacy patch GUI module has no TypeScript declarations yet.
import { MSEG_EDITOR_HORIZONTAL_PADDING_PX, MSEG_EDITOR_VERTICAL_PADDING_PX, MSEG_POINT_RADIUS_PX, MSEG_RATE_MAX_SECONDS, MSEG_RATE_MIN_SECONDS, MSEG_SELECTED_POINT_RADIUS_PX, clampMsegRateSeconds, createMsegEditorMetrics, evaluateMsegShape, findMsegPointHitIndex, msegEditorCoordinatesToPoint, pointToMsegEditorCoordinates } from "../../patch_gui/mseg.js";
// @ts-expect-error Legacy patch GUI module has no TypeScript declarations yet.
import { CanvasWavetableDisplay } from "../../patch_gui/wavetable-display.js";
import {
    PatchConnectionProvider,
    usePatchConnection,
    usePatchEndpoint,
    usePatchParameter,
    usePatchStatus,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import {
    clampDisplayPosition,
    describeRuntimeTableFailureDetails,
    mapDisplayDragToPosition,
    normalizeRuntimeTableState,
    resolveRuntimeTablePresentation,
    selectObservedWavetablePositionState,
} from "../shared/runtime-table-state";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const PLAY_MODE_OPTIONS = [
    { value: 0, label: "Poly" },
    { value: 1, label: "Mono" },
    { value: 2, label: "Legato" },
];
const DISPLAY_SWIPE_THRESHOLD_PX = 2;
const MSEG_EDITOR_SAMPLES = 128;
const MSEG_DRAG_THRESHOLD_PX = 8;

type FactoryTableMeta = {
    name: string;
    sourceWav: string;
    frameCount: number;
};

type FactoryBankCatalog = {
    tables: FactoryTableMeta[];
};

type MsegState = {
    shape: {
        points: Array<{ x: number; y: number; curvePower: number }>;
    };
    playback: {
        rate: {
            seconds: number;
        };
        loop: { startX: number; endX: number } | null;
    };
    depth: number;
};

type ActiveMsegPointerState = {
    pointerId: number;
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    deleteOnRelease: boolean;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatSeconds(seconds: number) {
    return `${seconds.toFixed(3)} s`;
}

function formatFrameIndex(position: number, frameCount: number) {
    const safeFrameCount = Math.max(1, frameCount);
    const frameIndex = Math.round(position * Math.max(0, safeFrameCount - 1)) + 1;
    return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}

function useResizeObserver<TElement extends Element>(ref: RefObject<TElement | null>) {
    const [size, setSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const update = () => {
            const bounds = element.getBoundingClientRect();
            const host = element as unknown as HTMLElement;
            setSize({
                width: Math.max(1, bounds.width || host.clientWidth || 1),
                height: Math.max(1, bounds.height || host.clientHeight || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => observer.disconnect();
    }, [ref]);

    return size;
}

function useFactoryBankCatalog() {
    const patchConnection = usePatchConnection();
    const [catalog, setCatalog] = useState<FactoryBankCatalog | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadFactoryBankCatalogFromPatch(patchConnection)
            .then((nextCatalog: FactoryBankCatalog) => {
                if (!cancelled) {
                    setCatalog(nextCatalog);
                    setError(null);
                }
            })
            .catch((nextError: unknown) => {
                const error = nextError as { stack?: string; message?: string } | null;
                if (!cancelled) {
                    setCatalog(null);
                    setError(error?.stack || error?.message || String(nextError));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [patchConnection]);

    return { catalog, error };
}

function useFactoryTableFrames(tableIndex: number) {
    const patchConnection = usePatchConnection();
    const [frames, setFrames] = useState<Float32Array[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadFactoryBankFramesFromPatch(patchConnection, { tableIndex })
            .then((nextFrames: { frames: Float32Array[] }) => {
                if (!cancelled) {
                    setFrames(nextFrames.frames);
                    setError(null);
                }
            })
            .catch((nextError: unknown) => {
                const error = nextError as { stack?: string; message?: string } | null;
                if (!cancelled) {
                    setFrames(null);
                    setError(error?.stack || error?.message || String(nextError));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [patchConnection, tableIndex]);

    return { frames, error };
}

function useObservedDisplayPosition(parameterPosition: number) {
    const message = usePatchEndpoint<unknown | null>(effectiveWavetablePositionEndpointID, null);
    const [observedState, setObservedState] = useState(() => ({
        voiceGeneration: -1,
        position: parameterPosition,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedWavetablePositionState(previousState, message));
    }, [message]);

    return message ? observedState.position : parameterPosition;
}

function useMsegState() {
    const patchConnection = usePatchConnection();
    const [state, setState] = useState<MsegState | null>(null);
    const controllerRef = useRef<MsegController | null>(null);

    useEffect(() => {
        const controller = new MsegController(patchConnection, {
            onStateChange: (nextState: unknown) => setState(nextState as MsegState),
        });
        controllerRef.current = controller;
        controller.attach();
        controller.requestBootState();

        return () => {
            controller.detach();
            controllerRef.current = null;
        };
    }, [patchConnection]);

    return {
        state,
        controller: controllerRef,
    };
}

function createKeyboardTagName() {
    return "cosimo-react-desktop-keyboard";
}

function ensureKeyboardElement(patchConnection: PatchConnectionLike) {
    const tagName = createKeyboardTagName();

    if (!patchConnection.utilities?.PianoKeyboard) {
        return null;
    }

    if (!window.customElements.get(tagName)) {
        const BaseKeyboard = patchConnection.utilities.PianoKeyboard;

        class CosimoDesktopKeyboard extends BaseKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: 22,
                    accidentalWidth: 13,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }

            bindRenderedTouchHandlers() {}

            refreshActiveNoteElements() {}
        }

        window.customElements.define(tagName, CosimoDesktopKeyboard);
    }

    return tagName;
}

function KeyboardDock() {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const tagName = ensureKeyboardElement(patchConnection);
        const host = hostRef.current;

        if (!tagName || !host) {
            return;
        }

        const keyboard = document.createElement(tagName) as HTMLElement & {
            attachToPatchConnection?: (connection: PatchConnectionLike, endpointID: string) => void;
            detachPatchConnection?: (connection: PatchConnectionLike) => void;
        };
        keyboard.setAttribute("root-note", "36");
        keyboard.setAttribute("note-count", "25");
        keyboard.attachToPatchConnection?.(patchConnection, midiInputEndpointID);
        host.replaceChildren(keyboard);

        return () => {
            keyboard.detachPatchConnection?.(patchConnection);
            host.replaceChildren();
        };
    }, [patchConnection]);

    return (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-3 shadow-[0_18px_42px_rgba(3,6,18,0.45)]">
            <div ref={hostRef} className="h-[128px] w-full overflow-hidden rounded-[22px] bg-[#070b16]" />
        </div>
    );
}

function WavetableCanvas({
    frames,
    position,
}: {
    frames: Float32Array[] | null;
    position: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const displayRef = useRef<CanvasWavetableDisplay | null>(null);

    useLayoutEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        displayRef.current = new CanvasWavetableDisplay(canvasRef.current);
        return () => {
            displayRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!displayRef.current || !frames) {
            return;
        }

        displayRef.current.setFrames(frames);
    }, [frames]);

    useEffect(() => {
        displayRef.current?.setPosition(position);
    }, [position]);

    useEffect(() => {
        displayRef.current?.resize(size.width, size.height, window.devicePixelRatio || 1);
    }, [size]);

    return (
        <div ref={viewportRef} className="absolute inset-0">
            <canvas ref={canvasRef} className="h-full w-full" />
        </div>
    );
}

function buildMsegSurfacePaths(
    points: Array<{ x: number; y: number; curvePower: number }>,
    width: number,
    height: number,
) {
    const metrics = createMsegEditorMetrics(width, height, {
        horizontalPadding: MSEG_EDITOR_HORIZONTAL_PADDING_PX,
        verticalPadding: MSEG_EDITOR_VERTICAL_PADDING_PX,
    });
    let path = "";

    for (let index = 0; index < MSEG_EDITOR_SAMPLES; index += 1) {
        const x = index / (MSEG_EDITOR_SAMPLES - 1);
        const y = evaluateMsegShape({ points }, x);
        const coordinates = pointToMsegEditorCoordinates({ x, y }, width, height);
        path += `${index === 0 ? "M" : "L"} ${coordinates.x.toFixed(3)} ${coordinates.y.toFixed(3)} `;
    }

    const curvePath = path.trim();
    const fillPath = `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
        `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`;

    return { curvePath, fillPath };
}

function MsegPreview({
    points,
}: {
    points: Array<{ x: number; y: number; curvePower: number }>;
}) {
    const viewportRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);

    const { curvePath, fillPath } = useMemo(() => {
        return buildMsegSurfacePaths(points, size.width, size.height);
    }, [points, size.height, size.width]);

    return (
        <svg ref={viewportRef} className="h-32 w-full overflow-hidden rounded-[20px] bg-white/[0.03]" viewBox={`0 0 ${size.width} ${size.height}`}>
            <g>
                {[0.25, 0.5, 0.75].map((step) => (
                    <line
                        key={`h-${step}`}
                        className="cosimo-grid-line"
                        x1={0}
                        y1={size.height * (1 - step)}
                        x2={size.width}
                        y2={size.height * (1 - step)}
                    />
                ))}
                {[0.25, 0.5, 0.75].map((step) => (
                    <line
                        key={`v-${step}`}
                        className="cosimo-grid-line"
                        x1={size.width * step}
                        y1={0}
                        x2={size.width * step}
                        y2={size.height}
                    />
                ))}
            </g>
            <path className="cosimo-curve-fill" d={fillPath} />
            <path className="cosimo-curve-line" d={curvePath} />
        </svg>
    );
}

function EditableMsegSurface({
    surfaceRef,
    points,
    selectedPointIndex,
    onPointerDown,
    onPointerMove,
    onPointerUp,
}: {
    surfaceRef: RefObject<SVGSVGElement | null>;
    points: Array<{ x: number; y: number; curvePower: number }>;
    selectedPointIndex: number;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
}) {
    const size = useResizeObserver(surfaceRef);

    const { curvePath, fillPath } = useMemo(() => {
        return buildMsegSurfacePaths(points, size.width, size.height);
    }, [points, size.height, size.width]);

    return (
        <svg
            ref={surfaceRef}
            className="h-[320px] w-full touch-none overflow-hidden rounded-[20px] bg-white/[0.03]"
            viewBox={`0 0 ${size.width} ${size.height}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <g>
                {[0.25, 0.5, 0.75].map((step) => (
                    <line
                        key={`editable-h-${step}`}
                        className="cosimo-grid-line"
                        x1={0}
                        y1={size.height * (1 - step)}
                        x2={size.width}
                        y2={size.height * (1 - step)}
                    />
                ))}
                {[0.25, 0.5, 0.75].map((step) => (
                    <line
                        key={`editable-v-${step}`}
                        className="cosimo-grid-line"
                        x1={size.width * step}
                        y1={0}
                        x2={size.width * step}
                        y2={size.height}
                    />
                ))}
            </g>
            <path className="cosimo-curve-fill" d={fillPath} />
            <path className="cosimo-curve-line" d={curvePath} />
            <g>
                {points.map((point, pointIndex) => {
                    const coordinates = pointToMsegEditorCoordinates(point, size.width, size.height);
                    const isSelected = pointIndex === selectedPointIndex;

                    return (
                        <circle
                            key={`point-${pointIndex}-${point.x}-${point.y}`}
                            cx={coordinates.x}
                            cy={coordinates.y}
                            r={isSelected ? MSEG_SELECTED_POINT_RADIUS_PX : MSEG_POINT_RADIUS_PX}
                            className={isSelected ? "fill-fuchsia-200 stroke-[#050913] stroke-[3px]" : "fill-cyan-200 stroke-[#050913] stroke-[2px]"}
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </g>
        </svg>
    );
}

function commitDiscreteParameter(
    binding: {
        setValue: (nextValue: unknown) => void;
        beginGesture: () => void;
        endGesture: () => void;
    },
    nextValue: unknown,
) {
    binding.beginGesture();
    binding.setValue(nextValue);
    binding.endGesture();
}

function DesktopPatchViewBody() {
    const patchConnection = usePatchConnection();
    const status = usePatchStatus<Record<string, unknown> | null>(null);
    const runtimeStateMessage = usePatchEndpoint<unknown | null>(runtimeStateEndpointID, null);
    const normalizedRuntimeState = useMemo(
        () => normalizeRuntimeTableState(runtimeStateMessage),
        [runtimeStateMessage],
    );
    const { catalog, error: catalogError } = useFactoryBankCatalog();
    const wavetablePosition = usePatchParameter(wavetablePositionEndpointID, 0);
    const wavetableSelect = usePatchParameter(wavetableSelectEndpointID, 0);
    const playMode = usePatchParameter(playModeEndpointID, 0);
    const glideTime = usePatchParameter(glideTimeEndpointID, 0);
    const observedPosition = useObservedDisplayPosition(Number(wavetablePosition.value) || 0);
    const runtimePresentation = useMemo(
        () => resolveRuntimeTablePresentation(runtimeStateMessage, Number(wavetableSelect.value) || 0),
        [runtimeStateMessage, wavetableSelect.value],
    );
    const presentedTableIndex = runtimePresentation.presentedTableIndex ?? 0;
    const desiredTableIndex = runtimePresentation.desiredTableIndex ?? 0;
    const { frames, error: frameError } = useFactoryTableFrames(presentedTableIndex);
    const [activeDisplayDrag, setActiveDisplayDrag] = useState<{
        pointerId: number;
        startPosition: number;
        startClientY: number;
    } | null>(null);
    const [isMsegEditorOpen, setIsMsegEditorOpen] = useState(false);
    const [selectedMsegPointIndex, setSelectedMsegPointIndex] = useState(0);
    const [activeMsegPointer, setActiveMsegPointer] = useState<ActiveMsegPointerState | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const { state: msegState, controller: msegController } = useMsegState();

    const displayedTable = catalog?.tables?.[presentedTableIndex] ?? null;
    const desiredTable = catalog?.tables?.[desiredTableIndex] ?? displayedTable;
    const failureDetail = describeRuntimeTableFailureDetails(
        runtimePresentation.isRetryableFailure ? normalizedRuntimeState : null,
        desiredTable?.name ?? "Requested wavetable",
    );
    const topStatus = runtimePresentation.failureMessage
        ?? (runtimePresentation.isPendingSelection && desiredTable ? `Loading ${desiredTable.name}…` : null)
        ?? (catalogError ? "Could not load the factory bank." : null)
        ?? (frameError ? "Could not render the current wavetable." : null)
        ?? (status?.manifest && typeof status.manifest === "object" ? "Desktop React preview" : "Ready");

    useEffect(() => {
        patchConnection.sendEventOrValue?.(runtimeSyncRequestEndpointID, 1);
    }, [patchConnection]);

    useEffect(() => {
        if (!msegState) {
            return;
        }

        setSelectedMsegPointIndex((previousIndex) => clamp(
            previousIndex,
            0,
            Math.max(0, msegState.shape.points.length - 1),
        ));
    }, [msegState]);

    useEffect(() => {
        if (!isMsegEditorOpen) {
            setActiveMsegPointer(null);
            return;
        }

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMsegEditorOpen(false);
            }
        };

        window.addEventListener("keydown", handleEscapeKey);
        return () => {
            window.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isMsegEditorOpen]);

    const beginPositionGesture = useCallback(() => {
        wavetablePosition.beginGesture();
    }, [wavetablePosition]);

    const endPositionGesture = useCallback(() => {
        wavetablePosition.endGesture();
    }, [wavetablePosition]);

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
        wavetablePosition.setValue(nextPosition);
    }, [activeDisplayDrag, wavetablePosition]);

    const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setActiveDisplayDrag(null);
        endPositionGesture();
    }, [activeDisplayDrag, endPositionGesture]);

    const handleOpenMsegEditor = useCallback(() => {
        setIsMsegEditorOpen(true);
    }, []);

    const handleCloseMsegEditor = useCallback(() => {
        setIsMsegEditorOpen(false);
        setActiveMsegPointer(null);
    }, []);

    const handleMsegPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || !msegState || !msegEditorSurfaceRef.current) {
            return;
        }

        const bounds = msegEditorSurfaceRef.current.getBoundingClientRect();
        const targetPointIndex = findMsegPointHitIndex(
            msegState.shape,
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
        );

        if (targetPointIndex >= 0) {
            setSelectedMsegPointIndex(targetPointIndex);
            setActiveMsegPointer({
                pointerId: event.pointerId,
                pointIndex: targetPointIndex,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
                deleteOnRelease: targetPointIndex > 0 && targetPointIndex < msegState.shape.points.length - 1,
            });
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            return;
        }

        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
        );
        msegController.current?.addPoint(point.x, point.y);
        const points = msegController.current?.getState().shape.points ?? [];
        const nextPointIndex = points.findIndex(
            (nextPoint: { x: number; y: number }) =>
                Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                Math.abs(nextPoint.y - point.y) <= 1e-6,
        );
        if (nextPointIndex >= 0) {
            setSelectedMsegPointIndex(nextPointIndex);
        }
        event.preventDefault();
    }, [msegController, msegState]);

    const handleMsegPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (!activeMsegPointer || activeMsegPointer.pointerId !== event.pointerId || !msegEditorSurfaceRef.current) {
            return;
        }

        const movementDistance = Math.hypot(
            event.clientX - activeMsegPointer.startClientX,
            event.clientY - activeMsegPointer.startClientY,
        );

        if (!activeMsegPointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
            return;
        }

        const bounds = msegEditorSurfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
        );
        setActiveMsegPointer((previousPointer) => previousPointer
            ? { ...previousPointer, moved: true }
            : previousPointer);
        msegController.current?.movePoint(activeMsegPointer.pointIndex, point.x, point.y);
        setSelectedMsegPointIndex(activeMsegPointer.pointIndex);
        event.preventDefault();
    }, [activeMsegPointer, msegController]);

    const handleMsegPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (!activeMsegPointer || activeMsegPointer.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const pointerState = activeMsegPointer;
        setActiveMsegPointer(null);

        if (!pointerState.moved && pointerState.deleteOnRelease && msegController.current) {
            msegController.current.deletePoint(pointerState.pointIndex);
            const pointCount = msegController.current.getState().shape.points.length;
            setSelectedMsegPointIndex(clamp(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
        }

        event.preventDefault();
    }, [activeMsegPointer, msegController]);

    return (
        <div className="cosimo-surface relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[28px] border border-white/8 p-6 text-slate-100 shadow-[0_26px_80px_rgba(0,0,0,0.48)]">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-blue-300/70">Cosimo Synth</div>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-amber-100">Desktop Editor</h1>
                </div>
                <div className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-right text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/80">
                    {topStatus}
                </div>
            </header>

            <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-5">
                <section
                    ref={stageRef}
                    className="cosimo-stage relative overflow-hidden rounded-[28px] border border-white/8"
                    onPointerDown={handleStagePointerDown}
                    onPointerMove={handleStagePointerMove}
                    onPointerUp={handleStagePointerUp}
                    onPointerCancel={handleStagePointerUp}
                >
                    <WavetableCanvas frames={frames} position={observedPosition} />

                    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-5 text-[11px] uppercase tracking-[0.16em] text-slate-300/70">
                        <div className="rounded-full border border-white/8 bg-black/20 px-3 py-2">
                            {displayedTable?.name ?? "Factory bank"}
                        </div>
                        <div className="rounded-full border border-white/8 bg-black/20 px-3 py-2 text-cyan-200/80">
                            {formatFrameIndex(observedPosition, displayedTable?.frameCount ?? frames?.length ?? 1)}
                        </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-5">
                        <label className="grid gap-2">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Wavetable</span>
                            <select
                                className="cosimo-select h-12 rounded-2xl px-4"
                                value={String(desiredTableIndex)}
                                onChange={(event) => commitDiscreteParameter(wavetableSelect, Number(event.target.value))}
                                aria-label="Select wavetable"
                            >
                                {(catalog?.tables ?? []).map((table, tableIndex) => (
                                    <option key={`${table.name}-${tableIndex}`} value={tableIndex}>
                                        {table.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="flex flex-col items-end gap-2">
                            <div className="rounded-full border border-white/8 bg-black/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                                Position {clampDisplayPosition(observedPosition).toFixed(3)}
                            </div>
                            <button
                                type="button"
                                className="cosimo-button h-12 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40"
                                disabled={!runtimePresentation.isRetryableFailure}
                                onClick={() => patchConnection.sendEventOrValue?.(retryDesiredTableRequestEndpointID, 1)}
                            >
                                Retry Load
                            </button>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">Frame Scan</div>
                            <div className="mt-1 text-sm text-slate-300/70">Drag inside the stage or use the slider for precise frame control.</div>
                        </div>
                        <div className="rounded-full bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                            {formatFrameIndex(observedPosition, displayedTable?.frameCount ?? frames?.length ?? 1)}
                        </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-4">
                        <input
                            className="cosimo-range"
                            type="range"
                            min="0"
                            max="1"
                            step="0.001"
                            value={clampDisplayPosition(wavetablePosition.value).toFixed(3)}
                            aria-label="Wavetable position"
                            onPointerDown={beginPositionGesture}
                            onPointerUp={endPositionGesture}
                            onChange={(event) => wavetablePosition.setValue(Number(event.target.value))}
                        />
                        <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">{clampDisplayPosition(observedPosition).toFixed(3)}</div>
                    </div>

                    {failureDetail ? (
                        <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                            {failureDetail}
                        </div>
                    ) : null}
                </section>

                <section className="grid min-h-0 grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] gap-5">
                    <div className="grid gap-5">
                        <div className="grid gap-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">Voice + Glide</div>
                            <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
                                <label className="grid gap-2">
                                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Voice Mode</span>
                                    <select
                                        className="cosimo-select h-12 rounded-2xl px-4"
                                        value={String(Math.round(Number(playMode.value) || 0))}
                                        onChange={(event) => commitDiscreteParameter(playMode, Number(event.target.value))}
                                    >
                                        {PLAY_MODE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Glide Time</span>
                                    <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4">
                                        <input
                                            className="cosimo-range"
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.001"
                                            value={clamp(Number(glideTime.value) || 0, 0, 2).toFixed(3)}
                                            onPointerDown={glideTime.beginGesture}
                                            onPointerUp={glideTime.endGesture}
                                            onPointerCancel={glideTime.endGesture}
                                            onChange={(event) => glideTime.setValue(Number(event.target.value))}
                                        />
                                        <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">
                                            {formatSeconds(clamp(Number(glideTime.value) || 0, 0, 2))}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <KeyboardDock />
                    </div>

                    <div className="grid gap-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">MSEG</div>
                                <div className="mt-1 text-sm text-slate-300/70">Depth, rate, loop, and full point editing now run inside the new desktop shell.</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                                    {msegState ? formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds)) : "0.000 s"}
                                </div>
                                <button
                                    type="button"
                                    className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                    onClick={handleOpenMsegEditor}
                                >
                                    Open Editor
                                </button>
                            </div>
                        </div>

                        {msegState ? (
                            <>
                                <MsegPreview points={msegState.shape.points} />
                                <div className="grid gap-4">
                                    <label className="grid gap-2">
                                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Depth</span>
                                        <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4">
                                            <input
                                                className="cosimo-range"
                                                type="range"
                                                min="-1"
                                                max="1"
                                                step="0.001"
                                                value={Number(msegState.depth).toFixed(3)}
                                                onChange={(event) => msegController.current?.setDepth(Number(event.target.value))}
                                            />
                                            <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">
                                                {Number(msegState.depth).toFixed(3)}
                                            </div>
                                        </div>
                                    </label>

                                    <label className="grid gap-2">
                                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Rate</span>
                                        <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4">
                                            <input
                                                className="cosimo-range"
                                                type="range"
                                                min={MSEG_RATE_MIN_SECONDS}
                                                max={MSEG_RATE_MAX_SECONDS}
                                                step="0.001"
                                                value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                                                onChange={(event) => {
                                                    if (!msegState) {
                                                        return;
                                                    }

                                                    msegController.current?.setPlayback({
                                                        ...msegState.playback,
                                                        rate: {
                                                            kind: "seconds",
                                                            seconds: Number(event.target.value),
                                                        },
                                                    });
                                                }}
                                            />
                                            <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">
                                                {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                                            </div>
                                        </div>
                                    </label>

                                    <button
                                        type="button"
                                        className="cosimo-button h-12 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                        onClick={() => {
                                            if (!msegState) {
                                                return;
                                            }

                                            msegController.current?.setPlayback({
                                                ...msegState.playback,
                                                loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
                                                noteOffPolicy: "finish_loop",
                                            });
                                        }}
                                    >
                                        {msegState.playback.loop ? "Looping" : "One Shot"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-slate-300/70">
                                Loading MSEG state…
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {isMsegEditorOpen && msegState ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#030711]/85 p-6 backdrop-blur-md">
                    <div className="grid h-full w-full max-w-[1080px] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 rounded-[28px] border border-white/10 bg-[#09101d]/95 p-6 shadow-[0_36px_80px_rgba(0,0,0,0.5)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">MSEG 1</div>
                                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-amber-100">Fixed Wavetable Route</div>
                                <div className="mt-2 text-sm text-slate-300/70">Drag a point to move it. Click an empty spot to add a point. Click an interior point without dragging to delete it.</div>
                            </div>
                            <button
                                type="button"
                                className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                onClick={handleCloseMsegEditor}
                            >
                                Done
                            </button>
                        </div>

                        <EditableMsegSurface
                            surfaceRef={msegEditorSurfaceRef}
                            points={msegState.shape.points}
                            selectedPointIndex={selectedMsegPointIndex}
                            onPointerDown={handleMsegPointerDown}
                            onPointerMove={handleMsegPointerMove}
                            onPointerUp={handleMsegPointerUp}
                        />

                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                            <label className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Time In Seconds</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    min={MSEG_RATE_MIN_SECONDS}
                                    max={MSEG_RATE_MAX_SECONDS}
                                    step="0.001"
                                    value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                                    onChange={(event) => {
                                        msegController.current?.setPlayback({
                                            ...msegState.playback,
                                            rate: {
                                                kind: "seconds",
                                                seconds: Number(event.target.value),
                                            },
                                        });
                                    }}
                                />
                            </label>

                            <div className="flex items-center gap-3">
                                <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                                    {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                                </div>
                                <button
                                    type="button"
                                    className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                    onClick={() => {
                                        msegController.current?.setPlayback({
                                            ...msegState.playback,
                                            loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
                                            noteOffPolicy: "finish_loop",
                                        });
                                    }}
                                >
                                    {msegState.playback.loop ? "Looping" : "One Shot"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function DesktopPatchView({ patchConnection }: { patchConnection: PatchConnectionLike }) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection}>
            <DesktopPatchViewBody />
        </PatchConnectionProvider>
    );
}
