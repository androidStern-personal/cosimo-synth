import { useMemo, useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";

export type EditorTickSliderAccent = "start" | "end";

export type EditorTickSliderModulation = {
    end: number;
    onEndChange: (value: number) => void;
    phase?: number;
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
    const startPct = valueToPercent(normalizedValue, min, max);
    const endPct = modulation ? valueToPercent(normalizeValue(modulation.end, min, max, step), min, max) : startPct;
    const sweepLeftPct = Math.min(startPct, endPct);
    const sweepRightPct = 100 - Math.max(startPct, endPct);
    const phase = modulation?.phase ?? 0;
    const liveValue = modulation
        ? normalizeValue(normalizedValue + (modulation.end - normalizedValue) * phase, min, max, step)
        : normalizedValue;
    const livePct = valueToPercent(liveValue, min, max);

    return (
        <label
            className={`editor-tick-slider editor-tick-slider--accent-${accent}${isModulated ? " editor-tick-slider--modulated" : ""}`}
            data-role={dataRole}
        >
            <span className="editor-tick-slider__label">{label}</span>
            <span className="editor-tick-slider__track">
                <span className="editor-tick-slider__rail" aria-hidden="true">
                    {ticks.map((tick) => (
                        <span
                            className={[
                                "editor-tick-slider__tick",
                                tick <= currentTickIndex ? "is-active" : "",
                                tick === currentTickIndex ? "is-current" : "",
                            ].filter(Boolean).join(" ")}
                            data-role="editor-tick-slider-tick"
                            key={tick}
                        />
                    ))}
                </span>
                {isModulated ? (
                    <>
                        <span
                            className="editor-tick-slider__mod-sweep"
                            style={{ left: `${sweepLeftPct}%`, right: `${sweepRightPct}%` }}
                            aria-hidden="true"
                        />
                        <span
                            className="editor-tick-slider__mod-phase"
                            style={{ left: `${livePct}%` }}
                            aria-hidden="true"
                        />
                        <span
                            className="editor-tick-slider__mod-marker editor-tick-slider__mod-marker--start"
                            style={{ left: `${startPct}%` }}
                            aria-hidden="true"
                        />
                        <span
                            className="editor-tick-slider__mod-marker editor-tick-slider__mod-marker--end"
                            style={{ left: `${endPct}%` }}
                            aria-hidden="true"
                        />
                    </>
                ) : null}
                {isModulated ? (
                    <ModulatedDragSurface
                        min={min}
                        max={max}
                        step={step}
                        startValue={normalizedValue}
                        endValue={normalizeValue(modulation!.end, min, max, step)}
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
        </label>
    );
}

type ModulatedDragSurfaceProps = {
    min: number;
    max: number;
    step: number;
    startValue: number;
    endValue: number;
    onStartChange: (value: number) => void;
    onEndChange: (value: number) => void;
};

type ModulatedDragTarget = "start" | "end";

function ModulatedDragSurface({ min, max, step, startValue, endValue, onStartChange, onEndChange }: ModulatedDragSurfaceProps) {
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
        const nextValue = normalizeValue(min + (ratio * (max - min)), min, max, step);

        if (target === "start") {
            onStartChange(nextValue);
        } else {
            onEndChange(nextValue);
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
