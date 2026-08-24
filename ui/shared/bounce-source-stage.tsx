import { useMemo } from "react";

import {
    createBounceWaveformEnvelope,
} from "../../bounce/waveform.mjs";
import type { BounceUIState } from "./use-bounce-in-place";

type BounceActions = {
    readonly state: BounceUIState;
    readonly onBounce: () => void;
    readonly onCancel: () => void;
    readonly onRevert: () => void;
    readonly requestBounceGuard: (continuation: () => void) => void;
};

function phaseLabel(state: BounceUIState) {
    switch (state.phase) {
        case "hydrating": return "Loading Bounce state…";
        case "preparing": return "Preparing source snapshot…";
        case "capturing": return state.totalRoots > 0
            ? `Rendering root ${Math.min(state.completedRoots + 1, state.totalRoots)} of ${state.totalRoots}…`
            : "Starting render workers…";
        case "validating": return "Validating capture…";
        case "persisting": return "Saving bank…";
        case "installing": return "Installing sampled source…";
        case "verifying": return "Verifying sampled source…";
        case "flipping": return "Switching source…";
        case "reverting": return "Restoring previous sound…";
        case "complete": return "Bounce complete";
        default: return "Ready";
    }
}

function phaseProgress(state: BounceUIState) {
    if (state.phase === "preparing") {
        const progress = state.preparation;
        return progress && progress.totalUnits > 0
            ? 0.16 * progress.completedUnits / progress.totalUnits
            : 0.02;
    }
    if (state.phase === "capturing") {
        return 0.16 + (state.totalRoots > 0 ? 0.64 * state.completedRoots / state.totalRoots : 0);
    }
    if (state.phase === "validating") return 0.82;
    if (state.phase === "persisting") return 0.86;
    if (state.phase === "installing") {
        return 0.88 + (state.totalFrames > 0 ? 0.08 * state.completedFrames / state.totalFrames : 0);
    }
    if (state.phase === "verifying") return 0.97;
    if (state.phase === "flipping") return 0.99;
    if (state.phase === "complete") return 1;
    return 0;
}

function BounceProgress({ state }: { state: BounceUIState }) {
    const progress = phaseProgress(state);
    return (
        <div
            data-role="bounce-progress"
            className="min-w-[150px] rounded-[9px] border border-cyan-200/10 bg-black/60 px-2.5 py-1.5 shadow-lg backdrop-blur-md"
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                <span>{phaseLabel(state)}</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                    data-role="bounce-progress-fill"
                    className="h-full rounded-full bg-cyan-300 shadow-[0_0_8px_rgb(103_232_249/0.55)] transition-[width] duration-200"
                    style={{ width: `${Math.max(1, progress * 100)}%` }}
                />
            </div>
        </div>
    );
}

export function BounceActionControl({
    state,
    onBounce,
    onCancel,
    requestBounceGuard,
    compact = false,
    showReadyAction = true,
}: Omit<BounceActions, "onRevert"> & { compact?: boolean; showReadyAction?: boolean }) {
    if (state.busy) {
        return (
            <div
                data-role="bounce-action-control"
                className={`flex items-center gap-1.5 ${compact ? "w-full justify-end px-1" : ""}`}
            >
                <BounceProgress state={state} />
                {state.cancellable ? (
                    <button
                        type="button"
                        data-role="bounce-cancel"
                        className="h-8 rounded-[8px] border border-rose-200/20 bg-rose-300/10 px-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-100 hover:bg-rose-300/18"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                ) : null}
            </div>
        );
    }

    if (!showReadyAction) {
        return state.error ? (
            <span
                data-role="bounce-error-inline"
                className="max-w-[220px] truncate text-[9px] font-medium text-rose-200/85"
                title={state.error}
            >
                {state.error}
            </span>
        ) : null;
    }

    return (
        <div
            data-role="bounce-action-control"
            className={`flex items-center gap-2 ${compact ? "w-full justify-end px-1" : ""}`}
        >
            {state.error ? (
                <span
                    data-role="bounce-error-inline"
                    className="max-w-[220px] truncate text-[9px] font-medium text-rose-200/85"
                    title={state.error}
                >
                    {state.error}
                </span>
            ) : null}
            <button
                type="button"
                data-role="bounce-start"
                disabled={!state.hydrated || !state.captureReady}
                title={!state.captureReady ? "Waiting for the complete patch state…" : "Render this sound into a sampled source"}
                className="h-8 rounded-[8px] border border-cyan-200/20 bg-cyan-300/12 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_16px_rgb(34_211_238/0.08)] transition hover:border-cyan-200/35 hover:bg-cyan-300/18 disabled:cursor-wait disabled:opacity-40"
                onClick={() => requestBounceGuard(onBounce)}
            >
                Bounce
            </button>
        </div>
    );
}

function waveformPath(columns: ReadonlyArray<{ minimum: number; maximum: number }>) {
    const denominator = Math.max(1, columns.length - 1);
    const x = (index: number) => (index / denominator) * 1000;
    const y = (sample: number) => 140 - (sample * 112);
    const upper = columns.map((column, index) => `${x(index).toFixed(2)},${y(column.maximum).toFixed(2)}`);
    const lower = [...columns].reverse().map((column, reverseIndex) => {
        const index = columns.length - 1 - reverseIndex;
        return `${x(index).toFixed(2)},${y(column.minimum).toFixed(2)}`;
    });
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
}

export function BounceSampledSourceStage({
    state,
    lastPlayedNote,
    onBounce,
    onCancel,
    onRevert,
    requestBounceGuard,
    compact = false,
    className = "",
}: BounceActions & {
    lastPlayedNote: number;
    compact?: boolean;
    className?: string;
}) {
    const waveform = useMemo(() => (
        state.bank === null
            ? null
            : createBounceWaveformEnvelope(state.bank, {
                note: lastPlayedNote,
                columnCount: compact ? 128 : 256,
            })
    ), [compact, lastPlayedNote, state.bank]);
    const path = waveform ? waveformPath(waveform.columns) : null;
    const roots = state.bank?.roots ?? state.document?.roots.map((note, index) => ({
        note,
        frameOffset: state.document?.segments[index].frameOffset ?? 0,
        frameCount: state.document?.segments[index].frameCount ?? 0,
    })) ?? [];
    const firstNote = roots[0]?.note ?? 0;
    const lastNote = roots.at(-1)?.note ?? firstNote + 1;

    return (
        <section
            data-role="bounce-sampled-source-stage"
            data-source-mode="sampled"
            className={`relative flex min-h-[230px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-cyan-200/10 bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.08),transparent_62%),rgb(4_10_18/0.92)] ${className}`}
        >
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 px-3 pb-1 pt-3">
                <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-200/55">Sampled source</div>
                    <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-100/85">
                        {waveform
                            ? `Root ${waveform.rootNote} · ${(waveform.frameCount / Math.max(1, state.bank?.sampleRate ?? 1)).toFixed(2)} s`
                            : "Restoring bank…"}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <BounceActionControl
                        state={state}
                        onBounce={onBounce}
                        onCancel={onCancel}
                        requestBounceGuard={requestBounceGuard}
                        showReadyAction={false}
                    />
                    {!state.busy ? (
                    <button
                        type="button"
                        data-role="bounce-revert"
                        className="h-8 shrink-0 rounded-[8px] border border-amber-200/20 bg-amber-300/10 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-100 transition hover:bg-amber-300/17"
                        onClick={onRevert}
                    >
                        Revert
                    </button>
                    ) : null}
                </div>
            </div>

            <div className="relative min-h-0 flex-1 px-3 py-1">
                {path ? (
                    <svg
                        data-role="bounce-pcm-waveform"
                        viewBox="0 0 1000 280"
                        preserveAspectRatio="none"
                        className="h-full min-h-[130px] w-full overflow-visible"
                        aria-label={`PCM waveform for root ${waveform?.rootNote}`}
                        role="img"
                    >
                        <line x1="0" x2="1000" y1="140" y2="140" stroke="rgb(148 163 184 / 0.16)" strokeWidth="1" />
                        <path d={path} fill="rgb(103 232 249 / 0.16)" stroke="rgb(103 232 249 / 0.78)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                    </svg>
                ) : (
                    <div className="flex h-full min-h-[130px] items-center justify-center text-center text-[11px] text-slate-300/55">
                        {state.error ?? "Loading PCM…"}
                    </div>
                )}

                <div
                    data-role="bounce-root-markers"
                    className="pointer-events-none absolute inset-x-3 bottom-1 h-5 border-t border-white/[0.05]"
                    aria-hidden="true"
                >
                    {roots.map((root, index) => {
                        const left = ((root.note - firstNote) / Math.max(1, lastNote - firstNote)) * 100;
                        const selected = root.note === waveform?.rootNote;
                        const label = selected || index === 0 || index === roots.length - 1;
                        return (
                            <span
                                key={root.note}
                                className={`absolute top-0 h-2 border-l ${selected ? "border-cyan-200/90" : "border-slate-400/25"}`}
                                style={{ left: `${left}%` }}
                            >
                                {label ? (
                                    <span className={`absolute top-2 -translate-x-1/2 text-[7px] tabular-nums ${selected ? "text-cyan-100" : "text-slate-400/45"}`}>
                                        {root.note}
                                    </span>
                                ) : null}
                            </span>
                        );
                    })}
                </div>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/[0.05] bg-black/20 px-3 py-2">
                <span className="text-[9px] leading-tight text-slate-300/55">
                    Oscillator controls and oscillator modulation targets are baked and inactive until Revert.
                </span>
                {state.document ? (
                    <span className="shrink-0 font-mono text-[8px] text-cyan-200/40" title={state.document.digest}>
                        {state.document.digest.slice(0, 8)}
                    </span>
                ) : null}
            </div>
            {state.error ? (
                <div
                    data-role="bounce-source-error"
                    role="alert"
                    className="border-t border-rose-200/10 bg-rose-300/8 px-3 py-2 text-[10px] text-rose-100/85"
                >
                    {state.error}
                </div>
            ) : null}
        </section>
    );
}
