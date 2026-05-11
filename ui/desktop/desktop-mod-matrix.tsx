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
                className="synth-compact-control synth-compact-control-text flex items-center justify-between gap-1 rounded px-2 py-1.5 transition hover:border-[rgb(var(--section-accent-rgb)/0.34)] hover:bg-[rgb(var(--section-accent-rgb)/0.08)]"
                style={{ minWidth: `${longestLabelWidthPx}px` }}
            >
                <span className="synth-readout-text whitespace-nowrap text-[10px]">{selected?.label}</span>
                <ChevronDownIcon className={`h-3 w-3 shrink-0 text-[rgb(var(--section-accent-rgb)/0.72)] transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="synth-menu-surface absolute z-50 mt-1 max-h-40 overflow-auto rounded py-0.5"
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
                                className={`w-full px-2.5 py-1.5 text-left text-[10px] transition-colors hover:bg-[rgb(var(--section-accent-rgb)/0.08)] ${
                                    value === option.value ? "synth-readout-text synth-accent-soft-bg" : "text-[rgb(232_236_239/0.82)]"
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
                    className="text-[rgb(var(--cosimo-control-rgb)/0.62)]"
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
                        className="text-[var(--section-accent)]"
                        strokeLinecap="round"
                    />
                ) : null}
                <line
                    x1="16"
                    y1="2.5"
                    x2="16"
                    y2="6.5"
                    stroke="rgb(var(--section-accent-rgb) / 0.72)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                />
            </svg>
            <div
                className="synth-control-rail absolute inset-1 rounded-full"
                style={{ transform: `rotate(${angle}deg)` }}
            >
                <div className="synth-accent-solid-bg absolute left-1/2 top-0.5 h-1.5 w-0.5 -translate-x-1/2 rounded-full" />
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
                    className="synth-menu-surface synth-readout-text absolute left-1/2 top-1/2 z-10 h-6 w-16 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 text-center text-[10px] outline-none"
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
                    ? "synth-accent-active-button"
                    : "synth-compact-control text-[rgb(var(--cosimo-control-rgb)/0.92)]"
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
            className={`synth-control-rail group flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:border-[rgb(var(--section-accent-rgb)/0.22)] hover:bg-[rgb(var(--section-accent-rgb)/0.045)] ${
                route.enabled ? "" : "opacity-40"
            }`}
        >
            <button
                type="button"
                aria-label={`Route ${routeIndex + 1} ${route.enabled ? "bypass" : "enable"}`}
                onClick={() => onUpdate({ ...route, enabled: !route.enabled })}
                className={`shrink-0 rounded p-1 transition-all ${
                    route.enabled
                        ? "synth-readout-text hover:text-[rgb(var(--section-accent-rgb)/0.78)]"
                        : "text-[rgb(var(--cosimo-control-rgb)/0.62)] hover:text-[rgb(232_236_239/0.82)]"
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

            <ArrowRightIcon className="hidden h-3.5 w-3.5 shrink-0 text-[rgb(var(--cosimo-control-rgb)/0.82)] sm:block" />

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

            <span className="synth-readout-text hidden w-16 shrink-0 text-right text-xs tabular-nums sm:block">
                {formatModulationAmountReadout(route.targetKind, route.amount, route.polarity)}
            </span>

            <button
                type="button"
                aria-label={`Remove route ${routeIndex + 1}`}
                onClick={onDelete}
                className="shrink-0 rounded p-1 text-[rgb(var(--cosimo-control-rgb)/0.55)] opacity-0 transition-all hover:bg-[rgb(var(--section-accent-rgb)/0.08)] hover:text-[var(--section-accent)] focus-visible:opacity-100 group-hover:opacity-100"
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
    className = "",
}: {
    routes: ModulationRoute[];
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, nextRoute: ModulationRoute) => void;
    className?: string;
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
        <div className={`cosimo-mod-prototype-theme flex h-full min-h-0 w-full flex-col ${className}`}>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="synth-section-title text-sm">Mod Matrix</h2>
                <button
                    type="button"
                    aria-label="Add route"
                    onClick={handleAddRouteClick}
                    className="synth-readout-text flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[rgb(var(--section-accent-rgb)/0.08)]"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Add</span>
                </button>
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
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
