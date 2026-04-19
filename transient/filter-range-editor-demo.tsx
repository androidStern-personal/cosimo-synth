import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
    FilterRangeEditor,
    type FilterRangeEndpoints,
    type FilterRangeMode,
    type FilterRangePolarity,
    type FilterRangeValue,
    cutoffRangeOctaves,
    cutoffsFromBaseModulationOctaves,
    cutoffsFromCenterRangeOctaves,
    geometricCenterCutoffHz,
    modulationOctavesFromCutoffRange,
} from "../ui/shared/filter-range-editor";
import { filterCutoffHzToNormalized } from "../ui/shared/filter-response";

import "./filter-range-editor-demo.css";

function logInterpolateHz(startHz: number, endHz: number, amount: number) {
    const start = Math.max(20, startHz);
    const end = Math.max(20, endHz);
    return Math.exp(Math.log(start) + ((Math.log(end) - Math.log(start)) * amount));
}

function useAnimatedRangePreview(range: FilterRangeEndpoints, q: number, mode: FilterRangeMode) {
    const [position, setPosition] = useState(0.5);

    useEffect(() => {
        let frameID = 0;
        let lastFrameMs = 0;

        const tick = (timeMs: number) => {
            if (timeMs - lastFrameMs >= 80) {
                const phase = (timeMs % 3600) / 3600;
                setPosition((Math.sin((phase * Math.PI * 2) - (Math.PI * 0.5)) + 1) * 0.5);
                lastFrameMs = timeMs;
            }

            frameID = requestAnimationFrame(tick);
        };

        frameID = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frameID);
    }, []);

    return {
        active: true,
        mode,
        cutoffHz: logInterpolateHz(range.startCutoffHz, range.endCutoffHz, position),
        q,
        label: "Preview",
    };
}

function fmtHz(hz: number): string {
    if (hz >= 10_000) return `${(hz / 1000).toFixed(1)}k`;
    if (hz >= 1_000) return `${(hz / 1000).toFixed(2)}k`;
    return `${Math.round(hz)}`;
}

type HandleChipsProps = {
    value: FilterRangeValue;
    range: FilterRangeEndpoints;
    rangePolarity: FilterRangePolarity;
};

function HandleChips({ value, range, rangePolarity }: HandleChipsProps) {
    const startNorm = filterCutoffHzToNormalized(range.startCutoffHz);
    const endNorm = filterCutoffHzToNormalized(range.endCutoffHz);
    const centerNorm = filterCutoffHzToNormalized(value.cutoffHz);
    const midNorm = (startNorm + endNorm) / 2;
    const isDownward = range.endCutoffHz < range.startCutoffHz;
    const octaves = cutoffRangeOctaves(range.startCutoffHz, range.endCutoffHz);

    return (
        <div className="fre-chips" aria-hidden="true">
            <div
                className="fre-chip fre-chip--center"
                style={{ "--chip-norm": centerNorm } as React.CSSProperties}
            >
                <span className="fre-chip__hz">{fmtHz(value.cutoffHz)}</span>
                <span className="fre-chip__q">Q {value.q.toFixed(1)}</span>
            </div>
            {rangePolarity === "bipolar" ? (
                <div
                    className="fre-chip fre-chip--start"
                    style={{ "--chip-norm": startNorm } as React.CSSProperties}
                >
                    {fmtHz(range.startCutoffHz)}
                </div>
            ) : null}
            <div
                className="fre-chip fre-chip--end"
                style={{ "--chip-norm": endNorm } as React.CSSProperties}
            >
                {fmtHz(range.endCutoffHz)}
            </div>
            <div
                className="fre-chip fre-chip--span"
                style={{ "--chip-norm": midNorm } as React.CSSProperties}
            >
                <span className="fre-chip__dir">{isDownward ? "↙" : "↗"}</span>
                <span className="fre-chip__oct">{octaves.toFixed(2)} oct</span>
            </div>
        </div>
    );
}

function FilterRangeDemo() {
    const [value, setValue] = useState<FilterRangeValue>({
        mode: "lowpass",
        cutoffHz: geometricCenterCutoffHz(240, 6200),
        q: 4.2,
    });
    const [range, setRange] = useState<FilterRangeEndpoints>({
        startCutoffHz: 240,
        endCutoffHz: 6200,
    });
    const [rangePolarity, setRangePolarity] = useState<FilterRangePolarity>("bipolar");
    const preview = useAnimatedRangePreview(range, value.q, value.mode);
    const rangeOctaves = cutoffRangeOctaves(range.startCutoffHz, range.endCutoffHz);
    const direction = range.endCutoffHz >= range.startCutoffHz ? 1 : -1;
    const centerPosition = filterCutoffHzToNormalized(value.cutoffHz);
    const pitchName = useMemo(() => {
        const normalized = filterCutoffHzToNormalized(value.cutoffHz);
        return normalized < 0.33 ? "low band" : normalized < 0.66 ? "mid band" : "air band";
    }, [value.cutoffHz]);

    const updateValue = (nextValue: FilterRangeValue) => {
        const modulationAmount = modulationOctavesFromCutoffRange({
            baseCutoffHz: value.cutoffHz,
            range,
            polarity: rangePolarity,
        });
        setValue(nextValue);

        const nextRange = rangePolarity === "unipolar"
            ? cutoffsFromBaseModulationOctaves({
                baseCutoffHz: nextValue.cutoffHz,
                amountOctaves: modulationAmount,
                polarity: "unipolar",
            })
            : cutoffsFromCenterRangeOctaves({
                centerCutoffHz: nextValue.cutoffHz,
                rangeOctaves,
                direction,
            });
        setRange(nextRange);
    };

    const updateRange = (nextRange: FilterRangeEndpoints) => {
        setRange(nextRange);
    };

    const updateRangePolarity = (nextPolarity: FilterRangePolarity) => {
        setRangePolarity(nextPolarity);
        setRange(nextPolarity === "unipolar"
            ? cutoffsFromBaseModulationOctaves({
                baseCutoffHz: value.cutoffHz,
                amountOctaves: Math.max(1, modulationOctavesFromCutoffRange({
                    baseCutoffHz: value.cutoffHz,
                    range,
                    polarity: "bipolar",
                })),
                polarity: "unipolar",
            })
            : cutoffsFromCenterRangeOctaves({
                centerCutoffHz: value.cutoffHz,
                rangeOctaves: Math.max(1, Math.abs(modulationOctavesFromCutoffRange({
                    baseCutoffHz: value.cutoffHz,
                    range,
                    polarity: "unipolar",
                })) * 2),
                direction,
            }));
    };

    return (
        <main className="demo-page">
            <section className="demo-shell" aria-label="Filter range editor demo">
                <div className="demo-copy">
                    <div>
                        <p className="eyebrow">Shared Filter Range Editor</p>
                        <h1>Set center, Q, range, and live motion.</h1>
                    </div>
                    <p className="intro">
                        Drag the black handle to move the center cutoff and resonance. Drag the two colored range
                        handles to set the modulation span. The moving orange curve is preview-only state.
                    </p>
                </div>

                <div className="demo-workbench">
                    <div className="demo-polarity-toolbar" aria-label="Filter range polarity">
                        {(["bipolar", "unipolar"] as FilterRangePolarity[]).map((polarity) => (
                            <button
                                key={polarity}
                                className={polarity === rangePolarity ? "active" : ""}
                                type="button"
                                onClick={() => updateRangePolarity(polarity)}
                            >
                                {polarity === "bipolar" ? "Bipolar" : "Unipolar"}
                            </button>
                        ))}
                    </div>

                    <div className="editor-overlay-root">
                        <FilterRangeEditor
                            value={value}
                            range={range}
                            rangePolarity={rangePolarity}
                            preview={preview}
                            showModeControls
                            showReadout={false}
                            ariaLabel="Interactive filter range editor"
                            onValueChange={updateValue}
                            onRangeChange={updateRange}
                        />
                        <HandleChips value={value} range={range} rangePolarity={rangePolarity} />
                    </div>
                </div>

                <aside className="demo-side-panel">
                    <div className="meter-card">
                        <span>Position</span>
                        <div className="position-track">
                            <div style={{ inlineSize: `${Math.round(centerPosition * 100)}%` }} />
                        </div>
                        <strong>{Math.round(centerPosition * 100)}%</strong>
                    </div>
                    <div className="meter-card">
                        <span>Area</span>
                        <strong>{pitchName}</strong>
                    </div>
                    <div className="meter-card">
                        <span>Range model</span>
                        <strong>Hz in, log axis out</strong>
                    </div>
                </aside>
            </section>
        </main>
    );
}

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLElement)) {
    throw new Error("Filter range editor demo root element is missing.");
}

createRoot(rootElement).render(
    <React.StrictMode>
        <FilterRangeDemo />
    </React.StrictMode>,
);
