import { useMemo, useRef, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";

export type EditorTickSliderAccent = "start" | "end";
export type ModulationDirection = "both" | "up" | "down";

export type EditorTickSliderModulation = {
    end: number;
    onEndChange: (value: number) => void;
    phase?: number;
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

    return ((clamp(value, min, max) - min) / (max - min)) * 100;
}

function valueFromClientX(element: Element, clientX: number, min: number, max: number, step: number) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
        return min;
    }

    return normalizeValue(min + (((clientX - bounds.left) / bounds.width) * (max - min)), min, max, step);
}

export function ModBadge({
    isOn,
    direction = "both",
}: {
    isOn: boolean;
    direction?: ModulationDirection;
}) {
    const directional = direction !== "both";
    return (
        <span className={[
            "mod-badge",
            isOn ? "is-on" : "",
            directional ? "mod-badge--directional" : "",
        ].filter(Boolean).join(" ")} aria-hidden="true">
            M{direction === "up" ? "↑" : direction === "down" ? "↓" : ""}
        </span>
    );
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
    const dragTargetRef = useRef<"start" | "end" | null>(null);
    const safeTickCount = Math.max(1, Math.round(tickCount));
    const ticks = useMemo(
        () => Array.from({ length: safeTickCount }, (_unused, index) => index),
        [safeTickCount],
    );
    const normalizedValue = normalizeValue(value, min, max, step);
    const modulationEnd = modulation ? normalizeValue(modulation.end, min, max, step) : normalizedValue;
    const isModulated = modulation !== null;
    const currentTickIndex = activeTickIndex(normalizedValue, min, max, safeTickCount);
    const endTickIndex = activeTickIndex(modulationEnd, min, max, safeTickCount);
    const lowModTickIndex = Math.min(currentTickIndex, endTickIndex);
    const highModTickIndex = Math.max(currentTickIndex, endTickIndex);
    const startPercent = valueToPercent(normalizedValue, min, max);
    const endPercent = valueToPercent(modulationEnd, min, max);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(normalizeValue(Number(event.currentTarget.value), min, max, step));
    };

    const applyDragValue = (element: Element, clientX: number, target: "start" | "end") => {
        let nextValue = valueFromClientX(element, clientX, min, max, step);

        if (modulation?.direction === "up") {
            if (target === "start" && nextValue > modulationEnd) {
                modulation.onEndChange(nextValue);
            } else if (target === "end") {
                nextValue = Math.max(nextValue, normalizedValue);
            }
        } else if (modulation?.direction === "down") {
            if (target === "start" && nextValue < modulationEnd) {
                modulation.onEndChange(nextValue);
            } else if (target === "end") {
                nextValue = Math.min(nextValue, normalizedValue);
            }
        }

        if (target === "start") {
            onChange(nextValue);
        } else {
            modulation?.onEndChange(nextValue);
        }
    };

    const handleDragPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!modulation || event.button !== 0) {
            return;
        }

        event.preventDefault();
        const nextValue = valueFromClientX(event.currentTarget, event.clientX, min, max, step);
        const target = Math.abs(nextValue - normalizedValue) <= Math.abs(nextValue - modulationEnd) ? "start" : "end";
        dragTargetRef.current = target;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyDragValue(event.currentTarget, event.clientX, target);
    };

    const handleDragPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragTargetRef.current) {
            return;
        }

        applyDragValue(event.currentTarget, event.clientX, dragTargetRef.current);
    };

    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragTargetRef.current) {
            return;
        }

        dragTargetRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const handleHandleKeyDown = (target: "start" | "end") => (event: KeyboardEvent<HTMLSpanElement>) => {
        const delta = (event.shiftKey ? step * 10 : step) * (event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1);
        if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            return;
        }

        const baseValue = target === "start" ? normalizedValue : modulationEnd;
        const nextValue = event.key === "Home"
            ? min
            : event.key === "End"
                ? max
                : baseValue + delta;
        if (target === "start") {
            onChange(normalizeValue(nextValue, min, max, step));
        } else {
            modulation?.onEndChange(normalizeValue(nextValue, min, max, step));
        }
        event.preventDefault();
    };

    const valueReadout = isModulated ? (
        <span className="editor-tick-slider__mod-values" data-role={valueDataRole}>
            <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--start">{formatValue(normalizedValue)}</span>
            <span className="editor-tick-slider__value-arrow">→</span>
            <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--end">{formatValue(modulationEnd)}</span>
        </span>
    ) : (
        <output className="editor-tick-slider__value" data-role={valueDataRole}>
            {formatValue(normalizedValue)}
        </output>
    );

    return (
        <div
            className={[
                `editor-tick-slider editor-tick-slider--accent-${accent}`,
                isModulated ? "editor-tick-slider--modulated" : "",
            ].filter(Boolean).join(" ")}
            data-role={dataRole}
        >
            {onModulationToggle ? (
                <button
                    type="button"
                    className="editor-tick-slider__label editor-tick-slider__label--toggle"
                    aria-pressed={isModulated}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onModulationToggle();
                    }}
                >
                    <span>{label}</span>
                    <ModBadge isOn={isModulated} direction={modulation?.direction} />
                </button>
            ) : (
                <span className="editor-tick-slider__label">{label}</span>
            )}
            <span className="editor-tick-slider__track">
                <span className="editor-tick-slider__rail" aria-hidden="true">
                    {ticks.map((tick) => (
                        <span
                            className={[
                                "editor-tick-slider__tick",
                                !isModulated && tick <= currentTickIndex ? "is-active" : "",
                                !isModulated && tick === currentTickIndex ? "is-current" : "",
                                isModulated && tick === currentTickIndex ? "is-mod-start" : "",
                                isModulated && tick === endTickIndex ? "is-mod-end" : "",
                                isModulated && tick > lowModTickIndex && tick < highModTickIndex ? "is-mod-between" : "",
                            ].filter(Boolean).join(" ")}
                            data-role="editor-tick-slider-tick"
                            key={tick}
                        />
                    ))}
                </span>
                {isModulated ? (
                    <>
                        <span
                            className="editor-tick-slider__mod-range"
                            style={{
                                left: `${Math.min(startPercent, endPercent)}%`,
                                width: `${Math.abs(endPercent - startPercent)}%`,
                            }}
                        />
                        <span
                            className="editor-tick-slider__mod-thumb editor-tick-slider__mod-thumb--start"
                            style={{ left: `${startPercent}%` }}
                        />
                        <span
                            className="editor-tick-slider__mod-thumb editor-tick-slider__mod-thumb--end"
                            style={{ left: `${endPercent}%` }}
                        />
                        <div
                            className="editor-tick-slider__drag-surface"
                            data-role={inputDataRole}
                            onPointerDown={handleDragPointerDown}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                            role="presentation"
                        />
                        <span
                            aria-label={`${label} start`}
                            aria-valuemax={max}
                            aria-valuemin={min}
                            aria-valuenow={normalizedValue}
                            className="editor-tick-slider__sr-handle"
                            onKeyDown={handleHandleKeyDown("start")}
                            role="slider"
                            tabIndex={0}
                        />
                        <span
                            aria-label={`${label} end`}
                            aria-valuemax={max}
                            aria-valuemin={min}
                            aria-valuenow={modulationEnd}
                            className="editor-tick-slider__sr-handle"
                            onKeyDown={handleHandleKeyDown("end")}
                            role="slider"
                            tabIndex={0}
                        />
                    </>
                ) : (
                    <input
                        aria-label={label}
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
            {valueReadout}
        </div>
    );
}
