import { useEffect, useRef } from "react";
import Nexus from "nexusui";

import type { PatchControlBinding } from "../shared/patch-controls";

export type NexusNumberFieldProps = {
    label: string;
    binding: PatchControlBinding<number>;
    min: number;
    max: number;
    step: number;
    decimalPlaces?: number;
    suffix?: string | null;
    variant?: "default" | "overlay" | "compactOverlay";
    showLabel?: boolean;
    width?: number;
    height?: number;
    displayValueFromBinding?: (bindingValue: number) => number;
    bindingValueFromDisplay?: (displayValue: number) => number;
    onActivate?: () => void;
    onBeginTextEntry?: () => void;
    onEndTextEntry?: () => void;
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

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
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
    min,
    max,
    step,
    decimalPlaces = 3,
    suffix = "s",
    variant = "default",
    showLabel = true,
    width = 118,
    height = 42,
    displayValueFromBinding,
    bindingValueFromDisplay,
    onActivate,
    onBeginTextEntry,
    onEndTextEntry,
}: NexusNumberFieldProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const widgetRef = useRef<NexusNumberWidgetLike | null>(null);
    const bindingRef = useRef(binding);
    const textEntryActiveRef = useRef(false);
    const callbackRef = useRef({
        onActivate,
        onBeginTextEntry,
        onEndTextEntry,
    });

    useEffect(() => {
        bindingRef.current = binding;
        callbackRef.current = {
            onActivate,
            onBeginTextEntry,
            onEndTextEntry,
        };
    }, [binding, onActivate, onBeginTextEntry, onEndTextEntry]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        host.replaceChildren();

        const widget = new nexusNumberConstructor(host, {
            size: [width, height],
            value: displayValueFromBinding ? displayValueFromBinding(binding.value) : binding.value,
            min,
            max,
            step,
        });
        widget.decimalPlaces = decimalPlaces;
        widget.colors.fill = "rgba(255,255,255,0.06)";
        widget.colors.dark = "#d6f4ff";
        widget.colors.light = "#06101f";
        widget.colors.accent = "#8fe8ff";
        widget.colorInterface();
        widget.element.setAttribute("aria-label", label);
        styleNexusNumberInput(widget.element, host, { variant, width, height });
        const handleMouseDown = () => {
            callbackRef.current.onActivate?.();
        };
        const handleFocus = () => {
            textEntryActiveRef.current = true;
            callbackRef.current.onActivate?.();
            callbackRef.current.onBeginTextEntry?.();
        };
        const handleBlur = () => {
            textEntryActiveRef.current = false;
            callbackRef.current.onEndTextEntry?.();
        };
        const handleWidgetChange = (nextValue?: number) => {
            const safeDisplayValue = clampNumber(Number(nextValue) || 0, min, max);
            const bindingValue = bindingValueFromDisplay ? bindingValueFromDisplay(safeDisplayValue) : safeDisplayValue;
            bindingRef.current.setValue(bindingValue);
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
                callbackRef.current.onEndTextEntry?.();
            }
            widget.destroy();
            widgetRef.current = null;
        };
    }, [bindingValueFromDisplay, decimalPlaces, displayValueFromBinding, height, label, max, min, step, variant, width]);

    useEffect(() => {
        const widget = widgetRef.current;

        if (!widget) {
            return;
        }

        if (document.activeElement === widget.element) {
            return;
        }

        const displayValue = displayValueFromBinding ? displayValueFromBinding(binding.value) : binding.value;

        if (Math.abs(widget.value - displayValue) <= step / 10) {
            return;
        }

        widget.passiveUpdate(displayValue);
        widget.render();
    }, [binding.value, displayValueFromBinding, step]);

    return (
        <label className="grid gap-2">
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
                    <span className="font-mono text-xs tracking-[0.18em] text-cyan-200/80">{suffix}</span>
                ) : null}
            </div>
        </label>
    );
}
