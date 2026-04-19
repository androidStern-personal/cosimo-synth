import { useMemo, type ChangeEvent } from "react";

export type EditorTickSliderAccent = "start" | "end";

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

    return (
        <label
            className={`editor-tick-slider editor-tick-slider--accent-${accent}`}
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
            </span>
            <output className="editor-tick-slider__value" data-role={valueDataRole}>
                {formatValue(normalizedValue)}
            </output>
        </label>
    );
}
