import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";
import {
    PatchConnectionProvider,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import type { ResourceClient } from "../shared/resource-client";
import type { PatchControlBinding } from "../shared/patch-controls";
import {
    type SynthFocusBindings,
} from "../shared/synth-input-router";
import {
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    clampMsegRateSeconds,
    type MsegState,
} from "../shared/mseg";
import {
    EditableMsegSurface,
    FilterResponseGraph,
    KeyboardSectionShell,
    ModulationAmountField,
    MsegPreview,
    RangeField,
    VOICE_MODE_OPTIONS,
    VoiceGlideControlSurface,
    WavetableStageSection,
} from "../shared/synth-components";
import {
    KeyboardDock,
    type PianoKeyboardElement,
} from "./desktop-keyboard-adapter";
import { NexusNumberField } from "./desktop-nexus-number-field";
import { PrecisionNumberField } from "./desktop-precision-number-field";
import { useDesktopCurveLab } from "./desktop-curve-lab";
import {
    useSynthPatchViewModel,
} from "../shared/synth-hooks";
import {
    FILTER_SPECTRUM_RENDER_MODE_OPTIONS,
    cycleFilterSpectrumRenderMode,
    type FilterSpectrumRenderMode,
} from "../shared/filter-spectrum";
import {
    FILTER_CUTOFF_MAX_HZ,
    FILTER_CUTOFF_MIN_HZ,
    FILTER_Q_MAX,
    FILTER_Q_MIN,
    filterCutoffHzToNormalized,
    filterQToNormalized,
    normalizedToFilterCutoffHz,
    normalizedToFilterQ,
} from "../shared/filter-response";
import {
    clampModulationRouteAmount,
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MAX_ROUTES,
    MODULATION_MSEG_SLOT_COUNT,
    type ModulationRoute,
    type ModulationSourceKind,
    type ModulationTargetKind,
} from "../shared/modulation";

const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const GLIDE_TIME_MIN_SECONDS = 0;
const GLIDE_TIME_MAX_SECONDS = 2;
const GLIDE_TIME_STEP_SECONDS = 0.001;
const WARP_MODE_OPTIONS = [
    { value: 0, label: "Off" },
    { value: 1, label: "Bend +/-" },
    { value: 2, label: "PWM" },
    { value: 3, label: "Asym +/-" },
    { value: 4, label: "Mirror" },
] as const;
const FILTER_MODE_OPTIONS = [
    { value: 0, label: "Off" },
    { value: 1, label: "Lowpass" },
    { value: 2, label: "Highpass" },
    { value: 3, label: "Bandpass" },
    { value: 4, label: "Notch" },
    { value: 5, label: "Peak" },
] as const;
const MOD_SOURCE_OPTIONS: Array<{ value: ModulationSourceKind; label: string }> = [
    { value: "mseg", label: "MSEG" },
    { value: "env", label: "Envelope" },
    { value: "velocity", label: "Velocity" },
    { value: "pressure", label: "Aftertouch" },
    { value: "slide", label: "Slide" },
];
const MOD_TARGET_OPTIONS: Array<{ value: ModulationTargetKind; label: string }> = [
    { value: "wavetablePosition", label: "Wavetable Pos" },
    { value: "warpAmount", label: "Warp Amount" },
    { value: "filterCutoffOctaves", label: "Filter Cutoff" },
    { value: "filterQ", label: "Filter Q" },
    { value: "pitchSemitones", label: "Pitch" },
    { value: "ampGainDb", label: "Amp" },
    { value: "pan", label: "Pan" },
];

type HeaderProps = {
    statusText: string;
};

type VoiceGlideSectionProps = {
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
};

type FilterSectionProps = {
    filterMode: PatchControlBinding<number>;
    filterCutoff: PatchControlBinding<number>;
    filterQ: PatchControlBinding<number>;
    observedFilterState: {
        hasActive: boolean;
        mode: number;
        cutoffHz: number;
        q: number;
    };
    observedFilterSpectrum: {
        sampleRateHz: number;
        magnitudes: number[];
    } | null;
    resonanceNormalizedFromQ: (qValue: number) => number;
    resonanceQFromSurface: (surfaceValue: number) => number;
    resonanceCurveDebugState: {
        familyId: string;
        coefficients: Record<string, number>;
    };
    className?: string;
};

type MsegEditorModalProps = {
    isOpen: boolean;
    slotLabel: string;
    msegState: MsegState | null;
    surfaceRef: RefObject<SVGSVGElement | null>;
    selectedPointIndex: number;
    hoveredSegmentIndex: number;
    activeSegmentIndex: number;
    onClose: () => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    rateFocusBindings: SynthFocusBindings;
};

type ModulationMatrixSectionProps = {
    pan: PatchControlBinding<number>;
    selectedMsegSlot: number;
    msegState: MsegState | null;
    selectedEnvelopeSlot: number;
    selectedEnvelope: {
        attackSeconds: number;
        decaySeconds: number;
        sustain: number;
        releaseSeconds: number;
    } | null;
    routes: ModulationRoute[];
    onSelectMsegSlot: (slotIndex: number) => void;
    onOpenMsegEditor: () => void;
    onMsegRateChange: (nextValue: number) => void;
    onToggleMsegLoop: () => void;
    onSelectEnvelopeSlot: (slotIndex: number) => void;
    onEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, nextRoute: ModulationRoute) => void;
    msegRateFocusBindings: SynthFocusBindings;
};

function formatSeconds(seconds: number) {
    return `${seconds.toFixed(3)} s`;
}

function formatKeyboardRootLabel(rootNote: number) {
    const octave = Math.floor(rootNote / 12) - 1;
    return `C${octave}`;
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function formatSignedPercent(value: number) {
    const percentValue = Math.round(value * 100);
    return `${percentValue > 0 ? "+" : ""}${percentValue}%`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatSignedOctaves(value: number) {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)} oct`;
}

function cycleWarpMode(currentMode: number) {
    const currentIndex = WARP_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % WARP_MODE_OPTIONS.length
        : 0;
    return WARP_MODE_OPTIONS[nextIndex]?.value ?? WARP_MODE_OPTIONS[0].value;
}

function getWarpModeLabel(mode: number) {
    return WARP_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Off";
}

function cycleFilterMode(currentMode: number) {
    const currentIndex = FILTER_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % FILTER_MODE_OPTIONS.length
        : 0;
    return FILTER_MODE_OPTIONS[nextIndex]?.value ?? FILTER_MODE_OPTIONS[0].value;
}

function getFilterModeLabel(mode: number) {
    return FILTER_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Off";
}

function getFilterSpectrumRenderModeLabel(mode: FilterSpectrumRenderMode) {
    return FILTER_SPECTRUM_RENDER_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Graph";
}

function formatCutoffDisplay(value: number) {
    const safeValue = Math.min(Math.max(Number(value) || FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MIN_HZ), FILTER_CUTOFF_MAX_HZ);

    if (safeValue >= 10_000) {
        return `${(safeValue / 1000).toFixed(1)}k`;
    }

    if (safeValue >= 1000) {
        return `${(safeValue / 1000).toFixed(2)}k`;
    }

    return `${Math.round(safeValue)}`;
}

function formatCutoffEditingValue(value: number) {
    return `${Math.round(Math.min(Math.max(Number(value) || FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MIN_HZ), FILTER_CUTOFF_MAX_HZ))}`;
}

function parseCutoffInput(text: string) {
    const normalizedText = String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(/,/g, "")
        .replace(/\s+/g, "");

    if (!normalizedText) {
        return null;
    }

    const match = normalizedText.match(/^(-?\d*\.?\d+)(k|khz|hz)?$/);

    if (!match) {
        return null;
    }

    const numericValue = Number(match[1]);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return match[2]?.startsWith("k") ? numericValue * 1000 : numericValue;
}

function formatResonanceDisplay(value: number) {
    const safeValue = Math.min(Math.max(Number(value) || FILTER_Q_MIN, FILTER_Q_MIN), FILTER_Q_MAX);
    return safeValue.toFixed(safeValue >= 10 ? 1 : 2);
}

function parseResonanceInput(text: string) {
    const normalizedText = String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(/q/g, "");

    if (!normalizedText) {
        return null;
    }

    const numericValue = Number(normalizedText);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function WarpModeGlyph({ mode }: { mode: number }) {
    switch (mode) {
        case 1:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 17.5 8.5 7 12 17.5 15.5 7 20 17.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 2:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 16V8L8 8V16L12 16V8L16 8V16L20 16V8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 3:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 16.5C7 16.5 8 6.5 11 6.5C14 6.5 15 17.5 18 17.5C19.5 17.5 20.3 14.5 20 8.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 4:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 17L10.5 7L13.5 12L20 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <path d="M4 7L10.5 17L13.5 12L20 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" opacity="0.8" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M3 12H21" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
    }
}

function FilterModeGlyph({ mode }: { mode: number }) {
    switch (mode) {
        case 1:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 7.5H9.5C12.5 7.5 15.5 9 16.5 12.5L18.5 19"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case 2:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 18.5L5.5 15.5C7.5 12.5 9.5 8.5 13 7.5H21"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case 3:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 18.5C6.5 18.5 8 18 9.5 14.5C11 11 11.5 8 12 8C12.5 8 13 11 14.5 14.5C16 18 17.5 18.5 21 18.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case 4:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 8.5C8 8.5 9 8.5 10.5 13.5C11.25 16 11.75 17.5 12 17.5C12.25 17.5 12.75 16 13.5 13.5C15 8.5 16 8.5 21 8.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case 5:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 18.5C8 18.5 9 18 10.5 12C11.3 8 11.8 5.5 12 5.5C12.2 5.5 12.7 8 13.5 12C15 18 16 18.5 21 18.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path
                        d="M3 12H21"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
    }
}

function FilterSpectrumModeGlyph({ mode }: { mode: FilterSpectrumRenderMode }) {
    if (mode === "bars") {
        return (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                <rect x="4" y="12" width="3" height="7" fill="currentColor" />
                <rect x="10.5" y="8" width="3" height="11" fill="currentColor" />
                <rect x="17" y="5" width="3" height="14" fill="currentColor" />
            </svg>
        );
    }

    if (mode === "round-bars") {
        return (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                <rect x="4" y="12" width="3.2" height="7" rx="1.6" fill="currentColor" />
                <rect x="10.4" y="8" width="3.2" height="11" rx="1.6" fill="currentColor" />
                <rect x="16.8" y="5" width="3.2" height="14" rx="1.6" fill="currentColor" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
            <path
                d="M4 16.5L8.5 13L12 9.5L15 11.5L20 6.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
            />
        </svg>
    );
}

function OverlayIconChip({
    ariaLabel,
    title,
    onClick,
    children,
}: {
    ariaLabel: string;
    title: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            title={title}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:border-cyan-200/30 hover:text-cyan-100"
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function StatusHeader({ statusText }: HeaderProps) {
    return (
        <header className="flex items-center justify-between gap-4">
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-blue-300/70">
                Cosimo Synth
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-right text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/80">
                {statusText}
            </div>
        </header>
    );
}

function FilterSection({
    filterMode,
    filterCutoff,
    filterQ,
    observedFilterState,
    observedFilterSpectrum,
    resonanceNormalizedFromQ,
    resonanceQFromSurface,
    resonanceCurveDebugState,
    className,
}: FilterSectionProps) {
    const [spectrumRenderMode, setSpectrumRenderMode] = useState<FilterSpectrumRenderMode>("graph");

    return (
        <section
            data-role="filter-card"
            className={`relative min-h-0 overflow-hidden rounded-[28px] border border-white/[0.04] bg-[radial-gradient(circle_at_top,rgba(93,173,255,0.14),transparent_34%),linear-gradient(180deg,rgba(6,10,22,0.98),rgba(2,4,11,1))] ${className ?? ""}`}
        >
            <div className="absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-64px_80px_rgba(0,0,0,0.34)]" />

            <div className="absolute inset-0 p-3">
                <FilterResponseGraph
                    baseMode={filterMode.value}
                    baseCutoffHz={filterCutoff.value}
                    baseQ={filterQ.value}
                    liveMode={observedFilterState.mode}
                    liveCutoffHz={observedFilterState.cutoffHz}
                    liveQ={observedFilterState.q}
                    liveHasActive={observedFilterState.hasActive}
                    spectrumFrame={observedFilterSpectrum}
                    spectrumRenderMode={spectrumRenderMode}
                    resonanceNormalizedFromQ={resonanceNormalizedFromQ}
                    resonanceQFromSurface={resonanceQFromSurface}
                    resonanceCurveDebugState={resonanceCurveDebugState}
                    onGestureStart={() => {
                        filterCutoff.beginGesture();
                        filterQ.beginGesture();
                    }}
                    onGestureEnd={() => {
                        filterCutoff.endGesture();
                        filterQ.endGesture();
                    }}
                    onCutoffSet={(nextValue) => filterCutoff.setValue(nextValue)}
                    onQSet={(nextValue) => filterQ.setValue(nextValue)}
                    className="h-full w-full"
                />
            </div>

            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
                <OverlayIconChip
                    ariaLabel={`Cycle filter mode (currently ${getFilterModeLabel(filterMode.value)})`}
                    title={`Filter mode: ${getFilterModeLabel(filterMode.value)}`}
                    onClick={() => filterMode.commitValue(cycleFilterMode(filterMode.value))}
                >
                    <FilterModeGlyph mode={filterMode.value} />
                </OverlayIconChip>

                <OverlayIconChip
                    ariaLabel={`Cycle analyzer view (currently ${getFilterSpectrumRenderModeLabel(spectrumRenderMode)})`}
                    title={`Analyzer view: ${getFilterSpectrumRenderModeLabel(spectrumRenderMode)}`}
                    onClick={() => setSpectrumRenderMode((previousMode) => cycleFilterSpectrumRenderMode(previousMode))}
                >
                    <FilterSpectrumModeGlyph mode={spectrumRenderMode} />
                </OverlayIconChip>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-3">
                <div className="pointer-events-auto">
                    <PrecisionNumberField
                        ariaLabel="Filter cutoff"
                        binding={filterCutoff}
                        min={FILTER_CUTOFF_MIN_HZ}
                        max={FILTER_CUTOFF_MAX_HZ}
                        step={1}
                        formatDisplay={formatCutoffDisplay}
                        formatEditingValue={formatCutoffEditingValue}
                        parseText={parseCutoffInput}
                        normalizedFromValue={filterCutoffHzToNormalized}
                        valueFromNormalized={normalizedToFilterCutoffHz}
                        pixelsPerFullRange={220}
                        dataRole="filter-cutoff-field"
                        width={122}
                        height={40}
                    />
                </div>
                <div className="pointer-events-auto">
                    <PrecisionNumberField
                        ariaLabel="Filter resonance"
                        binding={filterQ}
                        min={FILTER_Q_MIN}
                        max={FILTER_Q_MAX}
                        step={0.01}
                        formatDisplay={formatResonanceDisplay}
                        parseText={parseResonanceInput}
                        normalizedFromValue={resonanceNormalizedFromQ}
                        valueFromNormalized={resonanceQFromSurface}
                        pixelsPerFullRange={180}
                        dataRole="filter-resonance-field"
                        width={92}
                        height={40}
                    />
                </div>
            </div>

            <div className="sr-only">
                <label>
                    Filter mode
                    <select
                        aria-label="Filter mode"
                        value={String(filterMode.value)}
                        onChange={(event) => filterMode.commitValue(Number(event.target.value))}
                    >
                        {FILTER_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </section>
    );
}

function KeyboardToolbar({
    playMode,
    glideTime,
    playModeFocusBindings,
    glideFocusTarget,
}: VoiceGlideSectionProps & {
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
}) {
    return (
        <VoiceGlideControlSurface
            playModeValue={playMode.value}
            onPlayModeChange={(nextValue) => playMode.commitValue(nextValue)}
            playModeFocusBindings={playModeFocusBindings}
            className="grid-cols-[minmax(0,1fr)_auto] items-end"
            glideControl={(
                <NexusNumberField
                    label="Glide"
                    binding={glideTime}
                    min={GLIDE_TIME_MIN_SECONDS}
                    max={GLIDE_TIME_MAX_SECONDS}
                    step={GLIDE_TIME_STEP_SECONDS}
                    onActivate={glideFocusTarget.onActivate}
                    onBeginTextEntry={glideFocusTarget.onBeginTextEntry}
                    onEndTextEntry={glideFocusTarget.onEndTextEntry}
                />
            )}
        />
    );
}

function KeyboardSection({
    playMode,
    glideTime,
    keyboardRootNote,
    onOctaveDown,
    onOctaveUp,
    playModeFocusBindings,
    glideFocusTarget,
    keyboardRef,
}: VoiceGlideSectionProps & {
    keyboardRootNote: number;
    onOctaveDown: () => void;
    onOctaveUp: () => void;
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
    keyboardRef: RefObject<PianoKeyboardElement | null>;
}) {
    return (
        <KeyboardSectionShell
            keyboardRootLabel={formatKeyboardRootLabel(keyboardRootNote)}
            canOctaveUp={keyboardRootNote < KEYBOARD_ROOT_NOTE_MAX}
            canOctaveDown={keyboardRootNote > KEYBOARD_ROOT_NOTE_MIN}
            onOctaveUp={onOctaveUp}
            onOctaveDown={onOctaveDown}
            className="grid-cols-[56px_minmax(0,1fr)]"
            railClassName="px-2 py-3"
            toolbar={(
                <KeyboardToolbar
                    playMode={playMode}
                    glideTime={glideTime}
                    playModeFocusBindings={playModeFocusBindings}
                    glideFocusTarget={glideFocusTarget}
                />
            )}
            keyboard={<KeyboardDock rootNote={keyboardRootNote} keyboardRef={keyboardRef} />}
        />
    );
}

function MsegEditorModal({
    isOpen,
    slotLabel,
    msegState,
    surfaceRef,
    selectedPointIndex,
    hoveredSegmentIndex,
    activeSegmentIndex,
    onClose,
    onRateChange,
    onToggleLoop,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    rateFocusBindings,
}: MsegEditorModalProps) {
    if (!isOpen || !msegState) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#030711]/85 p-6 backdrop-blur-md">
            <div className="grid h-full w-full max-w-[1080px] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 rounded-[28px] border border-white/10 bg-[#09101d]/95 p-6 shadow-[0_36px_80px_rgba(0,0,0,0.5)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">{slotLabel}</div>
                        <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-amber-100">Modulation Shape Editor</div>
                        <div className="mt-2 text-sm text-slate-300/70">Drag a point to move it. Click and drag a segment up or down to bend it. Click an empty spot to add a point. Click an interior point without dragging to delete it.</div>
                    </div>
                    <button
                        type="button"
                        className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>

                <EditableMsegSurface
                    surfaceRef={surfaceRef}
                    points={msegState.shape.points}
                    selectedPointIndex={selectedPointIndex}
                    hoveredSegmentIndex={hoveredSegmentIndex}
                    activeSegmentIndex={activeSegmentIndex}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                    onPointerUp={onPointerUp}
                    className="h-[320px]"
                    dataRole="mseg-editor-surface"
                />

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                    <RangeField
                        label="Time In Seconds"
                        min={MSEG_RATE_MIN_SECONDS}
                        max={MSEG_RATE_MAX_SECONDS}
                        step={0.001}
                        value={clampMsegRateSeconds(msegState.playback.rate.seconds)}
                        displayValue={formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                        onChange={onRateChange}
                        ariaLabel="MSEG rate"
                        focusBindings={rateFocusBindings}
                    />

                    <div className="flex items-center gap-3">
                        <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                            {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                        </div>
                        <button
                            type="button"
                            className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                            onClick={onToggleLoop}
                        >
                            {msegState.playback.loop ? "Looping" : "One Shot"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModulationMatrixSection({
    pan,
    selectedMsegSlot,
    msegState,
    selectedEnvelopeSlot,
    selectedEnvelope,
    routes,
    onSelectMsegSlot,
    onOpenMsegEditor,
    onMsegRateChange,
    onToggleMsegLoop,
    onSelectEnvelopeSlot,
    onEnvelopeChange,
    onAddRoute,
    onRemoveRoute,
    onRouteChange,
    msegRateFocusBindings,
}: ModulationMatrixSectionProps) {
    const routeRowRefs = useRef<Array<HTMLDivElement | null>>([]);
    const pendingRouteScrollIndexRef = useRef<number | null>(null);

    useEffect(() => {
        const pendingRouteIndex = pendingRouteScrollIndexRef.current;

        if (pendingRouteIndex === null || pendingRouteIndex >= routes.length) {
            return;
        }

        pendingRouteScrollIndexRef.current = null;
        const nextRouteElement = routeRowRefs.current[pendingRouteIndex];

        if (!nextRouteElement) {
            return;
        }

        window.requestAnimationFrame(() => {
            nextRouteElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
            });
        });
    }, [routes.length]);

    const handleAddRouteClick = useCallback(() => {
        if (routes.length >= MODULATION_MAX_ROUTES) {
            return;
        }

        pendingRouteScrollIndexRef.current = routes.length;
        onAddRoute();
    }, [onAddRoute, routes.length]);

    return (
        <section className="grid gap-4 rounded-[22px] border border-white/[0.05] bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/70">Modulation</div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="grid gap-3 rounded-[20px] bg-black/16 p-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">MSEG Slots</div>
                        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] p-1">
                            {Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => (
                                <button
                                    key={`mseg-slot-${slotIndex + 1}`}
                                    type="button"
                                    aria-label={`Select MSEG ${slotIndex + 1}`}
                                    className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                                        selectedMsegSlot === slotIndex
                                            ? "bg-cyan-300/18 text-cyan-100"
                                            : "text-slate-300/65 hover:text-slate-100"
                                    }`}
                                    onClick={() => onSelectMsegSlot(slotIndex)}
                                >
                                    {`MSEG ${slotIndex + 1}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="grid gap-3 rounded-[18px] bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.05]"
                        onClick={onOpenMsegEditor}
                        aria-label="Open MSEG editor"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/55">{`MSEG ${selectedMsegSlot + 1}`}</div>
                                <div className="mt-1 text-sm font-medium text-slate-100">Open Shape Editor</div>
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/75">
                                {msegState?.playback.loop ? "Loop" : "One Shot"}
                            </div>
                        </div>
                        {msegState ? (
                            <MsegPreview
                                points={msegState.shape.points}
                                className="h-24 w-full overflow-hidden rounded-[18px] bg-white/[0.03]"
                            />
                        ) : (
                            <div className="h-24 rounded-[18px] bg-white/[0.03]" />
                        )}
                    </button>

                    <RangeField
                        label="Rate"
                        min={MSEG_RATE_MIN_SECONDS}
                        max={MSEG_RATE_MAX_SECONDS}
                        step={0.001}
                        value={clampMsegRateSeconds(Number(msegState?.playback.rate.seconds ?? 1))}
                        displayValue={formatSeconds(Number(msegState?.playback.rate.seconds ?? 1))}
                        onChange={onMsegRateChange}
                        ariaLabel="MSEG rate"
                        focusBindings={msegRateFocusBindings}
                    />

                    <button
                        type="button"
                        className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                        onClick={onToggleMsegLoop}
                        aria-label={msegState?.playback.loop ? "Looping" : "One Shot"}
                    >
                        {msegState?.playback.loop ? "Looping" : "One Shot"}
                    </button>
                </div>

                <div className="grid gap-3 rounded-[20px] bg-black/16 p-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Envelope Slots</div>
                        <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] p-1">
                            {Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                                <button
                                    key={`env-slot-${slotIndex + 1}`}
                                    type="button"
                                    aria-label={`Select envelope ${slotIndex + 1}`}
                                    className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                                        selectedEnvelopeSlot === slotIndex
                                            ? "bg-emerald-300/18 text-emerald-100"
                                            : "text-slate-300/65 hover:text-slate-100"
                                    }`}
                                    onClick={() => onSelectEnvelopeSlot(slotIndex)}
                                >
                                    {`Env ${slotIndex + 1}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <RangeField
                        label="Pan"
                        min={-1}
                        max={1}
                        step={0.001}
                        value={pan.value}
                        displayValue={formatSignedPercent(pan.value)}
                        onChange={(nextValue) => pan.commitValue(nextValue)}
                        ariaLabel="Pan"
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                        <RangeField
                            label="Attack"
                            min={0.001}
                            max={10}
                            step={0.001}
                            value={Number(selectedEnvelope?.attackSeconds ?? 0.01)}
                            displayValue={formatSeconds(Number(selectedEnvelope?.attackSeconds ?? 0.01))}
                            onChange={(nextValue) => onEnvelopeChange("attackSeconds", nextValue)}
                            ariaLabel="Envelope attack"
                        />
                        <RangeField
                            label="Decay"
                            min={0.001}
                            max={10}
                            step={0.001}
                            value={Number(selectedEnvelope?.decaySeconds ?? 0.25)}
                            displayValue={formatSeconds(Number(selectedEnvelope?.decaySeconds ?? 0.25))}
                            onChange={(nextValue) => onEnvelopeChange("decaySeconds", nextValue)}
                            ariaLabel="Envelope decay"
                        />
                        <RangeField
                            label="Sustain"
                            min={0}
                            max={1}
                            step={0.001}
                            value={Number(selectedEnvelope?.sustain ?? 0.5)}
                            displayValue={formatPercent(Number(selectedEnvelope?.sustain ?? 0.5))}
                            onChange={(nextValue) => onEnvelopeChange("sustain", nextValue)}
                            ariaLabel="Envelope sustain"
                        />
                        <RangeField
                            label="Release"
                            min={0.001}
                            max={10}
                            step={0.001}
                            value={Number(selectedEnvelope?.releaseSeconds ?? 0.2)}
                            displayValue={formatSeconds(Number(selectedEnvelope?.releaseSeconds ?? 0.2))}
                            onChange={(nextValue) => onEnvelopeChange("releaseSeconds", nextValue)}
                            ariaLabel="Envelope release"
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Route Rows</div>
                    <button
                        type="button"
                        aria-label="Add route"
                        className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                        onClick={handleAddRouteClick}
                    >
                        Add Route
                    </button>
                </div>
                {routes.length > 0 ? (
                    <div className="grid grid-cols-[minmax(0,1.1fr)_84px_minmax(0,1.2fr)_minmax(290px,auto)_44px] items-center gap-3 px-3 text-[9px] uppercase tracking-[0.18em] text-slate-300/45">
                        <div>Source</div>
                        <div>Slot</div>
                        <div>Target</div>
                        <div className="justify-self-end">Depth</div>
                        <div />
                    </div>
                ) : null}
                {routes.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-black/10 px-4 py-5 text-sm text-slate-300/60">
                        No routes yet. Add one and choose a source, target, and depth.
                    </div>
                ) : routes.map((route, routeIndex) => {
                    const needsSlot = route.sourceKind === "mseg" || route.sourceKind === "env";
                    const maxSlot = route.sourceKind === "mseg" ? MODULATION_MSEG_SLOT_COUNT : MODULATION_ENV_SLOT_COUNT;

                    return (
                        <div
                            key={`route-${routeIndex}`}
                            ref={(element) => {
                                routeRowRefs.current[routeIndex] = element;
                            }}
                            data-role={`route-row-${routeIndex + 1}`}
                            className="grid items-center gap-3 rounded-[18px] bg-black/15 p-3 xl:grid-cols-[minmax(0,1.1fr)_84px_minmax(0,1.2fr)_minmax(290px,auto)_44px]"
                        >
                            <select
                                aria-label={`Route ${routeIndex + 1} source`}
                                className="h-11 rounded-[14px] border border-white/8 bg-black/25 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-100 outline-none"
                                value={route.sourceKind}
                                onChange={(event) => {
                                    const nextSourceKind = event.target.value as ModulationSourceKind;
                                    onRouteChange(routeIndex, {
                                        ...route,
                                        sourceKind: nextSourceKind,
                                        sourceSlot: nextSourceKind === "mseg" || nextSourceKind === "env" ? 1 : null,
                                    });
                                }}
                            >
                                {MOD_SOURCE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>

                            {needsSlot ? (
                                <select
                                    aria-label={`Route ${routeIndex + 1} slot`}
                                    className="h-11 rounded-[14px] border border-white/8 bg-black/25 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-100 outline-none"
                                    value={String(route.sourceSlot ?? 1)}
                                    onChange={(event) => {
                                        onRouteChange(routeIndex, {
                                            ...route,
                                            sourceSlot: Number(event.target.value),
                                        });
                                    }}
                                >
                                    {Array.from({ length: maxSlot }, (_, slotIndex) => (
                                        <option key={`route-slot-${routeIndex}-${slotIndex + 1}`} value={String(slotIndex + 1)}>
                                            {slotIndex + 1}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex h-11 items-center justify-center rounded-[14px] border border-dashed border-white/8 bg-black/10 text-[10px] uppercase tracking-[0.18em] text-slate-400/75">
                                    Direct
                                </div>
                            )}

                            <select
                                aria-label={`Route ${routeIndex + 1} target`}
                                className="h-11 rounded-[14px] border border-white/8 bg-black/25 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-100 outline-none"
                                value={route.targetKind}
                                onChange={(event) => {
                                    const nextTargetKind = event.target.value as ModulationTargetKind;
                                    onRouteChange(routeIndex, {
                                        ...route,
                                        targetKind: nextTargetKind,
                                        amount: clampModulationRouteAmount(nextTargetKind, route.amount),
                                    });
                                }}
                            >
                                {MOD_TARGET_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>

                            <div className="justify-self-end">
                                <ModulationAmountField
                                    targetKind={route.targetKind}
                                    amount={route.amount}
                                    knobAriaLabel={`Route ${routeIndex + 1} depth`}
                                    positiveDirectionAriaLabel={`Route ${routeIndex + 1} positive direction`}
                                    negativeDirectionAriaLabel={`Route ${routeIndex + 1} negative direction`}
                                    onChange={(nextAmount) => {
                                        onRouteChange(routeIndex, {
                                            ...route,
                                            amount: nextAmount,
                                        });
                                    }}
                                />
                            </div>

                            <button
                                type="button"
                                aria-label={`Remove route ${routeIndex + 1}`}
                                className="cosimo-button h-11 w-11 self-center rounded-2xl px-0 text-lg leading-none"
                                onClick={() => onRemoveRoute(routeIndex)}
                            >
                                x
                            </button>
                        </div>
                    );
                })}
                <div className="text-[11px] text-slate-300/55">
                    Depth shows the movement this row asks for at full source. Position, warp, cutoff, Q, amp, and pan still stop at the synth&apos;s real limits.
                </div>
            </div>
        </section>
    );
}

function DesktopPatchViewBody() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const curveLab = useDesktopCurveLab();
    const synthView = useSynthPatchViewModel({
        stageRef,
        msegEditorSurfaceRef,
        keyboardRef: keyboardElementRef,
        voiceModeCount: VOICE_MODE_OPTIONS.length,
    });
    const filterResonanceCurveProfile = curveLab.getProfile("filter-resonance-handle");
    const resonanceNormalizedFromQ = useCallback((qValue: number) => (
        curveLab.invertTarget("filter-resonance-handle", filterQToNormalized(qValue))
    ), [curveLab]);
    const resonanceQFromSurface = useCallback((surfaceValue: number) => (
        normalizedToFilterQ(curveLab.evaluateTarget("filter-resonance-handle", surfaceValue))
    ), [curveLab]);

    const handleKeyboardOctaveDown = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => Math.min(Math.max(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN), KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleKeyboardOctaveUp = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => Math.min(Math.max(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN), KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const warpModeChip = useMemo(() => (
        <OverlayIconChip
            ariaLabel={`Cycle warp mode (currently ${getWarpModeLabel(synthView.warpMode.value)})`}
            title={`Warp mode: ${getWarpModeLabel(synthView.warpMode.value)}`}
            onClick={() => synthView.warpMode.commitValue(cycleWarpMode(synthView.warpMode.value))}
        >
            <WarpModeGlyph mode={synthView.warpMode.value} />
        </OverlayIconChip>
    ), [synthView.warpMode]);

    const warpAmountField = useMemo(() => (
        <NexusNumberField
            label="Warp amount"
            binding={synthView.warpAmount}
            min={0}
            max={1}
            step={0.001}
            decimalPlaces={3}
            suffix={null}
            variant="overlay"
            showLabel={false}
            width={116}
            height={40}
        />
    ), [synthView.warpAmount]);

    return (
        <div className="cosimo-surface relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-[28px] border border-white/[0.05] p-5 text-slate-100 shadow-[0_26px_80px_rgba(0,0,0,0.48)]">
            <StatusHeader statusText={synthView.topStatus} />

            <main
                data-role="desktop-scroll-region"
                className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-x-hidden overflow-y-auto pr-1"
            >
                <section className="grid min-h-0 items-stretch gap-4 md:grid-cols-2">
                    <WavetableStageSection
                        stageRef={stageRef}
                        frames={synthView.frames}
                        position={synthView.observedPosition}
                        warpMode={synthView.observedWarpState.hasActive ? synthView.observedWarpState.mode : synthView.warpMode.value}
                        warpAmount={synthView.observedWarpState.hasActive ? synthView.observedWarpState.amount : synthView.warpAmount.value}
                        tableName={synthView.displayedTableName}
                        frameCount={synthView.displayedFrameCount}
                        desiredTableIndex={synthView.desiredTableIndex}
                        tableOptions={synthView.tableOptions}
                        canRetry={synthView.canRetryDesiredTableLoad}
                        onTableChange={synthView.handleSelectWavetable}
                        onRetry={synthView.handleRetryLoad}
                        tableFocusBindings={synthView.keyboardRouting.wavetableFocusBindings}
                        onPointerDown={synthView.stageBindings.handleStagePointerDown}
                        onPointerMove={synthView.stageBindings.handleStagePointerMove}
                        onPointerUp={synthView.stageBindings.handleStagePointerUp}
                        bottomLeftAccessory={warpModeChip}
                        bottomRightAccessory={warpAmountField}
                        className="aspect-square min-h-[320px]"
                    />

                    <FilterSection
                        filterMode={synthView.filterMode}
                        filterCutoff={synthView.filterCutoff}
                        filterQ={synthView.filterQ}
                        observedFilterState={synthView.observedFilterState}
                        observedFilterSpectrum={synthView.observedFilterSpectrum}
                        resonanceNormalizedFromQ={resonanceNormalizedFromQ}
                        resonanceQFromSurface={resonanceQFromSurface}
                        resonanceCurveDebugState={filterResonanceCurveProfile}
                        className="aspect-square min-h-[320px]"
                    />
                </section>

                {synthView.failureDetail ? (
                    <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                        {synthView.failureDetail}
                    </div>
                ) : null}

                <ModulationMatrixSection
                    pan={synthView.pan}
                    selectedMsegSlot={synthView.selectedMsegSlot}
                    msegState={synthView.msegState}
                    selectedEnvelopeSlot={synthView.selectedEnvelopeSlot}
                    selectedEnvelope={synthView.selectedEnvelope}
                    routes={synthView.routes}
                    onSelectMsegSlot={synthView.handleSelectMsegSlot}
                    onOpenMsegEditor={synthView.msegEditor.openEditor}
                    onMsegRateChange={synthView.handleMsegRateChange}
                    onToggleMsegLoop={synthView.handleToggleMsegLoop}
                    onSelectEnvelopeSlot={synthView.handleSelectEnvelopeSlot}
                    onEnvelopeChange={synthView.handleEnvelopeChange}
                    onAddRoute={synthView.handleAddRoute}
                    onRemoveRoute={synthView.handleRemoveRoute}
                    onRouteChange={synthView.handleRouteChange}
                    msegRateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
                />

                <KeyboardSection
                    playMode={synthView.playMode}
                    glideTime={synthView.glideTime}
                    keyboardRootNote={keyboardRootNote}
                    onOctaveDown={handleKeyboardOctaveDown}
                    onOctaveUp={handleKeyboardOctaveUp}
                    playModeFocusBindings={synthView.keyboardRouting.playModeFocusBindings}
                    glideFocusTarget={synthView.keyboardRouting.glideFocusTarget}
                    keyboardRef={keyboardElementRef}
                />
            </main>

            <MsegEditorModal
                isOpen={synthView.msegEditor.isOpen}
                slotLabel={`MSEG ${synthView.selectedMsegSlot + 1}`}
                msegState={synthView.msegState}
                surfaceRef={msegEditorSurfaceRef}
                selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                hoveredSegmentIndex={synthView.msegEditor.hoveredSegmentIndex}
                activeSegmentIndex={synthView.msegEditor.activeSegmentIndex}
                onClose={synthView.msegEditor.closeEditor}
                onRateChange={synthView.handleMsegRateChange}
                onToggleLoop={synthView.handleToggleMsegLoop}
                onPointerDown={synthView.msegEditor.handlePointerDown}
                onPointerMove={synthView.msegEditor.handlePointerMove}
                onPointerLeave={synthView.msegEditor.handlePointerLeave}
                onPointerUp={synthView.msegEditor.handlePointerUp}
                rateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
            />

            {curveLab.panel}
        </div>
    );
}

export function DesktopPatchView({
    patchConnection,
    resourceClient,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient?: ResourceClient;
}) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
            <DesktopPatchViewBody />
        </PatchConnectionProvider>
    );
}
