/**
 * The developer-build performance tuning store: which auto-preview algorithm
 * the running synth uses, that algorithm's numbers, and the mod-source
 * drag-feel overrides. The page that edits this lives behind
 * PERF_TUNING_AVAILABLE and is reachable from the preset bar's shell menu in
 * Vite development or an explicitly opted-in developer deployment. Ordinary
 * production builds always run the shipped algorithm with shipped drag feel.
 */

import {
    MOD_SOURCE_TOUCH_TUNING_DEFAULTS,
    setModSourceTouchTuning,
    type ModSourceTouchTuning,
} from "./mod-source-touch-geometry";
import type { ModBarPreferences } from "./mod-bar-preferences";
import type { KeyboardPresentationPreferences } from "./keyboard-presentation-preferences";

/**
 * Compile-time developer-surface gate. Vite dev serves import.meta.env.DEV ===
 * true (the LAN phone session included); the Codex Sites build opts in with
 * VITE_COSIMO_DEVELOPER_SETTINGS=1. Ordinary Vite production and non-Vite
 * loads remain false.
 */
const viteEnvironmentAvailable = typeof import.meta.env !== "undefined";
export const PERF_TUNING_AVAILABLE = viteEnvironmentAvailable
    && (
        import.meta.env.DEV === true
        || import.meta.env.VITE_COSIMO_DEVELOPER_SETTINGS === "1"
    );

export type AutoPreviewAlgorithm = "shipped" | "morph" | "settle" | "wrap" | "paced";

export type PerfTuningState = {
    readonly algorithm: AutoPreviewAlgorithm;
    /** Rest (no changed edits) this long counts as settled. */
    readonly settleMs: number;
    /** Paced: minimum spacing between in-motion restrikes. */
    readonly minGapMs: number;
    /** How long a settled preview keeps looping before it releases. */
    readonly holdMs: number;
    /** Defer restrikes to the routed looping MSEG's grid (T12B). */
    readonly loopSync: boolean;
    readonly drag: ModSourceTouchTuning;
};

export const PERF_TUNING_DEFAULTS: PerfTuningState = {
    algorithm: "shipped",
    settleMs: 150,
    minGapMs: 250,
    holdMs: 4000,
    loopSync: true,
    drag: MOD_SOURCE_TOUCH_TUNING_DEFAULTS,
};

type PreviewTuningState = Omit<PerfTuningState, "drag">;
type ExportScalar = string | number | boolean;

function formatExportScalar(value: ExportScalar): string {
    return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function formatExportSection(
    title: string,
    pathPrefix: string,
    values: Readonly<Record<string, ExportScalar>>,
): ReadonlyArray<string> {
    return [
        `[${title}]`,
        ...Object.entries(values).map(([key, value]) => (
            `${pathPrefix}${key}: ${formatExportScalar(value)}`
        )),
    ];
}

/**
 * Formats every current Developer setting in deterministic source-field order.
 * The exhaustive `satisfies` projections make additions to the performance or
 * Mod-bar records fail type-checking until the export contract is updated.
 */
export function formatPerfTuningSettings(
    current: PerfTuningState,
    modBar: ModBarPreferences,
    keyboard: KeyboardPresentationPreferences,
): string {
    const previewValues = {
        algorithm: current.algorithm,
        settleMs: current.settleMs,
        minGapMs: current.minGapMs,
        holdMs: current.holdMs,
        loopSync: current.loopSync,
    } satisfies PreviewTuningState;
    const dragValues = {
        activationPx: current.drag.activationPx,
        rampPx: current.drag.rampPx,
        gainMin: current.drag.gainMin,
        gainMax: current.drag.gainMax,
        referenceTravelPx: current.drag.referenceTravelPx,
    } satisfies ModSourceTouchTuning;
    const modBarValues = {
        scale: modBar.scale,
        placement: modBar.placement,
        parkedVisibility: modBar.parkedVisibility,
    } satisfies ModBarPreferences;
    const keyboardValues = {
        visibleNoteCount: keyboard.visibleNoteCount,
        heightScale: keyboard.heightScale,
    } satisfies KeyboardPresentationPreferences;

    return [
        "Cosimo Developer settings",
        "",
        ...formatExportSection("Auto-preview algorithm", "", previewValues),
        "",
        ...formatExportSection("Mod drag feel", "drag.", dragValues),
        "",
        ...formatExportSection("Mod bar", "modBar.", modBarValues),
        "",
        ...formatExportSection("Keyboard", "keyboard.", keyboardValues),
    ].join("\n");
}

const STORAGE_KEY = "cosimo.perf-tuning.v1";
const ALGORITHMS: ReadonlyArray<AutoPreviewAlgorithm> = ["shipped", "morph", "settle", "wrap", "paced"];

type Listener = () => void;
const listeners = new Set<Listener>();
let state: PerfTuningState = PERF_TUNING_DEFAULTS;

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function sanitize(raw: unknown): PerfTuningState {
    const source = (raw ?? {}) as Partial<PerfTuningState> & { drag?: Partial<ModSourceTouchTuning> };
    const drag: Partial<ModSourceTouchTuning> = source.drag ?? {};
    const algorithm = ALGORITHMS.includes(source.algorithm as AutoPreviewAlgorithm)
        ? source.algorithm as AutoPreviewAlgorithm
        : PERF_TUNING_DEFAULTS.algorithm;

    return {
        algorithm,
        settleMs: boundedNumber(source.settleMs, PERF_TUNING_DEFAULTS.settleMs, 40, 800),
        minGapMs: boundedNumber(source.minGapMs, PERF_TUNING_DEFAULTS.minGapMs, 80, 1200),
        holdMs: boundedNumber(source.holdMs, PERF_TUNING_DEFAULTS.holdMs, 500, 20000),
        loopSync: source.loopSync !== false,
        drag: {
            activationPx: boundedNumber(drag.activationPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.activationPx, 0, 40),
            referenceTravelPx: boundedNumber(drag.referenceTravelPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.referenceTravelPx, 40, 800),
            gainMin: boundedNumber(drag.gainMin, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.gainMin, 1, 6),
            gainMax: boundedNumber(drag.gainMax, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.gainMax, 1, 6),
            rampPx: boundedNumber(drag.rampPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.rampPx, 8, 400),
        },
    };
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage may be unavailable; tuning simply resets on reload.
    }
}

function applyDragTuning(): void {
    setModSourceTouchTuning(state.drag);
}

function hydrate(): void {
    if (!PERF_TUNING_AVAILABLE) {
        return;
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            state = sanitize(JSON.parse(stored));
        }
    } catch {
        state = PERF_TUNING_DEFAULTS;
    }
    applyDragTuning();
}
hydrate();

export function getPerfTuningState(): PerfTuningState {
    return state;
}

export function subscribePerfTuning(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function updatePerfTuning(
    next: Partial<Omit<PerfTuningState, "drag">> & { drag?: Partial<ModSourceTouchTuning> },
): void {
    state = sanitize({
        ...state,
        ...next,
        drag: { ...state.drag, ...(next.drag ?? {}) },
    });
    applyDragTuning();
    persist();
    for (const listener of listeners) {
        listener();
    }
}

export function resetPerfTuningDrag(): void {
    updatePerfTuning({ drag: MOD_SOURCE_TOUCH_TUNING_DEFAULTS });
}

export function resetPerfTuningPreview(): void {
    updatePerfTuning({
        algorithm: PERF_TUNING_DEFAULTS.algorithm,
        settleMs: PERF_TUNING_DEFAULTS.settleMs,
        minGapMs: PERF_TUNING_DEFAULTS.minGapMs,
        holdMs: PERF_TUNING_DEFAULTS.holdMs,
        loopSync: PERF_TUNING_DEFAULTS.loopSync,
    });
}
