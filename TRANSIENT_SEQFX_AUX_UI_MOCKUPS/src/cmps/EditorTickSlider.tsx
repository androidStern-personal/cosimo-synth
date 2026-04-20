import { useMemo, useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";

export type EditorTickSliderAccent = "start" | "end";

export type ModulationDirection = "both" | "up" | "down";

export type EditorTickSliderModulation = {
    end: number;
    onEndChange: (value: number) => void;
    phase?: number;
    /**
     * Restricts which side of the start value the end handle can live on.
     * Used for parameters whose physics only allow one-way modulation
     * (e.g. Stutter Slices can only increase mid-block because the capture
     * buffer was sized for the starting slice length).
     */
    direction?: ModulationDirection;
};

export type EditorTickSliderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    tickCount: number;
    onChange: (value: number) => void;
    accent?: EditorTickSliderAccent;
    dataRole: string;
    inputDataRole: string;
    valueDataRole: string;
    formatValue?: (value: number) => string;
    modulation?: EditorTickSliderModulation | null;
    onModulationToggle?: (() => void) | null;
};

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, step: number) {
    if (!Number.isFinite(step) || step <= 0) {
        return value;
    }

    return min + (Math.round((value - min) / step) * step);
}

function normalizeValue(value: number, min: number, max: number, step: number) {
    return clamp(snapToStep(value, min, step), min, max);
}

function activeTickIndex(value: number, min: number, max: number, tickCount: number) {
    if (tickCount <= 1 || max <= min) {
        return 0;
    }

    const normalized = (clamp(value, min, max) - min) / (max - min);
    return clamp(Math.round(normalized * (tickCount - 1)), 0, tickCount - 1);
}

function valueToPercent(value: number, min: number, max: number) {
    if (max <= min) {
        return 0;
    }

    return (clamp(value, min, max) - min) / (max - min) * 100;
}

export function EditorTickSlider({
    label,
    value,
    min,
    max,
    step,
    tickCount,
    onChange,
    accent = "start",
    dataRole,
    inputDataRole,
    valueDataRole,
    formatValue = (nextValue) => String(nextValue),
    modulation = null,
    onModulationToggle = null,
}: EditorTickSliderProps) {
    const safeTickCount = Math.max(1, Math.round(tickCount));
    const ticks = useMemo(
        () => Array.from({ length: safeTickCount }, (_unused, index) => index),
        [safeTickCount],
    );
    const normalizedValue = normalizeValue(value, min, max, step);
    const currentTickIndex = activeTickIndex(normalizedValue, min, max, safeTickCount);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(normalizeValue(Number(event.currentTarget.value), min, max, step));
    };

    const handleEndChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!modulation) {
            return;
        }

        modulation.onEndChange(normalizeValue(Number(event.currentTarget.value), min, max, step));
    };

    const isModulated = Boolean(modulation);
    const endTickIndex = modulation
        ? activeTickIndex(normalizeValue(modulation.end, min, max, step), min, max, safeTickCount)
        : currentTickIndex;
    const modLowIndex = Math.min(currentTickIndex, endTickIndex);
    const modHighIndex = Math.max(currentTickIndex, endTickIndex);

    return (
        <div
            className={`editor-tick-slider editor-tick-slider--accent-${accent}${isModulated ? " editor-tick-slider--modulated" : ""}`}
            data-role={dataRole}
        >
            {onModulationToggle ? (
                <button
                    type="button"
                    className="editor-tick-slider__label editor-tick-slider__label--toggle"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onModulationToggle();
                    }}
                    aria-pressed={isModulated}
                    title={`${label}: click to ${isModulated ? "disable" : "enable"} aux modulation${
                        modulation?.direction && modulation.direction !== "both"
                            ? ` (${modulation.direction}-only)`
                            : ""
                    }`}
                >
                    <span>{label}</span>
                    <ModBadge isOn={isModulated} direction={modulation?.direction} />
                </button>
            ) : (
                <span className="editor-tick-slider__label">{label}</span>
            )}
            <span className="editor-tick-slider__track">
                <span className="editor-tick-slider__rail" aria-hidden="true">
                    {ticks.map((tick) => {
                        const classes = ["editor-tick-slider__tick"];

                        if (isModulated) {
                            if (tick === currentTickIndex) {
                                classes.push("is-mod-start");
                            } else if (tick === endTickIndex) {
                                classes.push("is-mod-end");
                            } else if (tick > modLowIndex && tick < modHighIndex) {
                                classes.push("is-mod-between");
                            }
                        } else {
                            if (tick <= currentTickIndex) {
                                classes.push("is-active");
                            }
                            if (tick === currentTickIndex) {
                                classes.push("is-current");
                            }
                        }

                        return (
                            <span
                                className={classes.join(" ")}
                                data-role="editor-tick-slider-tick"
                                key={tick}
                            />
                        );
                    })}
                </span>
                {isModulated ? (
                    <ModulatedDragSurface
                        min={min}
                        max={max}
                        step={step}
                        startValue={normalizedValue}
                        endValue={normalizeValue(modulation!.end, min, max, step)}
                        direction={modulation!.direction ?? "both"}
                        onStartChange={onChange}
                        onEndChange={modulation!.onEndChange}
                    />
                ) : (
                    <input
                        className="editor-tick-slider__input"
                        data-role={inputDataRole}
                        max={max}
                        min={min}
                        onChange={handleChange}
                        step={step}
                        type="range"
                        value={normalizedValue}
                    />
                )}
            </span>
            {isModulated ? (
                <output className="editor-tick-slider__value editor-tick-slider__value--modulated" data-role={valueDataRole}>
                    <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--start">
                        {formatValue(normalizedValue)}
                    </span>
                    <span className="editor-tick-slider__value-arrow">→</span>
                    <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--end">
                        {formatValue(normalizeValue(modulation!.end, min, max, step))}
                    </span>
                </output>
            ) : (
                <output className="editor-tick-slider__value" data-role={valueDataRole}>
                    {formatValue(normalizedValue)}
                </output>
            )}
        </div>
    );
}

type ModulatedDragSurfaceProps = {
    min: number;
    max: number;
    step: number;
    startValue: number;
    endValue: number;
    direction: ModulationDirection;
    onStartChange: (value: number) => void;
    onEndChange: (value: number) => void;
};

type ModulatedDragTarget = "start" | "end";

function ModulatedDragSurface({ min, max, step, startValue, endValue, direction, onStartChange, onEndChange }: ModulatedDragSurfaceProps) {
    const activeRef = useRef<ModulatedDragTarget>("start");
    const pointerIdRef = useRef<number | null>(null);

    const pickTarget = (pointerX: number, width: number): ModulatedDragTarget => {
        const startPct = valueToPercent(startValue, min, max) / 100;
        const endPct = valueToPercent(endValue, min, max) / 100;
        const startPx = startPct * width;
        const endPx = endPct * width;
        return Math.abs(pointerX - startPx) <= Math.abs(pointerX - endPx) ? "start" : "end";
    };

    const applyFromPointer = (target: ModulatedDragTarget, pointerX: number, width: number) => {
        if (width <= 0) {
            return;
        }

        const ratio = clamp(pointerX / width, 0, 1);
        const raw = normalizeValue(min + (ratio * (max - min)), min, max, step);

        if (target === "start") {
            onStartChange(raw);
            // Direction constraints: if the start handle crosses the end, push
            // end along so the invariant is preserved.
            if (direction === "up" && raw > endValue) {
                onEndChange(raw);
            } else if (direction === "down" && raw < endValue) {
                onEndChange(raw);
            }
        } else {
            let next = raw;
            if (direction === "up") {
                next = Math.max(raw, startValue);
            } else if (direction === "down") {
                next = Math.min(raw, startValue);
            }
            onEndChange(normalizeValue(next, min, max, step));
        }
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const target = pickTarget(pointerX, rect.width);
        activeRef.current = target;
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyFromPointer(target, pointerX, rect.width);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        applyFromPointer(activeRef.current, event.clientX - rect.left, rect.width);
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        pointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <div
            className="editor-tick-slider__drag-surface"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="presentation"
        />
    );
}

export type ModBadgeProps = {
    isOn: boolean;
    direction?: ModulationDirection;
};

/** Shared badge used on tick-slider labels, Drive label, and Stutter gate pill. */
export function ModBadge({ isOn, direction = "both" }: ModBadgeProps) {
    const arrow = direction === "up" ? "\u2191" : direction === "down" ? "\u2193" : null;
    return (
        <span className={`mod-badge${isOn ? " is-on" : ""}${arrow ? " mod-badge--directional" : ""}`} aria-hidden="true">
            <span className="mod-badge__m">M</span>
            {arrow ? <span className="mod-badge__arrow">{arrow}</span> : null}
        </span>
    );
}
