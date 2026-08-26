import { useCallback, useEffect, useRef, useState } from "react";
import Nexus from "nexusui";

import type { PatchControlBinding } from "../shared/patch-controls";
import type { ModulationTargetKind } from "../shared/modulation-targets";
import { useLongPressParameterMenu } from "../shared/parameter-context-menu";
import {
    formatParameterEntry,
    parseParameterEntry,
    type ParameterEntrySpec,
} from "../shared/parameter-value-entry";

export type NexusNumberFieldProps = {
    label: string;
    binding: PatchControlBinding<number>;
    entrySpec: ParameterEntrySpec;
    decimalPlaces?: number;
    variant?: "default" | "overlay" | "compactOverlay";
    showLabel?: boolean;
    width?: number;
    height?: number;
    onActivate?: () => void;
    onBeginTextEntry?: () => void;
    onEndTextEntry?: () => void;
    modulationTargetKind?: ModulationTargetKind;
    dataRole?: string;
};

export type NexusNumberWidgetLike = {
    value: number;
    decimalPlaces: number;
    colors: {
        fill: string;
        dark: string;
        light: string;
        accent: string;
    };
    element: HTMLInputElement;
    colorInterface(): void;
    on(eventName: string, listener: (value?: number) => void): void;
    passiveUpdate(value: number): void;
    render(): void;
    destroy(): void;
};

type NexusNumberConstructorLike = new (
    host: HTMLDivElement,
    options: {
        size: [number, number];
        value: number;
        min: number;
        max: number;
        step: number;
    },
) => NexusNumberWidgetLike;

let nexusNumberConstructor: NexusNumberConstructorLike = Nexus.Number as unknown as NexusNumberConstructorLike;

export function setNexusNumberConstructorForTests(nextConstructor: NexusNumberConstructorLike | null) {
    nexusNumberConstructor = nextConstructor ?? Nexus.Number as unknown as NexusNumberConstructorLike;
}

export function styleNexusNumberInput(
    element: HTMLInputElement,
    host: HTMLDivElement,
    {
        variant,
        width,
        height,
    }: {
        variant: "default" | "overlay" | "compactOverlay";
        width: number;
        height: number;
    },
) {
    const isOverlay = variant === "overlay" || variant === "compactOverlay";
    const isCompactOverlay = variant === "compactOverlay";

    element.style.borderRadius = isOverlay ? (isCompactOverlay ? "5px" : "999px") : "16px";
    element.style.border = isOverlay
        ? "1px solid rgba(255,255,255,0.10)"
        : "1px solid rgba(255,255,255,0.08)";
    element.style.boxShadow = isOverlay
        ? (isCompactOverlay ? "0 4px 12px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 10px 28px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)")
        : "inset 0 1px 0 rgba(255,255,255,0.04)";
    element.style.fontFamily = "\"SF Mono\", \"JetBrains Mono\", ui-monospace, monospace";
    element.style.letterSpacing = isCompactOverlay ? "0.06em" : "0.12em";
    element.style.fontSize = isOverlay ? (isCompactOverlay ? "9px" : "13px") : "14px";
    element.style.padding = isOverlay ? (isCompactOverlay ? "0 6px" : "10px 16px") : "10px 14px";
    element.style.backgroundColor = isOverlay ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.06)";
    element.style.color = "#d6f4ff";
    element.style.display = "block";
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    host.style.cursor = isOverlay ? "ew-resize" : "ns-resize";
}

export function NexusNumberField({
    label,
    binding,
    entrySpec,
    decimalPlaces,
    variant = "default",
    showLabel = true,
    width = 118,
    height = 42,
    onActivate,
    onBeginTextEntry,
    onEndTextEntry,
    modulationTargetKind,
    dataRole,
}: NexusNumberFieldProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<NexusNumberWidgetLike | null>(null);
    const bindingRef = useRef(binding);
    const entrySpecRef = useRef(entrySpec);
    const textEntryActiveRef = useRef(false);
    const [isTextEntryActive, setIsTextEntryActive] = useState(false);
    const [entryError, setEntryError] = useState("");
    const callbackRef = useRef({
        onActivate,
        onBeginTextEntry,
        onEndTextEntry,
    });

    useEffect(() => {
        bindingRef.current = binding;
        if (!textEntryActiveRef.current) {
            entrySpecRef.current = entrySpec;
        }
        callbackRef.current = {
            onActivate,
            onBeginTextEntry,
            onEndTextEntry,
        };
    }, [binding, entrySpec, onActivate, onBeginTextEntry, onEndTextEntry]);

    const activeEntrySpec = isTextEntryActive ? entrySpecRef.current : entrySpec;
    const displayMin = Number(formatParameterEntry(activeEntrySpec, activeEntrySpec.min).draft);
    const displayMax = Number(formatParameterEntry(activeEntrySpec, activeEntrySpec.max).draft);
    const displayStep = Math.abs(
        Number(formatParameterEntry(
            activeEntrySpec,
            Math.min(activeEntrySpec.max, activeEntrySpec.min + activeEntrySpec.step),
        ).draft)
        - displayMin,
    );
    const displayValue = Number(formatParameterEntry(activeEntrySpec, binding.value).draft);
    const suffix = formatParameterEntry(activeEntrySpec, binding.value).unit;
    if (!Number.isFinite(displayMin)
        || !Number.isFinite(displayMax)
        || !Number.isFinite(displayStep)
        || !(displayStep > 0)
        || !Number.isFinite(displayValue)) {
        throw new RangeError(`Nexus field "${label}" requires a finite displayed numeric domain.`);
    }
    // T20: a stationary long press anywhere on the field opens the ADR-017
    // parameter menu (typing stays available through normal focus).
    const longPressMenu = useLongPressParameterMenu(useCallback(() => ({
        controlKey: binding.endpointID,
        label,
        targetKind: modulationTargetKind ?? null,
        baseSpec: entrySpec,
        baseValue: binding.value,
        defaultValue: binding.initialValue ?? null,
        commitBase: binding.commitValue,
    }), [binding.commitValue, binding.endpointID, binding.initialValue, binding.value, entrySpec, label, modulationTargetKind]));

    // The rendered precision follows the DISPLAYED unit's step (500 ms shows
    // no decimals; 0.500 s shows three) unless a caller explicitly overrides.
    const stepText = String(displayStep);
    const stepPointIndex = stepText.indexOf(".");
    const resolvedDecimalPlaces = decimalPlaces
        ?? (stepPointIndex === -1 ? 0 : stepText.length - stepPointIndex - 1);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        host.replaceChildren();

        const widget = new nexusNumberConstructor(host, {
            size: [width, height],
            value: displayValue,
            min: displayMin,
            max: displayMax,
            step: displayStep,
        });
        widget.decimalPlaces = resolvedDecimalPlaces;
        widget.colors.fill = "rgba(255,255,255,0.06)";
        widget.colors.dark = "#d6f4ff";
        widget.colors.light = "#06101f";
        widget.colors.accent = "#8fe8ff";
        widget.colorInterface();
        widget.element.setAttribute("aria-label", label);
        styleNexusNumberInput(widget.element, host, { variant, width, height });
        const handleMouseDown = () => {
            if (!bindingRef.current.isReady) return;
            callbackRef.current.onActivate?.();
        };
        const handleFocus = () => {
            if (!bindingRef.current.isReady) {
                widget.element.blur();
                return;
            }
            entrySpecRef.current = activeEntrySpec;
            textEntryActiveRef.current = true;
            setIsTextEntryActive(true);
            setEntryError("");
            callbackRef.current.onActivate?.();
            callbackRef.current.onBeginTextEntry?.();
        };
        const handleBlur = () => {
            const result = parseParameterEntry(entrySpecRef.current, widget.element.value);
            if (result._tag === "rejected") {
                setEntryError(result.message);
                window.requestAnimationFrame(() => widget.element.focus());
                return;
            }
            if (result.commit._tag !== "value") {
                throw new Error("A Nexus number field cannot commit a tempo division.");
            }
            widget.element.value = result.echo.draft;
            setEntryError("");
            textEntryActiveRef.current = false;
            setIsTextEntryActive(false);
            callbackRef.current.onEndTextEntry?.();
        };
        const handleWidgetChange = (nextValue?: number) => {
            if (!bindingRef.current.isReady) return;
            const entryText = nextValue === undefined ? widget.element.value : String(nextValue);
            const result = parseParameterEntry(entrySpecRef.current, entryText);
            if (result._tag === "rejected") {
                setEntryError(result.message);
                return;
            }
            if (result.commit._tag !== "value") {
                throw new Error("A Nexus number field cannot commit a tempo division.");
            }
            widget.element.value = result.echo.draft;
            setEntryError("");
            bindingRef.current.setValue(result.commit.value);
        };

        widget.element.addEventListener("mousedown", handleMouseDown);
        widget.element.addEventListener("focus", handleFocus);
        widget.element.addEventListener("blur", handleBlur);
        widget.on("change", handleWidgetChange);

        widgetRef.current = widget;

        return () => {
            widget.element.removeEventListener("mousedown", handleMouseDown);
            widget.element.removeEventListener("focus", handleFocus);
            widget.element.removeEventListener("blur", handleBlur);
            if (textEntryActiveRef.current) {
                textEntryActiveRef.current = false;
                setIsTextEntryActive(false);
                callbackRef.current.onEndTextEntry?.();
            }
            widget.destroy();
            widgetRef.current = null;
        };
    }, [displayMax, displayMin, displayStep, height, label, resolvedDecimalPlaces, variant, width]);

    useEffect(() => {
        const widget = widgetRef.current;
        const host = hostRef.current;
        if (!widget || !host) return;
        widget.element.disabled = !binding.isReady;
        widget.element.setAttribute("data-host-state", binding.isReady ? "ready" : "loading");
        host.style.cursor = binding.isReady ? (variant === "default" ? "ns-resize" : "ew-resize") : "wait";
        host.style.opacity = binding.isReady ? "1" : "0.45";
    }, [binding.isReady, variant]);

    useEffect(() => {
        const widget = widgetRef.current;

        if (!widget) {
            return;
        }

        if (document.activeElement === widget.element) {
            return;
        }

        if (Math.abs(widget.value - displayValue) <= displayStep / 10) {
            return;
        }

        widget.passiveUpdate(displayValue);
        widget.render();
    }, [binding.value, displayValue, displayStep]);

    return (
        <label
            className="grid gap-2"
            data-role={dataRole}
            data-host-state={binding.isReady ? "ready" : "loading"}
            data-modulation-target-kind={modulationTargetKind}
            aria-busy={!binding.isReady}
            {...(binding.isReady ? longPressMenu : {})}
        >
            {showLabel ? (
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">{label}</span>
            ) : (
                <span className="sr-only">{label}</span>
            )}
            <div className="flex items-center gap-3">
                <div
                    ref={hostRef}
                    className={variant === "overlay" ? "rounded-full" : "rounded-[16px]"}
                    style={{ width: `${width}px`, height: `${height}px` }}
                />
                {suffix ? (
                    <span data-role="parameter-entry-unit" className="font-mono text-xs tracking-[0.18em] text-cyan-200/80">{suffix}</span>
                ) : null}
                {entryError ? (
                    <span
                        role="alert"
                        data-role="parameter-entry-error"
                        className="rounded bg-red-950/95 px-1.5 py-1 text-[9px] leading-tight text-red-100 shadow-lg"
                    >
                        {entryError}
                    </span>
                ) : null}
            </div>
        </label>
    );
}
