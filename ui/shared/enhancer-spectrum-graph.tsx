import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";

import {
    ENHANCER_DB_ROWS,
    ENHANCER_SPECTRUM_PLOT,
    createEnhancerFrequencyPath,
    enhancerFrequencyTicksForWidth,
    enhancerFrequencyX,
    enhancerGainY,
    type EnhancerSpectrumDisplay,
} from "./enhancer-spectrum";

/** One response law which this renderer projects through the shared geometry. */
export type EnhancerSpectrumCurve = {
    readonly id: string;
    readonly label: string;
    readonly gainDbAtFrequency: (frequencyHz: number) => number;
    readonly color: string;
    readonly dashArray?: string;
};

/** One frequency marker projected by this renderer onto the shared log axis. */
export type EnhancerSpectrumMarker = {
    readonly id: string;
    readonly label: string;
    readonly frequencyHz: number;
    readonly gainDb: number;
    readonly color: string;
};

/** Inputs for the single reusable Enhancer spectrum/response renderer. */
export type EnhancerSpectrumGraphProps = {
    readonly spectrum: EnhancerSpectrumDisplay | null;
    readonly curves: ReadonlyArray<EnhancerSpectrumCurve>;
    readonly markers?: ReadonlyArray<EnhancerSpectrumMarker>;
    readonly ariaLabel: string;
    readonly className?: string;
};

function useRenderedWidth(svgRef: RefObject<SVGSVGElement | null>): number {
    const [renderedWidth, setRenderedWidth] = useState<number>(
        ENHANCER_SPECTRUM_PLOT.width,
    );

    useEffect(() => {
        const svg = svgRef.current;
        if (svg === null) {
            return;
        }

        const update = () => {
            const nextWidth = svg.getBoundingClientRect().width;
            if (Number.isFinite(nextWidth) && nextWidth > 0) {
                setRenderedWidth(nextWidth);
            }
        };
        update();

        if (typeof ResizeObserver !== "function") {
            window.addEventListener("resize", update);
            return () => window.removeEventListener("resize", update);
        }

        const observer = new ResizeObserver(update);
        observer.observe(svg);
        return () => observer.disconnect();
    }, [svgRef]);

    return renderedWidth;
}

/**
 * Render an incoming spectrum, response curves, labels, and markers in the
 * exact plot rectangle and logarithmic frequency transform accepted by Lite.
 */
export function EnhancerSpectrumGraph({
    spectrum,
    curves,
    markers = [],
    ariaLabel,
    className = "",
}: EnhancerSpectrumGraphProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const renderedWidth = useRenderedWidth(svgRef);
    const frequencyTicks = enhancerFrequencyTicksForWidth(renderedWidth);
    const plotBottom = ENHANCER_SPECTRUM_PLOT.height - ENHANCER_SPECTRUM_PLOT.bottom;
    const plotRight = ENHANCER_SPECTRUM_PLOT.width - ENHANCER_SPECTRUM_PLOT.right;

    return (
        <svg
            ref={svgRef}
            className={`enhancer-spectrum-graph ${className}`.trim()}
            data-role="enhancer-spectrum-graph"
            data-frequency-contract="shared-log-gain"
            data-rendered-width-density={frequencyTicks.length}
            viewBox={`0 0 ${ENHANCER_SPECTRUM_PLOT.width} ${ENHANCER_SPECTRUM_PLOT.height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={ariaLabel}
        >
            <g data-role="enhancer-spectrum-frequency-grid" aria-hidden="true">
                {frequencyTicks.map((tick) => (
                    <g key={tick.frequencyHz} data-frequency-hz={tick.frequencyHz}>
                        <path
                            className="enhancer-spectrum-grid-line"
                            d={`M ${tick.x.toFixed(2)} ${ENHANCER_SPECTRUM_PLOT.top} V ${plotBottom}`}
                        />
                        <text
                            className="enhancer-spectrum-axis-label enhancer-spectrum-frequency-label"
                            x={tick.x}
                            y={ENHANCER_SPECTRUM_PLOT.height - 7}
                            textAnchor="middle"
                        >
                            {tick.label}
                        </text>
                    </g>
                ))}
            </g>

            <g data-role="enhancer-spectrum-level-grid" aria-hidden="true">
                {ENHANCER_DB_ROWS.map(({ gainDb, levelDbfs }) => {
                    const y = enhancerGainY(gainDb);
                    return (
                        <g key={gainDb} data-gain-db={gainDb} data-level-dbfs={levelDbfs}>
                            <path
                                className={`enhancer-spectrum-grid-line${gainDb === 0 ? " is-baseline" : ""}`}
                                d={`M ${ENHANCER_SPECTRUM_PLOT.left} ${y.toFixed(2)} H ${plotRight}`}
                            />
                            <text
                                className="enhancer-spectrum-axis-label enhancer-spectrum-gain-label"
                                x={ENHANCER_SPECTRUM_PLOT.left - 8}
                                y={y + 3}
                                textAnchor="end"
                            >
                                {gainDb > 0 ? `+${gainDb}` : gainDb}
                            </text>
                            <text
                                className="enhancer-spectrum-axis-label enhancer-spectrum-level-label"
                                x={plotRight + 8}
                                y={y + 3}
                                textAnchor="start"
                            >
                                {levelDbfs}
                            </text>
                        </g>
                    );
                })}
                <text className="enhancer-spectrum-axis-unit" x={8} y={12}>GAIN</text>
                <text
                    className="enhancer-spectrum-axis-unit enhancer-spectrum-level-label"
                    x={ENHANCER_SPECTRUM_PLOT.width - 5}
                    y={12}
                    textAnchor="end"
                >
                    dBFS
                </text>
            </g>

            {spectrum === null ? null : (
                <path
                    className="enhancer-spectrum-incoming-trace"
                    data-role="enhancer-spectrum-incoming"
                    d={spectrum.path}
                />
            )}

            <g data-role="enhancer-spectrum-curves" aria-hidden="true">
                {curves.map((curve) => (
                    <path
                        key={curve.id}
                        className="enhancer-spectrum-response-curve"
                        data-curve-id={curve.id}
                        data-curve-label={curve.label}
                        d={createEnhancerFrequencyPath((frequencyHz) => (
                            enhancerGainY(curve.gainDbAtFrequency(frequencyHz))
                        ))}
                        style={{
                            "--enhancer-curve-color": curve.color,
                            strokeDasharray: curve.dashArray,
                        } as CSSProperties}
                    />
                ))}
            </g>

            <g data-role="enhancer-spectrum-markers" aria-hidden="true">
                {markers.map((marker) => {
                    const x = enhancerFrequencyX(marker.frequencyHz);
                    const y = enhancerGainY(marker.gainDb);
                    return (
                        <g
                            key={marker.id}
                            data-marker-id={marker.id}
                            data-frequency-hz={marker.frequencyHz}
                            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
                            style={{ "--enhancer-marker-color": marker.color } as CSSProperties}
                        >
                            <path className="enhancer-spectrum-marker-guide" d={`M 0 0 V ${plotBottom - y}`} />
                            <circle className="enhancer-spectrum-marker" r={5} />
                            <title>{marker.label}</title>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
