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
};

export const ARTICULATION_DRAG_MIME = "application/x-cosimo-articulation-id";
export const ARTICULATION_RANGE_MAX = 127;

type ArticulationRangeEditEdge = "min" | "max";

export type ArticulationControlSurfaceProps = {
    cards: ArticulationCardView[];
    activeMode: ArticulationTriggerMode;
    isExpanded: boolean;
    selectedArticulationId: string | null;
    selectedIsDirty: boolean;
    canCapture: boolean;
    chainSegments: ArticulationRangeSegmentView[];
    keySegments: ArticulationRangeSegmentView[];
    velocitySegments: ArticulationRangeSegmentView[];
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
    onSelectRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
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

const PILL_BASE = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition";
const PILL_NEUTRAL = "border-white/[0.06] bg-white/[0.025] text-slate-300/72 hover:border-white/15 hover:text-slate-100";
const PILL_AMBER_ACTIVE = "border-amber-200/30 bg-amber-300/12 text-amber-100";
const PILL_CYAN = "border-cyan-300/18 bg-cyan-300/8 text-cyan-100/85 hover:border-cyan-200/30 hover:bg-cyan-300/14";
const PILL_PINK = "border-pink-300/22 bg-pink-300/10 text-pink-100/85 hover:border-pink-200/35 hover:bg-pink-300/16";
const FRAME_CLASS = "rounded-[14px] border border-white/[0.06] bg-white/[0.022]";

function joinClasses(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatModeLabel(mode: ArticulationTriggerMode) {
    return mode === "vel" ? "Vel" : mode === "key" ? "Key" : "Chain";
}

function formatRuntimeSlot(slot: number) {
    return slot.toString().padStart(2, "0");
}

type ArticulationCardMenuAction = "rename" | "duplicate" | "replace" | "delete";

type ArticulationCardMenuState = {
    articulationId: string;
    canDelete: boolean;
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
            className="z-50 min-w-[168px] rounded-[8px] border border-white/[0.08] bg-[#0a0d18]/95 p-1 shadow-[0_14px_36px_rgba(0,0,0,0.55)] backdrop-blur-sm"
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
                            "flex w-full items-center justify-between rounded-[5px] px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] transition",
                            isDisabled
                                ? "cursor-not-allowed text-slate-300/25"
                                : isDelete
                                    ? "text-pink-200/85 hover:bg-pink-300/10 hover:text-pink-100"
                                    : "text-slate-200/80 hover:bg-white/[0.06] hover:text-slate-100",
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
    onPlayPressStart: (articulationId: string) => void;
    onPlayPressEnd: (articulationId: string) => void;
    onOpenMenu: (articulationId: string, x: number, y: number) => void;
};

function ArticulationCard({
    card,
    activeMode,
    onSelect,
    onPlayPressStart,
    onPlayPressEnd,
    onOpenMenu,
}: ArticulationCardProps) {
    const longPressTimerRef = useRef<number | null>(null);
    const handleDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData(ARTICULATION_DRAG_MIME, card.id);
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "copyMove";
    }, [card.id]);

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

        if (event.pointerType === "mouse" || target?.closest('[data-role="articulation-card-play"]')) {
            return;
        }

        const { clientX, clientY } = event;
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
            onOpenMenu(card.id, clientX, clientY);
        }, 520);
    }, [card.id, clearLongPressTimer, onOpenMenu]);

    const containerClass = joinClasses(
        "group relative flex w-[148px] shrink-0 flex-col gap-1.5 rounded-[10px] border px-2 py-1.5 transition cursor-grab active:cursor-grabbing",
        card.isSelected
            ? "border-amber-200/35 bg-amber-300/[0.06]"
            : "border-white/[0.06] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]",
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
            onPointerDown={handleCardPointerDown}
            onPointerMove={clearLongPressTimer}
            onPointerUp={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onClick={() => onSelect(card.id)}
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
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-100/90">
                    {card.name}
                </span>
                <span className="font-mono text-[9px] text-slate-300/40">
                    {formatRuntimeSlot(card.runtimeSlot)}
                </span>
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
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-cyan-300/16 bg-cyan-300/8 text-cyan-100/85 transition hover:border-cyan-200/30 hover:bg-cyan-300/16 active:bg-cyan-300/26"
                >
                    <PlayGlyph />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
                <div className="h-9 overflow-hidden rounded-[5px] border border-white/[0.05]">
                    <MsegThumbnail points={card.msegPoints} color={card.color} />
                </div>
                <div className="h-9 overflow-hidden rounded-[5px] border border-white/[0.05]">
                    <GainEnvelopeThumbnail envelope={card.gainEnvelope} color={card.color} />
                </div>
            </div>
            <div className="flex items-center justify-between gap-1.5">
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-slate-300/55">
                    {card.assignmentLabel || `${formatModeLabel(activeMode).toUpperCase()} -`}
                </span>
                {card.isDirty ? (
                    <span
                        aria-label="Modified"
                        title="Modified"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-pink-300/85"
                    />
                ) : null}
            </div>
        </div>
    );
}

type ArticulationCardCarouselProps = {
    cards: ArticulationCardView[];
    activeMode: ArticulationTriggerMode;
    onSelectCard: (articulationId: string) => void;
    onPlayPressStart: (articulationId: string) => void;
    onPlayPressEnd: (articulationId: string) => void;
    onOpenMenu: (articulationId: string, x: number, y: number) => void;
};

function ArticulationCardCarousel({
    cards,
    activeMode,
    onSelectCard,
    onPlayPressStart,
    onPlayPressEnd,
    onOpenMenu,
}: ArticulationCardCarouselProps) {
    return (
        <div
            data-role="articulation-card-carousel"
            className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto overflow-y-hidden py-0.5 [scrollbar-width:thin]"
        >
            {cards.length === 0 ? (
                <div className="flex h-[88px] items-center justify-center px-2 text-[10px] uppercase tracking-[0.18em] text-slate-300/40">
                    No Articulations
                </div>
            ) : null}
            {cards.map((card) => (
                <ArticulationCard
                    key={card.id}
                    card={card}
                    activeMode={activeMode}
                    onSelect={onSelectCard}
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
            className="inline-flex h-7 items-center gap-1 rounded-[8px] border border-white/[0.06] bg-white/[0.022] p-0.5"
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
                            "h-6 rounded-[6px] px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition",
                            isActive
                                ? "bg-amber-300/14 text-amber-100"
                                : "text-slate-300/65 hover:text-slate-100",
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
    return fromText ? fromText : null;
}

type ArticulationRangeLaneProps = {
    mode: ArticulationTriggerMode;
    label: string;
    segments: ArticulationRangeSegmentView[];
    selectedArticulationId: string | null;
    onSelectSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignAtPosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertAtPosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
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

function ArticulationRangeLane({
    mode,
    label,
    segments,
    selectedArticulationId,
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
    const [dropIndicator, setDropIndicator] = useState<number | null>(null);
    const [editMode, setEditMode] = useState<"assign" | "insert">("assign");
    const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const dragStateRef = useRef<{
        kind: "move" | "resize";
        segment: ArticulationRangeSegmentView;
        edge?: ArticulationRangeEditEdge;
        pointerId: number;
        startX: number;
        moved: boolean;
    } | null>(null);
    const totalSlots = Math.max(1, maxValue - minValue + 1);
    const visibleSegments = useMemo(() => (
        segments
            .map((segment) => ({
                ...segment,
                visibleMin: clamp(segment.min, minValue, maxValue),
                visibleMax: clamp(segment.max, minValue, maxValue),
            }))
            .filter((segment) => segment.visibleMax >= segment.visibleMin)
    ), [maxValue, minValue, segments]);
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
            return minValue;
        }
        const ratio = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        return Math.round(minValue + ratio * (maxValue - minValue));
    }, [maxValue, minValue]);

    const positionFromDragEvent = useCallback((event: ReactDragEvent<HTMLDivElement>) => (
        positionFromClientX(event.clientX)
    ), [positionFromClientX]);

    const runEdit = useCallback((didChange: boolean) => {
        if (!didChange) {
            showToast("No room for that mapping");
        }
    }, [showToast]);

    const assignSelectedAtPosition = useCallback((position: number) => {
        if (!selectedArticulationId) {
            showToast("Select an articulation first");
            return;
        }

        runEdit(
            editMode === "insert"
                ? onInsertAtPosition(mode, position, selectedArticulationId)
                : onAssignAtPosition(mode, position, selectedArticulationId),
        );
    }, [
        editMode,
        mode,
        onAssignAtPosition,
        onInsertAtPosition,
        runEdit,
        selectedArticulationId,
        showToast,
    ]);

    const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = editMode === "insert" ? "link" : "copy";
        setDropIndicator(positionFromDragEvent(event));
    }, [editMode, positionFromDragEvent]);

    const handleDragLeave = useCallback(() => {
        setDropIndicator(null);
    }, []);

    const handleDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const articulationId = readDraggedArticulationId(event);
        const position = positionFromDragEvent(event);
        setDropIndicator(null);
        if (!articulationId) {
            return;
        }
        const operation = editMode === "insert" ? "insert" : "assign";
        runEdit(
            event.altKey
                ? onDuplicateAndAssignAtPosition(mode, position, articulationId, operation)
                : operation === "insert"
                    ? onInsertAtPosition(mode, position, articulationId)
                    : onAssignAtPosition(mode, position, articulationId),
        );
    }, [
        editMode,
        mode,
        onAssignAtPosition,
        onDuplicateAndAssignAtPosition,
        onInsertAtPosition,
        positionFromDragEvent,
        runEdit,
    ]);

    const handleLaneClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        assignSelectedAtPosition(positionFromClientX(event.clientX));
    }, [assignSelectedAtPosition, positionFromClientX]);

    const finishPointerEdit = useCallback((clientX: number, cancelled = false) => {
        const dragState = dragStateRef.current;
        dragStateRef.current = null;
        setDropIndicator(null);

        if (!dragState || cancelled) {
            return;
        }

        const position = positionFromClientX(clientX);

        if (!dragState.moved && dragState.kind === "move") {
            if (selectedArticulationId && (editMode === "insert" || selectedArticulationId !== dragState.segment.articulationId)) {
                runEdit(
                    editMode === "insert"
                        ? onInsertAtPosition(mode, position, selectedArticulationId)
                        : onAssignAtPosition(mode, position, selectedArticulationId),
                );
                return;
            }

            setFocusedSegmentId(dragState.segment.id);
            onSelectSegment(mode, dragState.segment);
            return;
        }

        runEdit(
            dragState.kind === "resize"
                ? onResizeSegment(mode, dragState.segment, dragState.edge ?? "max", position)
                : onMoveSegment(mode, dragState.segment, position),
        );
    }, [
        editMode,
        mode,
        onAssignAtPosition,
        onInsertAtPosition,
        onMoveSegment,
        onResizeSegment,
        onSelectSegment,
        positionFromClientX,
        runEdit,
        selectedArticulationId,
    ]);

    const handleSegmentPointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragStateRef.current = {
            kind: "move",
            segment,
            pointerId: event.pointerId,
            startX: event.clientX,
            moved: false,
        };
    }, []);

    const handleResizePointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        segment: ArticulationRangeSegmentView,
        edge: ArticulationRangeEditEdge,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setFocusedSegmentId(segment.id);
        dragStateRef.current = {
            kind: "resize",
            segment,
            edge,
            pointerId: event.pointerId,
            startX: event.clientX,
            moved: false,
        };
    }, []);

    const handleSegmentPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const dragState = dragStateRef.current;

        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (Math.abs(event.clientX - dragState.startX) > 3) {
            dragState.moved = true;
        }
        setDropIndicator(positionFromClientX(event.clientX));
    }, [positionFromClientX]);

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

    return (
        <div className={joinClasses(FRAME_CLASS, "flex flex-col gap-2 px-3 py-2")}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300/55">
                        {label}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-300/35">
                        {`${segments.length} / ${totalSlots}`}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        aria-pressed={editMode === "assign"}
                        onClick={() => setEditMode("assign")}
                        className={joinClasses(PILL_BASE, editMode === "assign" ? PILL_AMBER_ACTIVE : PILL_NEUTRAL)}
                        data-role="articulation-lane-assign-mode"
                    >
                        Assign
                    </button>
                    <button
                        type="button"
                        aria-pressed={editMode === "insert"}
                        onClick={() => setEditMode("insert")}
                        className={joinClasses(PILL_BASE, editMode === "insert" ? PILL_AMBER_ACTIVE : PILL_NEUTRAL)}
                        data-role="articulation-lane-insert-mode"
                    >
                        Insert
                    </button>
                    {selectedSegment ? (
                        <button
                            type="button"
                            onClick={() => runEdit(onClearSegment(mode, selectedSegment))}
                            className={joinClasses(PILL_BASE, PILL_PINK)}
                            data-role="articulation-clear-segment"
                        >
                            Clear
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => onClearAll(mode)}
                        className={joinClasses(PILL_BASE, PILL_NEUTRAL)}
                        data-role="articulation-clear-all"
                    >
                        Clear All
                    </button>
                    {onDistribute ? (
                        <button
                            type="button"
                            onClick={() => onDistribute(mode)}
                            className={joinClasses(PILL_BASE, PILL_NEUTRAL)}
                            data-role="articulation-distribute"
                        >
                            Distribute Equally
                        </button>
                    ) : null}
                </div>
            </div>
            <div
                ref={laneRef}
                data-role="articulation-range-lane"
                tabIndex={0}
                onClick={handleLaneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={handleLaneKeyDown}
                className="relative hidden h-10 w-full overflow-hidden rounded-[6px] border border-white/[0.05] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.018)_0px,rgba(255,255,255,0.018)_4px,transparent_4px,transparent_8px)] outline-none focus:border-cyan-200/35 sm:block"
            >
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
                    {visibleSegments.map((segment) => {
                        const left = ((segment.visibleMin - minValue) / totalSlots) * 100;
                        const width = ((segment.visibleMax - segment.visibleMin + 1) / totalSlots) * 100;
                        const positionStyle: CSSProperties = {
                            left: `${left}%`,
                            width: `${width}%`,
                        };
                        return (
                            <button
                                key={segment.id}
                                type="button"
                                aria-label={`Edit ${label} segment ${segment.label}`}
                                data-role="articulation-range-segment"
                                data-segment-id={segment.id}
                                data-articulation-id={segment.articulationId}
                                data-selected={segment.isSelected ? "true" : "false"}
                                onPointerDown={(event) => handleSegmentPointerDown(event, segment)}
                                onPointerMove={handleSegmentPointerMove}
                                onPointerUp={handleSegmentPointerUp}
                                onPointerCancel={handleSegmentPointerCancel}
                                className={joinClasses(
                                    "pointer-events-auto absolute inset-y-0 flex cursor-grab items-center overflow-hidden border font-mono text-[9px] uppercase tracking-[0.14em] text-[#0a0d18] transition active:cursor-grabbing",
                                    segment.isSelected || focusedSegmentId === segment.id
                                        ? "border-amber-100/80 ring-1 ring-amber-100/40"
                                        : "border-white/15 hover:border-white/35",
                                )}
                                style={positionStyle}
                            >
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0"
                                    style={{
                                        backgroundColor: segment.color,
                                        opacity: segment.isSelected ? 0.82 : 0.6,
                                    }}
                                />
                                <span className="relative truncate px-1.5">
                                    {segment.label}
                                </span>
                                <span
                                    role="button"
                                    tabIndex={-1}
                                    aria-label={`Resize ${segment.label} start`}
                                    data-role="articulation-range-resize-min"
                                    onPointerDown={(event) => handleResizePointerDown(event, segment, "min")}
                                    onPointerMove={handleSegmentPointerMove}
                                    onPointerUp={handleSegmentPointerUp}
                                    onPointerCancel={handleSegmentPointerCancel}
                                    className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-white/0 hover:bg-white/25"
                                />
                                <span
                                    role="button"
                                    tabIndex={-1}
                                    aria-label={`Resize ${segment.label} end`}
                                    data-role="articulation-range-resize-max"
                                    onPointerDown={(event) => handleResizePointerDown(event, segment, "max")}
                                    onPointerMove={handleSegmentPointerMove}
                                    onPointerUp={handleSegmentPointerUp}
                                    onPointerCancel={handleSegmentPointerCancel}
                                    className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-white/0 hover:bg-white/25"
                                />
                            </button>
                        );
                    })}
                </div>
                {dropIndicator !== null ? (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 w-px bg-cyan-200/80 shadow-[0_0_8px_rgba(103,232,249,0.6)]"
                        style={{ left: `${((dropIndicator - minValue) / Math.max(1, maxValue - minValue)) * 100}%` }}
                    />
                ) : null}
            </div>
            <div className="grid gap-1.5 sm:hidden" data-role="articulation-range-list">
                {mobileRows.map((row) => {
                    const key = `${row.kind}-${row.min}-${row.max}-${row.segment?.id ?? "gap"}`;
                    const labelText = `${row.min === row.max ? row.min : `${row.min}-${row.max}`}`;

                    if (row.kind === "gap") {
                        return (
                            <button
                                key={key}
                                type="button"
                                data-role="articulation-range-gap-row"
                                onClick={() => assignSelectedAtPosition(row.min)}
                                className="flex min-h-8 items-center justify-between rounded-[7px] border border-dashed border-white/[0.08] bg-white/[0.015] px-2 text-[10px] uppercase tracking-[0.12em] text-slate-300/45"
                            >
                                <span>{labelText}</span>
                                <span>{editMode === "insert" ? "Insert" : "Fill"}</span>
                            </button>
                        );
                    }

                    const segment = row.segment;

                    if (!segment) {
                        return null;
                    }

                    return (
                        <div
                            key={key}
                            data-role="articulation-range-segment-row"
                            className={joinClasses(
                                "flex min-h-9 items-center gap-2 rounded-[7px] border px-2",
                                focusedSegmentId === segment.id
                                    ? "border-amber-100/55 bg-amber-300/10"
                                    : "border-white/[0.06] bg-white/[0.025]",
                            )}
                        >
                            <ColorDot color={segment.color} />
                            <button
                                type="button"
                                onClick={() => {
                                    setFocusedSegmentId(segment.id);
                                    onSelectSegment(mode, segment);
                                }}
                                className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-100/85"
                            >
                                {segment.label}
                            </button>
                            <span className="font-mono text-[10px] text-slate-300/55">{labelText}</span>
                            <button
                                type="button"
                                onClick={() => runEdit(onClearSegment(mode, segment))}
                                className="rounded-[6px] border border-pink-300/18 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-pink-100/80"
                            >
                                Clear
                            </button>
                        </div>
                    );
                })}
            </div>
            {toast ? (
                <div
                    role="status"
                    data-role="articulation-lane-toast"
                    className="rounded-[7px] border border-pink-300/16 bg-pink-300/[0.07] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-pink-100/80"
                >
                    {toast}
                </div>
            ) : null}
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-slate-300/40">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
        </div>
    );
}

function MappingEditor(props: {
    activeMode: ArticulationTriggerMode;
    selectedArticulationId: string | null;
    chainSegments: ArticulationRangeSegmentView[];
    keySegments: ArticulationRangeSegmentView[];
    velocitySegments: ArticulationRangeSegmentView[];
    keyboardMinNote: number;
    keyboardMaxNote: number;
    onSelectRangeSegment: (mode: ArticulationTriggerMode, segment: ArticulationRangeSegmentView) => void;
    onAssignRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    onInsertRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
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
                minValue: props.keyboardMinNote,
                maxValue: props.keyboardMaxNote,
                minLabel: String(props.keyboardMinNote),
                maxLabel: String(props.keyboardMaxNote),
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
            mode={props.activeMode}
            label={config.label}
            segments={config.segments}
            selectedArticulationId={props.selectedArticulationId}
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
    canCapture,
    onCapture,
    onUpdate,
    onRevert,
}: {
    selectedIsDirty: boolean;
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
                        Update
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

function ActiveModeReadout({ activeMode }: { activeMode: ArticulationTriggerMode }) {
    return (
        <div className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border border-white/[0.06] bg-white/[0.018] px-2.5">
            <span className="text-[9px] uppercase tracking-[0.18em] text-slate-300/45">Mode</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/85">
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
        canCapture,
        chainSegments,
        keySegments,
        velocitySegments,
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
                className="flex min-h-[108px] shrink-0 items-stretch gap-2 rounded-[14px] border border-white/[0.05] bg-white/[0.022] px-2.5 py-2"
            >
                {carousel}
                <div className="flex shrink-0 flex-col items-end justify-between gap-1.5 pl-1">
                    <HeaderActions
                        selectedIsDirty={selectedIsDirty}
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
            className="flex shrink-0 flex-col gap-2 rounded-[14px] border border-white/[0.05] bg-white/[0.022] px-2.5 py-2"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ModeSegmentedControl activeMode={activeMode} onSelectMode={onSelectMode} />
                </div>
                <div className="flex items-center gap-1.5">
                    <HeaderActions
                        selectedIsDirty={selectedIsDirty}
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
                selectedArticulationId={selectedArticulationId}
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
            {cardMenuOverlay}
        </section>
    );
}
