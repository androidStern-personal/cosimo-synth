import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import {
    formatParameterEntry,
    parseParameterEntry,
    type ParameterEntrySpec,
} from "./parameter-value-entry";

export type EditorTickSliderAccent = "start" | "end";
export type ModulationDirection = "both" | "up" | "down";
export type EditorTickSliderScale = "linear" | "log";

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
    scale?: EditorTickSliderScale;
    discrete?: boolean;
    disabled?: boolean;
    labelAnnotation?: string | null;
    inputData?: Readonly<Record<`data-${string}`, string | number | undefined>>;
    valueData?: Readonly<Record<`data-${string}`, string | number | undefined>>;
    entrySpec?: ParameterEntrySpec | null;
    onGestureStart?: (() => void) | null;
    onGestureEnd?: (() => void) | null;
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

    return Number((min + (Math.round((value - min) / step) * step)).toFixed(8));
}

function normalizeValue(value: number, min: number, max: number, step: number) {
    return clamp(snapToStep(value, min, step), min, max);
}

function valueToProportion(value: number, min: number, max: number, scale: EditorTickSliderScale) {
    if (max <= min) {
        return 0;
    }

    const safeValue = clamp(value, min, max);
    if (scale === "log" && min > 0 && max > 0) {
        return clamp(Math.log(safeValue / min) / Math.log(max / min), 0, 1);
    }

    return (safeValue - min) / (max - min);
}

function proportionToValue(proportion: number, min: number, max: number, scale: EditorTickSliderScale) {
    const safeProportion = clamp(proportion, 0, 1);
    if (scale === "log" && min > 0 && max > 0) {
        return min * Math.pow(max / min, safeProportion);
    }

    return min + (safeProportion * (max - min));
}

function tickFillProportions(proportion: number, tickCount: number, discrete: boolean) {
    if (discrete) {
        const activeCount = tickCount <= 1
            ? 1
            : Math.round(clamp(proportion, 0, 1) * (tickCount - 1)) + 1;
        return Array.from({ length: tickCount }, (_unused, index) => index < activeCount ? 1 : 0);
    }

    const traversed = clamp(proportion, 0, 1) * tickCount;
    return Array.from({ length: tickCount }, (_unused, index) => clamp(traversed - index, 0, 1));
}

function valueFromClientX(
    element: Element,
    clientX: number,
    min: number,
    max: number,
    step: number,
    scale: EditorTickSliderScale,
) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
        return min;
    }

    return normalizeValue(
        proportionToValue((clientX - bounds.left) / bounds.width, min, max, scale),
        min,
        max,
        step,
    );
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
    scale = "linear",
    discrete = false,
    disabled = false,
    labelAnnotation = null,
    inputData,
    valueData,
    entrySpec = null,
    onGestureStart = null,
    onGestureEnd = null,
}: EditorTickSliderProps) {
    const dragTargetRef = useRef<"start" | "end" | null>(null);
    const exactInputRef = useRef<HTMLInputElement | null>(null);
    const skipExactCommitOnBlurRef = useRef(false);
    const [isEditingExactValue, setIsEditingExactValue] = useState(false);
    const [exactDraft, setExactDraft] = useState("");
    const [exactError, setExactError] = useState("");
    const safeTickCount = Math.max(1, Math.round(tickCount));
    const ticks = useMemo(
        () => Array.from({ length: safeTickCount }, (_unused, index) => index),
        [safeTickCount],
    );
    const normalizedValue = normalizeValue(value, min, max, step);
    const modulationEnd = modulation ? normalizeValue(modulation.end, min, max, step) : normalizedValue;
    const isModulated = modulation !== null;
    const startProportion = valueToProportion(normalizedValue, min, max, scale);
    const endProportion = valueToProportion(modulationEnd, min, max, scale);
    const tickFills = tickFillProportions(startProportion, safeTickCount, discrete);
    const currentTickIndex = tickFills.reduce((current, fill, index) => fill > 0 ? index : current, -1);
    const startPercent = startProportion * 100;
    const endPercent = endProportion * 100;
    const discreteStartIndex = Math.round(startProportion * (safeTickCount - 1));
    const discreteEndIndex = Math.round(endProportion * (safeTickCount - 1));
    const lowRangePercent = discrete
        ? (Math.min(discreteStartIndex, discreteEndIndex) / safeTickCount) * 100
        : Math.min(startPercent, endPercent);
    const highRangePercent = discrete
        ? ((Math.max(discreteStartIndex, discreteEndIndex) + 1) / safeTickCount) * 100
        : Math.max(startPercent, endPercent);
    const hasModulationRange = modulationEnd !== normalizedValue;

    useEffect(() => {
        if (!isEditingExactValue) {
            return;
        }

        exactInputRef.current?.focus();
        exactInputRef.current?.select();
    }, [isEditingExactValue]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const inputValue = Number(event.currentTarget.value);
        const physicalValue = scale === "log"
            ? proportionToValue(inputValue, min, max, scale)
            : inputValue;
        onChange(normalizeValue(physicalValue, min, max, step));
    };

    const applyDragValue = (element: Element, clientX: number, target: "start" | "end") => {
        let nextValue = valueFromClientX(element, clientX, min, max, step, scale);

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
        if (disabled || !modulation || event.button !== 0) {
            return;
        }

        event.preventDefault();
        const nextValue = valueFromClientX(event.currentTarget, event.clientX, min, max, step, scale);
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

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (scale !== "log" || !["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            return;
        }

        const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
        const proportionStep = (event.shiftKey ? 1 : 0.25) / safeTickCount;
        const nextValue = event.key === "Home"
            ? min
            : event.key === "End"
                ? max
                : proportionToValue(startProportion + (direction * proportionStep), min, max, scale);
        onChange(normalizeValue(nextValue, min, max, step));
        event.preventDefault();
    };

    const beginExactEntry = () => {
        if (disabled || entrySpec === null) {
            return;
        }

        skipExactCommitOnBlurRef.current = false;
        setExactDraft(formatParameterEntry(entrySpec, normalizedValue).draft);
        setExactError("");
        setIsEditingExactValue(true);
        onGestureStart?.();
    };

    const commitExactEntry = () => {
        if (entrySpec === null) {
            return;
        }

        const result = parseParameterEntry(entrySpec, exactDraft);
        if (result._tag === "rejected") {
            setExactError(result.message);
            requestAnimationFrame(() => exactInputRef.current?.focus());
            return;
        }
        if (result.commit._tag !== "value") {
            setExactError("Choose tempo divisions from the selector.");
            requestAnimationFrame(() => exactInputRef.current?.focus());
            return;
        }

        onChange(result.commit.value);
        setExactError("");
        setIsEditingExactValue(false);
        onGestureEnd?.();
    };

    const handleExactEntryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            commitExactEntry();
            event.preventDefault();
            return;
        }
        if (event.key === "Escape") {
            skipExactCommitOnBlurRef.current = true;
            setExactError("");
            setIsEditingExactValue(false);
            onGestureEnd?.();
            event.preventDefault();
        }
    };

    const valueReadout = isModulated ? (
        <span className="editor-tick-slider__mod-values" data-role={valueDataRole} {...valueData}>
            <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--start">{formatValue(normalizedValue)}</span>
            <span className="editor-tick-slider__value-arrow">→</span>
            <span className="editor-tick-slider__value-chip editor-tick-slider__value-chip--end">{formatValue(modulationEnd)}</span>
        </span>
    ) : isEditingExactValue && entrySpec !== null ? (
        <span className="editor-tick-slider__exact-entry">
            <span className="editor-tick-slider__exact-control">
                <input
                    aria-label={`${label} exact value`}
                    data-role="editor-tick-slider-exact-input"
                    onBlur={() => {
                        if (skipExactCommitOnBlurRef.current) {
                            skipExactCommitOnBlurRef.current = false;
                            return;
                        }
                        commitExactEntry();
                    }}
                    onChange={(event) => {
                        setExactDraft(event.currentTarget.value);
                        setExactError("");
                    }}
                    onKeyDown={handleExactEntryKeyDown}
                    ref={exactInputRef}
                    type="text"
                    value={exactDraft}
                />
                <span>{formatParameterEntry(entrySpec, normalizedValue).unit}</span>
            </span>
            {exactError ? <small role="alert">{exactError}</small> : null}
        </span>
    ) : entrySpec !== null ? (
        <button
            aria-label={`Edit ${label} exact value`}
            className="editor-tick-slider__value editor-tick-slider__value--editable"
            data-role={valueDataRole}
            {...valueData}
            disabled={disabled}
            onClick={beginExactEntry}
            title={`Enter exact ${label.toLowerCase()} value`}
            type="button"
        >
            {formatValue(normalizedValue)}
        </button>
    ) : (
        <output className="editor-tick-slider__value" data-role={valueDataRole} {...valueData}>
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
                    <ModBadge
                        isOn={isModulated}
                        {...(modulation?.direction ? { direction: modulation.direction } : {})}
                    />
                </button>
            ) : (
                <span className="editor-tick-slider__label">
                    <span>{label}</span>
                    {labelAnnotation ? <em className="editor-tick-slider__annotation">{labelAnnotation}</em> : null}
                </span>
            )}
            <span className="editor-tick-slider__track">
                <span className="editor-tick-slider__rail" aria-hidden="true">
                    {ticks.map((tick) => {
                        const fill = isModulated ? 0 : tickFills[tick] ?? 0;
                        return (
                            <span
                                className={[
                                    "editor-tick-slider__tick",
                                    fill > 0 ? "is-active" : "",
                                    fill > 0 && tick === currentTickIndex ? "is-current" : "",
                                ].filter(Boolean).join(" ")}
                                data-fill={fill}
                                data-role="editor-tick-slider-tick"
                                key={tick}
                            >
                                <span
                                    className="editor-tick-slider__tick-fill"
                                    style={{ "--editor-tick-fill": `${fill * 100}%` } as CSSProperties}
                                />
                            </span>
                        );
                    })}
                </span>
                {isModulated ? (
                    <>
                        {hasModulationRange ? (
                            <span
                                aria-hidden="true"
                                className="editor-tick-slider__rail editor-tick-slider__rail--mod-range"
                                data-range-end={highRangePercent}
                                data-range-start={lowRangePercent}
                                data-role="editor-tick-slider-mod-range-rail"
                                style={{ clipPath: `inset(0 ${100 - highRangePercent}% 0 ${lowRangePercent}%)` }}
                            >
                                {ticks.map((tick) => (
                                    <span className="editor-tick-slider__tick" key={tick} />
                                ))}
                            </span>
                        ) : null}
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
                            aria-disabled={disabled}
                            className="editor-tick-slider__sr-handle"
                            onKeyDown={handleHandleKeyDown("start")}
                            role="slider"
                            tabIndex={disabled ? -1 : 0}
                        />
                        <span
                            aria-label={`${label} end`}
                            aria-valuemax={max}
                            aria-valuemin={min}
                            aria-valuenow={modulationEnd}
                            aria-disabled={disabled}
                            className="editor-tick-slider__sr-handle"
                            onKeyDown={handleHandleKeyDown("end")}
                            role="slider"
                            tabIndex={disabled ? -1 : 0}
                        />
                    </>
                ) : (
                    <input
                        aria-label={label}
                        aria-valuetext={formatValue(normalizedValue)}
                        className="editor-tick-slider__input"
                        data-physical-max={max}
                        data-physical-min={min}
                        data-physical-value={normalizedValue}
                        data-role={inputDataRole}
                        data-scale={scale}
                        disabled={disabled}
                        max={scale === "log" ? 1 : max}
                        min={scale === "log" ? 0 : min}
                        onBlur={() => onGestureEnd?.()}
                        onChange={handleChange}
                        onFocus={() => onGestureStart?.()}
                        onKeyDown={handleInputKeyDown}
                        step={scale === "log" ? 0.000001 : step}
                        type="range"
                        value={scale === "log" ? startProportion : normalizedValue}
                        {...inputData}
                    />
                )}
            </span>
            {valueReadout}
        </div>
    );
}
