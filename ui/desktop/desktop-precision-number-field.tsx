import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PatchControlBinding } from "../shared/patch-controls";
import type { ModulationTargetKind } from "../shared/modulation-targets";
import {
    useLongPressParameterMenu,
    type ParameterMenuKeyTrackContract,
} from "../shared/parameter-context-menu";
import { KeyTrackStatus } from "../shared/key-track-status";
import {
    formatParameterEntry,
    parseParameterEntry,
    type ParameterEntrySpec,
} from "../shared/parameter-value-entry";

const DRAG_START_THRESHOLD_PX = 2;

export type PrecisionNumberFieldProps = {
    ariaLabel: string;
    binding: PatchControlBinding<number>;
    entrySpec: ParameterEntrySpec;
    suffix: string;
    width?: number;
    height?: number;
    variant?: "default" | "compactOverlay" | "inlineDark";
    leadingLabel?: string | null;
    enableWheel?: boolean;
    wheelStep?: number;
    normalizedFromValue?: (bindingValue: number) => number;
    valueFromNormalized?: (normalizedValue: number) => number;
    pixelsPerFullRange?: number;
    fineDragMultiplier?: number;
    dataRole?: string;
    modulationTargetKind?: ModulationTargetKind;
    menuLabel?: string;
    menuAmountSpec?: ParameterEntrySpec | null;
    menuBaseFieldLabel?: string;
    menuRouteDestinationLabel?: string;
    menuKeyTrack?: ParameterMenuKeyTrackContract;
};

type ActiveDragState = {
    endGesture: () => void;
    pointerId: number;
    startClientX: number;
    startNormalizedValue: number;
    moved: boolean;
};

type OptimisticDragValue = {
    endpointID: string;
    value: number;
};

type OptimisticDragHistory = {
    endpointID: string;
    observedValueKeys: Set<number>;
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

export function PrecisionNumberField({
    ariaLabel,
    binding,
    entrySpec,
    suffix,
    width = 128,
    height = 40,
    variant = "default",
    leadingLabel = null,
    enableWheel = false,
    wheelStep,
    normalizedFromValue = (value) => value,
    valueFromNormalized = (value) => value,
    pixelsPerFullRange = 180,
    fineDragMultiplier = 0.2,
    dataRole,
    modulationTargetKind,
    menuLabel = ariaLabel,
    menuAmountSpec,
    menuBaseFieldLabel,
    menuRouteDestinationLabel,
    menuKeyTrack,
}: PrecisionNumberFieldProps) {
    const { min, max, step } = entrySpec;
    // T20: a stationary long press opens the ADR-017 parameter menu; the
    // field's own drag cancels it through ordinary movement bubbling.
    const longPressMenu = useLongPressParameterMenu(useCallback(() => ({
        controlKey: binding.endpointID,
        label: menuLabel,
        targetKind: modulationTargetKind ?? null,
        baseSpec: entrySpec,
        amountSpec: menuAmountSpec,
        baseFieldLabel: menuBaseFieldLabel,
        routeDestinationLabel: menuRouteDestinationLabel,
        keyTrack: menuKeyTrack,
        baseValue: binding.value,
        defaultValue: binding.initialValue ?? null,
        commitBase: binding.commitValue,
    }), [binding.commitValue, binding.endpointID, binding.initialValue, binding.value, entrySpec, menuAmountSpec, menuBaseFieldLabel, menuKeyTrack, menuLabel, menuRouteDestinationLabel, modulationTargetKind]));
    const inputRef = useRef<HTMLInputElement | null>(null);
    const fieldRef = useRef<HTMLLabelElement | null>(null);
    const activeDragRef = useRef<ActiveDragState | null>(null);
    const draftValueRef = useRef("");
    const skipCommitOnBlurRef = useRef(false);
    const wheelCursorTimerRef = useRef<number>(0);
    const optimisticValueTimerRef = useRef<number>(0);
    const isMountedRef = useRef(true);
    const bindingRef = useRef(binding);
    bindingRef.current = binding;
    const editingSpecRef = useRef(entrySpec);
    const editingSuffixRef = useRef(suffix);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState("");
    const [entryError, setEntryError] = useState("");
    const [isWheelCursorHidden, setIsWheelCursorHidden] = useState(false);
    const [optimisticDragValue, setOptimisticDragValue] = useState<OptimisticDragValue | null>(null);
    const optimisticDragValueRef = useRef<OptimisticDragValue | null>(null);
    const optimisticDragHistoryRef = useRef<OptimisticDragHistory | null>(null);
    const updateDragFromPointerRef = useRef<(event: Pick<
        PointerEvent,
        "pointerId" | "pointerType" | "buttons" | "clientX" | "shiftKey"
    >) => void>(() => undefined);
    const normalizedMin = useMemo(
        () => Math.min(normalizedFromValue(min), normalizedFromValue(max)),
        [max, min, normalizedFromValue],
    );
    const normalizedMax = useMemo(
        () => Math.max(normalizedFromValue(min), normalizedFromValue(max)),
        [max, min, normalizedFromValue],
    );

    const presentedBindingValue = optimisticDragValue?.endpointID === binding.endpointID
        ? optimisticDragValue.value
        : binding.value;
    if (!isEditing) {
        editingSpecRef.current = entrySpec;
        editingSuffixRef.current = suffix;
    }
    const activeEntrySpec = isEditing ? editingSpecRef.current : entrySpec;
    const displayValue = useMemo(() => (
        isEditing ? draftValue : formatParameterEntry(entrySpec, presentedBindingValue).display
    ), [draftValue, entrySpec, isEditing, presentedBindingValue]);
    const specUnit = formatParameterEntry(activeEntrySpec, presentedBindingValue).unit;
    if (!isEditing && suffix !== specUnit) {
        throw new RangeError(`Precision field "${ariaLabel}" suffix must match its parameter entry spec.`);
    }
    const isCompactOverlay = variant === "compactOverlay";
    const isInlineDark = variant === "inlineDark";
    const shouldShowLeadingLabel = isInlineDark && Boolean(leadingLabel);

    const updateDraftValue = useCallback((nextValue: string) => {
        draftValueRef.current = nextValue;
        setDraftValue(nextValue);
    }, []);

    const clearOptimisticDragValue = useCallback(() => {
        clearTimeout(optimisticValueTimerRef.current);
        optimisticDragValueRef.current = null;
        optimisticDragHistoryRef.current = null;
        setOptimisticDragValue(null);
    }, []);

    const presentDragValue = useCallback((nextValue: number) => {
        const previousPending = optimisticDragValueRef.current;
        const currentValue = previousPending?.endpointID === bindingRef.current.endpointID
            ? previousPending.value
            : bindingRef.current.value;
        const agreementTolerance = Math.max(step / 10, 1e-9);
        if (Math.abs(nextValue - currentValue) <= agreementTolerance) {
            return;
        }

        clearTimeout(optimisticValueTimerRef.current);
        const valueKey = (value: number) => Math.round(value / agreementTolerance);
        const previousHistory = optimisticDragHistoryRef.current;
        const history = previousHistory?.endpointID === bindingRef.current.endpointID
            ? previousHistory
            : {
                endpointID: bindingRef.current.endpointID,
                observedValueKeys: new Set([valueKey(bindingRef.current.value)]),
            };
        history.observedValueKeys.add(valueKey(nextValue));
        const pending: OptimisticDragValue = {
            endpointID: bindingRef.current.endpointID,
            value: nextValue,
        };
        optimisticDragHistoryRef.current = history;
        optimisticDragValueRef.current = pending;
        setOptimisticDragValue(pending);
        startTransition(() => {
            bindingRef.current.setValue(nextValue);
        });
        if (inputRef.current) {
            inputRef.current.value = formatParameterEntry(entrySpec, nextValue).display;
        }
    }, [entrySpec, step]);

    useEffect(() => {
        const pendingValue = optimisticDragValueRef.current;
        if (!pendingValue) {
            return;
        }

        const agreementTolerance = Math.max(step / 10, 1e-9);
        const history = optimisticDragHistoryRef.current;
        const endpointChanged = pendingValue.endpointID !== binding.endpointID;
        const latestValueAccepted = Math.abs(binding.value - pendingValue.value) <= agreementTolerance;
        const valueBelongsToThisGesture = history?.endpointID === binding.endpointID
            && history.observedValueKeys.has(Math.round(binding.value / agreementTolerance));
        if (endpointChanged || latestValueAccepted || !valueBelongsToThisGesture) {
            clearOptimisticDragValue();
        }
    }, [binding.endpointID, binding.value, clearOptimisticDragValue, step]);

    const readPresentedBindingValue = useCallback(() => {
        const pending = optimisticDragValueRef.current;
        return pending?.endpointID === bindingRef.current.endpointID
            ? pending.value
            : bindingRef.current.value;
    }, []);

    const beginTextEntry = useCallback(() => {
        if (!bindingRef.current.isReady) {
            return;
        }
        editingSpecRef.current = entrySpec;
        editingSuffixRef.current = suffix;
        updateDraftValue(formatParameterEntry(entrySpec, readPresentedBindingValue()).draft);
        setEntryError("");
        setIsEditing(true);
    }, [entrySpec, readPresentedBindingValue, suffix, updateDraftValue]);

    const finishDrag = useCallback((pointerId?: number) => {
        const activeDrag = activeDragRef.current;
        if (!activeDrag || (pointerId !== undefined && activeDrag.pointerId !== pointerId)) {
            return null;
        }

        activeDragRef.current = null;
        const input = inputRef.current;
        try {
            if (input?.hasPointerCapture(activeDrag.pointerId)) {
                input.releasePointerCapture(activeDrag.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation or window deactivation.
        }
        activeDrag.endGesture();
        if (activeDrag.moved && optimisticDragValueRef.current) {
            clearTimeout(optimisticValueTimerRef.current);
            optimisticValueTimerRef.current = window.setTimeout(clearOptimisticDragValue, 1_000);
        }
        return activeDrag;
    }, [clearOptimisticDragValue]);

    const updateDragFromPointer = (event: Pick<
        PointerEvent,
        "pointerId" | "pointerType" | "buttons" | "clientX" | "shiftKey"
    >) => {
        const activeDrag = activeDragRef.current;

        if (!activeDrag || activeDrag.pointerId !== event.pointerId || isEditing) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            finishDrag(event.pointerId);
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

        presentDragValue(nextBindingValue);
    };
    updateDragFromPointerRef.current = updateDragFromPointer;

    useEffect(() => {
        isMountedRef.current = true;
        const handleFallbackPointerMove = (event: PointerEvent) => {
            const activeDrag = activeDragRef.current;
            if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
                return;
            }
            const input = inputRef.current;
            if (event.target instanceof Node && input?.contains(event.target)) {
                return;
            }
            updateDragFromPointerRef.current(event);
        };
        const handlePointerEnd = (event: PointerEvent) => finishDrag(event.pointerId);
        const handleBlur = () => finishDrag();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                finishDrag();
            }
        };

        window.addEventListener("pointermove", handleFallbackPointerMove, true);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            isMountedRef.current = false;
            clearTimeout(wheelCursorTimerRef.current);
            clearTimeout(optimisticValueTimerRef.current);
            window.removeEventListener("pointermove", handleFallbackPointerMove, true);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            finishDrag();
        };
    }, [finishDrag]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }

        const animationFrameID = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [isEditing]);

    useEffect(() => {
        if (isEditing) {
            setIsWheelCursorHidden(false);
        }
    }, [isEditing]);

    const commitTextEntry = (rawText: string) => {
        if (!bindingRef.current.isReady) {
            return false;
        }
        const result = parseParameterEntry(editingSpecRef.current, rawText);
        if (result._tag === "rejected") {
            setEntryError(result.message);
            return false;
        }
        if (result.commit._tag !== "value") {
            throw new Error("A precision number field cannot commit a tempo division.");
        }
        const currentValue = readPresentedBindingValue();
        const nextValue = result.commit.value;

        updateDraftValue(result.echo.draft);
        setEntryError("");
        if (Math.abs(nextValue - currentValue) <= Math.max(step / 10, 1e-9)) {
            return true;
        }

        bindingRef.current.commitValue(nextValue);
        return true;
    };

    const adjustByWheel = useCallback((deltaDirection: number) => {
        const displayStep = Math.abs(wheelStep ?? step) || Math.max(1e-9, (max - min) / 400);
        const nextValue = quantizeToStep(
            clampNumber(presentedBindingValue + (deltaDirection * displayStep), min, max),
            min,
            max,
            step,
        );

        if (Math.abs(nextValue - presentedBindingValue) <= Math.max(step / 10, 1e-9)) {
            return;
        }

        binding.commitValue(nextValue);
    }, [binding, max, min, presentedBindingValue, step, wheelStep]);

    useEffect(() => {
        const field = fieldRef.current;
        const input = inputRef.current;

        if (!field || !input || !enableWheel) {
            return;
        }

        const timerRef = wheelCursorTimerRef;
        const handler = (event: WheelEvent) => {
            if (!bindingRef.current.isReady || isEditing || event.deltaY === 0) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            setIsWheelCursorHidden(true);
            clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                if (isMountedRef.current) {
                    setIsWheelCursorHidden(false);
                }
            }, 400);
            adjustByWheel(event.deltaY > 0 ? 1 : -1);
        };

        field.addEventListener("wheel", handler, { passive: false });

        return () => {
            field.removeEventListener("wheel", handler);
        };
    }, [adjustByWheel, enableWheel, isEditing]);

    const finishTextEntry = (commit: boolean) => {
        if (!isEditing) {
            return false;
        }

        const nextDraftValue = draftValueRef.current;

        if (commit) {
            if (!commitTextEntry(nextDraftValue)) {
                window.requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    inputRef.current?.select();
                });
                return false;
            }
        } else {
            updateDraftValue(formatParameterEntry(editingSpecRef.current, readPresentedBindingValue()).draft);
            setEntryError("");
        }

        setIsEditing(false);
        return true;
    };

    return (
        <label
            ref={fieldRef}
            data-role={isInlineDark ? dataRole : undefined}
            data-host-state={binding.isReady ? "ready" : "loading"}
            data-modulation-target-kind={modulationTargetKind}
            aria-busy={!binding.isReady}
            {...(binding.isReady ? longPressMenu : {})}
            className={`${isInlineDark
                ? "inline-flex h-6 min-w-0 items-center gap-1 rounded-[5px] border border-[rgb(var(--cosimo-edge-rgb)/0.34)] bg-[rgb(var(--cosimo-raised-rgb)/0.58)] px-1 text-[var(--cosimo-ink)] shadow-[var(--cosimo-shadow-raised)]"
                : "grid gap-1"
            } ${binding.isReady ? "" : "cursor-wait opacity-45"}`}
        >
            <span className={shouldShowLeadingLabel
                ? "shrink-0 text-[7px] font-bold uppercase tracking-[0.10em] text-slate-300/45"
                : "sr-only"
            }>
                {leadingLabel ?? ariaLabel}
            </span>
            <div
                data-role={isInlineDark ? undefined : dataRole}
                className={isInlineDark
                    ? "relative flex items-center rounded-[4px] border border-white/[0.07] bg-[rgba(3,5,12,0.58)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : `cosimo-control relative ${
                        isCompactOverlay
                            ? "rounded-[5px]"
                            : "rounded-full"
                    }`
                }
                style={{ width: `${width}px`, height: `${height}px` }}
            >
                {menuKeyTrack?.enabled ? (
                    <KeyTrackStatus controlKey={dataRole ?? binding.endpointID} />
                ) : null}
                <input
                    ref={inputRef}
                    aria-label={ariaLabel}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!binding.isReady}
                    readOnly={!isEditing}
                    value={displayValue}
                    style={isWheelCursorHidden && !isEditing ? { cursor: "none" } : undefined}
                    className={isInlineDark
                        ? `cosimo-readout is-caps w-full select-none whitespace-nowrap bg-transparent px-1.5 py-[3px] text-center leading-none tracking-[0.08em] outline-none ${
                            isEditing ? "cursor-text selection:bg-cyan-300/25" : "cursor-ew-resize"
                        }`
                        : `cosimo-readout is-caps h-full w-full bg-transparent outline-none ${isCompactOverlay ? "is-caption px-1.5 tracking-[0.06em]" : `is-title tracking-[0.12em] ${
                            isEditing ? "pr-11" : "pr-4"
                        } pl-4`
                        } ${
                            isEditing ? "cursor-text selection:bg-cyan-300/25" : "cursor-ew-resize select-none"
                        }`
                    }
                    onPointerDown={(event) => {
                        if (!binding.isReady || event.button !== 0 || isEditing) {
                            return;
                        }

                        activeDragRef.current = {
                            endGesture: binding.endGesture,
                            pointerId: event.pointerId,
                            startClientX: event.clientX,
                            startNormalizedValue: clampNumber(
                                normalizedFromValue(readPresentedBindingValue()),
                                normalizedMin,
                                normalizedMax,
                            ),
                            moved: false,
                        };
                        binding.beginGesture();
                        try {
                            event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                            // Synthetic pointers and older hosts may not support capture.
                        }
                        event.preventDefault();
                    }}
                    onPointerMove={(event) => updateDragFromPointer(event.nativeEvent)}
                    onPointerUp={(event) => {
                        const activeDrag = finishDrag(event.pointerId);
                        if (!activeDrag || isEditing) {
                            return;
                        }

                        if (!activeDrag.moved) {
                            if (isInlineDark) {
                                beginTextEntry();
                            } else {
                                inputRef.current?.focus();
                            }
                        }
                    }}
                    onPointerCancel={(event) => {
                        finishDrag(event.pointerId);
                    }}
                    onLostPointerCapture={(event) => finishDrag(event.pointerId)}
                    onDoubleClick={(event) => {
                        if (event.button !== 0) {
                            return;
                        }

                        event.preventDefault();
                        beginTextEntry();
                    }}
                    onChange={(event) => {
                        if (!isEditing) {
                            return;
                        }

                        updateDraftValue(event.currentTarget.value);
                    }}
                    onBlur={() => {
                        if (skipCommitOnBlurRef.current) {
                            skipCommitOnBlurRef.current = false;
                            return;
                        }
                        skipCommitOnBlurRef.current = false;
                        finishTextEntry(true);
                    }}
                    onKeyDown={(event) => {
                        if (!isEditing) {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                beginTextEntry();
                            }
                            return;
                        }

                        if (event.key === "Enter") {
                            event.preventDefault();
                            if (finishTextEntry(true)) {
                                skipCommitOnBlurRef.current = true;
                                inputRef.current?.blur();
                            }
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
                {isEditing ? (
                    <span
                        data-role="parameter-entry-unit"
                        className={`cosimo-readout is-caps pointer-events-none absolute top-1/2 -translate-y-1/2 opacity-60 ${
                        isCompactOverlay ? "is-caption right-1.5 tracking-[0.08em]" : "right-4 tracking-[0.16em]"
                    }`}
                    >
                        {editingSuffixRef.current}
                    </span>
                ) : null}
                {entryError ? (
                    <span
                        role="alert"
                        data-role="parameter-entry-error"
                        className="absolute left-0 top-full z-30 mt-1 min-w-full rounded bg-red-950/95 px-1.5 py-1 text-[9px] leading-tight text-red-100 shadow-lg"
                    >
                        {entryError}
                    </span>
                ) : null}
            </div>
        </label>
    );
}
