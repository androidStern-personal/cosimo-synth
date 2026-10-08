import type { CSSProperties } from "react";
import { clamp, formatBoost, formatFrequency, formatQ } from "./format";

/** One band as the plot draws it. */
export interface PlottedBand {
    readonly number: 1 | 2;
    readonly accent: string;
    readonly frequency: number;
    readonly q: number;
    readonly primary: number;
    readonly side: number;
    readonly midSide: boolean;
}

const plot = Object.freeze({
    width: 936,
    height: 168,
    left: 44,
    right: 12,
    top: 12,
    bottom: 24,
    minimumHz: 20,
    maximumHz: 20_000,
    maximumDb: 12,
    modelSampleRate: 48_000 * 4,
});

const gridFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000] as const;
const gridLevels = [0, 3, 6, 9, 12] as const;

function plotX(frequencyHz: number): number {
    const normalized = Math.log(clamp(frequencyHz, plot.minimumHz, plot.maximumHz) / plot.minimumHz)
        / Math.log(plot.maximumHz / plot.minimumHz);
    return plot.left + normalized * (plot.width - plot.left - plot.right);
}

function plotY(gainDb: number): number {
    const normalized = clamp(gainDb, 0, plot.maximumDb) / plot.maximumDb;
    return plot.height - plot.bottom - normalized * (plot.height - plot.top - plot.bottom);
}

function peakingResponseDb(frequencyHz: number, centreHz: number, q: number, amount: number): number {
    // Same 4x RBJ peaking-EQ law recovered from Spectre Good. The audio path
    // takes H(z)-1 into the shaper; a conventional EQ display shows H(z), so
    // the peak reads as the user's 0..12 dB Amount while retaining the actual
    // gain-dependent shoulders.
    const gainDb = 12 * clamp(amount, 0, 1);
    const amplitude = Math.pow(10, gainDb / 40);
    const centreOmega = 2 * Math.PI * clamp(centreHz, 20, 20_000) / plot.modelSampleRate;
    const alpha = Math.sin(centreOmega) / (2 * clamp(q, 0.1, 10));
    const centreCosine = Math.cos(centreOmega);
    const omega = 2 * Math.PI * clamp(frequencyHz, 20, 20_000) / plot.modelSampleRate;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = 1 + alpha * amplitude - 2 * centreCosine * z1Real + (1 - alpha * amplitude) * z2Real;
    const numeratorImaginary = -2 * centreCosine * z1Imaginary + (1 - alpha * amplitude) * z2Imaginary;
    const denominatorReal = 1 + alpha / amplitude - 2 * centreCosine * z1Real + (1 - alpha / amplitude) * z2Real;
    const denominatorImaginary = -2 * centreCosine * z1Imaginary + (1 - alpha / amplitude) * z2Imaginary;
    const numeratorPower = numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;
    return clamp(10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30)), 0, 12);
}

function responsePath(centreHz: number, q: number, amount: number, closeArea = false): string {
    const pointCount = 241;
    const points: string[] = [];
    for (let index = 0; index < pointCount; index += 1) {
        const frequencyHz = plot.minimumHz * Math.pow(plot.maximumHz / plot.minimumHz, index / (pointCount - 1));
        points.push(`${index === 0 ? "M" : "L"} ${plotX(frequencyHz).toFixed(2)} ${plotY(peakingResponseDb(frequencyHz, centreHz, q, amount)).toFixed(2)}`);
    }
    if (closeArea) {
        const baseline = plotY(0).toFixed(2);
        points.push(`L ${(plot.width - plot.right).toFixed(2)} ${baseline}`);
        points.push(`L ${plot.left.toFixed(2)} ${baseline} Z`);
    }
    return points.join(" ");
}

/** Both bands' boost against frequency, from 20 Hz to 20 kHz, with the Side curve shown in M/S. */
export function ResponsePlot({ bands }: { readonly bands: readonly PlottedBand[] }) {
    return <section className="response-panel" aria-label="Enhancer parametric response">
        <header className="response-heading">
            <div>
                <span className="response-title">Band selection</span>
                <p>Measured 4× parametric shape · Amount changes both boost and shoulder width</p>
            </div>
            <div className="response-legend" aria-label="Response legend">
                {bands.map(band => <span key={band.number} style={{ "--response-accent": band.accent } as CSSProperties}><i />Band {band.number}</span>)}
                <span className="side-key"><i />Side in M/S</span>
            </div>
        </header>
        <svg className="response-plot" viewBox={`0 0 ${plot.width} ${plot.height}`} role="img"
            aria-label="Frequency versus boost plot from 20 hertz to 20 kilohertz">
            {gridFrequencies.map(frequencyHz => {
                const x = plotX(frequencyHz).toFixed(2);
                return <g key={frequencyHz}>
                    <path className="response-grid-line" d={`M ${x} ${plot.top} V ${plotY(0).toFixed(2)}`} />
                    <text className="response-axis-label frequency-label" x={x} y={plot.height - 6} textAnchor="middle">
                        {frequencyHz >= 1000 ? `${frequencyHz / 1000}k` : frequencyHz}
                    </text>
                </g>;
            })}
            {gridLevels.map(gainDb => {
                const y = plotY(gainDb);
                return <g key={gainDb}>
                    <path className={gainDb === 0 ? "response-grid-line baseline" : "response-grid-line"}
                        d={`M ${plot.left} ${y.toFixed(2)} H ${plot.width - plot.right}`} />
                    <text className="response-axis-label level-label" x={plot.left - 8} y={y + 3} textAnchor="end">{gainDb === 0 ? "0" : `+${gainDb}`}</text>
                </g>;
            })}
            <text className="response-axis-unit" x="9" y="17">dB</text>
            {bands.map(band => {
                const style = { "--response-accent": band.accent } as CSSProperties;
                const x = plotX(band.frequency).toFixed(2);
                const where = `${formatFrequency(band.frequency)}, Q ${formatQ(band.q)}`;
                return <g key={band.number} style={style}>
                    <path className="response-fill" data-response-band={band.number} data-response-role="fill"
                        d={responsePath(band.frequency, band.q, band.primary, true)} />
                    <path className="response-band primary" data-response-band={band.number} data-response-role="primary"
                        d={responsePath(band.frequency, band.q, band.primary)}
                        aria-label={`Band ${band.number} ${band.midSide ? "Mid" : "Stereo"}: ${where}, ${formatBoost(band.primary)}`} />
                    {band.midSide && <path className="response-band side" data-response-band={band.number} data-response-role="side"
                        d={responsePath(band.frequency, band.q, band.side)}
                        aria-label={`Band ${band.number} Side: ${where}, ${formatBoost(band.side)}`} />}
                    <circle className="response-handle primary" data-response-band={band.number} data-response-role="primary-handle"
                        r="4.5" cx={x} cy={plotY(12 * band.primary).toFixed(2)} />
                    {band.midSide && <circle className="response-handle side" data-response-band={band.number} data-response-role="side-handle"
                        r="3.5" cx={x} cy={plotY(12 * band.side).toFixed(2)} />}
                </g>;
            })}
        </svg>
    </section>;
}
