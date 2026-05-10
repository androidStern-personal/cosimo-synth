import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent as ReactDragEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";

export type ArticulationTriggerMode = "chain" | "key" | "vel";

export type MsegThumbnailPoint = {
    x: number;
    y: number;
    curvePower: number;
};

export type GainEnvelopeView = {
    attackSeconds: number;
    decaySeconds: number;
    sustain: number;
    releaseSeconds: number;
};

export type ArticulationCardView = {
    id: string;
    name: string;
    color: string;
    runtimeSlot: number;
    assignmentLabel: string;
    isSelected: boolean;
    isDirty: boolean;
    canDelete: boolean;
    msegPoints: MsegThumbnailPoint[];
    gainEnvelope: GainEnvelopeView;
};

export type ArticulationRangeSegmentView = {
    id: string;
    articulationId: string;
    label: string;
    color: string;
    min: number;
    max: number;
    isSelected: boolean;
    isPreview?: boolean;
    isPreviewAffected?: boolean;
};

export type ArticulationHeldInputView = {
    note: number | null;
    velocity: number | null;
    chain: number | null;
};

export const ARTICULATION_DRAG_MIME = "application/x-cosimo-articulation-id";
export const ARTICULATION_RANGE_MAX = 127;

let activeArticulationDragId: string | null = null;

type ArticulationRangeEditEdge = "min" | "max";
type ArticulationPlacementOperation = "fill" | "replace" | "insert" | "move";
type ArticulationInsertPreserveSide = "lower" | "upper";

type ArticulationPlacementPreview = {
    operation: ArticulationPlacementOperation;
    position: number;
    min: number;
    max: number;
    targetSegment: ArticulationRangeSegmentView | null;
    projectedSegments: ArticulationRangeSegmentView[];
    insertPreserveSide?: ArticulationInsertPreserveSide;
};

type ArticulationRangePointerDragState = {
    kind: "move" | "resize";
    segment: ArticulationRangeSegmentView;
    edge?: ArticulationRangeEditEdge;
    pointerId: number;
    startX: number;
    moved: boolean;
} | {
    kind: "boundary-resize";
    leftSegment: ArticulationRangeSegmentView;
    rightSegment: ArticulationRangeSegmentView;
    originalSegment: ArticulationRangeSegmentView;
    pointerId: number;
    startX: number;
    moved: boolean;
};

const RANGE_EDGE_RESIZE_HIT_PX = 8;

export type ArticulationControlSurfaceProps = {
    cards: ArticulationCardView[];
    activeMode: ArticulationTriggerMode;
    isExpanded: boolean;
    selectedArticulationId: string | null;
    selectedIsDirty: boolean;
    discardedEditLabel?: string | null;
    canCapture: boolean;
    chainSegments: ArticulationRangeSegmentView[];
    keySegments: ArticulationRangeSegmentView[];
    velocitySegments: ArticulationRangeSegmentView[];
    heldInput?: ArticulationHeldInputView;
    keyboardMinNote: number;
    keyboardMaxNote: number;
    onToggleExpanded: () => void;
    onSelectMode: (mode: ArticulationTriggerMode) => void;
    onSelectCard: (articulationId: string) => void;
    onCardPlayPressStart: (articulationId: string) => void;
    onCardPlayPressEnd: (articulationId: string) => void;
    onCapture: () => void;
    onUpdate: () => void;
    onRevert: () => void;
    onUndoDiscard?: () => void;
    onSelectRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertRangePosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        preserveSide?: ArticulationInsertPreserveSide,
    ) => boolean;
    onDuplicateAndAssignRangePosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        operation: "assign" | "insert",
    ) => boolean;
    onMoveRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView, position: number) => boolean;
    onResizeRangeSegment: (
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
        position: number,
    ) => boolean;
    onClearRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => boolean;
    onClearRangeMode: (mode: ArticulationTriggerMode) => void;
    onDistributeRange: (mode: ArticulationTriggerMode) => void;
    onRequestRename: (articulationId: string) => void;
    onRequestDuplicate: (articulationId: string) => void;
    onRequestReplace: (articulationId: string) => void;
    onRequestDelete: (articulationId: string) => void;
};

const MODE_OPTIONS: ReadonlyArray<{ mode: ArticulationTriggerMode; label: string }> = [
    { mode: "chain", label: "Chain" },
    { mode: "key", label: "Key" },
    { mode: "vel", label: "Vel" },
];
const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const PILL_BASE = "inline-flex h-6 shrink-0 items-center gap-1 rounded-[5px] border px-2 text-[10px] font-semibold tracking-[0.04em] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45 focus-visible:ring-offset-0";
const PILL_NEUTRAL = "border-white/[0.06] bg-white/[0.025] text-slate-300/72 hover:border-white/15 hover:bg-white/[0.04] hover:text-slate-100 active:bg-white/[0.06]";
const PILL_AMBER_ACTIVE = "border-amber-200/35 bg-amber-300/12 text-amber-100 shadow-[inset_0_-1px_0_rgba(251,191,36,0.22)]";
const PILL_CYAN = "border-cyan-300/20 bg-cyan-300/8 text-cyan-100/90 hover:border-cyan-200/32 hover:bg-cyan-300/14 active:bg-cyan-300/20";
const PILL_PINK = "border-pink-300/24 bg-pink-300/10 text-pink-100/90 hover:border-pink-200/38 hover:bg-pink-300/16 active:bg-pink-300/22";
const FRAME_CLASS = "rounded-[14px] border border-white/[0.06] bg-white/[0.022] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]";
const SEGMENTED_GROUP_CLASS = "inline-flex h-6 shrink-0 items-center gap-0.5 rounded-[6px] border border-white/[0.05] bg-black/25 p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.30)]";
const SEGMENTED_BUTTON_BASE = "h-5 rounded-[4px] px-2 text-[10px] font-semibold tracking-[0.04em] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45";
const SEGMENTED_BUTTON_ACTIVE = "bg-amber-300/16 text-amber-100 shadow-[inset_0_-1px_0_rgba(251,191,36,0.24)]";
const SEGMENTED_BUTTON_INACTIVE = "text-slate-300/65 hover:text-slate-100";
const LANE_ACTION_CLASS = "inline-flex h-5 shrink-0 items-center rounded-[4px] bg-white/[0.035] px-1.5 text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-300/72 transition hover:bg-white/[0.075] hover:text-slate-100 active:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45";
const LANE_ACTION_CLASS_PINK = "inline-flex h-5 shrink-0 items-center rounded-[4px] bg-pink-300/[0.08] px-1.5 text-[9px] font-semibold uppercase tracking-[0.10em] text-pink-200/85 transition hover:bg-pink-300/[0.16] hover:text-pink-100 active:bg-pink-300/[0.22] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45";

function rangeSegmentTier(widthPct: number) {
    if (widthPct >= 14) {
        return "large" as const;
    }
    if (widthPct >= 7) {
        return "medium" as const;
    }
    if (widthPct >= 3) {
        return "small" as const;
    }
    return "tiny" as const;
}

function abbreviateRangeLabel(name: string, maxLen: number) {
    const trimmed = name.trim();
    if (trimmed.length <= maxLen) {
        return trimmed;
    }
    const words = trimmed.split(/\s+/);
    if (words.length > 1) {
        const initials = words.map((word) => word[0] ?? "").join("").toUpperCase();
        if (initials.length <= maxLen && initials.length >= 2) {
            return initials;
        }
    }
    return trimmed.slice(0, maxLen);
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatModeLabel(mode: ArticulationTriggerMode) {
    return mode === "vel" ? "Vel" : mode === "key" ? "Key" : "Chain";
}

function formatMidiNoteName(note: number) {
    const safeNote = clamp(Math.round(note), 0, 127);
    return `${MIDI_NOTE_NAMES[safeNote % 12]}${Math.floor(safeNote / 12) - 2}`;
}

function formatLanePosition(mode: ArticulationTriggerMode, value: number) {
    const safeValue = Math.round(value);
    return mode === "key" ? formatMidiNoteName(safeValue) : String(safeValue);
}

function formatLaneRange(mode: ArticulationTriggerMode, min: number, max: number) {
    const minLabel = formatLanePosition(mode, min);
    const maxLabel = formatLanePosition(mode, max);
    return min === max ? minLabel : `${minLabel}-${maxLabel}`;
}

type ArticulationRangeThird = 0 | 1 | 2;

function buildRangeThirds(minValue: number, maxValue: number) {
    const totalSlots = Math.max(1, maxValue - minValue + 1);

    return ([0, 1, 2] as const).map((index) => {
        const startOffset = Math.round((totalSlots * index) / 3);
        const endOffset = Math.round((totalSlots * (index + 1)) / 3) - 1;
        return {
            index,
            min: minValue + startOffset,
            max: clamp(minValue + endOffset, minValue, maxValue),
        };
    });
}

function findRangeThirdForValue(thirds: ReturnType<typeof buildRangeThirds>, value: number | null) {
    if (value === null) {
        return 0 as ArticulationRangeThird;
    }

    const matchingThird = thirds.find((third) => value >= third.min && value <= third.max);
    return (matchingThird?.index ?? 0) as ArticulationRangeThird;
}

function labelRangeThird(index: ArticulationRangeThird) {
    return index === 0 ? "Low" : index === 1 ? "Mid" : "High";
}

function heldValueForMode(mode: ArticulationTriggerMode, heldInput: ArticulationHeldInputView | undefined) {
    const value = mode === "key"
        ? heldInput?.note
        : mode === "vel"
            ? heldInput?.velocity
            : heldInput?.chain;

    return typeof value === "number" && Number.isFinite(value)
        ? clamp(Math.round(value), 0, ARTICULATION_RANGE_MAX)
        : null;
}

function clipSegmentsToRange(
    segments: ArticulationRangeSegmentView[],
    minValue: number,
    maxValue: number,
) {
    return segments
        .filter((segment) => segment.max >= minValue && segment.min <= maxValue)
        .map((segment) => ({
            ...segment,
            visibleMin: Math.max(segment.min, minValue),
            visibleMax: Math.min(segment.max, maxValue),
        }));
}

function formatRuntimeSlot(slot: number) {
    return slot.toString().padStart(2, "0");
}

type ArticulationCardMenuAction = "rename" | "duplicate" | "replace" | "delete";
type ArticulationRangeMenuAction = "delete" | "insert-after" | "duplicate-after" | "replace";

type ArticulationCardMenuState = {
    articulationId: string;
    canDelete: boolean;
    x: number;
    y: number;
};

type ArticulationRangeMenuState = {
    segment: ArticulationRangeSegmentView;
    x: number;
    y: number;
};

const ARTICULATION_CARD_MENU_ITEMS: ReadonlyArray<{
    action: ArticulationCardMenuAction;
    label: string;
}> = [
    { action: "rename", label: "Rename" },
    { action: "duplicate", label: "Duplicate" },
    { action: "replace", label: "Replace With Current" },
    { action: "delete", label: "Delete" },
];

function ArticulationCardContextMenu({
    state,
    onClose,
    onSelectAction,
}: {
    state: ArticulationCardMenuState;
    onClose: () => void;
    onSelectAction: (action: ArticulationCardMenuAction) => void;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: state.x, y: state.y });

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        const margin = 8;
        const viewportW = typeof window !== "undefined" ? window.innerWidth : rect.right;
        const viewportH = typeof window !== "undefined" ? window.innerHeight : rect.bottom;
        let x = state.x;
        let y = state.y;
        if (x + rect.width + margin > viewportW) {
            x = Math.max(margin, viewportW - rect.width - margin);
        }
        if (y + rect.height + margin > viewportH) {
            y = Math.max(margin, viewportH - rect.height - margin);
        }
        setPosition({ x, y });
    }, [state.x, state.y]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const el = containerRef.current;
            if (el && !el.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    const containerStyle: CSSProperties = {
        position: "fixed",
        top: position.y,
        left: position.x,
    };

    return (
        <div
            ref={containerRef}
            role="menu"
            aria-label="Articulation card actions"
            data-role="articulation-card-menu"
            data-articulation-id={state.articulationId}
            style={containerStyle}
            className="z-50 min-w-[152px] rounded-[6px] border border-white/[0.07] bg-[#080b15]/97 p-0.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        >
            {ARTICULATION_CARD_MENU_ITEMS.map((item) => {
                const isDelete = item.action === "delete";
                const isDisabled = isDelete && !state.canDelete;
                return (
                    <button
                        key={item.action}
                        type="button"
                        role="menuitem"
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                        data-role="articulation-card-menu-item"
                        data-action={item.action}
                        onClick={() => {
                            if (isDisabled) {
                                return;
                            }
                            onSelectAction(item.action);
                        }}
                        className={joinClasses(
                            "flex w-full items-center justify-between rounded-[4px] px-2 py-1 text-left text-[10px] font-medium tracking-normal normal-case transition",
                            isDisabled
                                ? "cursor-not-allowed text-slate-300/30"
                                : isDelete
                                    ? "text-pink-200/90 hover:bg-pink-300/12 hover:text-pink-100"
                                    : "text-slate-200/85 hover:bg-white/[0.07] hover:text-slate-50",
                        )}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

const ARTICULATION_RANGE_MENU_ITEMS: ReadonlyArray<{
    action: ArticulationRangeMenuAction;
    label: string;
    requiresSelection?: boolean;
    isDanger?: boolean;
}> = [
    { action: "replace", label: "Replace With Selected", requiresSelection: true },
    { action: "insert-after", label: "Insert Selected After", requiresSelection: true },
    { action: "duplicate-after", label: "Duplicate After" },
    { action: "delete", label: "Delete", isDanger: true },
];

function ArticulationRangeContextMenu({
    state,
    hasSelectedArticulation,
    onClose,
    onSelectAction,
}: {
    state: ArticulationRangeMenuState;
    hasSelectedArticulation: boolean;
    onClose: () => void;
    onSelectAction: (action: ArticulationRangeMenuAction) => void;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: state.x, y: state.y });

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        const margin = 8;
        const viewportW = typeof window !== "undefined" ? window.innerWidth : rect.right;
        const viewportH = typeof window !== "undefined" ? window.innerHeight : rect.bottom;
        let x = state.x;
        let y = state.y;
        if (x + rect.width + margin > viewportW) {
            x = Math.max(margin, viewportW - rect.width - margin);
        }
        if (y + rect.height + margin > viewportH) {
            y = Math.max(margin, viewportH - rect.height - margin);
        }
        setPosition({ x, y });
    }, [state.x, state.y]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const el = containerRef.current;
            if (el && !el.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    const containerStyle: CSSProperties = {
        position: "fixed",
        top: position.y,
        left: position.x,
    };

    return (
        <div
            ref={containerRef}
            role="menu"
            aria-label="Articulation range actions"
            data-role="articulation-range-menu"
            data-segment-id={state.segment.id}
            style={containerStyle}
            className="z-50 min-w-[180px] rounded-[6px] border border-white/[0.07] bg-[#080b15]/97 p-0.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        >
            {ARTICULATION_RANGE_MENU_ITEMS.map((item) => {
                const isDisabled = Boolean(item.requiresSelection && !hasSelectedArticulation);
                return (
                    <button
                        key={item.action}
                        type="button"
                        role="menuitem"
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                        data-role="articulation-range-menu-item"
                        data-action={item.action}
                        onClick={() => {
                            if (isDisabled) {
                                return;
                            }
                            onSelectAction(item.action);
                        }}
                        className={joinClasses(
                            "flex w-full items-center justify-between rounded-[4px] px-2 py-1 text-left text-[10px] font-medium tracking-normal normal-case transition",
                            isDisabled
                                ? "cursor-not-allowed text-slate-300/30"
                                : item.isDanger
                                    ? "text-pink-200/90 hover:bg-pink-300/12 hover:text-pink-100"
                                    : "text-slate-200/85 hover:bg-white/[0.07] hover:text-slate-50",
                        )}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

function ChevronGlyph({ direction }: { direction: "up" | "down" }) {
    return (
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path
                d={direction === "up" ? "M4 10 8 6l4 4" : "M4 6l4 4 4-4"}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function PlayGlyph() {
    return (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
            <path d="M3 2.4 9.4 6 3 9.6Z" fill="currentColor" />
        </svg>
    );
}

function ColorDot({ color, dim = false }: { color: string; dim?: boolean }) {
    return (
        <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color, opacity: dim ? 0.55 : 1 }}
            aria-hidden="true"
        />
    );
}

function MsegThumbnail({ points, color }: { points: MsegThumbnailPoint[]; color: string }) {
    const pathData = useMemo(() => {
        if (!points || points.length < 2) {
            return null;
        }

        const samples: Array<{ x: number; y: number }> = [];
        for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
            const a = points[segmentIndex];
            const b = points[segmentIndex + 1];
            const power = Math.max(0.05, Number.isFinite(a.curvePower) ? a.curvePower : 1);
            const stepCount = 8;
            for (let stepIndex = 0; stepIndex <= stepCount; stepIndex += 1) {
                const t = stepIndex / stepCount;
                const curveT = power >= 1 ? Math.pow(t, power) : 1 - Math.pow(1 - t, 1 / power);
                samples.push({
                    x: a.x + (b.x - a.x) * t,
                    y: a.y + (b.y - a.y) * curveT,
                });
            }
        }

        if (samples.length < 2) {
            return null;
        }

        const W = 100;
        const H = 36;
        const padX = 2;
        const padY = 3;
        const project = (px: number, py: number) => ({
            x: padX + clamp(px, 0, 1) * (W - padX * 2),
            y: padY + (1 - clamp(py, 0, 1)) * (H - padY * 2),
        });
        const projected = samples.map((s) => project(s.x, s.y));
        const stroke = projected
            .map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            .join(" ");
        const fill = `${stroke} L${projected[projected.length - 1].x.toFixed(2)} ${(H - padY).toFixed(2)} L${projected[0].x.toFixed(2)} ${(H - padY).toFixed(2)} Z`;

        return { stroke, fill };
    }, [points]);

    return (
        <svg viewBox="0 0 100 36" className="block h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <rect x={0} y={0} width={100} height={36} rx={4} fill="rgba(255,255,255,0.018)" />
            {pathData ? (
                <>
                    <path d={pathData.fill} fill={color} fillOpacity={0.12} />
                    <path
                        d={pathData.stroke}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.92}
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            ) : null}
        </svg>
    );
}

function GainEnvelopeThumbnail({ envelope, color }: { envelope: GainEnvelopeView; color: string }) {
    const pathData = useMemo(() => {
        const a = Math.max(0, envelope.attackSeconds);
        const d = Math.max(0, envelope.decaySeconds);
        const r = Math.max(0, envelope.releaseSeconds);
        const sustainBlock = 0.6;
        const totalDuration = a + d + sustainBlock + r;
        const safeTotal = totalDuration > 0 ? totalDuration : 1;
        const sustainLevel = clamp(envelope.sustain, 0, 1);

        const W = 100;
        const H = 36;
        const padX = 3;
        const padY = 3;
        const innerW = W - padX * 2;
        const innerH = H - padY * 2;
        const xAtTime = (time: number) => padX + (time / safeTotal) * innerW;
        const yAtLevel = (level: number) => padY + (1 - level) * innerH;

        const xStart = xAtTime(0);
        const xPeak = xAtTime(a);
        const xSustainStart = xAtTime(a + d);
        const xSustainEnd = xAtTime(a + d + sustainBlock);
        const xEnd = xAtTime(a + d + sustainBlock + r);
        const yFloor = yAtLevel(0);
        const yPeak = yAtLevel(1);
        const ySustain = yAtLevel(sustainLevel);

        const stroke = [
            `M${xStart.toFixed(2)} ${yFloor.toFixed(2)}`,
            `L${xPeak.toFixed(2)} ${yPeak.toFixed(2)}`,
            `L${xSustainStart.toFixed(2)} ${ySustain.toFixed(2)}`,
            `L${xSustainEnd.toFixed(2)} ${ySustain.toFixed(2)}`,
            `L${xEnd.toFixed(2)} ${yFloor.toFixed(2)}`,
        ].join(" ");
        const fill = `${stroke} Z`;
        return { stroke, fill, xSustainStart, xSustainEnd, yFloor };
    }, [envelope]);

    return (
        <svg viewBox="0 0 100 36" className="block h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <rect x={0} y={0} width={100} height={36} rx={4} fill="rgba(255,255,255,0.018)" />
            <line
                x1={pathData.xSustainStart}
                x2={pathData.xSustainEnd}
                y1={pathData.yFloor + 0.5}
                y2={pathData.yFloor + 0.5}
                stroke={color}
                strokeOpacity={0.18}
                strokeDasharray="2 2"
                strokeWidth={0.8}
            />
            <path d={pathData.fill} fill={color} fillOpacity={0.12} />
            <path
                d={pathData.stroke}
                fill="none"
                stroke={color}
                strokeOpacity={0.92}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

type ArticulationCardProps = {
    card: ArticulationCardView;
    activeMode: ArticulationTriggerMode;
    onSelect: (articulationId: string) => void;
    onDragStart: (articulationId: string) => void;
    onDragEnd: () => void;
    onPlayPressStart: (articulationId: string) => void;
    onPlayPressEnd: (articulationId: string) => void;
    onOpenMenu: (articulationId: string, x: number, y: number) => void;
};

function ArticulationCard({
    card,
    activeMode,
    onSelect,
    onDragStart,
    onDragEnd,
    onPlayPressStart,
    onPlayPressEnd,
    onOpenMenu,
}: ArticulationCardProps) {
    const longPressTimerRef = useRef<number | null>(null);
    const handleDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        activeArticulationDragId = card.id;
        event.dataTransfer.setData(ARTICULATION_DRAG_MIME, card.id);
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "copyMove";
        onDragStart(card.id);
    }, [card.id, onDragStart]);

    const handleDragEnd = useCallback(() => {
        activeArticulationDragId = null;
        onDragEnd();
    }, [onDragEnd]);

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

    const handlePlayDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        clearLongPressTimer();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onPlayPressStart(card.id);
    }, [card.id, clearLongPressTimer, onPlayPressStart]);

    const handlePlayUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onPlayPressEnd(card.id);
    }, [card.id, onPlayPressEnd]);

    const handleCardPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;

        if (target?.closest('[data-role="articulation-card-play"]')) {
            return;
        }

        activeArticulationDragId = card.id;

        if (event.pointerType === "mouse") {
            return;
        }

        const { clientX, clientY } = event;
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
            onOpenMenu(card.id, clientX, clientY);
        }, 520);
    }, [card.id, clearLongPressTimer, onOpenMenu]);

    const containerClass = joinClasses(
        "group relative flex h-[80px] w-[148px] shrink-0 flex-col gap-1 rounded-[7px] border py-1 px-1.5 transition cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45",
        card.isSelected
            ? "border-amber-300/65 bg-amber-300/[0.085] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]"
            : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.035]",
    );

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={card.isSelected}
            aria-label={`Articulation ${card.name}`}
            data-role="articulation-card"
            data-articulation-id={card.id}
            data-runtime-slot={String(card.runtimeSlot)}
            data-selected={card.isSelected ? "true" : "false"}
            data-dirty={card.isDirty ? "true" : "false"}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onPointerDown={handleCardPointerDown}
            onPointerMove={clearLongPressTimer}
            onPointerUp={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onClick={() => {
                activeArticulationDragId = null;
                onSelect(card.id);
            }}
            onContextMenu={(event) => {
                event.preventDefault();
                onOpenMenu(card.id, event.clientX, event.clientY);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(card.id);
                }
            }}
            className={containerClass}
        >
            <div className="flex items-center gap-1.5">
                <ColorDot color={card.color} />
                <span
                    className={joinClasses(
                        "min-w-0 flex-1 truncate text-[10px] font-semibold tracking-[0.02em]",
                        card.isSelected ? "text-amber-50/95" : "text-slate-100/88",
                    )}
                >
                    {card.name}
                </span>
                {card.isDirty ? (
                    <span
                        aria-label="Modified"
                        title="Modified"
                        className="h-1 w-1 shrink-0 rounded-full bg-pink-300/95 shadow-[0_0_3px_rgba(244,114,182,0.65)]"
                    />
                ) : null}
                {card.isSelected ? (
                    <span data-role="articulation-card-selected-label" className="sr-only">
                        Selected
                    </span>
                ) : null}
                <button
                    type="button"
                    aria-label={`Audition ${card.name}`}
                    data-role="articulation-card-play"
                    draggable={false}
                    onPointerDown={handlePlayDown}
                    onPointerUp={handlePlayUp}
                    onPointerCancel={handlePlayUp}
                    onPointerLeave={handlePlayUp}
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-cyan-300/10 text-cyan-100/90 transition hover:bg-cyan-300/22 active:scale-[0.92] active:bg-cyan-300/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45"
                >
                    <PlayGlyph />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
                <div className="h-8 overflow-hidden rounded-[4px] bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
                    <MsegThumbnail points={card.msegPoints} color={card.color} />
                </div>
                <div className="h-8 overflow-hidden rounded-[4px] bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
                    <GainEnvelopeThumbnail envelope={card.gainEnvelope} color={card.color} />
                </div>
            </div>
            <div className="flex items-center justify-between gap-1.5 leading-none">
                <span
                    className={joinClasses(
                        "min-w-0 flex-1 truncate font-mono text-[9px] tabular-nums tracking-[0.06em]",
                        card.assignmentLabel ? "text-slate-200/72" : "text-slate-300/35",
                    )}
                    title={card.assignmentLabel || undefined}
                >
                    {card.assignmentLabel || `${formatModeLabel(activeMode)} -`}
                </span>
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-300/45">
                    {formatRuntimeSlot(card.runtimeSlot)}
                </span>
            </div>
        </div>
    );
}

type ArticulationCardCarouselProps = {
    cards: ArticulationCardView[];
    activeMode: ArticulationTriggerMode;
    onSelectCard: (articulationId: string) => void;
    onCardDragStart: (articulationId: string) => void;
    onCardDragEnd: () => void;
    onPlayPressStart: (articulationId: string) => void;
    onPlayPressEnd: (articulationId: string) => void;
    onOpenMenu: (articulationId: string, x: number, y: number) => void;
};

function ArticulationCardCarousel({
    cards,
    activeMode,
    onSelectCard,
    onCardDragStart,
    onCardDragEnd,
    onPlayPressStart,
    onPlayPressEnd,
    onOpenMenu,
}: ArticulationCardCarouselProps) {
    return (
        <div
            data-role="articulation-card-carousel"
            className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto overflow-y-hidden py-0.5 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]"
        >
            {cards.length === 0 ? (
                <div className="flex h-[80px] flex-1 items-center justify-center rounded-[7px] border border-dashed border-white/[0.06] bg-white/[0.01] px-3 text-[10px] tracking-[0.04em] text-slate-300/40">
                    No articulations
                </div>
            ) : null}
            {cards.map((card) => (
                <ArticulationCard
                    key={card.id}
                    card={card}
                    activeMode={activeMode}
                    onSelect={onSelectCard}
                    onDragStart={onCardDragStart}
                    onDragEnd={onCardDragEnd}
                    onPlayPressStart={onPlayPressStart}
                    onPlayPressEnd={onPlayPressEnd}
                    onOpenMenu={onOpenMenu}
                />
            ))}
        </div>
    );
}

function ModeSegmentedControl({
    activeMode,
    onSelectMode,
}: {
    activeMode: ArticulationTriggerMode;
    onSelectMode: (mode: ArticulationTriggerMode) => void;
}) {
    return (
        <div
            role="tablist"
            aria-label="Articulation trigger mode"
            className={SEGMENTED_GROUP_CLASS}
        >
            {MODE_OPTIONS.map((option) => {
                const isActive = option.mode === activeMode;
                return (
                    <button
                        key={option.mode}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        data-role="articulation-mode-tab"
                        data-mode={option.mode}
                        onClick={() => onSelectMode(option.mode)}
                        className={joinClasses(
                            SEGMENTED_BUTTON_BASE,
                            isActive ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE,
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function readDraggedArticulationId(event: ReactDragEvent<HTMLElement>): string | null {
    const fromMime = event.dataTransfer.getData(ARTICULATION_DRAG_MIME);
    if (fromMime) {
        return fromMime;
    }
    const fromText = event.dataTransfer.getData("text/plain");
    return fromText ? fromText : activeArticulationDragId;
}

type ArticulationRangeLaneProps = {
    mode: ArticulationTriggerMode;
    label: string;
    cards: ArticulationCardView[];
    segments: ArticulationRangeSegmentView[];
    selectedArticulationId: string | null;
    draggedArticulationId: string | null;
    heldInput?: ArticulationHeldInputView;
    onSelectSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignAtPosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertAtPosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        preserveSide?: ArticulationInsertPreserveSide,
    ) => boolean;
    onDuplicateAndAssignAtPosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        operation: "assign" | "insert",
    ) => boolean;
    onMoveSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView, position: number) => boolean;
    onResizeSegment: (
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
        position: number,
    ) => boolean;
    onClearSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => boolean;
    onClearAll: (mode: ArticulationTriggerMode) => void;
    onDistribute?: (mode: ArticulationTriggerMode) => void;
    minValue: number;
    maxValue: number;
    minLabel: string;
    maxLabel: string;
};

function findRangeSegmentAtPosition(segments: ArticulationRangeSegmentView[], position: number) {
    return segments.find((segment) => position >= segment.min && position <= segment.max) ?? null;
}

function findRangeGapAtPosition(
    segments: ArticulationRangeSegmentView[],
    position: number,
    minValue: number,
    maxValue: number,
) {
    let cursor = minValue;

    for (const segment of [...segments].sort((left, right) => left.min - right.min)) {
        if (position < segment.min && position >= cursor) {
            return { min: cursor, max: segment.min - 1 };
        }
        cursor = Math.max(cursor, segment.max + 1);
    }

    if (position >= cursor && position <= maxValue) {
        return { min: cursor, max: maxValue };
    }

    return { min: position, max: position };
}

function classifyRangePlacementPreview({
    segments,
    position,
    minValue,
    maxValue,
}: {
    segments: ArticulationRangeSegmentView[];
    position: number;
    minValue: number;
    maxValue: number;
}): ArticulationPlacementPreview {
    const safePosition = clamp(Math.round(position), minValue, maxValue);
    const targetSegment = findRangeSegmentAtPosition(segments, safePosition);

    if (!targetSegment) {
        const gap = findRangeGapAtPosition(segments, safePosition, minValue, maxValue);
        return {
            operation: "fill",
            position: safePosition,
            min: gap.min,
            max: gap.max,
            targetSegment: null,
            projectedSegments: segments,
        };
    }

    const width = targetSegment.max - targetSegment.min + 1;
    const edgeSlots = Math.max(1, Math.floor(width * 0.25));
    const isNearMin = width > 2 && safePosition <= targetSegment.min + edgeSlots - 1;
    const isNearMax = width > 2 && safePosition >= targetSegment.max - edgeSlots + 1;

    if (isNearMin || isNearMax) {
        return {
            operation: "insert",
            position: safePosition,
            min: safePosition,
            max: safePosition,
            targetSegment,
            projectedSegments: segments,
            insertPreserveSide: isNearMin ? "upper" : "lower",
        };
    }

    return {
        operation: "replace",
        position: safePosition,
        min: targetSegment.min,
        max: targetSegment.max,
        targetSegment,
        projectedSegments: segments,
    };
}

function sortRangeSegments(segments: ArticulationRangeSegmentView[]) {
    return [...segments].sort((left, right) => left.min - right.min || left.max - right.max);
}

function cardToPreviewSegment(
    cardsById: Map<string, ArticulationCardView>,
    articulationId: string,
    min: number,
    max: number,
): ArticulationRangeSegmentView | null {
    const card = cardsById.get(articulationId);

    if (!card) {
        return null;
    }

    return {
        id: `preview-${articulationId}-${min}-${max}`,
        articulationId,
        label: card.name,
        color: card.color,
        min,
        max,
        isSelected: true,
        isPreview: true,
    };
}

function removeOtherSegmentsForArticulation(
    segments: ArticulationRangeSegmentView[],
    articulationId: string,
    keepSegmentId: string | null = null,
) {
    return segments.filter((segment) => (
        segment.articulationId !== articulationId
        || (keepSegmentId !== null && segment.id === keepSegmentId)
    ));
}

function findExistingSegmentForArticulation(
    segments: ArticulationRangeSegmentView[],
    articulationId: string | null,
) {
    if (!articulationId) {
        return null;
    }

    return segments.find((segment) => segment.articulationId === articulationId) ?? null;
}

function centerSegmentRangeAtPosition(
    segment: ArticulationRangeSegmentView,
    position: number,
    minValue: number,
    maxValue: number,
) {
    const width = Math.max(1, segment.max - segment.min + 1);
    const min = clamp(
        Math.round(position) - Math.floor(width / 2),
        minValue,
        Math.max(minValue, maxValue - width + 1),
    );

    return {
        min,
        max: min + width - 1,
    };
}

function carveSegmentAroundRange(
    segment: ArticulationRangeSegmentView,
    carvedMin: number,
    carvedMax: number,
) {
    if (segment.max < carvedMin || segment.min > carvedMax) {
        return [{ ...segment }];
    }

    if (carvedMin <= segment.min && carvedMax >= segment.max) {
        return [];
    }

    if (carvedMin <= segment.min) {
        const min = carvedMax + 1;
        return min <= segment.max ? [{ ...segment, min, isPreviewAffected: true }] : [];
    }

    if (carvedMax >= segment.max) {
        const max = carvedMin - 1;
        return max >= segment.min ? [{ ...segment, max, isPreviewAffected: true }] : [];
    }

    const left = { ...segment, max: carvedMin - 1, isPreviewAffected: true };
    const right = { ...segment, min: carvedMax + 1, isPreviewAffected: true };
    const leftWidth = left.max - left.min + 1;
    const rightWidth = right.max - right.min + 1;

    return leftWidth >= rightWidth ? [left] : [right];
}

function projectRangeMove(
    segments: ArticulationRangeSegmentView[],
    sourceSegment: ArticulationRangeSegmentView,
    position: number,
    minValue: number,
    maxValue: number,
) {
    const nextRange = centerSegmentRangeAtPosition(sourceSegment, position, minValue, maxValue);
    const nextSegment = {
        ...sourceSegment,
        ...nextRange,
        isSelected: true,
        isPreview: true,
    };

    return sortRangeSegments([
        ...segments
            .filter((segment) => segment.id !== sourceSegment.id)
            .flatMap((segment) => carveSegmentAroundRange(segment, nextRange.min, nextRange.max)),
        nextSegment,
    ]);
}

function projectRangePlacement({
    segments,
    cardsById,
    articulationId,
    preview,
    minValue,
    maxValue,
}: {
    segments: ArticulationRangeSegmentView[];
    cardsById: Map<string, ArticulationCardView>;
    articulationId: string | null;
    preview: ArticulationPlacementPreview;
    minValue: number;
    maxValue: number;
}) {
    if (!articulationId) {
        return sortRangeSegments(segments);
    }

    const nextSegment = cardToPreviewSegment(cardsById, articulationId, preview.min, preview.max);

    if (!nextSegment) {
        return sortRangeSegments(segments);
    }

    if (preview.operation === "replace" && preview.targetSegment) {
        return sortRangeSegments(removeOtherSegmentsForArticulation(
            segments.map((segment) => (
                segment.id === preview.targetSegment?.id
                    ? {
                        ...segment,
                        articulationId,
                        label: nextSegment.label,
                        color: nextSegment.color,
                        isSelected: true,
                        isPreview: true,
                    }
                    : segment
            )),
            articulationId,
            preview.targetSegment.id,
        ));
    }

    if (preview.operation === "fill") {
        return sortRangeSegments([
            ...removeOtherSegmentsForArticulation(segments, articulationId),
            nextSegment,
        ]);
    }

    if (!preview.targetSegment || preview.targetSegment.articulationId === articulationId) {
        return sortRangeSegments(segments);
    }

    const target = preview.targetSegment;
    const trimFromMin = preview.insertPreserveSide === "upper"
        || (
            preview.insertPreserveSide !== "lower"
            && preview.position - target.min <= target.max - preview.position
        );
    const trimmedSegments = segments.flatMap((segment) => {
        if (segment.id !== target.id) {
            return [segment];
        }

        if (trimFromMin) {
            const min = clamp(preview.position + 1, minValue, maxValue);
            return min <= segment.max ? [{ ...segment, min, isPreviewAffected: true }] : [];
        }

        const max = clamp(preview.position - 1, minValue, maxValue);
        return max >= segment.min ? [{ ...segment, max, isPreviewAffected: true }] : [];
    });

    return sortRangeSegments([
        ...removeOtherSegmentsForArticulation(trimmedSegments, articulationId),
        nextSegment,
    ]);
}

function projectRangeResize(
    segments: ArticulationRangeSegmentView[],
    target: ArticulationRangeSegmentView,
    edge: ArticulationRangeEditEdge,
    position: number,
    minValue: number,
    maxValue: number,
) {
    const nextTarget = edge === "min"
        ? { ...target, min: clamp(position, minValue, target.max), isSelected: true, isPreview: true }
        : { ...target, max: clamp(position, target.min, maxValue), isSelected: true, isPreview: true };

    return sortRangeSegments([
        ...segments
            .filter((segment) => segment.id !== target.id)
            .flatMap((segment) => {
                if (edge === "min" && segment.max >= nextTarget.min && segment.max < target.min) {
                    const max = nextTarget.min - 1;
                    return segment.min <= max ? [{ ...segment, max, isPreviewAffected: true }] : [];
                }

                if (edge === "max" && segment.min <= nextTarget.max && segment.min > target.max) {
                    const min = nextTarget.max + 1;
                    return min <= segment.max ? [{ ...segment, min, isPreviewAffected: true }] : [];
                }

                return [segment];
            }),
        nextTarget,
    ]);
}

function findBoundaryResizeCandidate(
    segments: ArticulationRangeSegmentView[],
    segment: ArticulationRangeSegmentView,
    edge: ArticulationRangeEditEdge,
) {
    if (edge === "max") {
        const rightSegment = segments.find((candidate) => candidate.min === segment.max + 1) ?? null;
        return rightSegment ? { leftSegment: segment, rightSegment } : null;
    }

    const leftSegment = segments.find((candidate) => candidate.max === segment.min - 1) ?? null;
    return leftSegment ? { leftSegment, rightSegment: segment } : null;
}

function resolveBoundaryResizeState(
    dragState: ArticulationRangePointerDragState,
    clientX: number,
): ArticulationRangePointerDragState {
    if (dragState.kind !== "boundary-resize") {
        return dragState;
    }

    const deltaX = clientX - dragState.startX;

    if (Math.abs(deltaX) <= 3) {
        return dragState;
    }

    const dragMovesRight = deltaX > 0;

    return {
        kind: "resize",
        segment: dragMovesRight ? dragState.rightSegment : dragState.leftSegment,
        edge: dragMovesRight ? "min" : "max",
        pointerId: dragState.pointerId,
        startX: dragState.startX,
        moved: true,
    };
}

function resizeEdgeFromSegmentPointer(
    clientX: number,
    rect: DOMRect,
    canResizeMin: boolean,
    canResizeMax: boolean,
): ArticulationRangeEditEdge | null {
    const leftDistance = Math.abs(clientX - rect.left);
    const rightDistance = Math.abs(rect.right - clientX);
    const nearMin = canResizeMin && leftDistance <= RANGE_EDGE_RESIZE_HIT_PX;
    const nearMax = canResizeMax && rightDistance <= RANGE_EDGE_RESIZE_HIT_PX;

    if (nearMin && nearMax) {
        return leftDistance <= rightDistance ? "min" : "max";
    }

    if (nearMin) {
        return "min";
    }

    if (nearMax) {
        return "max";
    }

    return null;
}

function ArticulationRangeLane({
    mode,
    label,
    cards,
    segments,
    selectedArticulationId,
    draggedArticulationId,
    heldInput,
    onSelectSegment,
    onAssignAtPosition,
    onInsertAtPosition,
    onDuplicateAndAssignAtPosition,
    onMoveSegment,
    onResizeSegment,
    onClearSegment,
    onClearAll,
    onDistribute,
    minValue,
    maxValue,
    minLabel,
    maxLabel,
}: ArticulationRangeLaneProps) {
    const laneRef = useRef<HTMLDivElement | null>(null);
    const [placementPreview, setPlacementPreview] = useState<ArticulationPlacementPreview | null>(null);
    const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
    const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
    const [activeResizeSegmentId, setActiveResizeSegmentId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [rangeMenu, setRangeMenu] = useState<ArticulationRangeMenuState | null>(null);
    const dragStateRef = useRef<ArticulationRangePointerDragState | null>(null);
    const rangeThirds = useMemo(() => buildRangeThirds(minValue, maxValue), [maxValue, minValue]);
    const [activeThird, setActiveThird] = useState<ArticulationRangeThird>(0);
    const fullTotalSlots = Math.max(1, maxValue - minValue + 1);
    const visibleRange = rangeThirds[activeThird] ?? rangeThirds[0];
    const viewMinValue = visibleRange.min;
    const viewMaxValue = visibleRange.max;
    const viewTotalSlots = Math.max(1, viewMaxValue - viewMinValue + 1);
    const safeHeldValue = heldValueForMode(mode, heldInput);
    const heldValue = safeHeldValue === null ? null : clamp(safeHeldValue, minValue, maxValue);
    const heldValueIsVisible = heldValue !== null && heldValue >= viewMinValue && heldValue <= viewMaxValue;
    const heldThird = findRangeThirdForValue(rangeThirds, heldValue);
    const fullSegments = useMemo(() => sortRangeSegments(segments), [segments]);
    const visibleSegments = useMemo(() => (
        clipSegmentsToRange(fullSegments, viewMinValue, viewMaxValue)
    ), [fullSegments, viewMaxValue, viewMinValue]);
    const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
    const selectedSegment = useMemo(() => (
        focusedSegmentId
            ? visibleSegments.find((segment) => segment.id === focusedSegmentId) ?? null
            : null
    ), [focusedSegmentId, visibleSegments]);

    const showToast = useCallback((message: string) => {
        setToast(message);
        window.setTimeout(() => {
            setToast((currentMessage) => (currentMessage === message ? null : currentMessage));
        }, 1800);
    }, []);

    const positionFromClientX = useCallback((clientX: number) => {
        const rect = laneRef.current?.getBoundingClientRect();
        if (!rect) {
            return viewMinValue;
        }
        const ratio = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        return Math.round(viewMinValue + ratio * (viewMaxValue - viewMinValue));
    }, [viewMaxValue, viewMinValue]);

    const positionFromDragEvent = useCallback((event: ReactDragEvent<HTMLDivElement>) => (
        positionFromClientX(event.clientX)
    ), [positionFromClientX]);

    const previewFromPosition = useCallback((
        position: number,
        articulationId: string | null,
        options: { preferMoveExisting?: boolean } = {},
    ) => {
        const sourceSegment = options.preferMoveExisting
            ? findExistingSegmentForArticulation(fullSegments, articulationId)
            : null;

        if (sourceSegment) {
            const projectedSegments = projectRangeMove(fullSegments, sourceSegment, position, minValue, maxValue);
            const projectedSource = projectedSegments.find((segment) => segment.id === sourceSegment.id) ?? sourceSegment;

            return {
                operation: "move" as const,
                position: clamp(Math.round(position), minValue, maxValue),
                min: projectedSource.min,
                max: projectedSource.max,
                targetSegment: sourceSegment,
                projectedSegments,
            };
        }

        const previewSegments = visibleSegments.map((segment) => ({
            ...segment,
            min: segment.visibleMin,
            max: segment.visibleMax,
        }));
        const visiblePreview = classifyRangePlacementPreview({
            segments: previewSegments,
            position,
            minValue: viewMinValue,
            maxValue: viewMaxValue,
        });
        const preview = {
            ...visiblePreview,
            projectedSegments: fullSegments,
        };

        const projectedPreview = {
            ...preview,
            projectedSegments: projectRangePlacement({
                segments: fullSegments,
                cardsById: cardById,
                articulationId,
                preview,
                minValue,
                maxValue,
            }),
        };

        return projectedPreview;
    }, [cardById, fullSegments, maxValue, minValue, viewMaxValue, viewMinValue, visibleSegments]);

    const runEdit = useCallback((didChange: boolean) => {
        if (!didChange) {
            showToast("No room for that mapping");
        }
    }, [showToast]);

    const placeArticulationAtPosition = useCallback((
        position: number,
        articulationId: string,
        duplicate: boolean,
        options: { preferMoveExisting?: boolean } = {},
    ) => {
        const preview = previewFromPosition(position, articulationId, {
            preferMoveExisting: !duplicate && options.preferMoveExisting,
        });
        if (preview.operation === "move" && preview.targetSegment) {
            runEdit(onMoveSegment(mode, preview.targetSegment, position));
            return;
        }

        const operation = preview.operation === "insert" ? "insert" : "assign";

        runEdit(
            duplicate
                ? onDuplicateAndAssignAtPosition(mode, preview.position, articulationId, operation)
                : operation === "insert"
                    ? onInsertAtPosition(mode, preview.position, articulationId, preview.insertPreserveSide)
                    : onAssignAtPosition(mode, preview.position, articulationId),
        );
    }, [
        mode,
        onAssignAtPosition,
        onDuplicateAndAssignAtPosition,
        onInsertAtPosition,
        onMoveSegment,
        previewFromPosition,
        runEdit,
    ]);

    const assignSelectedAtPosition = useCallback((position: number) => {
        if (!selectedArticulationId) {
            showToast("Select an articulation first");
            return;
        }

        placeArticulationAtPosition(position, selectedArticulationId, false);
    }, [
        placeArticulationAtPosition,
        selectedArticulationId,
        showToast,
    ]);

    const replaceSelectedAtPosition = useCallback((position: number) => {
        if (!selectedArticulationId) {
            showToast("Select an articulation first");
            return;
        }

        runEdit(onAssignAtPosition(mode, position, selectedArticulationId));
    }, [
        mode,
        onAssignAtPosition,
        runEdit,
        selectedArticulationId,
        showToast,
    ]);

    const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const draggedId = readDraggedArticulationId(event) ?? draggedArticulationId;
        const articulationId = draggedId ?? selectedArticulationId;
        const preview = previewFromPosition(positionFromDragEvent(event), articulationId, {
            preferMoveExisting: Boolean(draggedId) && !event.altKey,
        });
        event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
        setPlacementPreview(preview);
    }, [draggedArticulationId, positionFromDragEvent, previewFromPosition, selectedArticulationId]);

    const handleDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
        }
        setPlacementPreview(null);
    }, []);

    const handleDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const draggedId = readDraggedArticulationId(event) ?? draggedArticulationId;
        const articulationId = draggedId ?? selectedArticulationId;
        const position = positionFromDragEvent(event);
        setPlacementPreview(null);
        if (!articulationId) {
            return;
        }
        placeArticulationAtPosition(position, articulationId, event.altKey, {
            preferMoveExisting: Boolean(draggedId),
        });
    }, [
        placeArticulationAtPosition,
        positionFromDragEvent,
        draggedArticulationId,
        selectedArticulationId,
    ]);

    const finishPointerEdit = useCallback((clientX: number, cancelled = false) => {
        const dragState = dragStateRef.current
            ? resolveBoundaryResizeState(dragStateRef.current, clientX)
            : null;
        dragStateRef.current = null;
        setActiveResizeSegmentId(null);
        setPlacementPreview(null);

        if (!dragState || cancelled) {
            return;
        }

        const position = positionFromClientX(clientX);

        if (!dragState.moved) {
            const selectedDragSegment = dragState.kind === "boundary-resize"
                ? dragState.originalSegment
                : dragState.segment;
            setFocusedSegmentId(selectedDragSegment.id);
            onSelectSegment(mode, selectedDragSegment);
            return;
        }

        if (dragState.kind === "boundary-resize") {
            return;
        }

        runEdit(
            dragState.kind === "resize"
                ? onResizeSegment(mode, dragState.segment, dragState.edge ?? "max", position)
                : onMoveSegment(mode, dragState.segment, position),
        );
    }, [
        mode,
        onMoveSegment,
        onResizeSegment,
        onSelectSegment,
        positionFromClientX,
        runEdit,
    ]);

    const startResizePointerDrag = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
    ) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setFocusedSegmentId(segment.id);
        setHoveredSegmentId(segment.id);
        setActiveResizeSegmentId(segment.id);
        const boundaryCandidate = findBoundaryResizeCandidate(fullSegments, segment, edge);
        dragStateRef.current = boundaryCandidate
            ? {
                kind: "boundary-resize",
                leftSegment: boundaryCandidate.leftSegment,
                rightSegment: boundaryCandidate.rightSegment,
                originalSegment: segment,
                pointerId: event.pointerId,
                startX: event.clientX,
                moved: false,
            }
            : {
                kind: "resize",
                segment,
                edge,
                pointerId: event.pointerId,
                startX: event.clientX,
                moved: false,
            };
    }, [fullSegments]);

    const handleSegmentPointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
    ) => {
        if (event.button !== 0) {
            return;
        }
        const canResizeMin = segment.min >= viewMinValue;
        const canResizeMax = segment.max <= viewMaxValue;
        const resizeEdge = resizeEdgeFromSegmentPointer(
            event.clientX,
            event.currentTarget.getBoundingClientRect(),
            canResizeMin,
            canResizeMax,
        );

        if (resizeEdge) {
            startResizePointerDrag(event, segment, resizeEdge);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setHoveredSegmentId(segment.id);
        dragStateRef.current = {
            kind: "move",
            segment,
            pointerId: event.pointerId,
            startX: event.clientX,
            moved: false,
        };
    }, [startResizePointerDrag, viewMaxValue, viewMinValue]);

    const handleResizePointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
    ) => {
        startResizePointerDrag(event, segment, edge);
    }, [startResizePointerDrag]);

    const handleSegmentPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const currentDragState = dragStateRef.current;

        if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
            return;
        }

        const dragState = resolveBoundaryResizeState(currentDragState, event.clientX);

        if (dragState.kind !== currentDragState.kind) {
            dragStateRef.current = dragState;
            setFocusedSegmentId(dragState.segment.id);
            setHoveredSegmentId(dragState.segment.id);
            setActiveResizeSegmentId(dragState.segment.id);
        }

        if (Math.abs(event.clientX - dragState.startX) > 3) {
            dragState.moved = true;
        }

        if (dragState.kind === "boundary-resize") {
            dragStateRef.current = dragState;
            return;
        }

        dragStateRef.current = dragState;
        const position = positionFromClientX(event.clientX);
        const projectedSegments = dragState.kind === "resize"
            ? projectRangeResize(fullSegments, dragState.segment, dragState.edge ?? "max", position, minValue, maxValue)
            : projectRangeMove(fullSegments, dragState.segment, position, minValue, maxValue);
        const projectedTarget = projectedSegments.find((segment) => segment.id === dragState.segment.id) ?? dragState.segment;
        setPlacementPreview({
            operation: dragState.kind === "resize" ? "replace" : "move",
            position,
            min: projectedTarget.min,
            max: projectedTarget.max,
            targetSegment: dragState.segment,
            projectedSegments,
        });
    }, [fullSegments, maxValue, minValue, positionFromClientX]);

    const handleSegmentPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishPointerEdit(event.clientX);
    }, [finishPointerEdit]);

    const handleSegmentPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishPointerEdit(event.clientX, true);
    }, [finishPointerEdit]);

    const handleSegmentPointerEnter = useCallback((segment: ArticulationRangeSegmentView) => {
        setHoveredSegmentId(segment.id);
    }, []);

    const handleSegmentPointerLeave = useCallback((segment: ArticulationRangeSegmentView) => {
        const dragState = dragStateRef.current;
        const activeDragSegmentId = dragState?.kind === "boundary-resize"
            ? dragState.originalSegment.id
            : dragState?.segment.id;

        if (activeDragSegmentId === segment.id) {
            return;
        }
        setHoveredSegmentId((currentSegmentId) => (
            currentSegmentId === segment.id ? null : currentSegmentId
        ));
    }, []);

    const handleLaneKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if ((event.key === "Delete" || event.key === "Backspace") && selectedSegment) {
            event.preventDefault();
            event.stopPropagation();
            runEdit(onClearSegment(mode, selectedSegment));
        }
    }, [mode, onClearSegment, runEdit, selectedSegment]);

    const mobileRows = useMemo(() => {
        const rows: Array<{
            kind: "segment" | "gap";
            min: number;
            max: number;
            segment?: ArticulationRangeSegmentView;
        }> = [];
        let cursor = minValue;

        for (const segment of visibleSegments) {
            if (cursor < segment.visibleMin) {
                rows.push({ kind: "gap", min: cursor, max: segment.visibleMin - 1 });
            }
            rows.push({ kind: "segment", min: segment.visibleMin, max: segment.visibleMax, segment });
            cursor = segment.visibleMax + 1;
        }

        if (cursor <= maxValue) {
            rows.push({ kind: "gap", min: cursor, max: maxValue });
        }

        return rows;
    }, [maxValue, minValue, visibleSegments]);
    const displayedSegments = useMemo(() => {
        const sourceSegments = placementPreview?.projectedSegments ?? fullSegments;
        return clipSegmentsToRange(sourceSegments, viewMinValue, viewMaxValue);
    }, [fullSegments, placementPreview?.projectedSegments, viewMaxValue, viewMinValue]);
    const previewSegment = placementPreview
        ? displayedSegments.find((segment) => segment.isPreview) ?? null
        : null;
    const tickValues = useMemo(() => (
        Array.from({ length: viewTotalSlots }, (_, index) => viewMinValue + index)
    ), [viewMinValue, viewTotalSlots]);
    const labeledTickValues = useMemo(() => (
        tickValues.filter((value) => value !== viewMinValue && value !== viewMaxValue && value % 10 === 0)
    ), [tickValues, viewMaxValue, viewMinValue]);

    const openRangeMenu = useCallback((
        event: ReactMouseEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setRangeMenu({
            segment,
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    const handleRangeMenuAction = useCallback((action: ArticulationRangeMenuAction) => {
        if (!rangeMenu) {
            return;
        }

        const { segment } = rangeMenu;
        setRangeMenu(null);

        switch (action) {
            case "delete":
                runEdit(onClearSegment(mode, segment));
                return;
            case "insert-after":
                if (!selectedArticulationId) {
                    showToast("Select an articulation first");
                    return;
                }
                runEdit(onInsertAtPosition(mode, clamp(segment.max + 1, minValue, maxValue), selectedArticulationId));
                return;
            case "duplicate-after":
                runEdit(onDuplicateAndAssignAtPosition(mode, clamp(segment.max + 1, minValue, maxValue), segment.articulationId, "insert"));
                return;
            case "replace":
                if (!selectedArticulationId) {
                    showToast("Select an articulation first");
                    return;
                }
                runEdit(onAssignAtPosition(mode, segment.min, selectedArticulationId));
        }
    }, [
        maxValue,
        minValue,
        mode,
        onAssignAtPosition,
        onClearSegment,
        onDuplicateAndAssignAtPosition,
        onInsertAtPosition,
        rangeMenu,
        runEdit,
        selectedArticulationId,
        showToast,
    ]);

    return (
        <div className={joinClasses(FRAME_CLASS, "flex flex-col gap-1.5 px-2.5 py-2")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[0.04em] text-slate-100/82">
                        {label}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums tracking-[0.02em] text-slate-300/45">
                        {`${segments.length}/${fullTotalSlots}`}
                    </span>
                    <span
                        data-role="articulation-range-viewport-label"
                        className="hidden font-mono text-[9px] tabular-nums tracking-[0.02em] text-slate-300/55 sm:inline"
                    >
                        {formatLaneRange(mode, viewMinValue, viewMaxValue)}
                    </span>
                    <div
                        data-role="articulation-placement-readout"
                        className="ml-1 hidden h-4 items-center font-mono text-[9px] tabular-nums tracking-[0.02em] text-cyan-100/85 sm:inline-flex"
                    >
                        {placementPreview ? (
                            <span>
                                {`${placementPreview.operation} ${formatLaneRange(mode, placementPreview.min, placementPreview.max)}`}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {selectedSegment ? (
                        <button
                            type="button"
                            onClick={() => runEdit(onClearSegment(mode, selectedSegment))}
                            className={LANE_ACTION_CLASS_PINK}
                            data-role="articulation-clear-segment"
                        >
                            Clear
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => onClearAll(mode)}
                        className={LANE_ACTION_CLASS}
                        data-role="articulation-clear-all"
                    >
                        Clear All
                    </button>
                    {onDistribute ? (
                        <button
                            type="button"
                            onClick={() => onDistribute(mode)}
                            className={LANE_ACTION_CLASS}
                            data-role="articulation-distribute"
                        >
                            Distribute
                        </button>
                    ) : null}
                </div>
            </div>
            <div
                ref={laneRef}
                data-role="articulation-range-lane"
                data-preview={placementPreview ? "true" : "false"}
                data-viewport-index={String(activeThird)}
                data-viewport-min={String(viewMinValue)}
                data-viewport-max={String(viewMaxValue)}
                data-held-value={heldValue === null ? "" : String(heldValue)}
                tabIndex={0}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={handleLaneKeyDown}
                className={joinClasses(
                    "relative hidden h-14 w-full overflow-hidden rounded-[6px] border bg-[#04060c] shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)] outline-none transition focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.55),0_0_0_1px_rgba(103,232,249,0.20)] sm:block",
                    placementPreview
                        ? "border-cyan-300/35 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55),0_0_0_1px_rgba(103,232,249,0.20)]"
                        : "border-white/[0.05] focus:border-cyan-200/45",
                )}
            >
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    {Array.from({ length: Math.ceil(viewTotalSlots / 5) }).map((_, index) => (
                        <span
                            key={`band-${index}`}
                            className={joinClasses(
                                "absolute top-0 h-full",
                                index % 2 === 0 ? "bg-white/[0.012]" : "bg-transparent",
                            )}
                            style={{
                                left: `${((index * 5) / viewTotalSlots) * 100}%`,
                                width: `${(Math.min(5, viewTotalSlots - (index * 5)) / viewTotalSlots) * 100}%`,
                            }}
                        />
                    ))}
                    {tickValues.map((value) => {
                        const isTen = value % 10 === 0;
                        const isFive = value % 5 === 0;
                        return (
                            <span
                                key={`tick-${value}`}
                                className={joinClasses(
                                    "absolute top-0 w-px",
                                    isTen
                                        ? "h-[38px] bg-white/[0.10]"
                                        : isFive
                                            ? "h-[38px] bg-white/[0.05]"
                                            : "h-[12px] bg-white/[0.025]",
                                )}
                                style={{ left: `${((value - viewMinValue) / Math.max(1, viewMaxValue - viewMinValue)) * 100}%` }}
                            />
                        );
                    })}
                    {labeledTickValues.map((value) => (
                        <span
                            key={`label-${value}`}
                            className="absolute bottom-0.5 -translate-x-1/2 font-mono text-[8px] tabular-nums tracking-[0.02em] text-slate-300/45"
                            style={{ left: `${((value - viewMinValue) / Math.max(1, viewMaxValue - viewMinValue)) * 100}%` }}
                        >
                            {formatLanePosition(mode, value)}
                        </span>
                    ))}
                </div>
                {heldValueIsVisible && heldValue !== null ? (
                    <span
                        aria-label={`${label} held value ${formatLanePosition(mode, heldValue)}`}
                        data-role="articulation-held-value"
                        data-held-value={String(heldValue)}
                        className="pointer-events-none absolute top-0 z-[4] h-full w-[3px] -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_0_1px_rgba(7,10,19,0.72),0_0_16px_rgba(251,191,36,0.50)]"
                        style={{
                            left: `${((heldValue - viewMinValue + 0.5) / viewTotalSlots) * 100}%`,
                        }}
                    >
                        <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
                    </span>
                ) : null}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[38px]">
                    {displayedSegments.map((segment) => {
                        const visibleMin = clamp(segment.visibleMin ?? segment.min, viewMinValue, viewMaxValue);
                        const visibleMax = clamp(segment.visibleMax ?? segment.max, viewMinValue, viewMaxValue);
                        const left = ((visibleMin - viewMinValue) / viewTotalSlots) * 100;
                        const width = ((visibleMax - visibleMin + 1) / viewTotalSlots) * 100;
                        const isPreview = segment.isPreview === true;
                        const isPreviewAffected = segment.isPreviewAffected === true;
                        const isHighlighted = segment.isSelected || focusedSegmentId === segment.id || isPreview;
                        const canResizeMin = segment.min >= viewMinValue;
                        const canResizeMax = segment.max <= viewMaxValue;
                        const positionStyle: CSSProperties = {
                            left: `${left}%`,
                            width: `${width}%`,
                        };
                        const valueLabel = formatLaneRange(mode, visibleMin, visibleMax);
                        const tier = rangeSegmentTier(width);
                        const nameText = tier === "tiny"
                            ? abbreviateRangeLabel(segment.label, 3)
                            : tier === "medium"
                            ? abbreviateRangeLabel(segment.label, 8)
                            : tier === "small"
                                ? abbreviateRangeLabel(segment.label, 4)
                                : segment.label;
                        const resizeHandlesAreInteractive = hoveredSegmentId === segment.id
                            || activeResizeSegmentId === segment.id;
                        const resizeHandlesAreVisible = resizeHandlesAreInteractive || isHighlighted;
                        return (
                            <button
                                key={segment.id}
                                type="button"
                                aria-label={`Edit ${label} segment ${segment.label}`}
                                data-role="articulation-range-segment"
                                data-segment-id={segment.id}
                                data-articulation-id={segment.articulationId}
                                data-range-min={String(visibleMin)}
                                data-range-max={String(visibleMax)}
                                data-full-range-min={String(segment.min)}
                                data-full-range-max={String(segment.max)}
                                data-preview={isPreview ? "true" : "false"}
                                data-preview-affected={isPreviewAffected ? "true" : "false"}
                                data-selected={segment.isSelected ? "true" : "false"}
                                data-tier={tier}
                                onPointerDown={(event) => handleSegmentPointerDown(event, segment)}
                                onPointerMove={handleSegmentPointerMove}
                                onPointerUp={handleSegmentPointerUp}
                                onPointerCancel={handleSegmentPointerCancel}
                                onPointerEnter={() => handleSegmentPointerEnter(segment)}
                                onPointerLeave={() => handleSegmentPointerLeave(segment)}
                                onContextMenu={(event) => openRangeMenu(event, segment)}
                                title={`${segment.label} ${valueLabel}`}
                                className={joinClasses(
                                    "group pointer-events-auto absolute inset-y-0.5 flex cursor-grab items-center overflow-hidden rounded-[3px] text-[#0a0d18] transition active:cursor-grabbing focus-visible:outline-none",
                                    isPreview
                                        ? "z-[2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.80),0_0_0_1px_rgba(103,232,249,0.75),0_0_14px_rgba(103,232,249,0.28)]"
                                        : isHighlighted
                                        ? "z-[1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_0_0_1px_rgba(252,211,77,0.55)]"
                                        : isPreviewAffected
                                            ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
                                            : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]",
                                )}
                                style={positionStyle}
                            >
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0"
                                    style={{
                                        background: segment.color,
                                        opacity: isPreview ? 0.96 : isHighlighted ? 0.92 : isPreviewAffected ? 0.68 : 0.78,
                                    }}
                                />
                                {tier === "tiny" ? (
                                    <span className="relative flex min-w-0 flex-1 items-center justify-center px-px">
                                        <span
                                            data-role="articulation-range-name"
                                            className="min-w-0 truncate text-center text-[8px] font-black leading-none tracking-[0] text-[#070a13]"
                                        >
                                            {nameText}
                                        </span>
                                        <span
                                            data-role="articulation-range-value"
                                            className="sr-only"
                                        >
                                            {valueLabel}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="relative flex min-w-0 flex-1 items-center justify-between gap-1 px-1.5">
                                        {tier === "small" ? (
                                            <>
                                                <span data-role="articulation-range-name" className="min-w-0 flex-1 truncate text-center text-[9px] font-semibold tracking-[0.02em] text-[#0a0d18]">
                                                    {nameText}
                                                </span>
                                                <span
                                                    data-role="articulation-range-value"
                                                    className="sr-only"
                                                >
                                                    {valueLabel}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span data-role="articulation-range-name" className="min-w-0 truncate text-[9px] font-semibold tracking-[0.02em]">
                                                    {nameText}
                                                </span>
                                                <span
                                                    data-role="articulation-range-value"
                                                    className="shrink-0 rounded-[2px] bg-[#050712]/55 px-1 py-px font-mono text-[9px] tabular-nums tracking-[0.02em] text-white/95"
                                                >
                                                    {valueLabel}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                )}
                                {canResizeMin ? (
                                    <span
                                        role="button"
                                        tabIndex={-1}
                                        aria-label={`Resize ${segment.label} start`}
                                        data-role="articulation-range-resize-min"
                                        data-active={resizeHandlesAreInteractive ? "true" : "false"}
                                        onPointerDown={(event) => handleResizePointerDown(event, segment, "min")}
                                        onPointerMove={handleSegmentPointerMove}
                                        onPointerUp={handleSegmentPointerUp}
                                        onPointerCancel={handleSegmentPointerCancel}
                                        className={joinClasses(
                                            "absolute inset-y-0 left-0 z-10 flex w-1 cursor-ew-resize items-center justify-center bg-black/0 transition before:block before:h-3 before:w-[2px] before:rounded-full before:bg-black/65 before:opacity-0 before:transition before:content-['']",
                                            resizeHandlesAreInteractive ? "pointer-events-auto hover:bg-black/18 hover:before:opacity-95" : "pointer-events-none",
                                            resizeHandlesAreVisible ? "before:opacity-65" : "",
                                            isHighlighted ? "before:bg-black/80" : "",
                                        )}
                                    />
                                ) : null}
                                {canResizeMax ? (
                                    <span
                                        role="button"
                                        tabIndex={-1}
                                        aria-label={`Resize ${segment.label} end`}
                                        data-role="articulation-range-resize-max"
                                        data-active={resizeHandlesAreInteractive ? "true" : "false"}
                                        onPointerDown={(event) => handleResizePointerDown(event, segment, "max")}
                                        onPointerMove={handleSegmentPointerMove}
                                        onPointerUp={handleSegmentPointerUp}
                                        onPointerCancel={handleSegmentPointerCancel}
                                        className={joinClasses(
                                            "absolute inset-y-0 right-0 z-10 flex w-1 cursor-ew-resize items-center justify-center bg-black/0 transition before:block before:h-3 before:w-[2px] before:rounded-full before:bg-black/65 before:opacity-0 before:transition before:content-['']",
                                            resizeHandlesAreInteractive ? "pointer-events-auto hover:bg-black/18 hover:before:opacity-95" : "pointer-events-none",
                                            resizeHandlesAreVisible ? "before:opacity-65" : "",
                                            isHighlighted ? "before:bg-black/80" : "",
                                        )}
                                    />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                {placementPreview && previewSegment ? (
                    <span
                        data-role="articulation-range-ghost-label"
                        className="pointer-events-none absolute top-1 z-[3] inline-flex max-w-[140px] -translate-x-1/2 items-center gap-1 rounded-[4px] bg-[#03050b]/92 px-1.5 py-0.5 font-mono text-[9px] tabular-nums tracking-[0.02em] text-cyan-50 shadow-[0_4px_12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(103,232,249,0.28)]"
                        style={{
                            left: `${(((previewSegment.visibleMin ?? placementPreview.min) + (previewSegment.visibleMax ?? placementPreview.max)) / 2 - viewMinValue + 0.5) / viewTotalSlots * 100}%`,
                        }}
                    >
                        <span className="max-w-[74px] truncate font-semibold tracking-[0.01em] text-cyan-100/92">
                            {previewSegment.label}
                        </span>
                        <span data-role="articulation-range-ghost-value">
                            {formatLaneRange(mode, placementPreview.min, placementPreview.max)}
                        </span>
                    </span>
                ) : null}
                {placementPreview ? (
                    <span
                        data-role="articulation-placement-preview"
                        data-operation={placementPreview.operation}
                        className="sr-only"
                    >
                        {`${placementPreview.operation} ${formatLaneRange(mode, placementPreview.min, placementPreview.max)}`}
                    </span>
                ) : null}
            </div>
            <div
                aria-label={`${label} range viewport`}
                data-role="articulation-range-viewport-dots"
                className="hidden items-center justify-center gap-1 sm:flex"
            >
                {rangeThirds.map((third) => {
                    const isActive = third.index === activeThird;
                    const containsHeldValue = heldValue !== null && third.index === heldThird;

                    return (
                        <button
                            key={third.index}
                            type="button"
                            aria-label={`${label} ${labelRangeThird(third.index)} range ${formatLaneRange(mode, third.min, third.max)}`}
                            aria-pressed={isActive}
                            data-role="articulation-range-viewport-dot"
                            data-viewport-index={String(third.index)}
                            data-held={containsHeldValue ? "true" : "false"}
                            onClick={() => setActiveThird(third.index)}
                            className={joinClasses(
                                "h-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-200/45",
                                isActive
                                    ? "w-4 bg-cyan-200/85 shadow-[0_0_10px_rgba(103,232,249,0.25)]"
                                    : containsHeldValue
                                        ? "w-1.5 bg-amber-200/90 shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                                        : "w-1.5 bg-slate-400/28 hover:bg-slate-200/55",
                            )}
                        />
                    );
                })}
            </div>
            <div className="grid gap-1.5 sm:hidden" data-role="articulation-range-list">
                {mobileRows.map((row) => {
                    const key = `${row.kind}-${row.min}-${row.max}-${row.segment?.id ?? "gap"}`;
                    const labelText = formatLaneRange(mode, row.min, row.max);

                    if (row.kind === "gap") {
                        return (
                            <button
                                key={key}
                                type="button"
                                data-role="articulation-range-gap-row"
                                onClick={() => assignSelectedAtPosition(row.min)}
                                className="flex min-h-11 items-center justify-between rounded-[6px] border border-dashed border-white/[0.08] bg-transparent px-2.5 font-mono text-[10px] tabular-nums uppercase tracking-[0.14em] text-slate-300/55 transition hover:border-white/20 hover:bg-white/[0.025] hover:text-slate-100 active:bg-white/[0.04]"
                            >
                                <span>{labelText}</span>
                                <span className="text-slate-300/35">Fill</span>
                            </button>
                        );
                    }

                    const segment = row.segment;

                    if (!segment) {
                        return null;
                    }

                    const isFocused = focusedSegmentId === segment.id;

                    return (
                        <div key={key} className="grid gap-1">
                            <button
                                type="button"
                                data-role="articulation-range-insert-row"
                                onClick={() => {
                                    if (!selectedArticulationId) {
                                        showToast("Select an articulation first");
                                        return;
                                    }
                                    runEdit(onInsertAtPosition(mode, row.min, selectedArticulationId));
                                }}
                                className="flex min-h-8 items-center justify-center rounded-[5px] border border-dashed border-white/[0.07] bg-transparent px-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-300/45 transition hover:border-amber-200/35 hover:text-amber-100/80 active:bg-amber-300/[0.05]"
                            >
                                Insert at {formatLanePosition(mode, row.min)}
                            </button>
                            <div
                                role="button"
                                tabIndex={0}
                                data-role="articulation-range-segment-row"
                                onClick={() => replaceSelectedAtPosition(row.min)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        replaceSelectedAtPosition(row.min);
                                    }
                                }}
                                className={joinClasses(
                                    "flex min-h-11 items-center gap-2 rounded-[6px] border px-2.5 py-1 text-left transition",
                                    isFocused
                                        ? "border-amber-200/55 bg-amber-300/[0.06] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.20)]"
                                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.035]",
                                )}
                            >
                                <ColorDot color={segment.color} />
                                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-100/90">
                                    {segment.label}
                                </span>
                                <span className="font-mono text-[10px] tabular-nums tracking-[0.04em] text-slate-200/85">
                                    {labelText}
                                </span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        runEdit(onClearSegment(mode, segment));
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            runEdit(onClearSegment(mode, segment));
                                        }
                                    }}
                                    className="ml-1 inline-flex h-7 min-w-[44px] items-center justify-center rounded-[5px] border border-pink-300/15 bg-transparent px-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-pink-200/75 transition hover:border-pink-200/30 hover:bg-pink-300/[0.06] hover:text-pink-100"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {toast ? (
                <div
                    role="status"
                    data-role="articulation-lane-toast"
                    className="rounded-[7px] border border-pink-300/22 bg-pink-300/[0.08] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-pink-100/90 shadow-[inset_0_1px_0_rgba(244,114,182,0.12)]"
                >
                    {toast}
                </div>
            ) : null}
            <div className="flex items-center justify-between font-mono text-[9px] tabular-nums tracking-[0.04em] text-slate-200/65">
                <span className="flex items-center gap-1">
                    <span className="text-slate-300/35">view</span>
                    <span className="text-slate-100/82">{formatLanePosition(mode, viewMinValue)}</span>
                </span>
                <span className="flex items-center gap-1">
                    <span className="text-slate-100/82">{formatLanePosition(mode, viewMaxValue)}</span>
                    <span className="text-slate-300/35">{`${minLabel}-${maxLabel}`}</span>
                </span>
            </div>
            {rangeMenu ? (
                <ArticulationRangeContextMenu
                    state={rangeMenu}
                    hasSelectedArticulation={Boolean(selectedArticulationId)}
                    onClose={() => setRangeMenu(null)}
                    onSelectAction={handleRangeMenuAction}
                />
            ) : null}
        </div>
    );
}

function MappingEditor(props: {
    activeMode: ArticulationTriggerMode;
    cards: ArticulationCardView[];
    selectedArticulationId: string | null;
    draggedArticulationId: string | null;
    heldInput?: ArticulationHeldInputView;
    chainSegments: ArticulationRangeSegmentView[];
    keySegments: ArticulationRangeSegmentView[];
    velocitySegments: ArticulationRangeSegmentView[];
    keyboardMinNote: number;
    keyboardMaxNote: number;
    onSelectRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertRangePosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        preserveSide?: ArticulationInsertPreserveSide,
    ) => boolean;
    onDuplicateAndAssignRangePosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        operation: "assign" | "insert",
    ) => boolean;
    onMoveRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView, position: number) => boolean;
    onResizeRangeSegment: (
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
        position: number,
    ) => boolean;
    onClearRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => boolean;
    onClearRangeMode: (mode: ArticulationTriggerMode) => void;
    onDistributeRange: (mode: ArticulationTriggerMode) => void;
}) {
    const config = props.activeMode === "vel"
        ? {
            label: "Velocity",
            segments: props.velocitySegments,
            minValue: 1,
            maxValue: ARTICULATION_RANGE_MAX,
            minLabel: "1",
            maxLabel: "127",
            canDistribute: true,
        }
        : props.activeMode === "key"
            ? {
                label: "Key",
                segments: props.keySegments,
                minValue: 0,
                maxValue: ARTICULATION_RANGE_MAX,
                minLabel: formatMidiNoteName(0),
                maxLabel: formatMidiNoteName(ARTICULATION_RANGE_MAX),
                canDistribute: false,
            }
            : {
                label: "Chain",
                segments: props.chainSegments,
                minValue: 0,
                maxValue: ARTICULATION_RANGE_MAX,
                minLabel: "0",
                maxLabel: "127",
                canDistribute: true,
            };

    return (
        <ArticulationRangeLane
            key={props.activeMode}
            mode={props.activeMode}
            label={config.label}
            cards={props.cards}
            segments={config.segments}
            selectedArticulationId={props.selectedArticulationId}
            draggedArticulationId={props.draggedArticulationId}
            heldInput={props.heldInput}
            onSelectSegment={props.onSelectRangeSegment}
            onAssignAtPosition={props.onAssignRangePosition}
            onInsertAtPosition={props.onInsertRangePosition}
            onDuplicateAndAssignAtPosition={props.onDuplicateAndAssignRangePosition}
            onMoveSegment={props.onMoveRangeSegment}
            onResizeSegment={props.onResizeRangeSegment}
            onClearSegment={props.onClearRangeSegment}
            onClearAll={props.onClearRangeMode}
            onDistribute={config.canDistribute ? props.onDistributeRange : undefined}
            minValue={config.minValue}
            maxValue={config.maxValue}
            minLabel={config.minLabel}
            maxLabel={config.maxLabel}
        />
    );
}

function HeaderActions({
    selectedIsDirty,
    selectedName,
    canCapture,
    onCapture,
    onUpdate,
    onRevert,
}: {
    selectedIsDirty: boolean;
    selectedName: string | null;
    canCapture: boolean;
    onCapture: () => void;
    onUpdate: () => void;
    onRevert: () => void;
}) {
    return (
        <div className="flex shrink-0 items-center gap-1.5">
            <button
                type="button"
                aria-label="Capture current parameters as a new articulation"
                data-role="articulation-capture"
                onClick={onCapture}
                disabled={!canCapture}
                className={joinClasses(PILL_BASE, PILL_CYAN, "disabled:opacity-40")}
            >
                Capture
            </button>
            {selectedIsDirty ? (
                <>
                    <button
                        type="button"
                        aria-label="Update selected articulation from current parameters"
                        data-role="articulation-update"
                        onClick={onUpdate}
                        className={joinClasses(PILL_BASE, PILL_AMBER_ACTIVE, "border-amber-200/40 hover:bg-amber-300/16")}
                    >
                        {selectedName ? `Update ${selectedName}` : "Update"}
                    </button>
                    <button
                        type="button"
                        aria-label="Revert current parameters to selected articulation"
                        data-role="articulation-revert"
                        onClick={onRevert}
                        className={joinClasses(PILL_BASE, PILL_PINK)}
                    >
                        Revert
                    </button>
                </>
            ) : null}
        </div>
    );
}

function FloatingArticulationToolbar({
    selectedIsDirty,
    selectedName,
    discardedEditLabel,
    onUpdate,
    onRevert,
    onUndoDiscard,
}: {
    selectedIsDirty: boolean;
    selectedName: string | null;
    discardedEditLabel?: string | null;
    onUpdate: () => void;
    onRevert: () => void;
    onUndoDiscard?: () => void;
}) {
    if (!selectedIsDirty && !discardedEditLabel) {
        return null;
    }

    return (
        <div
            data-role="articulation-floating-toolbar"
            className="pointer-events-none absolute bottom-2 right-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-[7px] border border-white/[0.07] bg-[#070a13]/96 p-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
        >
            {selectedIsDirty ? (
                <span className="pointer-events-auto flex items-center gap-0.5">
                    <span className="max-w-[140px] truncate px-1.5 text-[9px] font-medium tracking-[0.02em] text-amber-100/80">
                        {selectedName ? `Edited ${selectedName}` : "Edited"}
                    </span>
                    <button
                        type="button"
                        aria-label="Update selected articulation from current parameters"
                        data-role="articulation-update-floating"
                        onClick={onUpdate}
                        className={joinClasses(PILL_BASE, PILL_AMBER_ACTIVE, "h-5 rounded-[4px] px-1.5")}
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        aria-label="Revert current parameters to selected articulation"
                        data-role="articulation-revert-floating"
                        onClick={onRevert}
                        className={joinClasses(PILL_BASE, PILL_NEUTRAL, "h-5 rounded-[4px] px-1.5")}
                    >
                        Revert
                    </button>
                </span>
            ) : null}
            {discardedEditLabel && onUndoDiscard ? (
                <span className="pointer-events-auto flex items-center gap-0.5">
                    <span className="max-w-[140px] truncate px-1.5 text-[9px] font-medium tracking-[0.02em] text-pink-100/80">
                        {`Discarded ${discardedEditLabel}`}
                    </span>
                    <button
                        type="button"
                        data-role="articulation-undo-discard-floating"
                        onClick={onUndoDiscard}
                        className={joinClasses(PILL_BASE, PILL_PINK, "h-5 rounded-[4px] px-1.5")}
                    >
                        Undo
                    </button>
                </span>
            ) : null}
        </div>
    );
}

function ActiveModeReadout({ activeMode }: { activeMode: ArticulationTriggerMode }) {
    return (
        <div className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[5px] border border-white/[0.05] bg-black/30 px-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.40)]">
            <span className="text-[9px] tracking-[0.04em] text-slate-300/45">Mode</span>
            <span className="font-mono text-[10px] tracking-[0.04em] text-cyan-200/95">
                {formatModeLabel(activeMode)}
            </span>
        </div>
    );
}

function ExpandToggle({
    isExpanded,
    onToggle,
}: {
    isExpanded: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={isExpanded ? "Collapse articulation editor" : "Expand articulation editor"}
            aria-expanded={isExpanded}
            data-role="articulation-toggle"
            onClick={onToggle}
            className={joinClasses(PILL_BASE, PILL_NEUTRAL, "px-2")}
        >
            <ChevronGlyph direction={isExpanded ? "down" : "up"} />
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
        </button>
    );
}

export function ArticulationControlSurface(props: ArticulationControlSurfaceProps): ReactNode {
    const {
        cards,
        activeMode,
        isExpanded,
        selectedArticulationId,
        selectedIsDirty,
        discardedEditLabel,
        canCapture,
        chainSegments,
        keySegments,
        velocitySegments,
        heldInput,
        keyboardMinNote,
        keyboardMaxNote,
        onToggleExpanded,
        onSelectMode,
        onSelectCard,
        onCardPlayPressStart,
        onCardPlayPressEnd,
        onCapture,
        onUpdate,
        onRevert,
        onUndoDiscard,
        onSelectRangeSegment,
        onAssignRangePosition,
        onInsertRangePosition,
        onDuplicateAndAssignRangePosition,
        onMoveRangeSegment,
        onResizeRangeSegment,
        onClearRangeSegment,
        onClearRangeMode,
        onDistributeRange,
        onRequestRename,
        onRequestDuplicate,
        onRequestReplace,
        onRequestDelete,
    } = props;

    const [cardMenu, setCardMenu] = useState<ArticulationCardMenuState | null>(null);
    const [copiedArticulationId, setCopiedArticulationId] = useState<string | null>(null);
    const [draggedArticulationId, setDraggedArticulationId] = useState<string | null>(null);
    const selectedCard = useMemo(() => (
        selectedArticulationId
            ? cards.find((card) => card.id === selectedArticulationId) ?? null
            : null
    ), [cards, selectedArticulationId]);

    const handleCardContextMenu = useCallback(
        (articulationId: string, x: number, y: number) => {
            const card = cards.find((entry) => entry.id === articulationId);
            setCardMenu({
                articulationId,
                canDelete: card?.canDelete ?? false,
                x,
                y,
            });
        },
        [cards],
    );

    const closeCardMenu = useCallback(() => {
        setCardMenu(null);
    }, []);

    const handleMenuAction = useCallback(
        (action: ArticulationCardMenuAction) => {
            if (!cardMenu) {
                return;
            }
            const id = cardMenu.articulationId;
            setCardMenu(null);
            switch (action) {
                case "rename":
                    onRequestRename(id);
                    return;
                case "duplicate":
                    onRequestDuplicate(id);
                    return;
                case "replace":
                    onRequestReplace(id);
                    return;
                case "delete":
                    onRequestDelete(id);
                    return;
            }
        },
        [cardMenu, onRequestRename, onRequestDuplicate, onRequestReplace, onRequestDelete],
    );

    const handleSurfaceKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
        const usesCommandModifier = event.metaKey || event.ctrlKey;

        if (usesCommandModifier && event.key.toLowerCase() === "c" && selectedCard) {
            event.preventDefault();
            setCopiedArticulationId(selectedCard.id);
            return;
        }

        if (usesCommandModifier && event.key.toLowerCase() === "v" && copiedArticulationId) {
            event.preventDefault();
            onRequestDuplicate(copiedArticulationId);
            return;
        }

        if (
            (event.key === "Delete" || event.key === "Backspace")
            && selectedCard
            && selectedCard.canDelete
        ) {
            event.preventDefault();
            onRequestDelete(selectedCard.id);
        }
    }, [copiedArticulationId, onRequestDelete, onRequestDuplicate, selectedCard]);

    const cardMenuOverlay = cardMenu ? (
        <ArticulationCardContextMenu
            state={cardMenu}
            onClose={closeCardMenu}
            onSelectAction={handleMenuAction}
        />
    ) : null;

    const carousel = (
        <ArticulationCardCarousel
            cards={cards}
            activeMode={activeMode}
            onSelectCard={onSelectCard}
            onCardDragStart={setDraggedArticulationId}
            onCardDragEnd={() => setDraggedArticulationId(null)}
            onPlayPressStart={onCardPlayPressStart}
            onPlayPressEnd={onCardPlayPressEnd}
            onOpenMenu={handleCardContextMenu}
        />
    );

    if (!isExpanded) {
        return (
            <section
                data-role="articulation-control-surface"
                data-state="collapsed"
                aria-label="Articulations"
                onKeyDown={handleSurfaceKeyDown}
                className="relative flex min-h-[100px] shrink-0 items-stretch gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.022] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
            >
                {carousel}
                <div aria-hidden="true" className="w-px shrink-0 self-stretch bg-white/[0.05]" />
                <div className="flex shrink-0 flex-col items-end justify-between gap-1.5">
                    <HeaderActions
                        selectedIsDirty={selectedIsDirty}
                        selectedName={selectedCard?.name ?? null}
                        canCapture={canCapture}
                        onCapture={onCapture}
                        onUpdate={onUpdate}
                        onRevert={onRevert}
                    />
                    <div className="flex items-center gap-1.5">
                        <ActiveModeReadout activeMode={activeMode} />
                        <ExpandToggle isExpanded={false} onToggle={onToggleExpanded} />
                    </div>
                </div>
                {cardMenuOverlay}
            </section>
        );
    }

    return (
        <section
            data-role="articulation-control-surface"
            data-state="expanded"
            aria-label="Articulations"
            onKeyDown={handleSurfaceKeyDown}
            className="relative flex shrink-0 flex-col gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.022] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
        >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
                <ModeSegmentedControl activeMode={activeMode} onSelectMode={onSelectMode} />
                <div className="flex items-center gap-1">
                    <HeaderActions
                        selectedIsDirty={selectedIsDirty}
                        selectedName={selectedCard?.name ?? null}
                        canCapture={canCapture}
                        onCapture={onCapture}
                        onUpdate={onUpdate}
                        onRevert={onRevert}
                    />
                    <ExpandToggle isExpanded onToggle={onToggleExpanded} />
                </div>
            </div>
            {carousel}
            <MappingEditor
                activeMode={activeMode}
                cards={cards}
                        selectedArticulationId={selectedArticulationId}
                        draggedArticulationId={draggedArticulationId}
                        heldInput={heldInput}
                        chainSegments={chainSegments}
                keySegments={keySegments}
                velocitySegments={velocitySegments}
                keyboardMinNote={keyboardMinNote}
                keyboardMaxNote={keyboardMaxNote}
                onSelectRangeSegment={onSelectRangeSegment}
                onAssignRangePosition={onAssignRangePosition}
                onInsertRangePosition={onInsertRangePosition}
                onDuplicateAndAssignRangePosition={onDuplicateAndAssignRangePosition}
                onMoveRangeSegment={onMoveRangeSegment}
                onResizeRangeSegment={onResizeRangeSegment}
                onClearRangeSegment={onClearRangeSegment}
                onClearRangeMode={onClearRangeMode}
                onDistributeRange={onDistributeRange}
            />
            <FloatingArticulationToolbar
                selectedIsDirty={selectedIsDirty}
                selectedName={selectedCard?.name ?? null}
                discardedEditLabel={discardedEditLabel}
                onUpdate={onUpdate}
                onRevert={onRevert}
                onUndoDiscard={onUndoDiscard}
            />
            {cardMenuOverlay}
        </section>
    );
}
