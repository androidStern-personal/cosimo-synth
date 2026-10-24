import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
    type CSSProperties, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from "react";
import css from "./slider.css?inline";
import { isStepKey, stepForKey, type KeyboardStep } from "./keyboard-steps";
import { formatParameterEntry, parseParameterEntry, type ParameterEntrySpec } from "./parameter-value-entry";
import { retainStyles } from "./styles";
import { scaleKind, valueDomain, type ValueScale } from "./value-scale";

/** An editable modulation range drawn on the rail from the value to `end`. */
export type SliderModulation = {
    readonly end: number;
    readonly onEndChange: (value: number) => void;
    /** "up" keeps the end at or above the value, "down" at or below; "both" lets it cross. */
    readonly direction?: "both" | "up" | "down";
};

export type SliderProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "children" | "defaultValue"> & {
    /** Visible label; also the accessible name unless `aria-label` is set. */
    readonly label: string;
    readonly value: number;
    readonly onValueChange: (value: number) => void;
    readonly min?: number;
    readonly max?: number;
    /** Snapping step in the value's units. Without one the value is continuous and a key moves 1% of travel. */
    readonly step?: number;
    readonly scale?: ValueScale;
    /** Number of cells in the rail. */
    readonly tickCount?: number;
    /** Fill whole cells only, for stepped values. */
    readonly discrete?: boolean;
    readonly formatValue?: (value: number) => string;
    readonly modulation?: SliderModulation | null;
    /** Makes the readout a button that opens unit-aware exact entry. */
    readonly entrySpec?: ParameterEntrySpec | null;
    readonly disabled?: boolean;
    readonly onGestureStart?: () => void;
    readonly onGestureEnd?: (cancelled: boolean) => void;
};

type Target = "start" | "end";
const defaultFormat = (value: number) => String(Number(value.toPrecision(5)));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function cellFills(position: number, tickCount: number, discrete: boolean) {
    if (discrete) {
        const filled = tickCount <= 1 ? 1 : Math.round(position * (tickCount - 1)) + 1;
        return Array.from({ length: tickCount }, (_unused, index) => index < filled ? 1 : 0);
    }
    const traversed = position * tickCount;
    return Array.from({ length: tickCount }, (_unused, index) => clamp01(traversed - index));
}

/** A segmented numeric slider with optional modulation range and exact text entry. */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider({
    label, value, onValueChange, min = 0, max = 1, step, scale = "linear", tickCount = 16, discrete = false,
    formatValue = defaultFormat, modulation = null, entrySpec = null, disabled = false,
    onGestureStart, onGestureEnd, className, "aria-label": ariaLabel, ...rootProps
}, ref) {
    const name = ariaLabel ?? label;
    const domain = useMemo(() => valueDomain({ min, max, step, scale }), [min, max, step, scale]);
    const callbacks = useRef({ onValueChange, onGestureStart, onGestureEnd, modulation });
    callbacks.current = { onValueChange, onGestureStart, onGestureEnd, modulation };

    // A gesture opens on its first write and closes once: on release, keyup, blur,
    // Escape, disabling, a change of range or modulation, or unmount.
    const gestureOpen = useRef(false);
    const pointerTarget = useRef<Target | null>(null);
    const finishGesture = useCallback((cancelled: boolean) => {
        pointerTarget.current = null;
        if (!gestureOpen.current) return;
        gestureOpen.current = false;
        callbacks.current.onGestureEnd?.(cancelled);
    }, []);
    const write = (target: Target, next: number) => {
        if (disabled || !Number.isFinite(next)) return;
        const current = target === "start" ? domain.snap(value) : domain.snap(modulation?.end ?? value);
        if (next === current) return;
        if (!gestureOpen.current) { gestureOpen.current = true; callbacks.current.onGestureStart?.(); }
        if (target === "start") callbacks.current.onValueChange(next);
        else callbacks.current.modulation?.onEndChange(next);
    };
    const isModulated = modulation !== null;
    useLayoutEffect(() => () => finishGesture(true),
        [finishGesture, disabled, isModulated, domain.min, domain.max, domain.step, scaleKind(scale)]);

    const rootRef = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => rootRef.current ? retainStyles(rootRef.current, "slider", css) : undefined, []);
    const attach = useCallback((node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    const startValue = domain.snap(value);
    const endValue = modulation ? domain.snap(modulation.end) : startValue;
    const startPosition = domain.toPosition(startValue);
    const endPosition = domain.toPosition(endValue);
    const cells = Math.max(1, Math.round(tickCount));
    const fills = cellFills(startPosition, cells, discrete);
    const currentCell = fills.reduce((current, fill, index) => fill > 0 ? index : current, -1);
    const startCell = Math.round(startPosition * (cells - 1));
    const endCell = Math.round(endPosition * (cells - 1));
    const rangeLow = discrete ? (Math.min(startCell, endCell) / cells) * 100 : Math.min(startPosition, endPosition) * 100;
    const rangeHigh = discrete ? ((Math.max(startCell, endCell) + 1) / cells) * 100 : Math.max(startPosition, endPosition) * 100;

    /** Applies the modulation direction: dragging the value past a one-sided end carries the end along. */
    const constrained = (target: Target, next: number) => {
        const direction = modulation?.direction ?? "both";
        if (direction === "both" || !modulation) return next;
        if (target === "end") return direction === "up" ? Math.max(next, startValue) : Math.min(next, startValue);
        if (direction === "up" ? next > endValue : next < endValue) write("end", next);
        return next;
    };
    const afterKey = (current: number, edit: KeyboardStep) => {
        if (edit.kind === "min") return domain.min;
        if (edit.kind === "max") return domain.max;
        return step !== undefined
            ? domain.snap(current + (edit.steps * step))
            : domain.fromPosition(domain.toPosition(current) + (edit.steps * 0.01));
    };
    const keyDown = (target: Target) => (event: KeyboardEvent<HTMLElement>) => {
        if (disabled) return;
        if (event.key === "Escape") { finishGesture(true); return; }
        // A step finer than the snapping step would snap straight back, so stepped values ignore Shift.
        const edit = stepForKey({ key: event.key, shiftKey: event.shiftKey && step === undefined });
        if (!edit) return;
        event.preventDefault();
        write(target, constrained(target, afterKey(target === "start" ? startValue : endValue, edit)));
    };
    const keyHandlers = (target: Target) => ({
        onKeyDown: keyDown(target),
        onKeyUp: (event: KeyboardEvent<HTMLElement>) => { if (isStepKey(event.key)) finishGesture(false); },
        onBlur: () => finishGesture(true),
    });

    const positionAt = (element: Element, clientX: number) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 ? clamp01((clientX - bounds.left) / bounds.width) : 0;
    };
    const dragTo = (element: Element, clientX: number) => {
        const target = pointerTarget.current;
        if (target) write(target, constrained(target, domain.fromPosition(positionAt(element, clientX))));
    };
    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        const position = positionAt(event.currentTarget, event.clientX);
        pointerTarget.current = Math.abs(position - startPosition) <= Math.abs(position - endPosition) ? "start" : "end";
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Without capture the drag still follows moves over the surface.
        }
        dragTo(event.currentTarget, event.clientX);
    };

    const [draft, setDraft] = useState<string | null>(null);
    const [entryError, setEntryError] = useState("");
    const entryRef = useRef<HTMLInputElement | null>(null);
    const skipBlurCommit = useRef(false);
    const editingEntry = draft !== null;
    useEffect(() => {
        if (!editingEntry) return;
        entryRef.current?.focus();
        entryRef.current?.select();
    }, [editingEntry]);
    useEffect(() => { if (disabled) setDraft(null); }, [disabled]);
    const commitEntry = () => {
        if (entrySpec === null || draft === null) return;
        const result = parseParameterEntry(entrySpec, draft);
        if (result._tag === "rejected") {
            setEntryError(result.message);
            requestAnimationFrame(() => entryRef.current?.focus());
            return;
        }
        write("start", domain.snap(result.commit.value));
        finishGesture(false);
        setEntryError("");
        setDraft(null);
    };

    const valueText = formatValue(startValue);
    const readout = isModulated ? (
        <span className="bk-slider__range-values" data-slot="slider-value">
            <span className="bk-slider__chip bk-slider__chip--start">{valueText}</span>
            <span className="bk-slider__arrow" aria-hidden="true">→</span>
            <span className="bk-slider__chip bk-slider__chip--end">{formatValue(endValue)}</span>
        </span>
    ) : draft !== null && entrySpec !== null ? (
        <span className="bk-slider__entry">
            <span className="bk-slider__entry-field">
                <input
                    ref={entryRef}
                    type="text"
                    aria-label={`${name} exact value`}
                    data-slot="slider-entry"
                    value={draft}
                    onChange={event => { setDraft(event.currentTarget.value); setEntryError(""); }}
                    onKeyDown={event => {
                        if (event.key === "Enter") { event.preventDefault(); commitEntry(); }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            skipBlurCommit.current = true;
                            setEntryError("");
                            setDraft(null);
                        }
                    }}
                    onBlur={() => {
                        if (skipBlurCommit.current) { skipBlurCommit.current = false; return; }
                        commitEntry();
                    }}
                />
                <span>{formatParameterEntry(entrySpec, startValue).unit}</span>
            </span>
            {entryError ? <small role="alert">{entryError}</small> : null}
        </span>
    ) : entrySpec !== null ? (
        <button
            type="button"
            className="bk-slider__value bk-slider__value--editable"
            data-slot="slider-value"
            aria-label={`Edit ${name} exact value`}
            disabled={disabled}
            onClick={() => {
                skipBlurCommit.current = false;
                setEntryError("");
                setDraft(formatParameterEntry(entrySpec, startValue).draft);
            }}
        >
            {valueText}
        </button>
    ) : (
        <output className="bk-slider__value" data-slot="slider-value">{valueText}</output>
    );

    const rangeHandle = (target: Target) => (
        <span
            role="slider"
            className="bk-slider__range-handle"
            data-slot={`slider-${target}`}
            tabIndex={disabled ? -1 : 0}
            aria-label={`${name} ${target}`}
            aria-valuemin={domain.min}
            aria-valuemax={domain.max}
            aria-valuenow={target === "start" ? startValue : endValue}
            aria-valuetext={formatValue(target === "start" ? startValue : endValue)}
            aria-disabled={disabled || undefined}
            {...keyHandlers(target)}
        />
    );

    return (
        <div
            {...rootProps}
            ref={attach}
            className={["bk-slider", className].filter(Boolean).join(" ")}
            data-slot="slider"
            data-modulated={isModulated || undefined}
            data-disabled={disabled || undefined}
        >
            <span className="bk-slider__label" data-slot="slider-label">{label}</span>
            <span className="bk-slider__track">
                <span className="bk-slider__rail" aria-hidden="true">
                    {fills.map((fill, index) => {
                        const shown = isModulated ? 0 : fill;
                        return (
                            <span key={index} className="bk-slider__cell" data-slot="slider-cell" data-fill={shown}
                                data-current={shown > 0 && index === currentCell || undefined}>
                                <span className="bk-slider__cell-fill" style={{ "--bk-slider-fill": `${shown * 100}%` } as CSSProperties} />
                            </span>
                        );
                    })}
                </span>
                {isModulated ? (
                    <>
                        {endValue !== startValue ? (
                            <span className="bk-slider__rail bk-slider__rail--range" aria-hidden="true" data-slot="slider-range"
                                style={{ clipPath: `inset(0 ${100 - rangeHigh}% 0 ${rangeLow}%)` }}>
                                {fills.map((_fill, index) => <span key={index} className="bk-slider__cell" />)}
                            </span>
                        ) : null}
                        <span className="bk-slider__thumb bk-slider__thumb--start" style={{ left: `${startPosition * 100}%` }} />
                        <span className="bk-slider__thumb bk-slider__thumb--end" style={{ left: `${endPosition * 100}%` }} />
                        <div
                            className="bk-slider__drag-surface"
                            data-slot="slider-drag-surface"
                            role="presentation"
                            onPointerDown={startDrag}
                            onPointerMove={event => dragTo(event.currentTarget, event.clientX)}
                            onPointerUp={() => finishGesture(false)}
                            onPointerCancel={() => finishGesture(true)}
                            onLostPointerCapture={() => finishGesture(false)}
                        />
                        {rangeHandle("start")}
                        {rangeHandle("end")}
                    </>
                ) : (
                    <input
                        type="range"
                        className="bk-slider__input"
                        data-slot="slider-input"
                        aria-label={name}
                        aria-valuetext={valueText}
                        disabled={disabled}
                        min={0}
                        max={1}
                        step="any"
                        value={startPosition}
                        onChange={event => {
                            write("start", domain.fromPosition(Number(event.currentTarget.value)));
                            // Keys are handled above, so a change outside a drag comes from
                            // assistive technology and is a complete edit on its own.
                            if (pointerTarget.current === null) finishGesture(false);
                        }}
                        onPointerDown={event => {
                            if (disabled || event.button !== 0) return;
                            pointerTarget.current = "start";
                            try {
                                event.currentTarget.setPointerCapture(event.pointerId);
                            } catch {
                                // Without capture the native drag still works while over the input.
                            }
                        }}
                        onPointerUp={() => finishGesture(false)}
                        onPointerCancel={() => finishGesture(true)}
                        onLostPointerCapture={() => finishGesture(false)}
                        {...keyHandlers("start")}
                    />
                )}
            </span>
            {readout}
        </div>
    );
});
