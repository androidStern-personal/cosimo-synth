import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
    type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SVGProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { knobDomain, type KnobScale } from "./knob-scale";
import { knobAnnulus, knobArcPoint, knobSector } from "./knob-geometry";
import { animateLiveNumber, type LiveNumber } from "./live-value";
import { useParameterGesture, type ParameterGestureChannel } from "./parameter-gesture";
import type { RollingAxis } from "./rolling-axis-classifier";
import { retainKnobStyles } from "./knob-styles";

/** One controlled numeric quantity; value, bounds and step share canonical units. */
export type KnobValueOptions = {
    readonly value: number;
    readonly onValueChange: (value: number) => void;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly scale?: KnobScale;
    readonly onGestureStart?: () => void;
    readonly onGestureEnd?: (cancelled: boolean) => void;
};

/** The root owns numeric interpretation and shared interaction state, without a patch connection. */
export type KnobRootProps = KnobValueOptions & Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> & {
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly formatValue?: (value: number) => string;
};

type Interaction = { readonly isDragging: boolean; readonly activeAxis: RollingAxis | null };
type Context = {
    readonly value: number;
    readonly domain: ReturnType<typeof knobDomain>;
    readonly format: (value: number) => string;
    readonly disabled: boolean;
    readonly readOnly: boolean;
    readonly controlId: string;
    readonly labelId: string;
    readonly options: { current: KnobValueOptions };
    readonly interaction: Interaction;
    readonly setInteraction: (state: Interaction) => void;
};
const KnobContext = createContext<Context | null>(null);
const defaultFormat = (value: number) => String(Number(value.toPrecision(5)));
function useContextValue() {
    const context = useContext(KnobContext);
    if (!context) throw new Error("Knob parts must be inside KnobRoot.");
    return context;
}

/** Shared context and layout container for composed knob parts. */
export const KnobRoot = forwardRef<HTMLDivElement, KnobRootProps>(function KnobRoot({
    value, onValueChange, min = 0, max = 1, step, scale = "linear", onGestureStart, onGestureEnd,
    disabled = false, readOnly = false, formatValue = defaultFormat, className = "", children, ...props
}, ref) {
    const id = useId();
    const attach = useCallback((node: HTMLDivElement | null) => {
        if (!node) return;
        const release = retainKnobStyles(node);
        // React 19 accepts callback-ref cleanup, including callbacks passed through forwardRef.
        const releaseRef: unknown = typeof ref === "function" ? ref(node) : undefined;
        if (ref && typeof ref !== "function") ref.current = node;
        return () => {
            release();
            if (typeof releaseRef === "function") releaseRef();
            else if (typeof ref === "function") ref(null);
            else if (ref) ref.current = null;
        };
    }, [ref]);
    const domain = useMemo(() => knobDomain({ min, max, step, scale }), [min, max, step, scale]);
    if (!Number.isFinite(value)) throw new RangeError("Knob value must be finite.");
    const options = useRef<KnobValueOptions>({ value, onValueChange });
    options.current = { value, onValueChange, min, max, step, scale, onGestureStart, onGestureEnd };
    const [interaction, setInteraction] = useState<Interaction>({ isDragging: false, activeAxis: null });
    const context: Context = { value, domain, options, disabled, readOnly, format: formatValue,
        controlId: `${id}-control`, labelId: `${id}-label`, interaction, setInteraction };
    return <KnobContext.Provider value={context}>
        <div {...props} ref={attach} className={`bk-knob ${className}`} data-slot="knob-root"
            data-disabled={disabled || undefined} data-readonly={readOnly || undefined}
            data-dragging={interaction.isDragging || undefined} data-axis={interaction.activeAxis ?? undefined}>
            {children}
        </div>
    </KnobContext.Provider>;
});

/** Read the current value, scale and interaction state to build custom artwork or an external readout. */
export function useKnob() {
    const context = useContextValue();
    return { value: context.value, position: context.domain.toPosition(context.value),
        toPosition: context.domain.toPosition, ...context.interaction };
}

/** Map each drag axis to the root value, a second quantity, or an inert axis. */
export type KnobDrag = "vertical" | "horizontal" | {
    readonly horizontal: "value" | KnobValueOptions | null;
    readonly vertical: "value" | KnobValueOptions | null;
};

/** Focusable input surface. asChild composes behavior onto one ref-forwarding DOM child. */
export type KnobControlProps = HTMLAttributes<HTMLElement> & {
    readonly asChild?: boolean;
    readonly drag?: KnobDrag;
    readonly sensitivity?: number;
    readonly keyboardStep?: number;
};

/** Pointer/keyboard behavior shared by the default dial and customer artwork. */
export const KnobControl = forwardRef<HTMLElement, KnobControlProps>(function KnobControl({
    asChild = false, drag = "vertical", sensitivity = 220, keyboardStep, children, className = "", style,
    onPointerDown, onKeyDown, onKeyUp, onBlur, onContextMenu, ...props
}, ref) {
    const context = useContextValue();
    const current = useRef(context); current.current = context;
    const currentDrag = useRef(drag); currentDrag.current = drag;
    const attach = useCallback((node: HTMLElement | null) => {
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
    }, [ref]);
    const gesture = useParameterGesture();
    const keyboardFinish = useRef<((cancelled: boolean) => void) | null>(null);
    const readOnly = context.readOnly || context.disabled;
    const secondaryHorizontal = typeof drag === "object" && typeof drag.horizontal === "object" ? drag.horizontal : null;
    const secondaryVertical = typeof drag === "object" && typeof drag.vertical === "object" ? drag.vertical : null;
    const finishKeyboard = useCallback((cancelled: boolean) => {
        const finish = keyboardFinish.current;
        keyboardFinish.current = null;
        finish?.(cancelled);
    }, []);
    // A reconfiguration cannot leave an edit bracket open against the old quantity.
    useLayoutEffect(() => () => {
        gesture.cancelGesture(); finishKeyboard(true);
    }, [gesture, finishKeyboard, readOnly, context.domain, sensitivity, keyboardStep,
        typeof drag === "string" ? drag : "two-axis",
        typeof drag === "object" && drag.horizontal === "value", typeof drag === "object" && drag.vertical === "value",
        secondaryHorizontal?.min, secondaryHorizontal?.max, secondaryHorizontal?.scale, secondaryHorizontal?.step,
        secondaryVertical?.min, secondaryVertical?.max, secondaryVertical?.scale, secondaryVertical?.step]);

    const startPointer: NonNullable<HTMLAttributes<HTMLElement>["onPointerDown"]> = event => {
        onPointerDown?.(event);
        if (event.defaultPrevented || readOnly || event.button !== 0 || !event.isPrimary) return;
        finishKeyboard(false);
        event.currentTarget.focus({ preventScroll: true });
        let close: ((cancelled: boolean) => void) | null = null;
        const finish = (cancelled: boolean) => { const end = close; close = null; end?.(cancelled); };
        const channel = (quantity: "value" | KnobValueOptions | null, axis: RollingAxis): ParameterGestureChannel | null => {
            if (quantity === null) return {
                startNormalized: 0, pixelsPerFullSpan: Math.max(1, sensitivity), write: null,
                onActivate: () => current.current.setInteraction({ isDragging: true, activeAxis: axis }),
            };
            const options = quantity === "value" ? current.current.options.current : quantity;
            const latestOptions = () => {
                const mapping = currentDrag.current;
                const latest = typeof mapping === "string" ? "value" : mapping[axis];
                return latest === "value" ? current.current.options.current : (latest ?? options);
            };
            const domain = quantity === "value" ? current.current.domain : knobDomain({
                min: options.min ?? 0, max: options.max ?? 1, step: options.step, scale: options.scale });
            let previous = options.value;
            return {
                startNormalized: domain.toPosition(options.value), pixelsPerFullSpan: Math.max(1, sensitivity),
                onActivate: () => current.current.setInteraction({ isDragging: true, activeAxis: axis }),
                onDeactivate: () => finish(false),
                write: position => {
                    const next = domain.fromPosition(position);
                    if (!Number.isFinite(next) || next === previous) return;
                    const callbacks = latestOptions();
                    if (!close) { close = cancelled => callbacks.onGestureEnd?.(cancelled); callbacks.onGestureStart?.(); }
                    previous = next;
                    callbacks.onValueChange(next);
                },
            };
        };
        const element = event.currentTarget;
        gesture.startGesture(event, {
            axis: typeof drag === "string" ? drag : undefined, fineMultiplier: 0.1,
            horizontal: channel(typeof drag === "string" ? (drag === "horizontal" ? "value" : null) : drag.horizontal, "horizontal"),
            vertical: channel(typeof drag === "string" ? (drag === "vertical" ? "value" : null) : drag.vertical, "vertical"),
            onFinish: reason => { finish(reason === "cancel"); current.current.setInteraction({ isDragging: false, activeAxis: null }); },
            onLongPress: onContextMenu ? (clientX, clientY) => element.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true, cancelable: true, clientX, clientY, button: 2,
            })) : undefined,
        });
    };
    const keyDown: NonNullable<HTMLAttributes<HTMLElement>["onKeyDown"]> = event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || readOnly) return;
        if (event.key === "Escape") { gesture.cancelGesture(); finishKeyboard(true); return; }
        const direction = ["ArrowUp", "ArrowRight", "PageUp"].includes(event.key) ? 1
            : ["ArrowDown", "ArrowLeft", "PageDown"].includes(event.key) ? -1 : 0;
        if (!direction && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        gesture.cancelGesture();
        const { domain, value, options } = current.current;
        const page = event.key.startsWith("Page") ? 10 : 1;
        const unitStep = keyboardStep ?? domain.step;
        const next = event.key === "Home" ? domain.min : event.key === "End" ? domain.max
            : unitStep !== undefined ? domain.snap(value + direction * unitStep * page)
                : domain.fromPosition(domain.toPosition(value) + direction * 0.01 * page * (event.shiftKey ? 0.1 : 1));
        if (next === value || !Number.isFinite(next)) return;
        if (!keyboardFinish.current) {
            const end = options.current.onGestureEnd;
            keyboardFinish.current = cancelled => end?.(cancelled);
            options.current.onGestureStart?.();
        }
        options.current.onValueChange(next);
    };
    const shared = {
        ...props, className: `bk-knob-control ${className}`, style: { ...style, touchAction: "none" },
        id: props.id ?? context.controlId, role: "slider", tabIndex: context.disabled ? -1 : (props.tabIndex ?? 0),
        "aria-label": props["aria-label"],
        "aria-labelledby": props["aria-labelledby"] ?? (props["aria-label"] ? undefined : context.labelId),
        "aria-valuemin": context.domain.min, "aria-valuemax": context.domain.max,
        "aria-valuenow": context.value, "aria-valuetext": context.format(context.value),
        "aria-disabled": context.disabled || undefined, "aria-readonly": context.readOnly || undefined,
        "data-slot": "knob-control", "data-disabled": context.disabled || undefined,
        "data-readonly": context.readOnly || undefined, "data-dragging": context.interaction.isDragging || undefined,
        onPointerDown: startPointer, onKeyDown: keyDown,
        onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => {
            onKeyUp?.(event);
            if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "PageUp", "PageDown", "Home", "End"].includes(event.key))
                finishKeyboard(false);
        },
        onBlur: (event: React.FocusEvent<HTMLElement>) => { onBlur?.(event); gesture.cancelGesture(); finishKeyboard(true); },
        onContextMenu: (event: React.MouseEvent<HTMLElement>) => { gesture.cancelGesture(); onContextMenu?.(event); },
    };
    if (asChild) return <Slot {...shared} ref={attach}>{children}</Slot>;
    return <button {...shared} type="button" disabled={context.disabled} ref={attach}>{children}</button>;
});

/** Optional accessible label; its visual placement belongs to the composition. */
export const KnobLabel = forwardRef<HTMLLabelElement, HTMLAttributes<HTMLLabelElement>>(function KnobLabel(props, ref) {
    const context = useContextValue();
    return <label {...props} ref={ref} id={context.labelId} htmlFor={context.controlId} data-slot="knob-label" />;
});

/** Formatted base value. Live modulation remains a separate read-only indicator. */
export const KnobValue = forwardRef<HTMLOutputElement, HTMLAttributes<HTMLOutputElement>>(function KnobValue(props, ref) {
    const context = useContextValue();
    return <output {...props} ref={ref} htmlFor={context.controlId} data-slot="knob-value">{context.format(context.value)}</output>;
});

/** Default dotted dial artwork. Children add rings/markers in the same SVG coordinates. */
export const KnobDial = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function KnobDial({ children, ...props }, ref) {
    const { value, domain } = useContextValue();
    const id = useId().replaceAll(":", "");
    const position = domain.toPosition(value);
    const origin = domain.min < 0 && domain.max > 0 ? domain.toPosition(0) : 0;
    const handle = knobArcPoint(position, 25);
    return <svg viewBox="-3 -3 106 106" aria-hidden="true" {...props} ref={ref} data-slot="knob-dial">
        <defs><pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.85" fill="var(--knob-color)" />
        </pattern></defs>
        <path d={knobSector(0, 1, 34)} fill={`url(#${id})`} opacity=".32" />
        <path d={knobSector(origin, position, 34)} fill="var(--knob-color)" data-slot="knob-fill" />
        <circle cx={handle.x} cy={handle.y} r="2.5" fill="var(--knob-indicator)" stroke="var(--knob-ink)" strokeWidth="1" />
        {children}
    </svg>;
});

/** A visual interval in canonical units. No routing or modulation law is inferred. */
export const KnobRange = forwardRef<SVGPathElement, Omit<SVGProps<SVGPathElement>, "from" | "to"> & {
    readonly from: number; readonly to: number; readonly innerRadius?: number; readonly outerRadius?: number;
}>(function KnobRange({ from, to, innerRadius = 40, outerRadius = 48, ...props }, ref) {
    const { domain } = useContextValue();
    return <path fill="var(--knob-range-color)" {...props} ref={ref} data-slot="knob-range"
        d={knobAnnulus(domain.toPosition(from), domain.toPosition(to), innerRadius, outerRadius)} />;
});

/** A static or streamed value marker; smoothing affects display only. */
export const KnobMarker = forwardRef<SVGCircleElement, SVGProps<SVGCircleElement> & {
    readonly value: LiveNumber; readonly radius?: number; readonly smoothingMs?: number;
}>(function KnobMarker({ value, radius = 44, smoothingMs = 45, style, ...props }, ref) {
    const { domain } = useContextValue();
    const [element, setElement] = useState<SVGCircleElement | null>(null);
    const attach = useCallback((node: SVGCircleElement | null) => {
        setElement(node);
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
    }, [ref]);
    useEffect(() => {
        const view = element?.ownerDocument.defaultView;
        if (!element || !view) return;
        return animateLiveNumber(view, value, domain.toPosition, Math.max(0, smoothingMs), position => {
            element.style.visibility = position === null ? "hidden" : "visible";
            element.setAttribute("data-active", String(position !== null));
            if (position === null) return;
            const point = knobArcPoint(position, radius);
            element.setAttribute("cx", String(point.x)); element.setAttribute("cy", String(point.y));
        });
    }, [element, value, domain, radius, smoothingMs]);
    return <circle r="2.4" fill="var(--knob-indicator)" {...props} ref={attach} data-slot="knob-marker"
        style={{ ...style, visibility: "hidden", pointerEvents: "none" }} />;
});

/** Successful exact entry or a human-readable validation error. */
export type KnobParseResult = { readonly kind: "ok"; readonly value: number } | { readonly kind: "error"; readonly message: string };

/** Exact entry in canonical units, optionally adapting a unit-aware parser. */
export const KnobInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "type" | "onChange"> & {
    readonly parseValue?: (text: string) => KnobParseResult;
}>(function KnobInput({ parseValue, onFocus, onBlur, onKeyDown, className = "", ...props }, ref) {
    const context = useContextValue();
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const errorId = useId();
    const publish = () => {
        if (draft === null || context.disabled || context.readOnly || props.disabled || props.readOnly) return;
        const parsed: KnobParseResult = parseValue ? parseValue(draft) : draft.trim() !== "" && Number.isFinite(Number(draft))
            ? { kind: "ok", value: Number(draft) } : { kind: "error", message: "Enter a number." };
        if (parsed.kind === "error") { setError(parsed.message); return; }
        const value = parsed.value;
        if (!Number.isFinite(value) || value < context.domain.min || value > context.domain.max) {
            setError(`Enter a value from ${context.domain.min} to ${context.domain.max}.`); return;
        }
        const next = context.domain.snap(value);
        if (next !== context.value) {
            const options = context.options.current;
            options.onGestureStart?.();
            try { options.onValueChange(next); } finally { options.onGestureEnd?.(false); }
        }
        setDraft(null); setError(null);
    };
    return <span className="bk-knob-entry">
        <input {...props} ref={ref} type="text" inputMode={props.inputMode ?? "decimal"}
            className={`bk-knob-input ${className}`} data-slot="knob-input"
            value={draft ?? String(context.value)} disabled={context.disabled || props.disabled}
            readOnly={context.readOnly || props.readOnly} aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={[props["aria-describedby"], error ? errorId : null].filter(value => value !== null && value !== undefined).join(" ") || undefined}
            onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) setDraft(event.currentTarget.value); }}
            onChange={event => { setDraft(event.currentTarget.value); setError(null); }}
            onBlur={event => { onBlur?.(event); if (!event.defaultPrevented) publish(); }}
            onKeyDown={event => {
                onKeyDown?.(event); if (event.defaultPrevented) return;
                if (event.key === "Enter") { event.preventDefault(); publish(); }
                if (event.key === "Escape") { event.preventDefault(); setDraft(null); setError(null); }
            }} />
        {error && <span id={errorId} role="alert" className="bk-knob-error">{error}</span>}
    </span>;
});

/** Ready-made composition of the public knob parts. */
export const Knob = forwardRef<HTMLDivElement, Omit<KnobRootProps, "children"> & { readonly label: ReactNode }>(
    function Knob({ label, ...props }, ref) {
        return <KnobRoot {...props} ref={ref}><KnobLabel>{label}</KnobLabel>
            <KnobControl><KnobDial /></KnobControl><KnobValue /></KnobRoot>;
    });
