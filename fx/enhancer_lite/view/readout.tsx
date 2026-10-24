import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PluginStateControl } from "../../../kit/index";
import type { Quantity } from "./quantities";

type Drag = {
    readonly pointerId: number;
    readonly originX: number;
    readonly originY: number;
    readonly origin: number;
    last: number;
    /** The drag's gesture opens with the first change, so a click alone is not an Undo entry. */
    gestureOpen: boolean;
};

export type ReadoutProps = {
    /** The accessible name, such as "Mid Amount". */
    readonly label: string;
    /** The short visible caption, such as "MID". */
    readonly caption: string;
    readonly quantity: Quantity;
    readonly control: PluginStateControl<number>;
    readonly value: number;
    readonly orientation: "horizontal" | "vertical";
    readonly tone?: "mid" | "side";
};

/**
 * A value that is also a control: drag it along its axis, step it with the
 * arrow keys, or press Enter or double-click it to type an exact value.
 */
export function Readout({ label, caption, quantity, control, value, orientation, tone }: ReadoutProps) {
    const drag = useRef<Drag | null>(null);
    const [dragging, setDragging] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState("");
    const surface = useRef<HTMLDivElement>(null);
    // Enter and Escape return focus to the readout; leaving the field does not.
    const refocus = useRef(false);
    // Closing the field removes it, which can deliver one more blur.
    const closed = useRef(true);
    useEffect(() => {
        if (draft !== null || !refocus.current) return;
        refocus.current = false;
        surface.current?.focus();
    }, [draft]);

    const open = () => { closed.current = false; setError(""); setDraft(quantity.format(value)); };
    const close = (returnFocus: boolean) => { closed.current = true; refocus.current = returnFocus; setDraft(null); setError(""); };
    const commit = (returnFocus: boolean) => {
        if (closed.current || draft === null) return;
        const entry = quantity.parse(draft);
        if ("error" in entry) { setError(entry.error); return; }
        if (entry.value !== value) void control.setValue(entry.value);
        close(returnFocus);
    };

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, origin: value, last: value, gestureOpen: false };
        setDragging(true);
    };
    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const pixels = orientation === "horizontal" ? event.clientX - current.originX : current.originY - event.clientY;
        const next = quantity.drag(current.origin, pixels);
        if (next === current.last) return;
        if (!current.gestureOpen) { current.gestureOpen = true; void control.beginGesture(); }
        current.last = next;
        void control.setValue(next);
    };
    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
        if (current.gestureOpen) void control.endGesture();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter") { event.preventDefault(); open(); return; }
        const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1
            : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -1 : 0;
        if (direction === 0) return;
        event.preventDefault();
        // During a drag this joins the drag's gesture; otherwise it is one edit of its own.
        const next = quantity.step(value, direction);
        if (next !== value) void control.setValue(next);
    };

    const className = `readout ${orientation}${tone ? ` ${tone}` : ""}`;
    if (draft !== null) return <label className={`${className} editing`}>
        <span className="readout-caption">{caption}</span>
        <input aria-label={`${label} value`} value={draft} autoFocus onFocus={event => event.currentTarget.select()}
            onChange={event => { setDraft(event.currentTarget.value); setError(""); }}
            onKeyDown={event => {
                if (event.key === "Enter") { event.preventDefault(); commit(true); }
                if (event.key === "Escape") { event.preventDefault(); close(true); }
            }}
            onBlur={() => commit(false)} />
        {error && <span role="alert" className="readout-error">{error}</span>}
    </label>;
    return <div ref={surface} className={className} role="slider" tabIndex={0} aria-label={label} aria-orientation={orientation}
        aria-valuemin={quantity.min * quantity.shownPerStored} aria-valuemax={quantity.max * quantity.shownPerStored}
        aria-valuenow={value * quantity.shownPerStored} aria-valuetext={quantity.format(value)}
        data-dragging={dragging ? "" : undefined}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onKeyDown={keyDown} onDoubleClick={open}>
        <span className="drag-affordance" aria-hidden="true">{orientation === "horizontal" ? "↔" : "↕"}</span>
        <span className="readout-caption">{caption}</span>
        <span className="readout-value">{quantity.format(value)}</span>
    </div>;
}
