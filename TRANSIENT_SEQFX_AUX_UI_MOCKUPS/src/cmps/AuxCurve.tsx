import { useMemo } from "react";

export type AuxCurveShape = "linear" | "ease" | "exp" | "log" | "bell" | "hold";

export type AuxCurveProps = {
    shape: AuxCurveShape;
    onShapeChange: (shape: AuxCurveShape) => void;
    phase: number;
    onPhaseChange: (phase: number) => void;
};

const SHAPES: Array<{ id: AuxCurveShape; label: string }> = [
    { id: "linear", label: "Lin" },
    { id: "ease", label: "Ease" },
    { id: "exp", label: "Exp" },
    { id: "log", label: "Log" },
    { id: "bell", label: "Bell" },
    { id: "hold", label: "Hold" },
];

export function sampleAuxCurve(shape: AuxCurveShape, phase: number) {
    const x = Math.max(0, Math.min(1, phase));

    switch (shape) {
        case "linear":
            return x;
        case "ease":
            return x * x * (3 - 2 * x);
        case "exp":
            return x * x;
        case "log":
            return 1 - ((1 - x) * (1 - x));
        case "bell":
            return Math.sin(Math.PI * x);
        case "hold":
            return x < 0.5 ? 0 : 1;
        default:
            return x;
    }
}

function buildPreviewPath(shape: AuxCurveShape): string {
    const points: string[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const y = sampleAuxCurve(shape, t);
        const px = (2 + (t * 196)).toFixed(1);
        const py = (20 - (y * 18)).toFixed(1);
        points.push(`${i === 0 ? "M" : "L"} ${px} ${py}`);
    }
    return points.join(" ");
}

export function AuxCurve({ shape, onShapeChange, phase, onPhaseChange }: AuxCurveProps) {
    const path = useMemo(() => buildPreviewPath(shape), [shape]);
    const phaseY = (20 - (sampleAuxCurve(shape, phase) * 18)).toFixed(1);
    const phaseX = (2 + phase * 196).toFixed(1);

    return (
        <div className="aux-curve">
            <div className="aux-curve__head">
                <span className="aux-curve__title">Aux Curve</span>
                <span className="aux-curve__sub">shared · drag phase below</span>
            </div>
            <div className="aux-curve__shapes">
                {SHAPES.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        className={entry.id === shape ? "is-selected" : ""}
                        onClick={() => onShapeChange(entry.id)}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>
            <div className="aux-curve__preview">
                <svg viewBox="0 0 200 22" preserveAspectRatio="none">
                    <path className="aux-pv-line" d={path} />
                    <circle cx={phaseX} cy={phaseY} r="2.2" className="aux-pv-dot" />
                </svg>
            </div>
            <label className="aux-curve__phase-row">
                <span className="aux-curve__phase-label">Phase</span>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={phase}
                    onChange={(event) => onPhaseChange(Number(event.currentTarget.value))}
                />
                <output className="aux-curve__phase-value">{phase.toFixed(2)}</output>
            </label>
        </div>
    );
}
