import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";

import {
    MODULATION_MAX_ROUTES,
    MODULATION_SOURCE_OPTIONS,
    MODULATION_TARGET_OPTIONS,
    applyModulationSourceOption,
    clampModulationRouteAmount,
    composeModulationAmount,
    formatModulationAmountEditingValue,
    formatModulationAmountReadout,
    getModulationAmountBounds,
    getModulationAmountSliderPosition,
    getModulationSourceOptionValue,
    parseModulationAmountEditingValue,
    type ModulationPolarity,
    type ModulationRoute,
    type ModulationTargetKind,
} from "../shared/modulation";

const MINI_KNOB_VIEWBOX_SIZE = 32;
const MINI_KNOB_CENTER = MINI_KNOB_VIEWBOX_SIZE / 2;
const MINI_KNOB_RADIUS = 12;
const MINI_KNOB_SIDE_SWEEP_DEGREES = 135;
const MINI_KNOB_PIXELS_PER_FULL_TRAVEL = 240;

function polarPointFromTop(center: number, radius: number, degreesFromTop: number) {
    const radians = ((degreesFromTop - 90) * Math.PI) / 180;

    return {
        x: center + (radius * Math.cos(radians)),
        y: center + (radius * Math.sin(radians)),
    };
}

function describeArcPath(
    center: number,
    radius: number,
    startDegreesFromTop: number,
    endDegreesFromTop: number,
) {
    const start = polarPointFromTop(center, radius, startDegreesFromTop);
    const end = polarPointFromTop(center, radius, endDegreesFromTop);
    const largeArcFlag = Math.abs(endDegreesFromTop - startDegreesFromTop) > 180 ? 1 : 0;
    const sweepFlag = endDegreesFromTop >= startDegreesFromTop ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
            <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PlusIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
            <path d="M8 3.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
            <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8.5 4L12.5 8L8.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PowerIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
            <path d="M8 2.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.2 4.1C2.7 5.2 1.75 7 1.75 9.05C1.75 12.34 4.42 15 7.7 15C10.99 15 13.65 12.34 13.65 9.05C13.65 7 12.71 5.22 11.2 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function XIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
            <path d="M4.25 4.25L11.75 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11.75 4.25L4.25 11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function PrototypeSelect({
    value,
    options,
    onChange,
    ariaLabel,
    minWidthPx = 96,
}: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    ariaLabel: string;
    minWidthPx?: number;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value) ?? options[0];
    const longestLabelWidthPx = options.reduce(
        (currentMax, option) => Math.max(currentMax, (option.label.length * 11) + 40),
        minWidthPx,
    );

    return (
        <div className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-expanded={open ? "true" : "false"}
                onClick={() => setOpen((previousOpen) => !previousOpen)}
                className="flex items-center justify-between gap-1 rounded border border-border/40 bg-muted/60 px-2 py-1.5 text-xs font-medium text-foreground transition-all hover:border-border hover:bg-muted"
                style={{ minWidth: `${longestLabelWidthPx}px` }}
            >
                <span className="whitespace-nowrap">{selected?.label}</span>
                <ChevronDownIcon className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="absolute z-50 mt-1 max-h-40 overflow-auto rounded border border-border bg-popover py-0.5 shadow-lg"
                        style={{ minWidth: `${longestLabelWidthPx}px` }}
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-label={`${ariaLabel} ${option.label}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/80 ${
                                    value === option.value ? "bg-primary/10 text-primary" : "text-foreground"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function MiniKnob({
    targetKind,
    polarity,
    value,
    min,
    max,
    onChange,
    ariaLabel,
}: {
    targetKind: ModulationTargetKind;
    polarity: ModulationPolarity;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    ariaLabel: string;
}) {
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startSliderPosition = useRef(0.5);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState("");
    const sliderPosition = getModulationAmountSliderPosition(targetKind, value);
    const angle = (sliderPosition - 0.5) * (MINI_KNOB_SIDE_SWEEP_DEGREES * 2);
    const fillExtentDegrees = Math.abs(angle);
    const trackPath = useMemo(
        () => describeArcPath(MINI_KNOB_CENTER, MINI_KNOB_RADIUS, -MINI_KNOB_SIDE_SWEEP_DEGREES, MINI_KNOB_SIDE_SWEEP_DEGREES),
        [],
    );
    const fillPath = useMemo(() => {
        if (fillExtentDegrees <= 0.0001) {
            return null;
        }

        if (polarity === "bipolar") {
            return describeArcPath(
                MINI_KNOB_CENTER,
                MINI_KNOB_RADIUS,
                -fillExtentDegrees,
                fillExtentDegrees,
            );
        }

        if (angle < 0) {
            return describeArcPath(
                MINI_KNOB_CENTER,
                MINI_KNOB_RADIUS,
                angle,
                0,
            );
        }

        return describeArcPath(
            MINI_KNOB_CENTER,
            MINI_KNOB_RADIUS,
            0,
            angle,
        );
    }, [angle, fillExtentDegrees, polarity]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }

        setDraftValue(formatModulationAmountEditingValue(targetKind, value));
        const animationFrameID = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [isEditing, value]);

    const finishEditing = useCallback((commit: boolean) => {
        if (!isEditing) {
            return;
        }

        if (commit) {
            const parsedValue = parseModulationAmountEditingValue(targetKind, draftValue);
            if (parsedValue !== null) {
                onChange(parsedValue);
            }
        }

        setIsEditing(false);
        setDraftValue("");
    }, [draftValue, isEditing, onChange, targetKind]);

    const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (isEditing) {
            return;
        }

        event.preventDefault();
        isDragging.current = true;
        startY.current = event.clientY;
        startSliderPosition.current = sliderPosition;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDragging.current) {
                return;
            }

            const delta = startY.current - moveEvent.clientY;
            const nextSliderPosition = Math.max(
                0,
                Math.min(1, startSliderPosition.current + (delta / MINI_KNOB_PIXELS_PER_FULL_TRAVEL)),
            );
            onChange(composeModulationAmount(targetKind, nextSliderPosition));
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }, [isEditing, onChange, sliderPosition, targetKind]);

    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            onMouseDown={handleMouseDown}
            onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsEditing(true);
            }}
            className="relative h-8 w-8 cursor-ns-resize select-none"
        >
            <svg className="absolute inset-0" viewBox="0 0 32 32">
                <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted/60"
                    strokeLinecap="round"
                    strokeDasharray="56.5"
                    strokeDashoffset="18.8"
                    transform="rotate(135 16 16)"
                />
                <path
                    d={trackPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted/60"
                    strokeLinecap="round"
                />
                {fillPath ? (
                    <path
                        d={fillPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-primary"
                        strokeLinecap="round"
                    />
                ) : null}
                <line
                    x1="16"
                    y1="2.5"
                    x2="16"
                    y2="6.5"
                    stroke="rgba(255,255,255,0.58)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                />
            </svg>
            <div
                className="absolute inset-1 rounded-full border border-border/60 bg-secondary"
                style={{ transform: `rotate(${angle}deg)` }}
            >
                <div className="absolute left-1/2 top-0.5 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" />
            </div>
            {isEditing ? (
                <input
                    ref={inputRef}
                    aria-label={`${ariaLabel} value`}
                    type="text"
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.currentTarget.value)}
                    onBlur={() => finishEditing(true)}
                    onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            finishEditing(true);
                            return;
                        }

                        if (event.key === "Escape") {
                            event.preventDefault();
                            finishEditing(false);
                        }
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    className="absolute left-1/2 top-1/2 z-10 h-6 w-16 -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-popover px-2 text-center text-[10px] font-mono text-foreground shadow-lg outline-none"
                />
            ) : null}
        </div>
    );
}

function RoutePolarityToggle({
    value,
    onChange,
    ariaLabel,
}: {
    value: ModulationPolarity;
    onChange: (value: ModulationPolarity) => void;
    ariaLabel: string;
}) {
    const isBipolar = value === "bipolar";

    return (
        <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isBipolar ? "true" : "false"}
            onClick={() => onChange(isBipolar ? "unipolar" : "bipolar")}
            className={`inline-flex h-6 shrink-0 items-center justify-center rounded border px-1.5 text-xs font-bold leading-none tracking-tight transition-all ${
                isBipolar
                    ? "border-primary/40 bg-primary/20 text-primary"
                    : "border-border/40 bg-muted/60 text-muted-foreground"
            }`}
            title={isBipolar ? "Bipolar modulation" : "Unipolar modulation"}
        >
            {isBipolar ? "±" : "+"}
        </button>
    );
}

function RouteRow({
    route,
    routeIndex,
    onUpdate,
    onDelete,
    rowRef,
}: {
    route: ModulationRoute;
    routeIndex: number;
    onUpdate: (nextRoute: ModulationRoute) => void;
    onDelete: () => void;
    rowRef: (element: HTMLDivElement | null) => void;
}) {
    const sourceValue = getModulationSourceOptionValue(route);
    const targetBounds = getModulationAmountBounds(route.targetKind);

    return (
        <div
            ref={rowRef}
            data-role={`route-row-${routeIndex + 1}`}
            className={`group flex items-center gap-2 rounded-lg border border-border/20 bg-card/40 px-3 py-2 transition-all hover:border-border/50 hover:bg-card/70 ${
                route.enabled ? "" : "opacity-40"
            }`}
        >
            <button
                type="button"
                aria-label={`Route ${routeIndex + 1} ${route.enabled ? "bypass" : "enable"}`}
                onClick={() => onUpdate({ ...route, enabled: !route.enabled })}
                className={`shrink-0 rounded p-1 transition-all ${
                    route.enabled
                        ? "text-primary hover:text-primary/80"
                        : "text-muted-foreground/40 hover:text-foreground"
                }`}
                title={route.enabled ? "Bypass" : "Enable"}
            >
                <PowerIcon className="h-3 w-3" />
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
                <PrototypeSelect
                    ariaLabel={`Route ${routeIndex + 1} source`}
                    value={sourceValue}
                    options={MODULATION_SOURCE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    onChange={(nextSourceValue) => onUpdate(applyModulationSourceOption(route, nextSourceValue))}
                    minWidthPx={118}
                />
            </div>

            <ArrowRightIcon className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:block" />

            <PrototypeSelect
                ariaLabel={`Route ${routeIndex + 1} target`}
                value={route.targetKind}
                options={MODULATION_TARGET_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(nextTargetKind) => {
                    const targetKind = nextTargetKind as ModulationTargetKind;
                    onUpdate({
                        ...route,
                        targetKind,
                        amount: clampModulationRouteAmount(targetKind, route.amount),
                    });
                }}
                minWidthPx={132}
            />

            <div className="min-w-0 flex-1" />

            <RoutePolarityToggle
                ariaLabel={`Route ${routeIndex + 1} polarity`}
                value={route.polarity}
                onChange={(polarity) => onUpdate({ ...route, polarity })}
            />

            <MiniKnob
                targetKind={route.targetKind}
                polarity={route.polarity}
                ariaLabel={`Route ${routeIndex + 1} amount`}
                value={route.amount}
                min={targetBounds.min}
                max={targetBounds.max}
                onChange={(nextAmount) => onUpdate({ ...route, amount: clampModulationRouteAmount(route.targetKind, nextAmount) })}
            />

            <span className="hidden w-16 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-primary sm:block">
                {formatModulationAmountReadout(route.targetKind, route.amount, route.polarity)}
            </span>

            <button
                type="button"
                aria-label={`Remove route ${routeIndex + 1}`}
                onClick={onDelete}
                className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
                <XIcon className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function DesktopModMatrix({
    routes,
    onAddRoute,
    onRemoveRoute,
    onRouteChange,
}: {
    routes: ModulationRoute[];
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, nextRoute: ModulationRoute) => void;
}) {
    const routeRowRefs = useRef<Array<HTMLDivElement | null>>([]);
    const pendingRouteScrollIndexRef = useRef<number | null>(null);

    useEffect(() => {
        const pendingRouteIndex = pendingRouteScrollIndexRef.current;

        if (pendingRouteIndex === null || pendingRouteIndex >= routes.length) {
            return;
        }

        pendingRouteScrollIndexRef.current = null;
        const nextRouteElement = routeRowRefs.current[pendingRouteIndex];

        if (!nextRouteElement) {
            return;
        }

        window.requestAnimationFrame(() => {
            nextRouteElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
            });
        });
    }, [routes.length]);

    const handleAddRouteClick = useCallback(() => {
        if (routes.length >= MODULATION_MAX_ROUTES) {
            return;
        }

        pendingRouteScrollIndexRef.current = routes.length;
        onAddRoute();
    }, [onAddRoute, routes.length]);

    return (
        <div className="cosimo-mod-prototype-theme w-full">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/80">Mod Matrix</h2>
                <button
                    type="button"
                    aria-label="Add route"
                    onClick={handleAddRouteClick}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Add</span>
                </button>
            </div>

            <div className="space-y-1.5">
                {routes.map((route, routeIndex) => (
                    <RouteRow
                        key={route.id}
                        route={route}
                        routeIndex={routeIndex}
                        rowRef={(element) => {
                            routeRowRefs.current[routeIndex] = element;
                        }}
                        onUpdate={(nextRoute) => onRouteChange(routeIndex, nextRoute)}
                        onDelete={() => onRemoveRoute(routeIndex)}
                    />
                ))}
            </div>

        </div>
    );
}
