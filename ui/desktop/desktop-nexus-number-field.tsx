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

export function styleNexusNumberInput(element: HTMLInputElement, host: HTMLDivElement) {
    element.style.borderRadius = "16px";
    element.style.border = "1px solid rgba(255,255,255,0.08)";
    element.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.04)";
    element.style.fontFamily = "\"SF Mono\", \"JetBrains Mono\", ui-monospace, monospace";
    element.style.letterSpacing = "0.12em";
    element.style.fontSize = "14px";
    element.style.padding = "10px 14px";
    element.style.backgroundColor = "rgba(255,255,255,0.06)";
    element.style.color = "#d6f4ff";
    element.style.display = "block";
    element.style.width = "118px";
    element.style.height = "42px";
    host.style.width = "118px";
    host.style.height = "42px";
    host.style.cursor = "ns-resize";
}

export function NexusNumberField({
    label,
    binding,
    min,
    max,
    step,
    decimalPlaces = 3,
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
            size: [118, 42],
            value: binding.value,
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
        styleNexusNumberInput(widget.element, host);
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
            const safeValue = clampNumber(Number(nextValue) || 0, min, max);
            bindingRef.current.setValue(safeValue);
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
    }, [decimalPlaces, label, max, min, step]);

    useEffect(() => {
        const widget = widgetRef.current;

        if (!widget) {
            return;
        }

        if (document.activeElement === widget.element) {
            return;
        }

        if (Math.abs(widget.value - binding.value) <= step / 10) {
            return;
        }

        widget.passiveUpdate(binding.value);
        widget.render();
    }, [binding.value, step]);

    return (
        <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">{label}</span>
            <div className="flex items-center gap-3">
                <div ref={hostRef} className="h-[42px] w-[118px] rounded-[16px]" />
                <span className="font-mono text-xs tracking-[0.18em] text-cyan-200/80">s</span>
            </div>
        </label>
    );
}
