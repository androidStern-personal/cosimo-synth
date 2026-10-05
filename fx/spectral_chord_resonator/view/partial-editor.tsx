import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { usePluginState } from "../../../kit/index";
import definition from "../state";
import {
    PARTIAL_COUNT_CHOICES, PARTIAL_TEMPLATES, cleared, inverted, normalized, partialShapeCodec, smoothed,
    withCount, withStrength, withTemplate, type PartialShape,
} from "./partial-shape";

const templateLabels: Readonly<Record<PartialShape["template"], string>> = {
    flat: "Flat",
    saw: "Saw 1/h",
    square: "Square odd",
    triangle: "Triangle odd",
    organ: "Organ",
    nasal: "Nasal",
    air: "Air",
    pluck: "Pluck",
    custom: "Custom",
};

const transforms: readonly { readonly label: string; readonly apply: (shape: PartialShape) => PartialShape }[] = [
    { label: "Smooth", apply: smoothed },
    { label: "Normalize", apply: normalized },
    { label: "Invert", apply: inverted },
    { label: "Clear", apply: cleared },
];

/** Where the bars sit inside the canvas; labels appear only when there is room for them. */
function plotGeometry(width: number, height: number) {
    const showLabels = height >= 150;
    const top = showLabels ? 24 : 6;
    const left = 14;
    const right = 14;
    const bottom = Math.max(top + 1, height - 2);
    return { showLabels, top, left, right, bottom, plotWidth: Math.max(1, width - left - right), plotHeight: Math.max(1, bottom - top) };
}

function drawPartials(canvas: HTMLCanvasElement, shape: PartialShape, selected: number) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.floor(rect.width * ratio));
    const backingHeight = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
    }

    const width = backingWidth / ratio;
    const height = backingHeight / ratio;
    const { showLabels, top, left, right, bottom, plotWidth, plotHeight } = plotGeometry(width, height);
    const slot = plotWidth / shape.count;
    const gap = shape.count > 48 ? 2 : 4;
    const barWidth = Math.max(3, slot - gap);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#12151b";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "#2b3039";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
        const y = top + plotHeight * (line / 4);
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
    }

    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let index = 0; index < shape.count; index += 1) {
        const strength = shape.strengths[index];
        const x = left + index * slot + gap / 2;
        const barHeight = strength * plotHeight;

        context.fillStyle = index === selected ? "#303745" : "#1d222b";
        context.fillRect(x - 1, top, barWidth + 2, plotHeight);
        context.fillStyle = strength > 0.82 ? "#efb95d" : strength > 0.1 ? "#78d29c" : "#556070";
        context.fillRect(x, bottom - barHeight, barWidth, Math.max(strength > 0 ? 1 : 0, barHeight));

        const harmonic = index + 1;
        if (showLabels && (shape.count <= 32 || harmonic === 1 || harmonic % 4 === 0)) {
            context.fillStyle = harmonic % 8 === 0 || harmonic === 1 ? "#a8aeb8" : "#747b88";
            context.fillText(String(harmonic), x + barWidth / 2, 7);
        }
    }

    context.strokeStyle = "#efb95d";
    context.beginPath();
    context.moveTo(left, bottom - 0.5);
    context.lineTo(width - right, bottom - 0.5);
    context.stroke();
}

/** The harmonic under the pointer and the strength its height means. */
function partialAt(canvas: HTMLCanvasElement, shape: PartialShape, event: PointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    const { top, left, plotWidth, plotHeight } = plotGeometry(rect.width, rect.height);
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left - left) / plotWidth));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top - top) / plotHeight));
    return { index: Math.min(shape.count - 1, Math.floor(x * shape.count)), strength: 1 - y };
}

function Readouts({ shape, selected }: { readonly shape: PartialShape; readonly selected: number }) {
    const active = shape.strengths.slice(0, shape.count);
    const total = active.reduce((sum, strength) => sum + strength, 0);
    const centroid = total > 0 ? active.reduce((sum, strength, index) => sum + strength * (index + 1), 0) / total : 0;
    return <dl className="partial-readouts">
        <div className="metric"><dt>Selected</dt><dd>H{selected + 1} {active[selected].toFixed(3)}</dd></div>
        <div className="metric"><dt>Active</dt><dd>{active.filter(strength => strength > 0.001).length} / {shape.count}</dd></div>
        <div className="metric"><dt>Centroid</dt><dd>{centroid.toFixed(2)}</dd></div>
    </dl>;
}

/**
 * Draw how strongly each harmonic of a held note resonates. A drag across the
 * bars is one Undo entry; each toolbar button is one more.
 */
export function PartialEditor() {
    const control = usePluginState(definition.partialShape);
    const shape = "value" in control.state ? control.state.value : null;
    const [selection, setSelection] = useState(0);
    const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
    const canvas = useRef<HTMLCanvasElement>(null);
    // The shape as this drag has painted it, which can run ahead of the rendered value.
    const drag = useRef<{ readonly pointerId: number; shape: PartialShape } | null>(null);
    const selected = shape ? Math.min(selection, shape.count - 1) : 0;

    // Redraw at the new backing-store size whenever the host resizes the plot.
    const observePlot = useCallback((element: HTMLDivElement) => {
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setPlotSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        if (shape && canvas.current) drawPartials(canvas.current, shape, selected);
    }, [shape, selected, plotSize]);

    if (!shape) return <section className="partial-editor">
        <p className="partial-status" role={control.error ? "alert" : "status"}>{control.error?.message ?? "Connecting"}</p>
    </section>;

    const change = (next: PartialShape) => {
        if (!partialShapeCodec.equals(next, shape)) void control.setValue(next);
    };
    const paint = (event: PointerEvent<HTMLCanvasElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const { index, strength } = partialAt(event.currentTarget, current.shape, event);
        setSelection(index);
        const next = withStrength(current.shape, index, strength);
        if (partialShapeCodec.equals(next, current.shape)) return;
        current.shape = next;
        void control.setValue(next);
    };
    const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, shape };
        void control.beginGesture();
        paint(event);
    };
    const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        void control.endGesture();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return <section className="partial-editor">
        <header className="partial-head">
            <div className="partial-title">
                <h1>Spectral Chord Resonator</h1>
                <span className="shape-name">{templateLabels[shape.template]}</span>
                <span className="pill">{shape.count} partials</span>
                {control.error && <span className="partial-error" role="alert">{control.error.message}</span>}
            </div>
            <Readouts shape={shape} selected={selected} />
        </header>
        <div className="partial-toolbar">
            <div className="button-group" role="group" aria-label="Active partials">
                {PARTIAL_COUNT_CHOICES.map(count => <button key={count} type="button" aria-pressed={shape.count === count}
                    onClick={() => change(withCount(shape, count))}>{count}</button>)}
            </div>
            <div className="button-group" role="group" aria-label="Templates">
                {PARTIAL_TEMPLATES.map(template => <button key={template} type="button" aria-pressed={shape.template === template}
                    onClick={() => change(withTemplate(shape, template))}>{templateLabels[template]}</button>)}
            </div>
            <div className="button-group" role="group" aria-label="Transforms">
                {transforms.map(({ label, apply }) => <button key={label} type="button" onClick={() => change(apply(shape))}>{label}</button>)}
            </div>
        </div>
        <div ref={observePlot} className="partial-plot">
            <canvas ref={canvas} aria-label="Partial strength editor"
                onPointerDown={startDrag} onPointerMove={paint} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} />
        </div>
    </section>;
}
