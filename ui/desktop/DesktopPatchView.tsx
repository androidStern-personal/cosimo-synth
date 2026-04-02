import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    type RefObject,
} from "react";
import Nexus from "nexusui";
import {
    PatchConnectionProvider,
    usePatchConnection,
    usePatchEndpoint,
    useResourceClient,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import type { ResourceClient } from "../shared/resource-client";
import {
    usePatchEventTrigger,
    usePatchParameterBinding,
    type PatchControlBinding,
} from "../shared/patch-controls";
import {
    useSynthInputRouter,
    type SynthFocusBindings,
} from "../shared/synth-input-router";
import {
    clampDisplayPosition,
    describeRuntimeTableFailureDetails,
    mapDisplayDragToPosition,
    normalizeRuntimeTableState,
    resolveRuntimeTablePresentation,
    selectObservedWavetablePositionState,
} from "../shared/runtime-table-state";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    MSEG_SELECTED_POINT_RADIUS_PX,
    clampMsegRateSeconds,
    createMsegEditorMetrics,
    evaluateMsegShape,
    findMsegPointHitIndex,
    msegEditorCoordinatesToPoint,
    pointToMsegEditorCoordinates,
    type MsegState,
} from "../shared/mseg";
import { MsegController } from "../shared/mseg-controller";
import {
    loadFactoryBankCatalog,
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFrames,
    loadFactoryBankFramesFromPatch,
    type FactoryBankCatalog,
} from "../shared/wavetable-bank";
import { CanvasWavetableDisplay } from "../shared/wavetable-display";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const KEYBOARD_NOTE_COUNT = 25;
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const GLIDE_TIME_MIN_SECONDS = 0;
const GLIDE_TIME_MAX_SECONDS = 2;
const GLIDE_TIME_STEP_SECONDS = 0.001;
const PLAY_MODE_OPTIONS = [
    { value: 0, label: "Poly" },
    { value: 1, label: "Mono" },
    { value: 2, label: "Legato" },
];
const DISPLAY_SWIPE_THRESHOLD_PX = 2;
const MSEG_EDITOR_SAMPLES = 128;
const MSEG_DRAG_THRESHOLD_PX = 8;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
const MSEG_PREVIEW_VERTICAL_PADDING_PX = 22;
const MSEG_GRID_STEPS = [0.25, 0.5, 0.75] as const;

type ActiveMsegPointerState = {
    pointerId: number;
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    deleteOnRelease: boolean;
};

type PianoKeyboardElement = HTMLElement & {
    root: ShadowRoot;
    notes: unknown[];
    naturalWidth: number;
    accidentalWidth: number;
    handleKey: (event: KeyboardEvent, isDown: boolean) => void;
    allNotesOff: () => void;
    refreshHTML: () => void;
    refreshActiveNoteElements: () => void;
    attachToPatchConnection?: (connection: PatchConnectionLike, endpointID: string) => void;
    detachPatchConnection?: (connection: PatchConnectionLike) => void;
};

type FactoryTableOption = FactoryBankCatalog["tables"][number];

type CatalogLoadState = {
    catalog: FactoryBankCatalog | null;
    error: string | null;
};

type FrameLoadState = {
    frames: Float32Array[] | null;
    error: string | null;
};

type RangeFieldProps = {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    displayValue: string;
    onChange: (nextValue: number) => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    onPointerCancel?: () => void;
    ariaLabel?: string;
    focusBindings?: SynthFocusBindings;
};

type HeaderProps = {
    statusText: string;
};

type WavetableStageSectionProps = {
    stageRef: RefObject<HTMLDivElement | null>;
    frames: Float32Array[] | null;
    position: number;
    tableName: string;
    frameCount: number;
    desiredTableIndex: number;
    tableOptions: FactoryTableOption[];
    canRetry: boolean;
    onTableChange: (nextValue: number) => void;
    onRetry: () => void;
    tableFocusBindings: SynthFocusBindings;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type VoiceGlideSectionProps = {
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
};

type NexusNumberFieldProps = {
    label: string;
    binding: PatchControlBinding<number>;
    min: number;
    max: number;
    step: number;
    decimalPlaces?: number;
    onActivate?: () => void;
    onBeginTextEntry?: () => void;
    onEndTextEntry?: () => void;
};

type MsegOverviewSectionProps = {
    msegState: MsegState | null;
    onOpenEditor: () => void;
    onDepthChange: (nextValue: number) => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    depthFocusBindings: SynthFocusBindings;
    rateFocusBindings: SynthFocusBindings;
    className?: string;
};

type MsegEditorModalProps = {
    isOpen: boolean;
    msegState: MsegState | null;
    surfaceRef: RefObject<SVGSVGElement | null>;
    selectedPointIndex: number;
    onClose: () => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    rateFocusBindings: SynthFocusBindings;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function describeErrorMessage(error: unknown) {
    if (error && typeof error === "object") {
        const maybeError = error as { stack?: string; message?: string };
        return maybeError.stack || maybeError.message || String(error);
    }

    return String(error);
}

function formatSeconds(seconds: number) {
    return `${seconds.toFixed(3)} s`;
}

function formatFrameIndex(position: number, frameCount: number) {
    const safeFrameCount = Math.max(1, frameCount);
    const frameIndex = Math.round(position * Math.max(0, safeFrameCount - 1)) + 1;
    return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}

function formatKeyboardRootLabel(rootNote: number) {
    const octave = Math.floor(rootNote / 12) - 1;
    return `C${octave}`;
}

function getPitchClass(noteNumber: number) {
    const safeNoteNumber = Math.round(Number(noteNumber) || 0);
    return ((safeNoteNumber % 12) + 12) % 12;
}

function isNaturalNoteNumber(noteNumber: number) {
    const pitchClass = getPitchClass(noteNumber);

    return pitchClass === 0 ||
        pitchClass === 2 ||
        pitchClass === 4 ||
        pitchClass === 5 ||
        pitchClass === 7 ||
        pitchClass === 9 ||
        pitchClass === 11;
}

function countNaturalNotesInRange(rootNote: number, noteCount: number) {
    const safeRootNote = Math.round(Number(rootNote) || 0);
    const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
    let naturalCount = 0;

    for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
        if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
            naturalCount += 1;
        }
    }

    return Math.max(1, naturalCount);
}

function computeKeyboardDimensions(rootNote: number, noteCount: number, availableWidth: number) {
    const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
    const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
    const naturalWidth = Math.max(18, (safeAvailableWidth - 1) / naturalCount);
    const accidentalWidth = Math.max(8, naturalWidth * 0.58);

    return {
        naturalWidth,
        accidentalWidth,
    };
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

function useFactoryBankCatalog(): CatalogLoadState {
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

function useFactoryTableFrames(tableIndex: number): FrameLoadState {
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
            onStateChange: setState,
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
        const BaseKeyboard = patchConnection.utilities.PianoKeyboard as unknown as {
            new (options: {
                naturalNoteWidth: number;
                accidentalWidth: number;
                accidentalPercentageHeight: number;
                pressedNoteColour: string;
            }): PianoKeyboardElement;
        };

        class CosimoDesktopKeyboard extends BaseKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: 22,
                    accidentalWidth: 13,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }
        }

        window.customElements.define(tagName, CosimoDesktopKeyboard);
    }

    return tagName;
}

function KeyboardDock({
    rootNote,
    noteCount = KEYBOARD_NOTE_COUNT,
    keyboardRef,
}: {
    rootNote: number;
    noteCount?: number;
    keyboardRef: RefObject<PianoKeyboardElement | null>;
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const hostSize = useResizeObserver(hostRef);

    useEffect(() => {
        const tagName = ensureKeyboardElement(patchConnection);
        const host = hostRef.current;

        if (!tagName || !host) {
            return;
        }

        const KeyboardElement = window.customElements.get(tagName);

        if (!KeyboardElement) {
            return;
        }

        const keyboard = new KeyboardElement() as PianoKeyboardElement;
        keyboard.classList.add("keyboard");
        keyboard.style.display = "block";
        keyboard.style.width = "100%";
        keyboard.style.height = "100%";
        keyboard.tabIndex = 0;
        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
        keyboard.refreshHTML();
        keyboard.attachToPatchConnection?.(patchConnection, midiInputEndpointID);
        keyboard.refreshActiveNoteElements?.();
        keyboardRef.current = keyboard;
        host.replaceChildren(keyboard);

        return () => {
            keyboard.detachPatchConnection?.(patchConnection);
            keyboardRef.current = null;
            host.replaceChildren();
        };
    }, [noteCount, patchConnection, rootNote]);

    useEffect(() => {
        const keyboard = keyboardRef.current;

        if (!keyboard) {
            return;
        }

        const currentRootNote = Number(keyboard.getAttribute("root-note")) || KEYBOARD_ROOT_NOTE_DEFAULT;
        const currentNoteCount = Number(keyboard.getAttribute("note-count")) || KEYBOARD_NOTE_COUNT;

        if (currentRootNote === rootNote && currentNoteCount === noteCount) {
            return;
        }

        keyboard.setAttribute("root-note", String(rootNote));
        keyboard.setAttribute("note-count", String(noteCount));
        keyboard.notes = [];
        keyboard.refreshHTML();
        keyboard.refreshActiveNoteElements();
    }, [noteCount, rootNote]);

    useEffect(() => {
        const keyboard = keyboardRef.current;
        const host = hostRef.current;

        if (!keyboard || !host || hostSize.width <= 0) {
            return;
        }

        const { naturalWidth, accidentalWidth } = computeKeyboardDimensions(rootNote, noteCount, hostSize.width);
        const currentNaturalWidth = Number(keyboard.naturalWidth) || 0;
        const currentAccidentalWidth = Number(keyboard.accidentalWidth) || 0;

        if (
            Math.abs(currentNaturalWidth - naturalWidth) < 0.01 &&
            Math.abs(currentAccidentalWidth - accidentalWidth) < 0.01
        ) {
            return;
        }

        keyboard.naturalWidth = naturalWidth;
        keyboard.accidentalWidth = accidentalWidth;
        keyboard.notes = [];
        keyboard.refreshHTML();
        keyboard.refreshActiveNoteElements();
    }, [hostSize.width, noteCount, rootNote]);

    return (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-3 shadow-[0_18px_42px_rgba(3,6,18,0.45)]">
            <div ref={hostRef} className="h-[118px] w-full overflow-hidden rounded-[22px] bg-[#070b16]" />
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
    options: {
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    const metrics = createMsegEditorMetrics(width, height, {
        pointRadius: options.pointRadius,
        horizontalPadding: options.horizontalPadding ?? MSEG_EDITOR_HORIZONTAL_PADDING_PX,
        verticalPadding: options.verticalPadding ?? MSEG_EDITOR_VERTICAL_PADDING_PX,
    });
    let path = "";

    for (let index = 0; index < MSEG_EDITOR_SAMPLES; index += 1) {
        const x = index / (MSEG_EDITOR_SAMPLES - 1);
        const y = evaluateMsegShape({ points }, x);
        const coordinates = pointToMsegEditorCoordinates({ x, y }, width, height, {
            pointRadius: options.pointRadius,
            horizontalPadding: options.horizontalPadding,
            verticalPadding: options.verticalPadding,
        });
        path += `${index === 0 ? "M" : "L"} ${coordinates.x.toFixed(3)} ${coordinates.y.toFixed(3)} `;
    }

    const curvePath = path.trim();
    const fillPath = `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
        `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`;

    return { curvePath, fillPath, metrics };
}

function SelectChevron({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M3 4.5 6 7.5 9 4.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
            />
        </svg>
    );
}

function styleNexusNumberInput(element: HTMLInputElement, host: HTMLDivElement) {
    element.style.borderRadius = "16px";
    element.style.border = "1px solid rgba(255,255,255,0.08)";
    element.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.04)";
    element.style.fontFamily = "\"SF Mono\", \"JetBrains Mono\", ui-monospace, monospace";
    element.style.letterSpacing = "0.12em";
    element.style.fontSize = "14px";
    element.style.padding = "10px 14px";
    element.style.backgroundColor = "rgba(255,255,255,0.06)";
    element.style.color = "#d6f4ff";
    element.style.display = "block";
    element.style.width = "118px";
    element.style.height = "42px";
    host.style.width = "118px";
    host.style.height = "42px";
    host.style.cursor = "ns-resize";
}

function MsegPreview({
    points,
    className,
}: {
    points: Array<{ x: number; y: number; curvePower: number }>;
    className?: string;
}) {
    const viewportRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);

    const { curvePath, fillPath, metrics } = useMemo(() => {
        return buildMsegSurfacePaths(points, size.width, size.height, {
            pointRadius: 0,
            horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
            verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
        });
    }, [points, size.height, size.width]);

    return (
        <svg
            ref={viewportRef}
            className={className ?? "h-32 w-full overflow-hidden rounded-[20px] bg-white/[0.03]"}
            viewBox={`0 0 ${size.width} ${size.height}`}
        >
            <g>
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`h-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft}
                        y1={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                        x2={metrics.plotRight}
                        y2={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                    />
                ))}
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`v-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft + (metrics.plotWidth * step)}
                        y1={metrics.plotTop}
                        x2={metrics.plotLeft + (metrics.plotWidth * step)}
                        y2={metrics.plotBottom}
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
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`editable-h-${step}`}
                        className="cosimo-grid-line"
                        x1={0}
                        y1={size.height * (1 - step)}
                        x2={size.width}
                        y2={size.height * (1 - step)}
                    />
                ))}
                {MSEG_GRID_STEPS.map((step) => (
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

function RangeField({
    label,
    min,
    max,
    step,
    value,
    displayValue,
    onChange,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    ariaLabel,
    focusBindings,
}: RangeFieldProps) {
    return (
        <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">{label}</span>
            <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4">
                <input
                    className="cosimo-range"
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value.toFixed(3)}
                    aria-label={ariaLabel ?? label}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onChange={(event) => onChange(Number(event.target.value))}
                    {...focusBindings}
                />
                <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">
                    {displayValue}
                </div>
            </div>
        </label>
    );
}

function VoiceModeGlyph({
    mode,
    active,
}: {
    mode: number;
    active: boolean;
}) {
    const stroke = active ? "rgba(214,244,255,0.96)" : "rgba(189,204,223,0.72)";
    const fill = active ? "rgba(143,232,255,0.24)" : "rgba(255,255,255,0.06)";

    if (mode === 0) {
        return (
            <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
                <circle cx="7" cy="11" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
                <circle cx="14" cy="8" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
                <circle cx="21" cy="11" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
            </svg>
        );
    }

    if (mode === 1) {
        return (
            <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
                <rect x="8.5" y="4.5" width="11" height="9" rx="4.5" fill={fill} stroke={stroke} strokeWidth="1.3" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
            <circle cx="8" cy="9" r="3" fill={fill} stroke={stroke} strokeWidth="1.3" />
            <circle cx="20" cy="9" r="3" fill={fill} stroke={stroke} strokeWidth="1.3" />
            <path d="M10.8 9 C12.5 5.5 15.5 5.5 17.2 9" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

function VoiceModeToolbar({
    playMode,
    focusBindings,
}: {
    playMode: PatchControlBinding<number>;
    focusBindings: SynthFocusBindings;
}) {
    return (
        <div className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">Voice</span>
            <div className="inline-grid grid-cols-3 gap-1 rounded-[18px] border border-white/8 bg-black/25 p-1" {...focusBindings}>
                {PLAY_MODE_OPTIONS.map((option) => {
                    const isActive = option.value === playMode.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={`rounded-[14px] px-3 py-2.5 text-left transition ${
                                isActive
                                    ? "bg-white/[0.08] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(143,232,255,0.18)]"
                                    : "text-slate-300/70 hover:bg-white/[0.04] hover:text-slate-100"
                            }`}
                            onClick={() => playMode.commitValue(option.value)}
                            aria-pressed={isActive}
                        >
                            <div className="flex items-center gap-2">
                                <VoiceModeGlyph mode={option.value} active={isActive} />
                                <span className="text-[11px] uppercase tracking-[0.16em]">{option.label}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function NexusNumberField({
    label,
    binding,
    min,
    max,
    step,
    decimalPlaces = 3,
    onActivate,
    onBeginTextEntry,
    onEndTextEntry,
}: NexusNumberFieldProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<InstanceType<typeof Nexus.Number> | null>(null);
    const bindingRef = useRef(binding);
    const callbackRef = useRef({
        onActivate,
        onBeginTextEntry,
        onEndTextEntry,
    });

    useEffect(() => {
        bindingRef.current = binding;
        callbackRef.current = {
            onActivate,
            onBeginTextEntry,
            onEndTextEntry,
        };
    }, [binding, onActivate, onBeginTextEntry, onEndTextEntry]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        host.replaceChildren();

        const widget = new Nexus.Number(host, {
            size: [118, 42],
            value: binding.value,
            min,
            max,
            step,
        });
        widget.decimalPlaces = decimalPlaces;
        widget.colors.fill = "rgba(255,255,255,0.06)";
        widget.colors.dark = "#d6f4ff";
        widget.colors.light = "#06101f";
        widget.colors.accent = "#8fe8ff";
        widget.colorInterface();
        widget.element.setAttribute("aria-label", label);
        styleNexusNumberInput(widget.element, host);
        const handleMouseDown = () => {
            callbackRef.current.onActivate?.();
        };
        const handleFocus = () => {
            callbackRef.current.onActivate?.();
            callbackRef.current.onBeginTextEntry?.();
        };
        const handleBlur = () => {
            callbackRef.current.onEndTextEntry?.();
        };
        const handleWidgetChange = (nextValue?: number) => {
            const safeValue = clamp(Number(nextValue) || 0, min, max);
            bindingRef.current.setValue(safeValue);
        };

        widget.element.addEventListener("mousedown", handleMouseDown);
        widget.element.addEventListener("focus", handleFocus);
        widget.element.addEventListener("blur", handleBlur);
        widget.on("change", handleWidgetChange);

        widgetRef.current = widget;

        return () => {
            widget.element.removeEventListener("mousedown", handleMouseDown);
            widget.element.removeEventListener("focus", handleFocus);
            widget.element.removeEventListener("blur", handleBlur);
            callbackRef.current.onEndTextEntry?.();
            widget.destroy();
            widgetRef.current = null;
        };
    }, [decimalPlaces, label, max, min, step]);

    useEffect(() => {
        const widget = widgetRef.current;

        if (!widget) {
            return;
        }

        if (document.activeElement === widget.element) {
            return;
        }

        if (Math.abs(widget.value - binding.value) <= step / 10) {
            return;
        }

        widget.passiveUpdate(binding.value);
        widget.render();
    }, [binding.value, step]);

    return (
        <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">{label}</span>
            <div className="flex items-center gap-3">
                <div ref={hostRef} className="h-[42px] w-[118px] rounded-[16px]" />
                <span className="font-mono text-xs tracking-[0.18em] text-cyan-200/80">s</span>
            </div>
        </label>
    );
}

function StatusHeader({ statusText }: HeaderProps) {
    return (
        <header className="flex items-center justify-between gap-4">
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-blue-300/70">
                Cosimo Synth
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-right text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/80">
                {statusText}
            </div>
        </header>
    );
}

function WavetableStageSection({
    stageRef,
    frames,
    position,
    tableName,
    frameCount,
    desiredTableIndex,
    tableOptions,
    canRetry,
    onTableChange,
    onRetry,
    tableFocusBindings,
    onPointerDown,
    onPointerMove,
    onPointerUp,
}: WavetableStageSectionProps) {
    return (
        <section
            ref={stageRef}
            className="cosimo-stage relative min-h-[356px] overflow-hidden rounded-[30px] border border-white/8"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <WavetableCanvas frames={frames} position={position} />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 text-[11px] uppercase tracking-[0.16em] text-slate-300/70">
                <label className="relative inline-flex max-w-[280px] cursor-pointer items-center">
                    <div className="inline-flex min-w-0 items-center rounded-full border border-white/10 bg-black/40 px-4 py-2.5 pr-10 text-left text-[11px] uppercase tracking-[0.18em] text-amber-100 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md">
                        <span className="truncate">{tableName}</span>
                    </div>
                    <SelectChevron className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300/75" />
                    <select
                        className="absolute inset-0 cursor-pointer opacity-0"
                        value={String(desiredTableIndex)}
                        onChange={(event) => onTableChange(Number(event.target.value))}
                        aria-label="Select wavetable"
                        {...tableFocusBindings}
                    >
                        {tableOptions.map((table, tableIndex) => (
                            <option key={`${table.name}-${tableIndex}`} value={tableIndex}>
                                {table.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-cyan-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        Frame {formatFrameIndex(position, frameCount)}
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-slate-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        Pos {clampDisplayPosition(position).toFixed(3)}
                    </div>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-start gap-3 p-5">
                {canRetry ? (
                    <button
                        type="button"
                        className="cosimo-button rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40"
                        disabled={!canRetry}
                        onClick={onRetry}
                    >
                        Retry Load
                    </button>
                ) : null}
            </div>
        </section>
    );
}

function MsegOverviewSection({
    msegState,
    onOpenEditor,
    onDepthChange,
    onRateChange,
    onToggleLoop,
    depthFocusBindings,
    rateFocusBindings,
    className,
}: MsegOverviewSectionProps) {
    return (
        <section className={`grid min-h-[356px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 rounded-[30px] border border-white/8 bg-white/[0.03] p-4 pb-5 ${className ?? ""}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">MSEG</div>
                <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                    {msegState ? formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds)) : "0.000 s"}
                </div>
            </div>

            {msegState ? (
                <>
                    <button
                        type="button"
                        className="group min-h-0 overflow-hidden rounded-[24px] border border-white/6 bg-black/20 p-3 text-left transition hover:border-white/12 hover:bg-black/24"
                        onClick={onOpenEditor}
                        aria-label="Open MSEG editor"
                    >
                        <MsegPreview
                            points={msegState.shape.points}
                            className="h-full min-h-0 w-full overflow-hidden rounded-[18px] bg-white/[0.03]"
                        />
                    </button>
                    <div className="grid gap-3 pt-1">
                        <div className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-4">
                            <div className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Depth</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    step="0.001"
                                    value={Number(msegState.depth).toFixed(3)}
                                    onChange={(event) => onDepthChange(Number(event.target.value))}
                                    {...depthFocusBindings}
                                />
                            </div>
                            <div className="text-right font-mono text-sm tracking-[0.16em] text-cyan-200">
                                {Number(msegState.depth).toFixed(3)}
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-4">
                            <div className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Rate</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    min={MSEG_RATE_MIN_SECONDS}
                                    max={MSEG_RATE_MAX_SECONDS}
                                    step="0.001"
                                    value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                                    onChange={(event) => onRateChange(Number(event.target.value))}
                                    {...rateFocusBindings}
                                />
                            </div>
                            <div className="text-right font-mono text-sm tracking-[0.16em] text-cyan-200">
                                {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                            </div>
                            <button
                                type="button"
                                className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                onClick={onToggleLoop}
                            >
                                {msegState.playback.loop ? "Looping" : "One Shot"}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-slate-300/70">
                    Loading MSEG state…
                </div>
            )}
        </section>
    );
}

function OctaveShiftGlyph({
    direction,
}: {
    direction: "up" | "down";
}) {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
                d={direction === "up" ? "M4.5 9.75 8 6.25 11.5 9.75" : "M4.5 6.25 8 9.75 11.5 6.25"}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function KeyboardToolbar({
    playMode,
    glideTime,
    playModeFocusBindings,
    glideFocusTarget,
}: VoiceGlideSectionProps & {
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3">
            <VoiceModeToolbar playMode={playMode} focusBindings={playModeFocusBindings} />
            <NexusNumberField
                label="Glide"
                binding={glideTime}
                min={GLIDE_TIME_MIN_SECONDS}
                max={GLIDE_TIME_MAX_SECONDS}
                step={GLIDE_TIME_STEP_SECONDS}
                onActivate={glideFocusTarget.onActivate}
                onBeginTextEntry={glideFocusTarget.onBeginTextEntry}
                onEndTextEntry={glideFocusTarget.onEndTextEntry}
            />
        </div>
    );
}

function KeyboardSection({
    playMode,
    glideTime,
    keyboardRootNote,
    onOctaveDown,
    onOctaveUp,
    playModeFocusBindings,
    glideFocusTarget,
    keyboardRef,
}: VoiceGlideSectionProps & {
    keyboardRootNote: number;
    onOctaveDown: () => void;
    onOctaveUp: () => void;
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
    keyboardRef: RefObject<PianoKeyboardElement | null>;
}) {
    return (
        <section className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center justify-end gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] px-2 py-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/55">Oct</span>
                <button
                    type="button"
                    className="cosimo-button flex h-10 w-10 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveUp}
                    disabled={keyboardRootNote >= KEYBOARD_ROOT_NOTE_MAX}
                    aria-label="Shift keyboard up one octave"
                >
                    <OctaveShiftGlyph direction="up" />
                </button>
                <button
                    type="button"
                    className="cosimo-button flex h-10 w-10 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveDown}
                    disabled={keyboardRootNote <= KEYBOARD_ROOT_NOTE_MIN}
                    aria-label="Shift keyboard down one octave"
                >
                    <OctaveShiftGlyph direction="down" />
                </button>
                <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-200/70">
                    {formatKeyboardRootLabel(keyboardRootNote)}
                </div>
            </div>

            <div className="grid gap-3">
                <KeyboardToolbar
                    playMode={playMode}
                    glideTime={glideTime}
                    playModeFocusBindings={playModeFocusBindings}
                    glideFocusTarget={glideFocusTarget}
                />
                <KeyboardDock rootNote={keyboardRootNote} keyboardRef={keyboardRef} />
            </div>
        </section>
    );
}

function MsegEditorModal({
    isOpen,
    msegState,
    surfaceRef,
    selectedPointIndex,
    onClose,
    onRateChange,
    onToggleLoop,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    rateFocusBindings,
}: MsegEditorModalProps) {
    if (!isOpen || !msegState) {
        return null;
    }

    return (
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
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>

                <EditableMsegSurface
                    surfaceRef={surfaceRef}
                    points={msegState.shape.points}
                    selectedPointIndex={selectedPointIndex}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                />

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                    <RangeField
                        label="Time In Seconds"
                        min={MSEG_RATE_MIN_SECONDS}
                        max={MSEG_RATE_MAX_SECONDS}
                        step={0.001}
                        value={clampMsegRateSeconds(msegState.playback.rate.seconds)}
                        displayValue={formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                        onChange={onRateChange}
                        ariaLabel="MSEG rate"
                        focusBindings={rateFocusBindings}
                    />

                    <div className="flex items-center gap-3">
                        <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                            {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                        </div>
                        <button
                            type="button"
                            className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                            onClick={onToggleLoop}
                        >
                            {msegState.playback.loop ? "Looping" : "One Shot"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function commitDiscreteParameter(
    binding: Pick<PatchControlBinding<number>, "commitValue">,
    nextValue: number,
) {
    binding.commitValue(nextValue);
}

function useStagePositionDrag({
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

function useMsegEditorInteractions({
    msegState,
    msegController,
    surfaceRef,
}: {
    msegState: MsegState | null;
    msegController: RefObject<MsegController | null>;
    surfaceRef: RefObject<SVGSVGElement | null>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPointIndex, setSelectedPointIndex] = useState(0);
    const [activePointer, setActivePointer] = useState<ActiveMsegPointerState | null>(null);

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

    useEffect(() => {
        if (!isOpen) {
            setActivePointer(null);
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
    }, [isOpen]);

    const openEditor = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeEditor = useCallback(() => {
        setIsOpen(false);
        setActivePointer(null);
    }, []);

    const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || !msegState || !surfaceRef.current) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const targetPointIndex = findMsegPointHitIndex(
            msegState.shape,
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
        );

        if (targetPointIndex >= 0) {
            setSelectedPointIndex(targetPointIndex);
            setActivePointer({
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
            setSelectedPointIndex(nextPointIndex);
        }

        event.preventDefault();
    }, [msegController, msegState, surfaceRef]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (!activePointer || activePointer.pointerId !== event.pointerId || !surfaceRef.current) {
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
        );
        setActivePointer((previousPointer) => previousPointer
            ? { ...previousPointer, moved: true }
            : previousPointer);
        msegController.current?.movePoint(activePointer.pointIndex, point.x, point.y);
        setSelectedPointIndex(activePointer.pointIndex);
        event.preventDefault();
    }, [activePointer, msegController, surfaceRef]);

    const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (!activePointer || activePointer.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const pointerState = activePointer;
        setActivePointer(null);

        if (!pointerState.moved && pointerState.deleteOnRelease && msegController.current) {
            msegController.current.deletePoint(pointerState.pointIndex);
            const pointCount = msegController.current.getState().shape.points.length;
            setSelectedPointIndex(clamp(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
        }

        event.preventDefault();
    }, [activePointer, msegController]);

    return {
        isOpen,
        selectedPointIndex,
        openEditor,
        closeEditor,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
}

function DesktopPatchViewBody() {
    const runtimeStateMessage = usePatchEndpoint<unknown | null>(runtimeStateEndpointID, null);
    const normalizedRuntimeState = useMemo(
        () => normalizeRuntimeTableState(runtimeStateMessage),
        [runtimeStateMessage],
    );
    const { catalog, error: catalogError } = useFactoryBankCatalog();
    const wavetablePosition = usePatchParameterBinding<number>({
        endpointID: wavetablePositionEndpointID,
        initialValue: 0,
        coerce: (value) => clampDisplayPosition(value),
    });
    const wavetableSelect = usePatchParameterBinding<number>({
        endpointID: wavetableSelectEndpointID,
        initialValue: 0,
        coerce: (value) => Math.max(0, Math.trunc(Number(value) || 0)),
    });
    const playMode = usePatchParameterBinding<number>({
        endpointID: playModeEndpointID,
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, PLAY_MODE_OPTIONS.length - 1),
    });
    const glideTime = usePatchParameterBinding<number>({
        endpointID: glideTimeEndpointID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 2),
    });
    const requestRuntimeSync = usePatchEventTrigger<number>(runtimeSyncRequestEndpointID);
    const retryDesiredTableLoad = usePatchEventTrigger<number>(retryDesiredTableRequestEndpointID);
    const observedPosition = useObservedDisplayPosition(Number(wavetablePosition.value) || 0);
    const runtimePresentation = useMemo(
        () => resolveRuntimeTablePresentation(runtimeStateMessage, Number(wavetableSelect.value) || 0),
        [runtimeStateMessage, wavetableSelect.value],
    );
    const presentedTableIndex = runtimePresentation.presentedTableIndex ?? 0;
    const desiredTableIndex = runtimePresentation.desiredTableIndex ?? 0;
    const { frames, error: frameError } = useFactoryTableFrames(presentedTableIndex);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const { state: msegState, controller: msegController } = useMsegState();
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const synthInputRouter = useSynthInputRouter(keyboardElementRef);
    const {
        handleStagePointerDown,
        handleStagePointerMove,
        handleStagePointerUp,
    } = useStagePositionDrag({
        stageRef,
        observedPosition,
        binding: wavetablePosition,
    });
    const {
        isOpen: isMsegEditorOpen,
        selectedPointIndex: selectedMsegPointIndex,
        openEditor: handleOpenMsegEditor,
        closeEditor: handleCloseMsegEditor,
        handlePointerDown: handleMsegPointerDown,
        handlePointerMove: handleMsegPointerMove,
        handlePointerUp: handleMsegPointerUp,
    } = useMsegEditorInteractions({
        msegState,
        msegController,
        surfaceRef: msegEditorSurfaceRef,
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
        commitDiscreteParameter(wavetableSelect, nextValue);
    }, [wavetableSelect]);

    const handleStepWavetable = useCallback((direction: -1 | 1) => {
        const maxTableIndex = Math.max(0, (catalog?.tables?.length ?? 1) - 1);
        commitDiscreteParameter(
            wavetableSelect,
            clamp(desiredTableIndex + direction, 0, maxTableIndex),
        );
    }, [catalog?.tables?.length, desiredTableIndex, wavetableSelect]);

    const handleRetryLoad = useCallback(() => {
        retryDesiredTableLoad(1);
    }, [retryDesiredTableLoad]);

    const handleMsegDepthChange = useCallback((nextValue: number) => {
        msegController.current?.setDepth(nextValue);
    }, [msegController]);

    const handleStepMsegDepth = useCallback((direction: -1 | 1) => {
        if (!msegState) {
            return;
        }

        msegController.current?.setDepth(clamp(Number(msegState.depth) + (direction * 0.001), -1, 1));
    }, [msegController, msegState]);

    const handleMsegRateChange = useCallback((nextValue: number) => {
        if (!msegState) {
            return;
        }

        msegController.current?.setPlayback({
            ...msegState.playback,
            rate: {
                kind: "seconds",
                seconds: nextValue,
            },
        });
    }, [msegController, msegState]);

    const handleStepMsegRate = useCallback((direction: -1 | 1) => {
        if (!msegState) {
            return;
        }

        const nextRateSeconds = clampMsegRateSeconds(msegState.playback.rate.seconds + (direction * 0.001));
        msegController.current?.setPlayback({
            ...msegState.playback,
            rate: {
                kind: "seconds",
                seconds: nextRateSeconds,
            },
        });
    }, [msegController, msegState]);

    const handleToggleMsegLoop = useCallback(() => {
        if (!msegState) {
            return;
        }

        msegController.current?.setPlayback({
            ...msegState.playback,
            loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
            noteOffPolicy: "finish_loop",
        });
    }, [msegController, msegState]);

    const handleKeyboardOctaveDown = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleKeyboardOctaveUp = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleStepPlayMode = useCallback((direction: -1 | 1) => {
        commitDiscreteParameter(
            playMode,
            clamp(playMode.value + direction, 0, PLAY_MODE_OPTIONS.length - 1),
        );
    }, [playMode]);

    const handleStepGlideTime = useCallback((direction: -1 | 1) => {
        glideTime.commitValue(clamp(
            glideTime.value + (direction * GLIDE_TIME_STEP_SECONDS),
            GLIDE_TIME_MIN_SECONDS,
            GLIDE_TIME_MAX_SECONDS,
        ));
    }, [glideTime]);

    const wavetableFocusBindings = synthInputRouter.bindArrowTarget({
        id: "wavetable-select",
        onArrowStep: handleStepWavetable,
    });
    const playModeFocusBindings = synthInputRouter.bindArrowTarget({
        id: "play-mode",
        onArrowStep: handleStepPlayMode,
    });
    const msegDepthFocusBindings = synthInputRouter.bindArrowTarget({
        id: "mseg-depth",
        onArrowStep: handleStepMsegDepth,
    });
    const msegRateFocusBindings = synthInputRouter.bindArrowTarget({
        id: "mseg-rate",
        onArrowStep: handleStepMsegRate,
    });
    const glideFocusTarget = useMemo(() => ({
        onActivate: () => synthInputRouter.activateArrowTarget({
            id: "glide-time",
            onArrowStep: handleStepGlideTime,
        }),
        onBeginTextEntry: () => synthInputRouter.beginTextEntry({
            id: "glide-time",
            onArrowStep: handleStepGlideTime,
        }),
        onEndTextEntry: () => synthInputRouter.endTextEntry(),
    }), [handleStepGlideTime, synthInputRouter]);

    return (
        <div className="cosimo-surface relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[28px] border border-white/8 p-6 text-slate-100 shadow-[0_26px_80px_rgba(0,0,0,0.48)]">
            <StatusHeader statusText={topStatus} />

            <main className="grid min-h-0 flex-1 grid-rows-[minmax(356px,0.9fr)_auto_auto] gap-5">
                <section className="grid min-h-0 grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-5">
                    <WavetableStageSection
                        stageRef={stageRef}
                        frames={frames}
                        position={observedPosition}
                        tableName={displayedTable?.name ?? "Factory bank"}
                        frameCount={displayedFrameCount}
                        desiredTableIndex={desiredTableIndex}
                        tableOptions={catalog?.tables ?? []}
                        canRetry={runtimePresentation.isRetryableFailure}
                        onTableChange={handleSelectWavetable}
                        onRetry={handleRetryLoad}
                        tableFocusBindings={wavetableFocusBindings}
                        onPointerDown={handleStagePointerDown}
                        onPointerMove={handleStagePointerMove}
                        onPointerUp={handleStagePointerUp}
                    />

                    <MsegOverviewSection
                        msegState={msegState}
                        onOpenEditor={handleOpenMsegEditor}
                        onDepthChange={handleMsegDepthChange}
                        onRateChange={handleMsegRateChange}
                        onToggleLoop={handleToggleMsegLoop}
                        depthFocusBindings={msegDepthFocusBindings}
                        rateFocusBindings={msegRateFocusBindings}
                    />
                </section>

                {failureDetail ? (
                    <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                        {failureDetail}
                    </div>
                ) : null}

                <KeyboardSection
                    playMode={playMode}
                    glideTime={glideTime}
                    keyboardRootNote={keyboardRootNote}
                    onOctaveDown={handleKeyboardOctaveDown}
                    onOctaveUp={handleKeyboardOctaveUp}
                    playModeFocusBindings={playModeFocusBindings}
                    glideFocusTarget={glideFocusTarget}
                    keyboardRef={keyboardElementRef}
                />
            </main>

            <MsegEditorModal
                isOpen={isMsegEditorOpen}
                msegState={msegState}
                surfaceRef={msegEditorSurfaceRef}
                selectedPointIndex={selectedMsegPointIndex}
                onClose={handleCloseMsegEditor}
                onRateChange={handleMsegRateChange}
                onToggleLoop={handleToggleMsegLoop}
                onPointerDown={handleMsegPointerDown}
                onPointerMove={handleMsegPointerMove}
                onPointerUp={handleMsegPointerUp}
                rateFocusBindings={msegRateFocusBindings}
            />
        </div>
    );
}

export function DesktopPatchView({
    patchConnection,
    resourceClient,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient?: ResourceClient;
}) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
            <DesktopPatchViewBody />
        </PatchConnectionProvider>
    );
}
