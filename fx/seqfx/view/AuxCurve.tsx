import { useMemo } from "react";

import type { SeqFxAuxCurveShape } from "./seqfx-state";

export type AuxCurveProps = {
    shape: SeqFxAuxCurveShape;
    onShapeChange: (shape: SeqFxAuxCurveShape) => void;
    phase: number;
    onPhaseChange?: (phase: number) => void;
};

const SHAPES: Array<{ id: SeqFxAuxCurveShape; label: string }> = [
    { id: "linear", label: "Lin" },
    { id: "ease", label: "Ease" },
    { id: "exp", label: "Exp" },
    { id: "log", label: "Log" },
    { id: "bell", label: "Bell" },
    { id: "hold", label: "Hold" },
];

export function sampleAuxCurve(shape: SeqFxAuxCurveShape, phase: number) {
    const x = Math.max(0, Math.min(1, phase));

    switch (shape) {
        case "linear":
            return x;
        case "ease":
            return x * x * (3 - (2 * x));
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

function buildPreviewPath(shape: SeqFxAuxCurveShape): string {
    const points: string[] = [];
    const steps = 48;
    for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const y = sampleAuxCurve(shape, t);
        const px = (2 + (t * 196)).toFixed(1);
        const py = (20 - (y * 18)).toFixed(1);
        points.push(`${index === 0 ? "M" : "L"} ${px} ${py}`);
    }
    return points.join(" ");
}

export function AuxCurve({ shape, onShapeChange, phase, onPhaseChange }: AuxCurveProps) {
    const clampedPhase = Math.max(0, Math.min(1, phase));
    const path = useMemo(() => buildPreviewPath(shape), [shape]);
    const phaseY = (20 - (sampleAuxCurve(shape, clampedPhase) * 18)).toFixed(1);
    const phaseX = (2 + (clampedPhase * 196)).toFixed(1);

    return (
        <div className="aux-curve" data-role="seqfx-aux-curve">
            <div className="aux-curve__head">
                <span className="aux-curve__title">Aux Curve</span>
                <span className="aux-curve__sub">Shared</span>
            </div>
            <div className="aux-curve__shapes">
                {SHAPES.map((entry) => (
                    <button
                        className={entry.id === shape ? "is-selected" : ""}
                        data-role="seqfx-aux-curve-shape"
                        data-shape={entry.id}
                        key={entry.id}
                        onClick={() => onShapeChange(entry.id)}
                        type="button"
                    >
                        {entry.label}
                    </button>
                ))}
            </div>
            <div className="aux-curve__preview">
                <svg viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true">
                    <path className="aux-pv-line" d={path} />
                    <circle cx={phaseX} cy={phaseY} r="2.2" className="aux-pv-dot" />
                </svg>
            </div>
            <label className="aux-curve__phase-row">
                <span className="aux-curve__phase-label">Phase</span>
                <input
                    data-role="seqfx-aux-phase"
                    disabled={!onPhaseChange}
                    max={1}
                    min={0}
                    onChange={(event) => onPhaseChange?.(Number(event.currentTarget.value))}
                    step={0.001}
                    type="range"
                    value={clampedPhase}
                />
                <output className="aux-curve__phase-value">{clampedPhase.toFixed(2)}</output>
            </label>
        </div>
    );
}
