import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { usePatchConnection, usePluginState } from "../../../kit/index";
import definition from "../state";
import * as band from "./quantities";
import type { Sound, SoundControls } from "./sound";
import {
    ANALYZER_ENDPOINTS, DB_ROWS, FREQUENCY_TICKS, SHAPES, SPECTRUM_PLOT, advanceSpectrum, formatFrequencyTick,
    frequencyAfterDrag, frequencyTicksForWidth, frequencyToX, gainToY, responsePath, responseY, type SpectrumDisplay,
} from "./spectrum";

/** Mid is the only band in Stereo; Mid/Side adds the Side band, which shares frequency and Q. */
type Band = "mid" | "side";
type Point = { readonly frequency: number; readonly amount: number; readonly q: number };
type Drag = {
    readonly band: Band;
    readonly pointerId: number;
    readonly originX: number;
    readonly originY: number;
    readonly origin: Point;
    last: Point;
    /** The drag's one gesture opens with the first change, so a click alone is not an Undo entry. */
    gestureOpen: boolean;
};

const amountKey = (which: Band) => which === "side" ? "sideAmount" : "amount";
const right = SPECTRUM_PLOT.width - SPECTRUM_PLOT.right;
const baselineY = gainToY(0).toFixed(2);

/** The input and output spectra, with the analyzer switched on only while the graph is shown. */
function useSpectra() {
    const connection = usePatchConnection();
    const [spectra, setSpectra] = useState<{ readonly input: SpectrumDisplay | null; readonly output: SpectrumDisplay | null }>({ input: null, output: null });
    useEffect(() => {
        const listeners = (["input", "output"] as const).map(role => {
            const listener = (message: unknown) => {
                const now = performance.now();
                setSpectra(current => {
                    const next = advanceSpectrum(message, current[role], now);
                    return next === current[role] ? current : { ...current, [role]: next };
                });
            };
            connection.addEndpointListener?.(ANALYZER_ENDPOINTS[role], listener);
            return { endpoint: ANALYZER_ENDPOINTS[role], listener };
        });
        connection.sendEventOrValue?.(ANALYZER_ENDPOINTS.enabled, 1);
        return () => {
            connection.sendEventOrValue?.(ANALYZER_ENDPOINTS.enabled, 0);
            for (const { endpoint, listener } of listeners) connection.removeEndpointListener?.(endpoint, listener);
        };
    }, [connection]);
    return spectra;
}

/** The plot's rendered width, which sets how many frequency labels fit. */
function useRenderedWidth(element: RefObject<Element | null>) {
    const [width, setWidth] = useState<number>(SPECTRUM_PLOT.width);
    useLayoutEffect(() => {
        const node = element.current;
        if (!node) return;
        const measure = () => setWidth(node.getBoundingClientRect().width);
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        measure();
        return () => observer.disconnect();
    }, [element]);
    return width;
}

function peakText(display: SpectrumDisplay | null) {
    if (!display) return "--";
    return display.peakDbfs <= SPECTRUM_PLOT.minimumLevelDbfs + 0.05 ? `<${SPECTRUM_PLOT.minimumLevelDbfs} dB` : `${display.peakDbfs.toFixed(1)} dB`;
}

/**
 * The band's response over the input and output spectra. Dragging a band moves
 * frequency and amount together, and Q with Shift held, as one gesture and one Undo entry.
 */
export function ResponseGraph({ sound, controls }: { readonly sound: Sound; readonly controls: SoundControls }) {
    const editor = usePluginState(definition);
    const spectra = useSpectra();
    const headingId = useId();
    const plot = useRef<SVGSVGElement>(null);
    const plotWidth = useRenderedWidth(plot);
    const visibleTicks = new Set(frequencyTicksForWidth(plotWidth).map(tick => tick.frequencyHz));
    const drag = useRef<Drag | null>(null);
    const [dragging, setDragging] = useState<Band | null>(null);
    const shape = SHAPES[Math.round(sound.shape)] ?? "bell";
    const midSide = sound.routing >= 0.5;
    const amountOf = (which: Band) => which === "side" ? sound.sideAmount : sound.amount;

    const write = (current: Drag, next: Point) => {
        // Mapping a pointer back through the log axis leaves rounding noise; that is not a change.
        const changed = (["frequency", "amount", "q"] as const).filter(key => Math.abs(next[key] - current.last[key]) > 1e-9);
        if (changed.length === 0) return;
        if (!current.gestureOpen) {
            current.gestureOpen = true;
            void editor.beginGesture(["frequency", amountKey(current.band), "q"]);
        }
        current.last = next;
        for (const key of changed) void controls[key === "amount" ? amountKey(current.band) : key].setValue(next[key]);
    };
    const startDrag = (which: Band) => (event: PointerEvent<SVGElement>) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const origin = { frequency: sound.frequency, amount: amountOf(which), q: sound.q };
        drag.current = { band: which, pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, origin, last: origin, gestureOpen: false };
        setDragging(which);
    };
    const moveDrag = (event: PointerEvent<SVGElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId || !plot.current) return;
        event.preventDefault();
        const upward = current.originY - event.clientY;
        write(current, event.shiftKey
            ? { ...current.last, q: band.q.drag(current.origin.q, upward) }
            : {
                ...current.last,
                frequency: frequencyAfterDrag(current.origin.frequency, current.originX, event.clientX, plot.current.getBoundingClientRect()),
                amount: band.amount.drag(current.origin.amount, upward),
            });
    };
    const endDrag = (event: PointerEvent<SVGElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        drag.current = null;
        setDragging(null);
        if (current.gestureOpen) void editor.endGesture();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    /** Left and Right step frequency, Up and Down the band's amount, and any arrow with Shift steps Q. */
    const keyDown = (which: Band) => (event: KeyboardEvent<SVGElement>) => {
        const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1
            : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -1 : 0;
        if (direction === 0) return;
        event.preventDefault();
        const [key, quantity, value] = event.shiftKey ? ["q", band.q, sound.q] as const
            : event.key === "ArrowLeft" || event.key === "ArrowRight" ? ["frequency", band.frequency, sound.frequency] as const
                : [amountKey(which), band.amount, amountOf(which)] as const;
        const next = quantity.step(value, direction);
        // During a drag this joins the drag's gesture; otherwise it is one edit of its own.
        if (next !== value) void controls[key].setValue(next);
    };
    const dragProps = (which: Band) => ({
        "data-dragging": dragging === which ? "" : undefined,
        onPointerDown: startDrag(which), onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag,
    });
    const handleX = frequencyToX(sound.frequency).toFixed(2);
    const bands: Band[] = midSide ? ["mid", "side"] : ["mid"];

    return <section className="response-panel" aria-labelledby={headingId}>
        <div className="plot-heading">
            <span id={headingId}>HARMONIC SHAPE</span>
            <span className="analyzer-legend">
                <span className="legend-item input"><i />IN <strong data-spectrum-peak="input">{peakText(spectra.input)}</strong></span>
                <span className="legend-item output"><i />OUT <strong data-spectrum-peak="output">{peakText(spectra.output)}</strong></span>
            </span>
            <span className="gesture-hint">DRAG FREQ + AMOUNT&nbsp;&nbsp;·&nbsp;&nbsp;SHIFT DRAG Q</span>
        </div>
        <svg ref={plot} className="response-plot" viewBox={`0 0 ${SPECTRUM_PLOT.width} ${SPECTRUM_PLOT.height}`} preserveAspectRatio="none"
            role="group" aria-label="Response graph">
            {FREQUENCY_TICKS.filter(hz => visibleTicks.has(hz)).map(hz => <g key={hz}>
                <path className="grid-line" d={`M ${frequencyToX(hz).toFixed(2)} ${SPECTRUM_PLOT.top} V ${baselineY}`} />
                <text className="axis-label" data-frequency-hz={hz} x={frequencyToX(hz).toFixed(2)} y={SPECTRUM_PLOT.height - 7} textAnchor="middle">{formatFrequencyTick(hz)}</text>
            </g>)}
            {DB_ROWS.map(({ gainDb, levelDbfs }) => {
                const y = gainToY(gainDb);
                return <g key={gainDb}>
                    <path className={gainDb === 0 ? "grid-line baseline" : "grid-line"} d={`M ${SPECTRUM_PLOT.left} ${y.toFixed(2)} H ${right}`} />
                    <text className="axis-label" data-gain-db={gainDb} x={SPECTRUM_PLOT.left - 8} y={y + 3} textAnchor="end">{gainDb > 0 ? `+${gainDb}` : gainDb}</text>
                    <text className="axis-label level" data-level-dbfs={levelDbfs} x={right + 8} y={y + 3} textAnchor="start">{levelDbfs}</text>
                </g>;
            })}
            {shape !== "bell" && <>
                <text className="axis-label shelf-overflow" data-shelf-overflow="high" x={SPECTRUM_PLOT.left - 8} y="9" textAnchor="end">+30</text>
                <text className="axis-label shelf-overflow" data-shelf-overflow="low" x={SPECTRUM_PLOT.left - 8} y="270" textAnchor="end">-18</text>
            </>}
            <text className="axis-unit" x="8" y="12">GAIN</text>
            <text className="axis-unit level" x={SPECTRUM_PLOT.width - 5} y="12" textAnchor="end">dBFS</text>
            <path className="spectrum-trace input" data-spectrum-role="input" d={spectra.input?.path} />
            <path className="spectrum-trace output" data-spectrum-role="output" d={spectra.output?.path} />
            <path className="response-fill" d={responsePath(shape, sound.frequency, sound.q, sound.amount, true)} />
            {shape !== "bell" && bands.map(which => <path key={which} className={`response-handle-guide ${which}`} data-guide={which}
                d={`M ${handleX} ${gainToY(amountOf(which) * 12).toFixed(2)} V ${responseY(shape, sound.frequency, sound.frequency, sound.q, amountOf(which)).toFixed(2)}`} />)}
            {bands.map(which => <path key={which} className={`response-band ${which}`} data-response={which} aria-hidden="true"
                d={responsePath(shape, sound.frequency, sound.q, amountOf(which))} {...dragProps(which)} />)}
            {bands.map(which => <circle key={which} className={`response-handle ${which}`} r={which === "side" ? 5 : 6}
                cx={handleX} cy={gainToY(amountOf(which) * 12).toFixed(2)} tabIndex={0} role="slider"
                aria-label={which === "side" ? "Side band handle" : "Band handle"}
                aria-valuetext={`${shape}, ${band.frequency.format(sound.frequency)}, ${band.amount.format(amountOf(which))}, Q ${band.q.format(sound.q)}`}
                onKeyDown={keyDown(which)} {...dragProps(which)} />)}
        </svg>
    </section>;
}
