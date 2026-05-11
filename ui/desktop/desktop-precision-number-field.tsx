import { useEffect, useMemo, useRef, useState } from "react";

import type { PatchControlBinding } from "../shared/patch-controls";

const DRAG_START_THRESHOLD_PX = 2;

export type PrecisionNumberFieldProps = {
    ariaLabel: string;
    binding: PatchControlBinding<number>;
    min: number;
    max: number;
    step?: number;
    width?: number;
    height?: number;
    variant?: "default" | "compactOverlay";
    suffix?: string | null;
    normalizedFromValue?: (bindingValue: number) => number;
    valueFromNormalized?: (normalizedValue: number) => number;
    pixelsPerFullRange?: number;
    fineDragMultiplier?: number;
    formatDisplay?: (value: number) => string;
    formatEditingValue?: (value: number) => string;
    parseText?: (rawText: string) => number | null;
    dataRole?: string;
};

type ActiveDragState = {
    pointerId: number;
    startClientX: number;
    startNormalizedValue: number;
    moved: boolean;
};

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function quantizeToStep(value: number, min: number, max: number, step: number) {
    if (!(step > 0)) {
        return clampNumber(value, min, max);
    }

    const quantized = min + (Math.round((value - min) / step) * step);
    return clampNumber(Number(quantized.toFixed(8)), min, max);
}

function defaultFormatEditingValue(value: number) {
    return String(value);
}

function defaultParseText(rawText: string) {
    const numericValue = Number.parseFloat(rawText.trim());
    return Number.isFinite(numericValue) ? numericValue : null;
}

export function PrecisionNumberField({
    ariaLabel,
    binding,
    min,
    max,
    step = 0,
    width = 128,
    height = 40,
    variant = "default",
    suffix = null,
    normalizedFromValue = (value) => value,
    valueFromNormalized = (value) => value,
    pixelsPerFullRange = 180,
    fineDragMultiplier = 0.2,
    formatDisplay = defaultFormatEditingValue,
    formatEditingValue = defaultFormatEditingValue,
    parseText = defaultParseText,
    dataRole,
}: PrecisionNumberFieldProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const activeDragRef = useRef<ActiveDragState | null>(null);
    const draftValueRef = useRef("");
    const skipCommitOnBlurRef = useRef(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState("");
    const normalizedMin = useMemo(
        () => Math.min(normalizedFromValue(min), normalizedFromValue(max)),
        [max, min, normalizedFromValue],
    );
    const normalizedMax = useMemo(
        () => Math.max(normalizedFromValue(min), normalizedFromValue(max)),
        [max, min, normalizedFromValue],
    );

    const displayValue = useMemo(() => (
        isEditing ? draftValue : formatDisplay(binding.value)
    ), [binding.value, draftValue, formatDisplay, isEditing]);
    const isCompactOverlay = variant === "compactOverlay";

    useEffect(() => {
        draftValueRef.current = draftValue;
    }, [draftValue]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }

        setDraftValue(formatEditingValue(binding.value));

        const animationFrameID = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [binding.value, formatEditingValue, isEditing]);

    const commitTextEntry = (rawText: string) => {
        const parsedValue = parseText(rawText);
        const nextValue = quantizeToStep(
            clampNumber(parsedValue ?? binding.value, min, max),
            min,
            max,
            step,
        );

        setDraftValue(formatEditingValue(nextValue));
        if (Math.abs(nextValue - binding.value) <= Math.max(step / 10, 1e-9)) {
            return;
        }

        binding.commitValue(nextValue);
    };

    const finishTextEntry = (commit: boolean) => {
        if (!isEditing) {
            return;
        }

        const nextDraftValue = draftValueRef.current;
        setIsEditing(false);

        if (commit) {
            commitTextEntry(nextDraftValue);
            return;
        }

        setDraftValue(formatEditingValue(binding.value));
    };

    return (
        <label className="grid gap-1">
            <span className="sr-only">{ariaLabel}</span>
            <div
                data-role={dataRole}
                className={`synth-compact-control relative ${
                    isCompactOverlay
                        ? "rounded-[5px]"
                        : "rounded-full"
                }`}
                style={{ width: `${width}px`, height: `${height}px` }}
            >
                <input
                    ref={inputRef}
                    aria-label={ariaLabel}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={!isEditing}
                    value={displayValue}
                    className={`h-full w-full bg-transparent font-mono text-cyan-100 outline-none ${
                        isCompactOverlay ? "px-1.5 text-[9px] tracking-[0.06em]" : `text-[13px] tracking-[0.12em] ${
                            suffix && !isEditing ? "pr-11" : "pr-4"
                        } pl-4`
                    } ${
                        isEditing ? "cursor-text selection:bg-cyan-300/25" : "cursor-ew-resize select-none"
                    }`}
                    onPointerDown={(event) => {
                        if (event.button !== 0 || isEditing) {
                            return;
                        }

                        activeDragRef.current = {
                            pointerId: event.pointerId,
                            startClientX: event.clientX,
                            startNormalizedValue: clampNumber(normalizedFromValue(binding.value), normalizedMin, normalizedMax),
                            moved: false,
                        };
                        binding.beginGesture();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        event.preventDefault();
                    }}
                    onPointerMove={(event) => {
                        const activeDrag = activeDragRef.current;

                        if (!activeDrag || activeDrag.pointerId !== event.pointerId || isEditing) {
                            return;
                        }

                        const deltaX = event.clientX - activeDrag.startClientX;
                        if (Math.abs(deltaX) >= DRAG_START_THRESHOLD_PX) {
                            activeDrag.moved = true;
                        }

                        const normalizedSpan = Math.max(1e-9, normalizedMax - normalizedMin);
                        const scaledDelta = (deltaX / Math.max(1, pixelsPerFullRange))
                            * normalizedSpan
                            * (event.shiftKey ? fineDragMultiplier : 1);
                        const nextNormalizedValue = clampNumber(
                            activeDrag.startNormalizedValue + scaledDelta,
                            normalizedMin,
                            normalizedMax,
                        );
                        const nextBindingValue = quantizeToStep(
                            clampNumber(valueFromNormalized(nextNormalizedValue), min, max),
                            min,
                            max,
                            step,
                        );

                        binding.setValue(nextBindingValue);
                    }}
                    onPointerUp={(event) => {
                        const activeDrag = activeDragRef.current;

                        if (!activeDrag || activeDrag.pointerId !== event.pointerId || isEditing) {
                            return;
                        }

                        activeDragRef.current = null;
                        event.currentTarget.releasePointerCapture?.(event.pointerId);
                        binding.endGesture();

                        if (!activeDrag.moved) {
                            inputRef.current?.focus();
                        }
                    }}
                    onPointerCancel={(event) => {
                        const activeDrag = activeDragRef.current;

                        if (!activeDrag || activeDrag.pointerId !== event.pointerId || isEditing) {
                            return;
                        }

                        activeDragRef.current = null;
                        event.currentTarget.releasePointerCapture?.(event.pointerId);
                        binding.endGesture();
                    }}
                    onDoubleClick={(event) => {
                        if (event.button !== 0) {
                            return;
                        }

                        event.preventDefault();
                        setIsEditing(true);
                    }}
                    onChange={(event) => {
                        if (!isEditing) {
                            return;
                        }

                        setDraftValue(event.currentTarget.value);
                    }}
                    onBlur={() => {
                        const shouldCommit = !skipCommitOnBlurRef.current;
                        skipCommitOnBlurRef.current = false;
                        finishTextEntry(shouldCommit);
                    }}
                    onKeyDown={(event) => {
                        if (!isEditing) {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                setIsEditing(true);
                            }
                            return;
                        }

                        if (event.key === "Enter") {
                            event.preventDefault();
                            inputRef.current?.blur();
                            return;
                        }

                        if (event.key === "Escape") {
                            event.preventDefault();
                            skipCommitOnBlurRef.current = true;
                            finishTextEntry(false);
                            inputRef.current?.blur();
                        }
                    }}
                />
                {suffix && !isEditing ? (
                    <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-cyan-100/58 ${
                        isCompactOverlay ? "right-1.5 text-[7px] tracking-[0.08em]" : "right-4 text-[10px] tracking-[0.16em]"
                    }`}>
                        {suffix}
                    </span>
                ) : null}
            </div>
        </label>
    );
}
