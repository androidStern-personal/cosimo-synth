/**
 * The dev-build Performance tuning page (preset bar → shell menu → Performance
 * tuning). Two live tuning surfaces: which auto-preview algorithm the running
 * synth uses (with its numbers), and the mod-source drag outrun feel. Values
 * persist in localStorage via the perf-tuning store; release builds never
 * load this module.
 */

import { useSyncExternalStore } from "react";

import {
    PERF_TUNING_DEFAULTS,
    getPerfTuningState,
    subscribePerfTuning,
    updatePerfTuning,
    resetPerfTuningDrag,
    resetPerfTuningPreview,
    type AutoPreviewAlgorithm,
} from "../shared/perf-tuning";
import { type ModSourceTouchTuning } from "../shared/mod-source-touch-geometry";

const ALGORITHM_ROWS: ReadonlyArray<{
    id: AutoPreviewAlgorithm;
    label: string;
    summary: string;
}> = [
    {
        id: "shipped",
        label: "Shipped",
        summary: "The T12 engine as released: rate-windowed restrikes, stillness ends the preview.",
    },
    {
        id: "morph",
        label: "Morph",
        summary: "One held note per editing burst; the loop reads edits live, no restrikes.",
    },
    {
        id: "settle",
        label: "Settle",
        summary: "Quiet while moving; one choked restrike each time the value rests, then it holds.",
    },
    {
        id: "wrap",
        label: "Wrap",
        summary: "Restrikes only at the routed loop's cycle boundary (settle when no loop).",
    },
    {
        id: "paced",
        label: "Paced",
        summary: "In-motion restrikes at the min gap plus a settle restrike, all choked, then hold.",
    },
];

const SLIDER_TRACK_CLASS = "h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15";

function TuningSlider({
    label,
    detail,
    value,
    min,
    max,
    step,
    format,
    onChange,
}: {
    label: string;
    detail?: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
    onChange: (value: number) => void;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    {label}
                    {detail ? <span className="ml-2 normal-case tracking-normal text-slate-500">{detail}</span> : null}
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-200">{format(value)}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className={SLIDER_TRACK_CLASS}
                style={{ accentColor: "#87d7f5" }}
            />
        </label>
    );
}

function SectionHeading({ title, onReset }: { title: string; onReset: () => void }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-300">{title}</h3>
            <button
                type="button"
                onClick={onReset}
                className="text-[11px] text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-slate-200"
            >
                Reset
            </button>
        </div>
    );
}

export default function PerfTuningPage({ onClose }: { onClose: () => void }) {
    const state = useSyncExternalStore(subscribePerfTuning, getPerfTuningState);
    const setDrag = (next: Partial<ModSourceTouchTuning>) => updatePerfTuning({ drag: next });

    return (
        <div
            data-role="perf-tuning-page"
            className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center"
        >
            <div
                aria-hidden="true"
                onClick={onClose}
                className="absolute inset-0 bg-black/60"
            />
            <div
                role="dialog"
                aria-label="Performance tuning"
                className="relative flex max-h-[88%] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#11161b] text-slate-100 shadow-2xl sm:max-h-[85%] sm:rounded-2xl"
            >
                <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-sm font-semibold tracking-wide">Performance tuning</h2>
                        <span className="rounded bg-[#87d7f5]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87d7f5]">
                            dev
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close performance tuning"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-white/10 hover:text-slate-100"
                    >
                        &#215;
                    </button>
                </header>

                <div className="flex flex-col gap-6 overflow-y-auto px-4 py-4">
                    <section className="flex flex-col gap-3">
                        <SectionHeading title="Auto-preview algorithm" onReset={resetPerfTuningPreview} />
                        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Auto-preview algorithm">
                            {ALGORITHM_ROWS.map((row) => {
                                const selected = state.algorithm === row.id;
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => updatePerfTuning({ algorithm: row.id })}
                                        className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 text-left ${
                                            selected
                                                ? "border-[#87d7f5]/60 bg-[#87d7f5]/10"
                                                : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]"
                                        }`}
                                    >
                                        <span className={`text-[13px] font-semibold ${selected ? "text-[#b8e6fa]" : "text-slate-200"}`}>
                                            {row.label}
                                        </span>
                                        <span className="text-[11.5px] leading-snug text-slate-400">{row.summary}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <TuningSlider
                            label="Settle time"
                            detail="settle · wrap fallback · paced"
                            value={state.settleMs}
                            min={40}
                            max={400}
                            step={10}
                            format={(v) => `${v}ms`}
                            onChange={(settleMs) => updatePerfTuning({ settleMs })}
                        />
                        <TuningSlider
                            label="Min restrike gap"
                            detail="paced · shipped"
                            value={state.minGapMs}
                            min={100}
                            max={600}
                            step={25}
                            format={(v) => `${v}ms`}
                            onChange={(minGapMs) => updatePerfTuning({ minGapMs })}
                        />
                        <TuningSlider
                            label="Hold after settle"
                            detail="how long the settled note keeps looping"
                            value={state.holdMs}
                            min={1000}
                            max={10000}
                            step={500}
                            format={(v) => `${(v / 1000).toFixed(1)}s`}
                            onChange={(holdMs) => updatePerfTuning({ holdMs })}
                        />
                        <label className="flex items-center justify-between gap-3 py-0.5">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                                Loop sync
                                <span className="ml-2 normal-case tracking-normal text-slate-500">
                                    land restrikes on the loop grid
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={state.loopSync}
                                onChange={(event) => updatePerfTuning({ loopSync: event.target.checked })}
                                className="h-5 w-5"
                                style={{ accentColor: "#87d7f5" }}
                            />
                        </label>
                    </section>

                    <section className="flex flex-col gap-3">
                        <SectionHeading title="Mod drag feel" onReset={resetPerfTuningDrag} />
                        <p className="text-[11.5px] leading-snug text-slate-500">
                            The touch preview outruns the finger: gain ramps from 1&#215; to
                            min(max, screen width &#247; reference width) over the ramp distance,
                            after the pickup threshold.
                        </p>
                        <TuningSlider
                            label="Pickup threshold"
                            value={state.drag.activationPx}
                            min={0}
                            max={30}
                            step={1}
                            format={(v) => `${v}px`}
                            onChange={(activationPx) => setDrag({ activationPx })}
                        />
                        <TuningSlider
                            label="Ramp distance"
                            value={state.drag.rampPx}
                            min={16}
                            max={200}
                            step={4}
                            format={(v) => `${v}px`}
                            onChange={(rampPx) => setDrag({ rampPx })}
                        />
                        <TuningSlider
                            label="Gain min"
                            value={state.drag.gainMin}
                            min={1}
                            max={4}
                            step={0.05}
                            format={(v) => `${v.toFixed(2)}×`}
                            onChange={(gainMin) => setDrag({ gainMin })}
                        />
                        <TuningSlider
                            label="Gain max"
                            value={state.drag.gainMax}
                            min={1}
                            max={6}
                            step={0.05}
                            format={(v) => `${v.toFixed(2)}×`}
                            onChange={(gainMax) => setDrag({ gainMax })}
                        />
                        <TuningSlider
                            label="Reference width"
                            value={state.drag.referenceTravelPx}
                            min={80}
                            max={600}
                            step={4}
                            format={(v) => `${v}px`}
                            onChange={(referenceTravelPx) => setDrag({ referenceTravelPx })}
                        />
                        <p className="text-[11px] text-slate-500">
                            Shipped values: pickup {PERF_TUNING_DEFAULTS.drag.activationPx}px, ramp{" "}
                            {PERF_TUNING_DEFAULTS.drag.rampPx}px, gain {PERF_TUNING_DEFAULTS.drag.gainMin}
                            &ndash;{PERF_TUNING_DEFAULTS.drag.gainMax}&#215;, reference{" "}
                            {PERF_TUNING_DEFAULTS.drag.referenceTravelPx}px.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
